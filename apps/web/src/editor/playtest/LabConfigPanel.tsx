import { FlaskConical, Play } from 'lucide-react';
import { STRATEGY_DESCRIPTIONS } from './simulation';
import type { LabCard, LabConfig, LabStrategy } from './types';

interface Props {
  config: LabConfig;
  cards: LabCard[];
  running: boolean;
  onChange: (config: LabConfig) => void;
  onStart: () => void;
}

export function LabConfigPanel({ config, cards, running, onChange, onStart }: Props) {
  const update = <K extends keyof LabConfig,>(key: K, value: LabConfig[K]) => onChange({ ...config, [key]: value });
  const field = (label: string, key: 'seed' | 'targetScore' | 'maxRounds' | 'actionsPerTurn' | 'startingResources' | 'gatherAmount' | 'resourceCap' | 'marketSize', min: number, max: number) => (
    <label className="lab-field" key={key}>{label}
      <input type="number" min={min} max={max} value={config[key]} onChange={(event) => update(key, Number(event.target.value))} />
    </label>
  );
  const unbuyable = cards.filter((card) => card.cost > config.resourceCap).length;
  return (
    <div data-layout="playtestConfiguration" className="lab-stack">
      <div className="lab-panel" data-layout="playtestProtocol">
        <span className="lab-eyebrow">Executable experiment</span>
        <h3 style={{ marginTop: 8 }}>Market race</h3>
        <p className="lab-muted">Gather coins. Buy cards from a shared market. Race to {config.targetScore} points, or lead when {config.maxRounds} rounds end.</p>
        <div className="lab-note">This two-player protocol tests cost, scoring and turn economy. Card abilities and freeform rules are reference material; the bot follows the settings below.</div>
      </div>
      <div className="lab-panel" data-layout="playtestSetup">
        <h3>Set the experiment</h3>
        <div className="lab-fields" data-layout="playtestFields">
          <label className="lab-field wide">Card material
            <select value={config.cardSource} onChange={(event) => update('cardSource', event.target.value === 'project' ? 'project' : 'sample')}>
              <option value="sample">Woodland sample deck</option><option value="project">My project cards</option>
            </select>
          </label>
          {field('Target score', 'targetScore', 1, 999)}{field('Round limit', 'maxRounds', 1, 100)}
          {field('Actions / turn', 'actionsPerTurn', 1, 5)}{field('Coins / gather', 'gatherAmount', 1, 20)}
          {field('Starting coins', 'startingResources', 0, 100)}{field('Coin limit', 'resourceCap', 1, 100)}
          {field('Market slots', 'marketSize', 1, 8)}{field('Seed', 'seed', 0, 2147483647)}
          <label className="lab-field wide">Opponent strategy
            <select value={config.opponent} onChange={(event) => update('opponent', event.target.value as LabStrategy)}>
              <option value="balanced">Balanced · points per action</option><option value="greedy">Greedy · biggest immediate score</option><option value="random">Random · seeded legal moves</option>
            </select>
          </label>
          <label className="lab-field wide">Who starts a live session?
            <select value={config.firstPlayer} onChange={(event) => update('firstPlayer', event.target.value === '1' ? 1 : 0)}>
              <option value={0}>You</option><option value={1}>Opponent</option>
            </select>
          </label>
        </div>
        <p className="lab-muted">{STRATEGY_DESCRIPTIONS[config.opponent]} Runs locally without a language model.</p>
        <button className="lab-button primary" type="button" onClick={onStart} disabled={!cards.length}><Play size={14} />{running ? 'Start fresh session' : 'Start playtest'}</button>
        {running && <p className="lab-muted">Changes apply to the next session. The current rules and cards stay frozen for reliable replay.</p>}
      </div>
      <div className="lab-panel" data-layout="playtestMaterialSummary">
        <h3><FlaskConical size={15} /> {cards.length} card designs</h3>
        <p className="lab-muted">{cards.reduce((sum, card) => sum + card.quantity, 0)} copies · {config.cardSource === 'sample' ? 'Explicit sample material' : 'Current Card Studio rows, or component cards when no table rows exist'}</p>
        {config.cardSource === 'project' && <p className="lab-muted">Uses numeric cost and points (or victory_points). Missing values become 0. Quantities are capped at 100 per design; up to 500 designs.</p>}
        {!cards.length && <div className="lab-note warning">Add rows in Card Studio, or choose the sample deck to begin.</div>}
        {!!cards.length && cards.every((card) => card.points === 0) && <div className="lab-note warning">No scoring values found. Add a points column in Card Studio; this setup will otherwise end in a draw.</div>}
        {unbuyable > 0 && <div className="lab-note warning">{unbuyable} design{unbuyable === 1 ? '' : 's'} cost more than the coin limit and can block the market.</div>}
      </div>
    </div>
  );
}
