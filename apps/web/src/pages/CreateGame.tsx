import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { WorkshopArt } from '../components/workshop/WorkshopArt';
import { buildWorkshopProject, saveNewWorkshopProject } from '../components/workshop/createWorkshopProject';
import { projectLink } from '../components/workshop/projectSummary';
import '../components/workshop/workshop.css';

export function CreateGame() {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [players, setPlayers] = useState('2');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function create(sample = false) {
    if (submitting.current || (!sample && !name.trim())) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const project = buildWorkshopProject({ name, theme, players: Number(players), sample });
      const result = await saveNewWorkshopProject(project);
      if (result.warning)
        window.sessionStorage.setItem('turnbased.creator.pendingEditorNotice', result.warning);
      window.location.hash = projectLink(project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your game could not be saved. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void create();
  }

  return (
    <section className="workshop-surface" aria-labelledby="create-game-title">
      <header className="workshop-surface__header" style={{ maxWidth: 920 }}>
        <div data-layout="createGameHeading">
          <h1 id="create-game-title">Create game</h1>
          <p className="workshop-surface__intro">
            Set the basics. You can edit these later.
          </p>
        </div>
        <a
          href="#/dashboard"
          className="workshop-button workshop-button--text"
          aria-label="Back to my workshop"
        >
          <ArrowLeft size={17} />
        </a>
      </header>
      <div data-layout="createGameSurface" className="workshop-create">
        <form onSubmit={handleSubmit} className="workshop-create__form">
          <div data-layout="createGameFields" className="workshop-create__fields">
            <label className="workshop-field">
              Game name
              <input
                aria-label="Game name"
                autoFocus
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Untitled game"
              />
              <small>Use a working title if you haven’t chosen a name.</small>
            </label>
            <label className="workshop-field">
              Theme or first idea <span style={{ fontWeight: 400 }}>(optional)</span>
              <input
                aria-label="Theme or first idea"
                maxLength={250}
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                placeholder="A trading game set in a woodland market"
              />
              <small>Describe the setting or core mechanic.</small>
            </label>
            <label className="workshop-field">
              Players
              <input
                aria-label="Players"
                type="number"
                required
                min={1}
                max={6}
                value={players}
                onChange={(event) => setPlayers(event.target.value)}
              />
              <small>Choose 1–6 players to start. You can change your player range in Game details.</small>
            </label>
            <button
              type="button"
              onClick={() => void create(true)}
              disabled={busy}
              className="workshop-button workshop-create__mobile-example"
            >
              Try Little Woodland instead <ArrowRight size={14} />
            </button>
            {error && (
              <p className="workshop-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="workshop-create__actions">
            <a href="#/new/guided">Open guided setup</a>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="workshop-button workshop-button--primary"
            >
              {busy ? 'Creating…' : 'Create game'}
              <ArrowRight size={16} />
            </button>
          </footer>
        </form>
        <aside className="workshop-create__aside" aria-label="Try an example game">
          <WorkshopArt compact />
          <h2>Example project</h2>
          <p>
            Little Woodland includes a rules draft, four card designs, and ten cards. Open an editable copy.
          </p>
          <button onClick={() => void create(true)} disabled={busy} className="workshop-button">
            Try Little Woodland <ArrowRight size={14} />
          </button>
        </aside>
      </div>
      <footer className="workshop-surface__footer" style={{ maxWidth: 920 }}>
        <span>
          <LockKeyhole size={11} /> Saved in this browser. Export a backup from Versions.
        </span>
        <span>No account or AI generation needed.</span>
      </footer>
    </section>
  );
}
