import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';

import { addChapter, createBlankChapter, removeChapter, updateChapter } from '../project';
import { generateRulesChapterText, type AIRulesMode } from '../aiRulesService';
import type { EditorProject, EditorRuleConfig, RulesChapter } from '../types';

const PAPER_BACKGROUND = 'linear-gradient(155deg, #fffdf6 0%, #f8efd9 100%)';
const PAPER_BORDER = '1px solid rgba(120, 95, 50, 0.22)';
const PAPER_SHADOW = '0 8px 24px rgba(80, 55, 25, 0.16), 0 1px 2px rgba(60, 40, 20, 0.18)';
const SERIF_STACK = "'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif";

function clampSpread(index: number, totalChapters: number): number {
  if (totalChapters <= 0) return 0;
  const lastSpread = Math.max(0, Math.floor((totalChapters - 1) / 2));
  if (index < 0) return 0;
  if (index > lastSpread) return lastSpread;
  return index;
}

interface AIDraftState {
  chapterId: string;
  prompt: string;
  mode: AIRulesMode;
  loading: boolean;
  error: string | null;
}

interface PageProps {
  chapter: RulesChapter | null;
  pageNumber: number;
  onTitleChange: (chapterId: string, title: string) => void;
  onBodyChange: (chapterId: string, body: string) => void;
  onRemove: (chapterId: string) => void;
  onAdd: () => void;
  side: 'left' | 'right';
  aiState: AIDraftState | null;
  onOpenAI: (chapter: RulesChapter) => void;
  onUpdateAI: (patch: Partial<AIDraftState>) => void;
  onCancelAI: () => void;
  onRunAI: (chapter: RulesChapter) => void;
}

function AIAssistPanel({
  chapter,
  state,
  onUpdateAI,
  onCancelAI,
  onRunAI,
}: {
  chapter: RulesChapter;
  state: AIDraftState;
  onUpdateAI: (patch: Partial<AIDraftState>) => void;
  onCancelAI: () => void;
  onRunAI: (chapter: RulesChapter) => void;
}) {
  const bodyHasContent = chapter.body.trim().length > 0;
  return (
    <div
      data-layout="aiAssistPanel"
      /* inline AI prompt panel rendered between the title divider and the
         body textarea. Cream parchment with a dashed teal accent so it
         reads as a deliberate "AI editor" mode without clashing with the
         page itself. */
      style={{
        flex: '0 0 auto',
        display: 'grid',
        gap: '0.55rem',
        padding: '0.7rem 0.8rem',
        borderRadius: '12px',
        background: 'rgba(255,251,238,0.85)',
        border: '1px dashed rgba(13,148,136,0.5)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <Sparkles size={14} style={{ color: '#0d9488' }} />
        <span style={{ fontFamily: SERIF_STACK, fontWeight: 700, color: '#3b2412', fontSize: '0.92rem' }}>
          AI assist — {chapter.title || 'Untitled section'}
        </span>
      </div>

      <div data-layout="aiModeRow" /* draft / expand / rewrite mode toggle */ style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {(
          [
            { key: 'draft' as const, label: 'Fresh draft', disabledHint: bodyHasContent ? 'Will replace existing text' : null },
            { key: 'expand' as const, label: 'Expand', disabledHint: bodyHasContent ? null : 'Nothing to expand yet' },
            { key: 'rewrite' as const, label: 'Rewrite', disabledHint: bodyHasContent ? null : 'Nothing to rewrite yet' },
          ]
        ).map((option) => {
          const disabled = (option.key !== 'draft' && !bodyHasContent);
          const selected = state.mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => !disabled && onUpdateAI({ mode: option.key })}
              disabled={disabled || state.loading}
              title={option.disabledHint ?? option.label}
              style={{
                padding: '0.32rem 0.7rem', borderRadius: '999px',
                border: selected ? '1px solid rgba(13,148,136,0.8)' : '1px solid rgba(120,95,50,0.3)',
                background: selected ? 'rgba(13,148,136,0.18)' : 'rgba(255,253,246,0.9)',
                color: disabled ? 'rgba(120,95,50,0.4)' : '#3b2412',
                fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.78rem',
                cursor: disabled ? 'not-allowed' : (state.loading ? 'wait' : 'pointer'),
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={state.prompt}
        onChange={(event) => onUpdateAI({ prompt: event.target.value })}
        placeholder={
          state.mode === 'draft'
            ? 'Optional: tell the AI what this section should cover. Leave blank to draft from the rest of your rulebook.'
            : state.mode === 'expand'
              ? 'Optional: what would you like added? Examples, clarifications, an edge case…'
              : 'Optional: what should change in the rewrite? Tone, structure, brevity…'
        }
        disabled={state.loading}
        style={{
          width: '100%', boxSizing: 'border-box',
          minHeight: '64px',
          padding: '0.55rem 0.7rem',
          borderRadius: '10px',
          border: '1px solid rgba(120,95,50,0.2)',
          background: 'rgba(255,255,255,0.85)',
          color: '#3b2412',
          fontFamily: SERIF_STACK,
          fontSize: '0.86rem',
          resize: 'vertical',
        }}
      />

      {state.error ? (
        <div style={{ padding: '0.4rem 0.55rem', borderRadius: '8px', background: 'rgba(254,226,226,0.85)', border: '1px solid rgba(239,68,68,0.25)', color: '#991b1b', fontSize: '0.8rem' }}>
          {state.error}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancelAI}
          disabled={state.loading}
          style={{
            padding: '0.4rem 0.8rem', borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: 'rgba(255,253,246,0.95)', color: '#3b2412',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.82rem',
            cursor: state.loading ? 'wait' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onRunAI(chapter)}
          disabled={state.loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.95rem', borderRadius: '999px', border: 'none',
            background: state.loading ? 'rgba(13,148,136,0.45)' : 'linear-gradient(135deg, #064e3b, #0d9488)',
            color: 'white',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.85rem',
            cursor: state.loading ? 'wait' : 'pointer',
          }}
        >
          {state.loading ? <Loader2 size={14} style={{ animation: 'spin 1.1s linear infinite' }} /> : <Sparkles size={14} />}
          {state.loading ? 'Writing…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}

function RulebookPage({
  chapter,
  pageNumber,
  onTitleChange,
  onBodyChange,
  onRemove,
  onAdd,
  side,
  aiState,
  onOpenAI,
  onUpdateAI,
  onCancelAI,
  onRunAI,
}: PageProps) {
  const isLeftPage = side === 'left';
  const aiTargetsThisPage = chapter !== null && aiState !== null && aiState.chapterId === chapter.id;
  const pageInner: ReactNode = chapter ? (
    <div data-layout="pageContent" /* page content column inside the paper card */ style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '0.75rem' }}>
      <div data-layout="pageTitleRow" /* editable chapter title + AI / remove buttons */ style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input
          value={chapter.title}
          onChange={(event) => onTitleChange(chapter.id, event.target.value)}
          placeholder="Untitled section"
          aria-label="Chapter title"
          style={{
            flex: '1 1 auto', minWidth: 0,
            border: 'none',
            background: 'transparent',
            color: '#3b2412',
            fontFamily: SERIF_STACK,
            fontSize: '1.4rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            padding: '0.1rem 0.2rem',
            borderRadius: '6px',
          }}
        />
        <button
          type="button"
          onClick={() => onOpenAI(chapter)}
          disabled={aiTargetsThisPage}
          aria-label={`Open AI assist for ${chapter.title || 'this section'}`}
          title="Ask the AI for help with this section"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.3rem 0.6rem', borderRadius: '999px',
            border: '1px solid rgba(13,148,136,0.4)',
            background: aiTargetsThisPage ? 'rgba(13,148,136,0.18)' : 'rgba(255,253,246,0.9)',
            color: '#0d9488',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.78rem',
            cursor: aiTargetsThisPage ? 'default' : 'pointer', flexShrink: 0,
          }}
        >
          <Sparkles size={13} />
          AI
        </button>
        <button
          type="button"
          onClick={() => onRemove(chapter.id)}
          aria-label={`Remove ${chapter.title || 'chapter'}`}
          title="Remove section"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '999px',
            border: 'none', background: 'rgba(120, 95, 50, 0.08)', color: 'rgba(120, 60, 30, 0.7)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div aria-hidden style={{ height: '1px', background: 'linear-gradient(90deg, rgba(120,95,50,0.4) 0%, rgba(120,95,50,0.1) 100%)', flex: '0 0 auto' }} />

      {aiTargetsThisPage && aiState ? (
        <AIAssistPanel
          chapter={chapter}
          state={aiState}
          onUpdateAI={onUpdateAI}
          onCancelAI={onCancelAI}
          onRunAI={onRunAI}
        />
      ) : null}

      <textarea
        value={chapter.body}
        onChange={(event) => onBodyChange(chapter.id, event.target.value)}
        placeholder="Write this part of the rulebook..."
        aria-label="Chapter text"
        disabled={aiTargetsThisPage && aiState?.loading}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          border: 'none',
          background: 'transparent',
          resize: 'none',
          color: '#3b2412',
          fontFamily: SERIF_STACK,
          fontSize: '0.96rem',
          lineHeight: 1.6,
          padding: '0.2rem 0.2rem',
          outline: 'none',
        }}
      />

      <div data-layout="pageNumberRow" /* page-number flourish at the bottom corner */ style={{ flex: '0 0 auto', display: 'flex', justifyContent: isLeftPage ? 'flex-start' : 'flex-end' }}>
        <span style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: 'rgba(120, 95, 50, 0.55)', fontSize: '0.78rem' }}>
          — {pageNumber} —
        </span>
      </div>
    </div>
  ) : (
    <div data-layout="addChapterPagePlaceholder" /* "add chapter" affordance occupies an empty facing page */ style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: '0.7rem' }}>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.7rem 1.1rem', borderRadius: '999px',
          border: '1px dashed rgba(120, 95, 50, 0.45)',
          background: 'rgba(255, 253, 246, 0.6)',
          color: '#3b2412', cursor: 'pointer',
          fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.92rem',
        }}
      >
        <Plus size={14} />
        Add section
      </button>
      <span style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: 'rgba(120, 95, 50, 0.55)', fontSize: '0.8rem' }}>
        A blank page, waiting.
      </span>
    </div>
  );

  return (
    <div
      data-layout="rulebookPage"
      data-side={side}
      /* one paper page in the open spread — parchment-tinted, serif body,
         soft warm border + drop shadow so the pair reads as a printed book. */
      style={{
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        background: PAPER_BACKGROUND,
        border: PAPER_BORDER,
        borderRadius: isLeftPage ? '8px 4px 4px 10px' : '4px 8px 10px 4px',
        boxShadow: PAPER_SHADOW,
        padding: '1.3rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {pageInner}
    </div>
  );
}

export function RulesSection({
  project,
  onUpdateRules,
}: {
  project: EditorProject;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
}) {
  const chapters = project.rules.chapters;
  const totalChapters = chapters.length;
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [aiState, setAiState] = useState<AIDraftState | null>(null);

  // Clamp spread when chapters shrink (delete) so we never land past the end.
  useEffect(() => {
    setSpreadIndex((prev) => clampSpread(prev, totalChapters));
  }, [totalChapters]);

  // Drop AI panel state if its target chapter disappears (delete, etc.).
  useEffect(() => {
    if (!aiState) return;
    const stillThere = chapters.some((chapter) => chapter.id === aiState.chapterId);
    if (!stillThere) setAiState(null);
  }, [aiState, chapters]);

  const leftIndex = spreadIndex * 2;
  const rightIndex = leftIndex + 1;
  const leftChapter = chapters[leftIndex] ?? null;
  const rightChapter = chapters[rightIndex] ?? null;

  const canGoBack = spreadIndex > 0;
  const lastSpread = Math.max(0, Math.floor(Math.max(0, totalChapters - 1) / 2));
  const canGoForward = spreadIndex < lastSpread;

  const pageLabel = useMemo(() => {
    if (totalChapters === 0) return '0 of 0';
    const lastPage = Math.min(totalChapters, rightIndex + 1);
    if (lastPage === leftIndex + 1) {
      return `Page ${leftIndex + 1} of ${totalChapters}`;
    }
    return `Pages ${leftIndex + 1}–${lastPage} of ${totalChapters}`;
  }, [leftIndex, rightIndex, totalChapters]);

  function setChapterTitle(chapterId: string, title: string) {
    onUpdateRules((rules) => updateChapter(rules, chapterId, { title }));
  }

  function setChapterBody(chapterId: string, body: string) {
    onUpdateRules((rules) => updateChapter(rules, chapterId, { body }));
  }

  function handleAddChapter() {
    const next = createBlankChapter();
    onUpdateRules((rules) => addChapter(rules, next));
    // Move to the spread that now holds the new chapter (after totalChapters
    // bumps up). The newly-added chapter is appended, so its index is the old
    // totalChapters, which is at spread floor(totalChapters/2).
    const newSpread = Math.floor(totalChapters / 2);
    setSpreadIndex(newSpread);
  }

  function handleRemoveChapter(chapterId: string) {
    onUpdateRules((rules) => removeChapter(rules, chapterId));
  }

  function handlePrev() {
    if (canGoBack) setSpreadIndex(spreadIndex - 1);
  }

  function handleNext() {
    if (canGoForward) setSpreadIndex(spreadIndex + 1);
  }

  function openAIPanel(chapter: RulesChapter) {
    setAiState({
      chapterId: chapter.id,
      prompt: '',
      mode: chapter.body.trim().length > 0 ? 'expand' : 'draft',
      loading: false,
      error: null,
    });
  }

  function updateAIPanel(patch: Partial<AIDraftState>) {
    setAiState((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function cancelAIPanel() {
    setAiState(null);
  }

  async function runAI(chapter: RulesChapter) {
    if (!aiState || aiState.chapterId !== chapter.id || aiState.loading) return;
    const currentState = aiState;
    setAiState({ ...currentState, loading: true, error: null });
    try {
      const result = await generateRulesChapterText({
        project,
        activeChapter: chapter,
        userPrompt: currentState.prompt,
        mode: currentState.mode,
      });
      // Replace the chapter body with the AI's output. All three modes
      // (draft/expand/rewrite) return a complete body — see the edge
      // function's system prompt.
      onUpdateRules((rules) => updateChapter(rules, chapter.id, { body: result.text }));
      setAiState(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed';
      setAiState((prev) => (prev && prev.chapterId === chapter.id ? { ...prev, loading: false, error: message } : prev));
    }
  }

  return (
    <div
      data-layout="rulebookRoot"
      /* Bounded shell per Rule 4 — stationary frame, only the textareas
         scroll. Three regions:
            header (book title + page label)
            spread (the two facing pages)
            footer (Prev / Next nav)                                       */
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: '1rem 1.5rem',
        gap: '0.85rem',
      }}
    >
      <div data-layout="rulebookHeader" /* book title + page indicator */ style={{ flex: '0 0 auto', display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: SERIF_STACK, color: '#3b2412', fontSize: '1.4rem', letterSpacing: '0.02em' }}>
          {project.brief.name || 'Untitled Rulebook'}
        </h1>
        <span style={{ color: 'rgba(120, 95, 50, 0.7)', fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.88rem' }}>
          {pageLabel}
        </span>
      </div>

      <div
        data-layout="rulebookSpread"
        /* the open book — two facing pages, separated by a soft spine.
           flex 1 1 auto means the spread divides whatever vertical space
           is left between the header and the nav footer. */
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        <RulebookPage
          chapter={leftChapter}
          pageNumber={leftIndex + 1}
          onTitleChange={setChapterTitle}
          onBodyChange={setChapterBody}
          onRemove={handleRemoveChapter}
          onAdd={handleAddChapter}
          side="left"
          aiState={aiState}
          onOpenAI={openAIPanel}
          onUpdateAI={updateAIPanel}
          onCancelAI={cancelAIPanel}
          onRunAI={runAI}
        />

        {/* spine shadow between the two pages */}
        <div
          aria-hidden
          style={{
            width: '2px',
            background: 'linear-gradient(180deg, rgba(60,40,20,0) 0%, rgba(60,40,20,0.18) 50%, rgba(60,40,20,0) 100%)',
            flex: '0 0 auto',
            alignSelf: 'stretch',
          }}
        />

        <RulebookPage
          chapter={rightChapter}
          pageNumber={rightIndex + 1}
          onTitleChange={setChapterTitle}
          onBodyChange={setChapterBody}
          onRemove={handleRemoveChapter}
          onAdd={handleAddChapter}
          side="right"
          aiState={aiState}
          onOpenAI={openAIPanel}
          onUpdateAI={updateAIPanel}
          onCancelAI={cancelAIPanel}
          onRunAI={runAI}
        />
      </div>

      <div data-layout="rulebookNav" /* Prev / Next + add-chapter actions */ style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.5rem 0.9rem', borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: canGoBack ? 'rgba(255,253,246,0.95)' : 'rgba(255,253,246,0.55)',
            color: canGoBack ? '#3b2412' : 'rgba(120,95,50,0.45)',
            cursor: canGoBack ? 'pointer' : 'not-allowed',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.85rem',
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div style={{ flex: 1, color: 'rgba(120,95,50,0.55)', fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
          {pageLabel}
        </div>

        <button
          type="button"
          onClick={handleAddChapter}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.5rem 0.9rem', borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: 'rgba(255,253,246,0.95)',
            color: '#3b2412',
            cursor: 'pointer',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.85rem',
          }}
        >
          <Plus size={14} /> Add section
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoForward}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.5rem 0.9rem', borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: canGoForward ? 'rgba(255,253,246,0.95)' : 'rgba(255,253,246,0.55)',
            color: canGoForward ? '#3b2412' : 'rgba(120,95,50,0.45)',
            cursor: canGoForward ? 'pointer' : 'not-allowed',
            fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.85rem',
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
