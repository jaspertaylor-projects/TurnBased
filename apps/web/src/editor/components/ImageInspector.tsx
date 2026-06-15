import { useCallback, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import {
  Crop,
  Image as ImageIcon,
  Library,
  Maximize,
  Move,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { PaletteColorOption } from '@turnbased/engine-ui';

import { NumericInput } from '../../components/NumericInput';
import { inputStyle, labelStyle } from '../styles';
import type { EditorImageAsset, EditorProject } from '../types';
import { AIImageGenerationModal, type GeneratedImageAssetPayload } from './AIImageGenerationModal';
import { buildImagePromptContextOptions } from './imagePromptContext';
import { InspectorAccordion, InspectorColorField } from './InspectorControls';
import {
  buildImageFilterCss,
  buildImageTintStyle,
  resolveImageAreaProperties,
  type ImageObjectFit,
  type ImageShadowPreset,
} from './imageAreaStyle';

const compactInputStyle = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

/** Best displayable source for a stored art asset (data URLs only — uploaded
 *  R2 assets without a cached data URL can't be shown offline). */
function getAssetPreviewSource(asset: EditorImageAsset): string | null {
  if (asset.imageDataUrl) return asset.imageDataUrl;
  if (asset.r2Key.startsWith('data:image/')) return asset.r2Key;
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── Small reusable primitives ────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    // sliderRow — label + range + live readout in one compact line
    <div data-layout="imageSliderRow" style={{ display: 'grid', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '0.74rem', color: '#0f766e', fontVariantNumeric: 'tabular-nums' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: '#0d9488', cursor: 'pointer' }}
      />
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    // segmentedControl — pill row where exactly one option is active
    <div
      data-layout="imageSegmentedControl"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: '0.3rem',
        padding: '0.25rem',
        borderRadius: '12px',
        background: 'rgba(15,118,110,0.06)',
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.3rem',
              borderRadius: '9px',
              border: 'none',
              background: active ? 'rgba(255,255,255,0.98)' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(6,78,59,0.14)' : 'none',
              color: active ? '#0f766e' : '#64748b',
              fontSize: '0.78rem',
              fontWeight: active ? 800 : 600,
              cursor: 'pointer',
            }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main inspector ───────────────────────────────────────────────────

export function ImageInspector({
  project,
  properties,
  paletteOptions,
  onAssignProjectPaletteColor,
  onUpdateProperties,
}: {
  project: EditorProject;
  properties: Record<string, unknown>;
  paletteOptions: readonly PaletteColorOption[];
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
  onUpdateProperties: (updater: (properties: Record<string, unknown>) => Record<string, unknown>) => void;
}) {
  const resolved = resolveImageAreaProperties(properties);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const focalRef = useRef<HTMLDivElement | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    (patch: Record<string, unknown>) => onUpdateProperties((current) => ({ ...current, ...patch })),
    [onUpdateProperties],
  );

  const setImage = useCallback((url: string) => set({ imageUrl: url }), [set]);

  const libraryImages = (project.art.images ?? [])
    .map((asset) => ({ asset, src: getAssetPreviewSource(asset) }))
    .filter((entry): entry is { asset: EditorImageAsset; src: string } => Boolean(entry.src));

  async function ingestFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    try {
      setError(null);
      setImage(await readFileAsDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read image');
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void ingestFile(event.dataTransfer.files?.[0]);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (imageItem) {
      event.preventDefault();
      void ingestFile(imageItem.getAsFile());
    }
  }

  function handleGenerated(asset: GeneratedImageAssetPayload) {
    if (asset.imageDataUrl) {
      setImage(asset.imageDataUrl);
    } else {
      setError('The generated image had no preview data to place.');
    }
  }

  function updateFocalFromPointer(clientX: number, clientY: number) {
    const rect = focalRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    set({
      focalX: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      focalY: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    });
  }

  const previewFilter = buildImageFilterCss(resolved);
  const tint = buildImageTintStyle(resolved);

  return (
    <>
      <InspectorAccordion title="Image" defaultOpen>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {/* imageDropZone — preview + paste/drop target for the source image */}
          <div
            data-layout="imageDropZone"
            tabIndex={0}
            onPaste={handlePaste}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              position: 'relative',
              aspectRatio: '16 / 10',
              borderRadius: '14px',
              border: isDragging ? '2px dashed #0d9488' : '1px solid rgba(15,118,110,0.16)',
              background: isDragging
                ? 'rgba(13,148,136,0.08)'
                : 'repeating-conic-gradient(rgba(15,118,110,0.05) 0% 25%, rgba(255,255,255,0.6) 0% 50%) 50% / 18px 18px',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              outline: 'none',
            }}
          >
            {resolved.imageUrl ? (
              <>
                <img
                  src={resolved.imageUrl}
                  alt="Selected"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: resolved.objectFit,
                    objectPosition: `${resolved.focalX * 100}% ${resolved.focalY * 100}%`,
                    opacity: resolved.opacity,
                    filter: previewFilter || undefined,
                    borderRadius: resolved.cornerRadius ? Math.min(resolved.cornerRadius, 40) : undefined,
                  }}
                />
                {tint ? <div style={{ position: 'absolute', inset: 0, ...tint }} /> : null}
                <button
                  type="button"
                  onClick={() => setImage('')}
                  title="Remove image"
                  aria-label="Remove image"
                  style={{
                    position: 'absolute',
                    top: '0.4rem',
                    right: '0.4rem',
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(0,0,0,0.42)',
                    color: 'white',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', gap: '0.3rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' }}>
                <ImageIcon size={26} />
                <span style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>Drop, paste, or add an image below</span>
              </div>
            )}
          </div>

          {/* imageSourceActions — the three opted-in ways to set the picture */}
          <div data-layout="imageSourceActions" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }}>
            <SourceButton icon={<Upload size={14} />} label="Upload" onClick={() => fileInputRef.current?.click()} />
            <SourceButton icon={<Library size={14} />} label="Library" onClick={() => setShowLibrary((open) => !open)} active={showLibrary} />
            <SourceButton icon={<Wand2 size={14} />} label="Generate" accent onClick={() => setShowGenerator(true)} />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => { void ingestFile(event.target.files?.[0]); event.target.value = ''; }}
          />

          {showLibrary ? (
            // imageLibraryGrid — pick from images already in the project Art studio
            <div data-layout="imageLibraryGrid" style={{ display: 'grid', gap: '0.4rem' }}>
              {libraryImages.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {libraryImages.map(({ asset, src }) => {
                    const selected = src === resolved.imageUrl;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => { setImage(src); setShowLibrary(false); }}
                        title={asset.name || 'Art asset'}
                        style={{
                          aspectRatio: '1 / 1',
                          borderRadius: '10px',
                          border: selected ? '2px solid #0d9488' : '1px solid rgba(15,118,110,0.16)',
                          padding: 0,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <img src={src} alt={asset.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', textAlign: 'center', padding: '0.8rem', borderRadius: '10px', border: '1px dashed rgba(15,118,110,0.16)' }}>
                  No images in the Art studio yet. Generate or upload one in the Art tab to reuse it here.
                </div>
              )}
            </div>
          ) : null}

          {error ? (
            <div style={{ fontSize: '0.76rem', color: '#b91c1c', background: 'rgba(254,242,242,0.9)', borderRadius: '10px', padding: '0.5rem 0.65rem' }}>
              {error}
            </div>
          ) : null}
        </div>
      </InspectorAccordion>

      <InspectorAccordion title="Fit & Crop" defaultOpen>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <SegmentedControl<ImageObjectFit>
            value={resolved.objectFit}
            onChange={(value) => set({ objectFit: value })}
            options={[
              { value: 'cover', label: 'Cover', icon: <Maximize size={13} /> },
              { value: 'contain', label: 'Fit', icon: <Crop size={13} /> },
              { value: 'fill', label: 'Fill', icon: <Move size={13} /> },
            ]}
          />

          {/* focalPointPicker — drag the marker to choose what stays in frame
              when the image is cropped (matters most for Cover). */}
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Focal point</span>
            <div
              ref={focalRef}
              data-layout="imageFocalPicker"
              onMouseDown={(event) => {
                event.preventDefault();
                updateFocalFromPointer(event.clientX, event.clientY);
                const move = (moveEvent: MouseEvent) => updateFocalFromPointer(moveEvent.clientX, moveEvent.clientY);
                const up = () => {
                  window.removeEventListener('mousemove', move);
                  window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
              }}
              style={{
                position: 'relative',
                aspectRatio: '16 / 10',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'crosshair',
                border: '1px solid rgba(15,118,110,0.16)',
                background: resolved.imageUrl ? '#0f172a' : 'rgba(15,118,110,0.06)',
                opacity: resolved.objectFit === 'cover' ? 1 : 0.55,
              }}
            >
              {resolved.imageUrl ? (
                <img
                  src={resolved.imageUrl}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${resolved.focalX * 100}% ${resolved.focalY * 100}%`,
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
              <span
                style={{
                  position: 'absolute',
                  left: `${resolved.focalX * 100}%`,
                  top: `${resolved.focalY * 100}%`,
                  width: '18px',
                  height: '18px',
                  marginLeft: '-9px',
                  marginTop: '-9px',
                  borderRadius: '999px',
                  border: '2px solid white',
                  boxShadow: '0 0 0 2px rgba(13,148,136,0.9), 0 2px 6px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}
              />
            </div>
            {resolved.objectFit !== 'cover' ? (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Switch to Cover to crop around the focal point.</span>
            ) : null}
          </div>
        </div>
      </InspectorAccordion>

      <InspectorAccordion title="Adjust">
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <SliderRow
            label="Opacity"
            value={resolved.opacity}
            min={0}
            max={1}
            step={0.05}
            display={`${Math.round(resolved.opacity * 100)}%`}
            onChange={(value) => set({ opacity: value })}
          />
          <label style={labelStyle}>
            Corner radius
            <NumericInput
              value={resolved.cornerRadius}
              min={0}
              step={1}
              onValueChange={(value) => set({ cornerRadius: value })}
              style={compactInputStyle}
            />
          </label>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Shadow</span>
            <SegmentedControl<ImageShadowPreset>
              value={resolved.shadow}
              onChange={(value) => set({ shadow: value })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'soft', label: 'Soft' },
                { value: 'medium', label: 'Medium' },
                { value: 'strong', label: 'Strong' },
              ]}
            />
          </div>
        </div>
      </InspectorAccordion>

      <InspectorAccordion title="Filters & Tint">
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <SliderRow label="Grayscale" value={resolved.grayscale} min={0} max={1} step={0.05} display={`${Math.round(resolved.grayscale * 100)}%`} onChange={(value) => set({ grayscale: value })} />
          <SliderRow label="Sepia" value={resolved.sepia} min={0} max={1} step={0.05} display={`${Math.round(resolved.sepia * 100)}%`} onChange={(value) => set({ sepia: value })} />
          <SliderRow label="Brightness" value={resolved.brightness} min={0.2} max={2} step={0.05} display={`${Math.round(resolved.brightness * 100)}%`} onChange={(value) => set({ brightness: value })} />
          <InspectorColorField
            label="Tint color"
            value={resolved.tintColor || 'rgba(13,148,136,1)'}
            onChange={(value) => set({ tintColor: value })}
            palette={paletteOptions}
            onAssignPaletteColor={onAssignProjectPaletteColor}
          />
          <SliderRow label="Tint strength" value={resolved.tintStrength} min={0} max={1} step={0.05} display={`${Math.round(resolved.tintStrength * 100)}%`} onChange={(value) => set({ tintStrength: value })} />
        </div>
      </InspectorAccordion>

      <AIImageGenerationModal
        open={showGenerator}
        projectId={project.id}
        modelId={project.settings.aiModels.imageGeneration}
        title="Generate image for this component"
        contextOptions={buildImagePromptContextOptions(project)}
        onClose={() => setShowGenerator(false)}
        onGenerated={handleGenerated}
      />
    </>
  );
}

function SourceButton({
  icon,
  label,
  onClick,
  active = false,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.4rem',
    borderRadius: '11px',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
    border: '1px solid rgba(15,118,110,0.16)',
  };
  const style: CSSProperties = accent
    ? { ...base, border: 'none', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white' }
    : active
      ? { ...base, background: 'rgba(240,253,250,0.98)', borderColor: 'rgba(13,148,136,0.4)', color: '#0f766e' }
      : { ...base, background: 'rgba(255,255,255,0.94)', color: '#065f46' };

  return (
    <button type="button" onClick={onClick} style={style}>
      {icon}
      {label}
    </button>
  );
}
