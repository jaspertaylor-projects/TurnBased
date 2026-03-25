import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteColorOption {
  id: string;
  label: string;
  value: string;
}

export interface ProjectColorPickerProps {
  value: string | null;
  onChange: (value: string) => void;
  palette?: readonly PaletteColorOption[];
  onAssignPaletteColor?: (paletteId: string, value: string) => void;
  label?: string;
  compact?: boolean;
  popupPlacement?: 'bottom' | 'left';
}

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const FALLBACK_COLOR: ParsedColor = {
  r: 15,
  g: 118,
  b: 110,
  a: 1,
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toHex(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0');
}

function formatColor(color: ParsedColor): string {
  return `rgba(${clampChannel(color.r)},${clampChannel(color.g)},${clampChannel(color.b)},${clampAlpha(Number(color.a.toFixed(2)))})`;
}

function colorToHex(color: ParsedColor): string {
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function parseHexColor(value: string): ParsedColor | null {
  const normalized = value.trim().replace('#', '');

  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null;
  }

  const expanded = normalized.length <= 4
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  const rgbHex = expanded.slice(0, 6);
  const alphaHex = expanded.length === 8 ? expanded.slice(6, 8) : 'ff';

  if (!/^[0-9a-f]+$/i.test(rgbHex) || !/^[0-9a-f]+$/i.test(alphaHex)) {
    return null;
  }

  return {
    r: parseInt(rgbHex.slice(0, 2), 16),
    g: parseInt(rgbHex.slice(2, 4), 16),
    b: parseInt(rgbHex.slice(4, 6), 16),
    a: parseInt(alphaHex, 16) / 255,
  };
}

function parseRgbColor(value: string): ParsedColor | null {
  const match = value.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const [r, g, b, alpha] = parts.map(Number);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    r,
    g,
    b,
    a: Number.isNaN(alpha) ? 1 : alpha,
  };
}

function parseColor(value: string | null | undefined): ParsedColor {
  if (!value) {
    return FALLBACK_COLOR;
  }

  const hex = parseHexColor(value);
  if (hex) {
    return hex;
  }

  const rgb = parseRgbColor(value);
  if (rgb) {
    return rgb;
  }

  return FALLBACK_COLOR;
}

export function ProjectColorPicker({
  value,
  onChange,
  palette = [],
  onAssignPaletteColor,
  label = '',
  compact = false,
  popupPlacement = 'bottom',
}: ProjectColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string>(palette[0]?.id ?? '');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const parsed = useMemo(() => parseColor(value), [value]);
  const colorText = value && value.trim().length > 0 ? value : formatColor(parsed);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (rootRef.current && target instanceof Node && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!assignTarget && palette[0]?.id) {
      setAssignTarget(palette[0].id);
    }
  }, [assignTarget, palette]);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: '100%',
          aspectRatio: compact ? '1 / 1' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : undefined,
          gap: compact ? 0 : '0.6rem',
          borderRadius: compact ? '16px' : '10px',
          border: '1px solid rgba(15,118,110,0.12)',
          background: 'rgba(255,255,255,0.94)',
          padding: compact ? '0.28rem' : '0.35rem',
          color: '#064e3b',
          textAlign: 'left',
          cursor: 'pointer',
          minHeight: compact ? undefined : '36px',
        }}
        title={label || 'Pick Color'}
      >
        <span
          style={{
            flex: label ? '0 0 auto' : '1 1 auto',
            width: compact ? '100%' : (label ? '24px' : '100%'),
            height: compact ? '100%' : '26px',
            borderRadius: compact ? '12px' : '6px',
            border: '1px solid rgba(15,118,110,0.14)',
            background: colorText,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
          }}
        />
        {compact || !label ? null : (
          <span style={{ minWidth: 0, display: 'grid', gap: '0.1rem' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e' }}>
              {label}
            </span>
          </span>
        )}
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            top: popupPlacement === 'left' ? 0 : 'calc(100% + 0.45rem)',
            left: popupPlacement === 'bottom' ? 0 : undefined,
            right: popupPlacement === 'left' ? 'calc(100% + 0.45rem)' : undefined,
            width: 'min(340px, 82vw)',
            borderRadius: '20px',
            border: '1px solid rgba(15,118,110,0.14)',
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 22px 48px rgba(6,78,59,0.16)',
            padding: '0.9rem',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '0.75rem', alignItems: 'stretch' }}>
            <div
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(15,118,110,0.12)',
                background: colorText,
                minHeight: '96px',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
              }}
            />
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              <label style={{ display: 'grid', gap: '0.28rem', color: '#0f766e', fontSize: '0.8rem' }}>
                Base Color
                <input
                  type="color"
                  value={colorToHex(parsed)}
                  onChange={(event) => onChange(formatColor({
                    ...parsed,
                    ...parseColor(event.target.value),
                    a: parsed.a,
                  }))}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '12px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    background: 'rgba(255,255,255,0.92)',
                    padding: '0.22rem',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.28rem', color: '#0f766e', fontSize: '0.8rem' }}>
                Alpha
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 54px', gap: '0.55rem', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(parsed.a * 100)}
                    onChange={(event) => onChange(formatColor({
                      ...parsed,
                      a: Number(event.target.value) / 100,
                    }))}
                  />
                  <div style={{ color: '#064e3b', fontWeight: 700, textAlign: 'right' }}>{Math.round(parsed.a * 100)}%</div>
                </div>
              </label>
            </div>
          </div>

          <label style={{ display: 'grid', gap: '0.28rem', color: '#0f766e', fontSize: '0.8rem' }}>
            Value
            <input
              value={colorText}
              onChange={(event) => onChange(event.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem 0.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(15,118,110,0.12)',
                boxSizing: 'border-box',
                color: '#064e3b',
                background: 'rgba(255,255,255,0.92)',
              }}
            />
          </label>

          {palette.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Project Palette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
                {palette.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange(option.value)}
                    style={{
                      display: 'grid',
                      gap: '0.28rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(15,118,110,0.12)',
                      background: 'rgba(248,250,252,0.94)',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: '100%', height: '18px', borderRadius: '999px', background: option.value, border: '1px solid rgba(15,118,110,0.12)' }} />
                    <span style={{ fontSize: '0.76rem', color: '#064e3b', fontWeight: 700 }}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {palette.length > 0 && onAssignPaletteColor ? (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Save To Project Color</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem' }}>
                <select
                  value={assignTarget}
                  onChange={(event) => setAssignTarget(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.8rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    boxSizing: 'border-box',
                    color: '#064e3b',
                    background: 'rgba(255,255,255,0.92)',
                  }}
                >
                  {palette.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (assignTarget) {
                      onAssignPaletteColor(assignTarget, colorText);
                    }
                  }}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    background: 'rgba(240,253,244,0.96)',
                    color: '#065f46',
                    padding: '0.7rem 0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
