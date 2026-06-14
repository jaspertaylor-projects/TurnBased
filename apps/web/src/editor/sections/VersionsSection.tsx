import { Compass, Flag, MapPin, Plus, Scroll } from 'lucide-react';

import type { ProjectGitCommitRecord, ProjectGitStatus, ProjectVersionGraph } from '../git';
import { FantasyMapDecorations } from './versions/MapDecorations';

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

  // Map geometry. Each branch is a trail-lane running left→right; each commit
  // is a location marker the traveler can walk to. Coordinates feed both the
  // node layout and the winding trail paths drawn beneath them.
  const nodePositions = new Map<string, { x: number; y: number }>();
  const rowHeight = 158;
  const colWidth = 178;
  const nodeWidth = 138;
  const nodeHeight = 104;
  const topPadding = 96;
  const leftPadding = 196;
  const branchRows = Math.max(branches.length, 1);
  const longestBranch = Math.max(1, ...branches.map((branch) => branch.commits.length));
  const mapWidth = Math.max(720, leftPadding + longestBranch * colWidth + 120);
  const mapHeight = Math.max(440, topPadding + branchRows * rowHeight + 96);

  branches.forEach((branch, branchIndex) => {
    branch.commits.forEach((commit, commitIndex) => {
      nodePositions.set(commit.commitSha, {
        x: leftPadding + commitIndex * colWidth,
        y: topPadding + branchIndex * rowHeight,
      });
    });
  });

  // The trail walks along the ground at the base of each marker.
  const groundOf = (position: { x: number; y: number }) => ({
    x: position.x + nodeWidth / 2,
    y: position.y + nodeHeight - 14,
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
      /* version map shell owns a pinned banner header, the scrollable fantasy map, and a pinned footer */
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '18px',
        border: '1px solid rgba(101,67,33,0.28)',
        background: `
          radial-gradient(circle at 18% 16%, rgba(214,243,221,0.92), transparent 34%),
          radial-gradient(circle at 80% 30%, rgba(254,243,199,0.55), transparent 30%),
          linear-gradient(180deg, rgba(240,253,244,0.96), rgba(187,247,208,0.74) 52%, rgba(22,101,52,0.24))
        `,
        boxShadow: 'inset 0 0 80px rgba(22,101,52,0.12)',
      }}
    >
      <div
        data-layout="versionMapHeader"
        /* banner header reads like a quest title carved over the map */
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '0.85rem 1.1rem 0.78rem',
          borderBottom: '1px solid rgba(101,67,33,0.18)',
          background: 'linear-gradient(180deg, rgba(255,251,235,0.82), rgba(255,248,225,0.42))',
          flex: '0 0 auto',
        }}
      >
        <div
          data-layout="versionMapTitleBlock"
          /* title block pairs a wax-seal compass mark with the quest line */
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}
        >
          <span
            data-layout="versionMapSeal"
            /* compass wax-seal medallion anchoring the map identity */
            style={{
              width: 34,
              height: 34,
              borderRadius: '999px',
              display: 'grid',
              placeItems: 'center',
              color: '#fdf6e3',
              background: 'radial-gradient(circle at 32% 28%, #b45309, #7c2d12)',
              boxShadow: '0 6px 14px rgba(124,45,18,0.32), inset 0 -3px 6px rgba(0,0,0,0.25)',
              flex: '0 0 auto',
            }}
          >
            <Compass size={18} />
          </span>
          <div style={{ display: 'grid', gap: '0.12rem', minWidth: 0 }}>
            <strong style={{ color: '#5b3a16', fontSize: '1.02rem', letterSpacing: '0.01em' }}>The Version Map</strong>
            <span style={{ color: '#7c5a3a', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.32rem' }}>
              <Flag size={12} /> Trail: {versionGraph.activeBranchName} · Camp {shortSha(versionGraph.activeCommitSha)}
            </span>
          </div>
        </div>
        <div
          data-layout="versionMapStatusPill"
          /* travel-status pill mirrors whether the camp has unsaved footprints */
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.32rem 0.7rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: gitStatus.hasChanges ? '#9a3412' : '#15803d',
            background: gitStatus.hasChanges ? 'rgba(251,191,36,0.22)' : 'rgba(187,247,208,0.6)',
            border: `1px solid ${gitStatus.hasChanges ? 'rgba(180,83,9,0.35)' : 'rgba(21,128,61,0.3)'}`,
          }}
        >
          <MapPin size={13} />
          {gitStatus.hasChanges
            ? `${gitStatus.changedPaths.length || 1} unsaved step${gitStatus.changedPaths.length === 1 ? '' : 's'}`
            : 'Camp secured'}
        </div>
      </div>

      <div
        data-layout="versionMapScroll"
        /* scrollable map body gives long branching trails room without covering footer controls */
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
          /* aged-parchment meadow canvas owns terrain, winding trails, location markers, and the meeple */
          style={{
            position: 'relative',
            width: mapWidth,
            height: mapHeight,
            borderRadius: '22px',
            border: '2px solid rgba(120,80,40,0.4)',
            overflow: 'hidden',
            background: `
              radial-gradient(circle at 16% 20%, rgba(220,252,231,0.95), transparent 36%),
              radial-gradient(circle at 84% 70%, rgba(190,242,100,0.3), transparent 34%),
              radial-gradient(circle at 50% 0%, rgba(186,230,253,0.5), transparent 30%),
              linear-gradient(180deg, rgba(236,253,245,0.96), rgba(190,227,176,0.92) 60%, rgba(150,196,140,0.92))
            `,
            boxShadow: 'inset 0 0 0 6px rgba(255,251,235,0.5), inset 0 18px 60px rgba(6,78,59,0.1)',
          }}
        >
          {/* decorative terrain layer sits behind every trail and marker */}
          <FantasyMapDecorations width={mapWidth} height={mapHeight} />

          <svg
            aria-hidden="true"
            width={mapWidth}
            height={mapHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {/* winding dirt trails connecting consecutive camps on each branch */}
            {branches.map((branch) => branch.commits.map((commit, index) => {
              if (index === 0) return null;
              const current = nodePositions.get(commit.commitSha);
              const previous = nodePositions.get(branch.commits[index - 1].commitSha);
              if (!current || !previous) return null;
              const from = groundOf(previous);
              const to = groundOf(current);
              const midX = (from.x + to.x) / 2;
              const d = `M ${from.x} ${from.y} C ${midX} ${from.y - 26}, ${midX} ${to.y + 26}, ${to.x} ${to.y}`;
              return (
                <g key={`${branch.branchName}-${commit.commitSha}`}>
                  <path d={d} fill="none" stroke="rgba(90,58,22,0.4)" strokeWidth={20} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#cba77b" strokeWidth={15} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="rgba(247,231,201,0.95)" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 16" />
                </g>
              );
            }))}

            {/* a forked side-trail where a new version branches off its parent camp */}
            {branches.flatMap((branch) => branch.commits.map((commit) => {
              if (!commit.parentCommitSha) return null;
              const parent = nodePositions.get(commit.parentCommitSha);
              const current = nodePositions.get(commit.commitSha);
              if (!parent || !current || Math.abs(parent.y - current.y) < 2) return null;
              const from = groundOf(parent);
              const to = groundOf(current);
              const d = `M ${from.x} ${from.y} C ${from.x + 96} ${from.y + 40}, ${to.x - 72} ${to.y - 30}, ${to.x} ${to.y}`;
              return (
                <g key={`fork-${commit.commitSha}`}>
                  <path d={d} fill="none" stroke="rgba(90,58,22,0.28)" strokeWidth={13} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#d8bd92" strokeWidth={8} strokeLinecap="round" strokeDasharray="14 12" />
                </g>
              );
            }))}
          </svg>

          {branches.length === 0 ? (
            <div
              data-layout="versionMapEmpty"
              /* themed empty state invites the user to set their first camp */
              style={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(440px, 70%)',
                borderRadius: '18px',
                border: '1px dashed rgba(120,80,40,0.4)',
                background: 'rgba(255,251,235,0.82)',
                padding: '1.1rem 1.2rem',
                color: '#7c5a3a',
                textAlign: 'center',
                display: 'grid',
                gap: '0.4rem',
                placeItems: 'center',
                boxShadow: '0 14px 30px rgba(92,58,22,0.14)',
              }}
            >
              <Scroll size={26} color="#b45309" />
              <strong style={{ color: '#5b3a16' }}>No trail blazed yet</strong>
              <span style={{ fontSize: '0.84rem' }}>
                Tap the save icon beside the project name to plant your first camp on the map.
              </span>
            </div>
          ) : null}

          {branches.map((branch, branchIndex) => (
            <div key={branch.branchName}>
              <div
                data-layout="versionBranchSignpost"
                /* wooden signpost names each trail at its trailhead */
                style={{
                  position: 'absolute',
                  left: 30,
                  top: topPadding + branchIndex * rowHeight + nodeHeight / 2 - 22,
                  width: 138,
                  display: 'grid',
                  gap: '0.3rem',
                  justifyItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    minHeight: 38,
                    borderRadius: '10px',
                    background: 'linear-gradient(180deg, #c89b63, #a9743f)',
                    border: '2px solid #7c4a1e',
                    color: '#3f2410',
                    padding: '0.34rem 0.55rem',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    textAlign: 'center',
                    boxShadow: '0 8px 18px rgba(92,58,22,0.24), inset 0 2px 3px rgba(255,255,255,0.32)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <Flag size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.branchName}</span>
                </div>
                <div style={{ width: 8, height: 22, background: 'linear-gradient(180deg, #7c4a1e, #5b3411)', borderRadius: '0 0 3px 3px' }} />
              </div>

              {branch.commits.map((commit, commitIndex) => {
                const position = nodePositions.get(commit.commitSha);
                if (!position) return null;
                const active = commit.commitSha === versionGraph.activeCommitSha;
                return (
                  <button
                    key={commit.commitSha}
                    type="button"
                    data-layout="versionCampMarker"
                    /* droppable camp marker: dropping the meeple here travels to (restores) this version */
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(commit)}
                    onClick={() => handleDrop(commit)}
                    title={`Travel to ${commit.message}`}
                    style={{
                      position: 'absolute',
                      left: position.x,
                      top: position.y,
                      width: nodeWidth,
                      height: nodeHeight,
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateRows: 'auto 1fr',
                      placeItems: 'center',
                      zIndex: active ? 5 : 3,
                    }}
                  >
                    {/* mossy mound the camp sits on */}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        width: nodeWidth * 0.74,
                        height: 26,
                        borderRadius: '50%',
                        background: active
                          ? 'radial-gradient(circle, rgba(250,204,21,0.55), rgba(132,204,168,0.25) 70%, transparent)'
                          : 'radial-gradient(circle, rgba(74,163,107,0.4), transparent 72%)',
                      }}
                    />
                    {/* numbered map-pin medallion */}
                    <span
                      style={{
                        gridRow: 1,
                        width: 38,
                        height: 38,
                        borderRadius: '50% 50% 50% 0',
                        transform: 'rotate(-45deg)',
                        display: 'grid',
                        placeItems: 'center',
                        background: active
                          ? 'radial-gradient(circle at 34% 30%, #fde68a, #d97706)'
                          : 'radial-gradient(circle at 34% 30%, #fefce8, #65a30d)',
                        border: `2px solid ${active ? '#b45309' : '#3f6212'}`,
                        boxShadow: active
                          ? '0 12px 22px rgba(180,83,9,0.34)'
                          : '0 8px 16px rgba(6,78,59,0.22)',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <span style={{ transform: 'rotate(45deg)', fontWeight: 900, fontSize: '0.8rem', color: active ? '#7c2d12' : '#1a2e05' }}>
                        {commit.versionNumber ?? commitIndex + 1}
                      </span>
                    </span>
                    {/* parchment name plaque */}
                    <span
                      style={{
                        gridRow: 2,
                        width: '100%',
                        borderRadius: '12px',
                        border: `1.5px solid ${active ? 'rgba(180,83,9,0.55)' : 'rgba(101,67,33,0.32)'}`,
                        background: active
                          ? 'linear-gradient(180deg, rgba(255,251,235,0.98), rgba(254,243,199,0.96))'
                          : 'linear-gradient(180deg, rgba(255,253,247,0.96), rgba(243,238,224,0.94))',
                        color: '#5b3a16',
                        padding: '0.34rem 0.4rem 0.4rem',
                        display: 'grid',
                        gap: '0.1rem',
                        textAlign: 'center',
                        boxShadow: active ? '0 12px 24px rgba(180,83,9,0.2)' : '0 8px 18px rgba(92,58,22,0.14)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span style={{ fontWeight: 900, fontSize: '0.76rem', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commit.message}
                      </span>
                      <span style={{ color: '#92744a', fontSize: '0.62rem', lineHeight: 1.2 }}>
                        {shortSha(commit.commitSha)} · {formatDate(commit.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {activePosition ? (
            <div
              data-layout="versionMeepleStand"
              /* the meeple stands atop the active camp and can be dragged to travel */
              style={{
                position: 'absolute',
                left: activePosition.x + nodeWidth / 2,
                top: activePosition.y - 40,
                transform: 'translateX(-50%)',
                display: 'grid',
                justifyItems: 'center',
                zIndex: 9,
                pointerEvents: 'none',
              }}
            >
              <img
                src="/favicon.png"
                alt="Current version meeple"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', versionGraph.activeCommitSha ?? '')}
                style={{
                  width: 50,
                  height: 50,
                  cursor: 'grab',
                  pointerEvents: 'auto',
                  filter: 'drop-shadow(0 12px 12px rgba(6,78,59,0.35))',
                }}
              />
              <span
                /* soft ground shadow grounding the traveler on the camp */
                style={{
                  width: 30,
                  height: 9,
                  marginTop: -4,
                  borderRadius: '50%',
                  background: 'rgba(6,78,59,0.28)',
                  filter: 'blur(1px)',
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div
        data-layout="versionMapFooter"
        /* footer keeps the current camp details and the new-trail action pinned to the viewport */
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.78rem 1.1rem 1rem',
          borderTop: '1px solid rgba(101,67,33,0.18)',
          background: 'linear-gradient(180deg, rgba(255,251,235,0.5), rgba(255,248,225,0.36))',
        }}
      >
        {activeCommit ? (
          <div
            data-layout="versionActiveCamp"
            /* current-camp summary explains where the traveler is standing */
            style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#5b3a16' }}
          >
            <MapPin size={16} color="#b45309" />
            <div style={{ minWidth: 0, display: 'grid', gap: '0.12rem' }}>
              <span style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeCommit.message}
              </span>
              <span style={{ color: '#92744a', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortSha(activeCommit.commitSha)} · {activeCommit.branchName} · {activeCommit.syncStatus ?? 'local'}
              </span>
            </div>
          </div>
        ) : (
          <div
            data-layout="versionActiveCampEmpty"
            /* empty footer message appears before the first camp exists */
            style={{ color: '#7c5a3a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Scroll size={15} /> No camp set yet
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const branchName = window.prompt('Name this new trail (version branch)');
            if (branchName?.trim()) onCreateVersion(branchName);
          }}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.42rem',
            borderRadius: '999px',
            border: '1px solid rgba(124,45,18,0.3)',
            background: 'linear-gradient(135deg, #b45309, #7c2d12)',
            color: '#fdf6e3',
            padding: '0.6rem 1rem',
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 12px 24px rgba(124,45,18,0.24)',
          }}
        >
          <Plus size={15} />
          Blaze new trail
        </button>
      </div>
    </div>
  );
}
