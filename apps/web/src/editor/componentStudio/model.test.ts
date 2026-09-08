/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { addProjectComponent, createBlankProject } from '../project';
import {
  createStudioComponent,
  duplicateStudioComponent,
  LEGACY_DESIGN_SET_ID,
  listProjectDesignSets,
  normalizeProjectComponentDesigns,
  setProjectComponentDesign,
} from './model';

test('a stale legacy edit cannot create a second physical deck after migration', () => {
  const created = createStudioComponent(createBlankProject('Already migrated'), 'card', 'Main deck');
  const studio = created.project.componentDesigns![created.instanceId];
  assert.throws(
    () => setProjectComponentDesign(created.project, LEGACY_DESIGN_SET_ID, studio),
    /moved into Components/,
  );
  assert.equal(listProjectDesignSets(created.project).length, 1);
});

test('listing physical stock preserves quantity over the row limit without creating inventory', () => {
  const created = addProjectComponent(createBlankProject('Many acorns'), 'token', null, null);
  assert.ok(created.instanceId);
  const id = created.instanceId;
  const project = {
    ...created.project,
    instances: {
      ...created.project.instances,
      [id]: {
        ...created.project.instances[id],
        properties: {
          ...created.project.instances[id].properties,
          quantity: 120,
        },
      },
    },
  };
  const before = structuredClone(project);
  const sets = listProjectDesignSets(project);
  assert.deepEqual(
    sets[0].studio.rows.map((row) => row.copies),
    [99, 21],
  );
  assert.deepEqual(listProjectDesignSets(project), sets);
  assert.deepEqual(project, before);
  const saved = setProjectComponentDesign(project, id, sets[0].studio);
  assert.equal(saved.instances[id].properties.quantity, 120);
  assert.equal(Object.keys(saved.instances).length, 1);
  const oversized = { ...sets[0].studio, rows: [{ ...sets[0].studio.rows[0], copies: 100000 }] };
  assert.throws(() => setProjectComponentDesign(project, id, oversized), /Split it into smaller/);
  assert.deepEqual(project, before);
});

test('duplicating a physical deck remaps card row identities and keeps independent artwork', () => {
  const deck = addProjectComponent(createBlankProject('Existing deck'), 'deck', null, null);
  assert.ok(deck.instanceId);
  const card = addProjectComponent(deck.project, 'card', deck.instanceId, null);
  assert.ok(card.instanceId);
  const source = listProjectDesignSets(card.project)[0];
  source.studio.rows[0].artUrl = 'data:image/png;base64,aGVsbG8=';
  const project = setProjectComponentDesign(card.project, source.id, source.studio);
  const duplicate = duplicateStudioComponent(project, source.id);
  const copiedCardId = String(duplicate.project.instances[duplicate.instanceId].children[0]);
  assert.notEqual(copiedCardId, card.instanceId);
  const copied = duplicate.project.componentDesigns![duplicate.instanceId];
  assert.equal(copied.rows[0].id, copiedCardId);
  assert.equal(copied.rows[0].artUrl, source.studio.rows[0].artUrl);
  copied.rows[0].title = 'Only the copy';
  assert.notEqual(project.componentDesigns![source.id].rows[0].title, 'Only the copy');
});

test('normalization repairs invalid row IDs deterministically and drops only orphaned design entries', () => {
  const created = createStudioComponent(createBlankProject('Repair IDs'), 'board', 'Forest board');
  const studio = created.project.componentDesigns![created.instanceId];
  const project = {
    ...created.project,
    componentDesigns: {
      [created.instanceId]: {
        ...studio,
        rows: [
          { ...studio.rows[0], id: '' },
          { ...studio.rows[0], id: 'same' },
          { ...studio.rows[0], id: 'same' },
        ],
      },
      orphan: studio,
    },
  };
  const normalized = normalizeProjectComponentDesigns(project);
  assert.deepEqual(normalizeProjectComponentDesigns(project), normalized);
  assert.deepEqual(Object.keys(normalized.componentDesigns!), [created.instanceId]);
  assert.equal(new Set(normalized.componentDesigns![created.instanceId].rows.map((row) => row.id)).size, 3);
  assert.deepEqual(normalized.instances, project.instances);
});

test('new component families use native preset sizes and existing physical stock scales its starter artwork', () => {
  for (const [kind, width, height] of [
    ['board', 300, 300],
    ['token', 32, 32],
    ['tile', 75, 75],
    ['mat', 240, 140],
    ['piece', 24, 36],
  ] as const) {
    const created = createStudioComponent(createBlankProject('Starter sizes'), kind, kind);
    const instance = created.project.instances[created.instanceId];
    const document = created.project.componentDesigns![created.instanceId].template.document!;
    assert.equal(document.widthMm, width);
    assert.equal(document.heightMm, height);
    assert.equal(instance.properties.physicalWidthMm, width);
    assert.equal(instance.properties.physicalHeightMm, height);
    const border = document.faces[0].layers.find((layer) => layer.name === 'Surface border')!;
    assert.ok(border);
    assert.ok(Math.abs(border.x + border.width / 2 - width / 2) < 0.001);
    assert.ok(Math.abs(border.y + border.height / 2 - height / 2) < 0.001);
  }
  const existing = addProjectComponent(createBlankProject('Existing tokens'), 'token', null, null);
  assert.ok(existing.instanceId);
  const instance = existing.project.instances[existing.instanceId];
  const [set] = listProjectDesignSets(existing.project);
  const document = set.studio.template.document!;
  assert.equal(document.widthMm, instance.properties.physicalWidthMm);
  assert.equal(document.heightMm, instance.properties.physicalHeightMm);
  const border = document.faces[0].layers.find((layer) => layer.name === 'Surface border')!;
  assert.ok(Math.abs(border.x + border.width / 2 - document.widthMm / 2) < 0.001);
  assert.ok(Math.abs(border.y + border.height / 2 - document.heightMm / 2) < 0.001);
});

test('legacy standalone cards stay reachable by their physical IDs and copy into a valid deck', () => {
  const deck = addProjectComponent(createBlankProject('Standalone card'), 'deck', null, null);
  const card = addProjectComponent(deck.project, 'card', deck.instanceId!, null);
  assert.ok(card.instanceId);
  const id = card.instanceId;
  const instance = {
    ...card.project.instances[id],
    parentId: null,
    properties: { ...card.project.instances[id].properties, quantity: 4 },
  };
  const project = { ...card.project, rootInstanceIds: [id], instances: { [id]: instance } };
  const [set] = listProjectDesignSets(project);
  assert.equal(set.id, id);
  assert.equal(set.instanceId, id);
  assert.equal(set.kind, 'card');
  assert.equal(set.studio.rows[0].id, id);
  assert.equal(set.studio.rows[0].copies, 4);
  const revised = setProjectComponentDesign(project, id, {
    ...set.studio,
    rows: [{ ...set.studio.rows[0], copies: 7 }],
  });
  assert.equal(revised.instances[id].properties.quantity, 7);
  const copy = duplicateStudioComponent(revised, id);
  assert.equal(copy.project.instances[copy.instanceId].componentType, 'deck');
  assert.equal(copy.project.instances[id].componentType, 'card');
  assert.equal(listProjectDesignSets(copy.project).length, 2);
});
