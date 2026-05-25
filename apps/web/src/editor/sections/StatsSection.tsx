import { NumericInput } from '../../components/NumericInput';
import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject, EditorRuleConfig } from '../types';

function clampPlayerCount(value: number): number {
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.trunc(value);
}

export function StatsSection({
  project,
  onUpdateBrief,
  onUpdateRules,
}: {
  project: EditorProject;
  onUpdateBrief: (updater: (brief: EditorProject['brief']) => EditorProject['brief']) => void;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
}) {
  const phasesValue = project.rules.phases.join(', ');

  return (
    <div data-layout="statsSectionRoot" /* centered column with the typed game-config panel */ style={{ display: 'grid', gap: '1rem', overflow: 'auto', alignContent: 'start' }}>
      <div data-layout="statsSectionColumn" /* fixed-width column wrapper */ style={{ display: 'grid', maxWidth: '780px', margin: '0 auto', width: '100%', gap: '1rem' }}>
        <div data-layout="statsIntroPanel" /* hero panel introducing the surface */ style={{ ...panelStyle, display: 'grid', gap: '0.5rem' }}>
          <p style={sectionTitleStyle}>Stats</p>
          <h2 style={{ margin: 0, color: '#064e3b' }}>{project.brief.name || 'Untitled game'}</h2>
          <p style={mutedTextStyle}>
            Hard numbers that downstream tools and AI prompts read from. Edit these any time;
            changes flow into preview, AI grounding, and the game definition immediately.
          </p>
        </div>

        <div data-layout="statsPlayersPanel" /* player range editor */ style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
          <p style={sectionTitleStyle}>Players</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={labelStyle}>
              Min players
              <NumericInput
                min={1}
                max={6}
                value={project.brief.minPlayers}
                onValueChange={(value) => onUpdateBrief((brief) => {
                  const next = clampPlayerCount(value);
                  return {
                    ...brief,
                    minPlayers: Math.min(next, brief.maxPlayers),
                    maxPlayers: Math.max(next, brief.maxPlayers),
                  };
                })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Max players
              <NumericInput
                min={1}
                max={6}
                value={project.brief.maxPlayers}
                onValueChange={(value) => onUpdateBrief((brief) => {
                  const next = clampPlayerCount(value);
                  return {
                    ...brief,
                    minPlayers: Math.min(brief.minPlayers, next),
                    maxPlayers: Math.max(brief.minPlayers, next),
                  };
                })}
                style={inputStyle}
              />
            </label>
          </div>
          <p style={{ ...mutedTextStyle, fontSize: '0.82rem' }}>
            Range goes from 1 (solo) to 6. Used by the AI when grounding section prose and by the
            preview runtime when seating players.
          </p>
        </div>

        <div data-layout="statsStructurePanel" /* target score + max turns + phases */ style={{ ...panelStyle, display: 'grid', gap: '0.85rem' }}>
          <p style={sectionTitleStyle}>Game structure</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={labelStyle}>
              Target score
              <NumericInput
                min={1}
                max={999}
                value={project.rules.targetScore}
                onValueChange={(value) => onUpdateRules((rules) => ({
                  ...rules,
                  targetScore: clampPositiveInt(value, rules.targetScore),
                }))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Max turns
              <NumericInput
                min={1}
                max={999}
                value={project.rules.maxTurns}
                onValueChange={(value) => onUpdateRules((rules) => ({
                  ...rules,
                  maxTurns: clampPositiveInt(value, rules.maxTurns),
                }))}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            Phases (comma-separated)
            <input
              value={phasesValue}
              onChange={(event) => {
                const next = event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                onUpdateRules((rules) => ({ ...rules, phases: next.length > 0 ? next : ['main'] }));
              }}
              placeholder="setup, main, scoring"
              style={inputStyle}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
