import { Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import type { CardStudioRow } from "./types";
import type { AITableField } from "./aiTableModel";

export function CardTable({
  rows,
  customColumns,
  selectedId,
  onSelect,
  onChange,
  onDuplicate,
  onRemove,
  onAdd,
  onSamples,
  onAIColumn,
  onCellSelect,
}: {
  rows: CardStudioRow[];
  customColumns: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (row: CardStudioRow) => void;
  onDuplicate: (row: CardStudioRow) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onSamples: () => void;
  onAIColumn?: (field: AITableField) => void;
  onCellSelect?: (rowId: string, field: AITableField) => void;
}) {
  const aiButton = (field: AITableField, label: string) =>
    onAIColumn && (
      <button
        type="button"
        className="table-ai-header-action"
        aria-label={`AI edit ${label} column`}
        title={`Write the whole ${label} column with AI`}
        onClick={() => onAIColumn(field)}
      >
        <Sparkles size={11} />
        AI
      </button>
    );
  if (!rows.length)
    return (
      <div className="card-studio-empty" data-region="card-table-empty">
        <div
          className="card-studio-empty-cards"
          data-region="card-studio-decoration"
          aria-hidden="true"
        >
          <span>✦</span>
          <span>♧</span>
          <span>☾</span>
        </div>
        <h3>A whole deck starts with one idea.</h3>
        <p>
          Write your cards like a spreadsheet.
          <br />
          Your template takes care of the beautiful part.
        </p>
        <div
          className="card-studio-toolbar"
          data-region="card-studio-empty-actions"
        >
          <button
            type="button"
            className="card-studio-button is-primary"
            onClick={onAdd}
          >
            <Plus size={15} /> Make my first card
          </button>
          <button
            type="button"
            className="card-studio-button"
            onClick={onSamples}
          >
            Try a woodland sample
          </button>
        </div>
        <small>Already have a spreadsheet? Import it above.</small>
      </div>
    );
  return (
    <div className="card-studio-table-scroll" data-region="card-table-scroll">
      <table className="card-studio-table">
        <caption className="card-studio-sr-only">
          Card designs. Each row becomes the number of cards in its Copies
          column.
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">
              Title {aiButton("title", "title")}
              <small>card name</small>
            </th>
            <th scope="col">
              Body {aiButton("body", "body")}
              <small>rules & flavor</small>
            </th>
            <th scope="col">Cost {aiButton("cost", "cost")}</th>
            <th scope="col">Category {aiButton("category", "category")}</th>
            <th scope="col">Copies {aiButton("copies", "copies")}</th>
            {customColumns.map((column) => (
              <th scope="col" key={column}>
                {column} {aiButton(`custom:${column}`, column)}
                <small>custom field</small>
              </th>
            ))}
            <th scope="col">
              <span className="card-studio-sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              data-card-id={row.id}
              className={selectedId === row.id ? "is-selected" : ""}
              onFocus={() => onSelect(row.id)}
            >
              <td>
                <button
                  type="button"
                  className="card-studio-row-number"
                  aria-label={`Preview card ${index + 1}: ${row.title || "Untitled"}`}
                  aria-pressed={selectedId === row.id}
                  onClick={() => onSelect(row.id)}
                >
                  {String(index + 1).padStart(2, "0")}
                </button>
              </td>
              <td>
                <input
                  aria-label={`Card ${index + 1} title`}
                  onFocus={() => onCellSelect?.(row.id, "title")}
                  value={row.title}
                  placeholder="Give your card a name…"
                  onChange={(event) =>
                    onChange({ ...row, title: event.target.value })
                  }
                />
              </td>
              <td>
                <textarea
                  aria-label={`Card ${index + 1} body`}
                  onFocus={() => onCellSelect?.(row.id, "body")}
                  value={row.body}
                  placeholder="What happens when you play it?"
                  onChange={(event) =>
                    onChange({ ...row, body: event.target.value })
                  }
                  rows={2}
                />
              </td>
              <td>
                <input
                  aria-label={`Card ${index + 1} cost`}
                  onFocus={() => onCellSelect?.(row.id, "cost")}
                  value={row.cost}
                  placeholder="0"
                  onChange={(event) =>
                    onChange({ ...row, cost: event.target.value })
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`Card ${index + 1} category`}
                  onFocus={() => onCellSelect?.(row.id, "category")}
                  value={row.category}
                  placeholder="Action"
                  onChange={(event) =>
                    onChange({ ...row, category: event.target.value })
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`Card ${index + 1} copies`}
                  onFocus={() => onCellSelect?.(row.id, "copies")}
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  value={row.copies}
                  onChange={(event) =>
                    onChange({ ...row, copies: Number(event.target.value) })
                  }
                />
              </td>
              {customColumns.map((column) => (
                <td key={column}>
                  <input
                    aria-label={`Card ${index + 1} ${column}`}
                    onFocus={() => onCellSelect?.(row.id, `custom:${column}`)}
                    value={row.customFields[column] ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...row,
                        customFields: {
                          ...row.customFields,
                          [column]: event.target.value,
                        },
                      })
                    }
                  />
                </td>
              ))}
              <td>
                <div
                  className="card-studio-row-actions"
                  data-region="card-row-actions"
                >
                  <button
                    type="button"
                    className="card-studio-icon-button"
                    aria-label={`Duplicate card ${index + 1}`}
                    onClick={() => onDuplicate(row)}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="card-studio-icon-button is-danger"
                    aria-label={`Delete card ${index + 1}`}
                    onClick={() => onRemove(row.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="card-studio-add-row" onClick={onAdd}>
        <Plus size={14} /> Add another design
      </button>
    </div>
  );
}
