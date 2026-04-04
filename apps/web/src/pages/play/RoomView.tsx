import type { UISelectionState } from '@turnbased/engine-ui';
import type { createUIAffordanceState } from '@turnbased/engine-ui';
import type { replayRoomLog, getRoomSeatAssignments } from '../../rooms/runtime';
import type { createPreviewMoveTree } from '../../editor/runtime';
import type {
  PlaySessionTokenResponse,
  RoomMemberRecord,
  RoomMoveRecord,
  RoomRecord,
} from '../../rooms/types';

import { ZoneCard } from './ZoneCard';

type RoomReplay = ReturnType<typeof replayRoomLog>;
type SeatAssignments = ReturnType<typeof getRoomSeatAssignments>;
type MoveTree = ReturnType<typeof createPreviewMoveTree>;
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

interface RoomViewProps {
  room: RoomRecord;
  roomReplay: RoomReplay | null;
  buildUrl: string | null;
  seatAssignments: SeatAssignments;
  viewerSeatId: string | null;
  moveTree: MoveTree | null;
  affordances: AffordancesState | null;
  playSession: PlaySessionTokenResponse | null;
  members: RoomMemberRecord[];
  moves: RoomMoveRecord[];
  currentUserId: string | null;
  moveNotice: string | null;
  onEntityClick: (entityId: string) => void;
  onZoneClick: (zoneId: string) => void;
  onActionClick: (actionId: string, kind: string) => void;
  onSubmitRoomAction: (actionId: string, overrides?: Partial<UISelectionState>) => void;
  getSeatColor: (ownerId: string | null | undefined) => string;
}

export function RoomView({
  room,
  roomReplay,
  buildUrl,
  seatAssignments,
  viewerSeatId,
  moveTree,
  affordances,
  playSession,
  members,
  moves,
  currentUserId,
  moveNotice,
  onEntityClick,
  onZoneClick,
  onActionClick,
  onSubmitRoomAction,
  getSeatColor,
}: RoomViewProps) {
  return (
    <div style={shellStyle}>
      <div style={{ ...panelStyle, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem' }}>
            Room Session
          </p>
          <h1 style={{ margin: '0.35rem 0 0.35rem 0' }}>{room.project_name ?? 'Untitled Room'}</h1>
          <div style={{ color: '#0f766e', fontSize: '0.92rem' }}>
            Code {room.join_code} · {room.license_mode === 'owned_required' ? 'Ownership required' : 'Playtest'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {playSession && (
            <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)', color: '#075985' }}>
              Token expires {new Date(playSession.expiresAt).toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={() => { window.location.hash = '#/lobby'; }}
            style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.7rem 0.95rem', color: '#064e3b' }}
          >
            Back to Rooms
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: roomReplay ? '300px minmax(0, 1fr) 320px' : '320px minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: '1rem' }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Seats</h2>
            {seatAssignments.length === 0 ? (
              <p style={{ margin: 0, color: '#0f766e' }}>This room is currently running from a published build, so seat mapping happens inside the hosted build.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.7rem' }}>
                {seatAssignments.map(({ member, seat }) => (
                  <div key={member.user_id} style={{ padding: '0.8rem', borderRadius: '16px', background: 'rgba(240,253,244,0.9)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                      <strong>{seat?.name ?? `Seat ${member.seat_index + 1}`}</strong>
                      <span style={{ width: '14px', height: '14px', borderRadius: '999px', background: seat?.color ?? '#94a3b8' }} />
                    </div>
                    <div style={{ marginTop: '0.3rem', color: '#0f766e', fontSize: '0.86rem' }}>
                      {member.display_name}{member.user_id === currentUserId ? ' (you)' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Room Log</h2>
            <div style={{ display: 'grid', gap: '0.6rem', maxHeight: '360px', overflowY: 'auto' }}>
              {moves.length === 0 && (
                <p style={{ margin: 0, color: '#0f766e' }}>No actions yet.</p>
              )}
              {moves.map((move) => (
                <div key={move.seq} style={{ padding: '0.75rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                  <div style={{ fontWeight: 700, color: '#064e3b' }}>#{move.seq} · {move.move.actionId}</div>
                  <div style={{ color: '#0f766e', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {new Date(move.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section style={{ display: 'grid', gap: '1rem' }}>
          {roomReplay ? (
            <>
              <div style={panelStyle}>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {room.project_snapshot?.seats.map((seat) => (
                    <div
                      key={seat.id}
                      style={{
                        padding: '0.55rem 0.8rem',
                        borderRadius: '999px',
                        background: roomReplay.state.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)',
                        color: '#064e3b',
                      }}
                    >
                      {seat.name}: {roomReplay.state.players[seat.id]?.score ?? 0}
                    </div>
                  ))}
                  <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)', color: '#075985' }}>
                    Turn {roomReplay.state.turnState.turnNumber} · {roomReplay.state.turnState.currentPhase}
                  </div>
                </div>

                {moveNotice && (
                  <div style={{ marginTop: '0.85rem', padding: '0.85rem 0.95rem', borderRadius: '16px', background: 'rgba(240,253,244,0.92)', color: '#065f46' }}>
                    {moveNotice}
                  </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                  {affordances?.availableActions.map((action) => (
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
                {Object.keys(roomReplay.state.zones).length === 0 ? (
                  <div style={{ padding: '1rem', color: '#0f766e' }}>No playable zones were found in this room snapshot.</div>
                ) : (
                  Object.keys(roomReplay.state.zones).map((zoneId) => (
                    <ZoneCard
                      key={zoneId}
                      zone={roomReplay.state.zones[zoneId]}
                      entities={roomReplay.state.entities}
                      players={roomReplay.state.players}
                      zoneState={affordances?.zoneStates[zoneId]}
                      entityStates={affordances?.entityStates}
                      getSeatColor={getSeatColor}
                      onZoneClick={() => onZoneClick(zoneId)}
                      onEntityClick={onEntityClick}
                    />
                  ))
                )}
              </div>
            </>
          ) : buildUrl ? (
            <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid rgba(15,118,110,0.12)', color: '#0f766e' }}>
                This room is currently backed by a published build. Engine-native room replay will appear automatically once a project snapshot is attached.
              </div>
              <iframe
                src={buildUrl}
                sandbox="allow-scripts allow-pointer-lock allow-fullscreen"
                style={{ width: '100%', height: '70vh', border: 'none', background: 'white' }}
                title="Room Build"
              />
            </div>
          ) : (
            <div style={panelStyle}>
              <p style={{ margin: 0, color: '#0f766e' }}>This room does not have a playable snapshot or published build attached yet.</p>
            </div>
          )}
        </section>

        {roomReplay && (
          <aside style={{ display: 'grid', gap: '1rem' }}>
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Move Debugger</h2>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#065f46', marginBottom: '0.75rem' }}>
                Active seat: {roomReplay.state.players[roomReplay.state.turnState.activePlayerId]?.displayName}
                <br />
                Viewer seat: {viewerSeatId ? roomReplay.state.players[viewerSeatId]?.displayName : 'Spectator'}
                <br />
                Available actions: {moveTree?.availableActions.length ?? 0}
              </div>

              <div style={{ display: 'grid', gap: '0.7rem' }}>
                {moveTree?.availableActions.map((action) => (
                  <div key={action.id} style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                    <div style={{ fontWeight: 700, color: '#064e3b' }}>{action.displayName}</div>
                    <div style={{ color: '#0f766e', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                      {action.explanation?.summary}
                    </div>
                    <div style={{ color: '#155e75', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                      Sources: {action.interactableEntities.join(', ') || 'none'} · Destinations: {action.validDestinations.join(', ') || 'none'}
                    </div>
                    <button
                      onClick={() => {
                        onSubmitRoomAction(action.id, {
                          selectedEntityId: action.interactableEntities[0] ?? null,
                          selectedZoneId: action.validDestinations[0] ?? null,
                        });
                      }}
                      style={{
                        marginTop: '0.6rem',
                        borderRadius: '999px',
                        border: '1px solid rgba(15,118,110,0.15)',
                        background: 'rgba(255,255,255,0.82)',
                        padding: '0.45rem 0.8rem',
                        color: '#064e3b',
                      }}
                    >
                      Submit Suggested Move
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Replay Health</h2>
              {roomReplay.issues.length === 0 ? (
                <p style={{ margin: 0, color: '#065f46' }}>All room actions replay cleanly against the current engine snapshot.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  {roomReplay.issues.map((issue) => (
                    <div key={`${issue.seq}:${issue.actionId}`} style={{ padding: '0.75rem', borderRadius: '14px', background: 'rgba(254,226,226,0.9)', color: '#b91c1c' }}>
                      #{issue.seq} · {issue.actionId}
                      <div style={{ marginTop: '0.25rem', fontSize: '0.84rem' }}>{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
