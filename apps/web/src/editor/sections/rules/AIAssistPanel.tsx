import { useEffect, useState } from 'react';
import { Clock, Loader2, Sparkles, X } from 'lucide-react';

import type { AIRulesMode } from '../../aiRulesService';
import { loadRecentPrompts, removeRecentPrompt } from '../../aiPromptHistory';
import type { RulesChapter } from '../../types';
import { SERIF_STACK } from './rulebookStyles';

export interface AIDraftState {
  chapterId: string;
  prompt: string;
  mode: AIRulesMode;
  loading: boolean;
  error: string | null;
  /* The themes and art styles from the project brief that should be sent
     as grounding for this Generate. Initialized from brief.theme /
     brief.artStyle (all on by default) when the panel opens; the user can
     toggle individual chips off to focus a generation on a subset. */
  selectedThemes: string[];
  selectedArtStyles: string[];
  /* The full lists from the project — kept on the draft so AIAssistPanel
     can render every chip (selected or not) without re-deriving from the
     project each render. */
  availableThemes: string[];
  availableArtStyles: string[];
}

interface AIModeOption {
  key: AIRulesMode;
  label: string;
  /* Caption shown beneath the mode row and as the tooltip when enabled. */
  summary: string;
  disabledHint: string;
}

const AI_MODE_OPTIONS: AIModeOption[] = [
  {
    key: 'draft',
    label: 'Fresh draft',
    summary: 'Start over. The AI ignores whatever is already in this section and writes a clean first draft from the rulebook context.',
    disabledHint: 'Fresh draft replaces existing text',
  },
  {
    key: 'expand',
    label: 'Expand',
    summary: 'Keep every word that is already here, then add detail, examples, edge cases, or clarifications.',
    disabledHint: 'Nothing to expand yet — write or draft a section first.',
  },
  {
    key: 'rewrite',
    label: 'Rewrite',
    summary: 'Re-state the same rules with cleaner prose. Existing rules are preserved; only the wording changes.',
    disabledHint: 'Nothing to rewrite yet — write or draft a section first.',
  },
];

function ContextChipRow({
  label,
  available,
  selected,
  onChange,
  loading,
}: {
  label: string;
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  loading: boolean;
}) {
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
  return (
    <div data-layout="aiContextChipRow" data-context-label={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span style={{ color: '#3b2412', fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.76rem', flexShrink: 0 }}>
        {label}:
      </span>
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
    </div>
  );
}

export function AIAssistPanel({
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
  // Recents are reloaded each time this panel mounts (i.e. each time the
  // user opens AI on a section). After a successful save in
  // RulesSection.runAI the panel closes anyway, so it'll re-mount fresh
  // next time and pick up the newly-saved prompt.
  const [recents, setRecents] = useState<string[]>(() => loadRecentPrompts());
  const [historyOpen, setHistoryOpen] = useState(false);

  // If localStorage changes from another tab, mirror it. Rare in practice
  // but cheap to support.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === 'turnbased.rules.aiPromptHistory') {
        setRecents(loadRecentPrompts());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function applyRecent(prompt: string) {
    onUpdateAI({ prompt });
    setHistoryOpen(false);
  }

  function deleteRecent(prompt: string) {
    setRecents(removeRecentPrompt(prompt));
  }

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
        <div style={{ flex: 1 }} />
        {recents.length > 0 ? (
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-expanded={historyOpen}
            aria-label={historyOpen ? 'Hide recent prompts' : 'Show recent prompts'}
            title="Recent prompts"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.55rem', borderRadius: '999px',
              border: '1px solid rgba(120,95,50,0.3)',
              background: historyOpen ? 'rgba(13,148,136,0.15)' : 'rgba(255,253,246,0.9)',
              color: '#3b2412',
              fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.74rem',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Clock size={12} />
            Recent ({recents.length})
          </button>
        ) : null}
      </div>

      {historyOpen && recents.length > 0 ? (
        <div
          data-layout="aiRecentPromptsList"
          /* Scrollable list of the user's last 10 prompts. Click an item to
             load it into the textarea; × removes it from history. */
          style={{
            border: '1px solid rgba(120,95,50,0.2)',
            borderRadius: '10px',
            background: 'rgba(255,253,246,0.95)',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '0.25rem',
            display: 'grid',
            gap: '0.2rem',
          }}
        >
          {recents.map((entry) => (
            <div
              key={entry}
              data-layout="aiRecentPromptRow"
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', borderRadius: '6px' }}
            >
              <button
                type="button"
                onClick={() => applyRecent(entry)}
                title="Load this prompt into the textarea"
                style={{
                  flex: '1 1 auto', minWidth: 0,
                  textAlign: 'left',
                  padding: '0.4rem 0.55rem',
                  border: 'none',
                  background: 'transparent',
                  color: '#3b2412',
                  fontFamily: SERIF_STACK, fontSize: '0.82rem', lineHeight: 1.35,
                  cursor: 'pointer',
                  borderRadius: '6px',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
                onMouseEnter={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'rgba(13,148,136,0.10)'; }}
                onMouseLeave={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {entry.length > 220 ? `${entry.slice(0, 220)}…` : entry}
              </button>
              <button
                type="button"
                onClick={() => deleteRecent(entry)}
                aria-label="Remove from history"
                title="Remove from history"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', flexShrink: 0,
                  borderRadius: '999px',
                  border: 'none', background: 'transparent',
                  color: 'rgba(120,60,30,0.55)', cursor: 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div data-layout="aiModeRow" /* draft / expand / rewrite mode toggle */ style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {AI_MODE_OPTIONS.map((option) => {
          const disabled = (option.key !== 'draft' && !bodyHasContent);
          const selected = state.mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => !disabled && onUpdateAI({ mode: option.key })}
              disabled={disabled || state.loading}
              title={disabled ? option.disabledHint : option.summary}
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

      <div data-layout="aiModeExplainer" /* one-line caption explaining the selected mode */ style={{ color: 'rgba(80,55,25,0.78)', fontSize: '0.78rem', lineHeight: 1.45, fontFamily: SERIF_STACK }}>
        {(() => {
          const active = AI_MODE_OPTIONS.find((option) => option.key === state.mode) ?? AI_MODE_OPTIONS[0];
          return (
            <>
              <strong style={{ color: '#3b2412' }}>{active.label}:</strong>{' '}
              <span style={{ fontStyle: 'italic' }}>{active.summary}</span>
            </>
          );
        })()}
      </div>

      {(state.availableThemes.length > 0 || state.availableArtStyles.length > 0) ? (
        <div data-layout="aiContextChipRows" /* selectable themes + art-styles for this Generate */ style={{ display: 'grid', gap: '0.4rem', padding: '0.5rem 0.6rem', borderRadius: '10px', background: 'rgba(255,253,246,0.55)', border: '1px solid rgba(120,95,50,0.18)' }}>
          {state.availableThemes.length > 0 ? (
            <ContextChipRow
              label="Themes"
              available={state.availableThemes}
              selected={state.selectedThemes}
              onChange={(next) => onUpdateAI({ selectedThemes: next })}
              loading={state.loading}
            />
          ) : null}
          {state.availableArtStyles.length > 0 ? (
            <ContextChipRow
              label="Art styles"
              available={state.availableArtStyles}
              selected={state.selectedArtStyles}
              onChange={(next) => onUpdateAI({ selectedArtStyles: next })}
              loading={state.loading}
            />
          ) : null}
        </div>
      ) : null}

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
        spellCheck={false}
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

      <div data-layout="aiPlaceholderHint" /* convention hint */ style={{ color: 'rgba(15,118,110,0.85)', fontSize: '0.74rem', fontStyle: 'italic', lineHeight: 1.4 }}>
        Tip: write angle-bracket placeholders directly into the section &mdash;
        e.g. <code style={{ background: 'rgba(13,148,136,0.1)', padding: '0 0.25rem', borderRadius: '4px', fontStyle: 'normal', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{'<city-name>'}</code>,{' '}
        <code style={{ background: 'rgba(13,148,136,0.1)', padding: '0 0.25rem', borderRadius: '4px', fontStyle: 'normal', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{'<faction>'}</code>,{' '}
        <code style={{ background: 'rgba(13,148,136,0.1)', padding: '0 0.25rem', borderRadius: '4px', fontStyle: 'normal', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{'<sacred-item>'}</code> &mdash;
        and the AI will fill each one with something fitting the theme.
      </div>

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
