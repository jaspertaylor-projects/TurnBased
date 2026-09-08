import type { AIRulesMode } from '../../aiRulesService';
import { SERIF_STACK } from './rulebookStyles';

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
    summary:
      'Start over. The AI ignores whatever is already in this section and writes a clean first draft from the rulebook context.',
    disabledHint: 'Fresh draft replaces existing text',
  },
  {
    key: 'expand',
    label: 'Expand',
    summary:
      'Build on this section with detail, examples, edge cases, or clarifications. Review the result before keeping it.',
    disabledHint: 'Nothing to expand yet — write or draft a section first.',
  },
  {
    key: 'rewrite',
    label: 'Rewrite',
    summary:
      'Ask for clearer wording and structure while keeping the intended rules. Review the result for unintended changes.',
    disabledHint: 'Nothing to rewrite yet — write or draft a section first.',
  },
  {
    key: 'brainstorm',
    label: 'Brainstorm',
    summary:
      'Get 20 short ideas to pick from — great for names. Click a chip to copy it. Body text is not touched.',
    disabledHint: 'Brainstorm is always available.',
  },
];

export function AIModeControls({
  mode,
  loading,
  bodyHasContent,
  onChange,
}: {
  mode: AIRulesMode;
  loading: boolean;
  bodyHasContent: boolean;
  onChange: (mode: AIRulesMode) => void;
}) {
  return (
    <>
      <div
        data-layout="aiModeRow"
        /* draft / expand / rewrite mode toggle */ style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        {AI_MODE_OPTIONS.map((option) => {
          // brainstorm is always available — it doesn't read or write the
          // chapter body, so an empty section is fine.
          const disabled = (option.key === 'expand' || option.key === 'rewrite') && !bodyHasContent;
          const selected = mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => !disabled && onChange(option.key)}
              disabled={disabled || loading}
              aria-pressed={selected}
              title={disabled ? option.disabledHint : option.summary}
              style={{
                padding: '0.32rem 0.7rem',
                borderRadius: '999px',
                border: selected ? '1px solid rgba(13,148,136,0.8)' : '1px solid rgba(120,95,50,0.3)',
                background: selected ? 'rgba(13,148,136,0.18)' : 'rgba(255,253,246,0.9)',
                color: disabled ? 'rgba(120,95,50,0.4)' : '#3b2412',
                fontFamily: SERIF_STACK,
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        data-layout="aiModeExplainer"
        /* one-line caption explaining the selected mode */ style={{
          color: 'rgba(80,55,25,0.78)',
          fontSize: '0.78rem',
          lineHeight: 1.45,
          fontFamily: SERIF_STACK,
        }}
      >
        {(() => {
          const active = AI_MODE_OPTIONS.find((option) => option.key === mode) ?? AI_MODE_OPTIONS[0];
          return (
            <>
              <strong style={{ color: '#3b2412' }}>{active.label}:</strong>{' '}
              <span style={{ fontStyle: 'italic' }}>{active.summary}</span>
            </>
          );
        })()}
      </div>
    </>
  );
}
