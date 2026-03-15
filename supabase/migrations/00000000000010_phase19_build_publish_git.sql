ALTER TABLE projects
    ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS project_kind TEXT NOT NULL DEFAULT 'engine_first' CHECK (project_kind IN ('engine_first')),
    ADD COLUMN IF NOT EXISTS engine_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS editor_snapshot JSONB;

ALTER TABLE project_builds
    ADD COLUMN IF NOT EXISTS build_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS compatibility_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS project_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS build_kind TEXT NOT NULL DEFAULT 'preview' CHECK (build_kind IN ('preview', 'release')),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS release_title TEXT,
    ADD COLUMN IF NOT EXISTS release_description TEXT;

CREATE TABLE IF NOT EXISTS project_git_commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    message TEXT NOT NULL,
    changed_paths TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    files JSONB NOT NULL DEFAULT '{}'::jsonb,
    project_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, commit_sha)
);

CREATE INDEX IF NOT EXISTS project_git_commits_project_id_created_at_idx
    ON project_git_commits (project_id, created_at DESC);

ALTER TABLE project_git_commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own git commits"
    ON project_git_commits FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM projects
            WHERE projects.id = project_git_commits.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can insert own git commits"
    ON project_git_commits FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (
            SELECT 1
            FROM projects
            WHERE projects.id = project_git_commits.project_id
              AND projects.owner_id = auth.uid()
        )
    );
