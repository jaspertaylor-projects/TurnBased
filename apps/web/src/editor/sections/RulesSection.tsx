import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, SpellCheck, X } from 'lucide-react';

import { addChapter, createBlankChapter, removeChapter, updateChapter } from '../project';
import { useRulesAIAssist } from './rules/useRulesAIAssist';
import type { CustomRulebookComponent, EditorProject, EditorRuleConfig } from '../types';
import { RulebookPage } from './rules/RulebookPage';
import type { CatalogComponentSelection } from './rules/ComponentPicker';
import { SERIF_STACK } from './rules/rulebookStyles';
import {
  ReplaceAllDialog,
  RulebookContextMenu,
  type ReplaceAllState,
  type RulebookContextMenuState,
} from './rules/ReplaceAllDialog';

const SPELLCHECK_HINT_KEY = 'turnbased.rulebook.spellcheckHintDismissed';

function clampSpread(index: number, totalChapters: number): number {
  if (totalChapters <= 0) return 0;
  const lastSpread = Math.max(0, Math.floor((totalChapters - 1) / 2));
  if (index < 0) return 0;
  if (index > lastSpread) return lastSpread;
  return index;
}

export function RulesSection({
  project,
  onUpdateRules,
  onAppendProjectTheme,
  onAppendProjectArtStyle,
  onAddCatalogComponent,
  onUpdateCatalogComponent,
  onUpdateInstanceNotes,
  onUpdateInstanceName,
  onRemoveInstance,
  onUpdateIconDescription,
}: {
  project: EditorProject;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
  /* Persist a new theme on the project brief (so it survives across
     generations and surfaces in other AI calls / project metadata).
     RulesSection wraps these to ALSO add the new chip to the current
     panel's available + selected lists so the user immediately sees it. */
  onAppendProjectTheme: (theme: string) => void;
  onAppendProjectArtStyle: (style: string) => void;
  /* Components-chapter wiring: these mutate project.instances so picks made
     inside the rulebook show up in the gallery and vice-versa. Custom
     components stay inside `rules.customComponents` and are handled via
     onUpdateRules below — no separate handler needed. */
  onAddCatalogComponent: (selection: CatalogComponentSelection) => void;
  onUpdateCatalogComponent: (instanceId: string, selection: CatalogComponentSelection) => void;
  onUpdateInstanceNotes: (instanceId: string, notes: string) => void;
  onUpdateInstanceName: (instanceId: string, displayName: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onUpdateIconDescription: (iconId: string, description: string) => void;
}) {
  const chapters = project.rules.chapters;
  const totalChapters = chapters.length;
  const [spreadIndex, setSpreadIndex] = useState(0);
  const {
    aiState,
    setAiState,
    aiUndoBodies,
    openAIPanel,
    cancelAIPanel,
    updateAIPanel,
    runAI,
    undoAI,
    clearAIUndo,
  } = useRulesAIAssist(project, onUpdateRules);

  // Custom right-click context menu, shown ONLY when the user has text
  // selected inside a body textarea. With no selection we fall through to
  // the browser's native menu so spellcheck "Add to dictionary" still works.
  const [contextMenu, setContextMenu] = useState<RulebookContextMenuState | null>(null);
  // Active find/replace dialog state.
  const [replaceState, setReplaceState] = useState<ReplaceAllState | null>(null);

  // Close the context menu when the user clicks anywhere else or hits Esc.
  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!replaceState) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setReplaceState(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [replaceState]);

  function handleBodyContextMenu(event: ReactMouseEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) {
      // No selection — let the native menu open (spellcheck, paste, etc.)
      return;
    }
    const selectedText = value.slice(selectionStart, selectionEnd).trim();
    if (!selectedText) {
      // Selection collapses to whitespace; native menu is more useful.
      return;
    }
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, selectedText });
  }

  function countMatches(needle: string): number {
    if (!needle) return 0;
    let count = 0;
    for (const chapter of chapters) {
      count += chapter.title.split(needle).length - 1;
      count += chapter.body.split(needle).length - 1;
    }
    return count;
  }

  function performReplaceAll(from: string, to: string) {
    if (!from || from === to) {
      setReplaceState(null);
      return;
    }
    onUpdateRules((rules) => ({
      ...rules,
      chapters: rules.chapters.map((chapter) => ({
        ...chapter,
        title: chapter.title.split(from).join(to),
        body: chapter.body.split(from).join(to),
      })),
    }));
    setReplaceState(null);
  }
  // Show a one-time hint about the browser's "Add to dictionary" right-click,
  // since most users don't realize that's how custom words get added to the
  // native spellchecker. Dismiss persists in localStorage.
  const [spellHintVisible, setSpellHintVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SPELLCHECK_HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  function dismissSpellHint() {
    setSpellHintVisible(false);
    try {
      window.localStorage.setItem(SPELLCHECK_HINT_KEY, '1');
    } catch {
      /* localStorage may be unavailable in private/strict modes */
    }
  }

  // Clamp spread when chapters shrink (delete) so we never land past the end.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSpreadIndex((prev) => clampSpread(prev, totalChapters));
    }, 0);
    return () => window.clearTimeout(t);
  }, [totalChapters]);

  // Drop AI panel state if its target chapter disappears (delete, etc.).

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
    clearAIUndo(chapterId);
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

  const handleAddCustomComponent = (entry: CustomRulebookComponent) =>
    onUpdateRules((rules) => ({ ...rules, customComponents: [...rules.customComponents, entry] }));
  const handleUpdateCustomComponent = (id: string, patch: Partial<Omit<CustomRulebookComponent, 'id'>>) =>
    onUpdateRules((rules) => ({
      ...rules,
      customComponents: rules.customComponents.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  const handleRemoveCustomComponent = (id: string) =>
    onUpdateRules((rules) => ({
      ...rules,
      customComponents: rules.customComponents.filter((entry) => entry.id !== id),
    }));

  function handlePrev() {
    if (canGoBack) setSpreadIndex(spreadIndex - 1);
  }

  function handleNext() {
    if (canGoForward) setSpreadIndex(spreadIndex + 1);
  }

  function appendAndSelect(kind: 'themes' | 'artStyles', value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    // 1. Persist to the project brief
    if (kind === 'themes') onAppendProjectTheme(trimmed);
    else onAppendProjectArtStyle(trimmed);
    // 2. Mirror into the current draft so the chip shows up + is selected
    //    without waiting for a panel re-mount.
    setAiState((prev) => {
      if (!prev) return prev;
      const availableKey = kind === 'themes' ? 'availableThemes' : 'availableArtStyles';
      const selectedKey = kind === 'themes' ? 'selectedThemes' : 'selectedArtStyles';
      const available = prev[availableKey];
      const selected = prev[selectedKey];
      const lower = trimmed.toLowerCase();
      const nextAvailable = available.some((entry) => entry.toLowerCase() === lower)
        ? available
        : [...available, trimmed];
      const nextSelected = selected.some((entry) => entry.toLowerCase() === lower)
        ? selected
        : [...selected, trimmed];
      return { ...prev, [availableKey]: nextAvailable, [selectedKey]: nextSelected };
    });
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
      <div
        data-layout="rulebookHeader"
        /* book title + page indicator */ style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF_STACK,
            color: '#3b2412',
            fontSize: '1.4rem',
            letterSpacing: '0.02em',
          }}
        >
          {project.brief.name || 'Untitled Rulebook'}
        </h1>
        <span
          style={{
            color: 'rgba(120, 95, 50, 0.7)',
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '0.88rem',
          }}
        >
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
          aiUndoBody={leftChapter ? (aiUndoBodies[leftChapter.id] ?? null) : null}
          onUndoAI={undoAI}
          onBodyContextMenu={handleBodyContextMenu}
          onAppendTheme={(value) => appendAndSelect('themes', value)}
          onAppendArtStyle={(value) => appendAndSelect('artStyles', value)}
          project={project}
          onAddCatalogComponent={onAddCatalogComponent}
          onUpdateCatalogComponent={onUpdateCatalogComponent}
          onAddCustomComponent={handleAddCustomComponent}
          onUpdateInstanceNotes={onUpdateInstanceNotes}
          onUpdateInstanceName={onUpdateInstanceName}
          onRemoveInstance={onRemoveInstance}
          onUpdateCustomComponent={handleUpdateCustomComponent}
          onRemoveCustomComponent={handleRemoveCustomComponent}
          onUpdateIconDescription={onUpdateIconDescription}
        />

        {/* spine shadow between the two pages */}
        <div data-layout="rulebookSpine"
          aria-hidden
          style={{
            width: '2px',
            background:
              'linear-gradient(180deg, rgba(60,40,20,0) 0%, rgba(60,40,20,0.18) 50%, rgba(60,40,20,0) 100%)',
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
          aiUndoBody={rightChapter ? (aiUndoBodies[rightChapter.id] ?? null) : null}
          onUndoAI={undoAI}
          onBodyContextMenu={handleBodyContextMenu}
          onAppendTheme={(value) => appendAndSelect('themes', value)}
          onAppendArtStyle={(value) => appendAndSelect('artStyles', value)}
          project={project}
          onAddCatalogComponent={onAddCatalogComponent}
          onUpdateCatalogComponent={onUpdateCatalogComponent}
          onAddCustomComponent={handleAddCustomComponent}
          onUpdateInstanceNotes={onUpdateInstanceNotes}
          onUpdateInstanceName={onUpdateInstanceName}
          onRemoveInstance={onRemoveInstance}
          onUpdateCustomComponent={handleUpdateCustomComponent}
          onRemoveCustomComponent={handleRemoveCustomComponent}
          onUpdateIconDescription={onUpdateIconDescription}
        />
      </div>

      {spellHintVisible ? (
        <div
          data-layout="rulebookSpellHint"
          /* one-time, dismissable tip: most users don't know browsers natively
             support "Add to dictionary" via right-click. Living between the
             spread and the nav row keeps it out of the way of editing. */
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.7rem',
            borderRadius: '10px',
            border: '1px dashed rgba(120, 95, 50, 0.28)',
            background: 'rgba(255, 251, 235, 0.7)',
            color: 'rgba(80, 55, 25, 0.78)',
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '0.82rem',
          }}
        >
          <SpellCheck size={14} style={{ color: '#0d9488', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Tip: right-click a red-underlined word to add it to your browser&rsquo;s personal dictionary
            &mdash; works for proper names, game terms, and anything else.
          </span>
          <button
            type="button"
            onClick={dismissSpellHint}
            aria-label="Dismiss spellcheck tip"
            title="Dismiss"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '999px',
              border: 'none',
              background: 'rgba(120, 95, 50, 0.1)',
              color: 'rgba(80, 55, 25, 0.7)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      <div
        data-layout="rulebookNav"
        /* Prev / Next + add-chapter actions */ style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.5rem 0.9rem',
            borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: canGoBack ? 'rgba(255,253,246,0.95)' : 'rgba(255,253,246,0.55)',
            color: canGoBack ? '#3b2412' : 'rgba(120,95,50,0.45)',
            cursor: canGoBack ? 'pointer' : 'not-allowed',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div data-layout="rulebookPageCounter"
          style={{
            flex: 1,
            color: 'rgba(120,95,50,0.55)',
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '0.8rem',
            textAlign: 'center',
          }}
        >
          {pageLabel}
        </div>

        <button
          type="button"
          onClick={handleAddChapter}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.5rem 0.9rem',
            borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: 'rgba(255,253,246,0.95)',
            color: '#3b2412',
            cursor: 'pointer',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          <Plus size={14} /> Add section
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoForward}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.5rem 0.9rem',
            borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: canGoForward ? 'rgba(255,253,246,0.95)' : 'rgba(255,253,246,0.55)',
            color: canGoForward ? '#3b2412' : 'rgba(120,95,50,0.45)',
            cursor: canGoForward ? 'pointer' : 'not-allowed',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>

      {contextMenu ? (
        <RulebookContextMenu
          state={contextMenu}
          onOpenReplaceDialog={(selectedText) => {
            setReplaceState({ from: selectedText, to: '' });
            setContextMenu(null);
          }}
        />
      ) : null}

      {replaceState ? (
        <ReplaceAllDialog
          state={replaceState}
          countMatches={countMatches}
          onChange={(next) => setReplaceState(next)}
          onCancel={() => setReplaceState(null)}
          onConfirm={() => performReplaceAll(replaceState.from, replaceState.to)}
        />
      ) : null}
    </div>
  );
}
