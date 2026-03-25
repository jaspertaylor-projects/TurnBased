import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  BOARD_BORDER_STYLE_OPTIONS,
  BOARD_SURFACE_TEXTURE_OPTIONS,
  getBoardComponentPreset,
  getBuiltInComponentManifest,
  getGridCoordinateKey,
  listBoardComponentPresets,
  listGridNeighborOptions,
  normalizeGridCellCoordinates,
  resolveBoardAppearanceProperties,
  validateComponentPlacement,
} from '@turnbased/engine-components';
import type {
  BoardComponentPreset,
  BoardComponentPresetFamily,
  BoardSurfaceTextureId,
  BuiltInComponentType,
  ComponentFrame,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';
import { BoardGrid, BoardSurface, ProjectColorPicker, getBoardSurfaceTextureStyle } from '@turnbased/engine-ui';

import { renderComponentIcon } from '../componentMeta';
import { listProjectPaletteOptions } from '../projectPalette';
import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  clampBoardItemFrame,
  defaultBoardItemFrame,
  getBoardGridCells,
  getResolvedBoardItemFrame,
  isBoardGridComponentType,
  isMovableComponentType,
  resizeBoardItemFrame,
} from '../boardLayout';
import { parsePropertyValue } from '../helpers';
import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Unknown Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

function EditorAccordion({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    if (isOpen) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      const timeout = setTimeout(() => setContentHeight('auto'), 220);
      return () => clearTimeout(timeout);
    }

    setContentHeight(contentRef.current.scrollHeight);
    requestAnimationFrame(() => {
      setContentHeight(0);
    });

    return undefined;
  }, [isOpen]);

  return (
    <div style={{ borderTop: '1px solid rgba(15,118,110,0.08)' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.55rem 0',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#0f766e',
          fontSize: '0.76rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'left',
        }}
      >
        {title}
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 180ms ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: '#0d9488',
          }}
        />
      </button>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          height: typeof contentHeight === 'number' ? `${contentHeight}px` : 'auto',
          transition: 'height 200ms ease',
        }}
      >
        <div style={{ display: 'grid', gap: '0.6rem', paddingBottom: '0.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}


function getComponentPath(project: EditorProject, instanceId: string): string[] {
  const path: string[] = [];
  let currentId: string | null = instanceId;

  while (currentId) {
    const instance: EditorProject['instances'][string] | undefined = project.instances[currentId];
    if (!instance) {
      break;
    }

    path.unshift(currentId);
    currentId = instance.parentId ? String(instance.parentId) : null;
  }

  return path;
}

type BoardInteractionState =
  | null
  | {
    kind: 'move' | 'resize';
    instanceId: string;
    pointerX: number;
    pointerY: number;
    boardUnitsPerPixelX: number;
    boardUnitsPerPixelY: number;
    startFrame: ComponentFrame;
    resizeEdges?: {
      left: boolean;
      right: boolean;
      top: boolean;
      bottom: boolean;
    };
  };

function getResizeEdgesForPointer(event: ReactMouseEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const inset = 12;
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  return {
    left: localX <= inset,
    right: localX >= rect.width - inset,
    top: localY <= inset,
    bottom: localY >= rect.height - inset,
  };
}

function hasResizeEdge(edges: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
  return edges.left || edges.right || edges.top || edges.bottom;
}

function getResizeCursor(edges: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
  if ((edges.left && edges.top) || (edges.right && edges.bottom)) {
    return 'nwse-resize';
  }

  if ((edges.right && edges.top) || (edges.left && edges.bottom)) {
    return 'nesw-resize';
  }

  if (edges.left || edges.right) {
    return 'ew-resize';
  }

  if (edges.top || edges.bottom) {
    return 'ns-resize';
  }

  return 'move';
}

const compactInputStyle = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

const BOARD_PRESET_FAMILY_ORDER: BoardComponentPresetFamily[] = ['space', 'track', 'grid'];

export function VisualsSection({
  project,
  selectedComponentId,
  selectedComponent,
  onSelectComponent,
  onAddComponent,
  onUpdateComponent,
  onRemoveComponent,
  onAssignProjectPaletteColor,
}: {
  project: EditorProject;
  selectedComponentId: string | null;
  selectedComponent: ComponentInstanceModel | null;
  onSelectComponent: (instanceId: string | null) => void;
  onAddComponent: (
    type: BuiltInComponentType,
    parentId?: string | null,
    options?: {
      focusNewComponent?: boolean;
      initializeComponent?: (instance: ComponentInstanceModel) => ComponentInstanceModel;
    },
  ) => string | null;
  onUpdateComponent: (instanceId: string, updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  onRemoveComponent: (instanceId: string) => void;
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const boardIds = useMemo(
    () => project.rootInstanceIds.filter((instanceId) => project.instances[instanceId]?.componentType === 'board'),
    [project],
  );
  const activeBoardId = selectedComponent?.componentType === 'board'
    ? selectedComponentId
    : (boardIds[0] ?? null);
  const activeBoard = activeBoardId ? project.instances[activeBoardId] ?? null : null;
  const boardChildIds = activeBoard
    ? activeBoard.children.map(String).filter((childId) => {
      const child = project.instances[childId];
      return child && !isMovableComponentType(child.componentType);
    })
    : [];
  const [selectedBoardChildId, setSelectedBoardChildId] = useState<string | null>(null);
  const [selectedGridCellKey, setSelectedGridCellKey] = useState<string | null>(null);
  const [boardInteraction, setBoardInteraction] = useState<BoardInteractionState>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Partial<Record<BoardComponentPresetFamily, string>>>({});
  const [showEditorGrid, setShowEditorGrid] = useState<boolean>(true);
  const resolvedSelectedBoardChildId = boardChildIds.includes(selectedBoardChildId ?? '')
    ? selectedBoardChildId
    : null;
  const selectedBoardChild = resolvedSelectedBoardChildId
    ? project.instances[resolvedSelectedBoardChildId] ?? null
    : null;
  const selectedGridCells = selectedBoardChild && isBoardGridComponentType(selectedBoardChild.componentType)
    ? getBoardGridCells(selectedBoardChild)
    : [];
  const resolvedSelectedGridCell = selectedGridCellKey
    ? (selectedGridCells.find((cell) => getGridCoordinateKey(cell) === selectedGridCellKey) ?? null)
    : null;
  const activeBoardManifest = activeBoard
    ? getBuiltInComponentManifest(activeBoard.componentType as BuiltInComponentType)
    : null;
  const boardPresetGroups = useMemo(() => {
    if (!activeBoardManifest) {
      return [] as Array<{ family: BoardComponentPresetFamily; familyLabel: string; presets: BoardComponentPreset[] }>;
    }

    const grouped = listBoardComponentPresets().reduce<Map<BoardComponentPresetFamily, BoardComponentPreset[]>>((groups, preset) => {
      const manifest = getBuiltInComponentManifest(preset.componentType);
      if (!validateComponentPlacement(manifest, activeBoardManifest).valid) {
        return groups;
      }

      const current = groups.get(preset.family) ?? [];
      current.push(preset);
      groups.set(preset.family, current);
      return groups;
    }, new Map());

    return BOARD_PRESET_FAMILY_ORDER
      .map((family) => ({
        family,
        familyLabel: (grouped.get(family)?.[0]?.familyLabel ?? family),
        presets: grouped.get(family) ?? [],
      }))
      .filter((group) => group.presets.length > 0);
  }, [activeBoardManifest]);
  const selectedPath = activeBoardId ? getComponentPath(project, activeBoardId) : [];
  const paletteOptions = useMemo(() => listProjectPaletteOptions(project), [project]);
  const boardAppearance = activeBoard
    ? resolveBoardAppearanceProperties(activeBoard.properties)
    : null;

  function clearBoardSelection() {
    setSelectedBoardChildId(null);
    setSelectedGridCellKey(null);
  }

  function getPresetFamily(componentType: BuiltInComponentType): BoardComponentPresetFamily | null {
    if (componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid') {
      return 'grid';
    }

    if (componentType === 'space' || componentType === 'track') {
      return componentType;
    }

    return null;
  }

  function getSelectedPresetForFamily(family: BoardComponentPresetFamily): BoardComponentPreset | null {
    const group = boardPresetGroups.find((entry) => entry.family === family);
    if (!group || group.presets.length === 0) {
      return null;
    }

    const selectedPresetId = selectedPresetIds[family];
    return group.presets.find((preset) => preset.id === selectedPresetId) ?? group.presets[0] ?? null;
  }

  useEffect(() => {
    if (!boardInteraction) {
      return undefined;
    }

    const interaction = boardInteraction;

    function handlePointerMove(event: globalThis.MouseEvent) {
      const dx = (event.clientX - interaction.pointerX) * interaction.boardUnitsPerPixelX;
      const dy = (event.clientY - interaction.pointerY) * interaction.boardUnitsPerPixelY;

      onUpdateComponent(interaction.instanceId, (instance) => {
        const nextFrame = interaction.kind === 'move'
          ? {
            ...interaction.startFrame,
            x: interaction.startFrame.x + dx,
            y: interaction.startFrame.y + dy,
          }
          : resizeBoardItemFrame(interaction.startFrame, dx, dy, interaction.resizeEdges ?? {
            left: false,
            right: true,
            top: false,
            bottom: true,
          });

        return {
          ...instance,
          frame: clampBoardItemFrame(nextFrame),
        };
      });
    }

    function handlePointerUp() {
      setBoardInteraction(null);
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [boardInteraction, onUpdateComponent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && resolvedSelectedBoardChildId) {
        event.preventDefault();
        onRemoveComponent(resolvedSelectedBoardChildId);
        setSelectedBoardChildId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolvedSelectedBoardChildId, onRemoveComponent]);

  function updateBoardChildFrame(instanceId: string, updater: (frame: ComponentFrame) => ComponentFrame) {
    const instance = project.instances[instanceId];
    if (!instance) {
      return;
    }

    const childIndex = boardChildIds.indexOf(instanceId);
    const currentFrame = getResolvedBoardItemFrame(instance, Math.max(childIndex, 0));
    onUpdateComponent(instanceId, (current) => ({
      ...current,
      frame: clampBoardItemFrame(updater(currentFrame)),
    }));
  }

  function updateGridCells(instanceId: string, updater: (cells: GridCellCoordinate[]) => GridCellCoordinate[]) {
    const instance = project.instances[instanceId];
    if (!instance || !isBoardGridComponentType(instance.componentType)) {
      return;
    }

    const currentCells = getBoardGridCells(instance);
    const nextCells = normalizeGridCellCoordinates(updater(currentCells));
    onUpdateComponent(instanceId, (current) => ({
      ...current,
      properties: {
        ...current.properties,
        cells: nextCells,
      },
    }));
  }

  function applyPresetToInstance(
    instance: ComponentInstanceModel,
    preset: BoardComponentPreset,
    childIndex: number,
    options: {
      x?: number;
      y?: number;
      preservePosition?: boolean;
    } = {},
  ): ComponentInstanceModel {
    const baseFrame = getResolvedBoardItemFrame(instance, childIndex);
    const nextManifest = getBuiltInComponentManifest(preset.componentType);
    const presetFrame = clampBoardItemFrame({
      ...defaultBoardItemFrame(preset.componentType, childIndex),
      ...preset.frame,
      x: options.preservePosition === false
        ? (typeof options.x === 'number' ? options.x : (preset.frame.x ?? defaultBoardItemFrame(preset.componentType, childIndex).x))
        : (typeof options.x === 'number' ? options.x : baseFrame.x),
      y: options.preservePosition === false
        ? (typeof options.y === 'number' ? options.y : (preset.frame.y ?? defaultBoardItemFrame(preset.componentType, childIndex).y))
        : (typeof options.y === 'number' ? options.y : baseFrame.y),
    });

    return {
      ...instance,
      componentType: preset.componentType,
      category: nextManifest.category,
      displayName: String(preset.properties.label ?? preset.label),
      properties: {
        ...instance.properties,
        ...preset.properties,
      },
      frame: presetFrame,
    };
  }

  function addBoardItem(preset: BoardComponentPreset, x?: number, y?: number) {
    if (!activeBoardId) {
      return;
    }

    const childIndex = boardChildIds.length;
    console.debug('[board-editor] add board item', {
      activeBoardId,
      presetId: preset.id,
      componentType: preset.componentType,
      x,
      y,
      childIndex,
    });

    const nextInstanceId = onAddComponent(preset.componentType, activeBoardId, {
      focusNewComponent: false,
      initializeComponent: (instance) => applyPresetToInstance(instance, preset, childIndex, {
        x,
        y,
        preservePosition: false,
      }),
    });
    if (!nextInstanceId) {
      console.debug('[board-editor] add board item failed', {
        activeBoardId,
        presetId: preset.id,
      });
      return;
    }

    console.debug('[board-editor] added board item', {
      activeBoardId,
      instanceId: nextInstanceId,
      presetId: preset.id,
    });
    setSelectedBoardChildId(nextInstanceId);
  }

  function handleSurfaceDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!activeBoardId) {
      return;
    }

    const droppedPresetId = event.dataTransfer.getData('text/turnbased-board-preset-id');
    const droppedPreset = droppedPresetId ? getBoardComponentPreset(droppedPresetId) : null;
    console.debug('[board-editor] surface drop', {
      activeBoardId,
      droppedPresetId,
      hasPreset: Boolean(droppedPreset),
    });
    if (!droppedPreset) {
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    const nextFrame = clampBoardItemFrame({
      ...defaultBoardItemFrame(droppedPreset.componentType, boardChildIds.length),
      ...droppedPreset.frame,
      x: droppedPreset.frame.x ?? defaultBoardItemFrame(droppedPreset.componentType, boardChildIds.length).x,
      y: droppedPreset.frame.y ?? defaultBoardItemFrame(droppedPreset.componentType, boardChildIds.length).y,
    });
    const x = rect
      ? ((event.clientX - rect.left) / rect.width) * BOARD_SURFACE_WIDTH - (nextFrame.width / 2)
      : nextFrame.x;
    const y = rect
      ? ((event.clientY - rect.top) / rect.height) * BOARD_SURFACE_HEIGHT - (nextFrame.height / 2)
      : nextFrame.y;

    addBoardItem(droppedPreset, x, y);
  }

  if (!activeBoard) {
    return (
      <div style={{ ...panelStyle, minHeight: '360px', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: '460px', display: 'grid', gap: '0.9rem' }}>
          <div style={{ fontWeight: 800, color: '#064e3b', fontSize: '1.08rem' }}>Board editor is the only active appearance editor right now</div>
          <p style={mutedTextStyle}>Add a board first. Spaces, tracks, hex grids, and checkerboard grids can then be arranged visually here and will match the preview surface.</p>
          <div>
            <button
              type="button"
              onClick={() => onAddComponent('board', null, { focusNewComponent: true })}
              style={{
                border: 'none',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #064e3b, #10b981)',
                color: 'white',
                padding: '0.75rem 1rem',
                fontWeight: 800,
              }}
            >
              Add Board
            </button>
          </div>
        </div>
      </div>
    );
  }

  const boardSurfaceItems = boardChildIds.map((childId, index) => {
    const child = project.instances[childId];
    if (!child) {
      return null;
    }

    const frame = getResolvedBoardItemFrame(child, index);
    const manifest = getBuiltInComponentManifest(child.componentType as BuiltInComponentType);
    const isSelected = childId === resolvedSelectedBoardChildId;

    return {
      id: childId,
      label: getComponentLabel(project, childId),
      typeLabel: manifest.displayName,
      icon: renderComponentIcon(child.componentType, { size: 16, style: { color: '#064e3b' } }),
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      background: frame.background,
      textureId: frame.textureId ?? null,
      textureOpacity: frame.textureOpacity ?? 0.3,
      borderColor: frame.borderColor,
      borderWidth: frame.borderWidth,
      borderRadius: frame.borderRadius,
      selected: isSelected,
      onClick: () => {
        setSelectedBoardChildId(childId);
        if (!isBoardGridComponentType(child.componentType)) {
          setSelectedGridCellKey(null);
        }
      },
      onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        setSelectedBoardChildId(childId);
        if (!isBoardGridComponentType(child.componentType)) {
          setSelectedGridCellKey(null);
        }
        const resizeEdges = getResizeEdgesForPointer(event);
        const surfaceRect = canvasRef.current?.getBoundingClientRect();
        setBoardInteraction({
          kind: hasResizeEdge(resizeEdges) ? 'resize' : 'move',
          instanceId: childId,
          pointerX: event.clientX,
          pointerY: event.clientY,
          boardUnitsPerPixelX: surfaceRect && surfaceRect.width > 0
            ? BOARD_SURFACE_WIDTH / surfaceRect.width
            : 1,
          boardUnitsPerPixelY: surfaceRect && surfaceRect.height > 0
            ? BOARD_SURFACE_HEIGHT / surfaceRect.height
            : 1,
          startFrame: frame,
          resizeEdges,
        });
      },
      onMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => {
        event.currentTarget.style.cursor = getResizeCursor(getResizeEdgesForPointer(event));
      },
      content: isBoardGridComponentType(child.componentType)
        ? (() => {
          const cellIds = child.children.map(String).filter((cellId) => project.instances[cellId]?.componentType === 'space');

          return (
            <BoardGrid
              kind={child.componentType as 'hex-grid' | 'square-grid' | 'checkerboard-grid'}
              editable
              cells={cellIds.map((cellId, cellIndex) => {
                const cell = project.instances[cellId];
                const row = typeof cell?.placement?.coordinates?.y === 'number'
                  ? Math.trunc(cell.placement.coordinates.y)
                  : cellIndex;
                const column = typeof cell?.placement?.coordinates?.x === 'number'
                  ? Math.trunc(cell.placement.coordinates.x)
                  : 0;
                const cellKey = getGridCoordinateKey({ x: column, y: row });
                const gridCellBg = typeof child.properties.cellBackground === 'string' && child.properties.cellBackground.trim().length > 0
                  ? child.properties.cellBackground
                  : 'rgba(255,255,255,0.92)';
                const gridCellTextureId = typeof child.properties.cellTextureId === 'string' ? child.properties.cellTextureId : null;
                const gridCellTextureOpacity = typeof child.properties.cellTextureOpacity === 'number' ? child.properties.cellTextureOpacity : 0.3;
                const gridCellBorderWidth = typeof child.properties.cellBorderWidth === 'number' ? child.properties.cellBorderWidth : undefined;
                const gridCellBorderRadius = typeof child.properties.cellBorderRadius === 'number' ? child.properties.cellBorderRadius : undefined;

                return {
                  id: cellId,
                  row,
                  column,
                  label: String(cell?.properties.label ?? cell?.displayName ?? `Cell ${cellIndex + 1}`),
                  background: gridCellBg,
                  textureId: gridCellTextureId,
                  textureOpacity: gridCellTextureOpacity,
                  borderColor: child.componentType === 'hex-grid' ? undefined : 'rgba(15,118,110,0.18)',
                  borderWidth: gridCellBorderWidth,
                  borderRadius: gridCellBorderRadius,
                  selected: isSelected && cellKey === (resolvedSelectedGridCell ? getGridCoordinateKey(resolvedSelectedGridCell) : null),
                  onMouseDown: (event) => {
                    event.stopPropagation();
                  },
                  onClick: () => {
                    setSelectedBoardChildId(childId);
                    setSelectedGridCellKey((current) => (current === cellKey ? null : cellKey));
                  },
                };
              })}
            />
          );
        })()
        : (
          <div style={{ color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.5 }}>
            Drag inside to move, drag the border to resize.
          </div>
        ),
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectedBoardChildFrame = selectedBoardChild && resolvedSelectedBoardChildId
    ? getResolvedBoardItemFrame(selectedBoardChild, Math.max(boardChildIds.indexOf(resolvedSelectedBoardChildId), 0))
    : null;
  const gridAllNeighborOptions = selectedBoardChild
    && resolvedSelectedBoardChildId
    && isBoardGridComponentType(selectedBoardChild.componentType)
    && resolvedSelectedGridCell
    ? listGridNeighborOptions(selectedBoardChild.componentType, resolvedSelectedGridCell).map((option) => ({
      ...option,
      available: !selectedGridCells.some((cell) => getGridCoordinateKey(cell) === getGridCoordinateKey(option.coordinate)),
    }))
    : [];
  const showGridShapePopup = Boolean(
    selectedBoardChild
      && resolvedSelectedBoardChildId
      && isBoardGridComponentType(selectedBoardChild.componentType)
      && selectedBoardChildFrame
      && (resolvedSelectedGridCell || selectedGridCells.length === 0)
  );
  const gridPopupComponentId = showGridShapePopup && resolvedSelectedBoardChildId
    ? resolvedSelectedBoardChildId
    : null;

  const boardBorderWidthOptions = [0, 1, 2, 4, 6, 8];

  function updateBoardAppearanceProperty(key: string, value: string | number) {
    if (!activeBoardId) {
      return;
    }

    onUpdateComponent(activeBoardId, (instance) => ({
      ...instance,
      properties: {
        ...instance.properties,
        [key]: value,
      },
    }));
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ ...panelStyle, display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0f766e' }}>
            Board Editor
              </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', color: '#064e3b', fontSize: '1.08rem', fontWeight: 800 }}>
            {renderComponentIcon('board', { size: 18, style: { color: '#064e3b' } })}
            {getComponentLabel(project, activeBoardId ?? activeBoard.instanceId)}
          </div>
          {selectedPath.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
              {selectedPath.map((instanceId, index) => (
                <div key={instanceId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {index > 0 ? <ChevronRight size={14} style={{ color: '#94a3b8' }} /> : null}
                  <button
                    type="button"
                    onClick={() => onSelectComponent(instanceId)}
                    style={{
                      border: 'none',
                      borderRadius: '999px',
                      background: instanceId === activeBoardId ? 'rgba(249,115,22,0.12)' : 'rgba(240,253,244,0.92)',
                      color: instanceId === activeBoardId ? '#9a3412' : '#065f46',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {getComponentLabel(project, instanceId)}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {boardPresetGroups.map((group) => {
            const selectedPreset = getSelectedPresetForFamily(group.family);
            const groupIconKey = group.family === 'grid' ? 'grid' : group.family;

            if (!selectedPreset) {
              return null;
            }

            return (
              <div
                key={group.family}
                style={{
                  borderRadius: '18px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(255,255,255,0.88)',
                  padding: '0.75rem',
                  display: 'grid',
                  gap: '0.55rem',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#064e3b', fontWeight: 800 }}>
                  {renderComponentIcon(groupIconKey, { size: 16, style: { color: '#064e3b' } })}
                  {group.familyLabel}
                </div>
                <select
                  value={selectedPreset.id}
                  onChange={(event) => setSelectedPresetIds((current) => ({
                    ...current,
                    [group.family]: event.target.value,
                  }))}
                  style={compactInputStyle}
                >
                  {group.presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              <div style={{ color: '#0f766e', fontSize: '0.8rem', minHeight: '2.4em' }}>{selectedPreset.description}</div>
                <button
                  type="button"
                  draggable
                  onClick={() => addBoardItem(selectedPreset)}
                  onDragStart={(event) => {
                    console.debug('[board-editor] preset drag start', {
                      activeBoardId,
                      presetId: selectedPreset.id,
                      componentType: selectedPreset.componentType,
                      family: group.family,
                    });
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/turnbased-board-preset-id', selectedPreset.id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    background: 'rgba(240,253,244,0.96)',
                    color: '#065f46',
                    padding: '0.55rem 0.8rem',
                    fontWeight: 700,
                    cursor: 'grab',
                  }}
                >
                  {renderComponentIcon(groupIconKey, { size: 15, style: { color: '#065f46' } })}
                  Drag Or Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '1rem', alignItems: 'start' }}>
        <div style={{ ...panelStyle, display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>Board Surface</p>
            {selectedBoardChild && resolvedSelectedBoardChildId ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(248,250,252,0.88)',
                  padding: '0.55rem 0.75rem',
                }}
              >
                <div style={{ minWidth: 0, display: 'grid', gap: '0.15rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, color: '#064e3b', fontWeight: 800 }}>
                    {renderComponentIcon(selectedBoardChild.componentType, { size: 16, style: { color: '#064e3b' } })}
                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getComponentLabel(project, resolvedSelectedBoardChildId)}
                    </span>
                  </div>
                  <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {getBuiltInComponentManifest(selectedBoardChild.componentType as BuiltInComponentType).displayName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBoardChildId(null);
                    onRemoveComponent(resolvedSelectedBoardChildId);
                  }}
                  aria-label={`Delete ${getComponentLabel(project, resolvedSelectedBoardChildId)}`}
                  title="Delete board item"
                  style={{
                    flex: '0 0 auto',
                    display: 'inline-grid',
                    placeItems: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '999px',
                    border: '1px solid rgba(239,68,68,0.18)',
                    background: 'rgba(254,242,242,0.96)',
                    color: '#b91c1c',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(240,253,244,0.48)',
                  padding: '0.55rem 0.75rem',
                  minHeight: '48px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.8rem', color: '#064e3b', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={showEditorGrid}
                    onChange={(event) => setShowEditorGrid(event.target.checked)}
                    style={{ accentColor: '#0f766e' }}
                  />
                  Show Editor Grid
                </label>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <BoardSurface
              items={boardSurfaceItems}
              width={BOARD_SURFACE_WIDTH}
              height={BOARD_SURFACE_HEIGHT}
              minHeight={560}
              surfaceAppearance={boardAppearance ? {
                background: boardAppearance.surfaceColor,
                textureId: boardAppearance.surfaceTexture,
                textureOpacity: boardAppearance.surfaceTextureOpacity,
                borderColor: boardAppearance.surfaceBorderColor,
                borderWidth: boardAppearance.surfaceBorderWidth,
                borderStyle: boardAppearance.surfaceBorderStyle,
              } : undefined}
              showGrid={showEditorGrid}
              editable
              showItemHeader={false}
              showResizeHandle={false}
              surfaceRef={canvasRef}
              onSurfaceDragOver={(event) => event.preventDefault()}
              onSurfaceDrop={handleSurfaceDrop}
              emptyState={(
                <div style={{ maxWidth: '320px', display: 'grid', gap: '0.55rem', color: '#0f766e' }}>
                  <strong style={{ color: '#064e3b' }}>Drop spaces, tracks, and board grids here</strong>
                  <span>Everything placed on this surface uses the same framing and styling rules as preview.</span>
                </div>
              )}
            />

          </div>
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid rgba(15,118,110,0.1)', paddingBottom: '0.8rem', marginBottom: '0.2rem', overflow: 'hidden' }}>
            {(resolvedSelectedBoardChildId || resolvedSelectedGridCell) && (
              <button
                type="button"
                onClick={() => {
                  if (resolvedSelectedGridCell) {
                    setSelectedGridCellKey(null);
                  } else if (resolvedSelectedBoardChildId) {
                    clearBoardSelection();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  borderRadius: '6px',
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: 'rgba(255,255,255,0.8)',
                  color: '#0f766e',
                  cursor: 'pointer',
                  marginRight: '0.2rem',
                }}
                title="Go Up"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}

            {(() => {
              if (resolvedSelectedGridCell && selectedBoardChild && resolvedSelectedBoardChildId) {
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedGridCellKey(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#64748b',
                        cursor: 'pointer',
                        flexShrink: 10,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                      }}
                      title={String(selectedBoardChild.displayName || selectedBoardChild.properties.label || 'Component')}
                    >
                      <span dir="ltr">{String(selectedBoardChild.displayName || selectedBoardChild.properties.label || 'Component')}</span>
                    </button>

                    <span style={{ color: '#94a3b8', fontSize: '0.9rem', flexShrink: 0 }}>›</span>

                    <span
                      style={{
                        flexShrink: 1,
                        flexGrow: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#095c55',
                      }}
                      title={`Cell (${resolvedSelectedGridCell.x}, ${resolvedSelectedGridCell.y})`}
                    >
                      <span dir="ltr">Cell ({resolvedSelectedGridCell.x}, {resolvedSelectedGridCell.y})</span>
                    </span>
                  </>
                );
              }

              if (selectedBoardChild && resolvedSelectedBoardChildId && activeBoard) {
                return (
                  <>
                    <button
                      type="button"
                      onClick={clearBoardSelection}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#64748b',
                        cursor: 'pointer',
                        flexShrink: 10,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                      }}
                      title={String(activeBoard.displayName || activeBoard.properties.label || 'Board')}
                    >
                      <span dir="ltr">{String(activeBoard.displayName || activeBoard.properties.label || 'Board')}</span>
                    </button>

                    <span style={{ color: '#94a3b8', fontSize: '0.9rem', flexShrink: 0 }}>›</span>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
                      <span
                        style={{
                          flexShrink: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          direction: 'rtl',
                          textAlign: 'left',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#095c55',
                        }}
                        title={String(selectedBoardChild.displayName || selectedBoardChild.properties.label || 'Component')}
                      >
                        <span dir="ltr">{String(selectedBoardChild.displayName || selectedBoardChild.properties.label || 'Component')}</span>
                      </span>

                      {selectedGridCells.length > 0 && (
                        <>
                          <span style={{ fontSize: '0.8rem', color: '#095c55', marginLeft: '0.35rem', flexShrink: 0, pointerEvents: 'none' }}>▼</span>
                          <select
                            value=""
                            onChange={(event) => {
                              const key = event.target.value;
                              if (key) {
                                setSelectedGridCellKey(key);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: 'pointer',
                              width: '100%',
                            }}
                            title="Select Grid Cell"
                          >
                            <option value="" disabled hidden>Select Grid Cell</option>
                            {selectedGridCells.map((cell) => {
                              const key = getGridCoordinateKey(cell);
                              return (
                                <option key={key} value={key}>
                                  Cell ({cell.x}, {cell.y})
                                </option>
                              );
                            })}
                          </select>
                        </>
                      )}
                    </div>
                  </>
                );
              }

              if (activeBoard) {
                return (
                  <>
                    <button
                      type="button"
                      onClick={clearBoardSelection}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#095c55',
                        cursor: 'pointer',
                        flexShrink: 1,
                        flexGrow: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                      }}
                      title={String(activeBoard.displayName || activeBoard.properties.label || 'Board')}
                    >
                      <span dir="ltr">{String(activeBoard.displayName || activeBoard.properties.label || 'Board')}</span>
                    </button>
                    {boardChildIds.length > 0 && (
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
                        <span
                          style={{
                            flexShrink: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            direction: 'rtl',
                            textAlign: 'left',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#095c55',
                          }}
                          title={String(activeBoard.displayName || activeBoard.properties.label || 'Board')}
                        >
                          <span dir="ltr">{String(activeBoard.displayName || activeBoard.properties.label || 'Board')}</span>
                        </span>

                        <span style={{ fontSize: '0.8rem', color: '#095c55', marginLeft: '0.35rem', flexShrink: 0, pointerEvents: 'none' }}>▼</span>
                        <select
                          value=""
                          onChange={(event) => {
                            const id = event.target.value;
                            if (id) {
                              setSelectedBoardChildId(id);
                              setSelectedGridCellKey(null);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                          title="Select Sub Component"
                        >
                          <option value="" disabled hidden>Select Sub Component</option>
                          {boardChildIds.map((id) => {
                            const child = project.instances[id];
                            return (
                              <option key={id} value={id}>
                                {String(child?.displayName || child?.properties.label || 'Unnamed Component')}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </>
                );
              }

              return null;
            })()}
          </div>
          {selectedBoardChild && resolvedSelectedBoardChildId ? (
            <>
              {showGridShapePopup ? (
                <div style={{ display: 'grid', gap: '0.15rem' }}>
                  <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    {selectedBoardChild?.componentType === 'hex-grid' ? 'Hex Tools' : 'Grid Tools'}
                  </div>
                  {resolvedSelectedGridCell ? (
                    <>
                      {gridAllNeighborOptions.map((option) => (
                        <div
                          key={option.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.1rem',
                            borderBottom: '1px solid rgba(15,118,110,0.06)',
                          }}
                        >
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            color: option.available ? '#064e3b' : '#94a3b8',
                          }}>
                            {option.label}
                          </span>
                          <button
                            type="button"
                            disabled={!option.available}
                            onClick={() => {
                              if (!gridPopupComponentId || !option.available) {
                                return;
                              }
                              updateGridCells(gridPopupComponentId, (cells) => [...cells, option.coordinate]);
                              setSelectedGridCellKey(getGridCoordinateKey(option.coordinate));
                            }}
                            style={{
                              display: 'inline-grid',
                              placeItems: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              border: option.available ? '1px solid rgba(15,118,110,0.15)' : '1px solid rgba(148,163,184,0.18)',
                              background: option.available ? 'rgba(240,253,244,0.96)' : 'rgba(248,250,252,0.6)',
                              color: option.available ? '#065f46' : '#cbd5e1',
                              cursor: option.available ? 'pointer' : 'default',
                            }}
                            title={option.available ? `Add cell ${option.label.toLowerCase()}` : `${option.label} already occupied`}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      ))}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.1rem',
                          marginTop: '0.15rem',
                        }}
                      >
                        <span style={{
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          color: selectedGridCells.length > 1 ? '#b91c1c' : '#94a3b8',
                        }}>
                          Delete Cell
                        </span>
                        <button
                          type="button"
                          disabled={selectedGridCells.length <= 1}
                          onClick={() => {
                            const fallbackCell = selectedGridCells.find((cell) => getGridCoordinateKey(cell) !== getGridCoordinateKey(resolvedSelectedGridCell)) ?? null;
                            if (!gridPopupComponentId) {
                              return;
                            }
                            updateGridCells(gridPopupComponentId, (cells) => (
                              cells.filter((cell) => getGridCoordinateKey(cell) !== getGridCoordinateKey(resolvedSelectedGridCell))
                            ));
                            setSelectedGridCellKey(fallbackCell ? getGridCoordinateKey(fallbackCell) : null);
                          }}
                          style={{
                            display: 'inline-grid',
                            placeItems: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: selectedGridCells.length > 1 ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(148,163,184,0.18)',
                            background: selectedGridCells.length > 1 ? 'rgba(254,242,242,0.96)' : 'rgba(248,250,252,0.6)',
                            color: selectedGridCells.length > 1 ? '#b91c1c' : '#cbd5e1',
                            cursor: selectedGridCells.length > 1 ? 'pointer' : 'default',
                          }}
                          title={selectedGridCells.length > 1 ? 'Delete this cell' : 'Cannot delete the last cell'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.1rem',
                      }}
                    >
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#064e3b' }}>
                        Add First Cell
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const origin = { x: 0, y: 0 };
                          if (!gridPopupComponentId) {
                            return;
                          }
                          updateGridCells(gridPopupComponentId, () => [origin]);
                          setSelectedGridCellKey(getGridCoordinateKey(origin));
                        }}
                        style={{
                          display: 'inline-grid',
                          placeItems: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          border: '1px solid rgba(15,118,110,0.15)',
                          background: 'rgba(240,253,244,0.96)',
                          color: '#065f46',
                          cursor: 'pointer',
                        }}
                        title="Add the first cell"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {!resolvedSelectedGridCell ? (
              <>
              {(() => {
                const componentType = selectedBoardChild.componentType as BuiltInComponentType;
                const presetFamily = getPresetFamily(componentType);
                const presets = presetFamily
                  ? boardPresetGroups.find((group) => group.family === presetFamily)?.presets ?? []
                  : [];

                if (presets.length === 0) {
                  return null;
                }

                const activePresetId = presetFamily ? selectedPresetIds[presetFamily] : undefined;
                const selectedPreset = activePresetId
                  ? presets.find((preset) => preset.id === activePresetId)
                  : null;

                return (
                  <label style={labelStyle}>
                    Preset
                    <select
                      value={selectedPreset?.id ?? presets[0]?.id ?? ''}
                      onChange={(event) => {
                        const preset = getBoardComponentPreset(event.target.value);
                        if (!preset) {
                          return;
                        }

                        setSelectedPresetIds((current) => ({
                          ...current,
                          ...(presetFamily ? { [presetFamily]: preset.id } : {}),
                        }));
                        onUpdateComponent(resolvedSelectedBoardChildId, (instance) => applyPresetToInstance(
                          instance,
                          preset,
                          boardChildIds.indexOf(resolvedSelectedBoardChildId),
                        ));
                      }}
                      style={compactInputStyle}
                    >
                      {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })()}

              <label style={labelStyle}>
                Label
                <input
                  value={String(selectedBoardChild.properties.label ?? selectedBoardChild.displayName ?? '')}
                  onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                    ...instance,
                    displayName: event.target.value,
                    properties: {
                      ...instance.properties,
                      label: event.target.value,
                    },
                  }))}
                  style={compactInputStyle}
                />
              </label>

              {(() => {
                const childIndex = boardChildIds.indexOf(resolvedSelectedBoardChildId);
                const frame = getResolvedBoardItemFrame(selectedBoardChild, Math.max(childIndex, 0));

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                      <label style={labelStyle}>
                        X
                        <input
                          type="number"
                          value={Math.round(frame.x)}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            x: Number(event.target.value),
                          }))}
                          style={compactInputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Y
                        <input
                          type="number"
                          value={Math.round(frame.y)}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            y: Number(event.target.value),
                          }))}
                          style={compactInputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Width
                        <input
                          type="number"
                          value={Math.round(frame.width)}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            width: Number(event.target.value),
                          }))}
                          style={compactInputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Height
                        <input
                          type="number"
                          value={Math.round(frame.height)}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            height: Number(event.target.value),
                          }))}
                          style={compactInputStyle}
                        />
                      </label>
                    </div>

                    <label style={labelStyle}>
                      Fill
                      <ProjectColorPicker
                        value={frame.background ?? 'rgba(255,255,255,0.94)'}
                        palette={paletteOptions}
                        onChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          background: value || null,
                        }))}
                        onAssignPaletteColor={onAssignProjectPaletteColor}
                      />
                    </label>

                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      <label style={labelStyle}>
                        Texture
                        <select
                          value={frame.textureId ?? 'none'}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            textureId: event.target.value as BoardSurfaceTextureId,
                          }))}
                          style={compactInputStyle}
                        >
                          {BOARD_SURFACE_TEXTURE_OPTIONS.map((texture) => (
                            <option key={texture.id} value={texture.id}>
                              {texture.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {frame.textureId && frame.textureId !== 'none' ? (() => {
                        const textureOpacity = frame.textureOpacity ?? 0.3;
                        const textureStyle = getBoardSurfaceTextureStyle(frame.textureId as BoardSurfaceTextureId, textureOpacity);

                        return (
                          <div style={{ display: 'grid', gap: '0.9rem' }}>
                            <label style={{ ...labelStyle, display: 'grid', gap: '0.45rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span>Texture Opacity</span>
                                <span style={{ color: '#0f766e', fontWeight: 700 }}>{Math.round(textureOpacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={textureOpacity}
                                onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                                  ...current,
                                  textureOpacity: parseFloat(event.target.value),
                                }))}
                                style={{ width: '100%', accentColor: '#0f766e' }}
                              />
                            </label>
                            <div
                              style={{
                                borderRadius: '14px',
                                border: '1px solid rgba(15,118,110,0.12)',
                                background: 'rgba(255,255,255,0.96)',
                                padding: '0.55rem',
                              }}
                            >
                              <div
                                style={{
                                  position: 'relative',
                                  minHeight: '42px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(15,118,110,0.12)',
                                  background: frame.background ?? 'rgba(255,255,255,0.94)',
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
                            </div>
                          </div>
                        );
                      })() : null}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 92px', gap: '0.6rem' }}>
                      <label style={labelStyle}>
                        Border
                        <ProjectColorPicker
                          value={frame.borderColor ?? 'rgba(15,118,110,0.18)'}
                          palette={paletteOptions}
                          onChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            borderColor: value || null,
                          }))}
                          onAssignPaletteColor={onAssignProjectPaletteColor}
                        />
                      </label>
                      <label style={labelStyle}>
                        Width
                        <input
                          type="number"
                          value={frame.borderWidth}
                          onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                            ...current,
                            borderWidth: Number(event.target.value),
                          }))}
                          style={compactInputStyle}
                        />
                      </label>
                    </div>

                    <label style={labelStyle}>
                      Radius
                      <input
                        type="number"
                        value={frame.borderRadius}
                        onChange={(event) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          borderRadius: Number(event.target.value),
                        }))}
                        style={compactInputStyle}
                      />
                    </label>

                    {isBoardGridComponentType(selectedBoardChild.componentType) ? (() => {
                      const cellBg = typeof selectedBoardChild.properties.cellBackground === 'string' && (selectedBoardChild.properties.cellBackground as string).trim().length > 0
                        ? selectedBoardChild.properties.cellBackground as string
                        : 'rgba(255,255,255,0.92)';
                      const cellTextureId = (typeof selectedBoardChild.properties.cellTextureId === 'string' ? selectedBoardChild.properties.cellTextureId : 'none') as BoardSurfaceTextureId;
                      const cellTextureOpacity = typeof selectedBoardChild.properties.cellTextureOpacity === 'number' ? selectedBoardChild.properties.cellTextureOpacity : 0.3;
                      const cellBorderWidth = typeof selectedBoardChild.properties.cellBorderWidth === 'number'
                        ? selectedBoardChild.properties.cellBorderWidth
                        : (selectedBoardChild.componentType === 'hex-grid' ? 2 : 1);
                      const cellBorderRadius = typeof selectedBoardChild.properties.cellBorderRadius === 'number'
                        ? selectedBoardChild.properties.cellBorderRadius
                        : (selectedBoardChild.componentType === 'hex-grid' ? 0 : 10);

                      return (
                        <>
                          <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                            Cell Appearance
                          </div>

                          <label style={labelStyle}>
                            Cell Fill
                            <ProjectColorPicker
                              value={cellBg}
                              palette={paletteOptions}
                              onChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                ...instance,
                                properties: {
                                  ...instance.properties,
                                  cellBackground: value || null,
                                },
                              }))}
                              onAssignPaletteColor={onAssignProjectPaletteColor}
                            />
                          </label>

                          <div style={{ display: 'grid', gap: '0.55rem' }}>
                            <label style={labelStyle}>
                              Cell Texture
                              <select
                                value={cellTextureId}
                                onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                  ...instance,
                                  properties: {
                                    ...instance.properties,
                                    cellTextureId: event.target.value,
                                  },
                                }))}
                                style={compactInputStyle}
                              >
                                {BOARD_SURFACE_TEXTURE_OPTIONS.map((texture) => (
                                  <option key={texture.id} value={texture.id}>
                                    {texture.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {cellTextureId !== 'none' ? (() => {
                              const textureStyle = getBoardSurfaceTextureStyle(cellTextureId, cellTextureOpacity);

                              return (
                                <div style={{ display: 'grid', gap: '0.9rem' }}>
                                  <label style={{ ...labelStyle, display: 'grid', gap: '0.45rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                      <span>Texture Opacity</span>
                                      <span style={{ color: '#0f766e', fontWeight: 700 }}>{Math.round(cellTextureOpacity * 100)}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.05"
                                      value={cellTextureOpacity}
                                      onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                        ...instance,
                                        properties: {
                                          ...instance.properties,
                                          cellTextureOpacity: parseFloat(event.target.value),
                                        },
                                      }))}
                                      style={{ width: '100%', accentColor: '#0f766e' }}
                                    />
                                  </label>
                                  <div
                                    style={{
                                      borderRadius: '14px',
                                      border: '1px solid rgba(15,118,110,0.12)',
                                      background: 'rgba(255,255,255,0.96)',
                                      padding: '0.55rem',
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: 'relative',
                                        minHeight: '42px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(15,118,110,0.12)',
                                        background: cellBg,
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
                                  </div>
                                </div>
                              );
                            })() : null}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                            <label style={labelStyle}>
                              Cell Border
                              <input
                                type="number"
                                value={cellBorderWidth}
                                onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                  ...instance,
                                  properties: {
                                    ...instance.properties,
                                    cellBorderWidth: Number(event.target.value),
                                  },
                                }))}
                                min={0}
                                style={compactInputStyle}
                              />
                            </label>
                            <label style={labelStyle}>
                              Cell Radius
                              <input
                                type="number"
                                value={cellBorderRadius}
                                onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                  ...instance,
                                  properties: {
                                    ...instance.properties,
                                    cellBorderRadius: Number(event.target.value),
                                  },
                                }))}
                                min={0}
                                style={compactInputStyle}
                              />
                            </label>
                          </div>
                        </>
                      );
                    })() : null}

                    {(() => {
                      const manifest = getBuiltInComponentManifest(selectedBoardChild.componentType as BuiltInComponentType);
                      const hiddenParameterKeys = isBoardGridComponentType(selectedBoardChild.componentType)
                        ? ['label', 'x', 'y', 'rows', 'columns', 'cells', 'cellLabelPrefix', 'maxCapacity', 'cellStyles', 'cellBackground', 'cellTextureId', 'cellTextureOpacity', 'cellBorderWidth', 'cellBorderRadius']
                        : ['label', 'x', 'y'];
                      const parameterEntries = Object.entries(manifest.propertyDefinitions)
                        .filter(([key]) => !hiddenParameterKeys.includes(key));

                      if (parameterEntries.length === 0) {
                        return null;
                      }

                      return (
                        <div style={{ display: 'grid', gap: '0.6rem' }}>
                          <div style={{ color: '#0f766e', fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Parameters
                          </div>
                          {parameterEntries.map(([key, definition]) => {
                            const value = selectedBoardChild.properties[key];

                            if (definition.kind === 'boolean') {
                              return (
                                <label key={key} style={labelStyle}>
                                  {definition.label}
                                  <select
                                    value={String(Boolean(value))}
                                    onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                      ...instance,
                                      properties: {
                                        ...instance.properties,
                                        [key]: parsePropertyValue(definition, event.target.value),
                                      },
                                    }))}
                                    style={compactInputStyle}
                                  >
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                  </select>
                                </label>
                              );
                            }

                            if (definition.kind === 'enum') {
                              return (
                                <label key={key} style={labelStyle}>
                                  {definition.label}
                                  <select
                                    value={String(value ?? '')}
                                    onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                      ...instance,
                                      properties: {
                                        ...instance.properties,
                                        [key]: event.target.value,
                                      },
                                    }))}
                                    style={compactInputStyle}
                                  >
                                    {(definition.options ?? []).map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            }

                            return (
                              <label key={key} style={labelStyle}>
                                {definition.label}
                                <input
                                  type={definition.kind === 'number' ? 'number' : 'text'}
                                  value={String(value ?? '')}
                                  onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                    ...instance,
                                    properties: {
                                      ...instance.properties,
                                      [key]: parsePropertyValue(definition, event.target.value),
                                    },
                                  }))}
                                  style={compactInputStyle}
                                />
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </>
            ) : null}
            </>
          ) : (
            boardAppearance && activeBoardId ? (
              <>
                <label style={labelStyle}>
                  Background
                  <ProjectColorPicker
                    value={boardAppearance.surfaceColor}
                    palette={paletteOptions}
                    onChange={(value) => updateBoardAppearanceProperty('surfaceColor', value)}
                    onAssignPaletteColor={onAssignProjectPaletteColor}
                    popupPlacement="left"
                  />
                </label>

                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  <label style={labelStyle}>
                    Texture
                    <select
                      value={boardAppearance.surfaceTexture}
                      onChange={(event) => updateBoardAppearanceProperty('surfaceTexture', event.target.value)}
                      style={compactInputStyle}
                    >
                      {BOARD_SURFACE_TEXTURE_OPTIONS.map((texture) => (
                        <option key={texture.id} value={texture.id}>
                          {texture.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const selectedTexture = BOARD_SURFACE_TEXTURE_OPTIONS.find((texture) => texture.id === boardAppearance.surfaceTexture)
                      ?? BOARD_SURFACE_TEXTURE_OPTIONS[0];
                    const textureStyle = getBoardSurfaceTextureStyle(selectedTexture.id, boardAppearance.surfaceTextureOpacity);

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gap: '0.9rem',
                        }}
                      >
                        <label style={{ ...labelStyle, display: 'grid', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span>Texture Opacity</span>
                            <span style={{ color: '#0f766e', fontWeight: 700 }}>{Math.round(boardAppearance.surfaceTextureOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={boardAppearance.surfaceTextureOpacity}
                            onChange={(event) => updateBoardAppearanceProperty('surfaceTextureOpacity', parseFloat(event.target.value))}
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
                              display: 'block',
                              minHeight: '52px',
                              borderRadius: '10px',
                              border: '1px solid rgba(15,118,110,0.12)',
                              background: boardAppearance.surfaceColor,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                pointerEvents: 'none',
                                backgroundImage: textureStyle.backgroundImage,
                                backgroundSize: textureStyle.backgroundSize,
                                backgroundPosition: textureStyle.backgroundPosition,
                                backgroundRepeat: textureStyle.backgroundRepeat,
                                filter: textureStyle.filter,
                              }}
                            />
                          </div>
                        <div style={{ display: 'grid', gap: '0.12rem' }}>
                          <span style={{ color: '#064e3b', fontSize: '0.8rem', fontWeight: 700 }}>{selectedTexture.label}</span>
                          <span style={{ color: '#0f766e', fontSize: '0.72rem', lineHeight: 1.35 }}>{selectedTexture.description}</span>
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: '0.6rem' }}>
                  <label style={labelStyle}>
                    Border Color
                    <ProjectColorPicker
                      value={boardAppearance.surfaceBorderColor}
                      palette={paletteOptions}
                      onChange={(value) => updateBoardAppearanceProperty('surfaceBorderColor', value)}
                      onAssignPaletteColor={onAssignProjectPaletteColor}
                      popupPlacement="left"
                    />
                  </label>
                  <label style={labelStyle}>
                    Thickness
                    <select
                      value={String(boardAppearance.surfaceBorderWidth)}
                      onChange={(event) => updateBoardAppearanceProperty('surfaceBorderWidth', Number(event.target.value))}
                      style={compactInputStyle}
                    >
                      {boardBorderWidthOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}px
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={labelStyle}>
                  Border Style
                  <select
                    value={boardAppearance.surfaceBorderStyle}
                    onChange={(event) => updateBoardAppearanceProperty('surfaceBorderStyle', event.target.value)}
                    style={compactInputStyle}
                  >
                    {BOARD_BORDER_STYLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option[0].toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p style={mutedTextStyle}>Select a board item to adjust its placement, fill, and border. Preview uses the same board layout and styling.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
