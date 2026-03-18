import { inputStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { ProjectGitCommitRecord, ProjectGitStatus } from '../git';

export function VersionsSection({
  gitStatus,
  gitHistory,
  commitMessage,
  onCommitMessageChange,
  onCreateCommit,
  onRestoreCommit,
}: {
  gitStatus: ProjectGitStatus;
  gitHistory: ProjectGitCommitRecord[];
  commitMessage: string;
  onCommitMessageChange: (value: string) => void;
  onCreateCommit: () => void;
  onRestoreCommit: (commitSha: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={panelStyle}>
        <p style={sectionTitleStyle}>Workspace Status</p>
        <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
          Head commit: {gitStatus.headCommitSha ?? 'No commits yet'}
          <br />
          Tracked files: {gitStatus.trackedPaths.length}
          <br />
          Changed paths: {gitStatus.changedPaths.length}
        </div>

        <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginTop: '0.8rem' }}>
          Commit message
          <input
            value={commitMessage}
            onChange={(event) => onCommitMessageChange(event.target.value)}
            style={inputStyle}
          />
        </label>

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            onClick={onCreateCommit}
            style={{ borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', padding: '0.6rem 0.95rem' }}
          >
            Commit Workspace
          </button>
        </div>

        <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.45rem' }}>
          {gitStatus.changedPaths.length === 0 ? (
            <p style={{ margin: 0, color: '#0f766e' }}>Workspace matches the latest commit.</p>
          ) : (
            gitStatus.changedPaths.map((path) => (
              <div key={path} style={{ padding: '0.55rem 0.7rem', borderRadius: '12px', background: 'rgba(239,246,255,0.92)', color: '#155e75', fontSize: '0.82rem' }}>
                {path}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={panelStyle}>
        <p style={sectionTitleStyle}>History</p>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {gitHistory.length === 0 ? (
            <p style={{ margin: 0, color: '#0f766e' }}>Create a commit to start version history.</p>
          ) : (
            gitHistory.slice(0, 8).map((commit) => (
              <div key={commit.id} style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                  <strong style={{ color: '#064e3b' }}>{commit.message}</strong>
                  <span style={{ color: '#155e75', fontSize: '0.78rem' }}>{commit.commitSha}</span>
                </div>
                <div style={{ marginTop: '0.3rem', color: '#0f766e', fontSize: '0.82rem' }}>
                  {new Date(commit.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: '0.35rem', color: '#155e75', fontSize: '0.8rem' }}>
                  {commit.changedPaths.join(', ')}
                </div>
                <button
                  onClick={() => onRestoreCommit(commit.commitSha)}
                  style={{ marginTop: '0.65rem', borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.45rem 0.8rem', color: '#064e3b' }}
                >
                  Restore This Version
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
