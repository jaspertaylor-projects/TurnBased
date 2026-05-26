import { useEffect, useState } from 'react';
import { Check, Clock, Copy, Loader2, Sparkles } from 'lucide-react';

import type { AIRulesContextWeights, AIRulesMode } from '../../aiRulesService';
import { loadRecentPrompts, removeRecentPrompt } from '../../aiPromptHistory';
import type { RulesChapter } from '../../types';
import { AIAssistContextControls } from './AIAssistContextControls';
import { AIPromptHistoryPanel } from './AIPromptHistoryPanel';
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
  contextWeights: AIRulesContextWeights;
  /* Result list from a Brainstorm Generate. Populated by RulesSection.runAI
     when mode === 'brainstorm'; rendered as click-to-copy chips inside the
     AI panel. Cleared when the user switches modes or runs another non-
     brainstorm generation. */
  brainstormResults: string[];
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
  {
    key: 'brainstorm',
    label: 'Brainstorm',
    summary: 'Get 20 short ideas to pick from — great for names. Click a chip to copy it. Body text is not touched.',
    disabledHint: 'Brainstorm is always available.',
  },
];

export function AIAssistPanel({
  chapter,
  state,
  onUpdateAI,
  onCancelAI,
  onRunAI,
  onAppendTheme,
  onAppendArtStyle,
}: {
  chapter: RulesChapter;
  state: AIDraftState;
  onUpdateAI: (patch: Partial<AIDraftState>) => void;
  onCancelAI: () => void;
  onRunAI: (chapter: RulesChapter) => void;
  onAppendTheme: (value: string) => void;
  onAppendArtStyle: (value: string) => void;
}) {
  const bodyHasContent = chapter.body.trim().length > 0;
  // Recents are reloaded each time this panel mounts (i.e. each time the
  // user opens AI on a section). After a successful save in
  // RulesSection.runAI the panel closes anyway, so it'll re-mount fresh
  // next time and pick up the newly-saved prompt.
  const [recents, setRecents] = useState<string[]>(() => loadRecentPrompts());
  const [historyOpen, setHistoryOpen] = useState(false);
  // Track which brainstorm chip was just copied so we can flash a "Copied!"
  // affordance. Holds the entry text itself — the ideas list is short and
  // unique enough that string equality is fine here.
  const [copiedIdea, setCopiedIdea] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedIdea) return;
    const t = setTimeout(() => setCopiedIdea(null), 1100);
    return () => clearTimeout(t);
  }, [copiedIdea]);

  async function copyIdea(idea: string) {
    try {
      await navigator.clipboard.writeText(idea);
    } catch {
      // navigator.clipboard can fail in non-secure contexts; fall back to
      // a hidden textarea + document.execCommand so the user still gets
      // a copy on http://localhost setups without HTTPS.
      const el = document.createElement('textarea');
      el.value = idea;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* give up silently */ }
      document.body.removeChild(el);
    }
    setCopiedIdea(idea);
  }

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

  useEffect(() => {
    if (state.loading) return;
    const t = window.setTimeout(() => setRecents(loadRecentPrompts()), 0);
    return () => window.clearTimeout(t);
  }, [state.loading]);

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
        <AIPromptHistoryPanel prompts={recents} onUse={applyRecent} onDelete={deleteRecent} />
      ) : null}

      <div data-layout="aiModeRow" /* draft / expand / rewrite mode toggle */ style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {AI_MODE_OPTIONS.map((option) => {
          // brainstorm is always available — it doesn't read or write the
          // chapter body, so an empty section is fine.
          const disabled = (option.key === 'expand' || option.key === 'rewrite') && !bodyHasContent;
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

      <AIAssistContextControls
        selectedThemes={state.selectedThemes}
        selectedArtStyles={state.selectedArtStyles}
        availableThemes={state.availableThemes}
        availableArtStyles={state.availableArtStyles}
        contextWeights={state.contextWeights}
        loading={state.loading}
        onSelectedThemesChange={(next) => onUpdateAI({ selectedThemes: next })}
        onSelectedArtStylesChange={(next) => onUpdateAI({ selectedArtStyles: next })}
        onWeightsChange={(contextWeights) => onUpdateAI({ contextWeights })}
        onAppendTheme={onAppendTheme}
        onAppendArtStyle={onAppendArtStyle}
      />

      <textarea
        value={state.prompt}
        onChange={(event) => onUpdateAI({ prompt: event.target.value })}
        placeholder={
          state.mode === 'draft'
            ? 'Optional: tell the AI what this section should cover. Leave blank to draft from the rest of your rulebook.'
            : state.mode === 'expand'
              ? 'Optional: what would you like added? Examples, clarifications, an edge case…'
              : state.mode === 'rewrite'
                ? 'Optional: what should change in the rewrite? Tone, structure, brevity…'
                : 'What to brainstorm — e.g. "city names", "faction names", "starter items". Leave blank for general names that fit this section.'
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

      {state.mode === 'brainstorm' && state.brainstormResults.length > 0 ? (
        <div
          data-layout="aiBrainstormResults"
          /* Flowing chip grid of 20 candidate names. Each chip is a
             click-to-copy button; a transient "Copied!" replaces the icon
             for ~1s after a successful copy. Body text is untouched —
             brainstorm is purely a picker. */
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.35rem',
            padding: '0.55rem 0.6rem',
            borderRadius: '10px',
            background: 'rgba(255,253,246,0.7)',
            border: '1px solid rgba(13,148,136,0.35)',
          }}
        >
          <div data-layout="aiBrainstormResultsCaption" /* small caption above the chips */ style={{ width: '100%', color: 'rgba(80,55,25,0.78)', fontSize: '0.74rem', fontStyle: 'italic', fontFamily: SERIF_STACK, marginBottom: '0.15rem' }}>
            Click any candidate to copy it. Body text is left alone.
          </div>
          {state.brainstormResults.map((idea) => {
            const isCopied = copiedIdea === idea;
            return (
              <button
                key={idea}
                type="button"
                onClick={() => copyIdea(idea)}
                title={isCopied ? 'Copied!' : `Copy "${idea}"`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.28rem 0.6rem', borderRadius: '999px',
                  border: isCopied ? '1px solid rgba(13,148,136,0.85)' : '1px solid rgba(120,95,50,0.3)',
                  background: isCopied ? 'rgba(13,148,136,0.2)' : 'rgba(255,253,246,0.95)',
                  color: '#3b2412',
                  fontFamily: SERIF_STACK, fontWeight: 600, fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {isCopied ? <Check size={11} style={{ color: '#0d9488' }} /> : <Copy size={11} style={{ color: 'rgba(80,55,25,0.55)' }} />}
                {idea}
              </button>
            );
          })}
        </div>
      ) : null}

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
          {state.loading
            ? (state.mode === 'brainstorm' ? 'Brainstorming…' : 'Writing…')
            : (state.mode === 'brainstorm' ? 'Brainstorm' : 'Generate')}
        </button>
      </div>
    </div>
  );
}
