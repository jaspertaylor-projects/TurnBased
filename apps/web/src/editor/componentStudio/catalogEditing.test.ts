import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditorComponentActions } from '../editorComponentActions';
import { createBlankProject } from '../project';
import type { EditorProject } from '../types';
import type { CatalogComponentSelection } from '../sections/rules/ComponentPicker';
import { createStudioComponent } from './model';

const selection: CatalogComponentSelection = {
  type: 'board',
  category: 'boards',
  componentName: 'The woodland trail',
  gameDescription: 'Our shared map',
  productSlug: 'new-board-size',
  variantId: 'new-board-variant',
  productTitle: 'A3 board',
  variantTitle: 'Folded board',
  physicalWidthMm: 420,
  physicalHeightMm: 297,
  maxCards: null,
  priceEach: null,
};

function actions(project: EditorProject) {
  const changes: EditorProject[] = [];
  const notices: unknown[] = [];
  const editor = createEditorComponentActions({
    project,
    paletteOwnerId: null,
    selectedComponentId: null,
    setSelectedComponentId: () => {},
    setActiveSection: () => {},
    onChange: (next) => changes.push(next),
    setNotice: (notice) => notices.push(notice),
  });
  return { editor, changes, notices };
}

test('rulebook supplier edits keep physical and template dimensions together without replacing artwork', () => {
  const created = createStudioComponent(createBlankProject('Supplier edit'), 'board', 'My board');
  const original = created.project.componentDesigns![created.instanceId];
  const { editor, changes, notices } = actions(created.project);
  editor.handleUpdateCatalogComponent(created.instanceId, selection);
  assert.equal(changes.length, 1);
  assert.deepEqual(notices, []);
  const updated = changes[0];
  const instance = updated.instances[created.instanceId];
  const studio = updated.componentDesigns![created.instanceId];
  assert.equal(instance.displayName, selection.componentName);
  assert.equal(instance.notes, selection.gameDescription);
  assert.equal(instance.properties.catalogSlug, selection.productSlug);
  assert.equal(instance.properties.catalogVariantId, selection.variantId);
  assert.equal(instance.properties.physicalWidthMm, 420);
  assert.equal(instance.properties.physicalHeightMm, 297);
  assert.equal(studio.template.widthMm, 420);
  assert.equal(studio.template.heightMm, 297);
  assert.equal(studio.template.document!.widthMm, 420);
  assert.equal(studio.template.document!.heightMm, 297);
  assert.deepEqual(studio.template.document!.faces, original.template.document!.faces);
  assert.deepEqual(studio.rows, original.rows);
  assert.equal(created.project.instances[created.instanceId].displayName, 'My board');
  assert.notEqual(original.template.widthMm, studio.template.widthMm);
});

test('supplier edits reject a different component family without changing the project', () => {
  const created = createStudioComponent(createBlankProject('Wrong family'), 'card', 'My deck');
  const { editor, changes, notices } = actions(created.project);
  editor.handleUpdateCatalogComponent(created.instanceId, selection);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, ['Choose a catalog item from the same component genre.']);
});
