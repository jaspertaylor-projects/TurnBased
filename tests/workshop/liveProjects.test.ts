import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "../../apps/web/src/editor/project";
import { loadEditorProject, loadEditorProjects, saveEditorProject } from "../../apps/web/src/editor/storage";
import { putBlob } from "../../apps/web/src/editor/persistence/blobStore";
import { getEditorDb } from "../../apps/web/src/editor/persistence/idb";
import {
  LIVE_PROJECTS_KEY,
  ProjectReadError,
  readLiveProject,
  readLiveProjects,
} from "../../apps/web/src/editor/persistence/liveProjects";
import * as imageBlobs from "../../apps/web/src/editor/persistence/imageBlobs";

beforeEach(async () => {
  window.localStorage.clear();
  const db = await getEditorDb();
  if (db)
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([...db.objectStoreNames], "readwrite");
      [...db.objectStoreNames].forEach((store) => transaction.objectStore(store).clear());
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
});

afterEach(() => vi.restoreAllMocks());

const makeProject = (name: string) => ({ ...createBlankProject(name), phase: "ready" as const });
function appendEntries(...entries: unknown[]) {
  const index = JSON.parse(window.localStorage.getItem(LIVE_PROJECTS_KEY) ?? '{"projects":[]}');
  window.localStorage.setItem(
    LIVE_PROJECTS_KEY,
    JSON.stringify({ projects: [...index.projects, ...entries] }),
  );
}
function pointer(id: string, name: string, snapshotHash: string) {
  return { storageVersion: 2, id, name, updatedAt: new Date().toISOString(), snapshotHash };
}

describe("isolated saved game recovery", () => {
  it("loads intact games beside missing and corrupt snapshots and reports each failed game", async () => {
    const healthy = makeProject("Healthy woodland");
    await saveEditorProject(healthy);
    appendEntries(
      pointer("missing-game", "Missing woodland", "f".repeat(64)),
      pointer("corrupt-game", "Corrupt woodland", await putBlob("not valid JSON")),
    );
    const originalIndex = window.localStorage.getItem(LIVE_PROJECTS_KEY);
    const warnings: ProjectReadError[] = [];
    const projects = await loadEditorProjects((warning) => warnings.push(warning));
    expect(projects.map((project) => project.id)).toEqual([healthy.id]);
    expect(warnings.map((warning) => warning.projectId)).toEqual(["missing-game", "corrupt-game"]);
    expect(warnings[0].message).toContain("Missing woodland");
    expect(warnings[0].message).toContain("missing from this browser");
    expect(warnings[1].message).toContain("Corrupt woodland");
    expect(warnings[1].message).toContain("unreadable JSON");
    expect(warnings.every((warning) => warning.message.includes("saved entry has been kept"))).toBe(true);
    expect(window.localStorage.getItem(LIVE_PROJECTS_KEY)).toBe(originalIndex);
  });

  it("opens a targeted healthy game without reading unrelated broken entries", async () => {
    const healthy = makeProject("Targeted woodland");
    await saveEditorProject(healthy);
    appendEntries(pointer("missing-game", "Missing woodland", "f".repeat(64)), null);
    expect((await readLiveProject(healthy.id))?.name).toBe(healthy.name);
    expect((await loadEditorProject(healthy.id))?.name).toBe(healthy.name);
    expect(await loadEditorProject("not-in-the-index")).toBeNull();
    await expect(loadEditorProject("missing-game")).rejects.toThrow("Missing woodland");
  });

  it("isolates hydration failures and retains the failed entry during subsequent healthy saves", async () => {
    const healthy = makeProject("Healthy game");
    const broken = makeProject("Artwork recovery");
    await saveEditorProject(healthy);
    await saveEditorProject(broken);
    const inflate = imageBlobs.inflateProjectImages;
    vi.spyOn(imageBlobs, "inflateProjectImages").mockImplementation(async (project) => {
      if (project.id === broken.id) throw new Error("The image store could not be read.");
      return inflate(project);
    });
    const warnings: ProjectReadError[] = [];
    expect(
      (await loadEditorProjects((warning) => warnings.push(warning))).map((project) => project.id),
    ).toEqual([healthy.id]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ projectId: broken.id, projectName: broken.name });
    expect(warnings[0].message).toContain("image store");
    await expect(loadEditorProject(broken.id)).rejects.toThrow("Artwork recovery");
    await saveEditorProject({ ...healthy, description: "A healthy edit" });
    expect(
      JSON.parse(window.localStorage.getItem(LIVE_PROJECTS_KEY)!).projects.map(
        (entry: { id: string }) => entry.id,
      ),
    ).toContain(broken.id);
  });

  it("isolates malformed index entries and invalid hydrated structure without erasing them", async () => {
    const healthy = makeProject("Healthy game");
    const malformed = { ...makeProject("Malformed seats"), seats: "not-an-array" };
    await saveEditorProject(healthy);
    appendEntries(null, pointer(malformed.id, malformed.name, await putBlob(JSON.stringify(malformed))));
    const originalIndex = window.localStorage.getItem(LIVE_PROJECTS_KEY);
    const warnings: ProjectReadError[] = [];
    const loaded = await loadEditorProjects((warning) => warnings.push(warning));
    expect(loaded.map((project) => project.id)).toEqual([healthy.id]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0].projectName).toBe("Saved game 2");
    expect(warnings[1].projectName).toBe("Malformed seats");
    expect(window.localStorage.getItem(LIVE_PROJECTS_KEY)).toBe(originalIndex);
    await saveEditorProject({ ...healthy, description: "Preserve the malformed entry" });
    expect(JSON.parse(window.localStorage.getItem(LIVE_PROJECTS_KEY)!).projects).toContain(null);
  });

  it("reports mismatched snapshot identities and remains compatible with legacy inline games", async () => {
    const legacy = makeProject("Legacy inline");
    const unrelated = makeProject("Wrong project");
    appendEntries(
      legacy,
      pointer("expected-id", "Mismatched game", await putBlob(JSON.stringify(unrelated))),
    );
    const warnings: ProjectReadError[] = [];
    expect(
      (await readLiveProjects((warning) => warnings.push(warning))).map((project) => project.id),
    ).toEqual([legacy.id]);
    expect(warnings[0].projectName).toBe("Mismatched game");
    expect(warnings[0].message).toContain("not a valid game design");
  });
});
