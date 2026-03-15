import {
  sampleGamesById,
} from './games';
import {
  runRandomSimulation,
  runSelfPlaySimulation,
} from './harness';

interface ParsedArgs {
  gameId: string;
  mode: 'random' | 'self-play';
  maxTurns?: number;
  seed?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    gameId: 'tic-tac-toe-reference',
    mode: 'self-play',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === '--game' && value) {
      parsed.gameId = value;
      index += 1;
    } else if (token === '--mode' && value && (value === 'random' || value === 'self-play')) {
      parsed.mode = value;
      index += 1;
    } else if (token === '--turns' && value) {
      parsed.maxTurns = Number(value);
      index += 1;
    } else if (token === '--seed' && value) {
      parsed.seed = Number(value);
      index += 1;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const game = sampleGamesById[args.gameId];

  if (!game) {
    const available = Object.keys(sampleGamesById).join(', ');
    throw new Error(`Unknown game "${args.gameId}". Available games: ${available}`);
  }

  const result =
    args.mode === 'random'
      ? await runRandomSimulation(game, { maxTurns: args.maxTurns, seed: args.seed })
      : await runSelfPlaySimulation(game, { maxTurns: args.maxTurns, seed: args.seed });

  console.log(JSON.stringify({
    gameId: result.gameId,
    mode: result.mode,
    completed: result.completed,
    stopReason: result.stopReason,
    finalStateHash: result.finalStateHash,
    winner: result.finalState.winner,
    turnCount: result.steps.length,
    rootActionCount: result.rootActions.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
