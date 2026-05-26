import type { CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  listAuthorableBuiltInComponents,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentManifest,
} from '@turnbased/engine-components';

import { renderComponentIcon } from '../../componentMeta';

// Only top-level catalog types can be added without a parent — matches the
// existing Component Gallery picker. Cards / pieces / tokens need a parent
// container, so the user authors those inside a deck or board from the
// Component Editor; they surface in the rulebook automatically as a
// consequence of being in `project.instances`.
const ALLOWED_PICKER_TYPES = new Set(['board', 'deck', 'tile']);

export const COMPONENT_PICKER_OPTIONS: ComponentManifest[] = listAuthorableBuiltInComponents('top-level')
  .filter((manifest) => ALLOWED_PICKER_TYPES.has(manifest.type));

const pickerOptionStyle: CSSProperties = {
  display: 'grid',
  gap: '0.16rem',
  textAlign: 'left',
  padding: '0.55rem 0.7rem',
  borderRadius: '10px',
  border: 'none',
  background: 'transparent',
  color: '#064e3b',
  cursor: 'pointer',
};

export interface ComponentPickerProps {
  onSelect: (type: BuiltInComponentType) => void;
  onChooseCustom: () => void;
  onClose: () => void;
}

export function ComponentPicker({ onSelect, onChooseCustom, onClose }: ComponentPickerProps) {
  return (
    <>
      <div
        data-layout="componentsChapterPickerScrim"
        /* invisible scrim so clicking anywhere outside closes the picker
           without sucking focus into a portal */
        style={{ position: 'fixed', inset: 0, zIndex: 39 }}
        onClick={onClose}
      />
      <div
        data-layout="componentsChapterPickerMenu"
        /* opens upward from the "Add component" button — the list is
           short enough that this never overflows the page */
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 0.35rem)',
          left: 0,
          right: 0,
          zIndex: 40,
          borderRadius: '14px',
          border: '1px solid rgba(120, 95, 50, 0.28)',
          background: 'rgba(255, 253, 246, 0.98)',
          boxShadow: '0 12px 32px rgba(60, 40, 20, 0.22)',
          padding: '0.4rem',
          display: 'grid',
          gap: '0.18rem',
          maxHeight: '320px',
          overflowY: 'auto',
        }}
      >
        {COMPONENT_PICKER_OPTIONS.map((manifest) => (
          <button
            key={manifest.type}
            type="button"
            onClick={() => onSelect(manifest.type as BuiltInComponentType)}
            style={pickerOptionStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(236, 253, 245, 0.85)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '7px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(236, 253, 245, 0.95)',
                  border: '1px solid rgba(15, 118, 110, 0.1)',
                  flex: '0 0 auto',
                }}
              >
                {renderComponentIcon(manifest.type, { size: 13, style: { color: '#0f766e' } })}
              </span>
              {manifest.displayName}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>{manifest.description}</span>
          </button>
        ))}

        <div
          data-layout="componentsChapterPickerDivider"
          aria-hidden
          style={{ height: '1px', margin: '0.18rem 0.4rem', background: 'rgba(120, 95, 50, 0.18)' }}
        />

        <button
          type="button"
          onClick={onChooseCustom}
          style={{ ...pickerOptionStyle, background: 'rgba(255, 247, 235, 0.7)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 240, 218, 0.95)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 247, 235, 0.7)'; }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem', color: '#9a3412' }}>
            <span
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '7px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255, 237, 213, 0.95)',
                border: '1px solid rgba(180, 83, 9, 0.25)',
                flex: '0 0 auto',
                color: '#9a3412',
              }}
            >
              <AlertTriangle size={13} />
            </span>
            Custom component…
          </span>
          <span style={{ fontSize: '0.74rem', color: '#9a3412', fontStyle: 'italic' }}>
            Not orderable through our supplier — for rulebook only.
          </span>
        </button>
      </div>
    </>
  );
}
