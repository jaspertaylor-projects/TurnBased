-- Assets Table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'other')),
    r2_key TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    mime TEXT,
    metadata JSONB,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own assets"
    ON assets FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Public assets are viewable by all"
    ON assets FOR SELECT
    USING (visibility = 'public');

CREATE POLICY "Users can insert own assets"
    ON assets FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- RPC to accurately enforce storage capacity checking during uploads
CREATE OR REPLACE FUNCTION increment_storage_usage(amount_bytes BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    current_storage BIGINT;
    is_pro BOOLEAN;
BEGIN
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT art_bytes_used, tier = 'pro'
    INTO current_storage, is_pro
    FROM profiles WHERE id = user_id;

    -- Enforce limits (e.g., 1GB free (1073741824 bytes), 10GB pro)
    IF (NOT is_pro AND (current_storage + amount_bytes) > 1073741824) OR 
       (is_pro AND (current_storage + amount_bytes) > 10737418240) THEN
        RETURN FALSE; 
    END IF;

    -- Update total
    UPDATE profiles SET art_bytes_used = art_bytes_used + amount_bytes WHERE id = user_id;
    RETURN TRUE;
END;
$$;
