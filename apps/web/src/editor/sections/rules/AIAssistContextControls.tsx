import { useState, type KeyboardEvent } from 'react';
import { Check, Plus } from 'lucide-react';

import type { AIRulesContextWeights } from '../../aiRulesService';
import { SERIF_STACK } from './rulebookStyles';

function ContextChipRow({
  label,
  available,
  selected,
  onChange,
  onAppend,
  addPlaceholder,
  loading,
}: {
  label: string;
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onAppend?: (entry: string) => void;
  addPlaceholder?: string;
  loading: boolean;
}) {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');

  function toggle(entry: string) {
    if (loading) return;
    const lower = entry.toLowerCase();
    const isOn = selected.some((s) => s.toLowerCase() === lower);
    onChange(isOn ? selected.filter((s) => s.toLowerCase() !== lower) : [...selected, entry]);
  }
  const allOn = available.length > 0 && available.every((entry) => selected.some((s) => s.toLowerCase() === entry.toLowerCase()));
  function toggleAll() {
    if (loading) return;
    onChange(allOn ? [] : [...available]);
  }

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDrafting(false);
      setDraft('');
      return;
    }
    onAppend?.(trimmed);
    setDraft('');
    setDrafting(false);
  }

  function handleDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDrafting(false);
      setDraft('');
    }
  }

  return (
    <div data-layout="aiContextChipRow" data-context-label={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span style={{ color: '#3b2412', fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.76rem', flexShrink: 0 }}>
        {label}:
      </span>
      {available.length > 0 ? (
        <button
          type="button"
          onClick={toggleAll}
          disabled={loading}
          title={allOn ? `Hide all ${label.toLowerCase()} from this generation` : `Send all ${label.toLowerCase()} to the AI`}
          style={{
            padding: '0.18rem 0.5rem', borderRadius: '999px',
            border: '1px dashed rgba(120,95,50,0.35)',
            background: 'transparent',
            color: 'rgba(80,55,25,0.7)',
            fontFamily: SERIF_STACK, fontWeight: 600, fontSize: '0.7rem',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {allOn ? 'None' : 'All'}
        </button>
      ) : null}
      {available.map((entry) => {
        const isOn = selected.some((s) => s.toLowerCase() === entry.toLowerCase());
        return (
          <button
            key={entry}
            type="button"
            onClick={() => toggle(entry)}
            disabled={loading}
            aria-pressed={isOn}
            style={{
              padding: '0.22rem 0.6rem', borderRadius: '999px',
              border: isOn ? '1px solid rgba(13,148,136,0.7)' : '1px solid rgba(120,95,50,0.3)',
              background: isOn ? 'rgba(13,148,136,0.16)' : 'rgba(255,253,246,0.85)',
              color: isOn ? '#064e3b' : 'rgba(80,55,25,0.55)',
              fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.74rem',
              cursor: loading ? 'wait' : 'pointer',
              textDecoration: isOn ? 'none' : 'line-through',
              textDecorationColor: 'rgba(120,95,50,0.4)',
            }}
          >
            {entry}
          </button>
        );
      })}

      {onAppend ? (
        drafting ? (
          <div data-layout="aiContextChipDraft" /* inline input for a new chip */ style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKey}
              onBlur={() => {
                if (!draft.trim()) {
                  setDrafting(false);
                  setDraft('');
                }
              }}
              placeholder={addPlaceholder ?? `Add ${label.toLowerCase()}...`}
              disabled={loading}
              spellCheck={false}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                border: '1px solid rgba(13,148,136,0.55)',
                background: 'rgba(255,253,246,0.95)',
                color: '#3b2412',
                fontFamily: SERIF_STACK,
                fontSize: '0.76rem',
                minWidth: '140px',
              }}
            />
            <button
              type="button"
              onClick={commitDraft}
              disabled={loading || !draft.trim()}
              aria-label={`Save new ${label.toLowerCase()}`}
              title="Add to project"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '999px',
                border: 'none',
                background: !draft.trim() ? 'rgba(13,148,136,0.35)' : 'linear-gradient(135deg, #064e3b, #0d9488)',
                color: 'white',
                cursor: !draft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDrafting(true)}
            disabled={loading}
            title={addPlaceholder ?? `Add a new ${label.toLowerCase()} to this project`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.18rem 0.55rem',
              borderRadius: '999px',
              border: '1px dashed rgba(13,148,136,0.55)',
              background: 'transparent',
              color: '#0d9488',
              fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.72rem',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <Plus size={11} />
            Add
          </button>
        )
      ) : null}
    </div>
  );
}

function ImportanceSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label data-layout="aiImportanceSlider" style={{ display: 'grid', gap: '0.18rem', minWidth: 0 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', color: '#3b2412', fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.74rem' }}>
        <span>{label}</span>
        <span style={{ color: '#0d9488' }}>{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: '#0d9488', cursor: disabled ? 'wait' : 'pointer' }}
      />
    </label>
  );
}

export function AIAssistContextControls({
  selectedThemes,
  selectedArtStyles,
  availableThemes,
  availableArtStyles,
  contextWeights,
  loading,
  onSelectedThemesChange,
  onSelectedArtStylesChange,
  onWeightsChange,
  onAppendTheme,
  onAppendArtStyle,
}: {
  selectedThemes: string[];
  selectedArtStyles: string[];
  availableThemes: string[];
  availableArtStyles: string[];
  contextWeights: AIRulesContextWeights;
  loading: boolean;
  onSelectedThemesChange: (next: string[]) => void;
  onSelectedArtStylesChange: (next: string[]) => void;
  onWeightsChange: (next: AIRulesContextWeights) => void;
  onAppendTheme: (value: string) => void;
  onAppendArtStyle: (value: string) => void;
}) {
  return (
    <div data-layout="aiContextControls" /* selectable chips plus relative source weights */ style={{ display: 'grid', gap: '0.5rem', padding: '0.5rem 0.6rem', borderRadius: '10px', background: 'rgba(255,253,246,0.55)', border: '1px solid rgba(120,95,50,0.18)' }}>
      <ContextChipRow
        label="Themes"
        available={availableThemes}
        selected={selectedThemes}
        onChange={onSelectedThemesChange}
        onAppend={onAppendTheme}
        addPlaceholder="New theme..."
        loading={loading}
      />
      <ContextChipRow
        label="Art styles"
        available={availableArtStyles}
        selected={selectedArtStyles}
        onChange={onSelectedArtStylesChange}
        onAppend={onAppendArtStyle}
        addPlaceholder="New art style..."
        loading={loading}
      />
      <div data-layout="aiImportanceSliders" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem', paddingTop: '0.15rem' }}>
        <ImportanceSlider
          label="Rulebook"
          value={contextWeights.rulebook}
          disabled={loading}
          onChange={(rulebook) => onWeightsChange({ ...contextWeights, rulebook })}
        />
        <ImportanceSlider
          label="Prompt"
          value={contextWeights.prompt}
          disabled={loading}
          onChange={(prompt) => onWeightsChange({ ...contextWeights, prompt })}
        />
        <ImportanceSlider
          label="Chips"
          value={contextWeights.chips}
          disabled={loading}
          onChange={(chips) => onWeightsChange({ ...contextWeights, chips })}
        />
      </div>
    </div>
  );
}
