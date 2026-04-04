import { useEffect, useMemo, useState } from 'react';
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

import { BuildEmbedView } from './play/BuildEmbedView';
import { LocalBuildView } from './play/LocalBuildView';
import { RoomView } from './play/RoomView';

const EMPTY_SELECTION: UISelectionState = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

function readPlayTarget() {
  const hash = window.location.hash;
  const parts = hash.split('/');

  if (parts.length > 3 && parts[2] === 'local') {
    return { type: 'local_build' as const, id: parts[3] ?? null };
  }

  if (parts.length > 3 && parts[2] === 'room') {
    return { type: 'room' as const, id: parts[3] ?? null };
  }

  if (parts.length > 2) {
    return { type: 'build' as const, id: parts[2] ?? null };
  }

  return { type: null, id: null };
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

    const nextSelection = { ...selection, ...overrides };
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

    const nextSelection = { ...selection, ...overrides };
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

  function handleLocalActionClick(actionId: string, kind: string) {
    if (kind === 'global') {
      submitLocalBuildAction(actionId);
    } else {
      setSelection((current) => ({ ...current, selectedActionId: actionId }));
    }
  }

  function handleRoomActionClick(actionId: string, kind: string) {
    if (kind === 'global') {
      void submitRoomAction(actionId);
    } else {
      setSelection((current) => ({ ...current, selectedActionId: actionId }));
    }
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
      <LocalBuildView
        localBuild={localBuild}
        localBuildState={localBuildState}
        localAffordances={localAffordances}
        moveNotice={moveNotice}
        getSeatColor={getLocalSeatColor}
        onEntityClick={handleLocalEntityClick}
        onZoneClick={handleLocalZoneClick}
        onActionClick={handleLocalActionClick}
      />
    );
  }

  if (targetType === 'build') {
    if (!targetId || !buildUrl) {
      return <div style={{ padding: '2rem' }}>Build not available.</div>;
    }

    return <BuildEmbedView buildUrl={buildUrl} targetId={targetId} />;
  }

  if (!room || !targetId) {
    return <div style={{ padding: '2rem' }}>Room not found.</div>;
  }

  return (
    <RoomView
      room={room}
      roomReplay={roomReplay}
      buildUrl={buildUrl}
      seatAssignments={seatAssignments}
      viewerSeatId={viewerSeatId}
      moveTree={moveTree}
      affordances={affordances}
      playSession={playSession}
      members={members}
      moves={moves}
      currentUserId={currentUserId}
      moveNotice={moveNotice}
      onEntityClick={handleEntityClick}
      onZoneClick={handleZoneClick}
      onActionClick={handleRoomActionClick}
      onSubmitRoomAction={(actionId, overrides) => void submitRoomAction(actionId, overrides)}
      getSeatColor={getSeatColor}
    />
  );
};
