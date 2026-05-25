import { type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';

import type { RulesChapter } from '../../types';
import { PAPER_BACKGROUND, PAPER_BORDER, PAPER_SHADOW, SERIF_STACK } from './rulebookStyles';
import { AIAssistPanel, type AIDraftState } from './AIAssistPanel';

export type { AIDraftState };

export interface RulebookPageProps {
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
  /* If this chapter had its body replaced by AI and the user hasn't
     made any other change yet, the previous body is held here so they
     can press Undo to restore it. */
  aiUndoBody: string | null;
  onUndoAI: (chapterId: string) => void;
  onBodyContextMenu: (event: ReactMouseEvent<HTMLTextAreaElement>) => void;
}


export function RulebookPage({
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
  aiUndoBody,
  onUndoAI,
  onBodyContextMenu,
}: RulebookPageProps) {
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
        {aiUndoBody !== null ? (
          <button
            type="button"
            onClick={() => onUndoAI(chapter.id)}
            aria-label={`Undo last AI change to ${chapter.title || 'this section'}`}
            title="Undo the last AI change to this section"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.6rem', borderRadius: '999px',
              border: '1px solid rgba(180, 83, 9, 0.45)',
              background: 'rgba(255,251,235,0.9)',
              color: '#9a3412',
              fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <RotateCcw size={13} />
            Undo AI
          </button>
        ) : null}
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
        onContextMenu={onBodyContextMenu}
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
