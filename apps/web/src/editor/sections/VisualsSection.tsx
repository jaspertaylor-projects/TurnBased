import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  BOARD_BORDER_STYLE_OPTIONS,
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
  BuiltInComponentType,
  ComponentFrame,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';
import { BoardGrid, BoardSurface } from '@turnbased/engine-ui';

import { NumericInput } from '../../components/NumericInput';
import { renderComponentIcon } from '../componentMeta';
import { InspectorAccordion, InspectorAppearanceControls } from '../components/InspectorControls';
import { TextBoxInspector } from '../components/TextBoxInspector';
import { TextBoxContent } from '../components/TextBoxContent';
import { listProjectPaletteOptions, resolveProjectPaletteColorValue } from '../projectPalette';
import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  clampBoardItemFrame,
  defaultBoardItemFrame,
  getBoardGridCells,
  getGridCellAppearance,
  getResolvedBoardItemFrame,
  isBoardGridComponentType,
  isMovableComponentType,
  resizeBoardItemFrame,
} from '../boardLayout';
import { parsePropertyValue } from '../helpers';
import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle, textareaStyle } from '../styles';
import type { EditorProject } from '../types';

function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Unknown Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

function renderImageAreaContent(properties: Record<string, unknown>) {
  const imageUrl = typeof properties.imageUrl === 'string' ? properties.imageUrl.trim() : '';
  const opacity = typeof properties.opacity === 'number' ? properties.opacity : 1;
  const objectFit = properties.objectFit === 'cover' || properties.objectFit === 'fill' ? properties.objectFit : 'contain';

  if (!imageUrl) {
    return <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Set an image URL in the properties panel.</div>;
  }

  return (
    <img
      src={imageUrl}
      alt=""
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
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

const BOARD_PRESET_FAMILY_ORDER: BoardComponentPresetFamily[] = ['space', 'track', 'grid', 'card', 'network', 'text', 'image'];
const BOARD_PRESET_ICON_KEYS: Record<BoardComponentPresetFamily, string> = {
  space: 'space',
  track: 'track',
  grid: 'grid',
  card: 'card',
  network: 'network',
  text: 'text-box',
  image: 'image-area',
};

export function VisualsSection({
  project,
  selectedComponentId,
  selectedComponent,
  onSelectComponent: _onSelectComponent,
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

  const activeTargetManifest = useMemo(() => {
    if (resolvedSelectedGridCell) {
      return getBuiltInComponentManifest('space');
    }
    if (selectedBoardChild) {
      return getBuiltInComponentManifest(selectedBoardChild.componentType as BuiltInComponentType);
    }
    if (activeBoard) {
      return getBuiltInComponentManifest(activeBoard.componentType as BuiltInComponentType);
    }
    return null;
  }, [resolvedSelectedGridCell, selectedBoardChild, activeBoard]);

  const boardPresetGroups = useMemo(() => {
    if (!activeTargetManifest) {
      return [] as Array<{ family: BoardComponentPresetFamily; familyLabel: string; presets: BoardComponentPreset[] }>;
    }

    const grouped = listBoardComponentPresets().reduce<Map<BoardComponentPresetFamily, BoardComponentPreset[]>>((groups, preset) => {
      const manifest = getBuiltInComponentManifest(preset.componentType);
      if (!validateComponentPlacement(manifest, activeTargetManifest).valid) {
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
  }, [activeTargetManifest]);

  const paletteOptions = useMemo(() => listProjectPaletteOptions(project), [project]);
  const resolvePaletteColor = (value: string | null | undefined) => (
    resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value ?? null
  );
  const boardAppearance = activeBoard
    ? resolveBoardAppearanceProperties(activeBoard.properties)
    : null;

  function clearBoardSelection() {
    setSelectedBoardChildId(null);
    setSelectedGridCellKey(null);
  }

  function getPresetFamily(componentType: BuiltInComponentType): BoardComponentPresetFamily | null {
    if (componentType === 'text-box') {
      return 'text';
    }

    if (componentType === 'image-area') {
      return 'image';
    }

    if (componentType === 'card') {
      return 'card';
    }

    if (componentType === 'network') {
      return 'network';
    }

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
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement?.tagName === 'INPUT'
        || activeElement?.tagName === 'TEXTAREA'
        || activeElement?.tagName === 'SELECT'
        || activeElement?.isContentEditable
      ) {
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
    const targetParentId = resolvedSelectedBoardChildId || activeBoardId;
    if (!targetParentId) {
      return;
    }
    const targetParent = project.instances[targetParentId];
    if (!targetParent) {
      return;
    }

    const childIndex = targetParent.children.length;
    console.debug('[board-editor] add board item', {
      targetParentId,
      presetId: preset.id,
      componentType: preset.componentType,
      x,
      y,
      childIndex,
    });

    const nextInstanceId = onAddComponent(preset.componentType, targetParentId, {
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
      targetParentId,
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
          <p style={mutedTextStyle}>Add a board first. Spaces, tracks, cards, networks, text areas, image areas, and grids can then be arranged visually here and will match the preview surface.</p>
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
      background: resolvePaletteColor(frame.background),
      textureId: frame.textureId ?? null,
      textureOpacity: frame.textureOpacity ?? 0.3,
      borderColor: resolvePaletteColor(frame.borderColor),
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
      showHeader: child.componentType !== 'text-box',
      content: child.componentType === 'text-box'
        ? (
          <TextBoxContent
            project={project}
            properties={child.properties}
            emptyPlaceholder="Add text, formatting, and :icon_name: tokens in the inspector."
          />
        )
        : child.componentType === 'image-area'
        ? renderImageAreaContent(child.properties)
        : child.componentType === 'card'
        ? (
          <div style={{ display: 'grid', gap: '0.45rem', color: '#064e3b' }}>
            <strong style={{ fontSize: '0.92rem' }}>{String(child.properties.title ?? child.properties.label ?? 'Card')}</strong>
            <span style={{ fontSize: '0.8rem', color: '#0f766e', lineHeight: 1.5 }}>
              {String(child.properties.subtitle ?? 'Add card text in the properties panel.')}
            </span>
          </div>
        )
        : isBoardGridComponentType(child.componentType)
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
                const gridCellAppearance = getGridCellAppearance(child);

                return {
                  id: cellId,
                  row,
                  column,
                  label: String(cell?.properties.label ?? cell?.displayName ?? `Cell ${cellIndex + 1}`),
                  background: resolvePaletteColor(gridCellAppearance.background) ?? gridCellAppearance.background,
                  textureId: gridCellAppearance.textureId,
                  textureOpacity: gridCellAppearance.textureOpacity,
                  borderColor: resolvePaletteColor(gridCellAppearance.borderColor) ?? (child.componentType === 'hex-grid' ? undefined : 'rgba(15,118,110,0.18)'),
                  borderWidth: gridCellAppearance.borderWidth,
                  borderRadius: gridCellAppearance.borderRadius,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
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
                width: '28px',
                height: '28px',
                flexShrink: 0,
                borderRadius: '8px',
                border: '1px solid rgba(15,118,110,0.15)',
                background: 'rgba(255,255,255,0.8)',
                color: '#0f766e',
                cursor: 'pointer',
                marginRight: '0.15rem',
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '1.02rem', fontWeight: 800, color: '#064e3b', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {renderComponentIcon('board', { size: 18, style: { color: '#064e3b' } })}
                    <span>{String(activeBoard.displayName || activeBoard.properties.label || 'Board')}</span>
                  </div>
                  {boardChildIds.length > 0 && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', width: '18px', height: '18px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#095c55', flexShrink: 0, pointerEvents: 'none' }}>▼</span>
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
                          height: '100%',
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

        {boardPresetGroups.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {boardPresetGroups.map((group) => {
            const selectedPreset = getSelectedPresetForFamily(group.family);
            const groupIconKey = BOARD_PRESET_ICON_KEYS[group.family];

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
        ) : null}
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
                background: resolvePaletteColor(boardAppearance.surfaceColor) ?? boardAppearance.surfaceColor,
                textureId: boardAppearance.surfaceTexture,
                textureOpacity: boardAppearance.surfaceTextureOpacity,
                borderColor: resolvePaletteColor(boardAppearance.surfaceBorderColor) ?? boardAppearance.surfaceBorderColor,
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
                  <strong style={{ color: '#064e3b' }}>Drop subcomponents here, then nest text or image leaves where needed</strong>
                  <span>Everything placed on this surface uses the same framing and styling rules as preview.</span>
                </div>
              )}
            />

          </div>
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
          <div style={{ paddingBottom: '0.4rem', borderBottom: '2px solid rgba(15,118,110,0.15)', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#064e3b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Properties</span>
          </div>

          {selectedBoardChild && resolvedSelectedBoardChildId ? (
            <>
              {showGridShapePopup ? (
                <InspectorAccordion title={selectedBoardChild.componentType === 'hex-grid' ? 'Hex Tools' : 'Grid Tools'}>
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
                </InspectorAccordion>
              ) : null}
              {!resolvedSelectedGridCell ? (() => {
                const componentType = selectedBoardChild.componentType as BuiltInComponentType;
                const isTextBox = componentType === 'text-box';
                const presetFamily = getPresetFamily(componentType);
                const presets = presetFamily
                  ? boardPresetGroups.find((group) => group.family === presetFamily)?.presets ?? []
                  : [];
                const activePresetId = presetFamily ? selectedPresetIds[presetFamily] : undefined;
                const selectedPreset = activePresetId
                  ? presets.find((preset) => preset.id === activePresetId)
                  : null;
                const childIndex = boardChildIds.indexOf(resolvedSelectedBoardChildId);
                const frame = getResolvedBoardItemFrame(selectedBoardChild, Math.max(childIndex, 0));
                const manifest = getBuiltInComponentManifest(selectedBoardChild.componentType as BuiltInComponentType);
                const hiddenParameterKeys = isBoardGridComponentType(selectedBoardChild.componentType)
                  ? ['label', 'x', 'y', 'rows', 'columns', 'cells', 'cellLabelPrefix', 'maxCapacity', 'cellStyles', 'cellBackground', 'cellTextureId', 'cellTextureOpacity', 'cellBorderColor', 'cellBorderWidth', 'cellBorderRadius']
                  : isTextBox
                    ? ['label', 'contentHtml', 'fontFamily', 'fontSize', 'lineHeight', 'textColor', 'textAlign', 'verticalAlign', 'padding']
                  : ['label', 'x', 'y'];
                const parameterEntries = Object.entries(manifest.propertyDefinitions)
                  .filter(([key]) => !hiddenParameterKeys.includes(key));
                const cellAppearance = isBoardGridComponentType(selectedBoardChild.componentType)
                  ? getGridCellAppearance(selectedBoardChild)
                  : null;
                const cellBorderWidth = cellAppearance?.borderWidth
                  ?? (selectedBoardChild.componentType === 'hex-grid' ? 2 : 1);
                const cellBorderRadius = cellAppearance?.borderRadius
                  ?? (selectedBoardChild.componentType === 'hex-grid' ? 0 : 10);
                const cellBorderColor = cellAppearance?.borderColor
                  ?? (selectedBoardChild.componentType === 'hex-grid' ? 'rgba(15,118,110,0.52)' : 'rgba(15,118,110,0.18)');

                return (
                  <>
                    <InspectorAccordion title="General">
                      {presets.length > 0 ? (
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
                      ) : null}

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

                      <label style={labelStyle}>
                        Notes
                        <textarea
                          value={selectedBoardChild.notes ?? ''}
                          onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            notes: event.target.value,
                          }))}
                          placeholder="Non-visual design notes for this component. These can later inform AI-generated rules and logic."
                          style={{
                            ...textareaStyle,
                            minHeight: '96px',
                            padding: '0.62rem 0.68rem',
                            fontSize: '0.86rem',
                          }}
                        />
                      </label>
                    </InspectorAccordion>

                    <InspectorAccordion title="Layout">
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                        <label style={labelStyle}>
                          X
                          <NumericInput
                            value={Math.round(frame.x)}
                            onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                              ...current,
                              x: value,
                            }))}
                            style={compactInputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Y
                          <NumericInput
                            value={Math.round(frame.y)}
                            onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                              ...current,
                              y: value,
                            }))}
                            style={compactInputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Width
                          <NumericInput
                            value={Math.round(frame.width)}
                            onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                              ...current,
                              width: value,
                            }))}
                            style={compactInputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Height
                          <NumericInput
                            value={Math.round(frame.height)}
                            onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                              ...current,
                              height: value,
                            }))}
                            style={compactInputStyle}
                          />
                        </label>
                      </div>
                    </InspectorAccordion>

                    {isTextBox ? (
                      <TextBoxInspector
                        project={project}
                        properties={selectedBoardChild.properties}
                        paletteOptions={paletteOptions}
                        onAssignProjectPaletteColor={onAssignProjectPaletteColor}
                        onUpdateProperties={(updater) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                          ...instance,
                          properties: updater(instance.properties),
                        }))}
                      />
                    ) : null}

                    <InspectorAppearanceControls
                      backgroundLabel="Fill"
                      backgroundValue={frame.background ?? 'rgba(255,255,255,0.94)'}
                      onBackgroundChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                        ...current,
                        background: value || null,
                      }))}
                      palette={paletteOptions}
                      onAssignPaletteColor={onAssignProjectPaletteColor}
                      texture={{
                        value: frame.textureId ?? 'none',
                        onChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          textureId: value,
                        })),
                        opacity: frame.textureOpacity ?? 0.3,
                        onOpacityChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          textureOpacity: value,
                        })),
                        previewBackground: frame.background ?? 'rgba(255,255,255,0.94)',
                      }}
                      border={{
                        colorLabel: 'Border Color',
                        colorValue: frame.borderColor ?? 'rgba(15,118,110,0.18)',
                        onColorChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          borderColor: value || null,
                        })),
                        controls: (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                            <label style={labelStyle}>
                              Width
                              <NumericInput
                                value={frame.borderWidth}
                                onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                                  ...current,
                                  borderWidth: value,
                                }))}
                                min={0}
                                step={1}
                                style={compactInputStyle}
                              />
                            </label>
                            <label style={labelStyle}>
                              Radius
                              <NumericInput
                                value={frame.borderRadius}
                                onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                                  ...current,
                                  borderRadius: value,
                                }))}
                                min={0}
                                step={1}
                                style={compactInputStyle}
                              />
                            </label>
                          </div>
                        ),
                      }}
                    />

                    {cellAppearance ? (
                      <InspectorAppearanceControls
                        scopeLabel="Cell"
                        backgroundLabel="Fill"
                        backgroundValue={cellAppearance.background}
                        onBackgroundChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            cellBackground: value || null,
                          },
                        }))}
                        palette={paletteOptions}
                        onAssignPaletteColor={onAssignProjectPaletteColor}
                        texture={{
                          value: cellAppearance.textureId ?? 'none',
                          onChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              cellTextureId: value,
                            },
                          })),
                          opacity: cellAppearance.textureOpacity,
                          onOpacityChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              cellTextureOpacity: value,
                            },
                          })),
                          previewBackground: cellAppearance.background,
                        }}
                        border={{
                          colorValue: cellBorderColor,
                          onColorChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              cellBorderColor: value || null,
                            },
                          })),
                          controls: (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                              <label style={labelStyle}>
                                Width
                                <NumericInput
                                  value={cellBorderWidth}
                                  onValueChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                    ...instance,
                                    properties: {
                                      ...instance.properties,
                                      cellBorderWidth: value,
                                    },
                                  }))}
                                  min={0}
                                  step={1}
                                  style={compactInputStyle}
                                />
                              </label>
                              <label style={labelStyle}>
                                Radius
                                <NumericInput
                                  value={cellBorderRadius}
                                  onValueChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                                    ...instance,
                                    properties: {
                                      ...instance.properties,
                                      cellBorderRadius: value,
                                    },
                                  }))}
                                  min={0}
                                  step={1}
                                  style={compactInputStyle}
                                />
                              </label>
                            </div>
                          ),
                        }}
                      />
                    ) : null}

                    {parameterEntries.length > 0 ? (
                      <InspectorAccordion title="Parameters">
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
                      </InspectorAccordion>
                    ) : null}
                  </>
                );
              })() : null}
            </>
          ) : (
            boardAppearance && activeBoardId ? (
              <InspectorAppearanceControls
                scopeLabel="Surface"
                backgroundValue={boardAppearance.surfaceColor}
                onBackgroundChange={(value) => updateBoardAppearanceProperty('surfaceColor', value)}
                palette={paletteOptions}
                onAssignPaletteColor={onAssignProjectPaletteColor}
                texture={{
                  value: boardAppearance.surfaceTexture,
                  onChange: (value) => updateBoardAppearanceProperty('surfaceTexture', value),
                  opacity: boardAppearance.surfaceTextureOpacity,
                  onOpacityChange: (value) => updateBoardAppearanceProperty('surfaceTextureOpacity', value),
                  previewBackground: boardAppearance.surfaceColor,
                }}
                border={{
                  colorLabel: 'Border Color',
                  colorValue: boardAppearance.surfaceBorderColor,
                  onColorChange: (value) => updateBoardAppearanceProperty('surfaceBorderColor', value),
                  controls: (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: '0.6rem' }}>
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
                    </div>
                  ),
                }}
              />
            ) : (
              <p style={mutedTextStyle}>Select a board item to adjust its placement, fill, and border. Preview uses the same board layout and styling.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
