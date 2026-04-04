import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import {
  BOARD_BORDER_STYLE_OPTIONS,
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
import { KonvaBoardSurface, GameSurfacePopup, BoardGrid } from '@turnbased/engine-ui';
import { renderComponentIcon } from '../componentMeta';
import { InspectorAccordion, InspectorAppearanceControls } from '../components/InspectorControls';
import { FONT_FAMILY_MAP, TextBoxContent, resolveTextBoxProperties } from '../components/TextBoxContent';
import { listProjectPaletteOptions, resolveProjectPaletteColorValue } from '../projectPalette';
import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  clampItemFrame,
  computeCanonicalGeometries,
  computeZoomRect,
  defaultBoardItemFrame,
  getBoardGridCells,
  getGridCellAppearance,
  getResolvedBoardItemFrame,
  getResolvedChildItemFrame,
  isBoardGridComponentType,
  isLeafComponentType,
  isMovableComponentType,
  resizeBoardItemFrame,
  scaleDefaultFrame,
} from '../boardLayout';
import type { ZoomRect } from '../boardLayout';
import { mutedTextStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

import {
  boardBorderWidthOptions,
  compactInputStyle,
  BOARD_PRESET_FAMILY_ORDER,
  BOARD_PRESET_ICON_KEYS,
  getComponentLabel,
  getResizeCursor,
  getResizeEdgesForPointer,
  hasResizeEdge,
  renderImageAreaContent,
} from './visuals/boardEditorUtils';
import type { BoardInteractionState } from './visuals/boardEditorUtils';
import { BoardItemInspector } from './visuals/BoardItemInspector';
import { TopLevelInspector } from './visuals/TopLevelInspector';


function InlineTextBoxEditor({
  project,
  properties,
  onSave,
  onBlur,
}: {
  project: EditorProject;
  properties: Record<string, unknown>;
  onSave: (html: string) => void;
  onBlur: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resolved = resolveTextBoxProperties(properties);
  const resolvedColor = resolveProjectPaletteColorValue(project.settings.colorPalette, resolved.textColor) ?? resolved.textColor;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = resolved.contentHtml;
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => onBlur(editorRef.current?.innerHTML ?? '')}
      onKeyDown={(e) => {
        // Escape to commit and exit
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onSave(editorRef.current?.innerHTML ?? '');
        }
        // Prevent move/delete shortcuts from bubbling to the board
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: resolved.verticalAlign === 'start'
          ? 'flex-start'
          : resolved.verticalAlign === 'end'
            ? 'flex-end'
            : 'center',
        padding: `${resolved.paddingTop}px ${resolved.paddingRight}px ${resolved.paddingBottom}px ${resolved.paddingLeft}px`,
        boxSizing: 'border-box',
        color: resolvedColor,
        fontFamily: FONT_FAMILY_MAP[resolved.fontFamily],
        fontSize: `${resolved.fontSize}px`,
        lineHeight: resolved.lineHeight,
        textAlign: resolved.textAlign,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        outline: 'none',
        cursor: 'text',
      }}
    />
  );
}


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
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Design area tracks the selected component. For boards, this activates the full
  // board editor canvas. For other physical types, the design area shows a proportional
  // bounds preview. No fallback to boardIds[0] — the design area always reflects what
  // the creator has explicitly selected in the Component Editor outline.
  const activeBoardId = selectedComponent?.componentType === 'board'
    ? selectedComponentId
    : null;
  const activeBoard = activeBoardId ? project.instances[activeBoardId] ?? null : null;
  const selectedTopLevelComponentId = selectedComponentId && selectedComponent && (
    !selectedComponent.parentId || isMovableComponentType(selectedComponent.componentType)
  )
    ? selectedComponentId
    : null;
  const selectedTopLevelComponent = selectedTopLevelComponentId
    ? project.instances[selectedTopLevelComponentId] ?? null
    : null;

  // drillPath: instance IDs of non-board components we have drilled into within the board.
  // [] = at the board level; ['spaceA'] = editing inside spaceA; ['spaceA','spaceB'] = nested deeper.
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [selectedBoardChildId, setSelectedBoardChildId] = useState<string | null>(null);
  const [selectedGridCellKey, setSelectedGridCellKey] = useState<string | null>(null);
  const [boardInteraction, setBoardInteraction] = useState<BoardInteractionState>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Partial<Record<BoardComponentPresetFamily, string>>>({});
  const [showEditorGrid, setShowEditorGrid] = useState<boolean>(true);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);

  // The surface we are currently editing. At drill depth 0 this is the board itself;
  // deeper levels are nested non-leaf components.
  const currentSurfaceId = activeBoardId
    ? (drillPath.length > 0 ? drillPath[drillPath.length - 1] : activeBoardId)
    : null;
  const currentSurface = currentSurfaceId ? (project.instances[currentSurfaceId] ?? null) : null;
  const isAtBoardLevel = drillPath.length === 0;

  // Coordinate system for the current editing surface (local space for data ops).
  const currentSurfaceFrame = !isAtBoardLevel && currentSurface?.frame ? currentSurface.frame : null;
  const currentSurfaceWidth = currentSurfaceFrame?.width ?? BOARD_SURFACE_WIDTH;
  const currentSurfaceHeight = currentSurfaceFrame?.height ?? BOARD_SURFACE_HEIGHT;
  // Non-movable children of the current surface (items shown on the canvas).
  const boardChildIds = currentSurface
    ? currentSurface.children.map(String).filter((childId) => {
      const child = project.instances[childId];
      return child && !isMovableComponentType(child.componentType);
    })
    : [];

  // Allow selecting any descendant of the current surface, not just direct children.
  const resolvedSelectedBoardChildId = (() => {
    if (!selectedBoardChildId || !currentSurfaceId) return null;
    if (boardChildIds.includes(selectedBoardChildId)) return selectedBoardChildId;
    // Walk up from the selected item to see if it's a descendant of the current surface.
    let ancestorId: string | null = selectedBoardChildId;
    while (ancestorId) {
      const ancestorModel: any = project.instances[ancestorId as string];
      if (!ancestorModel) return null;
      if (String(ancestorModel.parentId) === currentSurfaceId || ancestorId === currentSurfaceId) {
        return selectedBoardChildId;
      }
      ancestorId = ancestorModel.parentId ? String(ancestorModel.parentId) : null;
    }
    return null;
  })();
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
    if (currentSurface) {
      return getBuiltInComponentManifest(currentSurface.componentType as BuiltInComponentType);
    }
    return null;
  }, [resolvedSelectedGridCell, selectedBoardChild, currentSurface]);

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
  const boardRenderWidth = activeBoard && typeof activeBoard.properties.physicalWidthMm === 'number'
    ? Math.max(1, activeBoard.properties.physicalWidthMm as number)
    : BOARD_SURFACE_WIDTH;
  const boardRenderHeight = activeBoard && typeof activeBoard.properties.physicalHeightMm === 'number'
    ? Math.max(1, activeBoard.properties.physicalHeightMm as number)
    : BOARD_SURFACE_HEIGHT;
  const boardRenderScaleX = boardRenderWidth / BOARD_SURFACE_WIDTH;
  const boardRenderScaleY = boardRenderHeight / BOARD_SURFACE_HEIGHT;

  // Computed global CanonicalGeometry mapping
  const canonicalGeometries = useMemo(() => {
    return activeBoardId ? computeCanonicalGeometries(project.instances, activeBoardId, boardRenderWidth, boardRenderHeight) : {};
  }, [project.instances, activeBoardId, boardRenderWidth, boardRenderHeight]);

  // The zoom rect in board-level coordinates — the region we're "zoomed into".
  const zoomRect: ZoomRect = useMemo(
    () => computeZoomRect(drillPath, canonicalGeometries),
    [drillPath, canonicalGeometries],
  );

  const renderedZoomRect = {
    x: zoomRect.x * boardRenderScaleX,
    y: zoomRect.y * boardRenderScaleY,
    width: zoomRect.width * boardRenderScaleX,
    height: zoomRect.height * boardRenderScaleY,
  };

  function clearBoardSelection() {
    setDrillPath([]);
    setSelectedBoardChildId(null);
    setSelectedGridCellKey(null);
    setEditingTextBoxId(null);
  }

  function navigateToDrillLevel(level: number) {
    setDrillPath((path) => path.slice(0, level));
    setSelectedBoardChildId(null);
    setSelectedGridCellKey(null);
  }

  useEffect(() => {
    if (!selectedTopLevelComponentId) {
      return;
    }

    clearBoardSelection();
  }, [selectedTopLevelComponentId]);

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
            x: Math.max(0, Math.min(interaction.startFrame.x + dx, interaction.surfaceWidth - interaction.startFrame.width)),
            y: Math.max(0, Math.min(interaction.startFrame.y + dy, interaction.surfaceHeight - interaction.startFrame.height)),
          }
          : resizeBoardItemFrame(interaction.startFrame, dx, dy, interaction.resizeEdges ?? {
            left: false,
            right: true,
            top: false,
            bottom: true,
          }, interaction.surfaceWidth, interaction.surfaceHeight);

        return {
          ...instance,
          frame: clampItemFrame(nextFrame, interaction.surfaceWidth, interaction.surfaceHeight),
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
    // For nested items, clamp to the parent's frame dimensions.
    const parentInstance = instance.parentId ? project.instances[String(instance.parentId)] : null;
    const isDirectChild = !parentInstance || String(instance.parentId) === currentSurfaceId;
    const clampW = isDirectChild
      ? currentSurfaceWidth
      : (parentInstance.frame?.width ?? currentSurfaceWidth);
    const clampH = isDirectChild
      ? currentSurfaceHeight
      : (parentInstance.frame?.height ?? currentSurfaceHeight);
    const currentFrame = getResolvedChildItemFrame(instance, Math.max(childIndex, 0), clampW, clampH);
    onUpdateComponent(instanceId, (current) => ({
      ...current,
      frame: clampItemFrame(updater(currentFrame), clampW, clampH),
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
      targetSurfaceWidth?: number;
      targetSurfaceHeight?: number;
    } = {},
  ): ComponentInstanceModel {
    const sw = options.targetSurfaceWidth ?? currentSurfaceWidth;
    const sh = options.targetSurfaceHeight ?? currentSurfaceHeight;
    const baseFrame = getResolvedBoardItemFrame(instance, childIndex);
    const nextManifest = getBuiltInComponentManifest(preset.componentType);
    // Scale the default frame to fit proportionally within smaller-than-board surfaces.
    const rawDefault = defaultBoardItemFrame(preset.componentType, childIndex);
    const scaledDefault = scaleDefaultFrame(rawDefault, sw, sh);
    const presetFrame = clampItemFrame({
      ...scaledDefault,
      ...preset.frame,
      // Re-scale preset.frame dimensions if they were specified at board-scale
      ...(preset.frame.width != null || preset.frame.height != null
        ? scaleDefaultFrame({ ...rawDefault, ...preset.frame } as typeof rawDefault, sw, sh)
        : {}),
      x: options.preservePosition === false
        ? (typeof options.x === 'number' ? options.x : scaledDefault.x)
        : (typeof options.x === 'number' ? options.x : baseFrame.x),
      y: options.preservePosition === false
        ? (typeof options.y === 'number' ? options.y : scaledDefault.y)
        : (typeof options.y === 'number' ? options.y : baseFrame.y),
    }, sw, sh);

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
    // When a board child is selected, add inside it; otherwise add to the current surface.
    const addingToChild = resolvedSelectedBoardChildId !== null
      && resolvedSelectedBoardChildId !== currentSurfaceId;
    const targetParentId = resolvedSelectedBoardChildId || currentSurfaceId;
    if (!targetParentId) {
      return;
    }
    const targetParent = project.instances[targetParentId];
    if (!targetParent) {
      return;
    }

    // Use the target parent's own frame dimensions for clamping so the preset fits within it.
    const targetFrame = addingToChild
      ? getResolvedBoardItemFrame(targetParent, 0)
      : null;
    const targetSurfaceWidth = targetFrame?.width ?? currentSurfaceWidth;
    const targetSurfaceHeight = targetFrame?.height ?? currentSurfaceHeight;

    const childIndex = targetParent.children.length;

    const nextInstanceId = onAddComponent(preset.componentType, targetParentId, {
      focusNewComponent: false,
      initializeComponent: (instance) => applyPresetToInstance(instance, preset, childIndex, {
        x,
        y,
        preservePosition: false,
        targetSurfaceWidth,
        targetSurfaceHeight,
      }),
    });
    if (!nextInstanceId) {
      return;
    }
  }

  // Build surface items recursively so all descendants are visible, with canonical absolute coordinates.
  function buildSurfaceItem(
    childId: string,
    depth: number,
  ) {
    const child = project.instances[childId];
    if (!child) return null;
    const geom = canonicalGeometries[childId];
    if (!geom) return null;

    const isDirect = depth === 0;
    const isSelected = childId === resolvedSelectedBoardChildId;

    return {
      id: childId,
      label: getComponentLabel(project, childId),
      typeLabel: '',
      localWidth: geom.localWidth,
      localHeight: geom.localHeight,
      icon: renderComponentIcon(child.componentType, { size: 16, style: { color: '#064e3b' } }),
      x: geom.renderedX,
      y: geom.renderedY,
      width: geom.renderedWidth,
      height: geom.renderedHeight,
      background: resolvePaletteColor(geom.background),
      textureId: geom.textureId ?? null,
      textureOpacity: geom.textureOpacity ?? 0.3,
      borderColor: resolvePaletteColor(geom.borderColor),
      borderWidth: geom.borderWidth,
      borderRadius: typeof geom.borderRadius === 'number'
        ? geom.borderRadius * Math.min(boardRenderScaleX, boardRenderScaleY)
        : geom.borderRadius,
      clipPath: geom.clipPath ?? null,
      padding: child.componentType === 'text-box' ? 0 : undefined,
      selected: isSelected,
      onClick: () => {
        if (selectedBoardChildId !== childId) {
          setEditingTextBoxId(null);
        }
        setSelectedBoardChildId(childId);
        if (!isBoardGridComponentType(child.componentType)) {
          setSelectedGridCellKey(null);
        }
      },
      onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectedBoardChildId(childId);
          if (!isBoardGridComponentType(child.componentType)) {
            setSelectedGridCellKey(null);
          }
          const resizeEdges = getResizeEdgesForPointer(event);
          const vpRect = viewportRef.current?.getBoundingClientRect();

          const parentId = isDirect ? currentSurfaceId : String(child.parentId);
          const parentGeom = parentId && canonicalGeometries[parentId] ? canonicalGeometries[parentId] : null;
          const parentLocalW = parentGeom ? parentGeom.localWidth : BOARD_SURFACE_WIDTH;
          const parentLocalH = parentGeom ? parentGeom.localHeight : BOARD_SURFACE_HEIGHT;
          const parentAbsW = parentGeom ? parentGeom.absW : BOARD_SURFACE_WIDTH;
          const parentAbsH = parentGeom ? parentGeom.absH : BOARD_SURFACE_HEIGHT;

          const interactionClampW = parentLocalW;
          const interactionClampH = parentLocalH;

          // Screen size of the viewport (the zoomed region)
          const vpW = vpRect?.width ?? 1;
          const vpH = vpRect?.height ?? 1;

          // Scale from absolute board logical units to screen pixels:
          const scaleLogicalToScreenX = zoomRect.width > 0 ? vpW / zoomRect.width : 1;
          const scaleLogicalToScreenY = zoomRect.height > 0 ? vpH / zoomRect.height : 1;

          // The screen pixels occupied by the parent:
          const parentScreenW = parentAbsW * scaleLogicalToScreenX;
          const parentScreenH = parentAbsH * scaleLogicalToScreenY;

          setBoardInteraction({
            kind: hasResizeEdge(resizeEdges) ? 'resize' : 'move',
            instanceId: childId,
            pointerX: event.clientX,
            pointerY: event.clientY,
            boardUnitsPerPixelX: parentScreenW > 0 ? interactionClampW / parentScreenW : 1,
            boardUnitsPerPixelY: parentScreenH > 0 ? interactionClampH / parentScreenH : 1,
            surfaceWidth: interactionClampW,
            surfaceHeight: interactionClampH,
            startFrame: {
              ...child.frame,
              x: geom.localX,
              y: geom.localY,
              width: geom.localWidth,
              height: geom.localHeight,
              background: geom.background ?? 'transparent',
              borderColor: geom.borderColor ?? 'transparent',
              borderWidth: geom.borderWidth ?? 0,
              borderRadius: geom.borderRadius ?? 0,
            } as ComponentFrame,
            resizeEdges,
          });
        },
      onMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => {
          event.currentTarget.style.cursor = getResizeCursor(getResizeEdgesForPointer(event));
        },
      // Double-clicking a non-leaf, non-grid child drills into it.
      // Double-clicking a text-box enters inline editing mode.
      onDoubleClick: child.componentType === 'text-box'
        ? () => { setEditingTextBoxId(childId); }
        : !isLeafComponentType(child.componentType) && !isBoardGridComponentType(child.componentType)
        ? () => {
          // Build the full drill path from board root to this component's parent.
          const newDrillPath: string[] = [];
          let ancestorId = String(child.parentId);
          while (ancestorId && ancestorId !== activeBoardId) {
            newDrillPath.unshift(ancestorId);
            const ancestor = project.instances[ancestorId];
            ancestorId = ancestor?.parentId ? String(ancestor.parentId) : '';
          }
          newDrillPath.push(childId);
          setDrillPath(newDrillPath);
          setSelectedBoardChildId(null);
          setSelectedGridCellKey(null);
        }
        : undefined,
      showHeader: false,
      content: child.componentType === 'text-box'
        ? (editingTextBoxId === childId
          ? (
            <InlineTextBoxEditor
              project={project}
              properties={child.properties}
              onSave={(html) => {
                onUpdateComponent(childId, (current) => ({
                  ...current,
                  properties: { ...current.properties, contentHtml: html },
                }));
                setEditingTextBoxId(null);
              }}
              onBlur={(html) => {
                onUpdateComponent(childId, (current) => ({
                  ...current,
                  properties: { ...current.properties, contentHtml: html },
                }));
                setEditingTextBoxId(null);
              }}
            />
          )
          : (
            <TextBoxContent
              project={project}
              properties={child.properties}
              emptyPlaceholder="Double-click to edit"
            />
          )
        )
        : child.componentType === 'image-area'
        ? renderImageAreaContent(child.properties)
        : child.componentType === 'card'
        ? (
          <div style={{ display: 'grid', gap: '0.45rem', color: '#064e3b' }}>
            <strong style={{ fontSize: '0.92rem' }}>{String(child.properties.title ?? child.properties.label ?? 'Card')}</strong>
            <span style={{ fontSize: '0.8rem', color: '#0f766e', lineHeight: 1.5 }}>
              {String(child.properties.subtitle ?? '')}
            </span>
          </div>
        )
        : isBoardGridComponentType(child.componentType)
        ? (() => {
          const cellIds = child.children.map(String).filter((cellId) => project.instances[cellId]?.componentType === 'space');

          return (
            <BoardGrid
              kind={child.componentType as 'hex-grid' | 'square-grid' | 'checkerboard-grid'}
              editable={isDirect}
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
                  onMouseDown: isDirect ? ((event: { stopPropagation: () => void }) => {
                    event.stopPropagation();
                  }) : undefined,
                  onClick: isDirect ? (() => {
                    setSelectedBoardChildId(childId);
                    setSelectedGridCellKey((current) => (current === cellKey ? null : cellKey));
                  }) : undefined,
                };
              })}
            />
          );
        })()
        : null,
    };
  }

  function collectSurfaceItems(
    childIds: string[],
    depth: number,
  ): any[] {
    const items: any[] = [];
    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i];
      const item = buildSurfaceItem(childId, depth);
      if (!item) continue;
      items.push(item);

      // Recurse into non-leaf, non-grid children to render their descendants too.
      const child = project.instances[childId];
      if (child && !isLeafComponentType(child.componentType) && !isBoardGridComponentType(child.componentType)) {
        const grandchildIds = child.children.map(String).filter((gcId) => {
          const gc = project.instances[gcId];
          return gc && !isMovableComponentType(gc.componentType);
        });
        if (grandchildIds.length > 0) {
          items.push(...collectSurfaceItems(grandchildIds, depth + 1));
        }
      }
    }
    return items;
  }

  const renderedBoardSurfaceItems = collectSurfaceItems(boardChildIds, 0);

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

  // Renders the piece shape as an SVG so all shapes (including triangle, hexagon, meeple)
  // get consistent border handling. Size is in px; the viewBox is always 100×100.
  function renderPieceShape(
    shape: string,
    bgColor: string,
    strokeColor: string,
    strokeWidth: number,
    sizePx: number,
    innerContent?: React.ReactNode,
  ) {
    // Normalize stroke width to the 0-100 viewBox scale.
    const sw = Math.max(0, strokeWidth) * (100 / sizePx);
    const half = sw / 2;

    let pathEl: React.ReactNode;
    switch (shape) {
      case 'square':
        pathEl = (
          <rect
            x={half} y={half}
            width={100 - sw} height={100 - sw}
            rx={6} ry={6}
            fill={bgColor} stroke={strokeColor} strokeWidth={sw}
          />
        );
        break;
      case 'triangle':
        pathEl = (
          <polygon
            points={`50,${half + 2} ${100 - half},${100 - half} ${half},${100 - half}`}
            fill={bgColor} stroke={strokeColor} strokeWidth={sw}
          />
        );
        break;
      case 'hexagon': {
        const r = 50 - half - 1;
        const cx = 50;
        const cy = 50;
        const pts = [0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (Math.PI / 180) * (60 * i - 30);
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(' ');
        pathEl = (
          <polygon
            points={pts}
            fill={bgColor} stroke={strokeColor} strokeWidth={sw}
          />
        );
        break;
      }
      case 'meeple':
        // Stylized meeple silhouette within a 0–100 viewBox.
        pathEl = (
          <path
            d="M50 4 C59 4 65 13 61 22 L73 27 C82 29 82 46 73 49 L64 49 L67 96 L33 96 L36 49 L27 49 C18 46 18 29 27 27 L39 22 C35 13 41 4 50 4 Z"
            fill={bgColor} stroke={strokeColor} strokeWidth={sw}
          />
        );
        break;
      default: // circle
        pathEl = (
          <circle
            cx={50} cy={50} r={50 - half - 1}
            fill={bgColor} stroke={strokeColor} strokeWidth={sw}
          />
        );
    }

    return (
      <div style={{ position: 'relative', width: sizePx, height: sizePx, flexShrink: 0 }}>
        <svg
          width={sizePx}
          height={sizePx}
          viewBox="0 0 100 100"
          style={{ display: 'block' }}
        >
          {pathEl}
        </svg>
        {innerContent ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}>
            {innerContent}
          </div>
        ) : null}
      </div>
    );
  }

  // Compute proportional bounds for the design area when a non-board component is selected.
  // The outer container stays the same visual footprint; the component asset fills the
  // correct h/w ratio inside that region so creators see accurate proportions.
  function getComponentDesignBounds(componentType: string): { width: number; height: number; borderRadius: string } {
    switch (componentType) {
      case 'card':
        // Standard poker card 2.5 : 3.5 in. Scale to fit comfortably in the design area.
        return { width: 286, height: 400, borderRadius: '18px' };
      case 'piece':
        // Pieces use the SVG renderer; these bounds frame the outer container only.
        return { width: 300, height: 300, borderRadius: '999px' };
      case 'token':
        return { width: 220, height: 220, borderRadius: '999px' };
      default:
        return { width: 380, height: 280, borderRadius: '18px' };
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 280px)', gap: '1rem', alignItems: 'stretch', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ ...panelStyle, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.85rem', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <p style={{ ...sectionTitleStyle, marginBottom: 0, flex: 1 }}>Selected Design Area</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.38rem', cursor: 'pointer', fontSize: '0.76rem', color: '#064e3b', fontWeight: 600, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={showEditorGrid}
                  onChange={(event) => setShowEditorGrid(event.target.checked)}
                  style={{ accentColor: '#0f766e' }}
                />
                Grid
              </label>
            </div>
            {(activeBoard || (selectedTopLevelComponent && selectedTopLevelComponentId)) ? (() => {
              // Build the full nested path: root → board child → grid cell.
              type PathSegment = {
                id: string;
                icon: React.ReactNode;
                label: string;
                typeLabel: string;
                onClick: (() => void) | null;
              };
              const segments: PathSegment[] = [];

              if (activeBoard && activeBoardId) {
                const hasDeeper = drillPath.length > 0 || selectedBoardChild || resolvedSelectedGridCell;
                segments.push({
                  id: 'root',
                  icon: renderComponentIcon('board', { size: 13, style: { color: 'currentColor' } }),
                  label: getComponentLabel(project, activeBoardId),
                  typeLabel: 'Board',
                  onClick: hasDeeper ? clearBoardSelection : null,
                });
                // Drill path levels
                drillPath.forEach((drillId, di) => {
                  const drillInst = project.instances[drillId];
                  if (!drillInst) return;
                  const drillM = getBuiltInComponentManifest(drillInst.componentType as BuiltInComponentType);
                  const isLastDrill = di === drillPath.length - 1;
                  segments.push({
                    id: `drill-${di}`,
                    icon: renderComponentIcon(drillInst.componentType, { size: 13, style: { color: 'currentColor' } }),
                    label: getComponentLabel(project, drillId),
                    typeLabel: drillM.displayName,
                    onClick: (!isLastDrill || selectedBoardChild || resolvedSelectedGridCell)
                      ? () => navigateToDrillLevel(di + 1)
                      : null,
                  });
                });
                if (selectedBoardChild && resolvedSelectedBoardChildId) {
                  const cm = getBuiltInComponentManifest(selectedBoardChild.componentType as BuiltInComponentType);
                  segments.push({
                    id: 'child',
                    icon: renderComponentIcon(selectedBoardChild.componentType, { size: 13, style: { color: 'currentColor' } }),
                    label: getComponentLabel(project, resolvedSelectedBoardChildId),
                    typeLabel: cm.displayName,
                    onClick: resolvedSelectedGridCell ? () => setSelectedGridCellKey(null) : null,
                  });
                  if (resolvedSelectedGridCell) {
                    segments.push({
                      id: 'cell',
                      icon: renderComponentIcon('space', { size: 13, style: { color: 'currentColor' } }),
                      label: `Cell (${resolvedSelectedGridCell.x}, ${resolvedSelectedGridCell.y})`,
                      typeLabel: 'Space',
                      onClick: null,
                    });
                  }
                }
              } else if (selectedTopLevelComponent && selectedTopLevelComponentId) {
                const m = getBuiltInComponentManifest(selectedTopLevelComponent.componentType as BuiltInComponentType);
                segments.push({
                  id: 'root',
                  icon: renderComponentIcon(selectedTopLevelComponent.componentType, { size: 13, style: { color: 'currentColor' } }),
                  label: getComponentLabel(project, selectedTopLevelComponentId),
                  typeLabel: m.displayName,
                  onClick: null,
                });
              }

              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(248,250,252,0.88)',
                  padding: '0.3rem 0.55rem',
                  minHeight: '48px',
                  gap: 0,
                  overflow: 'hidden',
                }}>
                  {segments.map((seg, i) => {
                    const isLast = i === segments.length - 1;
                    return (
                      <div key={seg.id} style={{ display: 'contents' }}>
                        {i > 0 && (
                          <span style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0 0.18rem', flexShrink: 0, userSelect: 'none' }}>›</span>
                        )}
                        <div
                          role={seg.onClick ? 'button' : undefined}
                          tabIndex={seg.onClick ? 0 : undefined}
                          onClick={seg.onClick ?? undefined}
                          onKeyDown={seg.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') seg.onClick!(); } : undefined}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.06rem',
                            padding: '0.2rem 0.38rem',
                            borderRadius: '8px',
                            cursor: seg.onClick ? 'pointer' : 'default',
                            background: isLast ? 'rgba(16,185,129,0.1)' : 'transparent',
                            color: isLast ? '#065f46' : '#0f766e',
                            flexShrink: isLast ? 0 : 10,
                            minWidth: 0,
                            maxWidth: isLast ? 'unset' : '160px',
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: isLast ? 800 : 600, fontSize: '0.84rem', minWidth: 0 }}>
                            {seg.icon}
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.label}</span>
                          </div>
                          <div style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: isLast ? 'rgba(6,95,70,0.6)' : 'rgba(15,118,110,0.5)', fontWeight: 700 }}>
                            {seg.typeLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!activeBoard && selectedTopLevelComponent ? (
                    <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#94a3b8', paddingLeft: '0.5rem', flexShrink: 0 }}>
                      proportional bounds
                    </span>
                  ) : null}
                </div>
              );
            })() : null}
          </div>
          {/* Fixed-size oak tabletop working surface */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #8b5a2b 0%, #7a4a24 34%, #9c6a36 100%)',
            borderRadius: '8px',
            height: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(67, 38, 17, 0.22), inset 0 18px 28px rgba(255,255,255,0.05), inset 0 -18px 32px rgba(40, 20, 9, 0.2)',
          }}>
            {activeBoard ? (() => {
              const surfaceClipPath = !isAtBoardLevel && currentSurfaceFrame?.clipPath
                ? currentSurfaceFrame.clipPath
                : undefined;

              // CSS-transform zoom: always render using the full board
              // coordinate system. When drilled in, we scale and translate
              // so the drilled region fills the viewport — a true zoom.
              const zoomScale = boardRenderWidth / renderedZoomRect.width;
              const boardAspect = boardRenderWidth / boardRenderHeight;

              // Viewport clip container: matches the drilled region's aspect ratio.
              // At board level, zoomRect = full board so this is just the board ratio.
              const vpAspect = renderedZoomRect.width / renderedZoomRect.height;

              // The chalkboard is 600px tall with 24px padding each side → 552px available.
              // Fit the viewport into this budget, respecting the zoomed region's aspect ratio.
              // We also cap the width at what the board-level view would occupy so we don't
              // exceed the chalkboard's horizontal bounds.
              const chalkH = 600 - 72;
              const maxW = chalkH * boardAspect; // leave a small comfort margin inside the tabletop
              const fitByHeight = chalkH * vpAspect;
              const fitByWidth = maxW;
              const vpW = Math.min(fitByHeight, fitByWidth);
              const vpH = vpW / vpAspect;

              return (
                <div
                  ref={viewportRef}
                  style={{
                    position: 'relative',
                    width: `${vpW}px`,
                    height: `${vpH}px`,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    clipPath: surfaceClipPath,
                    borderRadius: surfaceClipPath ? 0 : undefined,
                  }}
                >
                  {/* Inner wrapper: full board surface, zoomed via CSS transform */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    aspectRatio: `${boardRenderWidth} / ${boardRenderHeight}`,
                    transformOrigin: '0 0',
                    transform: `scale(${zoomScale}) translate(${-(renderedZoomRect.x / boardRenderWidth) * 100}%, ${-(renderedZoomRect.y / boardRenderHeight) * 100}%)`,
                  }}>
                    <KonvaBoardSurface
                      items={renderedBoardSurfaceItems}
                      width={boardRenderWidth}
                      height={boardRenderHeight}
                      minHeight={0}
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
                      emptyState={(
                        <div style={{ maxWidth: '320px', display: 'grid', gap: '0.55rem', color: '#0f766e' }}>
                          <strong style={{ color: '#064e3b' }}>Add subcomponents from the inspector panel</strong>
                          <span>Everything placed on this surface uses the same framing and styling rules as preview.</span>
                        </div>
                      )}
                    />
                  </div>
                </div>
              );
            })()
             : selectedTopLevelComponent && selectedTopLevelComponentId ? (() => {
              const ct = selectedTopLevelComponent.componentType;
              const bounds = getComponentDesignBounds(ct);

              if (ct === 'piece') {
                const shape = String(selectedTopLevelComponent.properties.shape ?? 'circle');
                const bgColor = String(selectedTopLevelComponent.properties.backgroundColor ?? '#10b981');
                const strokeColor = String(selectedTopLevelComponent.properties.borderColor ?? 'rgba(6,78,59,0.7)');
                const strokeWidth = typeof selectedTopLevelComponent.properties.borderWidth === 'number'
                  ? selectedTopLevelComponent.properties.borderWidth : 2;
                const firstImageChild = selectedTopLevelComponent.children.map(String)
                  .map((id) => project.instances[id])
                  .find((c) => c?.componentType === 'image-area');
                const firstTextChild = selectedTopLevelComponent.children.map(String)
                  .map((id) => project.instances[id])
                  .find((c) => c?.componentType === 'text-box');

                const pieceSize = Math.min(bounds.width, bounds.height, 280);
                const innerContent = firstImageChild ? (
                  <img
                    src={String(firstImageChild.properties.imageUrl ?? '')}
                    alt=""
                    style={{ width: '70%', height: '70%', objectFit: 'contain', opacity: typeof firstImageChild.properties.opacity === 'number' ? firstImageChild.properties.opacity : 1 }}
                  />
                ) : firstTextChild ? (
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: String(firstTextChild.properties.textColor ?? '#ffffff'), textAlign: 'center', padding: '0.5rem', maxWidth: '80%', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {String(firstTextChild.properties.label ?? '')}
                  </span>
                ) : null;

                return renderPieceShape(shape, bgColor, strokeColor, strokeWidth, pieceSize, innerContent);
              }

              return (
                <div style={{
                  width: bounds.width,
                  height: bounds.height,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: bounds.borderRadius,
                  background: 'rgba(255,255,255,0.97)',
                  border: '2.5px dashed rgba(15,118,110,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                  padding: '1.5rem',
                }}>
                  {renderComponentIcon(ct, { size: 28, style: { color: '#0f766e' } })}
                  <div style={{ fontWeight: 800, color: '#064e3b', fontSize: '1rem', textAlign: 'center' }}>
                    {getComponentLabel(project, selectedTopLevelComponentId)}
                  </div>
                </div>
              );
            })() : (
              <div style={{ display: 'grid', gap: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontWeight: 800, fontSize: '1.08rem' }}>Select a component or add a board</div>
                <p style={{ fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '320px', margin: '0 auto' }}>Select a component from the outline to edit it here.</p>
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
            )}
          </div>
        </div>

        <div style={{ ...panelStyle, borderRadius: '0 0 20px 20px', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0, overflow: 'hidden' }}>
          <div style={{
            margin: '-1rem -1rem 0 -1rem',
            padding: '0.55rem 0.85rem',
            background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Selected</span>
            {(() => {
              const comp = selectedBoardChild ?? selectedTopLevelComponent;
              const compId = resolvedSelectedBoardChildId ?? selectedTopLevelComponentId;
              if (!comp || !compId) return null;
              return (
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getComponentLabel(project, compId)}
                </span>
              );
            })()}
            {resolvedSelectedBoardChildId ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedBoardChildId(null);
                  onRemoveComponent(resolvedSelectedBoardChildId);
                }}
                aria-label="Delete component"
                title="Delete component"
                style={{
                  flex: '0 0 auto',
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  marginLeft: resolvedSelectedBoardChildId === (resolvedSelectedBoardChildId ?? selectedTopLevelComponentId) ? '0' : 'auto',
                }}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.2rem', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>

          {selectedBoardChild && resolvedSelectedBoardChildId ? (() => {
            const selectedParent = selectedBoardChild.parentId ? project.instances[String(selectedBoardChild.parentId)] : null;
            const selectedIsDirectChild = !selectedParent || String(selectedBoardChild.parentId) === currentSurfaceId;
            const selectedParentW = selectedIsDirectChild ? currentSurfaceWidth : (selectedParent?.frame?.width ?? currentSurfaceWidth);
            const selectedParentH = selectedIsDirectChild ? currentSurfaceHeight : (selectedParent?.frame?.height ?? currentSurfaceHeight);
            return (
              <BoardItemInspector
                project={project}
                selectedBoardChild={selectedBoardChild}
                resolvedSelectedBoardChildId={resolvedSelectedBoardChildId}
                currentSurfaceChildIds={boardChildIds}
                boardPresetGroups={boardPresetGroups}
                selectedPresetIds={selectedPresetIds}
                resolvedSelectedGridCell={resolvedSelectedGridCell}
                selectedGridCells={selectedGridCells}
                showGridShapePopup={showGridShapePopup}
                gridPopupComponentId={gridPopupComponentId}
                gridAllNeighborOptions={gridAllNeighborOptions}
                paletteOptions={paletteOptions}
                onSetSelectedPresetIds={setSelectedPresetIds}
                onSetSelectedGridCellKey={setSelectedGridCellKey}
                onSetSelectedBoardChildId={setSelectedBoardChildId}
                onRemoveComponent={onRemoveComponent}
                onUpdateComponent={onUpdateComponent}
                onAssignProjectPaletteColor={onAssignProjectPaletteColor}
                applyPresetToInstance={(instance, preset, childIndex) => applyPresetToInstance(instance, preset, childIndex)}
                updateBoardChildFrame={updateBoardChildFrame}
                updateGridCells={updateGridCells}
                parentSurfaceWidth={selectedParentW}
                parentSurfaceHeight={selectedParentH}
              />
            );
          })() : selectedTopLevelComponent && selectedTopLevelComponentId ? (
            <TopLevelInspector
              project={project}
              selectedTopLevelComponent={selectedTopLevelComponent}
              selectedTopLevelComponentId={selectedTopLevelComponentId}
              boardAppearance={boardAppearance}
              activeBoardId={activeBoardId}
              paletteOptions={paletteOptions}
              onUpdateComponent={onUpdateComponent}
              onAssignProjectPaletteColor={onAssignProjectPaletteColor}
              updateBoardAppearanceProperty={updateBoardAppearanceProperty}
            />
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
                        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.86rem', color: '#064e3b', fontWeight: 600 }}>
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
                        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.86rem', color: '#064e3b', fontWeight: 600 }}>
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
              <p style={mutedTextStyle}>Select a top-level component or board item to edit its properties.</p>
            )
          )}

          {boardPresetGroups.length > 0 ? (
            <InspectorAccordion title="Add Subcomponent" defaultOpen>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {boardPresetGroups.map((group) => {
                  const iconKey = BOARD_PRESET_ICON_KEYS[group.family];
                  if (group.presets.length === 1) {
                    const preset = group.presets[0];
                    return (
                      <button
                        key={group.family}
                        type="button"
                        title={preset.description}
                        onClick={() => addBoardItem(preset)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: 'rgba(248,250,252,0.85)',
                          border: '1px solid rgba(15,118,110,0.14)',
                          borderRadius: '8px',
                          padding: '0.4rem 0.55rem',
                          color: '#0f766e',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        {renderComponentIcon(iconKey, { size: 14, style: { color: 'currentColor', flexShrink: 0 } })}
                        {group.familyLabel}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={group.family}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(248,250,252,0.85)',
                        border: '1px solid rgba(15,118,110,0.14)',
                        borderRadius: '8px',
                        padding: '0.4rem 0.55rem',
                        color: '#0f766e',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                      }}
                    >
                      {renderComponentIcon(iconKey, { size: 14, style: { color: 'currentColor', flexShrink: 0 } })}
                      <select
                        value=""
                        onChange={(event) => {
                          const preset = group.presets.find((p) => p.id === event.target.value);
                          if (preset) {
                            addBoardItem(preset);
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: 'none',
                          border: 'none',
                          outline: 'none',
                          color: '#0f766e',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          padding: 0,
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230f766e' opacity='0.5'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0 center',
                          paddingRight: '14px',
                        }}
                      >
                        <option value="" disabled>{group.familyLabel}</option>
                        {group.presets.map((preset) => (
                          <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </InspectorAccordion>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
