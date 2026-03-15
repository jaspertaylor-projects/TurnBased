import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createUIAffordanceState,
} from '@turnbased/engine-ui';
import type { UISelectionState } from '@turnbased/engine-ui';
import {
  createZoneId,
} from '@turnbased/shared-types';

import { applyPreviewActions, buildPreviewRuntime, createPreviewMoveTree } from '../editor/runtime';
import { loadLocalBuildRecord } from '../editor/shipping';
import type { LocalBuildRecord } from '../editor/shipping';
import { supabase } from '../lib/supabaseClient';
import { appendRoomMove, mintPlaySessionToken } from '../rooms/api';
import { getRoomSeatAssignments, getViewerSeatId, replayRoomLog } from '../rooms/runtime';
import type {
  PlaySessionTokenResponse,
  RoomActionRequest,
  RoomMemberRecord,
  RoomMoveRecord,
  RoomRecord,
} from '../rooms/types';

const EMPTY_SELECTION: UISelectionState = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

const shellStyle: CSSProperties = {
  minHeight: 'calc(100vh - 88px)',
  padding: '1rem',
  boxSizing: 'border-box',
};

const panelStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(16,185,129,0.14)',
  borderRadius: '22px',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
  padding: '1rem',
};

function readPlayTarget() {
  const hash = window.location.hash;
  const parts = hash.split('/');

  if (parts.length > 3 && parts[2] === 'local') {
    return {
      type: 'local_build' as const,
      id: parts[3] ?? null,
    };
  }

  if (parts.length > 3 && parts[2] === 'room') {
    return {
      type: 'room' as const,
      id: parts[3] ?? null,
    };
  }

  if (parts.length > 2) {
    return {
      type: 'build' as const,
      id: parts[2] ?? null,
    };
  }

  return {
    type: null,
    id: null,
  };
}

export const Play = () => {
  const [targetType, setTargetType] = useState<'build' | 'room' | 'local_build' | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [buildUrl, setBuildUrl] = useState<string | null>(null);
  const [localBuild, setLocalBuild] = useState<LocalBuildRecord | null>(null);
  const [localBuildState, setLocalBuildState] = useState<ReturnType<typeof buildPreviewRuntime>['initialState'] | null>(null);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [members, setMembers] = useState<RoomMemberRecord[]>([]);
  const [moves, setMoves] = useState<RoomMoveRecord[]>([]);
  const [playSession, setPlaySession] = useState<PlaySessionTokenResponse | null>(null);
  const [selection, setSelection] = useState<UISelectionState>(EMPTY_SELECTION);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncRoute = () => {
      const nextTarget = readPlayTarget();
      setTargetType(nextTarget.type);
      setTargetId(nextTarget.id);
      setSelection(EMPTY_SELECTION);
      setError(null);
      setMoveNotice(null);
      setLocalBuild(null);
      setLocalBuildState(null);
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!targetId) {
      return;
    }

    let cancelled = false;

    const loadTarget = async () => {
      setLoading(true);
      setError(null);

      try {
        if (targetType === 'local_build') {
          const build = loadLocalBuildRecord(targetId);
          if (!build) {
            throw new Error('Local build not found.');
          }

          const runtime = buildPreviewRuntime(build.projectSnapshot);

          if (!cancelled) {
            setLocalBuild(build);
            setLocalBuildState(runtime.initialState);
            setBuildUrl(null);
            setRoom(null);
            setMembers([]);
            setMoves([]);
            setPlaySession(null);
          }
          return;
        }

        if (targetType === 'build') {
          const { data, error: fetchError } = await supabase
            .from('project_builds')
            .select('r2_prefix')
            .eq('id', targetId)
            .single();

          if (fetchError || !data) {
            throw new Error('Build not found or inaccessible.');
          }

          if (!cancelled) {
            setBuildUrl(`https://play.turnbased.dev/${data.r2_prefix}/index.html`);
            setLocalBuild(null);
            setLocalBuildState(null);
            setRoom(null);
            setMembers([]);
            setMoves([]);
            setPlaySession(null);
          }
          return;
        }

        const [{ data: roomData, error: roomError }, { data: memberData, error: memberError }, { data: moveData, error: moveError }, { data: userData }] = await Promise.all([
          supabase
            .from('mp_rooms')
            .select('id, join_code, status, license_mode, max_players, build_id, listing_id, project_name, project_snapshot, last_activity_at, created_at, project_builds(r2_prefix)')
            .eq('id', targetId)
            .single(),
          supabase
            .from('mp_room_members')
            .select('room_id, user_id, display_name, is_host, joined_at, left_at, seat_index')
            .eq('room_id', targetId)
            .order('seat_index', { ascending: true }),
          supabase
            .from('mp_moves')
            .select('room_id, seq, user_id, move, created_at')
            .eq('room_id', targetId)
            .order('seq', { ascending: true }),
          supabase.auth.getUser(),
        ]);

        if (roomError || !roomData) {
          throw new Error('Room not found.');
        }

        if (memberError) {
          throw memberError;
        }

        if (moveError) {
          throw moveError;
        }

        const viewerId = userData.user?.id ?? null;
        const normalizedRoom = {
          ...roomData,
          project_builds: Array.isArray(roomData.project_builds) ? roomData.project_builds[0] ?? null : roomData.project_builds,
        };
        const token = viewerId ? await mintPlaySessionToken(targetId) : null;

        if (!cancelled) {
          setCurrentUserId(viewerId);
          setRoom(normalizedRoom as unknown as RoomRecord);
          setMembers((memberData ?? []) as RoomMemberRecord[]);
          setMoves((moveData ?? []) as RoomMoveRecord[]);
          setPlaySession(token);
          setBuildUrl(normalizedRoom.project_builds?.r2_prefix ? `https://play.turnbased.dev/${normalizedRoom.project_builds.r2_prefix}/index.html` : null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load play target.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTarget();
    return () => {
      cancelled = true;
    };
  }, [targetId, targetType]);

  useEffect(() => {
    if (targetType !== 'room' || !targetId) {
      return;
    }

    const membersChannel = supabase.channel(`room-members:${targetId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mp_room_members',
        filter: `room_id=eq.${targetId}`,
      }, async () => {
        const { data } = await supabase
          .from('mp_room_members')
          .select('room_id, user_id, display_name, is_host, joined_at, left_at, seat_index')
          .eq('room_id', targetId)
          .order('seat_index', { ascending: true });

        if (data) {
          setMembers(data as RoomMemberRecord[]);
        }
      })
      .subscribe();

    const movesChannel = supabase.channel(`room-moves:${targetId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mp_moves',
        filter: `room_id=eq.${targetId}`,
      }, (payload) => {
        const nextMove = payload.new as RoomMoveRecord;
        setMoves((current) => {
          if (current.some((entry) => entry.seq === nextMove.seq)) {
            return current;
          }

          return [...current, nextMove].sort((left, right) => left.seq - right.seq);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(movesChannel);
    };
  }, [targetId, targetType]);

  const roomReplay = useMemo(() => {
    if (!room?.project_snapshot) {
      return null;
    }

    return replayRoomLog(room.project_snapshot, moves);
  }, [moves, room]);

  const localRuntime = useMemo(() => {
    if (!localBuild) {
      return null;
    }

    return buildPreviewRuntime(localBuild.projectSnapshot);
  }, [localBuild]);

  const seatAssignments = useMemo(() => {
    if (!room?.project_snapshot) {
      return [];
    }

    return getRoomSeatAssignments(room.project_snapshot, members);
  }, [members, room]);

  const viewerSeatId = useMemo(() => {
    if (!room?.project_snapshot) {
      return null;
    }

    return getViewerSeatId(room.project_snapshot, members, currentUserId);
  }, [currentUserId, members, room]);

  const moveTree = roomReplay ? createPreviewMoveTree(roomReplay.state, roomReplay.runtime) : null;
  const affordances = moveTree ? createUIAffordanceState(moveTree, { selection }) : null;
  const localMoveTree = localBuildState && localRuntime ? createPreviewMoveTree(localBuildState, localRuntime) : null;
  const localAffordances = localMoveTree ? createUIAffordanceState(localMoveTree, { selection }) : null;

  useEffect(() => {
    setSelection(EMPTY_SELECTION);
  }, [targetId, moves.length]);

  function getSeatColor(ownerId: string | null | undefined) {
    return room?.project_snapshot?.seats.find((seat) => seat.id === ownerId)?.color ?? '#94a3b8';
  }

  function getLocalSeatColor(ownerId: string | null | undefined) {
    return localBuild?.projectSnapshot.seats.find((seat) => seat.id === ownerId)?.color ?? '#94a3b8';
  }

  function submitLocalBuildAction(actionId: string, overrides: Partial<UISelectionState> = {}) {
    if (!localBuildState || !localRuntime || !localMoveTree || !localBuild) {
      return;
    }

    const nextSelection = {
      ...selection,
      ...overrides,
    };
    const request = {
      actionId,
      selectedEntityId: nextSelection.selectedEntityId ?? undefined,
      destinationZoneId: nextSelection.selectedZoneId ?? undefined,
      targetEntityId: nextSelection.selectedTargetEntityId ?? undefined,
      subChoiceSelections: nextSelection.subChoiceSelections,
    };
    const validation = localMoveTree.validate(request);

    if (!validation.isValid) {
      setSelection(nextSelection);
      setMoveNotice(validation.errors.join(' '));
      return;
    }

    const canonicalActions = localMoveTree.materialize(request);
    const nextState = applyPreviewActions(
      localBuildState,
      localRuntime,
      canonicalActions,
      localBuild.projectSnapshot.rules.targetScore,
      localBuild.projectSnapshot.rules.maxTurns,
    );

    setLocalBuildState(nextState);
    setSelection(EMPTY_SELECTION);
    setMoveNotice('Action applied inside the immutable local build snapshot.');
  }

  async function submitRoomAction(actionId: string, overrides: Partial<UISelectionState> = {}) {
    if (!room || !roomReplay || !moveTree) {
      return;
    }

    if (!viewerSeatId) {
      setMoveNotice('You are observing this room and do not currently control a seat.');
      return;
    }

    if (roomReplay.state.turnState.activePlayerId !== viewerSeatId) {
      const activePlayerName = roomReplay.state.players[roomReplay.state.turnState.activePlayerId]?.displayName ?? 'another player';
      setMoveNotice(`It is currently ${activePlayerName}'s turn.`);
      return;
    }

    const nextSelection = {
      ...selection,
      ...overrides,
    };

    const request = {
      actionId,
      selectedEntityId: nextSelection.selectedEntityId ?? undefined,
      destinationZoneId: nextSelection.selectedZoneId ?? undefined,
      targetEntityId: nextSelection.selectedTargetEntityId ?? undefined,
      subChoiceSelections: nextSelection.subChoiceSelections,
    };

    const validation = moveTree.validate(request);
    if (!validation.isValid) {
      setSelection(nextSelection);
      setMoveNotice(validation.errors.join(' '));
      return;
    }

    const roomAction: RoomActionRequest = {
      kind: 'legal_move_request',
      actionId,
      selectedEntityId: nextSelection.selectedEntityId ?? null,
      destinationZoneId: nextSelection.selectedZoneId ?? null,
      targetEntityId: nextSelection.selectedTargetEntityId ?? null,
      subChoiceSelections: nextSelection.subChoiceSelections,
      playerSeatId: viewerSeatId,
      clientTimestamp: Date.now(),
      playSessionToken: playSession?.token ?? null,
    };

    try {
      await appendRoomMove(room.id, roomAction);
      setSelection(EMPTY_SELECTION);
      setMoveNotice('Move submitted to the room log.');
    } catch (appendError) {
      setMoveNotice(appendError instanceof Error ? appendError.message : 'Unable to submit move.');
    }
  }

  function handleEntityClick(entityId: string) {
    if (!affordances) {
      return;
    }

    const entityState = affordances.entityStates[entityId];
    if (!entityState?.interactable && selection.selectedEntityId !== entityId) {
      return;
    }

    setSelection({
      ...EMPTY_SELECTION,
      selectedEntityId: selection.selectedEntityId === entityId ? null : entityId,
    });
  }

  function handleLocalEntityClick(entityId: string) {
    if (!localAffordances) {
      return;
    }

    const entityState = localAffordances.entityStates[entityId];
    if (!entityState?.interactable && selection.selectedEntityId !== entityId) {
      return;
    }

    setSelection({
      ...EMPTY_SELECTION,
      selectedEntityId: selection.selectedEntityId === entityId ? null : entityId,
    });
  }

  function handleZoneClick(zoneId: string) {
    if (!moveTree || !affordances) {
      return;
    }

    const typedZoneId = createZoneId(zoneId);

    if (selection.selectedEntityId) {
      const matchingAction = moveTree.availableActions.find((action) => (
        action.interactableEntities.includes(selection.selectedEntityId ?? '')
        && action.validDestinations.includes(typedZoneId)
      ));

      if (matchingAction) {
        void submitRoomAction(matchingAction.id, {
          selectedEntityId: selection.selectedEntityId,
          selectedZoneId: typedZoneId,
        });
        return;
      }
    }

    if (affordances.zoneStates[zoneId]?.interactable) {
      setSelection({
        ...EMPTY_SELECTION,
        selectedZoneId: selection.selectedZoneId === typedZoneId ? null : typedZoneId,
      });
    }
  }

  function handleLocalZoneClick(zoneId: string) {
    if (!localMoveTree || !localAffordances) {
      return;
    }

    const typedZoneId = createZoneId(zoneId);

    if (selection.selectedEntityId) {
      const matchingAction = localMoveTree.availableActions.find((action) => (
        action.interactableEntities.includes(selection.selectedEntityId ?? '')
        && action.validDestinations.includes(typedZoneId)
      ));

      if (matchingAction) {
        submitLocalBuildAction(matchingAction.id, {
          selectedEntityId: selection.selectedEntityId,
          selectedZoneId: typedZoneId,
        });
        return;
      }
    }

    if (localAffordances.zoneStates[zoneId]?.interactable) {
      setSelection({
        ...EMPTY_SELECTION,
        selectedZoneId: selection.selectedZoneId === typedZoneId ? null : typedZoneId,
      });
    }
  }

  function renderRuntimeZone(zoneId: string) {
    if (!roomReplay || !room?.project_snapshot) {
      return null;
    }

    const zone = roomReplay.state.zones[zoneId];
    const zoneState = affordances?.zoneStates[zoneId];

    if (!zone) {
      return null;
    }

    return (
      <div
        key={zone.id}
        onClick={() => handleZoneClick(zoneId)}
        style={{
          borderRadius: '20px',
          border: zoneState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
          background: zoneState?.highlighted || zoneState?.dropTarget ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.86)',
          padding: '1rem',
          cursor: zoneState?.interactable ? 'pointer' : 'default',
          minHeight: '160px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
          <div>
            <h3 style={{ margin: 0 }}>{zone.name}</h3>
            <div style={{ marginTop: '0.25rem', color: '#0f766e', fontSize: '0.84rem' }}>
              {zone.entityIds.length} piece{zone.entityIds.length === 1 ? '' : 's'}
            </div>
          </div>
          {zone.ownerId && (
            <span style={{
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              background: getSeatColor(zone.ownerId),
              border: '1px solid rgba(15,23,42,0.12)',
            }}
            />
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.9rem' }}>
          {zone.entityIds.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No pieces here yet.</div>
          )}
          {zone.entityIds.map((entityId) => {
            const entity = roomReplay.state.entities[entityId];
            const entityState = affordances?.entityStates[entityId];
            const label = String(entity.properties.label ?? entity.id);

            return (
              <button
                key={entity.id}
                onClick={(event) => {
                  event.stopPropagation();
                  handleEntityClick(entity.id);
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '14px',
                  border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
                  background: entityState?.highlighted || entityState?.dragSource ? 'rgba(14,165,233,0.14)' : 'rgba(248,250,252,0.92)',
                  color: '#064e3b',
                  cursor: entityState?.interactable ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{label}</strong>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '999px',
                    background: getSeatColor(entity.ownerId),
                    border: '1px solid rgba(15,23,42,0.12)',
                  }}
                  />
                </div>
                <div style={{ color: '#0f766e', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  {entity.componentType} · owner {roomReplay.state.players[entity.ownerId ?? '']?.displayName ?? 'neutral'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderLocalBuildZone(zoneId: string) {
    if (!localBuildState || !localBuild) {
      return null;
    }

    const zone = localBuildState.zones[zoneId];
    const zoneState = localAffordances?.zoneStates[zoneId];

    if (!zone) {
      return null;
    }

    return (
      <div
        key={zone.id}
        onClick={() => handleLocalZoneClick(zoneId)}
        style={{
          borderRadius: '20px',
          border: zoneState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
          background: zoneState?.highlighted || zoneState?.dropTarget ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.86)',
          padding: '1rem',
          cursor: zoneState?.interactable ? 'pointer' : 'default',
          minHeight: '160px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
          <div>
            <h3 style={{ margin: 0 }}>{zone.name}</h3>
            <div style={{ marginTop: '0.25rem', color: '#0f766e', fontSize: '0.84rem' }}>
              {zone.entityIds.length} piece{zone.entityIds.length === 1 ? '' : 's'}
            </div>
          </div>
          {zone.ownerId && (
            <span
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '999px',
                background: getLocalSeatColor(zone.ownerId),
                border: '1px solid rgba(15,23,42,0.12)',
              }}
            />
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.9rem' }}>
          {zone.entityIds.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No pieces here yet.</div>
          )}
          {zone.entityIds.map((entityId) => {
            const entity = localBuildState.entities[entityId];
            const entityState = localAffordances?.entityStates[entityId];
            const label = String(entity.properties.label ?? entity.id);

            return (
              <button
                key={entity.id}
                onClick={(event) => {
                  event.stopPropagation();
                  handleLocalEntityClick(entity.id);
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '14px',
                  border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
                  background: entityState?.highlighted || entityState?.dragSource ? 'rgba(14,165,233,0.14)' : 'rgba(248,250,252,0.92)',
                  color: '#064e3b',
                  cursor: entityState?.interactable ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{label}</strong>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '999px',
                      background: getLocalSeatColor(entity.ownerId),
                      border: '1px solid rgba(15,23,42,0.12)',
                    }}
                  />
                </div>
                <div style={{ color: '#0f766e', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  {entity.componentType} · owner {localBuildState.players[entity.ownerId ?? '']?.displayName ?? 'neutral'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#b91c1c' }}>Error: {error}</div>;
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading play session...</div>;
  }

  if (targetType === 'local_build') {
    if (!targetId || !localBuild || !localBuildState || !localRuntime || !localMoveTree) {
      return <div style={{ padding: '2rem' }}>Build not available.</div>;
    }

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
                  <div key={seat.id} style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: localBuildState.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)', color: '#064e3b' }}>
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
                    onClick={() => {
                      if (action.kind === 'global') {
                        submitLocalBuildAction(action.id);
                        return;
                      }

                      setSelection((current) => ({
                        ...current,
                        selectedActionId: action.id,
                      }));
                    }}
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
                Object.keys(localBuildState.zones).map((zoneId) => renderLocalBuildZone(zoneId))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (targetType === 'build') {
    if (!targetId || !buildUrl) {
      return <div style={{ padding: '2rem' }}>Build not available.</div>;
    }

    return (
      <div style={{ width: '100vw', height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1e293b', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', color: 'white', alignItems: 'center' }}>
          <div>
            <strong>Published Build</strong>
            <span style={{ marginLeft: '1rem', fontSize: '0.84rem', color: '#cbd5e1' }}>Build {targetId}</span>
          </div>
          <button onClick={() => { window.location.hash = '#/dashboard'; }} style={{ background: 'transparent', color: 'white', border: '1px solid #475569', borderRadius: '4px', padding: '0.35rem 0.8rem' }}>
            Back
          </button>
        </div>
        <iframe
          src={buildUrl}
          sandbox="allow-scripts allow-pointer-lock allow-fullscreen"
          style={{ flex: 1, border: 'none', background: 'white' }}
          title="Published Build"
        />
      </div>
    );
  }

  if (!room || !targetId) {
    return <div style={{ padding: '2rem' }}>Room not found.</div>;
  }

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
                    <div key={seat.id} style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: roomReplay.state.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)', color: '#064e3b' }}>
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
                      onClick={() => {
                        if (action.kind === 'global') {
                          void submitRoomAction(action.id);
                          return;
                        }

                        setSelection((current) => ({
                          ...current,
                          selectedActionId: action.id,
                        }));
                      }}
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
                  Object.keys(roomReplay.state.zones).map((zoneId) => renderRuntimeZone(zoneId))
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
                        void submitRoomAction(action.id, {
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
};
