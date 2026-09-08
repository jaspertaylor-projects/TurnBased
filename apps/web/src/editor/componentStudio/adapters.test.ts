/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { addProjectComponent, createBlankProject } from '../project';
import { createCardRow, createDefaultCardStudio } from '../cardStudio/model';
import { createStudioComponent, listProjectDesignSets, setProjectComponentDesign } from './model';
import { buildComponentPrintHtml, buildComponentPrintLayout } from './print';
import { getProjectLabCards } from '../playtest/material';
import { createRulebookHtml } from '../exports/rulebook';
import { compareDesigns } from '../versions/compare';
import { summarizeProject } from '../../components/workshop/projectSummary';
import type { EditorProject } from '../types';

test('multi-deck adapters namespace row IDs and count each card, token and board exactly once', () => {
  let project: EditorProject = { ...createBlankProject('Whole game'), phase: 'ready' };
  const first = createStudioComponent(project, 'card', 'Action deck');
  project = first.project;
  const second = createStudioComponent(project, 'card', 'Event deck');
  project = second.project;
  const tokens = createStudioComponent(project, 'token', 'Coins');
  project = tokens.project;
  const board = createStudioComponent(project, 'board', 'Main board');
  project = board.project;
  for (const [id, count, points] of [
    [first.instanceId, 2, 3],
    [second.instanceId, 4, 5],
    [tokens.instanceId, 8, 0],
  ] as const) {
    const studio = project.componentDesigns![id];
    project = setProjectComponentDesign(project, id, {
      ...studio,
      rows: [
        createCardRow({
          id: 'shared-row-id',
          title: id,
          copies: count,
          customFields: { points: String(points) },
        }),
      ],
    });
  }
  project = {
    ...project,
    cardStudio: {
      ...createDefaultCardStudio(),
      rows: [
        createCardRow({
          id: 'shared-row-id',
          title: 'Legacy card',
          copies: 3,
          customFields: { points: '2' },
        }),
      ],
    },
  };
  const cards = getProjectLabCards(project);
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((card) => card.id)).size, 3);
  assert.equal(
    cards.reduce((total, card) => total + card.quantity, 0),
    9,
  );
  assert.ok(cards.every((card) => card.points > 0));
  const summary = summarizeProject(project);
  assert.equal(summary.components, 5);
  assert.equal(summary.copies, 9);
  assert.equal(summary.componentCopies, 18);
  const rulebook = createRulebookHtml(project);
  for (const name of ['Action deck', 'Event deck', 'Coins', 'Main board', 'Original card deck']) {
    assert.equal(rulebook.split(`<strong>${name}</strong>`).length - 1, 1);
  }
});

test('version comparison identifies an editable component face change by component name', () => {
  const created = createStudioComponent(createBlankProject('Templates'), 'tile', 'Meadow tiles');
  const project = created.project;
  const studio = structuredClone(project.componentDesigns![created.instanceId]);
  studio.template.document!.faces[0].background = '#aabbcc';
  studio.template.document!.widthMm = 85;
  studio.template.document!.heightMm = 55;
  const next = setProjectComponentDesign(project, created.instanceId, studio);
  const changes = compareDesigns(project, next);
  assert.ok(
    changes.some(
      (change) => change.area === 'Component designs' && change.label === 'Meadow tiles · Faces and template',
    ),
  );
  const physicalChange = changes.find(
    (change) => change.area === 'Components' && change.label === 'Meadow tiles',
  );
  assert.ok(physicalChange);
  assert.equal(JSON.parse(physicalChange.after).properties.physicalWidthMm, 85);
  assert.equal(JSON.parse(physicalChange.after).properties.physicalHeightMm, 55);
});

test('an existing standalone card uses its authored design exactly once in every adapter', () => {
  const deck = addProjectComponent(createBlankProject('Legacy standalone card'), 'deck', null, null);
  assert.ok(deck.instanceId);
  const child = addProjectComponent(deck.project, 'card', deck.instanceId, null);
  assert.ok(child.instanceId);
  const id = child.instanceId;
  // Old projects can contain root cards even though new cards must belong to decks.
  let project: EditorProject = {
    ...child.project,
    rootInstanceIds: [id],
    instances: {
      [id]: {
        ...child.project.instances[id],
        parentId: null,
        displayName: 'Solo card',
        properties: { ...child.project.instances[id].properties, cost: 9, points: 1, quantity: 2 },
      },
    },
  };
  const [derived] = listProjectDesignSets(project);
  assert.equal(derived.instanceId, id);
  assert.equal(getProjectLabCards(project).length, 1, 'Derived root card does not enter the fallback twice');
  const studio = structuredClone(derived.studio);
  studio.rows[0] = {
    ...studio.rows[0],
    title: 'Authored solo card',
    cost: '3',
    copies: 4,
    customFields: { points: '7' },
  };
  project = setProjectComponentDesign(project, id, studio);
  const [authored] = listProjectDesignSets(project);
  assert.equal(authored.id, id);
  assert.equal(project.instances[id].properties.quantity, 4);
  assert.deepEqual(getProjectLabCards(project), [
    { id: `${id}:${studio.rows[0].id}`, name: 'Authored solo card', cost: 3, points: 7, quantity: 4 },
  ]);
  const summary = summarizeProject(project);
  assert.equal(summary.designSets, 1);
  assert.equal(summary.components, 1);
  assert.equal(summary.designs, 1);
  assert.equal(summary.copies, 4);
  assert.equal(summary.componentCopies, 4);
  const rulebook = createRulebookHtml(project);
  assert.equal(rulebook.split('<strong>Solo card</strong>').length - 1, 1);
  assert.match(rulebook, /Solo card<\/strong> — 4 cards/);
  const layout = buildComponentPrintLayout(authored.studio.template.document!, authored.studio.rows);
  assert.equal(layout.pages.flatMap((page) => page.placements).length, 4);
  assert.match(buildComponentPrintHtml(authored.studio, authored.name), /Authored solo card/);
});
