import { useEffect, useState } from 'react';
import { ArrowDownToLine, GitBranch, History, Map, RotateCcw, Save } from 'lucide-react';
import { loadCommitFiles, type ProjectGitStatus, type ProjectVersionGraph } from '../git';
import { inflateProjectImages } from '../persistence/imageBlobs';
import { PROJECT_JSON_PATH } from '../persistence/paths';
import type { EditorProject } from '../types';
import { compareDesigns, type DesignChange } from '../versions/compare';
import { createDesignArchive } from '../versions/archive';
import { downloadFile, fileStem } from '../exports/download';
import { VersionMap } from './versions/VersionMap';
import './versions/history.css';

export function VersionsSection({ project, gitStatus, versionGraph, busy, onSaveCheckpoint, onCreateVersion, onRestoreCommit }: {
  project: EditorProject;
  gitStatus: ProjectGitStatus;
  versionGraph: ProjectVersionGraph;
  busy: boolean;
  onSaveCheckpoint: (name: string) => Promise<void>;
  onCreateVersion: (branch: string) => Promise<void>;
  onRestoreCommit: (sha: string) => Promise<void>;
}) {
  const [view, setView] = useState<'history' | 'map'>('history');
  const [checkpointName, setCheckpointName] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [changes, setChanges] = useState<DesignChange[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const selected = versionGraph.commits.find((entry) => entry.commitSha === selectedSha) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const read = async (sha: string | null | undefined) => {
      const commit = versionGraph.commits.find((entry) => entry.commitSha === sha);
      if (!commit) return null;
      const files = await loadCommitFiles(commit);
      if (!files[PROJECT_JSON_PATH]) throw new Error('This checkpoint is missing its design snapshot.');
      return inflateProjectImages(JSON.parse(files[PROJECT_JSON_PATH]) as EditorProject);
    };
    (async () => {
      const after = selected ? await read(selected.commitSha) : project;
      const before = await read(selected ? selected.parentCommitSha : versionGraph.activeCommitSha);
      if (!cancelled && after) setChanges(compareDesigns(before, after));
    })().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not compare these versions.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project, selected, versionGraph]);

  async function exportBackup() {
    setExporting(true);
    try { downloadFile(`${fileStem(project.name)}-with-history.json`, await createDesignArchive(project)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not export the backup.'); }
    finally { setExporting(false); }
  }

  return (
    <section className="version-history" aria-label="Version history">
      <header className="history-header">
        <div data-layout="historyIdentity"><span className="history-eyebrow">ROOM TO EXPERIMENT</span><h1>Every idea has a history.</h1><p>Save what works. Try something different. Your old designs stay within reach.</p></div>
        <div data-layout="historyViewActions" className="history-actions">
          <button onClick={() => setView(view === 'history' ? 'map' : 'history')}><Map size={15} />{view === 'history' ? 'Trail map' : 'Checkpoint list'}</button>
          <button onClick={() => { void exportBackup(); }} disabled={exporting}><ArrowDownToLine size={15} />{exporting ? 'Packing…' : 'Backup with history'}</button>
        </div>
      </header>
      <div className="history-save" data-layout="checkpointForms">
        <form onSubmit={(event) => { event.preventDefault(); if (checkpointName.trim()) void onSaveCheckpoint(checkpointName.trim()).then(() => setCheckpointName('')); }}>
          <label htmlFor="checkpoint-name">Remember this version</label>
          <div data-layout="checkpointInput"><input id="checkpoint-name" placeholder="e.g. Shorter turns after Friday’s playtest" value={checkpointName} onChange={(event) => setCheckpointName(event.target.value)} maxLength={160} /><button className="history-primary" disabled={busy || !checkpointName.trim()}><Save size={15} />Save checkpoint</button></div>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); if (experimentName.trim()) void onCreateVersion(experimentName.trim()).then(() => setExperimentName('')); }}>
          <label htmlFor="experiment-name">Try an alternative</label>
          <div data-layout="experimentInput"><input id="experiment-name" placeholder="e.g. Cooperative scoring" value={experimentName} onChange={(event) => setExperimentName(event.target.value)} maxLength={80} /><button disabled={busy || !experimentName.trim()}><GitBranch size={15} />Start experiment</button></div>
        </form>
      </div>
      {error && <p role="alert" className="history-error">{error}</p>}
      {view === 'map' ? <VersionMap gitStatus={gitStatus} versionGraph={versionGraph} onCreateVersion={(name) => { if (!busy) void onCreateVersion(name); }} onRestoreCommit={(sha) => { if (!busy) void onRestoreCommit(sha); }} /> : (
        <div className="history-body" data-layout="historyBody">
          <aside aria-label="Saved checkpoints" className="checkpoint-list">
            <button className={selected ? '' : 'selected'} onClick={() => setSelectedSha(null)}><span><History size={17} /><strong>Working draft</strong></span><small>{versionGraph.activeBranchName} · {gitStatus.hasChanges ? 'Changes since checkpoint' : 'Up to date'}</small></button>
            {versionGraph.commits.length === 0 && <p className="history-empty">Your first version starts here. Give it a name above so you can come back to it.</p>}
            {versionGraph.commits.map((commit) => <button key={commit.id} className={selected?.id === commit.id ? 'selected' : ''} onClick={() => setSelectedSha(commit.commitSha)}><span><strong>{commit.message}</strong>{commit.commitSha === versionGraph.activeCommitSha && <em>Current</em>}</span><small>{commit.branchName} · v{commit.versionNumber} · {new Date(commit.createdAt).toLocaleDateString()}</small></button>)}
          </aside>
          <div data-layout="checkpointDetail" className="checkpoint-detail">
            <div data-layout="checkpointDetailHeader" className="checkpoint-detail-heading"><div data-layout="checkpointTitle"><span className="history-eyebrow">{selected ? 'SAVED CHECKPOINT' : 'YOUR CURRENT DESIGN'}</span><h2>{selected?.message ?? 'What changed?'}</h2><p>{selected ? 'Changes compared with the previous checkpoint.' : 'Changes compared with your active checkpoint.'}</p></div>{selected && (selected.commitSha !== versionGraph.activeCommitSha || gitStatus.hasChanges) && <button disabled={busy} onClick={() => { void onRestoreCommit(selected.commitSha); }}><RotateCcw size={15} />Restore this version</button>}</div>
            {loading ? <p role="status">Comparing designs…</p> : changes.length === 0 ? <div data-layout="noDesignChanges" className="history-empty"><h3>Everything is captured.</h3><p>Your rules, cards, components, and playtest notes match this checkpoint.</p></div> : changes.map((change, index) => <details key={`${change.area}-${index}`} className="design-change"><summary><span>{change.area}</span><strong>{change.label}</strong><em>{!change.before ? 'Added' : !change.after ? 'Removed' : 'Updated'}</em></summary><div data-layout="designComparison" className="design-comparison"><div data-layout="beforeChange"><small>BEFORE</small><pre>{change.before || '—'}</pre></div><div data-layout="afterChange"><small>AFTER</small><pre>{change.after || '—'}</pre></div></div></details>)}
          </div>
        </div>
      )}
      <footer className="history-footer"><span><GitBranch size={14} />{versionGraph.activeBranchName}</span><span>{versionGraph.commits.length} saved checkpoints · Switching versions keeps unsaved work in a safety checkpoint.</span></footer>
    </section>
  );
}
