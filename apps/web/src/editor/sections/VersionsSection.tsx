import { GitBranch, Plus, RotateCcw } from 'lucide-react';

import type { ProjectGitCommitRecord, ProjectGitStatus, ProjectVersionGraph } from '../git';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function groupCommitsByBranch(commits: ProjectGitCommitRecord[]): Array<{ branchName: string; commits: ProjectGitCommitRecord[] }> {
  const groups = new Map<string, ProjectGitCommitRecord[]>();
  commits.forEach((commit) => {
    const branchName = commit.branchName ?? 'initial musings';
    groups.set(branchName, [...(groups.get(branchName) ?? []), commit]);
  });

  return Array.from(groups.entries())
    .map(([branchName, branchCommits]) => ({
      branchName,
      commits: [...branchCommits].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => {
      const leftFirst = left.commits[0]?.createdAt ?? '';
      const rightFirst = right.commits[0]?.createdAt ?? '';
      return leftFirst.localeCompare(rightFirst) || left.branchName.localeCompare(right.branchName);
    });
}

function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 8) : 'no commit';
}

export function VersionsSection({
  gitStatus,
  versionGraph,
  onCreateVersion,
  onRestoreCommit,
}: {
  gitStatus: ProjectGitStatus;
  versionGraph: ProjectVersionGraph;
  onCreateVersion: (branchName: string) => void;
  onRestoreCommit: (commitSha: string) => void;
}) {
  const branches = groupCommitsByBranch(versionGraph.commits);
  const nodePositions = new Map<string, { x: number; y: number }>();
  const rowHeight = 132;
  const colWidth = 178;
  const topPadding = 72;
  const leftPadding = 86;
  const branchRows = Math.max(branches.length, 1);
  const longestBranch = Math.max(1, ...branches.map((branch) => branch.commits.length));
  const mapWidth = Math.max(760, leftPadding + longestBranch * colWidth + 170);
  const mapHeight = Math.max(410, topPadding + branchRows * rowHeight + 90);

  branches.forEach((branch, branchIndex) => {
    branch.commits.forEach((commit, commitIndex) => {
      nodePositions.set(commit.commitSha, {
        x: leftPadding + commitIndex * colWidth,
        y: topPadding + branchIndex * rowHeight,
      });
    });
  });

  const activeCommit = versionGraph.commits.find((commit) => commit.commitSha === versionGraph.activeCommitSha) ?? versionGraph.commits[0] ?? null;
  const activePosition = activeCommit ? nodePositions.get(activeCommit.commitSha) : null;

  function handleDrop(commit: ProjectGitCommitRecord) {
    if (commit.commitSha === versionGraph.activeCommitSha) return;
    const ok = window.confirm(`Restore "${commit.message}"? Your current workspace will switch to that version.`);
    if (ok) {
      onRestoreCommit(commit.commitSha);
    }
  }

  return (
    <div
      data-layout="versionMapShell"
      /* fills the Versions viewport with a fantasy grass map instead of a document-style history list */
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: '18px',
        border: '1px solid rgba(15,118,110,0.14)',
        background: `
          radial-gradient(circle at 20% 18%, rgba(187,247,208,0.9), transparent 30%),
          radial-gradient(circle at 76% 28%, rgba(254,240,138,0.52), transparent 28%),
          linear-gradient(180deg, rgba(240,253,244,0.96), rgba(187,247,208,0.76) 54%, rgba(22,101,52,0.24))
        `,
        boxShadow: 'inset 0 0 80px rgba(22,101,52,0.12)',
      }}
    >
      <div
        data-layout="versionMapHeader"
        /* top-left status strip summarizes the selected branch and workspace dirtiness */
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <strong style={{ color: '#064e3b', fontSize: '1rem' }}>Version map</strong>
          <span style={{ color: '#0f766e', fontSize: '0.82rem' }}>
            Active branch: {versionGraph.activeBranchName} · Head {shortSha(versionGraph.activeCommitSha)}
          </span>
        </div>
        <div style={{ color: gitStatus.hasChanges ? '#92400e' : '#0f766e', fontWeight: 800, fontSize: '0.82rem' }}>
          {gitStatus.hasChanges ? `${gitStatus.changedPaths.length || 1} unsaved change${gitStatus.changedPaths.length === 1 ? '' : 's'}` : 'Workspace saved'}
        </div>
      </div>

      <div
        data-layout="versionMapScroll"
        /* scrollable map canvas; commit nodes are positioned inside this large fantasy board */
        style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingTop: '58px' }}
      >
        <div
          data-layout="versionMapCanvas"
          /* relative canvas that owns SVG branch paths, commit spaces, and the draggable meeple */
          style={{ position: 'relative', width: mapWidth, height: mapHeight }}
        >
          <svg
            aria-hidden="true"
            width={mapWidth}
            height={mapHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {branches.map((branch) => branch.commits.map((commit, index) => {
              if (index === 0) return null;
              const current = nodePositions.get(commit.commitSha);
              const previous = nodePositions.get(branch.commits[index - 1].commitSha);
              if (!current || !previous) return null;
              return (
                <path
                  key={`${branch.branchName}-${commit.commitSha}`}
                  d={`M ${previous.x + 52} ${previous.y + 52} C ${previous.x + 95} ${previous.y + 12}, ${current.x + 8} ${current.y + 92}, ${current.x + 52} ${current.y + 52}`}
                  fill="none"
                  stroke="rgba(6,78,59,0.36)"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
              );
            }))}
            {branches.flatMap((branch) => branch.commits.map((commit) => {
              if (!commit.parentCommitSha) return null;
              const parent = nodePositions.get(commit.parentCommitSha);
              const current = nodePositions.get(commit.commitSha);
              if (!parent || !current || Math.abs(parent.y - current.y) < 2) return null;
              return (
                <path
                  key={`fork-${commit.commitSha}`}
                  d={`M ${parent.x + 52} ${parent.y + 52} C ${parent.x + 110} ${parent.y + 92}, ${current.x - 48} ${current.y + 12}, ${current.x + 52} ${current.y + 52}`}
                  fill="none"
                  stroke="rgba(124,58,237,0.28)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray="10 10"
                />
              );
            }))}
          </svg>

          {branches.length === 0 ? (
            <div
              data-layout="versionMapEmpty"
              /* centered empty state invites the user to save their first checkpoint */
              style={{
                position: 'absolute',
                top: 128,
                left: 96,
                width: 420,
                borderRadius: '18px',
                border: '1px dashed rgba(15,118,110,0.24)',
                background: 'rgba(255,255,255,0.68)',
                padding: '1rem',
                color: '#0f766e',
              }}
            >
              Use the save icon by the project name to plant the first version space.
            </div>
          ) : null}

          {branches.map((branch, branchIndex) => (
            <div key={branch.branchName}>
              <div
                data-layout="versionBranchLabel"
                /* branch name tag placed at the start of each branch row */
                style={{
                  position: 'absolute',
                  left: 20,
                  top: topPadding + branchIndex * rowHeight + 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.72)',
                  color: '#064e3b',
                  padding: '0.32rem 0.55rem',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  maxWidth: 210,
                }}
              >
                <GitBranch size={13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.branchName}</span>
              </div>

              {branch.commits.map((commit) => {
                const position = nodePositions.get(commit.commitSha);
                if (!position) return null;
                const active = commit.commitSha === versionGraph.activeCommitSha;
                return (
                  <button
                    key={commit.commitSha}
                    type="button"
                    data-layout="versionCommitSpace"
                    /* droppable commit space: dropping the meeple here restores this version */
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(commit)}
                    onClick={() => handleDrop(commit)}
                    style={{
                      position: 'absolute',
                      left: position.x,
                      top: position.y,
                      width: 116,
                      height: 88,
                      borderRadius: '22px',
                      border: active ? '3px solid rgba(124,58,237,0.75)' : '2px solid rgba(15,118,110,0.2)',
                      background: active ? 'rgba(245,243,255,0.9)' : 'rgba(255,255,255,0.72)',
                      boxShadow: active ? '0 12px 28px rgba(76,29,149,0.18)' : '0 8px 20px rgba(6,78,59,0.12)',
                      color: '#064e3b',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateRows: '1fr auto',
                      padding: '0.55rem',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '0.78rem', lineHeight: 1.2, overflow: 'hidden' }}>
                      {commit.message}
                    </span>
                    <span style={{ color: '#0f766e', fontSize: '0.66rem', display: 'grid', gap: '0.1rem' }}>
                      <span>{shortSha(commit.commitSha)}</span>
                      <span>{formatDate(commit.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {activePosition ? (
            <img
              data-layout="versionMeeple"
              /* draggable favicon meeple marks the currently selected version node */
              src="/favicon.png"
              alt="Current version meeple"
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', versionGraph.activeCommitSha ?? '')}
              style={{
                position: 'absolute',
                left: activePosition.x + 78,
                top: activePosition.y - 24,
                width: 44,
                height: 44,
                cursor: 'grab',
                zIndex: 5,
                filter: 'drop-shadow(0 10px 12px rgba(6,78,59,0.25))',
              }}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          const branchName = window.prompt('Name this new version branch');
          if (branchName?.trim()) onCreateVersion(branchName);
        }}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          zIndex: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.42rem',
          borderRadius: '999px',
          border: 'none',
          background: 'linear-gradient(135deg, #064e3b, #0d9488)',
          color: 'white',
          padding: '0.65rem 0.95rem',
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: '0 14px 30px rgba(6,78,59,0.18)',
        }}
      >
        <Plus size={15} />
        New version
      </button>

      {activeCommit ? (
        <div
          data-layout="versionActiveCard"
          /* compact card in the lower-left gives details for the meeple's current node */
          style={{
            position: 'absolute',
            left: 18,
            bottom: 18,
            zIndex: 6,
            maxWidth: 360,
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(15,118,110,0.14)',
            padding: '0.75rem 0.85rem',
            color: '#064e3b',
            boxShadow: '0 12px 32px rgba(6,78,59,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 900 }}>
            <RotateCcw size={14} />
            {activeCommit.message}
          </div>
          <div style={{ color: '#0f766e', fontSize: '0.78rem', marginTop: '0.2rem' }}>
            {shortSha(activeCommit.commitSha)} · {activeCommit.branchName} · {activeCommit.syncStatus ?? 'local'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
