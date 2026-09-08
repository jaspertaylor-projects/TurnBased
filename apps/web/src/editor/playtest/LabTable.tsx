import { Bot, Coins, RotateCcw, Download, ChevronRight } from 'lucide-react';
import { getLabLegalActions, replayLabRun } from './simulation';
import type { LabRun } from './types';

interface Props {
  run: LabRun;
  replayStep: number | null;
  onReplayStep: (step: number) => void;
  onMove: (actionId: string) => void;
  onBot: () => void;
  onRestart: () => void;
  onExport: () => void;
  onCloseReplay: () => void;
}

export function LabTable({ run, replayStep, onReplayStep, onMove, onBot, onRestart, onExport, onCloseReplay }: Props) {
  const state = replayStep === null ? run.state : replayLabRun(run, replayStep);
  const legal = getLabLegalActions(state, run.config, run.cards);
  const canPlay = replayStep === null && state.status === 'playing' && state.activeSeat === 0;
  const history = replayStep === null ? run.transcript : run.transcript.slice(0, replayStep);
  const winner = state.winner === 'draw' ? 'Draw' : state.winner === 0 ? 'You / challenger win' : 'Opponent wins';
  return (
    <div className="lab-stack" data-layout="playtestLiveTable">
      <div className="lab-tabletop" data-layout="playtestTabletop">
        <div className="lab-table-status" data-layout="playtestTurnStatus">
          <span>{replayStep !== null ? 'Replay · ' : ''}Round {Math.ceil(state.turn / 2)} / {run.config.maxRounds} · Turn {state.turn}</span>
          <span>{state.status === 'finished' ? `${winner} · ${state.endReason}` : `${state.activeSeat === 0 ? 'Your turn' : 'Opponent turn'} · ${state.actionsRemaining} actions left`}</span>
        </div>
        <div className="lab-seats" data-layout="playtestSeats">
          {state.players.map((player, index) => (
            <div key={index} className={`lab-seat${state.activeSeat === index && state.status === 'playing' ? ' active' : ''}`} data-layout="playtestSeat" aria-label={`${index === 0 ? 'Challenger' : 'Opponent'}: ${player.score} points, ${player.resources} coins`}>
              <strong>{index === 0 ? 'You / challenger' : `Opponent · ${run.config.opponent}`}</strong>
              <span className="lab-seat-score">{player.score}<span style={{ font: '12px sans-serif', marginLeft: 5 }}> / {run.config.targetScore} points</span></span>
              <span style={{ fontSize: 12 }}>{player.resources} coins · {player.acquired.length} cards acquired</span>
            </div>
          ))}
        </div>
        <div className="lab-table-status" data-layout="playtestMarketHeading"><strong>Shared market</strong><span>{state.drawPile.length} cards in draw pile</span></div>
        <div className="lab-market" data-layout="playtestMarket">
          {state.market.map((id, index) => {
            const card = run.cards.find((candidate) => candidate.id === id)!;
            const affordable = legal.some((action) => action.id === `buy:${card.id}`);
            return <button className="lab-card" type="button" key={`${id}-${index}`} disabled={!canPlay || !affordable} onClick={() => onMove(`buy:${card.id}`)} aria-label={`Buy ${card.name} for ${card.cost} coins, gain ${card.points} points`}>
              <span className="lab-card-cost"><span><Coins size={11} /> {card.cost}</span><span>MARKET</span></span>
              <strong>{card.name}</strong>
              <span><span className="lab-card-points">{card.points}</span> <span style={{ fontSize: 11 }}>points</span></span>
              <span style={{ fontSize: 10 }}>{canPlay ? affordable ? 'Click to acquire' : 'Gather more coins' : 'Cost & scoring experiment'}</span>
            </button>;
          })}
        </div>
        <div className="lab-legal-actions" data-layout="playtestLegalActions">
          {replayStep === null && state.activeSeat === 0 && legal.filter((action) => action.type !== 'buy').map((action) => (
            <button className="lab-button" type="button" key={action.id} onClick={() => onMove(action.id)}>{action.type === 'gather' ? <Coins size={14} /> : <ChevronRight size={14} />}{action.label}</button>
          ))}
          {replayStep === null && state.activeSeat === 1 && state.status === 'playing' && <button className="lab-button" type="button" onClick={onBot}><Bot size={15} />Play opponent turn</button>}
          {state.status === 'finished' && <span role="status" style={{ fontWeight: 700 }}>{winner}. {replayStep === null ? 'Session saved in your journal.' : 'End of replay.'}</span>}
        </div>
      </div>
      <div className="lab-actions" data-layout="playtestSessionActions">
        {replayStep === null ? <button className="lab-button" type="button" onClick={onRestart}><RotateCcw size={13} />Restart same seed</button> : <button className="lab-button" type="button" onClick={onCloseReplay}>Return to live table</button>}
        <button className="lab-button" type="button" onClick={onExport}><Download size={13} />Agent packet</button>
        <span className="lab-muted">Seed {run.config.seed} · {run.version.label} · {run.config.cardSource === 'sample' ? 'Sample deck' : 'Project cards'}</span>
      </div>
      {replayStep !== null && <div className="lab-panel" data-layout="playtestReplayControls">
        <label className="lab-field">Replay position · {replayStep} / {run.transcript.length} moves
          <input aria-label="Replay position" type="range" min={0} max={run.transcript.length} value={replayStep} onChange={(event) => onReplayStep(Number(event.target.value))} />
        </label>
        <div className="lab-actions" data-layout="playtestReplayStepButtons">
          <button className="lab-button small" type="button" disabled={replayStep === 0} onClick={() => onReplayStep(replayStep - 1)}>Previous move</button>
          <button className="lab-button small" type="button" disabled={replayStep === run.transcript.length} onClick={() => onReplayStep(replayStep + 1)}>Next move</button>
        </div>
      </div>}
      <div className="lab-panel" data-layout="playtestTranscript">
        <h3>Turn transcript <span className="lab-pill">{history.length} moves</span></h3>
        {!history.length && <p className="lab-muted">Every move records its seat, turn and action. Replaying the same configuration and moves reproduces the same table.</p>}
        <div className="lab-transcript" data-layout="playtestTranscriptRows">
          {[...history].reverse().map((record) => <div className="lab-record" data-layout="playtestTranscriptRow" key={record.step}>
            <span className="lab-muted">T{record.turn}</span>
            <div data-layout="playtestTranscriptEntry"><strong>{record.seat === 0 ? 'Challenger' : 'Opponent'}</strong> · {record.label}<div className="lab-muted" data-layout="playtestMoveRationale">{record.actor}{record.rationale ? ` · ${record.rationale}` : ''}</div></div>
          </div>)}
        </div>
      </div>
    </div>
  );
}
