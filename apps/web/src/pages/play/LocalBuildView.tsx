import type { buildPreviewRuntime } from '../../editor/runtime';
import type { LocalBuildRecord } from '../../editor/shipping';
import type { createUIAffordanceState } from '@turnbased/engine-ui';

import { ZoneCard } from './ZoneCard';

type LocalBuildState = ReturnType<typeof buildPreviewRuntime>['initialState'];
type AffordancesState = ReturnType<typeof createUIAffordanceState>;

const shellStyle = {
  minHeight: 'calc(100vh - 88px)',
  padding: '1rem',
  boxSizing: 'border-box' as const,
};

const panelStyle = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(16,185,129,0.14)',
  borderRadius: '22px',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
  padding: '1rem',
};

interface LocalBuildViewProps {
  localBuild: LocalBuildRecord;
  localBuildState: LocalBuildState;
  localAffordances: AffordancesState | null;
  moveNotice: string | null;
  getSeatColor: (ownerId: string | null | undefined) => string;
  onEntityClick: (entityId: string) => void;
  onZoneClick: (zoneId: string) => void;
  onActionClick: (actionId: string, kind: string) => void;
}

export function LocalBuildView({
  localBuild,
  localBuildState,
  localAffordances,
  moveNotice,
  getSeatColor,
  onEntityClick,
  onZoneClick,
  onActionClick,
}: LocalBuildViewProps) {
  return (
    <div style={shellStyle}>
      <div style={{ ...panelStyle, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem' }}>
            {localBuild.kind === 'release' ? 'Published Snapshot' : 'Preview Build'}
          </p>
          <h1 style={{ margin: '0.35rem 0 0.35rem 0' }}>{localBuild.releaseTitle ?? localBuild.projectName}</h1>
          <div style={{ color: '#0f766e', fontSize: '0.92rem' }}>
            Commit {localBuild.commitSha} · pinned core {localBuild.manifest.versionPins.engineCore} · {new Date(localBuild.createdAt).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a
            href={`#/editor/${localBuild.projectId}`}
            style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.7rem 0.95rem', color: '#064e3b', textDecoration: 'none' }}
          >
            Back to Editor
          </a>
          <a
            href="#/dashboard"
            style={{ borderRadius: '999px', border: '1px solid rgba(14,165,233,0.15)', background: 'rgba(239,246,255,0.92)', padding: '0.7rem 0.95rem', color: '#075985', textDecoration: 'none' }}
          >
            Dashboard
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: '1rem' }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Build Manifest</h2>
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
                Seats: {localBuild.manifest.seats.length}
                <br />
                Zones: {localBuild.manifest.runtime.zoneCount}
                <br />
                Playable destinations: {localBuild.manifest.runtime.destinationZoneCount}
              </div>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(239,246,255,0.92)', color: '#155e75' }}>
                Files: {Object.keys(localBuild.files).join(', ')}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Compatibility</h2>
            {localBuild.compatibilityWarnings.length === 0 ? (
              <p style={{ margin: 0, color: '#065f46' }}>No compatibility warnings were recorded for this build.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {localBuild.compatibilityWarnings.map((warning) => (
                  <div
                    key={`${warning.code}:${warning.message}`}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '14px',
                      background: warning.severity === 'blocking'
                        ? 'rgba(254,226,226,0.92)'
                        : warning.severity === 'warning'
                          ? 'rgba(254,249,195,0.92)'
                          : 'rgba(239,246,255,0.92)',
                      color: warning.severity === 'blocking'
                        ? '#b91c1c'
                        : warning.severity === 'warning'
                          ? '#854d0e'
                          : '#155e75',
                    }}
                  >
                    {warning.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section style={{ display: 'grid', gap: '1rem' }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {localBuild.projectSnapshot.seats.map((seat) => (
                <div
                  key={seat.id}
                  style={{
                    padding: '0.55rem 0.8rem',
                    borderRadius: '999px',
                    background: localBuildState.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)',
                    color: '#064e3b',
                  }}
                >
                  {seat.name}: {localBuildState.players[seat.id]?.score ?? 0}
                </div>
              ))}
              <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)', color: '#075985' }}>
                Turn {localBuildState.turnState.turnNumber} · {localBuildState.turnState.currentPhase}
              </div>
            </div>

            {moveNotice && (
              <div style={{ marginTop: '0.85rem', padding: '0.85rem 0.95rem', borderRadius: '16px', background: 'rgba(240,253,244,0.92)', color: '#065f46' }}>
                {moveNotice}
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              {localAffordances?.availableActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onActionClick(action.id, action.kind)}
                  disabled={!action.enabled}
                  style={{
                    borderRadius: '999px',
                    border: action.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.15)',
                    background: action.ready ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.86)',
                    padding: '0.55rem 0.85rem',
                    color: '#064e3b',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            {Object.keys(localBuildState.zones).length === 0 ? (
              <div style={{ padding: '1rem', color: '#0f766e' }}>No playable zones were found in this build snapshot.</div>
            ) : (
              Object.keys(localBuildState.zones).map((zoneId) => (
                <ZoneCard
                  key={zoneId}
                  zone={localBuildState.zones[zoneId]}
                  entities={localBuildState.entities}
                  players={localBuildState.players}
                  zoneState={localAffordances?.zoneStates[zoneId]}
                  entityStates={localAffordances?.entityStates}
                  getSeatColor={getSeatColor}
                  onZoneClick={() => onZoneClick(zoneId)}
                  onEntityClick={onEntityClick}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
