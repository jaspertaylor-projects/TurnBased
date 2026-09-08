import { useState } from 'react';
import { Bot, Download, FlaskConical, Play } from 'lucide-react';
import type { EditorProject } from '../types';
import { LabConfigPanel } from '../playtest/LabConfigPanel';
import { LabJournal, LabSimulationPanel } from '../playtest/LabResults';
import { LabTable } from '../playtest/LabTable';
import { getLabMaterial } from '../playtest/material';
import { createLabAgentPacket, downloadLabJson, observeLabRun, parseLabAgentMove } from '../playtest/packet';
import {
  chooseLabBotMove, createLabGame, createPlaytestLabState, normalizeLabConfig,
  recordLabMove, replayLabRun, simulateLabBatch, simulateLabGame,
} from '../playtest/simulation';
import type { LabBatch, LabFinding, LabRun, LabVersionRef, PlaytestLabState } from '../playtest/types';
import '../playtest/playtest.css';

interface PlaytestSectionProps {
  project: EditorProject;
  onChange: (project: EditorProject) => void;
  versionLabel?: string;
  versionSha?: string | null;
}

type LabTab = 'table' | 'simulation' | 'journal' | 'agent';
const tabs: { id: LabTab; label: string }[] = [
  { id: 'table', label: 'Play a game' }, { id: 'simulation', label: 'Run experiments' },
  { id: 'journal', label: 'Playtest journal' }, { id: 'agent', label: 'Agent workspace' },
];

function archiveSession(sessions: LabRun[], run: LabRun | null): LabRun[] {
  if (!run) return sessions;
  return [run, ...sessions.filter((session) => session.id !== run.id)].slice(0, 30);
}

export function PlaytestSection({ project, onChange, versionLabel = 'Working draft', versionSha = null }: PlaytestSectionProps) {
  const lab = project.playtestLab ?? createPlaytestLabState();
  const config = normalizeLabConfig(lab.config);
  const cards = getLabMaterial(project, config.cardSource);
  const version: LabVersionRef = { label: versionLabel, sha: versionSha };
  const [tab, setTab] = useState<LabTab>('table');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [replay, setReplay] = useState<{ run: LabRun; step: number } | null>(null);
  const [findingDraft, setFindingDraft] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const shownRun = replay?.run ?? lab.activeRun;
  const observationRun = replay ? { ...replay.run, state: replayLabRun(replay.run, replay.step), transcript: replay.run.transcript.slice(0, replay.step) } : lab.activeRun;

  const persist = (next: PlaytestLabState) => onChange({ ...project, playtestLab: next });
  const safely = (action: () => void) => {
    setError(''); setNotice('');
    try { action(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The experiment could not be completed.'); }
  };
  const saveRun = (run: LabRun) => {
    const complete = run.state.status === 'finished' ? { ...run, completedAt: run.completedAt ?? new Date().toISOString() } : run;
    persist({ ...lab, activeRun: complete,
      sessions: complete.state.status === 'finished' ? archiveSession(lab.sessions, complete) : lab.sessions });
  };
  const startSession = () => safely(() => {
    const snapshotCards = cards.map((card) => ({ ...card }));
    const run: LabRun = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), version,
      config: { ...config }, cards: snapshotCards, state: createLabGame(config, snapshotCards), transcript: [] };
    persist({ ...lab, config, activeRun: run, sessions: archiveSession(lab.sessions, lab.activeRun) });
    setReplay(null); setTab('table');
  });
  const playBotTurn = (run: LabRun) => {
    let next = run;
    for (let index = 0; index < run.config.actionsPerTurn && next.state.status === 'playing' && next.state.activeSeat === 1; index += 1) {
      next = recordLabMove(next, chooseLabBotMove(next.state, next.config, next.cards, next.config.opponent), 'bot');
    }
    return next;
  };
  const move = (actionId: string) => safely(() => {
    const run = lab.activeRun;
    if (!run || replay) return;
    if (run.state.activeSeat !== 0) throw new Error('It is the opponent’s turn.');
    const next = recordLabMove(run, { chosenActionId: actionId, expectedStep: run.state.step }, 'human');
    saveRun(playBotTurn(next));
  });
  const exportPacket = () => safely(() => {
    if (!observationRun) throw new Error('Start a session to export its rules, legal actions and current observation.');
    downloadLabJson(`${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'game'}-agent-packet.json`, createLabAgentPacket(project, observationRun));
    setNotice('Agent packet downloaded. It includes the session rules, cards, observation and replay.');
  });
  const restart = () => safely(() => {
    const run = lab.activeRun;
    if (!run) return;
    const fresh: LabRun = { ...run, id: crypto.randomUUID(), startedAt: new Date().toISOString(), completedAt: undefined,
      state: createLabGame(run.config, run.cards), transcript: [] };
    persist({ ...lab, activeRun: fresh, sessions: archiveSession(lab.sessions, run) });
    setReplay(null);
  });
  const runBatch = () => {
    setError(''); setNotice(''); setBusy(true);
    try {
      const batch: LabBatch = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), version,
        config: { ...config }, cards: cards.map((card) => ({ ...card })), results: simulateLabBatch(config, cards, batchCount) };
      persist({ ...lab, batches: [batch, ...lab.batches].slice(0, 12) });
      setSelectedBatchId(batch.id);
      setNotice(`${batch.results.length} games completed and saved with ${version.label}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Simulation failed.'); }
    finally { setBusy(false); }
  };
  const replayBatch = (batch: LabBatch, index: number) => safely(() => {
    const result = batch.results[index];
    const replayConfig = { ...batch.config, seed: result.seed, firstPlayer: result.firstPlayer };
    const simulated = simulateLabGame(replayConfig, batch.cards);
    const run: LabRun = { id: `${batch.id}-${index}`, startedAt: batch.createdAt, completedAt: batch.createdAt,
      version: batch.version, config: replayConfig, cards: batch.cards, ...simulated };
    setReplay({ run, step: 0 }); setTab('table');
  });
  const addFinding = () => {
    const text = findingDraft.trim();
    if (!text) return;
    const finding: LabFinding = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text,
      status: 'open', version: shownRun?.version ?? version, sessionId: shownRun?.id ?? null };
    persist({ ...lab, findings: [finding, ...lab.findings].slice(0, 200) });
    setFindingDraft(''); setNotice('Finding saved with its session and version.');
  };
  const applyAgentResponse = () => safely(() => {
    if (!lab.activeRun) throw new Error('Start a session first.');
    if (replay) throw new Error('Return to the live table before applying an agent move.');
    saveRun(recordLabMove(lab.activeRun, parseLabAgentMove(agentResponse), 'agent'));
    setAgentResponse(''); setNotice('Agent move validated and added to the session transcript.');
  });

  return <div className="playtest-lab" data-layout="playtestLab">
    <div className="lab-header" data-layout="playtestLabHeader">
      <div data-layout="playtestLabTitle"><span className="lab-eyebrow">Make it. Try it. Make it better.</span><h2>Playtest Lab</h2><span className="lab-muted">A table, an opponent, and a notebook for your next iteration.</span></div>
      <div className="lab-actions" data-layout="playtestLabHeaderActions"><span className="lab-pill">{versionLabel}</span><button className="lab-button" type="button" disabled={!shownRun} onClick={exportPacket}><Download size={14} />Agent packet</button></div>
    </div>
    <div className="lab-tabs" data-layout="playtestLabTabs" role="tablist" aria-label="Playtest Lab tools">
      {tabs.map((item) => <button type="button" key={item.id} role="tab" id={`lab-tab-${item.id}`} aria-controls={`lab-panel-${item.id}`} aria-selected={tab === item.id} onClick={() => { setTab(item.id); setError(''); }}>{item.label}{item.id === 'journal' && lab.findings.length > 0 ? ` (${lab.findings.filter((finding) => finding.status === 'open').length})` : ''}</button>)}
    </div>
    {error && <div role="alert" className="lab-error" data-layout="playtestError">{error}</div>}
    <div className="lab-scroll" data-layout="playtestLabBody" role="tabpanel" id={`lab-panel-${tab}`} aria-labelledby={`lab-tab-${tab}`}>
      <div className="lab-grid" data-layout="playtestLabColumns">
        <LabConfigPanel config={config} cards={cards} running={!!lab.activeRun} onChange={(next) => persist({ ...lab, config: normalizeLabConfig(next) })} onStart={startSession} />
        {tab === 'table' && (shownRun ? <LabTable run={shownRun} replayStep={replay?.step ?? null} onReplayStep={(step) => setReplay(replay ? { ...replay, step } : null)} onMove={move} onBot={() => safely(() => { if (lab.activeRun) saveRun(playBotTurn(lab.activeRun)); })} onRestart={restart} onExport={exportPacket} onCloseReplay={() => setReplay(null)} /> : <div className="lab-panel lab-empty" data-layout="playtestWelcome"><FlaskConical size={42} /><h3>Your next good idea starts with a playtest.</h3><span className="lab-muted" style={{ maxWidth: 440 }}>Try the Woodland sample in a minute, then bring your own card table. Every legal move can be played by you, the built-in bot, or an outside agent.</span><button className="lab-button primary" type="button" onClick={startSession} disabled={!cards.length}><Play size={14} />Start your first session</button></div>)}
        {tab === 'simulation' && <LabSimulationPanel challenger={config.challenger} count={batchCount} busy={busy} disabled={!cards.length} batches={lab.batches} selectedBatchId={selectedBatchId} onChallenger={(challenger) => persist({ ...lab, config: { ...config, challenger } })} onCount={setBatchCount} onRun={() => void runBatch()} onSelect={setSelectedBatchId} onReplay={replayBatch} />}
        {tab === 'journal' && <LabJournal sessions={lab.sessions} findings={lab.findings} draft={findingDraft} versionLabel={shownRun?.version.label ?? versionLabel} onDraft={setFindingDraft} onAdd={addFinding} onToggle={(id) => persist({ ...lab, findings: lab.findings.map((finding) => finding.id === id ? { ...finding, status: finding.status === 'open' ? 'resolved' : 'open' } : finding) })} onReplay={(run) => { setReplay({ run, step: 0 }); setTab('table'); }} />}
        {tab === 'agent' && <div className="lab-stack" data-layout="playtestAgentWorkspace">
          <div className="lab-panel" data-layout="playtestAgentContract"><span className="lab-eyebrow">A game an agent can actually act on</span><h3 style={{ marginTop: 8 }}>Observe → choose → validate → replay</h3><p className="lab-muted">Agents receive a public observation, explicit legal actions, numeric card definitions and executable rules. Export the packet to your agent, then paste one move below. No model connection is required.</p><div className="lab-note">The built-in opponent uses a documented heuristic. Full rulebook interpretation and arbitrary card abilities are outside this experiment’s executable protocol.</div><button className="lab-button primary" style={{ marginTop: 14 }} type="button" onClick={exportPacket} disabled={!shownRun}><Download size={14} />Download self-contained agent packet</button></div>
          {observationRun ? <>
            <div className="lab-panel" data-layout="playtestAgentObservation"><h3>Public observation</h3><pre className="lab-json">{JSON.stringify(observeLabRun(observationRun), null, 2)}</pre><p className="lab-muted">Draw order is hidden here. The export contains a separate referee replay with the seed and full state.</p></div>
            <div className="lab-panel" data-layout="playtestAgentMove"><h3>Apply an agent’s move</h3><label className="lab-field">Agent response JSON<textarea className="lab-agent-text" rows={5} value={agentResponse} onChange={(event) => setAgentResponse(event.target.value)} placeholder={JSON.stringify({ chosenActionId: 'gather', expectedStep: observationRun.state.step, rationale: 'Build resources for a scoring card.' }, null, 2)} /></label><button className="lab-button primary" style={{ marginTop: 10 }} type="button" disabled={!agentResponse.trim() || !!replay || lab.activeRun?.state.status !== 'playing'} onClick={applyAgentResponse}><Bot size={14} />Validate and apply move</button><p className="lab-muted">The move must match the current step and a legal action. Each accepted response advances exactly one action.</p></div>
          </> : <div className="lab-panel lab-empty" data-layout="playtestAgentEmpty"><Bot size={34} /><span className="lab-muted">Start a session to create its observation and legal action contract.</span></div>}
        </div>}
      </div>
    </div>
    <div className="lab-footer" data-layout="playtestLabFooter"><span role="status">{notice || `${lab.sessions.length} saved sessions · ${lab.batches.reduce((sum, batch) => sum + batch.results.length, 0)} simulated games · ${lab.findings.filter((finding) => finding.status === 'open').length} open findings`}</span><span>Project autosave · Last 30 sessions / 12 experiments retained</span></div>
  </div>;
}
