import { createBlankProject, createDefaultSeats, createDefaultProjectViews } from '../../editor/project';
import { createDefaultCardStudio, createSampleRows } from '../../editor/cardStudio/model';
import { createPlaytestLabState } from '../../editor/playtest/simulation';
import { commitProjectToGit, syncProjectWorkspace } from '../../editor/git';
import { buildPreviewRuntime } from '../../editor/runtime';
import { saveEditorProject } from '../../editor/storage';
import type { EditorProject } from '../../editor/types';

const sampleChapters: Record<string, string> = {
  Concept:
    'A small card game about building a welcoming woodland. Gather acorns, discover forest places, and collect points. This is a first draft to change freely: try it, notice the slow moments, and save your next idea as a new version.',
  Components:
    '10 woodland cards: 4 Gathering Glades, 3 Lantern Keepers, 2 Moonlit Markets, and 1 Ancient Oak. You will also need tokens or coins for acorns, and a way to record points. Open Card studio to edit these designs and print a prototype.',
  Setup:
    'Play with 2 players. Shuffle all 10 cards. Deal 5 face up as a shared market and leave the rest as a draw pile. Each player begins with 0 acorns and 0 points. Choose a starting player.',
  'Game Structure':
    'Players alternate turns. For this first prototype, each turn has exactly one action: gather or discover. There are no hidden hands and no extra card powers.',
  'Taking a Turn':
    'Gather: take 2 acorns, up to a maximum of 12. Or discover: pay the acorn cost of one available card and take it from the market. Refill that market slot from the draw pile when possible. Score the points listed in its points column in Card studio (Glade 1, Keeper 3, Market 5, Oak 8). Use the numeric cost and points only for this first playtest; the descriptive card text is inspiration for future rules, not an extra effect. You may pass instead of acting.',
  'End Game':
    'The game ends immediately when a player reaches 12 points, after the last market card is taken, or after each player has taken 20 turns. The player with the most points wins; tied players share the victory. First playtest question: does the first player have too much of an advantage?',
  Iconography:
    'Acorns are your spending resource. Cost is the number in the card badge. Points are recorded in the card table: try binding the footer to points before printing so every player can see them.',
};

export function buildWorkshopProject(options: {
  name: string;
  theme?: string;
  players?: number;
  sample?: boolean;
}): EditorProject {
  const name = options.sample ? 'Little Woodland' : options.name.trim() || 'My first game';
  const project = createBlankProject(name);
  const seats = createDefaultSeats(Math.max(1, Math.min(6, options.players ?? 2)));
  project.name = name;
  project.description = options.sample
    ? 'Gather acorns, discover forest places, and find the fun. A tiny prototype to make your own.'
    : 'A new game idea, ready for its first playable version.';
  project.brief = {
    ...project.brief,
    name,
    theme: options.sample ? 'Cozy woodland' : (options.theme?.trim() ?? ''),
    minPlayers: seats.length,
    maxPlayers: seats.length,
  };
  project.art.theme = project.brief.theme;
  project.seats = seats;
  project.views = createDefaultProjectViews(seats, name);
  if (options.sample) {
    project.brief = { ...project.brief, minAge: 8, playtimeMinMinutes: 10, playtimeMaxMinutes: 15 };
    project.rules.chapters = project.rules.chapters.map((chapter) => ({
      ...chapter,
      body: chapter.kind && chapter.kind !== 'standard' ? '' : (sampleChapters[chapter.title] ?? ''),
    }));
    project.rules.designerNotes =
      'Before changing the rules, save a checkpoint. Try a shorter game, change the card costs, and compare notes. Agent simulations model numeric costs and points; they do not interpret custom narrative effects.';
    project.rules.customComponents = [
      {
        id: `${project.id}_prototype_materials`,
        name: 'Prototype supplies',
        description:
          '10 printed woodland cards, acorn tokens or coins, and paper for recording points. Print the card sheets in Card studio; use household tokens for the first playtest.',
      },
    ];
    project.cardStudio = { ...createDefaultCardStudio(), rows: createSampleRows() };
    project.cardStudio.template.footerField = 'points';
    project.playtestLab = createPlaytestLabState();
    project.playtestLab.config = {
      ...project.playtestLab.config,
      cardSource: 'project',
      actionsPerTurn: 1,
      startingResources: 0,
      targetScore: 12,
    };
  }
  return project;
}

export async function saveNewWorkshopProject(
  project: EditorProject,
): Promise<{ project: EditorProject; warning?: string }> {
  await saveEditorProject(project);
  try {
    const runtime = buildPreviewRuntime(project);
    await syncProjectWorkspace(project, runtime);
    await commitProjectToGit(project, runtime, 'First draft — a place to start', {
      branchName: 'First ideas',
    });
    return { project };
  } catch (error) {
    // A checkpoint failure must never discard or duplicate the saved game.
    return {
      project,
      warning: `Your game was saved, but its first checkpoint could not be created. ${error instanceof Error ? error.message : 'Open Versions to try again.'}`,
    };
  }
}
