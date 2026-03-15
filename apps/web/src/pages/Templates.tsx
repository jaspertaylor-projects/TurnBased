import { useState } from 'react';
import type { CSSProperties } from 'react';

import { createBlankProject } from '../editor/project';
import { saveEditorProject } from '../editor/storage';

const cardStyle: CSSProperties = {
  borderRadius: '24px',
  padding: '1.4rem',
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(16,185,129,0.14)',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
};

export const Templates = () => {
  const [projectName, setProjectName] = useState('New Prototype');

  function handleCreateProject() {
    const project = createBlankProject(projectName.trim() || 'New Prototype');
    saveEditorProject(project);
    window.location.hash = `#/editor/${project.id}`;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ maxWidth: '760px' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          Component-First Creation
        </p>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', marginBottom: '0.8rem' }}>
          Start from an empty workspace, not a stale template.
        </h1>
        <p style={{ color: '#0f766e', lineHeight: 1.8, maxWidth: '680px', marginBottom: '1.5rem' }}>
          New projects now open as blank engine-backed prototypes. Add boards, zones, pieces, counters, and rules directly from the built-in component catalog, then preview legal moves and debug overlays in the browser.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 0.9fr)', gap: '1rem', alignItems: 'start' }}>
        <div style={cardStyle}>
          <label style={{ display: 'grid', gap: '0.45rem', color: '#0f766e', fontSize: '0.9rem' }}>
            Project name
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              style={{
                padding: '0.85rem 0.95rem',
                borderRadius: '14px',
                border: '1px solid rgba(15,118,110,0.12)',
                fontSize: '1rem',
              }}
            />
          </label>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {['Board + spaces', 'Zones + reserves', 'Pieces + ownership', 'Rules + preview'].map((step) => (
              <span key={step} style={{ padding: '0.55rem 0.75rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.84rem' }}>
                {step}
              </span>
            ))}
          </div>

          <button
            onClick={handleCreateProject}
            style={{
              marginTop: '1.25rem',
              border: 'none',
              borderRadius: '999px',
              padding: '0.9rem 1.2rem',
              background: 'linear-gradient(135deg, #064e3b, #10b981)',
              color: 'white',
              fontSize: '1rem',
              boxShadow: '0 18px 36px rgba(6,78,59,0.2)',
            }}
          >
            Open Blank Workspace
          </button>
        </div>

        <div style={{ ...cardStyle, background: 'linear-gradient(160deg, rgba(16,185,129,0.12), rgba(250,204,21,0.14))' }}>
          <h3 style={{ marginBottom: '0.8rem' }}>What ships in the workspace</h3>
          <div style={{ display: 'grid', gap: '0.75rem', color: '#065f46' }}>
            <div>Built-in component palette backed by `@turnbased/engine-components` manifests.</div>
            <div>Rules editor for turn structure, scoring target, and designer notes.</div>
            <div>Live preview with legal move highlights from `@turnbased/engine-ui`.</div>
            <div>Grounded AI coaching based on local engine docs and current project context.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
