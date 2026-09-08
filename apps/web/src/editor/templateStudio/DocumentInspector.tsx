import { useState } from 'react';
import { CopyPlus, FilePlus2, Trash2 } from 'lucide-react';
import type { ComponentDesignDocument, TemplateFace } from './types';
import { InspectorColor, InspectorNumber, InspectorSelect } from './InspectorFields';
import { MAX_TEMPLATE_FACES } from './model';
import { resizeTemplateDocument } from './resize';

export function DocumentInspector({
  document,
  face,
  onChange,
  onFaceSelect,
}: {
  document: ComponentDesignDocument;
  face: TemplateFace;
  onChange: (document: ComponentDesignDocument) => void;
  onFaceSelect: (faceId: string) => void;
}) {
  const [scaleArtwork, setScaleArtwork] = useState(false);
  const [deleteFace, setDeleteFace] = useState(false);
  const patch = (values: Partial<ComponentDesignDocument>) => onChange({ ...document, ...values });
  function dimensions(widthMm: number, heightMm: number) {
    onChange(resizeTemplateDocument(document, widthMm, heightMm, scaleArtwork));
  }
  function addFace(duplicate: boolean) {
    const id = crypto.randomUUID();
    const next: TemplateFace = {
      id,
      name: duplicate
        ? `${face.name} copy`
        : document.faces.length === 1
          ? 'Back'
          : `Face ${document.faces.length + 1}`,
      background: face.background,
      layers: duplicate ? face.layers.map((layer) => ({ ...layer, id: crypto.randomUUID() })) : [],
    };
    patch({ faces: [...document.faces, next] });
    onFaceSelect(id);
  }
  return (
    <div data-layout="templateDocumentInspector" className="template-inspector-content">
      <div data-layout="templateDocumentHeading" className="template-inspector-heading">
        <span>COMPONENT TEMPLATE</span>
      </div>
      <section className="template-inspector-group">
        <h3>Physical size</h3>
        <InspectorSelect
          label="Size preset"
          value=""
          onChange={(size) => {
            if (size) {
              const [width, height] = size.split('x').map(Number);
              dimensions(width, height);
            }
          }}
        >
          <option value="">Custom size · millimeters</option>
          <optgroup label="Cards">
            <option value="63x88">Poker · 63 × 88 mm</option>
            <option value="57x89">Bridge · 57 × 89 mm</option>
            <option value="70x120">Tarot · 70 × 120 mm</option>
            <option value="88x126">Large card · 88 × 126 mm</option>
          </optgroup>
          <optgroup label="Boards & mats">
            <option value="300x300">Square board · 300 × 300 mm</option>
            <option value="420x297">A3 board · 420 × 297 mm</option>
            <option value="200x140">Player mat · 200 × 140 mm</option>
          </optgroup>
          <optgroup label="Tokens & tiles">
            <option value="25x25">Token · 25 × 25 mm</option>
            <option value="40x40">Token · 40 × 40 mm</option>
            <option value="50x50">Tile · 50 × 50 mm</option>
          </optgroup>
        </InspectorSelect>
        <div data-layout="templateDocumentDimensions" className="template-field-grid">
          <InspectorNumber
            label="Template width"
            value={document.widthMm}
            min={1}
            max={2000}
            onChange={(width) => dimensions(width, document.heightMm)}
          />
          <InspectorNumber
            label="Template height"
            value={document.heightMm}
            min={1}
            max={2000}
            onChange={(height) => dimensions(document.widthMm, height)}
          />
        </div>
        <label className="template-check">
          <input
            type="checkbox"
            checked={scaleArtwork}
            onChange={(event) => setScaleArtwork(event.target.checked)}
          />
          Scale artwork when changing size
        </label>
        <InspectorSelect
          label="Cut shape"
          value={document.trimShape}
          onChange={(trimShape) => patch({ trimShape: trimShape as ComponentDesignDocument['trimShape'] })}
        >
          <option value="rectangle">Rectangle</option>
          <option value="ellipse">Circle / oval</option>
          <option value="hexagon">Hexagon</option>
        </InspectorSelect>
        {document.trimShape === 'rectangle' && (
          <InspectorNumber
            label="Cut corner radius"
            value={document.cornerRadiusMm}
            min={0}
            max={Math.min(document.widthMm, document.heightMm) / 2}
            onChange={(cornerRadiusMm) => patch({ cornerRadiusMm })}
          />
        )}
      </section>
      <section className="template-inspector-group">
        <h3>Print & layout guides</h3>
        <div data-layout="templatePrintMargins" className="template-field-grid">
          <InspectorNumber
            label="Bleed"
            value={document.bleedMm}
            min={0}
            max={20}
            onChange={(bleedMm) => patch({ bleedMm })}
          />
          <InspectorNumber
            label="Safe inset"
            value={document.safeMm}
            min={0}
            max={Math.min(document.widthMm, document.heightMm) / 2}
            onChange={(safeMm) => patch({ safeMm })}
          />
          <InspectorNumber
            label="Snap grid"
            value={document.gridMm}
            min={0.25}
            max={50}
            onChange={(gridMm) => patch({ gridMm })}
          />
        </div>
        <label className="template-check">
          <input
            type="checkbox"
            checked={document.snapToGrid}
            onChange={(event) => patch({ snapToGrid: event.target.checked })}
          />
          Snap objects to grid
        </label>
        <p className="template-note">
          Keep essential text inside the safe line. Extend background artwork into bleed. Hold Alt while
          dragging for precise free movement.
        </p>
      </section>
      <section className="template-inspector-group">
        <h3>Current face</h3>
        <label className="template-field">
          <span>Face name</span>
          <input
            aria-label="Face name"
            value={face.name}
            maxLength={60}
            onChange={(event) =>
              patch({
                faces: document.faces.map((item) =>
                  item.id === face.id ? { ...item, name: event.target.value } : item,
                ),
              })
            }
          />
        </label>
        <InspectorColor
          label="Face background"
          value={face.background}
          onChange={(background) =>
            patch({
              faces: document.faces.map((item) => (item.id === face.id ? { ...item, background } : item)),
            })
          }
        />
        <div data-layout="templateFaceActions" className="template-face-actions">
          <button disabled={document.faces.length >= MAX_TEMPLATE_FACES} onClick={() => addFace(false)}>
            <FilePlus2 size={14} />
            Add face
          </button>
          <button disabled={document.faces.length >= MAX_TEMPLATE_FACES} onClick={() => addFace(true)}>
            <CopyPlus size={14} />
            Duplicate
          </button>
        </div>
        {document.faces.length > 1 && (
          <button className="template-wide-button template-danger" onClick={() => setDeleteFace(true)}>
            <Trash2 size={14} />
            Remove this face
          </button>
        )}
        {deleteFace && (
          <div
            data-layout="templateDeleteFaceConfirmation"
            role="group"
            aria-label="Remove face confirmation"
            className="template-confirm"
          >
            <p>Remove {face.name} and its layers? You can undo this.</p>
            <button
              onClick={() => {
                const faces = document.faces.filter((item) => item.id !== face.id);
                patch({ faces });
                onFaceSelect(faces[0].id);
                setDeleteFace(false);
              }}
            >
              Remove face
            </button>
            <button onClick={() => setDeleteFace(false)}>Keep face</button>
          </div>
        )}
      </section>
    </div>
  );
}
