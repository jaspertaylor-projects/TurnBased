import { NumericInput } from '../../components/NumericInput';
import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle, textareaStyle } from '../styles';
import type { EditorProject, EditorRuleConfig } from '../types';

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.trunc(value);
}

export function RulesSection({
  project,
  onUpdateRules,
}: {
  project: EditorProject;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
}) {
  const rules = project.rules;
  const phasesValue = rules.phases.join(', ');

  return (
    <div data-layout="rulesSectionRoot" /* root scroll container for the rules editor */ style={{ display: 'grid', gap: '1rem', overflow: 'auto', alignContent: 'start' }}>
      <div data-layout="rulesSectionColumn" /* centered column wrapper */ style={{ display: 'grid', maxWidth: '780px', margin: '0 auto', width: '100%', gap: '1rem' }}>
        <div data-layout="rulesIntroPanel" /* hero panel introducing the rules surface */ style={{ ...panelStyle, display: 'grid', gap: '0.6rem' }}>
          <p style={sectionTitleStyle}>Rules</p>
          <h2 style={{ margin: 0, color: '#064e3b' }}>{project.brief.name || 'Untitled game'}</h2>
          <p style={mutedTextStyle}>
            Write the rules of your game here. This is the source of truth the AI assistant
            and other editor surfaces read from when shaping components, layout, and prototype
            orders.
          </p>
        </div>

        <div data-layout="rulesTextPanel" /* primary rules-text editor */ style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
          <p style={sectionTitleStyle}>Rules text</p>
          <label style={labelStyle}>
            How is the game played?
            <textarea
              value={rules.rulesText}
              onChange={(event) => onUpdateRules((current) => ({ ...current, rulesText: event.target.value }))}
              placeholder="Describe setup, turn structure, scoring, and end conditions in plain language..."
              style={{ ...textareaStyle, minHeight: '260px' }}
            />
          </label>
        </div>

        <div data-layout="rulesDesignerNotesPanel" /* internal designer notes */ style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
          <p style={sectionTitleStyle}>Designer notes</p>
          <label style={labelStyle}>
            Private notes for yourself and collaborators
            <textarea
              value={rules.designerNotes}
              onChange={(event) => onUpdateRules((current) => ({ ...current, designerNotes: event.target.value }))}
              placeholder="Open questions, balancing ideas, things to playtest..."
              style={{ ...textareaStyle, minHeight: '140px' }}
            />
          </label>
        </div>

        <div data-layout="rulesStructurePanel" /* structural rule controls (phases, scoring, length) */ style={{ ...panelStyle, display: 'grid', gap: '0.9rem' }}>
          <p style={sectionTitleStyle}>Structure</p>

          <label style={labelStyle}>
            Phases (comma-separated)
            <input
              value={phasesValue}
              onChange={(event) => {
                const next = event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                onUpdateRules((current) => ({ ...current, phases: next.length > 0 ? next : ['main'] }));
              }}
              placeholder="setup, main, scoring"
              style={inputStyle}
            />
          </label>

          <div data-layout="rulesScoringRow" /* score + max-turns grid */ style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={labelStyle}>
              Target score
              <NumericInput
                min={1}
                max={999}
                value={rules.targetScore}
                onValueChange={(value) => onUpdateRules((current) => ({ ...current, targetScore: clampPositiveInt(value, current.targetScore) }))}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Max turns
              <NumericInput
                min={1}
                max={999}
                value={rules.maxTurns}
                onValueChange={(value) => onUpdateRules((current) => ({ ...current, maxTurns: clampPositiveInt(value, current.maxTurns) }))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
