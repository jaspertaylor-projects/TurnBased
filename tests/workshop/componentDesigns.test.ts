import { beforeEach, describe, expect, it } from 'vitest';
import { createBlankProject } from '../../apps/web/src/editor/project';
import { createCardRow, createDefaultCardStudio } from '../../apps/web/src/editor/cardStudio/model';
import {
  createStudioComponent,
  duplicateStudioComponent,
  LEGACY_DESIGN_SET_ID,
  listProjectDesignSets,
  materializeLegacyDesign,
  removeStudioComponent,
  setProjectComponentDesign,
} from '../../apps/web/src/editor/componentStudio/model';
import { createTemplateLayer } from '../../apps/web/src/editor/templateStudio/model';
import { saveEditorProject, loadEditorProject } from '../../apps/web/src/editor/storage';
import { buildPreviewRuntime } from '../../apps/web/src/editor/runtime';
import {
  commitActiveProjectVersion,
  listProjectGitCommits,
  restoreProjectFromCommit,
} from '../../apps/web/src/editor/git';
import { createDesignArchive, importDesignArchive } from '../../apps/web/src/editor/versions/archive';
import { getProjectLabCards } from '../../apps/web/src/editor/playtest/material';
import { buildComponentPrintLayout } from '../../apps/web/src/editor/componentStudio/print';
import { getEditorDb } from '../../apps/web/src/editor/persistence/idb';
import type { EditorProject } from '../../apps/web/src/editor/types';

async function clearBrowserStorage() {
  window.localStorage.clear();
  const db = await getEditorDb();
  if (db)
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([...db.objectStoreNames], 'readwrite');
      [...db.objectStoreNames].forEach((store) => transaction.objectStore(store).clear());
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
}
beforeEach(clearBrowserStorage);
const makeProject = (): EditorProject => ({
  ...createBlankProject('Every kind of component'),
  phase: 'ready',
});
const embeddedArt = `data:image/png;base64,${Buffer.from('portable artwork'.repeat(160)).toString('base64')}`;

function expectPhysicalDimensions(project: EditorProject) {
  for (const set of listProjectDesignSets(project)) {
    const document = set.studio.template.document!;
    const instance = project.instances[set.instanceId!];
    expect(instance.properties.physicalWidthMm).toBe(document.widthMm);
    expect(instance.properties.physicalHeightMm).toBe(document.heightMm);
    expect(set.studio.template.widthMm).toBe(document.widthMm);
    expect(set.studio.template.heightMm).toBe(document.heightMm);
    const layout = buildComponentPrintLayout(document, set.studio.rows);
    expect(layout.componentWidthMm).toBe(document.widthMm);
    expect(layout.componentHeightMm).toBe(document.heightMm);
    if (set.kind === 'board') {
      expect(document.widthMm).toBe(420);
      expect(document.heightMm).toBe(297);
      expect(layout.tiled).toBe(true);
    }
  }
}

describe('unified component persistence', () => {
  it('keeps authored layers, faces, dimensions and rows for every family through reload, checkpoints and a fresh-browser archive import', async () => {
    let project = makeProject();
    for (const kind of ['card', 'board', 'token', 'tile', 'mat', 'piece'] as const) {
      const created = createStudioComponent(project, kind, `${kind} family`);
      project = created.project;
      const studio = structuredClone(project.componentDesigns![created.instanceId]);
      const document = studio.template.document!;
      document.widthMm = kind === 'board' ? 420 : document.widthMm + 2;
      document.heightMm = kind === 'board' ? 297 : document.heightMm + 3;
      document.faces[0].background = '#f8e6cc';
      const text = createTemplateLayer('text', document);
      if (text.type !== 'text') throw new Error('Expected text layer');
      text.id = `${kind}-test-text`;
      text.content = `${kind} {{title}} / {{points}}`;
      text.x = 4.5;
      text.rotation = 12;
      document.faces[0].layers.push(text);
      const image = createTemplateLayer('image', document);
      if (image.type !== 'image') throw new Error('Expected image layer');
      image.id = `${kind}-test-art`;
      image.source = embeddedArt;
      document.faces.push({
        id: `${kind}-reverse`,
        name: 'Custom reverse',
        background: '#234b34',
        layers: [image],
      });
      studio.rows = [
        createCardRow({
          id: `${kind}-row`,
          title: `${kind} prototype`,
          copies: 3,
          body: 'Designer-authored content',
          cost: '2',
          artUrl: embeddedArt,
          customFields: { points: '4', terrain: 'woodland' },
        }),
      ];
      studio.customColumns = ['points', 'terrain'];
      project = setProjectComponentDesign(project, created.instanceId, studio);
    }
    expect(
      listProjectDesignSets(project)
        .map((set) => set.kind)
        .sort(),
    ).toEqual(['board', 'card', 'mat', 'piece', 'tile', 'token']);
    expectPhysicalDimensions(project);
    await saveEditorProject(project);
    const reloaded = await loadEditorProject(project.id);
    expect(reloaded?.componentDesigns).toEqual(project.componentDesigns);
    expectPhysicalDimensions(reloaded!);
    const checkpoint = await commitActiveProjectVersion(
      project,
      buildPreviewRuntime(project),
      'All six component families',
    );
    const restored = await restoreProjectFromCommit(project.id, checkpoint.commit.commitSha);
    expect(restored.componentDesigns).toEqual(project.componentDesigns);
    expectPhysicalDimensions(restored);
    const archive = await createDesignArchive(project);
    expect(Object.values(JSON.parse(archive).assets)).toEqual([embeddedArt]);
    await clearBrowserStorage();
    const imported = await importDesignArchive(archive);
    expect(imported.componentDesigns).toEqual(project.componentDesigns);
    expectPhysicalDimensions(imported);
    expect((await loadEditorProject(imported.id))?.componentDesigns).toEqual(project.componentDesigns);
    const [importedCheckpoint] = await listProjectGitCommits(imported.id);
    const importedRestore = await restoreProjectFromCommit(imported.id, importedCheckpoint.commitSha);
    expect(importedRestore.componentDesigns).toEqual(project.componentDesigns);
    expectPhysicalDimensions(importedRestore);
    expect(
      getProjectLabCards(imported).map((card) => ({ points: card.points, quantity: card.quantity })),
    ).toEqual([{ points: 4, quantity: 3 }]);
  });

  it('materializes a legacy deck once while preserving row identities, artwork, quantities and old snapshots', async () => {
    const project = {
      ...makeProject(),
      cardStudio: {
        ...createDefaultCardStudio(),
        rows: [
          createCardRow({
            id: 'existing-fox',
            title: 'Fox',
            copies: 4,
            artUrl: embeddedArt,
            customFields: { points: '2' },
          }),
          createCardRow({ id: 'existing-owl', title: 'Owl', copies: 2, customFields: { points: '3' } }),
        ],
      },
    };
    const checkpoint = await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Legacy deck');
    expect(listProjectDesignSets(project).map((set) => set.id)).toEqual([LEGACY_DESIGN_SET_ID]);
    const migrated = materializeLegacyDesign(project);
    expect(migrated.project.cardStudio).toBeUndefined();
    const [deck] = listProjectDesignSets(migrated.project);
    expect(listProjectDesignSets(migrated.project)).toHaveLength(1);
    expect(deck.instanceId).toBe(migrated.instanceId);
    expect(deck.studio.rows).toEqual(project.cardStudio.rows);
    expect(getProjectLabCards(migrated.project).reduce((sum, card) => sum + card.quantity, 0)).toBe(6);
    expect(() => materializeLegacyDesign(migrated.project)).toThrow(/no longer available/);
    await saveEditorProject(migrated.project);
    const loaded = await loadEditorProject(project.id);
    expect(loaded?.cardStudio).toBeUndefined();
    expect(listProjectDesignSets(loaded!)).toHaveLength(1);
    expect(listProjectDesignSets(loaded!)[0].studio.rows.map((row) => row.id)).toEqual([
      'existing-fox',
      'existing-owl',
    ]);
    const historic = await restoreProjectFromCommit(project.id, checkpoint.commit.commitSha);
    expect(historic.cardStudio?.rows).toEqual(project.cardStudio.rows);
    expect(listProjectDesignSets(historic)).toHaveLength(1);
  });

  it('duplicates an independent editable design and removes it without deleting or altering the original', async () => {
    const created = createStudioComponent(makeProject(), 'token', 'Acorn tokens');
    const project = created.project;
    const original = structuredClone(project.componentDesigns![created.instanceId]);
    const duplicated = duplicateStudioComponent(project, created.instanceId);
    expect(duplicated.instanceId).not.toBe(created.instanceId);
    expect(listProjectDesignSets(duplicated.project)).toHaveLength(2);
    const edited = structuredClone(duplicated.project.componentDesigns![duplicated.instanceId]);
    edited.rows[0].copies = 7;
    edited.template.document!.faces[0].background = '#abcdef';
    const revised = setProjectComponentDesign(duplicated.project, duplicated.instanceId, edited);
    expect(revised.componentDesigns![created.instanceId]).toEqual(original);
    expect(revised.componentDesigns![duplicated.instanceId].rows[0].copies).toBe(7);
    const removed = removeStudioComponent(revised, duplicated.instanceId);
    expect(removed.componentDesigns![duplicated.instanceId]).toBeUndefined();
    expect(removed.instances[duplicated.instanceId]).toBeUndefined();
    expect(removed.componentDesigns![created.instanceId]).toEqual(original);
    await saveEditorProject(removed);
    const loaded = await loadEditorProject(removed.id);
    expect(listProjectDesignSets(loaded!)).toHaveLength(1);
    expect(loaded?.componentDesigns![created.instanceId]).toEqual(original);
  });
});
