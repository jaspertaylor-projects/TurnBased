import { supabase } from '../lib/supabaseClient';

import type {
  CreateRoomInput,
  PlaySessionTokenResponse,
  RoomActionRequest,
  RoomJoinState,
} from './types';

function toJoinState(record: Partial<RoomJoinState> | null | undefined): RoomJoinState {
  return {
    room_id: record?.room_id ?? null,
    join_code: record?.join_code ?? null,
    license_mode: record?.license_mode ?? null,
    status: record?.status ?? null,
    max_players: record?.max_players ?? 0,
    seat_slots_remaining: record?.seat_slots_remaining ?? 0,
    can_join: record?.can_join ?? false,
    requires_entitlement: record?.requires_entitlement ?? false,
    has_active_owner: record?.has_active_owner ?? false,
    viewer_has_entitlement: record?.viewer_has_entitlement ?? false,
    is_guest: record?.is_guest ?? false,
    guest_allowed: record?.guest_allowed ?? false,
    message: record?.message ?? null,
    build_id: record?.build_id ?? null,
    listing_id: record?.listing_id ?? null,
    project_name: record?.project_name ?? null,
  };
}

export async function ensurePlayableSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    return session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error('Unable to create a guest play session.');
  }

  return data.session;
}

export async function previewRoomJoin(joinCode: string): Promise<RoomJoinState> {
  const { data, error } = await supabase.rpc('mp_get_room_join_state', {
    p_join_code: joinCode.trim().toUpperCase(),
  });

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return toJoinState(data[0]);
  }

  return toJoinState(data);
}

export async function joinRoom(joinCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('mp_join_room', {
    p_join_code: joinCode.trim().toUpperCase(),
  });

  if (error || !data) {
    throw error ?? new Error('Unable to join room.');
  }

  return String(data);
}

export async function createRoom(input: CreateRoomInput): Promise<string> {
  const { data, error } = await supabase.rpc('mp_create_room', {
    p_build_id: input.buildId ?? null,
    p_max_players: input.maxPlayers ?? 4,
    p_license_mode: input.licenseMode,
    p_listing_id: input.listingId ?? null,
    p_project_snapshot: input.projectSnapshot ?? null,
    p_project_name: input.projectName ?? null,
  });

  if (error || !data) {
    throw error ?? new Error('Unable to create room.');
  }

  return String(data);
}

export async function mintPlaySessionToken(roomId: string): Promise<PlaySessionTokenResponse> {
  const { data, error } = await supabase.functions.invoke('play-session-token', {
    body: {
      roomId,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.token || !data?.expiresAt) {
    throw new Error('Play session token response was incomplete.');
  }

  return data satisfies PlaySessionTokenResponse;
}

export async function appendRoomMove(roomId: string, move: RoomActionRequest): Promise<number> {
  const { data, error } = await supabase.rpc('mp_append_move', {
    p_room_id: roomId,
    p_move: move,
  });

  if (error || typeof data !== 'number') {
    throw error ?? new Error('Unable to append room action.');
  }

  return data;
}
