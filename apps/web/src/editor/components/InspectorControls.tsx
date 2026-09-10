import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { BOARD_SURFACE_TEXTURE_OPTIONS } from '@turnbased/engine-components';
import type { BoardSurfaceTextureId } from '@turnbased/engine-components';
import { ProjectColorPicker, getBoardSurfaceTextureStyle } from '@turnbased/engine-ui';
import type { PaletteColorOption } from '@turnbased/engine-ui';

import { tabletop, tabletopField as inputStyle, tabletopLabel as labelStyle } from '../theme/tabletop';

interface InspectorAccordionProps {
  title: string;
  defaultOpen?: boolean;
  compact?: boolean;
  children: ReactNode;
}

interface InspectorColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  palette?: readonly PaletteColorOption[];
  onAssignPaletteColor?: (paletteId: string, value: string) => void;
}

interface InspectorTextureControls {
  label?: string;
  value: BoardSurfaceTextureId;
  onChange: (value: BoardSurfaceTextureId) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
  previewBackground?: string;
  previewMeta?: ReactNode;
}

interface InspectorBorderControls {
  colorLabel?: string;
  colorValue: string;
  onColorChange: (value: string) => void;
  controls?: ReactNode;
}

interface InspectorAppearanceControlsProps {
  scopeLabel?: string;
  backgroundLabel?: string;
  backgroundValue: string;
  onBackgroundChange: (value: string) => void;
  palette?: readonly PaletteColorOption[];
  onAssignPaletteColor?: (paletteId: string, value: string) => void;
  texture?: InspectorTextureControls;
  border?: InspectorBorderControls;
  backgroundDefaultOpen?: boolean;
  borderDefaultOpen?: boolean;
  accordionCompact?: boolean;
}

const compactInputStyle: CSSProperties = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

function resolvePalettePreviewColor(
  value: string | null | undefined,
  palette: readonly PaletteColorOption[],
): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const linkedPaletteOption = palette.find((option) => option.referenceValue === value);
  return linkedPaletteOption?.value ?? value;
}

export function InspectorAccordion({
  title,
  defaultOpen = false,
  compact = false,
  children,
}: InspectorAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div data-layout="inspectorAccordion" style={{ borderTop: `1px solid ${tabletop.parchment.edge}`, alignSelf: 'start' }}>
      <button
        type="button"
        className="inspector-accordion-trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'calc(100% + 0.9rem)',
          padding: compact && !isOpen ? '0.42rem 0.45rem' : '0.6rem 0.45rem',
          margin: '0 -0.45rem',
          border: 'none',
          borderRadius: '8px',
          background: 'none',
          cursor: 'pointer',
          color: tabletop.brass.deep,
          fontSize: compact && !isOpen ? '0.72rem' : '0.76rem',
          fontWeight: 800,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          textAlign: 'left',
          lineHeight: 1.1,
          transition: 'background 140ms ease',
        }}
      >
        {title}
        <ChevronDown
          size={compact && !isOpen ? 12 : 14}
          style={{
            transition: 'transform 180ms ease, color 140ms ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: tabletop.brass.base,
          }}
        />
      </button>
      <div
        data-layout="inspectorAccordionAnimation"
        style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease' }}
      >
        <div data-layout="inspectorAccordionContent" inert={!isOpen} style={{ minHeight: 0, overflow: isOpen ? 'visible' : 'hidden' }}>
        {/* brass hairline rule under the section heading */}
        <div data-layout="inspectorAccordionDivider" style={{ height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${tabletop.brass.base}, ${tabletop.brass.light} 40%, rgba(184,146,78,0))`, marginBottom: '0.45rem' }} />
        <div data-layout="inspectorAccordionFields" style={{ display: 'grid', gap: '0.6rem', paddingBottom: '0.5rem' }}>
          {children}
        </div>
        </div>
      </div>
    </div>
  );
}

export function InspectorColorField({
  label,
  value,
  onChange,
  palette = [],
  onAssignPaletteColor,
}: InspectorColorFieldProps) {
  return (
    <label style={labelStyle}>
      {label}
      <ProjectColorPicker
        value={value}
        palette={palette}
        onChange={onChange}
        onAssignPaletteColor={onAssignPaletteColor}
        popupPlacement="left"
      />
    </label>
  );
}

export function InspectorAppearanceControls({
  scopeLabel,
  backgroundLabel = 'Color',
  backgroundValue,
  onBackgroundChange,
  palette = [],
  onAssignPaletteColor,
  texture,
  border,
  backgroundDefaultOpen = false,
  borderDefaultOpen = false,
  accordionCompact = false,
}: InspectorAppearanceControlsProps) {
  const backgroundTitle = scopeLabel ? `${scopeLabel} Background` : 'Background';
  const borderTitle = scopeLabel ? `${scopeLabel} Border` : 'Border';
  const resolvedPreviewBackground = resolvePalettePreviewColor(
    texture?.previewBackground ?? backgroundValue,
    palette,
  ) ?? backgroundValue;
  const selectedTexture = texture
    ? BOARD_SURFACE_TEXTURE_OPTIONS.find((option) => option.id === texture.value) ?? BOARD_SURFACE_TEXTURE_OPTIONS[0]
    : null;
  const textureStyle = texture && texture.value !== 'none'
    ? getBoardSurfaceTextureStyle(texture.value, texture.opacity)
    : null;

  return (
    <>
      <InspectorAccordion title={backgroundTitle} defaultOpen={backgroundDefaultOpen} compact={accordionCompact}>
        <InspectorColorField
          label={backgroundLabel}
          value={backgroundValue}
          onChange={onBackgroundChange}
          palette={palette}
          onAssignPaletteColor={onAssignPaletteColor}
        />

        {texture ? (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <label style={labelStyle}>
              {texture.label ?? 'Texture'}
              <select
                value={texture.value}
                onChange={(event) => texture.onChange(event.target.value as BoardSurfaceTextureId)}
                style={compactInputStyle}
              >
                {BOARD_SURFACE_TEXTURE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {texture.value !== 'none' && textureStyle && selectedTexture ? (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <label style={{ ...labelStyle, display: 'grid', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span>Texture Opacity</span>
                    <span style={{ color: '#0f766e', fontWeight: 700 }}>{Math.round(texture.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={texture.opacity}
                    onChange={(event) => texture.onOpacityChange(parseFloat(event.target.value))}
                    style={{ width: '100%', accentColor: '#0f766e' }}
                  />
                </label>

                <div
                  style={{
                    borderRadius: '14px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    background: 'rgba(255,255,255,0.96)',
                    padding: '0.55rem',
                    display: 'grid',
                    gap: '0.45rem',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      minHeight: '42px',
                      borderRadius: '10px',
                      border: '1px solid rgba(15,118,110,0.12)',
                      background: resolvedPreviewBackground,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        ...textureStyle,
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '0.12rem' }}>
                    <span style={{ color: '#064e3b', fontSize: '0.8rem', fontWeight: 700 }}>{selectedTexture.label}</span>
                    {texture.previewMeta ?? (
                      <span style={{ color: '#0f766e', fontSize: '0.72rem', lineHeight: 1.35 }}>{selectedTexture.description}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </InspectorAccordion>

      {border ? (
        <InspectorAccordion title={borderTitle} defaultOpen={borderDefaultOpen} compact={accordionCompact}>
          <InspectorColorField
            label={border.colorLabel ?? 'Color'}
            value={border.colorValue}
            onChange={border.onColorChange}
            palette={palette}
            onAssignPaletteColor={onAssignPaletteColor}
          />
          {border.controls}
        </InspectorAccordion>
      ) : null}
    </>
  );
}
