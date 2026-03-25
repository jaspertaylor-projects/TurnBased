import { ProjectColorPicker } from '@turnbased/engine-ui';

import { listProjectPaletteOptions, PROJECT_PALETTE_LABELS, PROJECT_PALETTE_ORDER } from '../projectPalette';
import { inputStyle, labelStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

function clampPlayerCount(value: number): number {
  return Math.max(1, Math.min(6, value));
}

export function SettingsSection({
  project,
  onUpdateBrief,
  onUpdateSettings,
}: {
  project: EditorProject;
  onUpdateBrief: (updater: (brief: EditorProject['brief']) => EditorProject['brief']) => void;
  onUpdateSettings: (updater: (settings: EditorProject['settings']) => EditorProject['settings']) => void;
}) {
  const paletteOptions = listProjectPaletteOptions(project);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', maxWidth: '780px' }}>
        <div style={{ ...panelStyle, display: 'grid', gap: '0.9rem' }}>
          <p style={sectionTitleStyle}>Game Setup</p>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Game name
            <input
              value={project.brief.name}
              onChange={(event) => onUpdateBrief((brief) => ({
                ...brief,
                name: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={labelStyle}>
              Min players
              <input
                type="number"
                min={1}
                max={6}
                value={project.brief.minPlayers}
                onChange={(event) => onUpdateBrief((brief) => {
                  const nextMin = clampPlayerCount(Number(event.target.value) || 1);
                  return {
                    ...brief,
                    minPlayers: Math.min(nextMin, brief.maxPlayers),
                    maxPlayers: Math.max(nextMin, brief.maxPlayers),
                  };
                })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Max players
              <input
                type="number"
                min={1}
                max={6}
                value={project.brief.maxPlayers}
                onChange={(event) => onUpdateBrief((brief) => {
                  const nextMax = clampPlayerCount(Number(event.target.value) || 1);
                  return {
                    ...brief,
                    minPlayers: Math.min(brief.minPlayers, nextMax),
                    maxPlayers: Math.max(brief.minPlayers, nextMax),
                  };
                })}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Theme
            <input
              value={project.brief.theme}
              onChange={(event) => onUpdateBrief((brief) => ({
                ...brief,
                theme: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Art style
            <input
              value={project.brief.artStyle}
              onChange={(event) => onUpdateBrief((brief) => ({
                ...brief,
                artStyle: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gap: '0.65rem' }}>
            <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', color: '#065f46' }}>
              <input
                type="checkbox"
                checked={project.brief.hasDistinctSoloMode}
                onChange={(event) => onUpdateBrief((brief) => ({
                  ...brief,
                  hasDistinctSoloMode: event.target.checked,
                }))}
                style={{ marginTop: '0.15rem' }}
              />
              <span>Distinct solo mode</span>
            </label>

            <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', color: '#065f46' }}>
              <input
                type="checkbox"
                checked={project.brief.isCampaignGame}
                onChange={(event) => onUpdateBrief((brief) => ({
                  ...brief,
                  isCampaignGame: event.target.checked,
                }))}
                style={{ marginTop: '0.15rem' }}
              />
              <span>Campaign game</span>
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.55rem', paddingTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ color: '#064e3b', fontWeight: 800 }}>Project Palette</div>
              <div style={{ color: '#0f766e', fontSize: '0.8rem' }}>AI and human color choices both pull from this palette.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 88px))', gap: '0.65rem' }}>
            {PROJECT_PALETTE_ORDER.map((paletteId) => (
              <div
                key={paletteId}
                style={{
                  borderRadius: '18px',
                  border: '1px solid rgba(15,118,110,0.1)',
                  background: 'rgba(248,250,252,0.82)',
                  padding: '0.45rem',
                  display: 'grid',
                  gap: '0.35rem',
                }}
              >
                <ProjectColorPicker
                  label={PROJECT_PALETTE_LABELS[paletteId]}
                  value={project.settings.colorPalette[paletteId]}
                  compact
                  palette={paletteOptions}
                  onChange={(value) => onUpdateSettings((settings) => ({
                    ...settings,
                    colorPalette: {
                      ...settings.colorPalette,
                      [paletteId]: value,
                    },
                  }))}
                  onAssignPaletteColor={(targetId, value) => onUpdateSettings((settings) => ({
                    ...settings,
                    colorPalette: {
                      ...settings.colorPalette,
                      [targetId]: value,
                    },
                  }))}
                />
                <div style={{ color: '#0f766e', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center' }}>{PROJECT_PALETTE_LABELS[paletteId]}</div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
