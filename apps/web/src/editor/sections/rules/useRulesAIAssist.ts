import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorProject, EditorRuleConfig, RulesChapter } from '../../types';
import type { AIDraftState } from '../../aiAssistTypes';
import { brainstormRulesIdeas, generateRulesChapterText } from '../../aiRulesService';
import { buildInitialAIDraft, saveAIAssistDraft, snapshotFromDraft } from '../../aiAssistDraftStorage';
import { saveRecentPrompt } from '../../aiPromptHistory';
import { updateChapter } from '../../project';

export function useRulesAIAssist(
  project: EditorProject,
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void,
) {
  const [aiState, setAiState] = useState<AIDraftState | null>(null);
  const [aiUndoBodies, setAiUndoBodies] = useState<Record<string, string>>({});
  const latest = useRef({ project, onUpdateRules });
  const request = useRef(0);
  const running = useRef(false);
  useLayoutEffect(() => {
    latest.current = { project, onUpdateRules };
  }, [project, onUpdateRules]);
  useEffect(
    () => () => {
      request.current += 1;
      running.current = false;
    },
    [project.id],
  );
  useEffect(() => {
    if (aiState) saveAIAssistDraft(project.id, snapshotFromDraft(aiState));
  }, [aiState, project.id]);
  useEffect(() => {
    if (!aiState || project.rules.chapters.some((chapter) => chapter.id === aiState.chapterId)) return;
    request.current += 1;
    running.current = false;
    const timer = setTimeout(() => setAiState(null), 0);
    return () => clearTimeout(timer);
  }, [aiState, project.rules.chapters]);

  function openAIPanel(chapter: RulesChapter) {
    request.current += 1;
    running.current = false;
    setAiState(buildInitialAIDraft(latest.current.project, chapter));
  }
  function cancelAIPanel() {
    request.current += 1;
    running.current = false;
    setAiState(null);
  }
  function updateAIPanel(patch: Partial<AIDraftState>) {
    setAiState((previous) =>
      previous
        ? {
            ...previous,
            ...patch,
            ...(patch.mode && patch.mode !== previous.mode ? { brainstormResults: [], error: null } : {}),
          }
        : previous,
    );
  }
  function clearAIUndo(chapterId: string) {
    setAiUndoBodies((previous) => {
      if (!(chapterId in previous)) return previous;
      const next = { ...previous };
      delete next[chapterId];
      return next;
    });
  }
  function undoAI(chapterId: string) {
    const body = aiUndoBodies[chapterId];
    if (body === undefined) return;
    latest.current.onUpdateRules((rules) => updateChapter(rules, chapterId, { body }));
    clearAIUndo(chapterId);
  }

  async function runAI(chapter: RulesChapter) {
    if (!aiState || aiState.chapterId !== chapter.id || aiState.loading || running.current) return;
    const active = ++request.current;
    const currentState = aiState;
    const projectAtStart = latest.current.project;
    running.current = true;
    const current = () => request.current === active && latest.current.project.id === projectAtStart.id;
    setAiState({ ...currentState, loading: true, error: null, brainstormResults: [] });
    saveRecentPrompt(currentState.prompt);
    const input = {
      project: projectAtStart,
      activeChapter: chapter,
      userPrompt: currentState.prompt,
      themes: currentState.selectedThemes,
      artStyles: currentState.selectedArtStyles,
      contextWeights: currentState.contextWeights,
      modelId: currentState.modelId,
      temperature: currentState.temperature,
    };
    try {
      if (currentState.mode === 'brainstorm') {
        const result = await brainstormRulesIdeas(input);
        if (!current()) return;
        setAiState((previous) =>
          previous?.chapterId === chapter.id
            ? { ...previous, loading: false, error: null, brainstormResults: result.ideas }
            : previous,
        );
        return;
      }
      const result = await generateRulesChapterText({ ...input, mode: currentState.mode });
      if (!current()) return;
      const fresh = latest.current.project.rules.chapters.find((item) => item.id === chapter.id);
      if (!fresh) {
        cancelAIPanel();
        return;
      }
      if (fresh.body !== chapter.body)
        throw new Error(
          'This section changed while AI was writing. Your newer text is safe; run again to use it.',
        );
      latest.current.onUpdateRules((rules) => updateChapter(rules, chapter.id, { body: result.text }));
      setAiUndoBodies((previous) => ({ ...previous, [chapter.id]: fresh.body }));
      setAiState(null);
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : 'AI request failed';
      setAiState((previous) =>
        previous?.chapterId === chapter.id ? { ...previous, loading: false, error: message } : previous,
      );
    } finally {
      if (current()) running.current = false;
    }
  }
  return {
    aiState,
    setAiState,
    aiUndoBodies,
    openAIPanel,
    cancelAIPanel,
    updateAIPanel,
    runAI,
    undoAI,
    clearAIUndo,
  };
}
