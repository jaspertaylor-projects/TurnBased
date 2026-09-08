import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultCardStudio, createCardRow } from "./model";
import {
  aiBaselineConflict,
  applyAITableEdits,
  captureAITableBaseline,
  validateAITableEdits,
} from "./aiTableModel";
const identity = "game:deck";
function studio() {
  return {
    ...createDefaultCardStudio(),
    customColumns: ["points", "flavor"],
    rows: [
      createCardRow({
        id: "a",
        title: "Jam",
        body: "Old jam",
        copies: 4,
        customFields: { points: "1" },
      }),
      createCardRow({
        id: "b",
        title: "Tea",
        body: "Old tea",
        copies: 2,
        customFields: { points: "2" },
      }),
    ],
  };
}
test("whole-column updates preserve IDs, order, copies, templates and concurrent unrelated cells", () => {
  const before = studio(),
    baseline = captureAITableBaseline(
      before,
      { field: "body", rowIds: ["a", "b"] },
      identity,
    );
  const latest = {
    ...before,
    template: { ...before.template, accent: "#123456" },
    rows: before.rows.map((row) =>
      row.id === "a" ? { ...row, cost: "3" } : row,
    ),
  };
  const after = applyAITableEdits(
    latest,
    baseline,
    [
      { rowId: "b", value: "New tea" },
      { rowId: "a", value: "New jam" },
    ],
    identity,
  );
  assert.deepEqual(
    after.rows.map((row) => [row.id, row.body, row.copies]),
    [
      ["a", "New jam", 4],
      ["b", "New tea", 2],
    ],
  );
  assert.equal(after.rows[0].cost, "3");
  assert.equal(after.template.accent, "#123456");
  assert.equal(before.rows[0].body, "Old jam");
});
test("single custom cells merge independently and an inverse batch preserves later unrelated edits", () => {
  const before = studio(),
    target = { field: "custom:flavor" as const, rowIds: ["b"] },
    baseline = captureAITableBaseline(before, target, identity);
  const after = applyAITableEdits(
    before,
    baseline,
    [{ rowId: "b", value: "Moonlit tea" }],
    identity,
  );
  assert.deepEqual(after.rows[1].customFields, {
    points: "2",
    flavor: "Moonlit tea",
  });
  assert.equal(after.rows[0], before.rows[0]);
  const undo = captureAITableBaseline(after, target, identity);
  const latest = {
    ...after,
    rows: after.rows.map((row) =>
      row.id === "a" ? { ...row, title: "New jam" } : row,
    ),
  };
  const undone = applyAITableEdits(
    latest,
    undo,
    [{ rowId: "b", value: "" }],
    identity,
    true,
  );
  assert.equal(undone.rows[0].title, "New jam");
  assert.equal(undone.rows[1].customFields.flavor, "");
});
test("target changes, deletion, added rows, reordered rows, removed fields and different identities invalidate atomically", () => {
  const before = studio(),
    baseline = captureAITableBaseline(
      before,
      { field: "custom:points", rowIds: ["a", "b"] },
      identity,
    );
  for (const changed of [
    { ...before, rows: before.rows.slice(1) },
    { ...before, rows: [...before.rows].reverse() },
    { ...before, rows: [...before.rows, createCardRow({ id: "c" })] },
    { ...before, customColumns: [] },
    {
      ...before,
      rows: before.rows.map((row) => ({
        ...row,
        customFields: { points: "9" },
      })),
    },
  ]) {
    assert(aiBaselineConflict(changed, baseline, identity));
    assert.throws(() =>
      applyAITableEdits(
        changed,
        baseline,
        [
          { rowId: "a", value: "4" },
          { rowId: "b", value: "5" },
        ],
        identity,
      ),
    );
  }
  assert(aiBaselineConflict(before, baseline, "other-game:deck"));
});
test("malformed/duplicate/extra/missing edits and invalid numeric values cannot partially apply", () => {
  const before = studio(),
    target = { field: "copies" as const, rowIds: ["a", "b"] },
    baseline = captureAITableBaseline(before, target, identity);
  for (const edits of [
    [{ rowId: "a", value: 3 }],
    [
      { rowId: "a", value: 3 },
      { rowId: "a", value: 2 },
    ],
    [
      { rowId: "a", value: 3 },
      { rowId: "other", value: 2 },
    ],
    [
      { rowId: "a", value: 3 },
      { rowId: "b", value: 100 },
    ],
    [
      { rowId: "a", value: 3 },
      { rowId: "b", value: 1.5 },
    ],
  ])
    assert.throws(() => applyAITableEdits(before, baseline, edits, identity));
  assert.deepEqual(
    before.rows.map((row) => row.copies),
    [4, 2],
  );
  assert.throws(() =>
    validateAITableEdits([{ rowId: "a", value: { bad: true } }], {
      field: "body",
      rowIds: ["a"],
    }),
  );
  const full = {
    ...before,
    rows: Array.from({ length: 30 }, (_, i) =>
      createCardRow({ id: String(i), title: "Card", copies: 60 }),
    ),
  };
  const whole = captureAITableBaseline(
    full,
    { field: "copies", rowIds: full.rows.map((row) => row.id) },
    identity,
  );
  assert.throws(
    () =>
      applyAITableEdits(
        full,
        whole,
        full.rows.map((row) => ({ rowId: row.id, value: 99 })),
        identity,
      ),
    /at most 2000/,
  );
});
test("undo is rejected after a target edit, and can restore an originally empty title", () => {
  const before = studio();
  before.rows[0].title = "";
  const target = { field: "title" as const, rowIds: ["a"] };
  const baseline = captureAITableBaseline(before, target, identity);
  const after = applyAITableEdits(
    before,
    baseline,
    [{ rowId: "a", value: "Filled title" }],
    identity,
  );
  const undo = captureAITableBaseline(after, target, identity);
  assert.equal(
    applyAITableEdits(after, undo, [{ rowId: "a", value: "" }], identity, true)
      .rows[0].title,
    "",
  );
  const changed = {
    ...after,
    rows: after.rows.map((row) =>
      row.id === "a" ? { ...row, title: "Human edit" } : row,
    ),
  };
  assert.throws(
    () =>
      applyAITableEdits(
        changed,
        undo,
        [{ rowId: "a", value: "" }],
        identity,
        true,
      ),
    /selected value changed/,
  );
});
