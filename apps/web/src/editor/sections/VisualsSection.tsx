import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import {
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
import { KonvaBoardSurface, resolveBoardGridLayout } from '@turnbased/engine-ui';
import { renderComponentIcon } from '../componentMeta';
import { listProjectPaletteOptions, resolveProjectPaletteColorValue } from '../projectPalette';
import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  clampItemFrame,
  computeCanonicalGeometries,
  getBoardGridCells,
  getResolvedBoardItemFrame,
  getResolvedChildItemFrame,
  isBoardGridComponentType,
  isMovableComponentType,
} from '../boardLayout';
import type { EditorProject } from '../types';
import { tabletop, woodBar } from '../theme/tabletop';

import {
  BOARD_PRESET_FAMILY_ORDER,
  getComponentLabel,
} from './visuals/boardEditorUtils';
import { VisualInspectorColumn } from './visuals/VisualInspectorColumn';
import {
  getEffectiveScale,
  computeCenteredPan,
  computeActiveSurfaceFrames,
  getSurfaceDimensions,
  getSurfaceViewportRect,
} from './visuals/boardViewportHelpers';
import type { ViewportMetrics } from './visuals/boardViewportHelpers';
import { useBoardInteraction } from './visuals/useBoardInteraction';
import { applyPresetToInstance, getComponentDesignBounds, renderPieceShape } from './visuals/boardPresetHelpers';
import { collectSurfaceItems } from './visuals/BoardCanvasContent';
import type { BuildSurfaceItemParams } from './visuals/BoardCanvasContent';


export function VisualsSection({
  project,
  selectedComponentId,
  selectedComponent,
  onAddComponent,
  onUpdateComponent,
  onRemoveComponent,
  onDuplicateComponent,
  onReturnToGallery,
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
  onDuplicateComponent: (
    instanceId: string,
    options?: {
      targetParentId?: string | null;
      focus?: boolean;
      frameOffset?: { x: number; y: number };
    },
  ) => string | null;
  /** Navigate back to the component gallery (called by the header back button). */
  onReturnToGallery?: () => void;
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics | null>(null);

  // Zoom/pan state — zoom=1 fits the entire board in the viewport.
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Design area tracks the selected component.
  const activeBoardId = selectedComponent?.componentType === 'board' || selectedComponent?.componentType === 'tile'
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

  const [selectedPresetIds, setSelectedPresetIds] = useState<Partial<Record<BoardComponentPresetFamily, string>>>({});
  const [showEditorGrid, setShowEditorGrid] = useState<boolean>(true);
  const [showBleedArea, setShowBleedArea] = useState<boolean>(true);
  const [showUnits, setShowUnits] = useState<boolean>(false);

  // The editing surface is always the board itself.
  const currentSurfaceId = activeBoardId;
  const currentSurface = currentSurfaceId ? (project.instances[currentSurfaceId] ?? null) : null;
  const boardChildIds = currentSurface
    ? currentSurface.children.map(String).filter((childId) => {
      const child = project.instances[childId];
      return child && !isMovableComponentType(child.componentType);
    })
    : [];

  const boardAppearance = activeBoard
    ? resolveBoardAppearanceProperties(activeBoard.properties)
    : null;
  const boardRenderWidth = activeBoard && typeof activeBoard.properties.physicalWidthMm === 'number'
    ? Math.max(1, activeBoard.properties.physicalWidthMm as number)
    : BOARD_SURFACE_WIDTH;
  const boardRenderHeight = activeBoard && typeof activeBoard.properties.physicalHeightMm === 'number'
    ? Math.max(1, activeBoard.properties.physicalHeightMm as number)
    : BOARD_SURFACE_HEIGHT;

  // Computed global CanonicalGeometry mapping.
  const canonicalGeometries = useMemo(() => {
    return activeBoardId ? computeCanonicalGeometries(project.instances, activeBoardId, boardRenderWidth, boardRenderHeight) : {};
  }, [project.instances, activeBoardId, boardRenderWidth, boardRenderHeight]);

  // All items in board mm space — maps each descendant to board-level rendered coordinates.
  const activeSurfaceFrames = useMemo(
    () => computeActiveSurfaceFrames(currentSurface, canonicalGeometries, project.instances),
    [currentSurface, canonicalGeometries, project.instances],
  );

  // Effective scale for coordinate transforms.
  const eff = useMemo(
    () => getEffectiveScale(viewportMetrics, boardRenderWidth, boardRenderHeight, zoom, panX, panY),
    [viewportMetrics, boardRenderWidth, boardRenderHeight, zoom, panX, panY],
  );

  // Board interaction hook — handles drag/move/resize, keyboard shortcuts, selection state.
  const interaction = useBoardInteraction({
    activeBoardId,
    currentSurfaceId,
    viewportMetrics,
    boardRenderWidth,
    boardRenderHeight,
    canonicalGeometries,
    activeSurfaceFrames,
    eff,
    instances: project.instances,
    boardChildIds,
    onUpdateComponent,
    onRemoveComponent,
    onDuplicateComponent,
  });

  const {
    boardInteraction,
    alignmentGuides,
    viewportCursor,
    snapAlignment,
    setSnapAlignment,
    selectedBoardChildId,
    setSelectedBoardChildId,
    resolvedSelectedBoardChildId,
    selectedGridCellKey,
    setSelectedGridCellKey,
    editingTextBoxId,
    setEditingTextBoxId,
    clearBoardSelection,
    handleBoardItemPointerDown,
    handleBoardItemPointerMove,
  } = interaction;

  useEffect(() => {
    if (!activeBoardId || boardInteraction) {
      return;
    }

    const gridIds = Object.values(project.instances)
      .filter((instance) => isBoardGridComponentType(instance.componentType))
      .map((instance) => String(instance.instanceId))
      .filter((instanceId) => {
        let walkId: string | null = instanceId;
        while (walkId) {
          if (walkId === activeBoardId) {
            return true;
          }
          const parentInstanceId: string | null = project.instances[walkId]?.parentId
            ? String(project.instances[walkId]?.parentId)
            : null;
          walkId = parentInstanceId;
        }
        return false;
      });

    for (const gridId of gridIds) {
      const instance = project.instances[gridId];
      if (!instance || !instance.frame) {
        continue;
      }

      const cells = getBoardGridCells(instance);
      const metrics = resolveBoardGridLayout(
        instance.componentType as 'hex-grid' | 'square-grid' | 'checkerboard-grid',
        cells.map((cell) => ({ row: cell.y, column: cell.x })),
      );
      const parentId: string | null = instance.parentId ? String(instance.parentId) : null;
      const parentSurfaceDimensions = getSurfaceDimensions(parentId, activeBoardId, canonicalGeometries, project.instances);
      const clampW = parentSurfaceDimensions.width;
      const clampH = parentSurfaceDimensions.height;
      const parentRenderedWidth = !parentId || parentId === activeBoardId
        ? boardRenderWidth
        : canonicalGeometries[parentId]?.renderedWidth ?? parentSurfaceDimensions.width;
      const parentRenderedHeight = !parentId || parentId === activeBoardId
        ? boardRenderHeight
        : canonicalGeometries[parentId]?.renderedHeight ?? parentSurfaceDimensions.height;
      const scaleX = parentRenderedWidth / Math.max(parentSurfaceDimensions.width, 1);
      const scaleY = parentRenderedHeight / Math.max(parentSurfaceDimensions.height, 1);
      const cellWidth = Math.max(8, Math.round(instance.frame.width / Math.max(metrics.totalWidth, 1)));
      const expectedWidth = Math.round(cellWidth * metrics.totalWidth);
      const expectedHeight = Math.round(cellWidth * metrics.totalHeight * (scaleX / Math.max(scaleY, 0.0001)));

      if (Math.abs(instance.frame.width - expectedWidth) <= 1 && Math.abs(instance.frame.height - expectedHeight) <= 1) {
        continue;
      }

      onUpdateComponent(gridId, (current) => ({
        ...current,
        frame: (() => {
          const baseFrame = (current.frame ?? instance.frame) as ComponentFrame;
          return clampItemFrame({
            ...baseFrame,
            x: baseFrame.x,
            y: baseFrame.y,
            width: expectedWidth,
            height: expectedHeight,
          }, clampW, clampH);
        })(),
      }));
    }
  }, [activeBoardId, boardInteraction, canonicalGeometries, onUpdateComponent, project.instances]);

  const selectedBoardChild = resolvedSelectedBoardChildId
    ? project.instances[resolvedSelectedBoardChildId] ?? null
    : null;
  const selectedGridCells = selectedBoardChild && isBoardGridComponentType(selectedBoardChild.componentType)
    ? getBoardGridCells(selectedBoardChild)
    : [];
  const resolvedSelectedGridCell = selectedGridCellKey
    ? (selectedGridCells.find((cell) => getGridCoordinateKey(cell) === selectedGridCellKey) ?? null)
    : null;

  const activeTargetManifest = (() => {
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
  })();

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

  // Track viewport metrics from the canvas container.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setViewportMetrics({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [activeBoardId]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = viewportCursor;
    }
  }, [viewportCursor]);

  function resetZoom() {
    setZoom(1);
    if (viewportMetrics && viewportMetrics.width > 0 && viewportMetrics.height > 0) {
      const centered = computeCenteredPan(viewportMetrics, boardRenderWidth, boardRenderHeight);
      setPanX(centered.panX);
      setPanY(centered.panY);
    } else {
      setPanX(0);
      setPanY(0);
    }
  }

  useEffect(() => {
    if (!selectedTopLevelComponentId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearBoardSelection();
      resetZoom();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedTopLevelComponentId]);

  // Auto-fit the board to the canvas viewport once metrics are measured.
  const didFitBoardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeBoardId) return;
    if (!viewportMetrics || viewportMetrics.width <= 0 || viewportMetrics.height <= 0) return;
    if (didFitBoardRef.current === activeBoardId) return;
    didFitBoardRef.current = activeBoardId;
    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => resetZoom());
      didFitBoardRef.current = activeBoardId;
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 !== null) {
        window.cancelAnimationFrame(raf2);
      }
    };
  }, [activeBoardId, viewportMetrics, boardRenderWidth, boardRenderHeight]);

  function updateBoardChildFrame(instanceId: string, updater: (frame: ComponentFrame) => ComponentFrame) {
    const instance = project.instances[instanceId];
    if (!instance) {
      return;
    }

    const childIndex = boardChildIds.indexOf(instanceId);
    const parentId = instance.parentId ? String(instance.parentId) : null;
    const parentSurfaceDimensions = getSurfaceDimensions(parentId, activeBoardId, canonicalGeometries, project.instances);
    const clampW = parentSurfaceDimensions.width;
    const clampH = parentSurfaceDimensions.height;
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

  function addBoardItem(preset: BoardComponentPreset, x?: number, y?: number) {
    const targetParentId = resolvedSelectedBoardChildId || currentSurfaceId;
    if (!targetParentId) {
      return;
    }
    const targetParent = project.instances[targetParentId];
    if (!targetParent) {
      return;
    }

    const targetSurfaceDimensions = getSurfaceDimensions(targetParentId, activeBoardId, canonicalGeometries, project.instances);
    const targetSurfaceWidth = targetSurfaceDimensions.width;
    const targetSurfaceHeight = targetSurfaceDimensions.height;

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

  // Build surface items for the canvas.
  const surfaceItemParams: BuildSurfaceItemParams = {
    project,
    canonicalGeometries,
    activeSurfaceFrames,
    resolvedSelectedBoardChildId,
    selectedBoardChildId,
    editingTextBoxId,
    resolvedSelectedGridCell,
    selectedGridCells,
    viewportMetrics,
    boardRenderWidth,
    boardRenderHeight,
    zoom,
    panX,
    panY,
    resolvePaletteColor,
    setSelectedBoardChildId,
    setSelectedGridCellKey,
    setEditingTextBoxId,
    setZoom,
    setPanX,
    setPanY,
    onUpdateComponent,
    handleBoardItemPointerDown,
    handleBoardItemPointerMove,
  };

  const renderedBoardSurfaceItems = collectSurfaceItems(boardChildIds, 0, surfaceItemParams);

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

  // Build the ancestor path from the selected board child up to the board root.
  const componentPath = (() => {
    type PathEntry = { id: string; label: string; componentType: string };
    const path: PathEntry[] = [];

    if (activeBoard && activeBoardId) {
      path.push({ id: activeBoardId, label: getComponentLabel(project, activeBoardId), componentType: activeBoard.componentType });
    }

    if (resolvedSelectedBoardChildId && activeBoardId) {
      const ancestors: PathEntry[] = [];
      let walkId: string | null = resolvedSelectedBoardChildId;
      while (walkId && walkId !== activeBoardId) {
        const inst: ComponentInstanceModel | undefined = project.instances[walkId];
        if (!inst) break;
        ancestors.unshift({ id: walkId, label: getComponentLabel(project, walkId), componentType: inst.componentType });
        walkId = inst.parentId ? String(inst.parentId) : null;
      }
      path.push(...ancestors);
    }

    return path;
  })();

  return (
    // visualsSectionRoot — top bar + two-column grid (canvas + inspector)
    <div data-layout="visualsSectionRoot" style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 10, height: '100%', minHeight: 0, overflow: 'hidden', padding: '10px 16px 14px 14px', boxSizing: 'border-box' }}>
      {/* componentEditorTopBar — label on left, view toggles on right */}
      <div data-layout="componentEditorTopBar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 12px',
        background: woodBar,
        border: `1px solid ${tabletop.brass.deep}`,
        borderRadius: 12,
        boxShadow: '0 8px 22px rgba(36,22,8,0.40), inset 0 1px 0 rgba(255,225,180,0.22)',
        minHeight: 38,
      }}>
        <div data-layout="componentEditorTopBarLeft" /* back-to-gallery button + heading */ style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onReturnToGallery ? (
            <button
              type="button"
              data-layout="backToGalleryButton"
              /* returns to the intermediate component gallery view */
              onClick={onReturnToGallery}
              title="Back to all components"
              aria-label="Back to all components"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px 4px 8px',
                borderRadius: 9,
                border: '1px solid rgba(216,185,119,0.45)',
                background: 'rgba(247,239,218,0.14)',
                color: tabletop.ink.onWood,
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(247,239,218,0.26)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(247,239,218,0.14)'; }}
            >
              <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1, marginTop: -1 }}>‹</span>
              All components
            </button>
          ) : null}
          <div style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '1.05rem', fontWeight: 700, color: tabletop.ink.onWood, letterSpacing: '0.04em' }}>Component Editor</div>
        </div>
        {/* viewToggleGroup — brass toggle chips for grid, bleed, units, snap */}
        <div data-layout="viewToggleGroup" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {([
            { id: 'grid', label: 'Grid', value: showEditorGrid, onChange: setShowEditorGrid },
            { id: 'bleed', label: 'Bleed', value: showBleedArea, onChange: setShowBleedArea },
            { id: 'units', label: 'Units', value: showUnits, onChange: setShowUnits },
            { id: 'snap', label: 'Snap', value: snapAlignment, onChange: setSnapAlignment },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => opt.onChange(!opt.value)}
              aria-pressed={opt.value}
              title={`Toggle ${opt.label.toLowerCase()}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
                border: opt.value ? '1px solid rgba(216,185,119,0.7)' : '1px solid rgba(216,185,119,0.28)',
                background: opt.value ? 'linear-gradient(180deg, #d8b977, #b8924e)' : 'rgba(247,239,218,0.10)',
                color: opt.value ? '#3a2c10' : 'rgba(243,228,198,0.78)',
                boxShadow: opt.value ? 'inset 0 1px 0 rgba(255,255,255,0.4)' : 'none',
              }}
            >
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: opt.value ? '#3a2c10' : 'rgba(243,228,198,0.4)' }} />
              {opt.label}
            </button>
          ))}
          {/* orientationToggle — swap board width/height between landscape and portrait */}
          {activeBoardId && boardRenderWidth !== boardRenderHeight ? (
            <button
              type="button"
              data-layout="orientationToggle"
              title={boardRenderWidth >= boardRenderHeight ? 'Switch to portrait' : 'Switch to landscape'}
              onClick={() => {
                if (!activeBoardId) return;
                onUpdateComponent(activeBoardId, (instance) => ({
                  ...instance,
                  properties: {
                    ...instance.properties,
                    physicalWidthMm: instance.properties.physicalHeightMm,
                    physicalHeightMm: instance.properties.physicalWidthMm,
                  },
                }));
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                marginLeft: 6, paddingLeft: 10,
                height: 26, borderRadius: 999, paddingRight: 10,
                border: '1px solid rgba(216,185,119,0.4)',
                background: 'rgba(247,239,218,0.12)',
                color: tabletop.ink.onWood, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              <ArrowRightLeft size={13} />
              {boardRenderWidth >= boardRenderHeight ? 'Portrait' : 'Landscape'}
            </button>
          ) : null}
        </div>
      </div>
      {/* visualsSectionBody — canvas + inspector */}
      <div data-layout="visualsSectionBody" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, minHeight: 0, overflow: 'hidden' }}>
        {/* canvasColumn — breadcrumb path bar + canvas, fills left column */}
        <div data-layout="canvasColumn" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden', gap: 6 }}>

          {/* componentPathBar — shows Board > Parent > ... > Selected; click to select ancestor */}
          {activeBoard && (
            <div data-layout="componentPathBar" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              padding: '6px 14px',
              background: woodBar,
              border: `1px solid ${tabletop.brass.deep}`,
              boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.22), 0 6px 16px rgba(36,22,8,0.35)',
              minHeight: 38,
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: 12,
            }}>
              {componentPath.map((entry, i) => {
                const isLast = i === componentPath.length - 1;
                const isBoard = entry.componentType === 'board' || entry.componentType === 'tile';
                return (
                  /* pathSegment — single breadcrumb entry */
                  <div data-layout="pathSegment" key={entry.id} style={{ display: 'contents' }}>
                    {i > 0 && (
                      <span style={{ color: 'rgba(216,185,119,0.55)', fontSize: 12, margin: '0 6px', flexShrink: 0, userSelect: 'none' }}>/</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isBoard) {
                          clearBoardSelection();
                          resetZoom();
                        } else {
                          setSelectedBoardChildId(entry.id);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: isLast ? 800 : 600,
                        color: isLast ? '#3a2c10' : 'rgba(243,228,198,0.72)',
                        background: isLast ? 'linear-gradient(180deg, #d8b977, #b8924e)' : 'transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: isLast ? 'none' : 140,
                        flexShrink: isLast ? 0 : 1,
                        minWidth: 0,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isLast) (e.currentTarget as HTMLElement).style.background = 'rgba(247,239,218,0.12)'; }}
                      onMouseLeave={(e) => { if (!isLast) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {renderComponentIcon(entry.componentType, { size: 13, style: { color: 'currentColor', flexShrink: 0 } })}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* canvasArea — fills remaining space below the path bar */}
          <div data-layout="canvasArea" style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 10 }}>
            {activeBoard ? (() => {
              const surfaceAppearance = boardAppearance ? {
                background: resolvePaletteColor(boardAppearance.surfaceColor) ?? boardAppearance.surfaceColor,
                textureId: boardAppearance.surfaceTexture,
                textureOpacity: boardAppearance.surfaceTextureOpacity,
                borderColor: resolvePaletteColor(boardAppearance.surfaceBorderColor) ?? boardAppearance.surfaceBorderColor,
                borderWidth: boardAppearance.surfaceBorderWidth,
                borderStyle: boardAppearance.surfaceBorderStyle,
              } : undefined;

              const tileShape = activeBoard.componentType === 'tile' && typeof activeBoard.properties.shape === 'string'
                ? activeBoard.properties.shape as 'square' | 'rectangle' | 'circle' | 'hexagon' | 'triangle'
                : undefined;

              return (
                <KonvaBoardSurface
                  items={renderedBoardSurfaceItems}
                  boardWidth={boardRenderWidth}
                  boardHeight={boardRenderHeight}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  onViewChange={(z, px, py) => { setZoom(z); setPanX(px); setPanY(py); }}
                  surfaceAppearance={surfaceAppearance}
                  surfaceBorderRadius={8}
                  surfaceShape={tileShape}
                  showGrid={showEditorGrid}
                  showBleed={showBleedArea}
                  showUnits={showUnits}
                  editable
                  showItemHeader={false}
                  showResizeHandle={false}
                  surfaceRef={canvasRef}
                  onBackgroundClick={clearBoardSelection}
                />
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
                /* componentDesignBoundsPreview — proportional preview for non-board top-level components */
                <div data-layout="componentDesignBoundsPreview" style={{
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
              /* emptyDesignAreaPrompt — shown when no component is selected */
              <div data-layout="emptyDesignAreaPrompt" style={{ display: 'grid', gap: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>
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
          </div>{/* /canvasArea */}
        </div>{/* /canvasColumn */}

        {/* alignmentGuidesOverlay — fixed-position SVG overlay drawn during
            drag interactions. Guide coordinates are parent-local board units,
            converted to page-absolute pixels via the parent's viewport rect. */}
        {alignmentGuides.length > 0 && boardInteraction ? (() => {
          const parentId = boardInteraction.parentId ?? null;
          const parentRect = getSurfaceViewportRect(
            parentId, activeBoardId, viewportMetrics,
            boardRenderWidth, boardRenderHeight, activeSurfaceFrames, eff,
          );
          const parentDims = getSurfaceDimensions(parentId, activeBoardId, canonicalGeometries, project.instances);
          if (!parentRect || !parentDims.width || !parentDims.height) return null;
          const sx = parentRect.width / parentDims.width;
          const sy = parentRect.height / parentDims.height;
          return (
            <svg
              data-layout="alignmentGuidesOverlay"
              style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999,
              }}
            >
              {alignmentGuides.map((g, i) => {
                if (g.axis === 'x') {
                  const x = parentRect.left + g.at * sx;
                  const y1 = parentRect.top + g.from * sy;
                  const y2 = parentRect.top + g.to * sy;
                  return <line key={i} x1={x} y1={y1} x2={x} y2={y2} stroke="#ec4899" strokeWidth={1} strokeDasharray="3,3" />;
                }
                const y = parentRect.top + g.at * sy;
                const x1 = parentRect.left + g.from * sx;
                const x2 = parentRect.left + g.to * sx;
                return <line key={i} x1={x1} y1={y} x2={x2} y2={y} stroke="#ec4899" strokeWidth={1} strokeDasharray="3,3" />;
              })}
            </svg>
          );
        })() : null}

        <VisualInspectorColumn
          project={project}
          activeBoardId={activeBoardId}
          currentSurfaceId={currentSurfaceId}
          boardRenderWidth={boardRenderWidth}
          boardRenderHeight={boardRenderHeight}
          boardAppearance={boardAppearance}
          canonicalGeometries={canonicalGeometries}
          boardChildIds={boardChildIds}
          selectedBoardChild={selectedBoardChild}
          resolvedSelectedBoardChildId={resolvedSelectedBoardChildId}
          selectedTopLevelComponent={selectedTopLevelComponent}
          selectedTopLevelComponentId={selectedTopLevelComponentId}
          resolvedSelectedGridCell={resolvedSelectedGridCell}
          selectedGridCells={selectedGridCells}
          showGridShapePopup={showGridShapePopup}
          gridPopupComponentId={gridPopupComponentId}
          gridAllNeighborOptions={gridAllNeighborOptions}
          boardPresetGroups={boardPresetGroups}
          selectedPresetIds={selectedPresetIds}
          paletteOptions={paletteOptions}
          onSetSelectedPresetIds={setSelectedPresetIds}
          onSetSelectedGridCellKey={setSelectedGridCellKey}
          setSelectedBoardChildId={setSelectedBoardChildId}
          onUpdateComponent={onUpdateComponent}
          onRemoveComponent={onRemoveComponent}
          onDuplicateComponent={onDuplicateComponent}
          onAssignProjectPaletteColor={onAssignProjectPaletteColor}
          updateBoardAppearanceProperty={updateBoardAppearanceProperty}
          updateBoardChildFrame={updateBoardChildFrame}
          updateGridCells={updateGridCells}
          addBoardItem={addBoardItem}
        />
      </div>{/* /visualsSectionBody */}
    </div>
  );
}
