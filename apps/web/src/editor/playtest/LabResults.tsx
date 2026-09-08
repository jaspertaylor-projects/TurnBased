import { Bot, Play, ScrollText } from 'lucide-react';
import { summarizeLabBatch } from './simulation';
import type { LabBatch, LabFinding, LabRun, LabStrategy } from './types';

export function LabBatchResults({ batch, onReplay }: { batch: LabBatch; onReplay: (batch: LabBatch, index: number) => void }) {
  const summary = summarizeLabBatch(batch);
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return <div className="lab-stack" data-layout="playtestBatchResults">
    <div className="lab-metrics" data-layout="playtestMetrics">
      {[['Challenger wins', percent(summary.challengerWinRate)], ['Average turns', summary.meanTurns.toFixed(1)], ['Starting-seat wins', percent(summary.firstPlayerWinRate)], ['Round-limit games', String(summary.roundLimitGames)]].map(([label, value]) => (
        <div key={label} className="lab-metric" data-layout="playtestMetric"><span className="lab-muted">{label}</span><strong>{value}</strong></div>
      ))}
    </div>
    <div className="lab-panel" data-layout="playtestBatchBreakdown">
      <h3>{summary.games} completed games <span className="lab-pill">{batch.version.label}</span></h3>
      <p className="lab-muted">Challenger ({batch.config.challenger}) vs opponent ({batch.config.opponent}). Each seed plays twice with the starting seat swapped. Win rates count draws in the denominator; turns are individual player turns.</p>
      <div data-layout="playtestWinDistribution" role="img" aria-label={`${summary.wins} challenger wins, ${summary.draws} draws, ${summary.losses} opponent wins`} style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', background: '#ddd' }}>
        <div data-layout="playtestChallengerWinBar" style={{ width: `${summary.wins / summary.games * 100}%`, background: '#426844' }} />
        <div data-layout="playtestDrawBar" style={{ width: `${summary.draws / summary.games * 100}%`, background: '#d4c99c' }} />
        <div data-layout="playtestOpponentWinBar" style={{ width: `${summary.losses / summary.games * 100}%`, background: '#b88145' }} />
      </div>
      <p className="lab-muted">{summary.wins} challenger wins · {summary.draws} draws · {summary.losses} opponent wins</p>
      <div className="lab-note">These measurements describe this structured experiment and its heuristic strategies. Use them to form playtest questions, then compare with people playing your full rules.</div>
      <div data-layout="playtestResultRows" style={{ maxHeight: 340, overflow: 'auto', marginTop: 14 }}>
        <table className="lab-results-table"><thead><tr><th>Seed</th><th>Starts</th><th>Outcome</th><th>Score</th><th>Turns</th><th>Replay</th></tr></thead><tbody>
          {batch.results.map((result, index) => <tr key={`${result.seed}-${result.firstPlayer}-${index}`}>
            <td>{result.seed}</td><td>{result.firstPlayer === 0 ? 'Challenger' : 'Opponent'}</td><td>{result.winner === 'draw' ? 'Draw' : result.winner === 0 ? 'Challenger' : 'Opponent'}</td><td>{result.scores.join(' : ')}</td><td>{result.turns}</td><td><button className="lab-button small" type="button" onClick={() => onReplay(batch, index)} aria-label={`Replay seed ${result.seed}, ${result.firstPlayer === 0 ? 'challenger' : 'opponent'} starts`}><Play size={11} />Replay</button></td>
          </tr>)}
        </tbody></table>
      </div>
    </div>
  </div>;
}

interface SimulationProps {
  challenger: LabStrategy;
  count: number;
  busy: boolean;
  disabled: boolean;
  batches: LabBatch[];
  selectedBatchId: string | null;
  onChallenger: (strategy: LabStrategy) => void;
  onCount: (count: number) => void;
  onRun: () => void;
  onSelect: (id: string) => void;
  onReplay: (batch: LabBatch, index: number) => void;
}

export function LabSimulationPanel(props: SimulationProps) {
  const batch = props.batches.find((candidate) => candidate.id === props.selectedBatchId) ?? props.batches[0];
  return <div className="lab-stack" data-layout="playtestSimulationPanel">
    <div className="lab-panel" data-layout="playtestBatchControls">
      <span className="lab-eyebrow">Ask a better balance question</span>
      <h3 style={{ marginTop: 8 }}>Let the bots play a few rounds</h3>
      <p className="lab-muted">Run reproducible games using the setup at left. Compare strategies, see starting-seat advantage, and replay any result move by move.</p>
      <div className="lab-fields" data-layout="playtestSimulationFields">
        <label className="lab-field">Challenger strategy<select value={props.challenger} onChange={(event) => props.onChallenger(event.target.value as LabStrategy)}><option value="greedy">Greedy</option><option value="balanced">Balanced</option><option value="random">Random</option></select></label>
        <label className="lab-field">Number of games<select value={props.count} onChange={(event) => props.onCount(Number(event.target.value))}><option value={20}>20 games · quick check</option><option value={50}>50 games</option><option value={100}>100 games</option></select></label>
      </div>
      <button className="lab-button primary" style={{ marginTop: 14 }} type="button" disabled={props.busy || props.disabled} onClick={props.onRun}><Bot size={15} />{props.busy ? 'Playing games…' : `Run ${props.count} games`}</button>
      {props.batches.length > 1 && <label className="lab-field" style={{ marginTop: 15 }}>Saved experiment<select value={batch?.id} onChange={(event) => props.onSelect(event.target.value)}>{props.batches.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.results.length} games · {item.version.label}</option>)}</select></label>}
    </div>
    {batch ? <LabBatchResults batch={batch} onReplay={props.onReplay} /> : <div className="lab-panel lab-empty" data-layout="playtestBatchEmpty"><Bot size={34} /><strong>Your first experiment starts here</strong><span className="lab-muted">Try Greedy against Balanced. Then change one number and compare the next batch.</span></div>}
  </div>;
}

interface JournalProps {
  sessions: LabRun[];
  findings: LabFinding[];
  draft: string;
  versionLabel: string;
  onDraft: (text: string) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onReplay: (run: LabRun) => void;
}

export function LabJournal(props: JournalProps) {
  return <div className="lab-stack" data-layout="playtestJournal">
    <div className="lab-panel" data-layout="playtestFindingComposer">
      <h3>What should change next?</h3>
      <p className="lab-muted">Keep observations with the version that produced them. A specific question makes the next playtest more useful.</p>
      <label className="lab-field">Playtest finding<textarea rows={3} value={props.draft} maxLength={4000} onChange={(event) => props.onDraft(event.target.value)} placeholder="The first player gets the strongest card before anyone can respond. Try a smaller starting coin pool." /></label>
      <div className="lab-actions" data-layout="playtestFindingActions" style={{ marginTop: 10 }}><button className="lab-button primary" type="button" disabled={!props.draft.trim()} onClick={props.onAdd}>Save finding</button><span className="lab-muted">Linked to {props.versionLabel}</span></div>
      {props.findings.map((finding) => <div key={finding.id} className={`lab-finding${finding.status === 'resolved' ? ' resolved' : ''}`} data-layout="playtestFinding">
        <p>{finding.text}</p><div className="lab-actions" data-layout="playtestFindingMeta"><span className="lab-muted">{finding.version.label} · {new Date(finding.createdAt).toLocaleDateString()}</span><button className="lab-button small" type="button" onClick={() => props.onToggle(finding.id)}>{finding.status === 'open' ? 'Mark resolved' : 'Reopen'}</button></div>
      </div>)}
    </div>
    <div className="lab-panel" data-layout="playtestSessionJournal">
      <h3>Session journal <span className="lab-pill">{props.sessions.length}</span></h3>
      {!props.sessions.length && <div className="lab-empty" data-layout="playtestSessionsEmpty"><ScrollText size={30} /><span className="lab-muted">Completed sessions and previous tables appear here with their original rules, cards and replay.</span></div>}
      {props.sessions.map((run) => <div className="lab-finding" data-layout="playtestSavedSession" key={run.id}>
        <strong>{run.state.status === 'finished' ? run.state.winner === 'draw' ? 'Draw' : run.state.winner === 0 ? 'Challenger win' : 'Opponent win' : 'In progress'} · {run.state.players.map((player) => player.score).join(' : ')}</strong>
        <span className="lab-muted">{run.version.label} · Seed {run.config.seed} · {run.transcript.length} moves · {new Date(run.startedAt).toLocaleString()}</span>
        <button className="lab-button small" style={{ justifySelf: 'start' }} type="button" onClick={() => props.onReplay(run)}><Play size={12} />Replay session</button>
      </div>)}
    </div>
  </div>;
}
