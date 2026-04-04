import {
  type DragEventHandler,
  type Ref,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { Stage, Layer, Group, Rect, Text, Path } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';

import type { BoardSurfaceAppearance } from './board-surface-style';
import type { BoardSurfaceItem } from './board-surface';

export interface KonvaBoardSurfaceProps {
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
  surfaceRef?: Ref<HTMLDivElement>;
  onSurfaceDragOver?: DragEventHandler<HTMLDivElement>;
  onSurfaceDrop?: DragEventHandler<HTMLDivElement>;
}

const defaultBackground = 'linear-gradient(160deg, rgba(16,185,129,0.16), rgba(14,165,233,0.08), rgba(250,204,21,0.12))';

function parsePolygonData(clipPath: string, w: number, h: number): string | null {
  const match = clipPath.match(/^polygon\((.+)\)$/);
  if (!match) return null;
  const points = match[1]
    .split(',')
    .map((pair) => {
      const [x, y] = pair.trim().split(/\s+/).map((v) => parseFloat(v));
      return { x: (x / 100) * w, y: (y / 100) * h };
    });
    
  if (points.length === 0) return null;
  return `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + ' Z';
}

function KonvaItemBackground({ item }: { item: BoardSurfaceItem }) {
  const [img] = useImage(item.textureId ?? '', 'anonymous');
  const hasClip = Boolean(item.clipPath);
  const w = item.width;
  const h = item.height;
  const cornerRadius = typeof item.borderRadius === 'number' ? item.borderRadius : 18;
  const strokeWidth = item.borderWidth ?? 1;
  const strokeCol = item.dropTarget ? '#f97316' : (item.borderColor ?? 'rgba(15,118,110,0.16)');
  const fillCol = item.background ?? 'rgba(255,255,255,0.92)';

  if (hasClip && item.clipPath) {
    const data = parsePolygonData(item.clipPath, w, h);
    if (data) {
      return (
        <Group>
          <Path data={data} fill={fillCol} />
          {img && <Path data={data} fillPatternImage={img} fillPatternOpacity={item.textureOpacity ?? 0.3} />}
          <Path data={data} stroke={strokeCol} strokeWidth={strokeWidth} />
        </Group>
      );
    }
  }

  return (
    <Group>
      <Rect
        width={w}
        height={h}
        fill={fillCol}
        cornerRadius={item.clipPath ? 0 : cornerRadius}
        shadowColor="rgba(6,78,59,0.08)"
        shadowBlur={32}
        shadowOffset={{ x: 0, y: 14 }}
      />
      {img && (
        <Rect
          width={w}
          height={h}
          fillPatternImage={img}
          fillPatternOpacity={item.textureOpacity ?? 0.3}
          cornerRadius={item.clipPath ? 0 : cornerRadius}
        />
      )}
      <Rect
        width={w}
        height={h}
        stroke={strokeCol}
        strokeWidth={item.clipPath ? 0 : strokeWidth}
        cornerRadius={item.clipPath ? 0 : cornerRadius}
      />
    </Group>
  );
}

export function KonvaBoardSurface({
  items,
  width = 760,
  height = 520,
  minHeight = 420,
  background = defaultBackground,
  surfaceAppearance,
  surfaceBorderRadius,
  showGrid: _showGrid = false,
  editable: _editable = false,
  showItemHeader = true,
  showResizeHandle: _showResizeHandle = true,
  emptyState: _emptyState,
  surfaceRef,
  onSurfaceDragOver,
  onSurfaceDrop,
}: KonvaBoardSurfaceProps) {
  const resolvedBorderColor = surfaceAppearance?.borderColor ?? 'rgba(15,118,110,0.12)';
  const resolvedBorderWidth = Math.max(0, surfaceAppearance?.borderWidth ?? 1);
  const resolvedBorderStyle = surfaceAppearance?.borderStyle ?? 'solid';

  // State to deal with hydration issues matching next.js/react
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

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
        borderRadius: surfaceBorderRadius ?? 0,
        border: `${resolvedBorderWidth}px ${resolvedBorderStyle} ${resolvedBorderColor}`,
        background: surfaceAppearance?.background ?? background,
        overflow: 'hidden',
      }}
    >
      <Stage width={width} height={height} style={{ width: '100%', height: '100%' }}>
        <Layer>
          {items.map((item) => {
            const resolvedShowHeader = item.showHeader ?? showItemHeader;
            
            return (
              <Group
                key={item.id}
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                onClick={item.onClick as any}
                onDblClick={item.onDoubleClick as any}
                onMouseDown={item.onMouseDown as any}
                onMouseMove={item.onMouseMove as any}
              >
                <KonvaItemBackground item={item} />
                
                {resolvedShowHeader && (
                  <Text 
                    y={12} 
                    x={12} 
                    text={item.label} 
                    fontSize={14} 
                    fill="#064e3b" 
                    fontStyle="bold" 
                    width={item.width - 24}
                    wrap="none"
                    ellipsis={true}
                  />
                )}
                
                <Html divProps={{
                  style: {
                    position: 'absolute',
                    top: `${resolvedShowHeader ? 32 : 12}px`,
                    left: '12px',
                    width: `${item.width - 24}px`,
                    height: `${item.height - (resolvedShowHeader ? 44 : 24)}px`,
                    overflow: 'hidden',
                    pointerEvents: 'none', // canvas handles pointers
                  }
                }}>
                  {item.content}
                </Html>
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
