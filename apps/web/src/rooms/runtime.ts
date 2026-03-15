import type { GameState, LegalMoveRequest } from '@turnbased/engine-core';
import { createZoneId } from '@turnbased/shared-types';

import { applyPreviewActions, buildPreviewRuntime, createPreviewMoveTree } from '../editor/runtime';
import type { EditorProject } from '../editor/types';

import type {
  RoomActionRequest,
  RoomMemberRecord,
  RoomMoveRecord,
  RoomSeatAssignment,
} from './types';

export interface RoomReplayIssue {
  seq: number;
  actionId: string;
  message: string;
}

export interface RoomReplayResult {
  state: GameState;
  issues: RoomReplayIssue[];
  runtime: ReturnType<typeof buildPreviewRuntime>;
}

function toMoveRequest(move: RoomActionRequest) {
  return {
    actionId: move.actionId,
    selectedEntityId: move.selectedEntityId ?? undefined,
    destinationZoneId: move.destinationZoneId ? createZoneId(move.destinationZoneId) : undefined,
    targetEntityId: move.targetEntityId ?? undefined,
    subChoiceSelections: move.subChoiceSelections ?? {},
  } satisfies LegalMoveRequest;
}

export function replayRoomLog(project: EditorProject, moves: readonly RoomMoveRecord[]): RoomReplayResult {
  const runtime = buildPreviewRuntime(project);
  let state = runtime.initialState;
  const issues: RoomReplayIssue[] = [];

  const orderedMoves = [...moves].sort((left, right) => left.seq - right.seq);

  for (const record of orderedMoves) {
    if (record.move?.kind !== 'legal_move_request') {
      issues.push({
        seq: record.seq,
        actionId: 'unknown',
        message: 'Unsupported room action payload.',
      });
      continue;
    }

    const moveTree = createPreviewMoveTree(state, runtime);
    const request = toMoveRequest(record.move);
    const validation = moveTree.validate(request);

    if (!validation.isValid) {
      issues.push({
        seq: record.seq,
        actionId: record.move.actionId,
        message: validation.errors.join(' '),
      });
      continue;
    }

    const canonicalActions = moveTree.materialize(request);
    state = applyPreviewActions(
      state,
      runtime,
      canonicalActions,
      project.rules.targetScore,
      project.rules.maxTurns,
    );
  }

  return {
    state,
    issues,
    runtime,
  };
}

export function getRoomSeatAssignments(project: EditorProject, members: readonly RoomMemberRecord[]): RoomSeatAssignment[] {
  return [...members]
    .filter((member) => member.left_at === null)
    .sort((left, right) => left.seat_index - right.seat_index)
    .map((member) => ({
      member,
      seat: project.seats[member.seat_index] ?? null,
    }));
}

export function getViewerSeatId(
  project: EditorProject,
  members: readonly RoomMemberRecord[],
  userId: string | null | undefined,
): string | null {
  if (!userId) {
    return null;
  }

  const member = members.find((entry) => entry.user_id === userId && entry.left_at === null);
  if (!member) {
    return null;
  }

  return project.seats[member.seat_index]?.id ?? null;
}
