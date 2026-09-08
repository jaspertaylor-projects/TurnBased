import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { requestRulesWriter } from '../../aiRulesService';
import { getModelLabel, resolveRulesWriterModel, RULES_WRITER_MODEL_OPTIONS } from '../../aiModelCatalog';
import { listProjectDesignSets } from '../../componentStudio/model';
import { applyRulebookDraft, parseRulebookDraft, reverseRulebookDraft, writableRuleChapters, type RulebookDraft } from '../../rulebookDraft';
import type { EditorProject, EditorRuleConfig } from '../../types';
import './rulebookDraft.css';

interface Props {
  project: EditorProject;
  onUpdateRules: (updater: (rules: EditorRuleConfig) => EditorRuleConfig) => void;
  onOpen: () => void;
}

export function RulebookAIDraft({ project, onUpdateRules, onOpen }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef({ project, onUpdateRules });
  useLayoutEffect(() => { latest.current = { project, onUpdateRules }; }, [project, onUpdateRules]);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(() => resolveRulesWriterModel(project.settings.aiModels.rulesWriter));
  const [selected, setSelected] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState('');
  const [draft, setDraft] = useState<RulebookDraft | null>(null);
  const [undo, setUndo] = useState<RulebookDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const chapters = writableRuleChapters(project.rules);
  const currentPreview = draft?.before.find((chapter) => chapter.id === previewId) ?? draft?.before[0];
  const currentEntry = draft?.entries.find((entry) => entry.id === currentPreview?.id);
  const canUndo = (() => {
    if (!undo) return false;
    try { applyRulebookDraft(project.rules, undo); return true; } catch { return false; }
  })();

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  function close() {
    generation.current += 1;
    setBusy(false); setOpen(false); setDraft(null); setError('');
    dialog.current?.close();
  }
  function show() {
    onOpen(); setSelected(chapters.map((chapter) => chapter.id));
    setDraft(null); setError(''); setOpen(true);
  }
  async function generate() {
    if (busy || !prompt.trim() || !selected.length) return;
    const token = ++generation.current;
    const original = latest.current.project;
    const before = writableRuleChapters(original.rules).filter((chapter) => selected.includes(chapter.id));
    setBusy(true); setError(''); setDraft(null);
    try {
      const response = await requestRulesWriter({
        mode: 'rulebook', modelId: model, userPrompt: prompt,
        gameName: original.brief.name || original.name, theme: original.brief.theme,
        playerMin: original.brief.minPlayers, playerMax: original.brief.maxPlayers,
        chapters: original.rules.chapters.map(({ id, title, body }) => ({ id, title, body })),
        targetChapters: before.map(({ id, title }) => ({ id, title })),
        components: listProjectDesignSets(original).map((set) => ({
          name: set.name, kind: set.kind,
          rows: set.studio.rows.map(({ id, title, body, cost, copies, customFields }) => ({ id, title, body, cost, copies, customFields })),
        })),
      });
      if (token !== generation.current || latest.current.project.id !== original.id) return;
      const next: RulebookDraft = { before, entries: parseRulebookDraft(response.text, before) };
      applyRulebookDraft(latest.current.project.rules, next);
      setDraft(next); setPreviewId(before[0].id);
      setNotice(`Drafted ${before.length} chapters with ${getModelLabel(response.model)}. Review before applying.`);
    } catch (caught) {
      if (token === generation.current) setError(caught instanceof Error ? caught.message : 'Unable to draft the rulebook.');
    } finally { if (token === generation.current) setBusy(false); }
  }
  function apply() {
    if (!draft) return;
    try {
      applyRulebookDraft(latest.current.project.rules, draft);
      latest.current.onUpdateRules((rules) => {
        try { return applyRulebookDraft(rules, draft); } catch { return rules; }
      });
      setUndo(reverseRulebookDraft(draft));
      setNotice(`Applied ${draft.entries.length} AI-drafted chapters. Your rules remain editable.`);
      close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The rulebook changed. Generate a fresh draft.'); }
  }
  function undoDraft() {
    if (!undo || !canUndo) return;
    latest.current.onUpdateRules((rules) => {
      try { return applyRulebookDraft(rules, undo); } catch { return rules; }
    });
    setUndo(null); setNotice('Restored the prose from before the AI draft.');
  }

  return <div className="rulebook-draft-actions" data-layout="rulebookDraftActions">
    <button type="button" className="rulebook-draft-button primary" onClick={show} disabled={!chapters.length}><Sparkles size={15} />Draft rulebook with AI</button>
    {canUndo && <button type="button" className="rulebook-draft-button" onClick={undoDraft}><RotateCcw size={14} />Undo rulebook draft</button>}
    {!open && notice && <span role="status" className="rulebook-draft-notice">{notice}</span>}
    {open && <dialog ref={dialog} className="rulebook-draft-dialog" aria-labelledby="rulebook-draft-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <header className="rulebook-draft-header">
        <div data-layout="rulebookDraftTitle"><span className="rulebook-draft-kicker">FROM AN IDEA TO A PLAYABLE FIRST DRAFT</span><h2 id="rulebook-draft-title">Write the rules together.</h2><p>Describe the game. Review a consistent draft across your selected chapters.</p></div>
        <button type="button" className="rulebook-draft-button" aria-label="Close rulebook AI" onClick={close}><X size={18} /></button>
      </header>
      <div className="rulebook-draft-body" data-layout="rulebookDraftBody">
        <aside className="rulebook-draft-inputs" aria-label="Rulebook AI instructions">
          <label htmlFor="whole-rulebook-prompt">Describe the game and how it should play</label>
          <textarea id="whole-rulebook-prompt" rows={7} maxLength={12000} value={prompt} disabled={busy} onChange={(event) => { setPrompt(event.target.value); setDraft(null); }} placeholder="Who are the players? What do they do on a turn? How do they win? Include any numbers or constraints to keep." />
          <label htmlFor="whole-rulebook-model">Writing model</label>
          <select id="whole-rulebook-model" value={model} disabled={busy} onChange={(event) => setModel(event.target.value)}>{RULES_WRITER_MODEL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
          <fieldset disabled={busy}><legend>Chapters to draft</legend>{chapters.map((chapter) => <label className="rulebook-draft-check" key={chapter.id}><input type="checkbox" checked={selected.includes(chapter.id)} onChange={(event) => { setSelected(event.target.checked ? [...selected, chapter.id] : selected.filter((id) => id !== chapter.id)); setDraft(null); }} />{chapter.title}</label>)}</fieldset>
          <p className="rulebook-draft-help">Uses your current rulebook, game brief and component tables. Component lists and icon legends stay connected to your project.</p>
        </aside>
        <section className="rulebook-draft-review" aria-label="Rulebook draft review">
          {busy ? <div className="rulebook-draft-empty" data-layout="rulebookDraftProgress" role="status"><Sparkles className="rulebook-draft-pulse" size={36} /><h3>Drafting {selected.length} connected chapters…</h3><p>The AI is working from your game idea, existing rules and card table.</p></div> : draft ? <>
            <nav className="rulebook-draft-tabs" aria-label="Draft chapters">{draft.before.map((chapter) => <button type="button" key={chapter.id} aria-pressed={currentPreview?.id === chapter.id} onClick={() => setPreviewId(chapter.id)}>{chapter.title}</button>)}</nav>
            <div className="rulebook-draft-comparison" data-layout="rulebookDraftComparison">
              <article><h3>Current · {currentPreview?.title}</h3><p>{currentPreview?.body || 'No prose yet. Your draft will start this chapter.'}</p></article>
              <article><h3>AI draft · {currentPreview?.title}</h3><p>{currentEntry?.body}</p></article>
            </div>
          </> : <div className="rulebook-draft-empty" data-layout="rulebookDraftWelcome"><Sparkles size={36} /><h3>A rulebook that fits together.</h3><p>Generate the selected chapters in one pass, then read the proposal before changing your game.</p></div>}
        </section>
      </div>
      <footer className="rulebook-draft-footer">
        <div data-layout="rulebookDraftFeedback">{error ? <p role="alert">{error}</p> : <span role="status">{draft ? notice : 'Generated text is a proposal. You choose when to apply it.'}</span>}</div>
        <button type="button" className="rulebook-draft-button" onClick={close}>Cancel</button>
        <button type="button" className="rulebook-draft-button" disabled={busy || !prompt.trim() || !selected.length} onClick={() => void generate()}>{busy ? 'Writing…' : draft ? 'Generate another draft' : 'Generate rulebook draft'}</button>
        {draft && <button type="button" className="rulebook-draft-button primary" onClick={apply}>Apply {draft.entries.length} chapters</button>}
      </footer>
    </dialog>}
  </div>;
}
