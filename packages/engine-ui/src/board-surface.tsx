import type {
  CSSProperties,
  DragEventHandler,
  MouseEventHandler,
  Ref,
  ReactNode,
} from 'react';

import { getBoardSurfaceTextureStyle, type BoardSurfaceAppearance } from './board-surface-style';

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
  selected?: boolean;
  highlighted?: boolean;
  dropTarget?: boolean;
  content?: ReactNode;
  onClick?: () => void;
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
  showGrid?: boolean;
  editable?: boolean;
  showItemHeader?: boolean;
  showResizeHandle?: boolean;
  emptyState?: ReactNode;
  surfaceRef?: Ref<HTMLDivElement>;
  onSurfaceDragOver?: DragEventHandler<HTMLDivElement>;
  onSurfaceDrop?: DragEventHandler<HTMLDivElement>;
}

const defaultBackground =
  'linear-gradient(160deg, rgba(16,185,129,0.16), rgba(14,165,233,0.08), rgba(250,204,21,0.12))';

function getItemStyle(
  item: BoardSurfaceItem,
  width: number,
  height: number,
  editable: boolean,
  showHeader: boolean,
): CSSProperties {
  return {
    position: 'absolute',
    left: `${(item.x / width) * 100}%`,
    top: `${(item.y / height) * 100}%`,
    width: `${(item.width / width) * 100}%`,
    height: `${(item.height / height) * 100}%`,
    borderRadius: `${item.borderRadius ?? 18}px`,
    border: `${item.borderWidth ?? 1}px solid ${item.dropTarget ? '#f97316' : item.borderColor ?? 'rgba(15,118,110,0.16)'}`,
    background: item.background ?? 'rgba(255,255,255,0.92)',
    boxShadow: item.selected
      ? '0 0 0 2px rgba(249,115,22,0.24), 0 16px 36px rgba(6,78,59,0.12)'
      : item.highlighted
        ? '0 0 0 1px rgba(14,165,233,0.18), 0 16px 36px rgba(6,78,59,0.1)'
        : '0 14px 32px rgba(6,78,59,0.08)',
    color: '#064e3b',
    padding: editable ? '0.8rem 0.8rem 1rem 0.8rem' : '0.7rem',
    textAlign: 'left',
    display: 'grid',
    gridTemplateRows: showHeader ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
    gap: showHeader ? '0.55rem' : 0,
    overflow: 'hidden',
    cursor: editable ? 'move' : item.onClick ? 'pointer' : 'default',
    transition: 'box-shadow 140ms ease, border-color 140ms ease, background 140ms ease',
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
      ref={surfaceRef}
      onDragOver={onSurfaceDragOver}
      onDrop={onSurfaceDrop}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: `${minHeight}px`,
        aspectRatio: `${width} / ${height}`,
        borderRadius: '30px',
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
        const interactive = Boolean(item.onClick || item.onMouseDown || item.onDragOver || item.onDrop);

        if (!interactive) {
          const itemTextureOverlay = getItemTextureOverlayStyle(item);

          return (
            <div key={item.id} style={getItemStyle(item, width, height, editable, resolvedShowHeader)}>
              {itemTextureOverlay ? <div style={itemTextureOverlay} /> : null}
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
