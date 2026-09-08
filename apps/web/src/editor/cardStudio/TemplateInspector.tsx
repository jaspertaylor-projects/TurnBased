import { ImagePlus, Palette, X } from "lucide-react";
import { BASE_CARD_FIELDS, PRESETS } from "./model";
import { cardTextNeedsReview, renderCardSvg } from "./render";
import type { CardStudioRow, CardStudioState, CardTemplate, CardTemplatePreset } from "./types";

export function CardPreview({
  row,
  template,
  className = "",
}: {
  row: CardStudioRow;
  template: CardTemplate;
  className?: string;
}) {
  return (
    <div
      data-region="card-artwork"
      className={`card-studio-card ${className}`}
      dangerouslySetInnerHTML={{ __html: renderCardSvg(row, template) }}
    />
  );
}

export function TemplateInspector({
  state,
  selected,
  onTemplateChange,
  onRowChange,
  onError,
}: {
  state: CardStudioState;
  selected?: CardStudioRow;
  onTemplateChange: (template: CardTemplate) => void;
  onRowChange: (row: CardStudioRow) => void;
  onError: (error: string) => void;
}) {
  const { template } = state;
  const fields = [...BASE_CARD_FIELDS, ...state.customColumns];
  function updateTemplate(patch: Partial<CardTemplate>) {
    onTemplateChange({ ...template, ...patch });
  }
  return (
    <aside className="card-studio-inspector" aria-label="Card template inspector">
      <header className="card-studio-panel-heading">
        <h2>
          <Palette size={16} /> Your template
        </h2>
        <span>One design. Every card.</span>
      </header>
      <div className="card-studio-inspector-body" data-region="card-template-controls">
        {selected ? (
          <div className="card-studio-feature-preview" data-region="selected-card-preview">
            <CardPreview row={selected} template={template} />
            {cardTextNeedsReview(selected, template) && (
              <p className="card-studio-error">
                Small text on this card. Shorten the copy or turn off the illustration for more space.
              </p>
            )}
          </div>
        ) : (
          <p className="card-studio-hint">Add your first row to see your template come to life.</p>
        )}
        <fieldset className="card-studio-presets">
          <legend>Choose a starting style</legend>
          {Object.entries(PRESETS).map(([id, preset]) => (
            <label key={id} className={`card-studio-preset ${template.preset === id ? "is-selected" : ""}`}>
              <input
                type="radio"
                name="card-preset"
                value={id}
                checked={template.preset === id}
                onChange={() =>
                  updateTemplate({
                    preset: id as CardTemplatePreset,
                    background: preset.colors[0],
                    foreground: preset.colors[1],
                    accent: preset.colors[2],
                  })
                }
              />
              <span
                className="card-studio-preset-swatch"
                style={{ background: preset.colors[0], color: preset.colors[1], borderColor: preset.colors[2] }}
              >
                Aa
              </span>
              <span>
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="card-studio-colors">
          <legend>Make it yours</legend>
          {(["background", "foreground", "accent"] as const).map((key) => (
            <label key={key}>
              <input
                type="color"
                aria-label={`Card ${key} color`}
                value={template[key]}
                onChange={(event) => updateTemplate({ [key]: event.target.value })}
              />
              <span>{key === "foreground" ? "Ink" : key === "background" ? "Paper" : "Accent"}</span>
            </label>
          ))}
        </fieldset>
        <label className="card-studio-field">
          Card size
          <select
            value={`${template.widthMm}x${template.heightMm}`}
            onChange={(event) => {
              const [widthMm, heightMm] = event.target.value.split("x").map(Number);
              updateTemplate({ widthMm, heightMm });
            }}
          >
            <option value="63x88">Poker · 63 × 88 mm</option>
            <option value="57x89">Bridge · 57 × 89 mm</option>
            <option value="70x120">Tarot · 70 × 120 mm</option>
            <option value="70x70">Square · 70 × 70 mm</option>
            {!["63x88", "57x89", "70x120", "70x70"].includes(`${template.widthMm}x${template.heightMm}`) && (
              <option value={`${template.widthMm}x${template.heightMm}`}>
                Custom · {template.widthMm} × {template.heightMm} mm
              </option>
            )}
          </select>
        </label>
        <fieldset className="card-studio-bindings">
          <legend>Connect your table</legend>
          {(
            [
              ["titleField", "Title"],
              ["bodyField", "Rules text"],
              ["badgeField", "Corner badge"],
              ["footerField", "Footer"],
            ] as const
          ).map(([key, label]) => (
            <label className="card-studio-field" key={key}>
              {label}
              <select
                aria-label={`${label} field`}
                value={template[key]}
                onChange={(event) => updateTemplate({ [key]: event.target.value })}
              >
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        <label className="card-studio-field">
          Text size{" "}
          <input
            type="range"
            min="12"
            max="24"
            value={template.bodyFontSize}
            onChange={(event) => updateTemplate({ bodyFontSize: Number(event.target.value) })}
          />
        </label>
        <label className="card-studio-checkbox">
          <input
            type="checkbox"
            checked={template.showArt}
            onChange={(event) => updateTemplate({ showArt: event.target.checked })}
          />{" "}
          Make room for an illustration
        </label>
        {selected && (
          <section className="card-studio-art-fields" aria-label="Selected card artwork">
            <label className="card-studio-field">
              Artwork for {selected.title || "this card"}
              <input
                type="url"
                aria-label="Selected card art URL"
                value={selected.artUrl.startsWith("data:") ? "" : selected.artUrl}
                placeholder={selected.artUrl.startsWith("data:") ? "Uploaded artwork attached" : "https://…"}
                onChange={(event) => onRowChange({ ...selected, artUrl: event.target.value })}
              />
            </label>
            <div className="card-studio-toolbar" data-region="card-art-actions">
              <label className="card-studio-button card-studio-file-button">
                <ImagePlus size={14} /> Upload art
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
                      onError("Use a PNG, JPEG, WebP, or GIF image.");
                      return;
                    }
                    if (file.size > 2_000_000) {
                      onError("Choose an image smaller than 2 MB to keep your project easy to share.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") onRowChange({ ...selected, artUrl: reader.result });
                    };
                    reader.onerror = () => onError("This artwork could not be read.");
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {selected.artUrl && (
                <button
                  type="button"
                  className="card-studio-icon-button"
                  aria-label="Remove selected card artwork"
                  onClick={() => onRowChange({ ...selected, artUrl: "" })}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </section>
        )}
      </div>
      <footer className="card-studio-inspector-footer">Your table and template are saved with this project.</footer>
    </aside>
  );
}
