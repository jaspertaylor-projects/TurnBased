/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCardStudio, createCardRow } from '../cardStudio/model';
import { createTemplateDocument, createTemplateLayer } from '../templateStudio/model';
import { buildComponentPrintHtml } from './print';
import { buildComponentPrintLayout } from './printLayout';

const duplexDocument = () => {
  const document = createTemplateDocument('card');
  document.widthMm = 60;
  document.heightMm = 90;
  document.faces = [
    { id: 'front', name: 'Front', background: '#ffffff', layers: [] },
    { id: 'back', name: 'Back', background: '#234b34', layers: [] },
  ];
  return document;
};

test('duplex keeps row identities and mirrors back positions on a partial final sheet', () => {
  const document = duplexDocument();
  const rows = [
    createCardRow({ id: 'first', title: 'First', copies: 9 }),
    createCardRow({ id: 'last', title: 'Last', copies: 1 }),
  ];
  const layout = buildComponentPrintLayout(document, rows, 'a4', { duplex: true });
  assert.equal(layout.pages.length, 4);
  assert.deepEqual(
    layout.pages.map((page) => page.side),
    ['front', 'back', 'front', 'back'],
  );
  assert.deepEqual(
    layout.pages.map((page) => page.placements.length),
    [9, 9, 1, 1],
  );
  for (let page = 0; page < layout.pages.length; page += 2) {
    layout.pages[page].placements.forEach((front, index) => {
      const back = layout.pages[page + 1].placements[index];
      assert.equal(back.rowId, front.rowId);
      assert.equal(back.copyNumber, front.copyNumber);
      assert.equal(back.faceId, 'back');
      assert.equal(back.xMm, 210 - front.xMm - front.widthMm);
      assert.equal(back.yMm, front.yMm);
    });
  }
  assert.ok(layout.pages[3].placements[0].xMm > layout.pages[2].placements[0].xMm);
});

test('large boards preserve millimeters, cover the full board, and overlap neighboring assembly tiles', () => {
  const document = createTemplateDocument('board');
  document.widthMm = 400;
  document.heightMm = 400;
  document.faces = [document.faces[0]];
  const layout = buildComponentPrintLayout(document, [createCardRow({ title: 'Board' })]);
  assert.equal(layout.tiled, true);
  assert.equal(layout.pages.length, 6);
  assert.equal(layout.componentWidthMm, 400);
  assert.equal(layout.componentHeightMm, 400);
  assert.equal(layout.overlapMm, 10);
  const placements = layout.pages.map((page) => page.placements[0]);
  assert.equal(placements[0].widthMm, 190);
  assert.equal(placements[1].sourceXMm, 180);
  assert.equal(placements[3].sourceYMm, 267);
  assert.equal(placements[0].sourceXMm + placements[0].widthMm - placements[1].sourceXMm, 10);
  assert.equal(placements[0].sourceYMm + placements[0].heightMm - placements[3].sourceYMm, 10);
  assert.equal(Math.max(...placements.map((item) => item.sourceXMm + item.widthMm)), 400);
  assert.equal(Math.max(...placements.map((item) => item.sourceYMm + item.heightMm)), 400);
  for (const placement of placements) {
    assert.ok(placement.xMm >= 10 && placement.xMm + placement.widthMm <= 200);
    assert.ok(placement.yMm >= 10 && placement.yMm + placement.heightMm <= 287);
  }
});

test('tiled duplex uses matching physical regions, including narrow edge tiles', () => {
  const document = duplexDocument();
  document.widthMm = 300;
  document.heightMm = 180;
  const layout = buildComponentPrintLayout(document, [createCardRow({ title: 'Two-sided mat' })], 'a4', {
    duplex: true,
  });
  assert.equal(layout.pages.length, 4);
  for (let index = 0; index < 4; index += 2) {
    const front = layout.pages[index].placements[0];
    const back = layout.pages[index + 1].placements[0];
    assert.equal(back.sourceXMm, 300 - front.sourceXMm - front.widthMm);
    assert.equal(back.xMm, 210 - front.xMm - front.widthMm);
    assert.equal(back.widthMm, front.widthMm);
  }
  assert.equal(layout.pages[2].placements[0].widthMm, 120);
});

test('all-face sheets include every face while bleed and Letter dimensions remain exact', () => {
  const document = duplexDocument();
  document.bleedMm = 3;
  document.faces.push({ ...document.faces[0], id: 'alternate', name: 'Alternate' });
  const layout = buildComponentPrintLayout(document, [createCardRow({ title: 'Piece' })], 'letter', {
    faceId: 'all',
    includeBleed: true,
  });
  assert.equal(layout.paperWidthMm, 215.9);
  assert.equal(layout.paperHeightMm, 279.4);
  assert.equal(layout.componentWidthMm, 66);
  assert.equal(layout.componentHeightMm, 96);
  assert.deepEqual(
    layout.pages.map((page) => page.placements[0].faceId),
    ['front', 'back', 'alternate'],
  );
});

test('portable component HTML includes shaped cuts, isolated SVG IDs, escaped titles and deduplicated artwork', () => {
  const document = duplexDocument();
  document.trimShape = 'ellipse';
  const layer = createTemplateLayer('image', document);
  assert.equal(layer.type, 'image');
  if (layer.type !== 'image') throw new Error('Expected image layer');
  layer.source = '{{artUrl}}';
  document.faces[0].layers = [layer];
  const artUrl = 'data:image/png;base64,YWFhYQ==';
  const studio = {
    ...createDefaultCardStudio(),
    rows: [createCardRow({ title: 'Artwork', artUrl, copies: 3 })],
  };
  studio.template.document = document;
  const html = buildComponentPrintHtml(studio, '<unsafe title>');
  assert.equal(html.split(artUrl).length - 1, 1);
  assert.match(html, /&lt;unsafe title&gt;/);
  assert.match(html, /<ellipse[^>]+stroke-dasharray/);
  assert.match(html, /width:210mm;height:297mm/);
  assert.match(html, /data-print-asset="print-art-1"/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('invalid print jobs fail with actionable errors rather than producing incomplete sheets', () => {
  const document = duplexDocument();
  assert.throws(() => buildComponentPrintLayout(document, []), /at least one copy/);
  assert.throws(
    () =>
      buildComponentPrintLayout(document, [createCardRow({ title: 'Piece' })], 'a4', {
        faceId: 'deleted-face',
      }),
    /no longer exists/,
  );
  assert.throws(
    () =>
      buildComponentPrintLayout(
        { ...document, faces: [document.faces[0]] },
        [createCardRow({ title: 'Piece' })],
        'a4',
        { duplex: true },
      ),
    /back face/,
  );
  assert.throws(
    () =>
      buildComponentPrintLayout({ ...document, widthMm: 2000, heightMm: 2000 }, [
        createCardRow({ title: 'Huge board', copies: 99 }),
      ]),
    /500 pages/,
  );
});
