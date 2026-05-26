import type { CSSProperties } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { SERIF_STACK } from './rulebookStyles';

const removeButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: 'none',
  background: 'rgba(120, 95, 50, 0.08)',
  color: 'rgba(120, 60, 30, 0.7)',
  cursor: 'pointer',
  flexShrink: 0,
};

const fieldInputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid rgba(120, 95, 50, 0.15)',
  background: 'rgba(255, 253, 246, 0.95)',
  color: '#3b2412',
  fontFamily: SERIF_STACK,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  padding: '0.4rem 0.55rem',
  borderRadius: '8px',
  outline: 'none',
};

export interface CustomComponentDraft {
  name: string;
  description: string;
}

export interface CustomComponentModalProps {
  draft: CustomComponentDraft;
  onChange: (next: CustomComponentDraft | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function CustomComponentModal({ draft, onChange, onCancel, onSubmit }: CustomComponentModalProps) {
  const canSubmit = draft.name.trim().length > 0;

  return (
    <div
      data-layout="customComponentModalScrim"
      /* full-viewport overlay so the warning + form is unmissable.
         Click outside cancels. */
      role="dialog"
      aria-modal="true"
      aria-label="Add custom component"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(40, 25, 10, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 80,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        data-layout="customComponentModalCard"
        style={{
          width: 'min(440px, 92vw)',
          background: 'linear-gradient(155deg, #fffdf6 0%, #f8efd9 100%)',
          border: '1px solid rgba(120, 95, 50, 0.32)',
          borderRadius: '14px',
          boxShadow: '0 18px 48px rgba(60, 40, 20, 0.32)',
          padding: '1.1rem 1.2rem 1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div data-layout="customComponentModalHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
          <span style={{ fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '1.1rem', color: '#3b2412' }}>
            Custom component
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel custom component"
            style={removeButtonStyle}
          >
            <X size={14} />
          </button>
        </div>

        <div
          data-layout="customComponentModalWarning"
          /* the load-bearing warning — surfaces the supplier limitation
             before the user invests time describing it. */
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem',
            padding: '0.6rem 0.7rem',
            borderRadius: '10px',
            border: '1px solid rgba(180, 83, 9, 0.4)',
            background: 'rgba(255, 247, 235, 0.85)',
            color: '#9a3412',
            fontFamily: SERIF_STACK,
            fontSize: '0.86rem',
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.12rem' }} />
          <span>
            Custom components aren&rsquo;t in our supplier catalog. You can write about them in
            the rulebook, but we won&rsquo;t be able to print or ship this piece through this site.
          </span>
        </div>

        <label data-layout="customComponentModalNameField" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontFamily: SERIF_STACK, fontWeight: 700, color: '#3b2412', fontSize: '0.86rem' }}>
            Name
          </span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="e.g. Glowstone die"
            autoFocus
            style={{ ...fieldInputStyle, fontSize: '1rem', fontWeight: 600, padding: '0.5rem 0.6rem' }}
          />
        </label>

        <label data-layout="customComponentModalDescField" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontFamily: SERIF_STACK, fontWeight: 700, color: '#3b2412', fontSize: '0.86rem' }}>
            Description
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="What is it? How does it look or behave?"
            style={{ ...fieldInputStyle, minHeight: '78px', resize: 'vertical' }}
          />
        </label>

        <div data-layout="customComponentModalActions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '999px',
              border: '1px solid rgba(120, 95, 50, 0.3)',
              background: 'rgba(255, 253, 246, 0.95)',
              color: '#3b2412',
              cursor: 'pointer',
              fontFamily: SERIF_STACK,
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              padding: '0.5rem 0.95rem',
              borderRadius: '999px',
              border: '1px solid rgba(15, 118, 110, 0.45)',
              background: canSubmit ? 'rgba(13, 148, 136, 0.95)' : 'rgba(13, 148, 136, 0.4)',
              color: '#fffdf6',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: SERIF_STACK,
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Add component
          </button>
        </div>
      </div>
    </div>
  );
}
