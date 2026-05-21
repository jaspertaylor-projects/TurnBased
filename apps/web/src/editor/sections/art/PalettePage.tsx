import { useEffect, useState, type ChangeEvent } from 'react';
import { Palette, Check, RotateCcw } from 'lucide-react';

import { PROJECT_PALETTE_LABELS, PROJECT_PALETTE_ORDER } from '../../projectPalette';
import type { EditorProject, ProjectColorPalette, ProjectPaletteColorId } from '../../types';
import { SubPageShell } from './SubPageShell';

const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_PATTERN.test(withHash)) return null;
  return withHash.toLowerCase();
}

function clonePalette(palette: ProjectColorPalette): ProjectColorPalette {
  const next = {} as ProjectColorPalette;
  for (const id of PROJECT_PALETTE_ORDER) {
    next[id] = palette[id];
  }
  return next;
}

function palettesDiffer(a: ProjectColorPalette, b: ProjectColorPalette): boolean {
  return PROJECT_PALETTE_ORDER.some((id) => a[id] !== b[id]);
}

export function PalettePage({
  project,
  onBack,
  onSavePalette,
}: {
  project: EditorProject;
  onBack: () => void;
  onSavePalette: (palette: ProjectColorPalette) => void;
}) {
  const persisted = project.settings.colorPalette;
  const [draft, setDraft] = useState<ProjectColorPalette>(() => clonePalette(persisted));
  const [selectedId, setSelectedId] = useState<ProjectPaletteColorId | null>(null);
  const [hexInputs, setHexInputs] = useState<Partial<Record<ProjectPaletteColorId, string>>>({});

  // Reset draft when the project palette changes from outside this page
  // (e.g. an AI rebuild restores stored colors). Don't fight an external
  // mutation — sync to it.
  useEffect(() => {
    setDraft(clonePalette(persisted));
    setHexInputs({});
  }, [persisted]);

  const isDirty = palettesDiffer(draft, persisted);

  function updateSlot(id: ProjectPaletteColorId, value: string) {
    const normalized = normalizeHex(value);
    if (!normalized) return;
    setDraft((prev) => ({ ...prev, [id]: normalized }));
  }

  function onHexInput(id: ProjectPaletteColorId, event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setHexInputs((prev) => ({ ...prev, [id]: raw }));
    const normalized = normalizeHex(raw);
    if (normalized) {
      setDraft((prev) => ({ ...prev, [id]: normalized }));
    }
  }

  function commitHexInput(id: ProjectPaletteColorId) {
    setHexInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function save() {
    onSavePalette(clonePalette(draft));
    setSelectedId(null);
  }

  function revert() {
    setDraft(clonePalette(persisted));
    setHexInputs({});
    setSelectedId(null);
  }

  function toggleSelect(id: ProjectPaletteColorId) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  const footer = (
    <div
      data-layout="paletteFooter"
      /* persistent footer pinned to the viewport bottom by the SubPageShell.
         Holds the Save / Revert action pair plus a dirty-state status hint. */
      style={{
        padding: '0.85rem 1rem',
        borderRadius: '16px',
        border: '1px solid rgba(15,118,110,0.1)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(236,253,245,0.85) 100%)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 -6px 22px rgba(6,78,59,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          color: isDirty ? '#9a3412' : '#0f766e',
          fontSize: '0.8rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <span
          style={{
            width: '8px', height: '8px', borderRadius: '999px',
            background: isDirty ? '#f97316' : '#10b981',
          }}
        />
        {isDirty ? 'Unsaved palette changes' : 'Palette saved'}
      </span>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={revert}
        disabled={!isDirty}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.55rem 0.9rem', borderRadius: '999px',
          border: '1px solid rgba(15,118,110,0.25)',
          background: isDirty ? 'rgba(255,255,255,0.9)' : 'rgba(15,118,110,0.06)',
          color: isDirty ? '#0f766e' : 'rgba(15,118,110,0.45)',
          fontWeight: 700, fontSize: '0.82rem',
          cursor: isDirty ? 'pointer' : 'not-allowed',
        }}
      >
        <RotateCcw size={14} /> Revert
      </button>

      <button
        type="button"
        onClick={save}
        disabled={!isDirty}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.55rem 1rem', borderRadius: '999px', border: 'none',
          background: isDirty ? 'linear-gradient(135deg, #064e3b, #10b981)' : 'rgba(16,185,129,0.35)',
          color: 'white', fontWeight: 700, fontSize: '0.85rem',
          cursor: isDirty ? 'pointer' : 'not-allowed',
        }}
      >
        <Check size={14} /> Save
      </button>
    </div>
  );

  return (
    <SubPageShell title="Palette" icon={<Palette size={22} />} onBack={onBack} footer={footer}>
      <div data-layout="paletteHelperCopy" /* helper text introducing the swatch grid */ style={{ color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
        Click a swatch to change its color. Changes hold here until you Save.
      </div>

      <div
        data-layout="paletteSwatchGrid"
        /* 3-up grid of palette swatches; sits inside the SubPageShell's
           scrollable body so the shell's footer stays anchored even when
           the grid overflows. */
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.65rem', alignContent: 'start' }}
      >
        {PROJECT_PALETTE_ORDER.map((paletteId) => {
          const isSelected = selectedId === paletteId;
          const isDirtySlot = draft[paletteId] !== persisted[paletteId];
          const draftValue = draft[paletteId];
          const hexValue = hexInputs[paletteId] ?? draftValue;
          return (
            <div
              key={paletteId}
              data-layout="paletteSwatchCard"
              data-palette-id={paletteId}
              style={{
                borderRadius: '18px',
                border: isSelected ? '2px solid rgba(13,148,136,0.6)' : '1px solid rgba(15,118,110,0.1)',
                background: 'rgba(248,250,252,0.82)',
                padding: '0.6rem',
                display: 'grid',
                gap: '0.5rem',
                boxShadow: isSelected ? '0 8px 24px rgba(13,148,136,0.18)' : 'none',
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSelect(paletteId)}
                aria-pressed={isSelected}
                aria-label={`Edit ${PROJECT_PALETTE_LABELS[paletteId]} color`}
                style={{
                  display: 'block', width: '100%', aspectRatio: '1 / 1',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.8)',
                  background: draftValue,
                  cursor: 'pointer', padding: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(6,78,59,0.08)',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <span style={{ color: '#0f766e', fontSize: '0.74rem', fontWeight: 700 }}>
                  {PROJECT_PALETTE_LABELS[paletteId]}
                </span>
                {isDirtySlot ? (
                  <span title="Unsaved change" style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#f97316' }} />
                ) : null}
              </div>

              {isSelected ? (
                <div
                  data-layout="paletteSlotEditor"
                  /* inline editor for the currently selected swatch — native color
                     input + hex text input. No palette-management UI here; this
                     view IS the palette. */
                  style={{ display: 'grid', gap: '0.4rem', padding: '0.4rem', borderRadius: '12px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(15,118,110,0.1)' }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f766e', fontSize: '0.7rem', fontWeight: 700 }}>
                    Color
                    <input
                      type="color"
                      value={draftValue}
                      onChange={(event) => updateSlot(paletteId, event.target.value)}
                      style={{ flex: '1 1 auto', minWidth: 0, height: '28px', border: '1px solid rgba(15,118,110,0.16)', borderRadius: '8px', padding: 0, background: 'white', cursor: 'pointer' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f766e', fontSize: '0.7rem', fontWeight: 700 }}>
                    Hex
                    <input
                      type="text"
                      value={hexValue}
                      onChange={(event) => onHexInput(paletteId, event)}
                      onBlur={() => commitHexInput(paletteId)}
                      placeholder="#10b981"
                      spellCheck={false}
                      style={{ flex: '1 1 auto', minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid rgba(15,118,110,0.16)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#064e3b', background: 'white' }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SubPageShell>
  );
}
