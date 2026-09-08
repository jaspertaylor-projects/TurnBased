import { useEffect, useRef, useState } from 'react';
import { Database, ImagePlus, LockKeyhole, Trash2 } from 'lucide-react';
import type {
  TemplateLayer,
  TemplateTextLayer,
  TemplateShapeLayer,
  TemplateImageLayer,
  TemplateGridLayer,
  TemplateTrackLayer,
} from './types';
import { InspectorColor, InspectorNumber, InspectorSelect } from './InspectorFields';

export function LayerInspector({
  layer,
  fields,
  onChange,
  onDelete,
}: {
  layer: TemplateLayer;
  fields: string[];
  onChange: (layer: TemplateLayer) => void;
  onDelete: () => void;
}) {
  const [notice, setNotice] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const latest = useRef({ layer, onChange });
  const uploadRequest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = { layer, onChange };
  }, [layer, onChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploadRequest.current += 1;
    };
  }, []);
  const patch = (values: Partial<TemplateLayer>) => onChange({ ...layer, ...values } as TemplateLayer);
  const text = layer.type === 'text' ? layer : null;
  const shape = layer.type === 'shape' ? layer : null;
  const image = layer.type === 'image' ? layer : null;
  const grid = layer.type === 'grid' ? layer : null;
  const track = layer.type === 'track' ? layer : null;
  const textPatch = (values: Partial<TemplateTextLayer>) => onChange({ ...text!, ...values });
  const imagePatch = (values: Partial<TemplateImageLayer>) => onChange({ ...image!, ...values });
  const shapePatch = (values: Partial<TemplateShapeLayer>) => onChange({ ...shape!, ...values });
  const gridPatch = (values: Partial<TemplateGridLayer>) => onChange({ ...grid!, ...values });
  const trackPatch = (values: Partial<TemplateTrackLayer>) => onChange({ ...track!, ...values });
  async function uploadImage(file?: File) {
    if (!file || !image) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice('Choose a PNG, JPEG, WebP, or GIF.');
      return;
    }
    if (file.size > 10_000_000) {
      setNotice('Choose an image smaller than 10 MB.');
      return;
    }
    const request = ++uploadRequest.current;
    const layerId = image.id;
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that image.'));
        reader.readAsDataURL(file);
      });
      const current = latest.current;
      if (
        !mounted.current ||
        request !== uploadRequest.current ||
        current.layer.id !== layerId ||
        current.layer.type !== 'image'
      )
        return;
      current.onChange({ ...current.layer, source });
      setNotice('Artwork added to this layer and saved with the component.');
    } catch (error) {
      if (mounted.current && request === uploadRequest.current)
        setNotice(error instanceof Error ? error.message : 'Could not upload this image.');
    }
  }
  return (
    <div data-layout="templateLayerInspector" className="template-inspector-content">
      <div data-layout="templateSelectedLayerIdentity" className="template-inspector-heading">
        <span>{layer.type.toUpperCase()} LAYER</span>
        {layer.locked && <LockKeyhole size={14} />}
      </div>
      {layer.locked && <p className="template-note">Unlock this layer in the layer list to edit it.</p>}
      <fieldset disabled={layer.locked}>
        <label className="template-field">
          <span>Layer name</span>
          <input
            aria-label="Layer name"
            value={layer.name}
            maxLength={100}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>
        <section className="template-inspector-group">
          <h3>Position & size</h3>
          <div data-layout="templateLayerGeometry" className="template-field-grid">
            <InspectorNumber label="Layer X" value={layer.x} onChange={(x) => patch({ x })} />
            <InspectorNumber label="Layer Y" value={layer.y} onChange={(y) => patch({ y })} />
            <InspectorNumber
              label="Layer width"
              value={layer.width}
              min={0.5}
              onChange={(width) => patch({ width })}
            />
            <InspectorNumber
              label="Layer height"
              value={layer.height}
              min={0.5}
              onChange={(height) => patch({ height })}
            />
            <InspectorNumber
              label="Rotation"
              value={layer.rotation}
              min={-360}
              max={360}
              step={1}
              unit="°"
              onChange={(rotation) => patch({ rotation })}
            />
            <InspectorNumber
              label="Opacity"
              value={layer.opacity * 100}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(opacity) => patch({ opacity: opacity / 100 })}
            />
          </div>
        </section>
        {text && (
          <section className="template-inspector-group">
            <h3>Text & data</h3>
            <label className="template-field">
              <span>Text content</span>
              <textarea
                id="template-text-content"
                aria-label="Text content"
                value={text.content}
                rows={5}
                onChange={(event) => textPatch({ content: event.target.value })}
              />
            </label>
            <label className="template-field">
              <span>
                <Database size={12} /> Insert table field
              </span>
              <select
                aria-label="Insert table field"
                value=""
                onChange={(event) => {
                  if (event.target.value) textPatch({ content: `${text.content}{{${event.target.value}}}` });
                }}
              >
                <option value="">Choose a field…</option>
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
            <p className="template-note">
              Use {'{{title}}'} or any field from your table. Static text and fields can share the same layer.
            </p>
            <div data-layout="templateTextTypography" className="template-field-grid">
              <InspectorSelect
                label="Font"
                value={text.fontFamily}
                onChange={(fontFamily) =>
                  textPatch({ fontFamily: fontFamily as TemplateTextLayer['fontFamily'] })
                }
              >
                <option value="serif">Storybook serif</option>
                <option value="sans">Clean sans serif</option>
                <option value="mono">Typewriter mono</option>
              </InspectorSelect>
              <InspectorNumber
                label="Font size"
                value={text.fontSize}
                min={1}
                max={240}
                step={0.5}
                unit="pt"
                onChange={(fontSize) => textPatch({ fontSize })}
              />
              <InspectorSelect
                label="Font weight"
                value={text.fontWeight}
                onChange={(fontWeight) => textPatch({ fontWeight: fontWeight as 'normal' | 'bold' })}
              >
                <option value="normal">Regular</option>
                <option value="bold">Bold</option>
              </InspectorSelect>
              <InspectorSelect
                label="Text style"
                value={text.italic ? 'italic' : 'normal'}
                onChange={(style) => textPatch({ italic: style === 'italic' })}
              >
                <option value="normal">Upright</option>
                <option value="italic">Italic</option>
              </InspectorSelect>
              <InspectorSelect
                label="Text alignment"
                value={text.align}
                onChange={(align) => textPatch({ align: align as TemplateTextLayer['align'] })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </InspectorSelect>
              <InspectorSelect
                label="Vertical alignment"
                value={text.verticalAlign}
                onChange={(verticalAlign) =>
                  textPatch({ verticalAlign: verticalAlign as TemplateTextLayer['verticalAlign'] })
                }
              >
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </InspectorSelect>
              <InspectorNumber
                label="Line height"
                value={text.lineHeight}
                min={0.8}
                max={3}
                step={0.05}
                unit="×"
                onChange={(lineHeight) => textPatch({ lineHeight })}
              />
              <InspectorSelect
                label="Text overflow"
                value={text.autoFit}
                onChange={(autoFit) => textPatch({ autoFit: autoFit as TemplateTextLayer['autoFit'] })}
              >
                <option value="shrink">Shrink to fit</option>
                <option value="clip">Keep font size</option>
              </InspectorSelect>
            </div>
            <InspectorColor label="Text fill" value={text.fill} onChange={(fill) => textPatch({ fill })} />
          </section>
        )}
        {image && (
          <section className="template-inspector-group">
            <h3>Artwork</h3>
            <label className="template-field">
              <span>Image source</span>
              <textarea
                aria-label="Image source"
                value={image.source.startsWith('data:') ? '' : image.source}
                placeholder={
                  image.source.startsWith('data:')
                    ? 'Uploaded artwork · choose another image to replace'
                    : '{{artUrl}} or https://…'
                }
                rows={2}
                onChange={(event) => imagePatch({ source: event.target.value })}
              />
            </label>
            <button className="template-wide-button" onClick={() => upload.current?.click()}>
              <ImagePlus size={15} />
              {image.source.startsWith('data:') ? 'Replace uploaded artwork' : 'Upload artwork'}
            </button>
            <input
              ref={upload}
              aria-label="Upload layer artwork"
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                void uploadImage(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <InspectorSelect
              label="Image field"
              value={/^\{\{[^{}]+\}\}$/.test(image.source) ? image.source.slice(2, -2) : ''}
              onChange={(field) => {
                if (field) imagePatch({ source: `{{${field}}}` });
              }}
            >
              <option value="">Static or uploaded image</option>
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </InspectorSelect>
            <div data-layout="templateImageControls" className="template-field-grid">
              <InspectorSelect
                label="Image fit"
                value={image.fit}
                onChange={(fit) => imagePatch({ fit: fit as TemplateImageLayer['fit'] })}
              >
                <option value="cover">Fill & crop</option>
                <option value="contain">Fit inside</option>
                <option value="stretch">Stretch</option>
              </InspectorSelect>
              <InspectorNumber
                label="Image corner radius"
                value={image.radius}
                min={0}
                onChange={(radius) => imagePatch({ radius })}
              />
            </div>
          </section>
        )}
        {shape && (
          <section className="template-inspector-group">
            <h3>Shape</h3>
            <InspectorSelect
              label="Shape"
              value={shape.shape}
              onChange={(value) => shapePatch({ shape: value as TemplateShapeLayer['shape'] })}
            >
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="line">Line</option>
              <option value="polygon">Polygon</option>
              <option value="path">Vector path</option>
            </InspectorSelect>
            {shape.shape === 'rectangle' && (
              <InspectorNumber
                label="Corner radius"
                value={shape.radius}
                min={0}
                onChange={(radius) => shapePatch({ radius })}
              />
            )}
            {shape.shape === 'polygon' && (
              <label className="template-field">
                <span>Polygon points · 0–100</span>
                <textarea
                  aria-label="Polygon points"
                  value={shape.points}
                  rows={3}
                  onChange={(event) => shapePatch({ points: event.target.value })}
                />
              </label>
            )}
            {shape.shape === 'path' && (
              <label className="template-field">
                <span>Vector path · 0–100</span>
                <textarea
                  aria-label="Vector path"
                  value={shape.pathData}
                  rows={4}
                  onChange={(event) => shapePatch({ pathData: event.target.value })}
                />
              </label>
            )}
          </section>
        )}
        {grid && (
          <section className="template-inspector-group">
            <h3>Board grid</h3>
            <InspectorSelect
              label="Grid pattern"
              value={grid.gridType}
              onChange={(gridType) => gridPatch({ gridType: gridType as 'square' | 'hex' })}
            >
              <option value="square">Square cells</option>
              <option value="hex">Hex cells</option>
            </InspectorSelect>
            <div data-layout="templateBoardGridControls" className="template-field-grid">
              <InspectorNumber
                label="Grid rows"
                value={grid.rows}
                min={1}
                max={40}
                step={1}
                unit=""
                onChange={(rows) => gridPatch({ rows })}
              />
              <InspectorNumber
                label="Grid columns"
                value={grid.columns}
                min={1}
                max={40}
                step={1}
                unit=""
                onChange={(columns) => gridPatch({ columns })}
              />
              <InspectorNumber
                label="Cell gap"
                value={grid.gap}
                min={0}
                max={20}
                onChange={(gap) => gridPatch({ gap })}
              />
              <InspectorNumber
                label="First cell number"
                value={grid.startAt}
                min={0}
                max={1000}
                step={1}
                unit=""
                onChange={(startAt) => gridPatch({ startAt })}
              />
            </div>
            <label className="template-check">
              <input
                type="checkbox"
                checked={grid.labels}
                onChange={(event) => gridPatch({ labels: event.target.checked })}
              />
              Number the cells
            </label>
            <p className="template-note">
              This grid is printed artwork. Use Placement to make spaces interactive.
            </p>
          </section>
        )}
        {track && (
          <section className="template-inspector-group">
            <h3>Numbered track</h3>
            <InspectorSelect
              label="Track layout"
              value={track.trackShape}
              onChange={(trackShape) => trackPatch({ trackShape: trackShape as 'linear' | 'ring' })}
            >
              <option value="linear">Straight track</option>
              <option value="ring">Round track</option>
            </InspectorSelect>
            <div data-layout="templateTrackControls" className="template-field-grid">
              <InspectorNumber
                label="Track spaces"
                value={track.spaces}
                min={2}
                max={100}
                step={1}
                unit=""
                onChange={(spaces) => trackPatch({ spaces })}
              />
              <InspectorNumber
                label="Track starting number"
                value={track.startAt}
                min={0}
                max={1000}
                step={1}
                unit=""
                onChange={(startAt) => trackPatch({ startAt })}
              />
            </div>
            <label className="template-check">
              <input
                type="checkbox"
                checked={track.labels}
                onChange={(event) => trackPatch({ labels: event.target.checked })}
              />
              Number the spaces
            </label>
          </section>
        )}
        <section className="template-inspector-group">
          <h3>Appearance</h3>
          {!text && (
            <InspectorColor
              label="Fill"
              value={layer.fill}
              onChange={(fill) => patch({ fill })}
              transparent
            />
          )}
          <InspectorColor
            label="Stroke"
            value={layer.stroke}
            onChange={(stroke) => patch({ stroke })}
            transparent
          />
          <InspectorNumber
            label="Stroke width"
            value={layer.strokeWidth}
            min={0}
            max={20}
            onChange={(strokeWidth) => patch({ strokeWidth })}
          />
        </section>
        <button className="template-wide-button template-danger" onClick={onDelete}>
          <Trash2 size={14} />
          Delete layer
        </button>
      </fieldset>
      {notice && (
        <p className="template-note" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
