import { useEffect, useState } from 'react';
import { AI_PANEL_WIDTH, useFloatingAIPanel } from './useFloatingAIPanel';
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  GripVertical,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import type { AIDraftState } from '../../aiAssistTypes';
export type { AIDraftState } from '../../aiAssistTypes';
import { RULES_WRITER_MODEL_OPTIONS, rulesWriterSupportsTemperature } from '../../aiModelCatalog';
import { loadRecentPrompts, removeRecentPrompt } from '../../aiPromptHistory';
import type { RulesChapter } from '../../types';
import { AIModeControls } from './AIModeControls';
import { AIAssistContextControls } from './AIAssistContextControls';
import { AIPromptHistoryPanel } from './AIPromptHistoryPanel';
import { SERIF_STACK } from './rulebookStyles';

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
  // The themes / art-style chips and the four tuning sliders are tucked
  // behind this toggle so the default panel is just "pick a mode, type a
  // prompt, Generate". Power users open it to tune context weights.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { cardRef, pos, dragging, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp } =
    useFloatingAIPanel();

  useEffect(() => {
    if (!copiedIdea) return;
    const t = setTimeout(() => setCopiedIdea(null), 1100);
    return () => clearTimeout(t);
  }, [copiedIdea]);

  async function copyIdea(idea: string) {
    let copied = true;
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
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      document.body.removeChild(el);
    }
    if (copied) setCopiedIdea(idea);
    else onUpdateAI({ error: 'Copy failed. Select the idea text and copy it manually.' });
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
      ref={cardRef}
      data-layout="aiAssistPanelModal"
      /* Floating, draggable AI prompt card. Fixed-position so it escapes the
         rulebook page's `overflow: hidden` and can be parked anywhere over
         the spread. Cream parchment + teal accent marks it as the "AI editor"
         mode. Header drags; body scrolls; footer pins Generate/Cancel. */
      role="dialog"
      aria-label={`AI assist — ${chapter.title || 'Untitled section'}`}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `min(${AI_PANEL_WIDTH}px, calc(100vw - 24px))`,
        maxHeight: 'min(calc(100dvh - 32px), 680px)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        background: 'linear-gradient(160deg, #fffdf6 0%, #f7eed8 100%)',
        border: '1px solid rgba(13,148,136,0.5)',
        boxShadow: '0 22px 56px rgba(60,40,20,0.34)',
      }}
    >
      <div
        data-layout="aiAssistPanelHeader"
        /* drag handle — grab anywhere except the Recent / close buttons */
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.6rem 0.7rem 0.55rem 0.7rem',
          borderBottom: '1px solid rgba(120,95,50,0.18)',
          borderRadius: '14px 14px 0 0',
          background: 'rgba(13,148,136,0.06)',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <GripVertical size={14} style={{ color: 'rgba(120,95,50,0.5)', flexShrink: 0 }} />
        <Sparkles size={14} style={{ color: '#0d9488', flexShrink: 0 }} />
        <span
          style={{
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            color: '#3b2412',
            fontSize: '0.92rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          AI assist — {chapter.title || 'Untitled section'}
        </span>
        <div data-layout="aiAssistHeaderSpacer" style={{ flex: 1 }} />
        {recents.length > 0 ? (
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-expanded={historyOpen}
            aria-label={historyOpen ? 'Hide recent prompts' : 'Show recent prompts'}
            title="Recent prompts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.55rem',
              borderRadius: '999px',
              border: '1px solid rgba(120,95,50,0.3)',
              background: historyOpen ? 'rgba(13,148,136,0.15)' : 'rgba(255,253,246,0.9)',
              color: '#3b2412',
              fontFamily: SERIF_STACK,
              fontWeight: 700,
              fontSize: '0.74rem',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Clock size={12} />
            Recent ({recents.length})
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancelAI}
          disabled={state.loading}
          aria-label="Close AI assist"
          title="Close"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '999px',
            flexShrink: 0,
            border: 'none',
            background: 'rgba(120,95,50,0.1)',
            color: 'rgba(80,55,25,0.7)',
            cursor: state.loading ? 'wait' : 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div
        data-layout="aiAssistPanelBody"
        /* scrollable content region — keeps the header drag-handle and the
           footer actions pinned while a long advanced section / brainstorm
           grid scrolls within the card. */
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          display: 'grid',
          gap: '0.55rem',
          padding: '0.7rem 0.8rem',
        }}
      >
        {historyOpen && recents.length > 0 ? (
          <AIPromptHistoryPanel prompts={recents} onUse={applyRecent} onDelete={deleteRecent} />
        ) : null}

        <label
          data-layout="aiModelRow"
          /* OpenRouter model picker for this generation */ style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              color: '#3b2412',
              fontFamily: SERIF_STACK,
              fontWeight: 700,
              fontSize: '0.78rem',
              flexShrink: 0,
            }}
          >
            Model
          </span>
          <select
            value={state.modelId}
            onChange={(event) => onUpdateAI({ modelId: event.target.value })}
            disabled={state.loading}
            title={RULES_WRITER_MODEL_OPTIONS.find((option) => option.id === state.modelId)?.description}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.35rem 0.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(120,95,50,0.3)',
              background: 'rgba(255,255,255,0.9)',
              color: '#3b2412',
              fontFamily: SERIF_STACK,
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: state.loading ? 'wait' : 'pointer',
            }}
          >
            {RULES_WRITER_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <AIModeControls
          mode={state.mode}
          loading={state.loading}
          bodyHasContent={bodyHasContent}
          onChange={(mode) => onUpdateAI({ mode })}
        />

        <textarea
          aria-label="AI writing prompt"
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
            width: '100%',
            boxSizing: 'border-box',
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

        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
          data-layout="aiAdvancedToggle"
          /* collapses the themes/art-style chips + tuning sliders so the
           default panel stays uncluttered */
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            alignSelf: 'flex-start',
            padding: '0.3rem 0.55rem',
            borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.25)',
            background: advancedOpen ? 'rgba(13,148,136,0.12)' : 'rgba(255,253,246,0.9)',
            color: '#3b2412',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.74rem',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={12} style={{ color: '#0d9488' }} />
          Context &amp; tuning
          <ChevronDown
            size={12}
            style={{
              transform: advancedOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>

        {advancedOpen ? (
          <div
            data-layout="aiAdvancedSection"
            /* revealed context chips, weight sliders, and placeholder tip */ style={{
              display: 'grid',
              gap: '0.55rem',
            }}
          >
            <AIAssistContextControls
              selectedThemes={state.selectedThemes}
              selectedArtStyles={state.selectedArtStyles}
              availableThemes={state.availableThemes}
              availableArtStyles={state.availableArtStyles}
              contextWeights={state.contextWeights}
              temperature={state.temperature}
              temperatureSupported={rulesWriterSupportsTemperature(state.modelId)}
              loading={state.loading}
              onSelectedThemesChange={(next) => onUpdateAI({ selectedThemes: next })}
              onSelectedArtStylesChange={(next) => onUpdateAI({ selectedArtStyles: next })}
              onWeightsChange={(contextWeights) => onUpdateAI({ contextWeights })}
              onTemperatureChange={(temperature) => onUpdateAI({ temperature })}
              onAppendTheme={onAppendTheme}
              onAppendArtStyle={onAppendArtStyle}
            />

            <div
              data-layout="aiPlaceholderHint"
              /* convention hint */ style={{
                color: 'rgba(15,118,110,0.85)',
                fontSize: '0.74rem',
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}
            >
              Tip: write angle-bracket placeholders directly into the section &mdash; e.g.{' '}
              <code
                style={{
                  background: 'rgba(13,148,136,0.1)',
                  padding: '0 0.25rem',
                  borderRadius: '4px',
                  fontStyle: 'normal',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {'<city-name>'}
              </code>
              ,{' '}
              <code
                style={{
                  background: 'rgba(13,148,136,0.1)',
                  padding: '0 0.25rem',
                  borderRadius: '4px',
                  fontStyle: 'normal',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {'<faction>'}
              </code>
              ,{' '}
              <code
                style={{
                  background: 'rgba(13,148,136,0.1)',
                  padding: '0 0.25rem',
                  borderRadius: '4px',
                  fontStyle: 'normal',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {'<sacred-item>'}
              </code>{' '}
              &mdash; and the AI will fill each one with something fitting the theme.
            </div>
          </div>
        ) : null}

        {state.mode === 'brainstorm' && state.brainstormResults.length > 0 ? (
          <div
            data-layout="aiBrainstormResults"
            /* Flowing chip grid of 20 candidate names. Each chip is a
             click-to-copy button; a transient "Copied!" replaces the icon
             for ~1s after a successful copy. Body text is untouched —
             brainstorm is purely a picker. */
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              padding: '0.55rem 0.6rem',
              borderRadius: '10px',
              background: 'rgba(255,253,246,0.7)',
              border: '1px solid rgba(13,148,136,0.35)',
            }}
          >
            <div
              data-layout="aiBrainstormResultsCaption"
              /* small caption above the chips */ style={{
                width: '100%',
                color: 'rgba(80,55,25,0.78)',
                fontSize: '0.74rem',
                fontStyle: 'italic',
                fontFamily: SERIF_STACK,
                marginBottom: '0.15rem',
              }}
            >
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.28rem 0.6rem',
                    borderRadius: '999px',
                    border: isCopied ? '1px solid rgba(13,148,136,0.85)' : '1px solid rgba(120,95,50,0.3)',
                    background: isCopied ? 'rgba(13,148,136,0.2)' : 'rgba(255,253,246,0.95)',
                    color: '#3b2412',
                    fontFamily: SERIF_STACK,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {isCopied ? (
                    <Check size={11} style={{ color: '#0d9488' }} />
                  ) : (
                    <Copy size={11} style={{ color: 'rgba(80,55,25,0.55)' }} />
                  )}
                  {idea}
                </button>
              );
            })}
          </div>
        ) : null}

        {state.error ? (
          <div
            data-layout="aiAssistError"
            role="alert"
            style={{
              padding: '0.4rem 0.55rem',
              borderRadius: '8px',
              background: 'rgba(254,226,226,0.85)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#991b1b',
              fontSize: '0.8rem',
            }}
          >
            {state.error}
          </div>
        ) : null}
      </div>

      <div
        data-layout="aiAssistPanelFooter"
        /* pinned action row — stays put while the body scrolls */
        style={{
          flex: '0 0 auto',
          display: 'flex',
          gap: '0.4rem',
          justifyContent: 'flex-end',
          padding: '0.6rem 0.8rem',
          borderTop: '1px solid rgba(120,95,50,0.18)',
          borderRadius: '0 0 14px 14px',
          background: 'rgba(255,251,238,0.7)',
        }}
      >
        <button
          type="button"
          onClick={onCancelAI}
          disabled={state.loading}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '999px',
            border: '1px solid rgba(120,95,50,0.3)',
            background: 'rgba(255,253,246,0.95)',
            color: '#3b2412',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.82rem',
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.95rem',
            borderRadius: '999px',
            border: 'none',
            background: state.loading ? 'rgba(13,148,136,0.45)' : 'linear-gradient(135deg, #064e3b, #0d9488)',
            color: 'white',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: state.loading ? 'wait' : 'pointer',
          }}
        >
          {state.loading ? (
            <Loader2 size={14} style={{ animation: 'spin 1.1s linear infinite' }} />
          ) : (
            <Sparkles size={14} />
          )}
          {state.loading
            ? state.mode === 'brainstorm'
              ? 'Brainstorming…'
              : 'Writing…'
            : state.mode === 'brainstorm'
              ? 'Brainstorm'
              : 'Generate'}
        </button>
      </div>
    </div>
  );
}
