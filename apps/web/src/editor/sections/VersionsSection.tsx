import { GitBranch, Leaf, Plus, RotateCcw } from 'lucide-react';

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
  const rowHeight = 136;
  const colWidth = 154;
  const nodeWidth = 118;
  const nodeHeight = 86;
  const topPadding = 54;
  const leftPadding = 180;
  const branchRows = Math.max(branches.length, 1);
  const longestBranch = Math.max(1, ...branches.map((branch) => branch.commits.length));
  const mapWidth = Math.max(660, leftPadding + longestBranch * colWidth + 104);
  const mapHeight = Math.max(390, topPadding + branchRows * rowHeight + 74);

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
    onRestoreCommit(commit.commitSha);
  }

  return (
    <div
      data-layout="versionMapShell"
      /* version map shell owns a pinned header, scrollable grassy map, and pinned footer details */
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
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
        /* header summarizes the selected branch without overlaying the map canvas */
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '1rem 1.05rem 0.78rem',
          borderBottom: '1px solid rgba(15,118,110,0.1)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.64), rgba(255,255,255,0.24))',
          flex: '0 0 auto',
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
        /* scrollable map body gives long branch graphs room without covering footer controls */
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          padding: '1rem',
          scrollbarGutter: 'stable',
        }}
      >
        <div
          data-layout="versionMapCanvas"
          /* relative grassy canvas owns branch paths, commit spaces, and the draggable meeple */
          style={{
            position: 'relative',
            width: mapWidth,
            height: mapHeight,
            borderRadius: '22px',
            border: '1px solid rgba(15,118,110,0.12)',
            overflow: 'hidden',
            background: `
              linear-gradient(90deg, rgba(255,255,255,0.38), transparent 20%, transparent 80%, rgba(255,255,255,0.26)),
              repeating-linear-gradient(95deg, rgba(22,163,74,0.08) 0 2px, transparent 2px 18px),
              radial-gradient(circle at 18% 22%, rgba(220,252,231,0.92), transparent 34%),
              radial-gradient(circle at 82% 66%, rgba(190,242,100,0.32), transparent 32%),
              linear-gradient(180deg, rgba(236,253,245,0.96), rgba(187,247,208,0.88))
            `,
            boxShadow: 'inset 0 18px 60px rgba(6,78,59,0.08)',
          }}
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
                  d={`M ${previous.x + nodeWidth / 2} ${previous.y + nodeHeight / 2} C ${previous.x + 104} ${previous.y + 14}, ${current.x - 2} ${current.y + 76}, ${current.x + nodeWidth / 2} ${current.y + nodeHeight / 2}`}
                  fill="none"
                  stroke="rgba(120,113,108,0.42)"
                  strokeWidth={18}
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
                  d={`M ${parent.x + nodeWidth / 2} ${parent.y + nodeHeight / 2} C ${parent.x + 122} ${parent.y + 98}, ${current.x - 56} ${current.y + 6}, ${current.x + nodeWidth / 2} ${current.y + nodeHeight / 2}`}
                  fill="none"
                  stroke="rgba(124,58,237,0.26)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray="2 18"
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
                left: 150,
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
                data-layout="versionBranchLane"
                /* subtle horizontal lane keeps each branch visually separated on the map */
                style={{
                  position: 'absolute',
                  left: 28,
                  right: 28,
                  top: topPadding + branchIndex * rowHeight + 12,
                  height: 108,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.32), rgba(255,255,255,0.08))',
                  border: '1px solid rgba(15,118,110,0.08)',
                }}
              />
              <div
                data-layout="versionBranchLabel"
                /* branch name tag placed at the start of each branch row */
                style={{
                  position: 'absolute',
                  left: 34,
                  top: topPadding + branchIndex * rowHeight + 33,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  width: 126,
                  minHeight: 38,
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.82)',
                  border: '1px solid rgba(15,118,110,0.12)',
                  color: '#064e3b',
                  padding: '0.38rem 0.6rem',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  boxSizing: 'border-box',
                  boxShadow: '0 8px 20px rgba(6,78,59,0.08)',
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
                      width: nodeWidth,
                      height: nodeHeight,
                      borderRadius: '50% 50% 45% 45%',
                      border: active ? '3px solid rgba(124,58,237,0.78)' : '2px solid rgba(6,95,70,0.18)',
                      background: active
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(237,233,254,0.94))'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(236,253,245,0.84))',
                      boxShadow: active ? '0 16px 30px rgba(76,29,149,0.2), inset 0 -8px 20px rgba(124,58,237,0.08)' : '0 10px 24px rgba(6,78,59,0.12), inset 0 -8px 18px rgba(6,95,70,0.05)',
                      color: '#064e3b',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateRows: '1fr auto',
                      padding: '0.66rem 0.72rem 0.58rem',
                      textAlign: 'center',
                      placeItems: 'center',
                      zIndex: active ? 4 : 3,
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '0.78rem', lineHeight: 1.2, overflow: 'hidden', maxWidth: '100%' }}>
                      {commit.message}
                    </span>
                    <span style={{ color: '#0f766e', fontSize: '0.64rem', display: 'grid', gap: '0.08rem' }}>
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
                left: activePosition.x + nodeWidth / 2,
                top: activePosition.y - 18,
                width: 46,
                height: 46,
                transform: 'translateX(-50%)',
                cursor: 'grab',
                zIndex: 8,
                filter: 'drop-shadow(0 12px 14px rgba(6,78,59,0.3))',
              }}
            />
          ) : null}
        </div>
      </div>

      <div
        data-layout="versionMapFooter"
        /* footer keeps active details and branch actions visible without covering map nodes */
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.78rem 1rem 1rem',
          borderTop: '1px solid rgba(15,118,110,0.1)',
          background: 'rgba(255,255,255,0.44)',
        }}
      >
        {activeCommit ? (
          <div
            data-layout="versionActiveCard"
            /* active details card explains the selected node in the fixed footer */
            style={{
              minWidth: 0,
              display: 'grid',
              gap: '0.18rem',
              color: '#064e3b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 900, minWidth: 0 }}>
              <RotateCcw size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeCommit.message}</span>
            </div>
            <div style={{ color: '#0f766e', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shortSha(activeCommit.commitSha)} · {activeCommit.branchName} · {activeCommit.syncStatus ?? 'local'}
            </div>
          </div>
        ) : (
          <div
            data-layout="versionActiveCardEmpty"
            /* empty footer message appears before the first version exists */
            style={{ color: '#0f766e', fontWeight: 800 }}
          >
            <Leaf size={14} /> No version selected yet
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const branchName = window.prompt('Name this new version branch');
            if (branchName?.trim()) onCreateVersion(branchName);
          }}
          style={{
            flex: '0 0 auto',
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
            boxShadow: '0 12px 24px rgba(6,78,59,0.16)',
          }}
        >
          <Plus size={15} />
          New version
        </button>
      </div>
    </div>
  );
}
