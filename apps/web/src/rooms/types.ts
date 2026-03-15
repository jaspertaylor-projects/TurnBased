import type { EditorProject, EditorSeat } from '../editor/types';

export type RoomLicenseMode = 'playtest' | 'owned_required';

export interface RoomJoinState {
  room_id: string | null;
  join_code: string | null;
  license_mode: RoomLicenseMode | null;
  status: string | null;
  max_players: number;
  seat_slots_remaining: number;
  can_join: boolean;
  requires_entitlement: boolean;
  has_active_owner: boolean;
  viewer_has_entitlement: boolean;
  is_guest: boolean;
  guest_allowed: boolean;
  message: string | null;
  build_id: string | null;
  listing_id: string | null;
  project_name: string | null;
}

export interface RoomMemberRecord {
  room_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  joined_at: string;
  left_at: string | null;
  seat_index: number;
}

export interface RoomRecord {
  id: string;
  join_code: string;
  status: string;
  license_mode: RoomLicenseMode;
  max_players: number;
  build_id: string | null;
  listing_id: string | null;
  project_name: string | null;
  project_snapshot: EditorProject | null;
  last_activity_at: string;
  created_at: string;
  project_builds?: {
    r2_prefix: string;
  }[] | {
    r2_prefix: string;
  } | null;
  listings?: {
    title: string;
  } | null;
}

export interface RoomActionRequest {
  kind: 'legal_move_request';
  actionId: string;
  selectedEntityId?: string | null;
  destinationZoneId?: string | null;
  targetEntityId?: string | null;
  subChoiceSelections?: Record<string, string | number | boolean | string[]>;
  playerSeatId?: string | null;
  clientTimestamp: number;
  playSessionToken?: string | null;
}

export interface RoomMoveRecord {
  room_id: string;
  seq: number;
  user_id: string;
  move: RoomActionRequest;
  created_at: string;
}

export interface PlaySessionTokenResponse {
  token: string;
  roomId: string;
  scope: 'room';
  expiresAt: string;
  licenseMode: RoomLicenseMode;
  canWrite: boolean;
}

export interface CreateRoomInput {
  buildId?: string | null;
  maxPlayers?: number;
  licenseMode: RoomLicenseMode;
  listingId?: string | null;
  projectSnapshot?: EditorProject | null;
  projectName?: string | null;
}

export interface RoomSeatAssignment {
  member: RoomMemberRecord;
  seat: EditorSeat | null;
}
