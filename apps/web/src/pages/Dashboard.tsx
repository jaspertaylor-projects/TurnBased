import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  Layers3,
  LockKeyhole,
  Plus,
  Search,
  Sprout,
  Trash2,
} from 'lucide-react';
import { listProjectGitCommits } from '../editor/git';
import { deleteEditorProject, loadEditorProjects } from '../editor/storage';
import type { EditorProject } from '../editor/types';
import type { ProjectReadError } from '../editor/persistence/liveProjects';
import { buildWorkshopProject, saveNewWorkshopProject } from '../components/workshop/createWorkshopProject';
import {
  formatProjectDate,
  projectLink,
  projectPlayerLabel,
  summarizeProject,
} from '../components/workshop/projectSummary';
import '../components/workshop/workshop.css';

export const Dashboard = () => {
  const [projects, setProjects] = useState<EditorProject[]>([]);
  const [commitCounts, setCommitCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadWarnings, setLoadWarnings] = useState<ProjectReadError[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);

  const refreshProjects = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const warnings: ProjectReadError[] = [];
      const loaded = await loadEditorProjects((warning) => warnings.push(warning));
      if (request !== requestId.current) return;
      setProjects(loaded.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      setLoadWarnings(warnings);
      setError(null);
      setLoading(false);
      const counts = await Promise.allSettled(
        loaded.map(
          async (project) => [project.id, (await listProjectGitCommits(project.id)).length] as const,
        ),
      );
      if (request !== requestId.current) return;
      setCommitCounts(
        Object.fromEntries(counts.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))),
      );
    } catch (cause) {
      if (request === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Your games could not be loaded.');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
    const onStorage = () => void refreshProjects();
    window.addEventListener('storage', onStorage);
    return () => {
      requestId.current += 1;
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshProjects]);

  async function handleDelete(projectId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteEditorProject(projectId);
      setPendingDelete(null);
      await refreshProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This game could not be deleted.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function startSample() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await saveNewWorkshopProject(
        buildWorkshopProject({ name: 'Little Woodland', sample: true }),
      );
      if (result.warning)
        window.sessionStorage.setItem('turnbased.creator.pendingEditorNotice', result.warning);
      window.location.hash = projectLink(result.project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The example could not be created.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const filtered = projects.filter((project) =>
    `${project.name} ${project.description} ${project.brief.theme}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <section className="workshop-surface" aria-labelledby="my-workshop-title">
      <header className="workshop-surface__header">
        <div data-layout="workshopLibraryHeading">
          <h1 id="my-workshop-title">My workshop</h1>
        </div>
        <a href="#/new" className="workshop-button workshop-button--primary">
          <Plus size={16} /> Create game
        </a>
      </header>
      <div data-layout="workshopLibraryAndRail" className="workshop-surface__body">
        <section className="workshop-library" aria-label="Your games">
          <header className="workshop-library__toolbar">
            <h2>
              Your games{' '}
              {!loading && <span style={{ color: '#95a087', fontWeight: 400 }}>· {projects.length}</span>}
            </h2>
            <label className="workshop-search">
              <Search size={14} />
              <input
                aria-label="Search your games"
                placeholder="Find a game…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </header>
          <div data-layout="localGameList" className="workshop-library__list" aria-busy={loading}>
            {loadWarnings.length > 0 && (
              <section role="alert" aria-label="Games needing recovery" className="workshop-error">
                <strong>{loadWarnings.length} saved game{loadWarnings.length === 1 ? ' needs' : 's need'} recovery</strong>
                <ul>{loadWarnings.map((warning, index) => <li key={`${warning.projectId ?? 'unknown'}-${index}`}>{warning.message}</li>)}</ul>
                <button onClick={() => void refreshProjects()} className="workshop-button">Try loading again</button>
              </section>
            )}
            {error && (
              <p role="alert" className="workshop-error">
                {error}{' '}
                <button
                  onClick={() => {
                    setError(null);
                    void refreshProjects();
                  }}
                  className="workshop-button"
                >
                  Try again
                </button>
              </p>
            )}
            {loading ? (
              <p className="workshop-surface__intro" role="status">
                Opening your workshop…
              </p>
            ) : filtered.length === 0 ? (
              <div data-layout="emptyGameLibrary" className="workshop-empty">
                <Sprout size={39} strokeWidth={1.1} />
                <h3>{query ? 'No matching games' : loadWarnings.length ? 'No games available' : 'No games yet'}</h3>
                <p>
                  {query
                    ? 'Try another title or theme.'
                    : loadWarnings.length ? 'The affected game entries are still saved. You can retry loading them or import a backup from Print & share.'
                    : 'Create a project or open an editable example.'}
                </p>
                {query ? (
                  <button onClick={() => setQuery('')} className="workshop-button">
                    Clear search
                  </button>
                ) : (
                  <div data-layout="emptyLibraryActions" className="workshop-actions">
                    <a href="#/new" className="workshop-button workshop-button--primary">
                      {loadWarnings.length ? 'Create another game' : 'Start your first game'} <ArrowRight size={14} />
                    </a>
                    <button
                      className="workshop-button workshop-button--text"
                      disabled={busy}
                      onClick={() => void startSample()}
                    >
                      Try an example
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filtered.map((project) => {
                const summary = summarizeProject(project, commitCounts[project.id]);
                return (
                  <article key={project.id} className="workshop-project" aria-label={project.name}>
                    <div data-layout="projectSummary" className="workshop-project__body">
                      <a
                        href={projectLink(project.id)}
                        className="workshop-project__cover"
                        aria-label={`Open ${project.name}`}
                      >
                        <Sprout size={32} strokeWidth={1.2} />
                      </a>
                      <div data-layout="projectDetails" className="workshop-project__details">
                        <h3>
                          <a href={projectLink(project.id)} style={{ color: 'inherit' }}>
                            {project.name}
                          </a>
                        </h3>
                        <p>{project.brief.theme || project.description}</p>
                        <ul className="workshop-project__stats">
                          <li>
                            <BookOpen size={11} /> {summary.chapters} chapters
                          </li>
                          <li>
                            <Layers3 size={11} /> {summary.designs} card designs
                          </li>
                          <li>
                            <GitBranch size={11} /> {commitCounts[project.id] ?? '…'} checkpoint
                            {commitCounts[project.id] === 1 ? '' : 's'}
                          </li>
                        </ul>
                      </div>
                      <button
                        className="workshop-project__menu"
                        disabled={busy}
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setPendingDelete(project.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <footer className="workshop-project__footer">
                      <a href={projectLink(project.id, summary.next.section)}>
                        {summary.next.label} <ArrowRight size={12} />
                      </a>
                      <span>
                        Edited {formatProjectDate(project.updatedAt)} · {projectPlayerLabel(project)}
                      </span>
                    </footer>
                    {pendingDelete === project.id && (
                      <div
                        data-layout="confirmProjectDeletion"
                        className="workshop-project__delete"
                        role="group"
                        aria-label={`Confirm deletion of ${project.name}`}
                      >
                        <span>Delete this game and its local version history?</span>
                        <button onClick={() => setPendingDelete(null)} disabled={busy}>
                          Keep game
                        </button>
                        <button onClick={() => void handleDelete(project.id)} disabled={busy}>
                          Delete permanently
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
        <aside className="workshop-rail" aria-label="Examples and guidance">
          <article className="workshop-tip">
            <Sprout size={23} />
            <p className="workshop-eyebrow">Example project</p>
            <h2>Little Woodland</h2>
            <p>
              A rules draft, four card designs, and a configured playtest. Open an editable copy.
            </p>
            <button onClick={() => void startSample()} disabled={busy} className="workshop-button">
              Try the example <ArrowRight size={13} />
            </button>
          </article>
          <article className="workshop-tip workshop-tip--plain">
            <GitBranch size={21} />
            <h2>Save a checkpoint</h2>
            <p>
              Save before a significant change. Use Versions to compare designs or restore an earlier checkpoint.
            </p>
          </article>
        </aside>
      </div>
      <footer className="workshop-surface__footer">
        <span>
          <LockKeyhole size={11} /> Your games are saved in this browser. Export a backup from Versions.
        </span>
      </footer>
    </section>
  );
};
