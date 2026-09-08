import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  RULES_WRITER_MODEL_OPTIONS,
  getModelLabel,
  resolveRulesWriterModel,
} from "../aiModelCatalog";
import type { CardStudioState } from "./types";
import { aiFieldLabel } from "./aiTableModel";
import type { useCardTableAI } from "./useCardTableAI";
import "./cardTableAI.css";

export function CardTableAIDialog({
  ai,
  studio,
  defaultModel,
}: {
  ai: ReturnType<typeof useCardTableAI>;
  studio: CardStudioState;
  defaultModel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(resolveRulesWriterModel(defaultModel));
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  if (!ai.selection) return null;
  const selection = ai.selection;
  const field = aiFieldLabel(selection.field);
  const row = studio.rows.find((item) => item.id === selection.rowId);
  const count = row ? 1 : studio.rows.length;
  return (
    <dialog
      ref={dialog}
      className="table-ai-dialog"
      aria-label="AI table editor"
      onCancel={(event) => {
        event.preventDefault();
        ai.close();
      }}
    >
      <header>
        <div data-layout="tableAIHeading">
          <span className="card-studio-eyebrow">
            A little help with the details
          </span>
          <h2>
            <Sparkles size={20} /> Write {field} with AI
          </h2>
          <p>
            {row
              ? `One cell · ${row.title || "Untitled design"}`
              : `Whole column · ${count} designs`}
          </p>
        </div>
        <button
          type="button"
          className="card-studio-icon-button"
          aria-label="Close AI table editor"
          onClick={ai.close}
        >
          <X size={18} />
        </button>
      </header>
      <div data-layout="tableAIBody" className="table-ai-body">
        <p className="table-ai-context">
          Uses this game’s full rulebook, theme, and design table. Only the
          selected {field} {row ? "cell" : "column"} can change. Review every
          suggestion before applying.
        </p>
        <label className="card-studio-field">
          What should change?
          <textarea
            aria-label="AI table instructions"
            autoFocus
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={4000}
            rows={3}
            disabled={ai.busy}
            placeholder={
              selection.field === "body"
                ? "Write a concise, evocative description for each card. Keep its existing mechanical effect."
                : `Describe how to fill or improve ${field}…`
            }
          />
        </label>
        <div
          data-layout="tableAIRequestControls"
          className="table-ai-request-controls"
        >
          <label className="card-studio-field">
            Writing model
            <select
              aria-label="AI table model"
              value={model}
              disabled={ai.busy}
              onChange={(event) => setModel(event.target.value)}
            >
              {RULES_WRITER_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="card-studio-button is-primary"
            disabled={ai.busy || !prompt.trim() || !count}
            onClick={() => void ai.generate(prompt, model)}
          >
            <Sparkles size={15} />
            {ai.busy
              ? "Writing suggestions…"
              : ai.proposal
                ? "Generate again"
                : "Generate suggestions"}
          </button>
        </div>
        <small className="table-ai-context">
          AI usage is charged to your signed-in account. Up to 100 cells per
          request, with up to 200 designs in the table.
        </small>
        {ai.error && (
          <p role="alert" className="card-studio-error">
            {ai.error}
          </p>
        )}
        {ai.busy && (
          <p role="status">
            Writing {count === 1 ? "one suggestion" : `${count} suggestions`}.
            Your table stays unchanged while you review.
          </p>
        )}
        {ai.proposal && (
          <section
            className="table-ai-review"
            aria-label="Review AI table changes"
          >
            <h3>
              Before you apply <small>{getModelLabel(ai.proposal.model)}</small>
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Before</th>
                  <th>Suggested {field}</th>
                </tr>
              </thead>
              <tbody>
                {ai.proposal.edits.map((edit, i) => (
                  <tr key={edit.rowId}>
                    <th scope="row">
                      {studio.rows.find((item) => item.id === edit.rowId)
                        ?.title || "Untitled design"}
                    </th>
                    <td>
                      {String(ai.proposal!.baseline.values[i]) || (
                        <em>Empty</em>
                      )}
                    </td>
                    <td>{String(edit.value) || <em>Empty</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <footer>
        <span>
          {ai.proposal
            ? `${ai.proposal.edits.length} ${ai.proposal.edits.length === 1 ? "cell" : "cells"} ready for your review`
            : "Your table changes only when you choose Apply."}
        </span>
        <button type="button" className="card-studio-button" onClick={ai.close}>
          Cancel
        </button>
        <button
          type="button"
          className="card-studio-button is-primary"
          disabled={!ai.proposal || ai.busy}
          onClick={ai.apply}
        >
          Apply {ai.proposal?.edits.length || count}{" "}
          {count === 1 ? "cell" : "cells"}
        </button>
      </footer>
    </dialog>
  );
}
