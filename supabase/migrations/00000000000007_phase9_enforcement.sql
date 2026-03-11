-- 1. Redefine mp_join_room to enforce entitlements
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
    v_has_entitlement BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Find room
    SELECT * INTO v_room FROM mp_rooms WHERE join_code = UPPER(p_join_code) AND status = 'open';
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found or closed'; END IF;

    -- Check if already joined (reconnect) -> Allows bypass of capacity if they are just re-entering
    IF EXISTS (SELECT 1 FROM mp_room_members WHERE room_id = v_room.id AND user_id = v_user_id) THEN
        UPDATE mp_room_members SET left_at = NULL WHERE room_id = v_room.id AND user_id = v_user_id;
        RETURN v_room.id;
    END IF;

    -- Check capacity for new joins
    SELECT COUNT(*) INTO v_member_count FROM mp_room_members WHERE room_id = v_room.id AND left_at IS NULL;
    IF v_member_count >= v_room.max_players THEN
        RAISE EXCEPTION 'Room is full';
    END IF;

    -- Licensing logic: "One friend owns"
    IF v_room.license_mode = 'owned_required' THEN
        IF v_room.listing_id IS NULL THEN
             -- If the room requires ownership but no listing is attached, this is a dev error/malformed room.
             -- In a real app we might fallback to host's project ownership, but for MVP strictness:
             RAISE EXCEPTION 'Cannot verify ownership: No listing attached to room';
        END IF;

        -- 1. Check if joining user owns it
        SELECT EXISTS (
             SELECT 1 FROM entitlements 
             WHERE buyer_id = v_user_id AND listing_id = v_room.listing_id
        ) INTO v_has_entitlement;

        -- 2. If joining user doesn't own it, check if ANY active member owns it
        IF NOT v_has_entitlement THEN
             SELECT EXISTS (
                  SELECT 1 FROM mp_room_members m
                  JOIN entitlements e ON m.user_id = e.buyer_id
                  WHERE m.room_id = v_room.id 
                    AND m.left_at IS NULL
                    AND e.listing_id = v_room.listing_id
             ) INTO v_has_entitlement;
             
             IF NOT v_has_entitlement THEN
                  RAISE EXCEPTION 'Requires game ownership! At least one active player must own this game.';
             END IF;
        END IF;
    END IF;

    v_display_name := 'Player_' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 4);

    -- Insert new member
    INSERT INTO mp_room_members (room_id, user_id, display_name)
    VALUES (v_room.id, v_user_id, v_display_name);

    RETURN v_room.id;
END;
$$;
