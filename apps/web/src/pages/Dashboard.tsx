import { useState } from 'react';

import { getProjectModeLabel, getProjectModeSupportSummary } from '../editor/capabilities';
import { listProjectGitCommits } from '../editor/git';
import { getLatestBuild } from '../editor/shipping';
import { deleteEditorProject, loadEditorProjects } from '../editor/storage';
import type { EditorProject } from '../editor/types';

export const Dashboard = () => {
  const [projects, setProjects] = useState<EditorProject[]>(() => loadEditorProjects());

  function handleDelete(projectId: string) {
    deleteEditorProject(projectId);
    setProjects(loadEditorProjects());
  }

  function getProjectSummary(project: EditorProject) {
    const support = getProjectModeSupportSummary(project);
    return {
      modeLabel: getProjectModeLabel(project.manifest.capabilities.mode),
      marketplaceEligible: support.marketplaceEligible,
      latestPreview: getLatestBuild(project.id, 'preview'),
      latestRelease: getLatestBuild(project.id, 'release'),
      commitCount: listProjectGitCommits(project.id).length,
    };
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.45rem' }}>
            Creator Dashboard
          </p>
          <h1 style={{ marginBottom: '0.35rem' }}>My Prototypes</h1>
          <p style={{ margin: 0, color: '#0f766e' }}>
            AI-built workspaces, live preview, and version history with optional Supabase backup.
          </p>
        </div>
        <a
          href="#/new"
          style={{
            padding: '0.8rem 1rem',
            background: 'linear-gradient(135deg, #064e3b, #10b981)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '999px',
            boxShadow: '0 16px 32px rgba(6,78,59,0.16)',
          }}
        >
          + New AI Project
        </a>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {projects.length === 0 ? (
          <div style={{ padding: '1.4rem', borderRadius: '20px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(16,185,129,0.14)' }}>
            <p style={{ color: '#0f766e', margin: 0 }}>
              No projects yet. Start with the lightweight setup form and let AI generate the first linked multi-view workspace.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {projects.map((project) => (
              (() => {
                const summary = getProjectSummary(project);

                return (
                  <div
                    key={project.id}
                    style={{
                      padding: '1.15rem',
                      border: '1px solid rgba(16,185,129,0.14)',
                      borderRadius: '22px',
                      background: 'rgba(255,255,255,0.86)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: '240px', flex: '1 1 320px' }}>
                      <h3 style={{ marginBottom: '0.35rem' }}>{project.name}</h3>
                      <div style={{ color: '#0f766e', fontSize: '0.9rem', marginBottom: '0.35rem' }}>{project.description}</div>
                      <div style={{ color: '#155e75', fontSize: '0.8rem' }}>
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: project.phase === 'ready' ? 'rgba(240,253,244,0.9)' : project.phase === 'building' ? 'rgba(254,249,195,0.9)' : 'rgba(239,246,255,0.92)', color: project.phase === 'ready' ? '#065f46' : project.phase === 'building' ? '#854d0e' : '#155e75', fontSize: '0.78rem' }}>
                          {project.phase === 'ready' ? 'Generated workspace' : project.phase === 'building' ? 'AI building' : 'Rules brief'}
                        </span>
                        <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: project.manifest.capabilities.mode === 'experimental' ? 'rgba(254,226,226,0.85)' : project.manifest.capabilities.mode === 'advanced' ? 'rgba(254,249,195,0.9)' : 'rgba(240,253,244,0.9)', color: project.manifest.capabilities.mode === 'experimental' ? '#991b1b' : project.manifest.capabilities.mode === 'advanced' ? '#854d0e' : '#065f46', fontSize: '0.78rem' }}>
                          {summary.modeLabel}
                        </span>
                        <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.78rem' }}>
                          {summary.commitCount} commit{summary.commitCount === 1 ? '' : 's'}
                        </span>
                        <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(14,165,233,0.12)', color: '#075985', fontSize: '0.78rem' }}>
                          Preview {summary.latestPreview?.commitSha ?? 'not built'}
                        </span>
                        <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', fontSize: '0.78rem' }}>
                          Release {summary.latestRelease?.commitSha ?? 'not published'}
                        </span>
                        {!summary.marketplaceEligible && (
                          <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(254,226,226,0.85)', color: '#991b1b', fontSize: '0.78rem' }}>
                            Marketplace restricted
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <a
                        href={`#/editor/${project.id}`}
                        style={{
                          padding: '0.75rem 0.95rem',
                          borderRadius: '999px',
                          background: 'rgba(16,185,129,0.12)',
                          color: '#065f46',
                          textDecoration: 'none',
                        }}
                      >
                        Open Editor
                      </a>
                      {summary.latestPreview && (
                        <a
                          href={`#/play/local/${summary.latestPreview.id}`}
                          style={{
                            padding: '0.75rem 0.95rem',
                            borderRadius: '999px',
                            background: 'rgba(14,165,233,0.12)',
                            color: '#075985',
                            textDecoration: 'none',
                          }}
                        >
                          Open Preview
                        </a>
                      )}
                      {summary.latestRelease && (
                        <a
                          href={`#/play/local/${summary.latestRelease.id}`}
                          style={{
                            padding: '0.75rem 0.95rem',
                            borderRadius: '999px',
                            background: 'rgba(59,130,246,0.12)',
                            color: '#1d4ed8',
                            textDecoration: 'none',
                          }}
                        >
                          Open Release
                        </a>
                      )}
                      <a
                        href={`#/lobby?mode=playtest&projectId=${project.id}`}
                        style={{
                          padding: '0.75rem 0.95rem',
                          borderRadius: '999px',
                          background: 'rgba(14,165,233,0.12)',
                          color: '#075985',
                          textDecoration: 'none',
                        }}
                      >
                        Start Playtest Room
                      </a>
                      <button
                        onClick={() => handleDelete(project.id)}
                        style={{
                          padding: '0.75rem 0.95rem',
                          borderRadius: '999px',
                          border: '1px solid rgba(239,68,68,0.18)',
                          background: 'rgba(254,226,226,0.8)',
                          color: '#b91c1c',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
