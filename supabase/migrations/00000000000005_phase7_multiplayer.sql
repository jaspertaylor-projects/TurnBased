-- Multiplayer Rooms
CREATE TABLE mp_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id UUID NOT NULL REFERENCES project_builds(id) ON DELETE CASCADE,
    host_user_id UUID REFERENCES auth.users(id),
    join_code TEXT UNIQUE, -- e.g., 'ABC-123'
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'playing', 'closed')),
    max_players INTEGER NOT NULL DEFAULT 4,
    license_mode TEXT NOT NULL DEFAULT 'playtest' CHECK (license_mode IN ('owned_required', 'playtest')),
    listing_id UUID, -- For future marketplace integration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room Members (Who is in the room)
CREATE TABLE mp_room_members (
    room_id UUID NOT NULL REFERENCES mp_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (room_id, user_id)
);

-- Event Sourced Moves (The authoritative append-log)
CREATE TABLE mp_moves (
    room_id UUID NOT NULL REFERENCES mp_rooms(id) ON DELETE CASCADE,
    seq SERIAL NOT NULL, -- Logical clock / sequence number per room (simplified using SERIAL, though a composite unique seq per room is better for scale, SERIAL works for MVP)
    user_id UUID NOT NULL REFERENCES auth.users(id),
    move JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, seq)
);

-- Enable Realtime for the tables to allow clients to subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE mp_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE mp_room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE mp_moves;

-- Enable RLS
ALTER TABLE mp_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_moves ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Policies
-- --------------------------------------------------------

-- Anyone can see a room if they know the code or are in it
CREATE POLICY "Rooms visible to members or via code"
    ON mp_rooms FOR SELECT
    USING (true); -- simplified for MVP: all authenticated users can read room metadata

-- Members can see other members in the same room
CREATE POLICY "Members visible to room"
    ON mp_room_members FOR SELECT
    USING (EXISTS (SELECT 1 FROM mp_room_members WHERE room_id = mp_room_members.room_id AND user_id = auth.uid()));

-- Members can read moves for their rooms
CREATE POLICY "Moves readable by room members"
    ON mp_moves FOR SELECT
    USING (EXISTS (SELECT 1 FROM mp_room_members WHERE room_id = mp_moves.room_id AND user_id = auth.uid()));

-- We intentionally DO NOT allow direct inserts down to these tables representing game state
-- All game state transitions and memberships funnel via strict RPCs

-- --------------------------------------------------------
-- RPCs
-- --------------------------------------------------------

-- 1. Create a room
CREATE OR REPLACE FUNCTION mp_create_room(
    p_build_id UUID,
    p_max_players INTEGER DEFAULT 4,
    p_license_mode TEXT DEFAULT 'playtest'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
    v_join_code TEXT;
    v_display_name TEXT;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Generate a simple 6 char random hex code
    v_join_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));

    -- Get user display name (mocking generic name if none)
    -- In a real app we'd fetch from profiles
    v_display_name := 'Player_' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 4);

    -- Create room
    INSERT INTO mp_rooms (build_id, host_user_id, join_code, max_players, license_mode)
    VALUES (p_build_id, v_user_id, v_join_code, p_max_players, p_license_mode)
    RETURNING id INTO v_room_id;

    -- Add host as first member
    INSERT INTO mp_room_members (room_id, user_id, display_name, is_host)
    VALUES (v_room_id, v_user_id, v_display_name, true);

    RETURN v_room_id;
END;
$$;

-- 2. Join a room
CREATE OR REPLACE FUNCTION mp_join_room(p_join_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room RECORD;
    v_member_count INTEGER;
    v_display_name TEXT;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Find room
    SELECT * INTO v_room FROM mp_rooms WHERE join_code = UPPER(p_join_code) AND status = 'open';
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found or closed'; END IF;

    -- Check capacity
    SELECT COUNT(*) INTO v_member_count FROM mp_room_members WHERE room_id = v_room.id AND left_at IS NULL;
    IF v_member_count >= v_room.max_players THEN
        RAISE EXCEPTION 'Room is full';
    END IF;

    -- Licensing logic would go here:
    -- IF v_room.license_mode = 'owned_required' THEN ... enforce one-owner logic ...

    -- Check if already joined (reconnect)
    IF EXISTS (SELECT 1 FROM mp_room_members WHERE room_id = v_room.id AND user_id = v_user_id) THEN
        UPDATE mp_room_members SET left_at = NULL WHERE room_id = v_room.id AND user_id = v_user_id;
        RETURN v_room.id;
    END IF;

    v_display_name := 'Player_' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 4);

    -- Insert new member
    INSERT INTO mp_room_members (room_id, user_id, display_name)
    VALUES (v_room.id, v_user_id, v_display_name);

    RETURN v_room.id;
END;
$$;

-- 3. Append Move
CREATE OR REPLACE FUNCTION mp_append_move(p_room_id UUID, p_move JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_seq INTEGER;
    v_room_status TEXT;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Verify room exists and is not closed
    SELECT status INTO v_room_status FROM mp_rooms WHERE id = p_room_id;
    IF v_room_status = 'closed' THEN RAISE EXCEPTION 'Room is closed'; END IF;

    -- Verify membership
    IF NOT EXISTS (SELECT 1 FROM mp_room_members WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL) THEN
        RAISE EXCEPTION 'User is not an active member of this room';
    END IF;

    -- Append
    INSERT INTO mp_moves (room_id, user_id, move)
    VALUES (p_room_id, v_user_id, p_move)
    RETURNING seq INTO v_seq;

    -- Update room activity
    UPDATE mp_rooms SET last_activity_at = NOW() WHERE id = p_room_id;

    RETURN v_seq;
END;
$$;
