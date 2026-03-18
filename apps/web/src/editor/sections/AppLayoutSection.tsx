import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle, textareaStyle } from '../styles';
import { renderIcon } from '../iconography';
import type { EditorProject } from '../types';

export function AppLayoutSection({
  project,
  onUpdateLayout,
}: {
  project: EditorProject;
  onUpdateLayout: (updater: (layout: EditorProject['appLayout']) => EditorProject['appLayout']) => void;
}) {
  const samplePlayers = project.seats.slice(0, Math.max(2, Math.min(project.seats.length, 4)));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)', gap: '1rem' }}>
        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Player App Layout</p>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Shell title
            <input
              value={project.appLayout.shellTitle}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                shellTitle: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Intro text
            <textarea
              value={project.appLayout.introText}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                introText: event.target.value,
              }))}
              style={{ ...textareaStyle, minHeight: '120px' }}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Summary strip label
            <input
              value={project.appLayout.summaryStripLabel}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                summaryStripLabel: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Linked view label
            <input
              value={project.appLayout.linkedViewLabel}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                linkedViewLabel: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Resource summary label
            <input
              value={project.appLayout.resourceSummaryLabel}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                resourceSummaryLabel: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            HUD items
            <input
              value={project.appLayout.hudItems.join(', ')}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                hudItems: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
              }))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Side panels
            <input
              value={project.appLayout.sidePanels.join(', ')}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                sidePanels: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
              }))}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Primary action label
            <input
              value={project.appLayout.primaryActionLabel}
              onChange={(event) => onUpdateLayout((layout) => ({
                ...layout,
                primaryActionLabel: event.target.value,
              }))}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Preview</p>
          <div style={{ borderRadius: '22px', border: '1px solid rgba(15,118,110,0.12)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(240,253,244,0.95), rgba(236,254,255,0.95))' }}>
            <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid rgba(15,118,110,0.12)', fontWeight: 800, color: '#064e3b' }}>
              {project.appLayout.shellTitle || project.name}
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
              <div style={{ color: '#0f766e', lineHeight: 1.6 }}>
                {project.appLayout.introText || 'Describe the experience for the player here.'}
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', marginBottom: '0.45rem' }}>
                  {project.appLayout.summaryStripLabel}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.55rem' }}>
                  {samplePlayers.map((seat, index) => (
                    <div key={seat.id} style={{ padding: '0.75rem', borderRadius: '18px', background: index === 0 ? 'rgba(240,253,244,0.96)' : 'rgba(255,255,255,0.82)', border: index === 0 ? '2px solid rgba(6,78,59,0.2)' : '1px solid rgba(15,118,110,0.1)', display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', gap: '0.65rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${seat.color} 24%, white)` }}>
                        {renderIcon(seat.identity.iconKey, { size: 18, style: { color: '#064e3b' } })}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#064e3b' }}>{seat.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#0f766e' }}>6 {project.appLayout.resourceSummaryLabel.toLowerCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(15,118,110,0.08)' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', marginBottom: '0.35rem' }}>
                  {project.appLayout.linkedViewLabel}
                </div>
                <div style={{ fontWeight: 700, color: '#064e3b' }}>{project.views.items.find((view) => view.kind === 'shared')?.label ?? 'Main Board'}</div>
                <div style={{ color: '#0f766e', marginTop: '0.35rem', lineHeight: 1.6 }}>
                  Clicking a player summary swaps this main area into that player&apos;s linked view while the summary strip stays in place.
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', marginBottom: '0.45rem' }}>
                  HUD
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {project.appLayout.hudItems.map((item) => (
                    <span key={item} style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.82rem' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', marginBottom: '0.45rem' }}>
                  Side Panels
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {project.appLayout.sidePanels.map((panel) => (
                    <div key={panel} style={{ padding: '0.6rem 0.75rem', borderRadius: '14px', background: 'rgba(255,255,255,0.8)', color: '#064e3b', border: '1px solid rgba(15,118,110,0.08)' }}>
                      {panel}
                    </div>
                  ))}
                </div>
              </div>

              <button
                style={{
                  justifySelf: 'start',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.65rem 0.95rem',
                  background: 'linear-gradient(135deg, #0f766e, #22c55e)',
                  color: 'white',
                }}
              >
                {project.appLayout.primaryActionLabel}
              </button>
            </div>
          </div>

          <p style={{ ...mutedTextStyle, marginTop: '0.85rem' }}>
            This tab owns the shared shell language around the board: the player summary strip, linked-view wording, resource labels, and supporting panels. Avatar style stays Lucide-first by default.
          </p>
        </div>
      </div>
    </div>
  );
}
