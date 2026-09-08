/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankProject } from '../project';
import { createCardRow, createDefaultCardStudio } from '../cardStudio/model';
import { createTemplateLayer, migrateCardTemplate } from '../templateStudio/model';
import { freezeLabVisuals, labCardSize, renderLabCard, resolveLabVisual } from './visuals';
import { getProjectLabCards } from './material';
import { createLabGame, DEFAULT_LAB_CONFIG, recordLabMove, replayLabRun, simulateLabGame } from './simulation';
import { createLabTableLayout, fitLabTable, placeLabCards } from './tableLayout';
import type { LabRun, LabVisualMaterial } from './types';

function fixture() {
  const project = createBlankProject('Moonlit Market');
  const studio = createDefaultCardStudio();
  const art = `data:image/png;base64,${'a'.repeat(2048)}`;
  const document = migrateCardTemplate(studio.template);
  const image = createTemplateLayer('image', document);
  if (image.type === 'image') image.source = art;
  document.faces[0].layers.push(image);
  const back = createTemplateLayer('text', document);
  if (back.type === 'text') back.content = 'Frozen market back';
  document.faces = [document.faces[0], { id: 'back', name: 'Back', background: '#123456', layers: [back, { ...image, id: 'back-image' }] }];
  studio.template.document = document;
  studio.rows = [createCardRow({ id: 'jam', title: 'Starberry Jam', copies: 18, cost: '1', artUrl: art, customFields: { points: '1' } })];
  project.cardStudio = studio;
  return { project, cards: getProjectLabCards(project), art };
}

test('freezes authored faces and row bindings while storing shared artwork once, independent of copy count', () => {
  const { project, cards, art } = fixture();
  const visuals = freezeLabVisuals(project, 'project', cards);
  assert.equal(Object.keys(visuals.cards).length, 1);
  assert.equal(Object.keys(visuals.templates).length, 1);
  assert.equal(Object.keys(visuals.assets).length, 1);
  assert.equal(JSON.stringify(visuals).split(art).length - 1, 1);
  project.cardStudio!.rows[0].title = 'A later design';
  project.cardStudio!.template.document!.widthMm = 100;
  project.cardStudio!.template.document!.faces[1].background = '#ff0000';
  const frozen = resolveLabVisual(cards[0], visuals);
  assert.equal(frozen.data.title, 'Starberry Jam');
  assert.equal(frozen.document.widthMm, 63);
  assert.equal(frozen.document.faces[1].background, '#123456');
  assert.ok(renderLabCard(cards[0], visuals, 'front', 'front-test').includes('Starberry Jam'));
  const back = renderLabCard(cards[0], visuals, 'back', 'back-test');
  assert.ok(back.includes('#123456'));
  assert.ok(back.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').includes('Frozen market back'));
});

test('serialized sessions preserve exact visual material and replay without changing the numeric protocol', () => {
  const { project, cards } = fixture();
  const config = { ...DEFAULT_LAB_CONFIG, cardSource: 'project' as const };
  const run: LabRun = { id: 'frozen', startedAt: '', version: { label: 'v1', sha: null }, config, cards, visuals: freezeLabVisuals(project, 'project', cards), state: createLabGame(config, cards), transcript: [] };
  const moved = recordLabMove(run, { chosenActionId: 'gather', expectedStep: 0 }, 'human');
  const loaded = JSON.parse(JSON.stringify(moved)) as LabRun;
  assert.deepEqual(replayLabRun(loaded, loaded.transcript.length), moved.state);
  assert.deepEqual(loaded.visuals, run.visuals);
  assert.equal(renderLabCard(cards[0], loaded.visuals, 'front', 'same'), renderLabCard(cards[0], run.visuals, 'front', 'same'));
  assert.deepEqual(simulateLabGame(config, loaded.cards), simulateLabGame(config, cards));
});

test('one global fit preserves mixed component sizes in normal and fullscreen bounds', () => {
  const { project, cards } = fixture();
  const visuals = freezeLabVisuals(project, 'project', cards);
  const large = { ...cards[0], id: 'large', name: 'Larger card' };
  visuals.templates.large = { ...Object.values(visuals.templates)[0], widthMm: 126, heightMm: 176 };
  visuals.cards.large = { templateId: 'large', data: { title: 'Larger card' } };
  const material = [...cards, large];
  const layout = createLabTableLayout(material, visuals, 5);
  const state = { ...createLabGame(DEFAULT_LAB_CONFIG, material), market: [cards[0].id, large.id] };
  const placed = placeLabCards(layout, state, material, visuals).filter((item) => item.zone === 'market');
  for (const [width, height] of [[700, 420], [1600, 750], [320, 350]]) {
    const fit = fitLabTable(layout, width, height);
    assert.ok(fit.width <= width && fit.height <= height);
    assert.equal((placed[1].width * fit.scale) / (placed[0].width * fit.scale), 2);
    assert.equal((placed[1].height * fit.scale) / (placed[0].height * fit.scale), 2);
    for (const card of placed) {
      assert.ok(card.x >= 0 && card.y >= 0);
      assert.ok(card.x + card.width <= layout.width);
      assert.ok(card.y + card.height <= layout.height);
    }
  }
});

test('legacy sessions get readable reference faces and hidden draw order never controls the displayed back', () => {
  const { cards } = fixture();
  assert.deepEqual(labCardSize(cards[0]), { width: 63, height: 88 });
  assert.ok(renderLabCard(cards[0], undefined, 'front', 'legacy').includes('Starberry Jam'));
  assert.ok(renderLabCard(cards[0], undefined, 'back', 'legacy-back').includes('data-template-face="back"'));
  const config = { ...DEFAULT_LAB_CONFIG };
  const material = [...cards, { ...cards[0], id: 'secret', name: 'Secret next card' }];
  const state = createLabGame(config, material);
  state.drawPile = ['secret'];
  const layout = createLabTableLayout(material, undefined, config.marketSize);
  assert.equal(placeLabCards(layout, state, material).find((item) => item.zone === 'draw')?.cardId, cards[0].id);
  const roundtrip = JSON.parse(JSON.stringify({ schemaVersion: 1, templates: {}, cards: {}, assets: {} })) as LabVisualMaterial;
  assert.equal(resolveLabVisual(cards[0], roundtrip).authored, false);
});
