import type { CSSProperties, ReactNode } from 'react';
import { getBoardSurfaceTextureStyle } from '@turnbased/engine-ui';

import { renderIcon } from '../iconography';
import { resolveProjectPaletteColorValue } from '../projectPalette';
import type { EditorIconAsset, EditorProject } from '../types';

/**
 * Resolves a color value that may be a palette reference to its actual CSS color.
 */
function resolveColor(project: EditorProject, value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return 'transparent';
  }

  return resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value;
}

/**
 * Renders the inner content for a custom icon (SVG markup or short glyph).
 *
 * The container that wraps this is already sized by the icon-scale percentage,
 * so this function only needs to fill that container.
 */
function renderCustomContent(item: EditorIconAsset, color: string, size: number, isPlaceholder: boolean): ReactNode {
  const trimmedMarkup = item.customSvgMarkup.trim();

  if (!trimmedMarkup) {
    if (isPlaceholder) {
      return (
        <div style={{ fontSize: '0.78rem', color: '#0f766e', textAlign: 'center', lineHeight: 1.4, padding: '0.4rem' }}>
          Add SVG markup or a short glyph to create a custom icon.
        </div>
      );
    }

    return (
      <span style={{ color, fontSize: `${size * 0.38}px`, fontWeight: 800, lineHeight: 1 }}>
        ?
      </span>
    );
  }

  if (trimmedMarkup.startsWith('<svg')) {
    return (
      <div
        style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color }}
        dangerouslySetInnerHTML={{ __html: trimmedMarkup }}
      />
    );
  }

  // Glyph (emoji or 1-2 character symbol) — scale with tile size.
  const glyphSize = size * 0.5;
  return (
    <div style={{ color, fontSize: `${glyphSize}px`, fontWeight: 800, lineHeight: 1 }}>
      {trimmedMarkup.slice(0, 2)}
    </div>
  );
}

export interface IconTileProps {
  item: EditorIconAsset;
  project: EditorProject;
  size: number;
  /**
   * When true, renders as inline `<span>` elements suitable for embedding in text.
   * When false (default), renders as block `<div>` elements.
   */
  inline?: boolean;
  /**
   * When true, shows editor placeholder text for empty custom icons.
   * When false (default), shows a "?" fallback glyph.
   */
  showPlaceholder?: boolean;
}

/**
 * Canonical icon tile renderer.
 *
 * All icon previews in the app — Art Studio, text boxes, inspectors, board
 * surface — must use this component to guarantee pixel-perfect consistency.
 *
 * The authored icon properties use 100px as their reference size. Border
 * radius, border width, icon stroke width, and icon pixel size are all
 * scaled proportionally from that reference.
 */
export function IconTile({ item, project, size, inline = false, showPlaceholder = false }: IconTileProps) {
  const backgroundColor = resolveColor(project, item.backgroundColor);
  const borderColor = resolveColor(project, item.borderColor);
  const iconColor = resolveColor(project, item.iconColor);
  const fillColor = resolveColor(project, item.iconFillColor);
  const textureStyle = item.backgroundTextureId !== 'none'
    ? getBoardSurfaceTextureStyle(item.backgroundTextureId, item.backgroundTextureOpacity)
    : null;

  // 100px is the reference size — all authored values are relative to it.
  const scale = size / 100;
  const scaledBorderRadius = Math.min(item.borderRadius * scale, size / 2);
  const scaledBorderWidth = Math.max(0, item.borderWidth * scale);

  const Tag = inline ? 'span' : 'div';

  const outerStyle: CSSProperties = {
    position: 'relative',
    display: inline ? 'inline-grid' : 'grid',
    placeItems: 'center',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${scaledBorderRadius}px`,
    border: `${scaledBorderWidth}px solid ${borderColor}`,
    background: backgroundColor,
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...(inline ? {
      marginInline: '0.08em',
      verticalAlign: 'middle',
      lineHeight: 0,
    } : {}),
  };

  const iconContainerStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: `${(item.iconScale ?? 1) * 72}%`,
    height: `${(item.iconScale ?? 1) * 72}%`,
    display: inline ? 'inline-grid' : 'grid',
    placeItems: 'center',
    color: iconColor,
    overflow: 'hidden',
  };

  return (
    <Tag style={outerStyle}>
      {textureStyle?.backgroundImage ? (
        <Tag
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            ...textureStyle,
          }}
        />
      ) : null}

      <Tag style={iconContainerStyle}>
        {item.mode === 'custom'
          ? renderCustomContent(item, iconColor, size, showPlaceholder)
          : renderIcon(item.iconKey, {
              size: size * 0.42 * (item.iconScale ?? 1),
              // strokeWidth is in SVG viewBox units (24×24 coordinate space).
              // The SVG's own size-to-viewBox scaling already makes strokes
              // thinner/thicker proportionally as the icon pixel size changes,
              // so we pass the authored value directly — no manual scaling.
              strokeWidth: item.iconStrokeWidth,
              fillColor,
              style: { color: iconColor },
            })}
      </Tag>
    </Tag>
  );
}
