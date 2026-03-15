ALTER TABLE mp_rooms
    ALTER COLUMN build_id DROP NOT NULL;

ALTER TABLE mp_rooms
    ADD COLUMN IF NOT EXISTS project_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS project_name TEXT;

ALTER TABLE mp_room_members
    ADD COLUMN IF NOT EXISTS seat_index INTEGER;

WITH ranked_members AS (
    SELECT
        room_id,
        user_id,
        ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY joined_at, user_id) - 1 AS computed_seat_index
    FROM mp_room_members
)
UPDATE mp_room_members AS room_member
SET seat_index = ranked_members.computed_seat_index
FROM ranked_members
WHERE room_member.room_id = ranked_members.room_id
  AND room_member.user_id = ranked_members.user_id
  AND room_member.seat_index IS NULL;

ALTER TABLE mp_room_members
    ALTER COLUMN seat_index SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mp_room_members_active_seat_idx
    ON mp_room_members (room_id, seat_index)
    WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS mp_play_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES mp_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL DEFAULT 'room' CHECK (scope IN ('room')),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mp_play_sessions ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS mp_create_room(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION mp_room_has_active_owner(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license_mode TEXT;
    v_listing_id UUID;
BEGIN
    SELECT license_mode, listing_id
    INTO v_license_mode, v_listing_id
    FROM mp_rooms
    WHERE id = p_room_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_license_mode <> 'owned_required' THEN
        RETURN TRUE;
    END IF;

    IF v_listing_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM mp_room_members AS member
        JOIN listings AS listing
          ON listing.id = v_listing_id
        LEFT JOIN entitlements AS entitlement
          ON entitlement.buyer_id = member.user_id
         AND entitlement.listing_id = v_listing_id
        WHERE member.room_id = p_room_id
          AND member.left_at IS NULL
          AND (
            entitlement.id IS NOT NULL
            OR listing.dev_id = member.user_id
          )
    );
END;
$$;

CREATE OR REPLACE FUNCTION mp_get_room_join_state(p_join_code TEXT)
RETURNS TABLE (
    room_id UUID,
    join_code TEXT,
    license_mode TEXT,
    status TEXT,
    max_players INTEGER,
    seat_slots_remaining INTEGER,
    can_join BOOLEAN,
    requires_entitlement BOOLEAN,
    has_active_owner BOOLEAN,
    viewer_has_entitlement BOOLEAN,
    is_guest BOOLEAN,
    guest_allowed BOOLEAN,
    message TEXT,
    build_id UUID,
    listing_id UUID,
    project_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room RECORD;
    v_member_count INTEGER := 0;
    v_is_existing_member BOOLEAN := FALSE;
    v_viewer_has_entitlement BOOLEAN := FALSE;
    v_has_active_owner BOOLEAN := FALSE;
    v_is_guest BOOLEAN := FALSE;
    v_can_join BOOLEAN := FALSE;
    v_message TEXT := NULL;
BEGIN
    IF v_user_id IS NOT NULL THEN
        SELECT COALESCE(is_anonymous, FALSE)
        INTO v_is_guest
        FROM auth.users
        WHERE id = v_user_id;
    END IF;

    SELECT *
    INTO v_room
    FROM mp_rooms
    WHERE join_code = UPPER(p_join_code);

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            NULL::UUID,
            UPPER(p_join_code),
            NULL::TEXT,
            NULL::TEXT,
            0,
            0,
            FALSE,
            FALSE,
            FALSE,
            FALSE,
            v_is_guest,
            FALSE,
            'Room not found.',
            NULL::UUID,
            NULL::UUID,
            NULL::TEXT;
        RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_member_count
    FROM mp_room_members
    WHERE room_id = v_room.id
      AND left_at IS NULL;

    SELECT EXISTS (
        SELECT 1
        FROM mp_room_members
        WHERE room_id = v_room.id
          AND user_id = v_user_id
    )
    INTO v_is_existing_member;

    IF v_room.listing_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM listings AS listing
            LEFT JOIN entitlements AS entitlement
              ON entitlement.listing_id = listing.id
             AND entitlement.buyer_id = v_user_id
            WHERE listing.id = v_room.listing_id
              AND (
                entitlement.id IS NOT NULL
                OR listing.dev_id = v_user_id
              )
        )
        INTO v_viewer_has_entitlement;
    END IF;

    v_has_active_owner := mp_room_has_active_owner(v_room.id);

    IF v_room.status <> 'open' THEN
        v_message := 'Room is closed.';
    ELSIF v_is_guest AND v_room.license_mode <> 'playtest' THEN
        v_message := 'Guest access is limited to playtest rooms.';
    ELSIF NOT v_is_existing_member AND v_member_count >= v_room.max_players THEN
        v_message := 'Room is full.';
    ELSIF v_room.license_mode = 'owned_required' AND NOT (v_viewer_has_entitlement OR v_has_active_owner) THEN
        v_message := 'Requires game ownership. At least one active participant must own this game.';
    ELSE
        v_can_join := TRUE;
        IF v_room.license_mode = 'owned_required' THEN
            v_message := 'Join unlocked because an owner is present in the room.';
        ELSIF v_is_guest THEN
            v_message := 'Guest playtest access is allowed for this room.';
        ELSE
            v_message := 'Room ready to join.';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        v_room.id,
        v_room.join_code,
        v_room.license_mode,
        v_room.status,
        v_room.max_players,
        GREATEST(v_room.max_players - v_member_count, 0),
        v_can_join,
        v_room.license_mode = 'owned_required',
        v_has_active_owner,
        v_viewer_has_entitlement,
        v_is_guest,
        v_room.license_mode = 'playtest',
        v_message,
        v_room.build_id,
        v_room.listing_id,
        COALESCE(v_room.project_name, 'Untitled Room');
END;
$$;

CREATE OR REPLACE FUNCTION mp_create_room(
    p_build_id UUID DEFAULT NULL,
    p_max_players INTEGER DEFAULT 4,
    p_license_mode TEXT DEFAULT 'playtest',
    p_listing_id UUID DEFAULT NULL,
    p_project_snapshot JSONB DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
    v_join_code TEXT;
    v_display_name TEXT;
    v_is_guest BOOLEAN := FALSE;
    v_listing RECORD;
    v_build_owner_id UUID;
    v_resolved_build_id UUID := p_build_id;
    v_resolved_listing_id UUID := p_listing_id;
    v_room_name TEXT := NULLIF(BTRIM(p_project_name), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT COALESCE(is_anonymous, FALSE)
    INTO v_is_guest
    FROM auth.users
    WHERE id = v_user_id;

    IF v_is_guest THEN
        RAISE EXCEPTION 'Guest accounts cannot host rooms.';
    END IF;

    IF p_license_mode NOT IN ('playtest', 'owned_required') THEN
        RAISE EXCEPTION 'Unsupported room license mode.';
    END IF;

    IF p_max_players < 1 OR p_max_players > 8 THEN
        RAISE EXCEPTION 'Rooms must support between 1 and 8 players.';
    END IF;

    IF p_license_mode = 'owned_required' THEN
        IF p_listing_id IS NULL THEN
            RAISE EXCEPTION 'Owned rooms require a marketplace listing.';
        END IF;

        SELECT listing.*
        INTO v_listing
        FROM listings AS listing
        WHERE listing.id = p_listing_id
          AND listing.status = 'published';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Listing not found or not published.';
        END IF;

        IF v_listing.dev_id <> v_user_id AND NOT EXISTS (
            SELECT 1
            FROM entitlements
            WHERE buyer_id = v_user_id
              AND listing_id = p_listing_id
        ) THEN
            RAISE EXCEPTION 'You must own this game or be its creator to host an owned room.';
        END IF;

        IF p_build_id IS NOT NULL AND p_build_id <> v_listing.build_id THEN
            RAISE EXCEPTION 'The selected build does not match the listing.';
        END IF;

        v_resolved_build_id := v_listing.build_id;
        v_resolved_listing_id := v_listing.id;
        v_room_name := COALESCE(v_room_name, v_listing.title);
    ELSE
        IF p_build_id IS NULL AND p_project_snapshot IS NULL THEN
            RAISE EXCEPTION 'Playtest rooms require a build or a project snapshot.';
        END IF;

        IF p_build_id IS NOT NULL THEN
            SELECT project.owner_id
            INTO v_build_owner_id
            FROM project_builds AS build
            JOIN projects AS project
              ON project.id = build.project_id
            WHERE build.id = p_build_id;

            IF v_build_owner_id IS NULL THEN
                RAISE EXCEPTION 'Build not found.';
            END IF;

            IF v_build_owner_id <> v_user_id THEN
                RAISE EXCEPTION 'You can only host playtest rooms for your own builds.';
            END IF;
        END IF;

        v_room_name := COALESCE(v_room_name, 'Playtest Room');
    END IF;

    LOOP
        v_join_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM mp_rooms WHERE join_code = v_join_code
        );
    END LOOP;

    v_display_name := 'Player_' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 4);

    INSERT INTO mp_rooms (
        build_id,
        host_user_id,
        join_code,
        max_players,
        license_mode,
        listing_id,
        project_snapshot,
        project_name
    )
    VALUES (
        v_resolved_build_id,
        v_user_id,
        v_join_code,
        p_max_players,
        p_license_mode,
        v_resolved_listing_id,
        p_project_snapshot,
        v_room_name
    )
    RETURNING id INTO v_room_id;

    INSERT INTO mp_room_members (room_id, user_id, display_name, is_host, seat_index)
    VALUES (v_room_id, v_user_id, v_display_name, TRUE, 0);

    RETURN v_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION mp_join_room(p_join_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room RECORD;
    v_join_state RECORD;
    v_existing_member RECORD;
    v_display_name TEXT;
    v_next_seat_index INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT *
    INTO v_join_state
    FROM mp_get_room_join_state(p_join_code);

    IF v_join_state.room_id IS NULL OR NOT v_join_state.can_join THEN
        RAISE EXCEPTION '%', COALESCE(v_join_state.message, 'Unable to join room.');
    END IF;

    SELECT *
    INTO v_room
    FROM mp_rooms
    WHERE id = v_join_state.room_id;

    SELECT *
    INTO v_existing_member
    FROM mp_room_members
    WHERE room_id = v_room.id
      AND user_id = v_user_id;

    v_display_name := 'Player_' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 4);

    IF FOUND THEN
        IF v_existing_member.left_at IS NULL THEN
            RETURN v_room.id;
        END IF;

        v_next_seat_index := v_existing_member.seat_index;

        IF EXISTS (
            SELECT 1
            FROM mp_room_members
            WHERE room_id = v_room.id
              AND left_at IS NULL
              AND seat_index = v_existing_member.seat_index
        ) THEN
            SELECT candidate.seat_index
            INTO v_next_seat_index
            FROM generate_series(0, v_room.max_players - 1) AS candidate(seat_index)
            WHERE NOT EXISTS (
                SELECT 1
                FROM mp_room_members AS active_member
                WHERE active_member.room_id = v_room.id
                  AND active_member.left_at IS NULL
                  AND active_member.seat_index = candidate.seat_index
            )
            ORDER BY candidate.seat_index
            LIMIT 1;
        END IF;

        IF v_next_seat_index IS NULL THEN
            RAISE EXCEPTION 'Room is full.';
        END IF;

        UPDATE mp_room_members
        SET left_at = NULL,
            display_name = v_display_name,
            seat_index = v_next_seat_index
        WHERE room_id = v_room.id
          AND user_id = v_user_id;

        RETURN v_room.id;
    END IF;

    SELECT candidate.seat_index
    INTO v_next_seat_index
    FROM generate_series(0, v_room.max_players - 1) AS candidate(seat_index)
    WHERE NOT EXISTS (
        SELECT 1
        FROM mp_room_members AS active_member
        WHERE active_member.room_id = v_room.id
          AND active_member.left_at IS NULL
          AND active_member.seat_index = candidate.seat_index
    )
    ORDER BY candidate.seat_index
    LIMIT 1;

    IF v_next_seat_index IS NULL THEN
        RAISE EXCEPTION 'Room is full.';
    END IF;

    INSERT INTO mp_room_members (room_id, user_id, display_name, seat_index)
    VALUES (v_room.id, v_user_id, v_display_name, v_next_seat_index);

    RETURN v_room.id;
END;
$$;

CREATE OR REPLACE FUNCTION mp_append_move(p_room_id UUID, p_move JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_seq INTEGER;
    v_room_status TEXT;
    v_license_mode TEXT;
    v_max_burst INTEGER := 10;
    v_burst_window INTERVAL := '1 second';
    v_limit_record RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF length(p_move::TEXT) > 200000 THEN
        RAISE EXCEPTION 'Payload size limit exceeded (200KB max)';
    END IF;

    SELECT *
    INTO v_limit_record
    FROM user_rate_limits
    WHERE user_id = v_user_id;

    IF NOT FOUND THEN
        INSERT INTO user_rate_limits (user_id, last_move_at, move_count_burst)
        VALUES (v_user_id, v_now, 1);
    ELSE
        IF v_now - v_limit_record.last_move_at > v_burst_window THEN
            UPDATE user_rate_limits
            SET last_move_at = v_now,
                move_count_burst = 1
            WHERE user_id = v_user_id;
        ELSIF v_limit_record.move_count_burst >= v_max_burst THEN
            RAISE EXCEPTION 'Rate limit exceeded: Too many moves in a short duration';
        ELSE
            UPDATE user_rate_limits
            SET last_move_at = v_now,
                move_count_burst = move_count_burst + 1
            WHERE user_id = v_user_id;
        END IF;
    END IF;

    SELECT status, license_mode
    INTO v_room_status, v_license_mode
    FROM mp_rooms
    WHERE id = p_room_id;

    IF v_room_status IS NULL THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    IF v_room_status = 'closed' THEN
        RAISE EXCEPTION 'Room is closed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM mp_room_members
        WHERE room_id = p_room_id
          AND user_id = v_user_id
          AND left_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User is not an active member of this room';
    END IF;

    IF v_license_mode = 'owned_required' AND NOT mp_room_has_active_owner(p_room_id) THEN
        RAISE EXCEPTION 'Owned rooms require an entitled player to remain present.';
    END IF;

    INSERT INTO mp_moves (room_id, user_id, move)
    VALUES (p_room_id, v_user_id, p_move)
    RETURNING seq INTO v_seq;

    UPDATE mp_rooms
    SET last_activity_at = v_now
    WHERE id = p_room_id;

    RETURN v_seq;
END;
$$;
