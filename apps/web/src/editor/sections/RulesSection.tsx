import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, Replace, SpellCheck, X } from 'lucide-react';

import { addChapter, createBlankChapter, removeChapter, updateChapter } from '../project';
import { generateRulesChapterText } from '../aiRulesService';
import type { EditorProject, EditorRuleConfig, RulesChapter } from '../types';
import { RulebookPage, type AIDraftState } from './rules/RulebookPage';
import { PAPER_BACKGROUND, PAPER_BORDER, PAPER_SHADOW, SERIF_STACK } from './rules/rulebookStyles';

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
}: {
  project: EditorProject;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
}) {
  const chapters = project.rules.chapters;
  const totalChapters = chapters.length;
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [aiState, setAiState] = useState<AIDraftState | null>(null);
  // Per-chapter pre-AI body snapshot. Set right before we replace the body
  // with the model's output; cleared when the user clicks Undo. Lives in
  // local state — we deliberately don't persist this across reloads so the
  // Undo affordance only lives as long as the editor session.
  const [aiUndoBodies, setAiUndoBodies] = useState<Record<string, string>>({});

  // Custom right-click context menu, shown ONLY when the user has text
  // selected inside a body textarea. With no selection we fall through to
  // the browser's native menu so spellcheck "Add to dictionary" still works.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null);
  // Active find/replace dialog state.
  const [replaceState, setReplaceState] = useState<{ from: string; to: string } | null>(null);

  // Close the context menu when the user clicks anywhere else or hits Esc.
  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close(); }
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
    try { return window.localStorage.getItem(SPELLCHECK_HINT_KEY) !== '1'; }
    catch { return true; }
  });
  function dismissSpellHint() {
    setSpellHintVisible(false);
    try { window.localStorage.setItem(SPELLCHECK_HINT_KEY, '1'); }
    catch { /* localStorage may be unavailable in private/strict modes */ }
  }

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
      // Snapshot the most recent body just before swapping it out, then
      // replace. The body might differ from the chapter.body we opened the
      // AI panel with if the user kept typing while the request was in
      // flight — read fresh from project.rules.chapters by id.
      const fresh = project.rules.chapters.find((c) => c.id === chapter.id);
      const previousBody = fresh?.body ?? chapter.body;
      onUpdateRules((rules) => updateChapter(rules, chapter.id, { body: result.text }));
      setAiUndoBodies((prev) => ({ ...prev, [chapter.id]: previousBody }));
      setAiState(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed';
      setAiState((prev) => (prev && prev.chapterId === chapter.id ? { ...prev, loading: false, error: message } : prev));
    }
  }

  function undoAI(chapterId: string) {
    setAiUndoBodies((prev) => {
      const snapshot = prev[chapterId];
      if (snapshot === undefined) return prev;
      onUpdateRules((rules) => updateChapter(rules, chapterId, { body: snapshot }));
      const next = { ...prev };
      delete next[chapterId];
      return next;
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
          aiUndoBody={leftChapter ? aiUndoBodies[leftChapter.id] ?? null : null}
          onUndoAI={undoAI}
          onBodyContextMenu={handleBodyContextMenu}
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
          aiUndoBody={rightChapter ? aiUndoBodies[rightChapter.id] ?? null : null}
          onUndoAI={undoAI}
          onBodyContextMenu={handleBodyContextMenu}
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
            Tip: right-click a red-underlined word to add it to your browser&rsquo;s personal dictionary &mdash; works for proper names, game terms, and anything else.
          </span>
          <button
            type="button"
            onClick={dismissSpellHint}
            aria-label="Dismiss spellcheck tip"
            title="Dismiss"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', borderRadius: '999px',
              border: 'none', background: 'rgba(120, 95, 50, 0.1)',
              color: 'rgba(80, 55, 25, 0.7)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

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

      {contextMenu ? (
        <div
          data-layout="rulebookContextMenu"
          /* Custom right-click menu shown when text is selected inside a
             chapter body. Anchored to the viewport at the cursor; native
             menu is preserved everywhere there's no selection. */
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            position: 'fixed',
            top: Math.min(contextMenu.y, window.innerHeight - 80),
            left: Math.min(contextMenu.x, window.innerWidth - 280),
            zIndex: 200,
            minWidth: '240px',
            background: 'rgba(255,253,246,0.98)',
            border: '1px solid rgba(120,95,50,0.25)',
            borderRadius: '10px',
            boxShadow: '0 10px 28px rgba(60,40,20,0.18)',
            padding: '0.35rem',
            display: 'grid',
            gap: '0.15rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setReplaceState({ from: contextMenu.selectedText, to: '' });
              setContextMenu(null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.7rem', borderRadius: '6px',
              border: 'none', background: 'transparent',
              color: '#3b2412', cursor: 'pointer',
              fontFamily: SERIF_STACK, fontWeight: 600, fontSize: '0.86rem',
              textAlign: 'left',
            }}
            onMouseEnter={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'rgba(13,148,136,0.10)'; }}
            onMouseLeave={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <Replace size={14} style={{ color: '#0d9488', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Replace all &ldquo;{contextMenu.selectedText.length > 24 ? `${contextMenu.selectedText.slice(0, 24)}…` : contextMenu.selectedText}&rdquo; in rulebook
            </span>
          </button>
        </div>
      ) : null}

      {replaceState ? (
        <div
          data-layout="rulebookReplaceModal"
          /* Modal backdrop + dialog for the find/replace operation. */
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReplaceState(null);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(60,40,20,0.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            data-layout="rulebookReplaceDialog"
            /* Card with the find input (selection prefilled), replacement
               input, match count, and the Replace All / Cancel actions. */
            style={{
              width: '100%', maxWidth: '480px',
              background: PAPER_BACKGROUND,
              border: PAPER_BORDER,
              borderRadius: '14px',
              boxShadow: PAPER_SHADOW,
              padding: '1.1rem 1.2rem',
              display: 'grid', gap: '0.7rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Replace size={16} style={{ color: '#0d9488' }} />
              <span style={{ fontFamily: SERIF_STACK, fontWeight: 800, fontSize: '1.05rem', color: '#3b2412' }}>
                Replace all in rulebook
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setReplaceState(null)}
                aria-label="Close replace dialog"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', borderRadius: '999px',
                  border: 'none', background: 'rgba(120,95,50,0.1)', color: '#3b2412', cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            </div>

            <label style={{ display: 'grid', gap: '0.25rem', fontFamily: SERIF_STACK, fontSize: '0.85rem', color: 'rgba(80,55,25,0.85)' }}>
              Find
              <input
                value={replaceState.from}
                onChange={(event) => setReplaceState((prev) => (prev ? { ...prev, from: event.target.value } : prev))}
                autoFocus={false}
                spellCheck={false}
                style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(120,95,50,0.25)', background: 'rgba(255,255,255,0.85)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', color: '#3b2412' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.25rem', fontFamily: SERIF_STACK, fontSize: '0.85rem', color: 'rgba(80,55,25,0.85)' }}>
              Replace with
              <input
                value={replaceState.to}
                onChange={(event) => setReplaceState((prev) => (prev ? { ...prev, to: event.target.value } : prev))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') performReplaceAll(replaceState.from, replaceState.to);
                }}
                autoFocus
                spellCheck={false}
                placeholder="(leave blank to delete every occurrence)"
                style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(120,95,50,0.25)', background: 'rgba(255,255,255,0.85)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', color: '#3b2412' }}
              />
            </label>

            <div style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: 'rgba(80,55,25,0.7)', fontSize: '0.82rem' }}>
              {(() => {
                const matches = countMatches(replaceState.from);
                if (!replaceState.from) return 'Enter something to find.';
                if (matches === 0) return 'No occurrences in this rulebook.';
                if (matches === 1) return '1 occurrence will be replaced (search is case-sensitive; titles included).';
                return `${matches} occurrences will be replaced (search is case-sensitive; titles included).`;
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={() => setReplaceState(null)}
                style={{
                  padding: '0.45rem 0.85rem', borderRadius: '999px',
                  border: '1px solid rgba(120,95,50,0.3)',
                  background: 'rgba(255,253,246,0.95)', color: '#3b2412',
                  fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performReplaceAll(replaceState.from, replaceState.to)}
                disabled={!replaceState.from || countMatches(replaceState.from) === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.45rem 1rem', borderRadius: '999px', border: 'none',
                  background: (!replaceState.from || countMatches(replaceState.from) === 0) ? 'rgba(13,148,136,0.35)' : 'linear-gradient(135deg, #064e3b, #0d9488)',
                  color: 'white',
                  fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.88rem',
                  cursor: (!replaceState.from || countMatches(replaceState.from) === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                <Replace size={14} />
                Replace All
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
