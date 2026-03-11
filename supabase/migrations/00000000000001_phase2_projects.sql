-- Project Templates Table
CREATE TABLE project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    git_template_repo TEXT NOT NULL, -- e.g., 'templates/turnbased-starter'
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_id UUID NOT NULL REFERENCES project_templates(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Repositories Table (maps project to its created git repo)
CREATE TABLE project_repos (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    git_repo_ref TEXT NOT NULL, -- e.g., 'user123/my-game'
    is_private BOOLEAN NOT NULL DEFAULT true,
    default_branch TEXT NOT NULL DEFAULT 'main'
);

-- Enable RLS
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_repos ENABLE ROW LEVEL SECURITY;

-- Policies: Templates are readable by all authenticated users
CREATE POLICY "Templates are readable by authenticated users"
    ON project_templates FOR SELECT
    TO authenticated
    USING (enabled = true);

-- Policies: Projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Policies: Project Repos
CREATE POLICY "Users can view own project repos"
    ON project_repos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_repos.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own project repos"
    ON project_repos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_repos.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Insert a mock template for testing
INSERT INTO project_templates (name, description, git_template_repo)
VALUES ('Basic Board Game Starter', 'A simple starter template for turn-based games', 'turnbased-templates/starter');
