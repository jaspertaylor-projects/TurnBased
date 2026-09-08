import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemplateDocument, createTemplateLayer } from './model';
import {
  alignTemplateLayers,
  arrangeTemplateLayers,
  duplicateTemplateLayers,
  snapTemplateValue,
  updateTemplateLayers,
} from './editorActions';
import type { TemplateLayer } from './types';

const document = createTemplateDocument('card');
function layer(id: string, x = 0, width = 10, locked = false): TemplateLayer {
  return { ...createTemplateLayer('shape', document), id, x, y: 5, width, height: 10, locked };
}

test('layer edits protect locked artwork and leave other faces unchanged', () => {
  const face = { ...document.faces[0], layers: [layer('editable'), layer('locked', 0, 10, true)] };
  const other = { ...face, id: 'other-face' };
  const original = { ...document, faces: [face, other] };
  const updated = updateTemplateLayers(original, face.id, ['editable', 'locked'], (item) => ({
    ...item,
    x: 12,
  }));
  assert.equal(updated.faces[0].layers[0].x, 12);
  assert.strictEqual(updated.faces[0].layers[1], face.layers[1]);
  assert.strictEqual(updated.faces[1], other);
  assert.equal(original.faces[0].layers[0].x, 0);
});

test('moving a group in the stack preserves the relative ordering of its layers', () => {
  const layers = ['a', 'b', 'c', 'd', 'e'].map((id) => layer(id));
  const ids = (items: TemplateLayer[]) => items.map((item) => item.id);
  assert.deepEqual(ids(arrangeTemplateLayers(layers, ['b', 'c'], 'up')), ['a', 'd', 'b', 'c', 'e']);
  assert.deepEqual(ids(arrangeTemplateLayers(layers, ['b', 'c'], 'down')), ['b', 'c', 'a', 'd', 'e']);
  assert.deepEqual(ids(arrangeTemplateLayers(layers, ['b', 'd'], 'front')), ['a', 'c', 'e', 'b', 'd']);
  assert.deepEqual(ids(arrangeTemplateLayers(layers, ['b', 'd'], 'back')), ['b', 'd', 'a', 'c', 'e']);
  assert.deepEqual(ids(layers), ['a', 'b', 'c', 'd', 'e']);
});

test('aligning one editable layer uses the component bounds and ignores a locked selection', () => {
  const layers = [layer('editable', 7, 20), layer('locked', 5, 10, true)];
  const aligned = alignTemplateLayers(layers, ['editable', 'locked'], 'center', 100, 80);
  assert.equal(aligned[0].x, 40);
  assert.strictEqual(aligned[1], layers[1]);
  assert.equal(alignTemplateLayers(layers, ['editable'], 'bottom', 100, 80)[0].y, 70);
});

test('distribution uses equal gaps across unequal widths without changing stack order', () => {
  const layers = [layer('right', 90, 10), layer('left', 0, 10), layer('middle', 20, 30)];
  const aligned = alignTemplateLayers(layers, ['left', 'middle', 'right'], 'distribute-x', 200, 100);
  assert.deepEqual(
    aligned.map((item) => item.id),
    ['right', 'left', 'middle'],
  );
  assert.deepEqual(
    aligned.map((item) => item.x),
    [90, 0, 35],
  );
  assert.strictEqual(alignTemplateLayers(layers, ['left', 'right'], 'distribute-x', 200, 100), layers);
});

test('duplicating a locked ornament creates independently editable artwork with new identity', () => {
  const original = [layer('ornament', 4, 12, true), layer('unselected')];
  const result = duplicateTemplateLayers(original, ['ornament'], 3);
  const copy = result.layers[2];
  assert.notEqual(copy.id, original[0].id);
  assert.deepEqual(result.ids, [copy.id]);
  assert.equal(copy.locked, false);
  assert.equal(copy.x, 7);
  assert.equal(copy.y, 8);
  assert.equal(original[0].locked, true);
  assert.strictEqual(result.layers[0], original[0]);
});

test('grid snapping handles negative positions and submillimeter free movement', () => {
  assert.equal(snapTemplateValue(-3.8, 2.5, true), -5);
  assert.equal(snapTemplateValue(1.37, 0.25, true), 1.25);
  assert.equal(snapTemplateValue(1.374, 2.5, false), 1.37);
  assert.equal(snapTemplateValue(1.374, 0, true), 1.37);
});
