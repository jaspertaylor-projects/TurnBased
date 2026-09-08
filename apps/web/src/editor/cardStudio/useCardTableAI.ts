import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EditorProject } from "../types";
import type { CardStudioState } from "./types";
import {
  aiBaselineConflict,
  applyAITableEdits,
  captureAITableBaseline,
  type AITableBaseline,
  type AITableEdit,
  type AITableField,
} from "./aiTableModel";
import { generateAITableEdits } from "./aiTableService";

export interface AITableSelection {
  field: AITableField;
  rowId?: string;
}
interface Proposal {
  baseline: AITableBaseline;
  edits: AITableEdit[];
  model: string;
}
interface PendingRequest {
  controller: AbortController;
  baseline: AITableBaseline;
}
export function useCardTableAI(
  project: EditorProject,
  studio: CardStudioState,
  identity: string,
  onUpdate: (updater: (studio: CardStudioState) => CardStudioState) => void,
) {
  const latest = useRef({ project, studio, identity, onUpdate });
  useLayoutEffect(() => {
    latest.current = { project, studio, identity, onUpdate };
  });
  const [selection, setSelection] = useState<AITableSelection | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [undo, setUndo] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<PendingRequest | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.controller.abort();
      request.current = null;
    };
  }, []);
  useEffect(() => {
    const pending = request.current;
    const conflict =
      pending && aiBaselineConflict(studio, pending.baseline, identity);
    if (conflict) {
      pending.controller.abort();
      request.current = null;
      setBusy(false);
      setError(conflict);
    }
    if (proposal) {
      const issue = aiBaselineConflict(studio, proposal.baseline, identity);
      if (issue) {
        setProposal(null);
        setError(issue);
      }
    }
    if (undo && aiBaselineConflict(studio, undo.baseline, identity))
      setUndo(null);
  }, [studio, identity, proposal, undo]);
  function close() {
    request.current?.controller.abort();
    request.current = null;
    setBusy(false);
    setSelection(null);
    setProposal(null);
    setError("");
  }
  function open(next: AITableSelection) {
    close();
    setSelection(next);
    setNotice("");
  }
  async function generate(prompt: string, modelId: string) {
    if (!selection) return;
    const current = latest.current;
    request.current?.controller.abort();
    request.current = null;
    setError("");
    setProposal(null);
    setBusy(true);
    let pending: PendingRequest | null = null;
    try {
      const baseline = captureAITableBaseline(
        current.studio,
        {
          field: selection.field,
          rowIds: selection.rowId
            ? [selection.rowId]
            : current.studio.rows.map((row) => row.id),
        },
        current.identity,
      );
      pending = { controller: new AbortController(), baseline };
      request.current = pending;
      const response = await generateAITableEdits(
        current.project,
        current.studio,
        baseline.target,
        prompt,
        modelId,
        pending.controller.signal,
      );
      if (
        !live.current ||
        request.current !== pending ||
        pending.controller.signal.aborted
      )
        return;
      const conflict = aiBaselineConflict(
        latest.current.studio,
        baseline,
        latest.current.identity,
      );
      if (conflict) throw new Error(conflict);
      // Validate aggregate copies and every value before enabling Apply.
      applyAITableEdits(
        latest.current.studio,
        baseline,
        response.edits,
        latest.current.identity,
      );
      setProposal({ baseline, ...response });
    } catch (issue) {
      if (
        live.current &&
        request.current === pending &&
        !pending?.controller.signal.aborted
      )
        setError(
          issue instanceof Error ? issue.message : "The AI request failed.",
        );
    } finally {
      if (live.current && request.current === pending) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  function apply() {
    if (!proposal) return;
    try {
      latest.current.onUpdate((current) => {
        const next = applyAITableEdits(
          current,
          proposal.baseline,
          proposal.edits,
          latest.current.identity,
        );
        setUndo({
          baseline: captureAITableBaseline(
            next,
            proposal.baseline.target,
            latest.current.identity,
          ),
          edits: proposal.baseline.target.rowIds.map((rowId, i) => ({
            rowId,
            value: proposal.baseline.values[i],
          })),
          model: proposal.model,
        });
        return next;
      });
      const count = proposal.edits.length;
      close();
      setNotice(
        `Applied AI suggestions to ${count} ${count === 1 ? "cell" : "cells"}.`,
      );
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "The table changed. Generate a fresh suggestion.",
      );
    }
  }
  function undoLast() {
    if (!undo) return;
    try {
      latest.current.onUpdate((current) =>
        applyAITableEdits(
          current,
          undo.baseline,
          undo.edits,
          latest.current.identity,
          true,
        ),
      );
      setUndo(null);
      setNotice("Undid the last AI edit.");
    } catch (issue) {
      setUndo(null);
      setNotice(
        issue instanceof Error
          ? issue.message
          : "The table changed; AI undo is unavailable.",
      );
    }
  }
  return {
    selection,
    proposal,
    busy,
    error,
    notice,
    canUndo: !!undo && !aiBaselineConflict(studio, undo.baseline, identity),
    open,
    close,
    generate,
    apply,
    undoLast,
  };
}
