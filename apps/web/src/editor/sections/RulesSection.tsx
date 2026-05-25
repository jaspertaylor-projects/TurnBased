import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

import { addChapter, createBlankChapter, removeChapter, updateChapter } from '../project';
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

interface PageProps {
  chapter: RulesChapter | null;
  pageNumber: number;
  onTitleChange: (chapterId: string, title: string) => void;
  onBodyChange: (chapterId: string, body: string) => void;
  onRemove: (chapterId: string) => void;
  onAdd: () => void;
  side: 'left' | 'right';
}

function RulebookPage({ chapter, pageNumber, onTitleChange, onBodyChange, onRemove, onAdd, side }: PageProps) {
  const isLeftPage = side === 'left';
  const pageInner: ReactNode = chapter ? (
    <div data-layout="pageContent" /* page content column inside the paper card */ style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '0.75rem' }}>
      <div data-layout="pageTitleRow" /* editable chapter title + remove button */ style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          value={chapter.title}
          onChange={(event) => onTitleChange(chapter.id, event.target.value)}
          placeholder="Untitled chapter"
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
          onClick={() => onRemove(chapter.id)}
          aria-label={`Remove ${chapter.title || 'chapter'}`}
          title="Remove chapter"
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

      <textarea
        value={chapter.body}
        onChange={(event) => onBodyChange(chapter.id, event.target.value)}
        placeholder="Write this part of the rulebook..."
        aria-label="Chapter text"
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
  const totalSpreads = Math.max(1, Math.ceil(Math.max(1, totalChapters) / 2));
  const [spreadIndex, setSpreadIndex] = useState(0);

  // Clamp spread when chapters shrink (delete) so we never land past the end.
  useEffect(() => {
    setSpreadIndex((prev) => clampSpread(prev, totalChapters));
  }, [totalChapters]);

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
