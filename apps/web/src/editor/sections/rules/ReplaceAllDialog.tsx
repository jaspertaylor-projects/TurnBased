import { Replace, X } from 'lucide-react';

import { PAPER_BACKGROUND, PAPER_BORDER, PAPER_SHADOW, SERIF_STACK } from './rulebookStyles';

export interface RulebookContextMenuState {
  x: number;
  y: number;
  selectedText: string;
}

export interface ReplaceAllState {
  from: string;
  to: string;
}

/**
 * Floating menu shown when the user right-clicks a non-empty selection inside
 * a rulebook body textarea. Currently a single action — Replace all — but
 * structured so additional actions can be slotted in later.
 */
export function RulebookContextMenu({
  state,
  onOpenReplaceDialog,
}: {
  state: RulebookContextMenuState;
  onOpenReplaceDialog: (selectedText: string) => void;
}) {
  return (
    <div
      data-layout="rulebookContextMenu"
      /* Anchored to the viewport at the cursor; the native menu is preserved
         everywhere there's no text selection. */
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        top: Math.min(state.y, window.innerHeight - 80),
        left: Math.min(state.x, window.innerWidth - 280),
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
        onClick={() => onOpenReplaceDialog(state.selectedText)}
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
          Replace all &ldquo;{state.selectedText.length > 24 ? `${state.selectedText.slice(0, 24)}…` : state.selectedText}&rdquo; in rulebook
        </span>
      </button>
    </div>
  );
}

/**
 * Modal dialog confirming a find/replace across every chapter title and
 * body in the rulebook. Shows a live match count and disables Replace All
 * when the find string is empty or matches nothing.
 */
export function ReplaceAllDialog({
  state,
  countMatches,
  onChange,
  onCancel,
  onConfirm,
}: {
  state: ReplaceAllState;
  countMatches: (needle: string) => number;
  onChange: (next: ReplaceAllState) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const matches = countMatches(state.from);
  const disabled = !state.from || matches === 0;

  return (
    <div
      data-layout="rulebookReplaceModal"
      /* Backdrop + dialog. Click outside the dialog body cancels. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
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
            onClick={onCancel}
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
            value={state.from}
            onChange={(event) => onChange({ ...state, from: event.target.value })}
            autoFocus={false}
            spellCheck={false}
            style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(120,95,50,0.25)', background: 'rgba(255,255,255,0.85)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', color: '#3b2412' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem', fontFamily: SERIF_STACK, fontSize: '0.85rem', color: 'rgba(80,55,25,0.85)' }}>
          Replace with
          <input
            value={state.to}
            onChange={(event) => onChange({ ...state, to: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter') onConfirm(); }}
            autoFocus
            spellCheck={false}
            placeholder="(leave blank to delete every occurrence)"
            style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(120,95,50,0.25)', background: 'rgba(255,255,255,0.85)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', color: '#3b2412' }}
          />
        </label>

        <div style={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: 'rgba(80,55,25,0.7)', fontSize: '0.82rem' }}>
          {(() => {
            if (!state.from) return 'Enter something to find.';
            if (matches === 0) return 'No occurrences in this rulebook.';
            if (matches === 1) return '1 occurrence will be replaced (search is case-sensitive; titles included).';
            return `${matches} occurrences will be replaced (search is case-sensitive; titles included).`;
          })()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={onCancel}
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
            onClick={onConfirm}
            disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 1rem', borderRadius: '999px', border: 'none',
              background: disabled ? 'rgba(13,148,136,0.35)' : 'linear-gradient(135deg, #064e3b, #0d9488)',
              color: 'white',
              fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.88rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <Replace size={14} />
            Replace All
          </button>
        </div>
      </div>
    </div>
  );
}
