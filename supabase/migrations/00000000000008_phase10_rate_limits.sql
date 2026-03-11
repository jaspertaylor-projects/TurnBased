-- Rate Limiting Tracker
CREATE TABLE user_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_move_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    move_count_burst INTEGER NOT NULL DEFAULT 0
);

-- Note: We are doing a very primitive rate limit check inline within the `mp_append_move` RPC to save costs on edge function routing.

CREATE OR REPLACE FUNCTION mp_append_move(p_room_id UUID, p_move JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_seq INTEGER;
    v_room_status TEXT;
    
    -- Rate limit config
    v_max_burst INTEGER := 10;
    v_burst_window INTERVAL := '1 second';
    
    -- Tracker vars
    v_limit_record RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Optional: Enforce payload size limit natively in Postgres to prevent massive JSON injection
    -- Using a heuristic length of the text representation. ~200KB limit for board game moves.
    IF length(p_move::text) > 200000 THEN
        RAISE EXCEPTION 'Payload size limit exceeded (200KB max)';
    END IF;

    -- Rate Limit Check Start
    SELECT * INTO v_limit_record FROM user_rate_limits WHERE user_id = v_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO user_rate_limits (user_id, last_move_at, move_count_burst) 
        VALUES (v_user_id, v_now, 1);
    ELSE
        -- If outside the burst window, reset the counter
        IF v_now - v_limit_record.last_move_at > v_burst_window THEN
            UPDATE user_rate_limits 
            SET last_move_at = v_now, move_count_burst = 1 
            WHERE user_id = v_user_id;
        ELSE
            -- Inside window, check limit
            IF v_limit_record.move_count_burst >= v_max_burst THEN
                RAISE EXCEPTION 'Rate limit exceeded: Too many moves in a short duration';
            ELSE
                UPDATE user_rate_limits 
                SET last_move_at = v_now, move_count_burst = move_count_burst + 1 
                WHERE user_id = v_user_id;
            END IF;
        END IF;
    END IF;
    -- Rate Limit Check End

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
    UPDATE mp_rooms SET last_activity_at = v_now WHERE id = p_room_id;

    RETURN v_seq;
END;
$$;
