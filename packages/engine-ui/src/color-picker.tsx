import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteColorOption {
  id: string;
  label: string;
  value: string;
  referenceValue?: string;
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
const COLOR_PICKER_GAP = 10;
const COLOR_PICKER_VIEWPORT_PADDING = 12;
const COLOR_PICKER_DEFAULT_HEIGHT = 420;

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

function resolvePaletteColorValue(
  value: string | null | undefined,
  palette: readonly PaletteColorOption[],
): { resolvedValue: string | null; activePaletteOption: PaletteColorOption | null } {
  if (!value || value.trim().length === 0) {
    return {
      resolvedValue: null,
      activePaletteOption: null,
    };
  }

  const activePaletteOption = palette.find((option) => option.referenceValue === value) ?? null;
  return {
    resolvedValue: activePaletteOption?.value ?? value,
    activePaletteOption,
  };
}

function getPopupWidth(): number {
  return Math.min(340, Math.max(260, Math.floor(window.innerWidth * 0.82)));
}

function getPopupPosition(
  triggerRect: DOMRect,
  popupPlacement: ProjectColorPickerProps['popupPlacement'],
  popupWidth: number,
  popupHeight: number,
) {
  const unclampedLeft = popupPlacement === 'left'
    ? triggerRect.left - popupWidth - COLOR_PICKER_GAP
    : triggerRect.left;
  const unclampedTop = popupPlacement === 'left'
    ? triggerRect.top
    : triggerRect.bottom + COLOR_PICKER_GAP;
  const top = popupPlacement === 'left'
    ? Math.max(COLOR_PICKER_VIEWPORT_PADDING, triggerRect.top)
    : Math.max(
      COLOR_PICKER_VIEWPORT_PADDING,
      Math.min(unclampedTop, window.innerHeight - popupHeight - COLOR_PICKER_VIEWPORT_PADDING),
    );

  return {
    width: popupWidth,
    left: Math.max(
      COLOR_PICKER_VIEWPORT_PADDING,
      Math.min(unclampedLeft, window.innerWidth - popupWidth - COLOR_PICKER_VIEWPORT_PADDING),
    ),
    top,
    maxHeight: Math.max(240, window.innerHeight - top - COLOR_PICKER_VIEWPORT_PADDING),
  };
}

export function ProjectColorPicker({
  value,
  onChange,
  palette = [],
  onAssignPaletteColor,
  label = '',
  compact = false,
  popupPlacement = 'left',
}: ProjectColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string>(palette[0]?.id ?? '');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const liveValue = open ? draftValue : value;
  const { resolvedValue, activePaletteOption } = useMemo(
    () => resolvePaletteColorValue(liveValue, palette),
    [liveValue, palette],
  );
  const parsed = useMemo(() => parseColor(resolvedValue), [resolvedValue]);
  const colorText = resolvedValue && resolvedValue.trim().length > 0 ? resolvedValue : formatColor(parsed);
  const editableValue = open
    ? (draftValue && draftValue.trim().length > 0 ? draftValue : formatColor(parsed))
    : colorText;

  function commitDraftAndClose() {
    const nextValue = draftValue && draftValue.trim().length > 0 ? draftValue : formatColor(parsed);
    setOpen(false);
    setDraftValue(null);
    if ((value ?? '') !== nextValue) {
      onChange(nextValue);
    }
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node
        && rootRef.current
        && !rootRef.current.contains(target)
        && !popupRef.current?.contains(target)
      ) {
        commitDraftAndClose();
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [draftValue, open, parsed, value]);

  useEffect(() => {
    if (!open) {
      setPopupPosition(null);
      setAnchorRect(null);
      return undefined;
    }

    function updatePopupPosition() {
      const triggerRect = anchorRect ?? triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      setPopupPosition(getPopupPosition(
        triggerRect,
        popupPlacement,
        getPopupWidth(),
        popupRef.current?.getBoundingClientRect().height ?? COLOR_PICKER_DEFAULT_HEIGHT,
      ));
    }

    updatePopupPosition();
    const animationFrame = window.requestAnimationFrame(updatePopupPosition);
    window.addEventListener('resize', updatePopupPosition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updatePopupPosition);
    };
  }, [anchorRect, open, popupPlacement]);

  useEffect(() => {
    if (!assignTarget && palette[0]?.id) {
      setAssignTarget(palette[0].id);
    }
  }, [assignTarget, palette]);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          const triggerRect = event.currentTarget.getBoundingClientRect();
          if (open) {
            commitDraftAndClose();
            return;
          }

          setAnchorRect(triggerRect);
          setDraftValue(value ?? formatColor(parseColor(resolvedValue)));
          setPopupPosition(getPopupPosition(
            triggerRect,
            popupPlacement,
            getPopupWidth(),
            popupRef.current?.getBoundingClientRect().height ?? COLOR_PICKER_DEFAULT_HEIGHT,
          ));
          setOpen(true);
        }}
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
          ref={popupRef}
          style={{
            position: 'fixed',
            zIndex: 320,
            top: popupPosition?.top ?? 12,
            left: popupPosition?.left ?? 12,
            width: `${popupPosition?.width ?? getPopupWidth()}px`,
            maxHeight: `${popupPosition?.maxHeight ?? (window.innerHeight - 24)}px`,
            borderRadius: '20px',
            border: '1px solid rgba(15,118,110,0.14)',
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 22px 48px rgba(6,78,59,0.16)',
            padding: '0.9rem',
            display: 'grid',
            gap: '0.75rem',
            overscrollBehavior: 'contain',
            overflowY: 'auto',
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
                  onChange={(event) => setDraftValue(formatColor({
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
                    onChange={(event) => setDraftValue(formatColor({
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
              value={editableValue}
              onChange={(event) => setDraftValue(event.target.value)}
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

          {activePaletteOption ? (
            <div style={{ padding: '0.65rem 0.75rem', borderRadius: '14px', background: 'rgba(240,253,244,0.92)', color: '#065f46', fontSize: '0.78rem', fontWeight: 600 }}>
              Linked to project color: {activePaletteOption.label}
            </div>
          ) : null}

          {palette.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Project Palette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
                {palette.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraftValue(option.referenceValue ?? option.value)}
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
                      const nextValue = draftValue && draftValue.trim().length > 0 ? draftValue : colorText;
                      onAssignPaletteColor(assignTarget, nextValue);
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
