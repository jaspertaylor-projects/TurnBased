import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { importCardCsv } from "./csv";
import type { CardImportResult } from "./types";

export function ImportCardsDialog({
  onClose,
  onImport,
  existingCount,
}: {
  onClose: () => void;
  onImport: (result: CardImportResult, replace: boolean) => void;
  existingCount: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState("");
  const [replace, setReplace] = useState(false);
  const [fileError, setFileError] = useState("");
  const result = useMemo(() => (source.trim() ? importCardCsv(source) : null), [source]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog className="card-studio-dialog" ref={dialog} onCancel={onClose} aria-labelledby="card-import-title">
      <header className="card-studio-panel-heading">
        <div data-region="card-import-heading">
          <span className="card-studio-eyebrow">Bring your ideas along</span>
          <h2 id="card-import-title">Import a card table</h2>
        </div>
        <button type="button" className="card-studio-icon-button" aria-label="Close import" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="card-studio-dialog-body" data-region="card-import-body">
        <p>
          Paste a spreadsheet selection or import CSV. Use <strong>title, body, cost, category, copies, artUrl</strong>.
          Extra columns become template fields. Quoted commas and multiple lines are welcome.
        </p>
        <label className="card-studio-button card-studio-file-button">
          <FileUp size={15} /> Choose CSV or TSV
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileError("");
              if (file.size > 10_000_000) {
                setFileError("Choose a file smaller than 10 MB.");
                return;
              }
              try {
                setSource(await file.text());
              } catch {
                setFileError("The file could not be read. Try pasting its contents.");
              }
            }}
          />
        </label>
        <label className="card-studio-field">
          Card data
          <textarea
            autoFocus
            className="card-studio-csv-input"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={'title,body,cost,category,copies,points\nGathering Glade,"Collect two acorns.",0,Gather,4,1'}
            spellCheck={false}
          />
        </label>
        {existingCount > 0 && (
          <label className="card-studio-field">
            Import mode
            <select
              value={replace ? "replace" : "append"}
              onChange={(event) => setReplace(event.target.value === "replace")}
            >
              <option value="append">Add to my {existingCount} existing designs</option>
              <option value="replace">Replace my current table</option>
            </select>
          </label>
        )}
        {fileError && (
          <p role="alert" className="card-studio-error">
            {fileError}
          </p>
        )}
        {result?.errors.length ? (
          <div data-region="card-import-errors" className="card-studio-error" role="alert">
            <strong>Fix these before importing:</strong>
            <ul>
              {result.errors.slice(0, 6).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {result.errors.length > 6 && <p>And {result.errors.length - 6} more issues.</p>}
          </div>
        ) : null}
        {result && !result.errors.length && (
          <div data-region="card-import-preview" className="card-studio-import-preview">
            <strong>
              {result.rows.length} designs · {result.rows.reduce((sum, row) => sum + row.copies, 0)} cards
            </strong>
            <p>
              {result.rows
                .slice(0, 3)
                .map((row) => row.title)
                .join(" · ")}
              {result.rows.length > 3 ? " …" : ""}
            </p>
            {result.customColumns.length > 0 && <small>Custom fields: {result.customColumns.join(", ")}</small>}
          </div>
        )}
      </div>
      <footer className="card-studio-dialog-footer">
        <button type="button" className="card-studio-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="card-studio-button is-primary"
          disabled={!result || result.errors.length > 0}
          onClick={() => {
            if (result && !result.errors.length) onImport(result, replace);
          }}
        >
          {replace ? "Replace table" : "Import cards"}
        </button>
      </footer>
    </dialog>
  );
}
