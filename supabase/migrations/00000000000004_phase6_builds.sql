-- Published Builds
CREATE TABLE project_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    r2_prefix TEXT NOT NULL,
    notes TEXT,
    is_release_candidate BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE project_builds ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Builds readable by all authenticated users"
    ON project_builds FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert their own builds via the EDGE function
-- We will enforce the edge constraints via SERVICE_ROLE, but we can write a safety fallback here:
CREATE POLICY "Users can insert builds for their projects"
    ON project_builds FOR INSERT
    WITH CHECK (auth.uid() = created_by);
