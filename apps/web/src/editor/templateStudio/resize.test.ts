/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemplateDocument, createTemplateLayer } from './model';
import { resizeTemplateDocument } from './resize';

test('artwork resize scales geometry and every proportional style while keeping physical print margins', () => {
  const document = createTemplateDocument('board');
  document.faces[0].layers = ['text', 'image', 'shape', 'grid', 'track'].map((type) => ({
    ...createTemplateLayer(type as 'text' | 'image' | 'shape' | 'grid' | 'track', document),
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    strokeWidth: 2,
  }));
  const before = structuredClone(document);
  const resized = resizeTemplateDocument(document, document.widthMm * 2, document.heightMm * 3, true);
  resized.faces[0].layers.forEach((layer, index) => {
    const original = document.faces[0].layers[index];
    assert.equal(layer.x, 20);
    assert.equal(layer.y, 60);
    assert.equal(layer.width, 60);
    assert.equal(layer.height, 120);
    assert.equal(layer.strokeWidth, 4);
    assert.equal(layer.rotation, original.rotation);
    if (layer.type === 'text' && original.type === 'text')
      assert.equal(layer.fontSize, original.fontSize * 2);
    if (
      (layer.type === 'shape' || layer.type === 'image') &&
      (original.type === 'shape' || original.type === 'image')
    )
      assert.equal(layer.radius, original.radius * 2);
    if (layer.type === 'grid' && original.type === 'grid') assert.equal(layer.gap, original.gap * 2);
  });
  assert.equal(resized.bleedMm, document.bleedMm);
  assert.equal(resized.safeMm, document.safeMm);
  assert.deepEqual(document, before);
});

test('surface-only resize preserves authored artwork exactly', () => {
  const document = createTemplateDocument('token');
  const resized = resizeTemplateDocument(document, 15, 25, false);
  assert.equal(resized.widthMm, 15);
  assert.equal(resized.heightMm, 25);
  assert.equal(resized.faces, document.faces);
});
