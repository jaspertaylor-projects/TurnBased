import type {
  CSSProperties,
  DragEventHandler,
  MouseEventHandler,
  ReactNode,
} from 'react';

import { getBoardSurfaceTextureStyle, type BoardSurfaceAppearance } from './board-surface-style';

type SurfaceElementRef =
  | ((instance: HTMLDivElement | null) => void)
  | { readonly current: HTMLDivElement | null }
  | null;

function assignSurfaceElementRef(surfaceRef: SurfaceElementRef | undefined, node: HTMLDivElement | null) {
  if (typeof surfaceRef === 'function') {
    surfaceRef(node);
    return;
  }

  if (surfaceRef && typeof surfaceRef === 'object') {
    (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }
}

export interface BoardSurfaceItem {
  id: string;
  label: string;
  typeLabel?: string;
  icon?: ReactNode;
  showHeader?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  background?: string | null;
  textureId?: string | null;
  textureOpacity?: number;
  borderColor?: string | null;
  borderWidth?: number;
  borderRadius?: number;
  clipPath?: string | null;
  /** Rotation in degrees (clockwise). */
  rotation?: number;
  padding?: string | number;
  selected?: boolean;
  highlighted?: boolean;
  dropTarget?: boolean;
  content?: ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  onMouseMove?: MouseEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onResizeMouseDown?: MouseEventHandler<HTMLSpanElement>;
}

export interface BoardSurfaceProps {
  items: readonly BoardSurfaceItem[];
  width?: number;
  height?: number;
  minHeight?: number;
  background?: string;
  surfaceAppearance?: BoardSurfaceAppearance;
  surfaceBorderRadius?: number | string;
  showGrid?: boolean;
  editable?: boolean;
  showItemHeader?: boolean;
  showResizeHandle?: boolean;
  emptyState?: ReactNode;
  surfaceRef?: SurfaceElementRef;
  onSurfaceDragOver?: DragEventHandler<HTMLDivElement>;
  onSurfaceDrop?: DragEventHandler<HTMLDivElement>;
}

const defaultBackground =
  'linear-gradient(160deg, rgba(16,185,129,0.16), rgba(14,165,233,0.08), rgba(250,204,21,0.12))';

/** Parse a CSS `polygon(...)` value into SVG `<polygon points="...">` coords on a 0-100 viewBox. */
function parsePolygonPoints(clipPath: string): string | null {
  const match = clipPath.match(/^polygon\((.+)\)$/);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((pair) => {
      const [x, y] = pair.trim().split(/\s+/).map((v) => parseFloat(v));
      return `${x},${y}`;
    })
    .join(' ');
}

function ClipPathBorder({ clipPath, color, width: strokeWidth }: { clipPath: string; color: string; width: number }) {
  const points = parsePolygonPoints(clipPath);
  if (!points) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <polygon
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 1.4}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function getItemStyle(
  item: BoardSurfaceItem,
  width: number,
  height: number,
  editable: boolean,
  showHeader: boolean,
): CSSProperties {
  return {
    position: 'absolute',
    // border-box: border is drawn INSIDE the percentage-based size so items
    // at their parent's edge don't overflow when the CSS transform zooms in.
    boxSizing: 'border-box',
    left: `${(item.x / width) * 100}%`,
    top: `${(item.y / height) * 100}%`,
    width: `${(item.width / width) * 100}%`,
    height: `${(item.height / height) * 100}%`,
    borderRadius: item.clipPath ? 0 : `${item.borderRadius ?? 18}px`,
    clipPath: item.clipPath ?? undefined,
    border: item.clipPath ? 'none' : `${item.borderWidth ?? 1}px solid ${item.dropTarget ? '#f97316' : item.borderColor ?? 'rgba(15,118,110,0.16)'}`,
    background: item.background ?? 'rgba(255,255,255,0.92)',
    // Use inset shadows so selection/highlight indicators don't extend
    // outside the item's box (which would be clipped when zoomed in).
    boxShadow: item.selected
      ? 'inset 0 0 0 2px rgba(249,115,22,0.45), 0 0 0 1px rgba(255,255,255,0.22), 0 0 18px rgba(255,255,255,0.12), 0 16px 36px rgba(6,78,59,0.12)'
      : item.highlighted
        ? 'inset 0 0 0 1px rgba(14,165,233,0.3), 0 16px 36px rgba(6,78,59,0.1)'
        : '0 14px 32px rgba(6,78,59,0.08)',
    color: '#064e3b',
    padding: item.padding !== undefined ? item.padding : editable ? '0.8rem 0.8rem 1rem 0.8rem' : '0.7rem',
    textAlign: 'left',
    display: 'grid',
    gridTemplateRows: showHeader ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
    gap: showHeader ? '0.55rem' : 0,
    overflow: 'hidden',
    cursor: editable ? 'move' : item.onClick ? 'pointer' : 'default',
    transition: 'box-shadow 140ms ease, border-color 140ms ease, background 140ms ease',
    ...(item.rotation ? { transform: `rotate(${item.rotation}deg)`, transformOrigin: 'center center' } : {}),
  };
}

function getItemTextureOverlayStyle(
  item: BoardSurfaceItem,
): CSSProperties | null {
  if (!item.textureId || item.textureId === 'none') {
    return null;
  }

  const textureStyle = getBoardSurfaceTextureStyle(
    item.textureId as Parameters<typeof getBoardSurfaceTextureStyle>[0],
    item.textureOpacity ?? 0.3,
  );

  if (!textureStyle.backgroundImage) {
    return null;
  }

  return {
    position: 'absolute',
    inset: 0,
    borderRadius: `${(item.borderRadius ?? 18) - 1}px`,
    pointerEvents: 'none',
    ...textureStyle,
  };
}

function BoardSurfaceItemInner({
  item,
  showHeader,
}: {
  item: BoardSurfaceItem;
  showHeader: boolean;
}) {
  return (
    <>
      {showHeader ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            {item.icon ? <span style={{ display: 'inline-grid', placeItems: 'center', color: '#064e3b' }}>{item.icon}</span> : null}
            <span
              style={{
                fontWeight: 800,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </span>
          </div>
          {item.typeLabel ? (
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0f766e' }}>
              {item.typeLabel}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
        {item.content}
      </div>
    </>
  );
}

export function BoardSurface({
  items,
  width = 760,
  height = 520,
  minHeight = 420,
  background = defaultBackground,
  surfaceAppearance,
  surfaceBorderRadius,
  showGrid = false,
  editable = false,
  showItemHeader = true,
  showResizeHandle = true,
  emptyState,
  surfaceRef,
  onSurfaceDragOver,
  onSurfaceDrop,
}: BoardSurfaceProps) {
  const textureStyle = getBoardSurfaceTextureStyle(surfaceAppearance?.textureId, surfaceAppearance?.textureOpacity);
  const resolvedBorderColor = surfaceAppearance?.borderColor ?? 'rgba(15,118,110,0.12)';
  const resolvedBorderWidth = Math.max(0, surfaceAppearance?.borderWidth ?? 1);
  const resolvedBorderStyle = surfaceAppearance?.borderStyle ?? 'solid';

  return (
    <div
      ref={(node) => assignSurfaceElementRef(surfaceRef, node)}
      onDragOver={onSurfaceDragOver}
      onDrop={onSurfaceDrop}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: `${minHeight}px`,
        aspectRatio: `${width} / ${height}`,
        borderRadius: surfaceBorderRadius ?? 0,
        border: `${resolvedBorderWidth}px ${resolvedBorderStyle} ${resolvedBorderColor}`,
        background: surfaceAppearance?.background ?? background,
        overflow: 'hidden',
      }}
    >
      {textureStyle.backgroundImage ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: textureStyle.backgroundImage,
          backgroundSize: textureStyle.backgroundSize,
          backgroundPosition: textureStyle.backgroundPosition,
          backgroundRepeat: textureStyle.backgroundRepeat,
          filter: textureStyle.filter,
        }} />
      ) : null}

      {showGrid ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(15,118,110,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      ) : null}

      {items.length === 0 && emptyState ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          {emptyState}
        </div>
      ) : null}

      {items.map((item) => {
        const resolvedShowHeader = item.showHeader ?? showItemHeader;
        const interactive = Boolean(item.onClick || item.onDoubleClick || item.onMouseDown || item.onDragOver || item.onDrop);

        if (!interactive) {
          const itemTextureOverlay = getItemTextureOverlayStyle(item);

          return (
            <div key={item.id} style={getItemStyle(item, width, height, editable, resolvedShowHeader)}>
              {itemTextureOverlay ? <div style={itemTextureOverlay} /> : null}
              {item.clipPath ? <ClipPathBorder clipPath={item.clipPath} color={item.dropTarget ? '#f97316' : item.borderColor ?? 'rgba(15,118,110,0.16)'} width={item.borderWidth ?? 1} /> : null}
              <BoardSurfaceItemInner item={item} showHeader={resolvedShowHeader} />
            </div>
          );
        }

        return (
          <div
            key={item.id}
            role={item.onClick ? 'button' : undefined}
            tabIndex={item.onClick ? 0 : undefined}
            onClick={item.onClick}
            onDoubleClick={item.onDoubleClick}
            onMouseDown={item.onMouseDown}
            onMouseMove={item.onMouseMove}
            onDragOver={item.onDragOver}
            onDrop={item.onDrop}
            onKeyDown={item.onClick
              ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  item.onClick?.();
                }
              }
              : undefined}
            style={getItemStyle(item, width, height, editable, resolvedShowHeader)}
          >
            {(() => {
              const itemTextureOverlay = getItemTextureOverlayStyle(item);
              return itemTextureOverlay ? <div style={itemTextureOverlay} /> : null;
            })()}
            {item.clipPath ? <ClipPathBorder clipPath={item.clipPath} color={item.dropTarget ? '#f97316' : item.borderColor ?? 'rgba(15,118,110,0.16)'} width={item.borderWidth ?? 1} /> : null}
            <BoardSurfaceItemInner item={item} showHeader={resolvedShowHeader} />
            {editable && showResizeHandle && item.onResizeMouseDown ? (
              <span
                onMouseDown={item.onResizeMouseDown}
                style={{
                  position: 'absolute',
                  right: '10px',
                  bottom: '10px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  background: item.selected ? '#f97316' : 'rgba(15,118,110,0.28)',
                  cursor: 'nwse-resize',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
