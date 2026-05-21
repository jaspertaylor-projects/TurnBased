import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';

import type { ComponentFrame, ComponentInstanceModel } from '@turnbased/engine-components';

import type { CanonicalGeometry } from '../../boardLayout';
import {
  clampItemFrame,
  getBoardGridCells,
  isBoardGridComponentType,
  isMovableComponentType,
  resizeBoardItemFrame,
} from '../../boardLayout';
import { resolveBoardGridLayout } from '@turnbased/engine-ui';
import type { AlignmentGuide, BoardInteractionState } from './boardEditorUtils';
import {
  getResizeCursor,
  getResizeEdgesForRect,
  hasResizeEdge,
} from './boardEditorUtils';

/** Custom rotate cursor — a small circular arrow, 24×24, hotspot at center. */
const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23064e3b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E") 12 12, crosshair`;
import type { EffectiveScale, ViewportMetrics } from './boardViewportHelpers';
import {
  getPointerClientPosition,
  getPointerPositionWithinRenderedItem,
  getViewportRectForSurfaceFrame,
  getSurfaceDimensions,
  getSurfaceViewportRect,
  preventPointerEvent,
} from './boardViewportHelpers';

// ── Hook input / output types ────────────────────────────────────────

export interface UseBoardInteractionParams {
  activeBoardId: string | null;
  currentSurfaceId: string | null;
  viewportMetrics: ViewportMetrics | null;
  boardRenderWidth: number;
  boardRenderHeight: number;
  canonicalGeometries: Record<string, CanonicalGeometry>;
  activeSurfaceFrames: Record<string, { x: number; y: number; width: number; height: number }>;
  eff: EffectiveScale | null;
  instances: Record<string, ComponentInstanceModel>;
  boardChildIds: string[];
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
}

export interface UseBoardInteractionResult {
  boardInteraction: BoardInteractionState;
  alignmentGuides: readonly AlignmentGuide[];
  viewportCursor: string;
  snapAlignment: boolean;
  setSnapAlignment: (value: boolean) => void;
  copiedInstanceIdRef: React.RefObject<string | null>;
  handleBoardItemPointerDown: (args: {
    child: ComponentInstanceModel;
    childId: string;
    event: ReactMouseEvent<HTMLDivElement>;
    geom: CanonicalGeometry;
    frame: { x: number; y: number; width: number; height: number };
  }) => void;
  handleBoardItemPointerMove: (args: {
    event: ReactMouseEvent<HTMLDivElement>;
    frame: { x: number; y: number; width: number; height: number };
  }) => void;
  setSelectedBoardChildId: (id: string | null) => void;
  selectedBoardChildId: string | null;
  resolvedSelectedBoardChildId: string | null;
  setSelectedGridCellKey: Dispatch<SetStateAction<string | null>>;
  selectedGridCellKey: string | null;
  editingTextBoxId: string | null;
  setEditingTextBoxId: (id: string | null) => void;
  clearBoardSelection: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useBoardInteraction(params: UseBoardInteractionParams): UseBoardInteractionResult {
  const {
    activeBoardId,
    currentSurfaceId,
    viewportMetrics,
    boardRenderWidth,
    boardRenderHeight,
    canonicalGeometries,
    activeSurfaceFrames,
    eff,
    instances,
    boardChildIds,
    onUpdateComponent,
    onRemoveComponent,
    onDuplicateComponent,
  } = params;

  const [viewportCursor, setViewportCursor] = useState('default');
  const [boardInteraction, setBoardInteraction] = useState<BoardInteractionState>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<readonly AlignmentGuide[]>([]);
  const [snapAlignment, setSnapAlignment] = useState<boolean>(true);
  const [selectedBoardChildId, setSelectedBoardChildId] = useState<string | null>(null);
  const [selectedGridCellKey, setSelectedGridCellKey] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);

  // Allow selecting any descendant of the board, not just direct children.
  const resolvedSelectedBoardChildId = (() => {
    if (!selectedBoardChildId || !activeBoardId) return null;
    if (boardChildIds.includes(selectedBoardChildId)) return selectedBoardChildId;
    let ancestorId: string | null = selectedBoardChildId;
    while (ancestorId) {
      const ancestorModel: ComponentInstanceModel | undefined = instances[ancestorId];
      if (!ancestorModel) return null;
      if (String(ancestorModel.parentId) === activeBoardId || ancestorId === activeBoardId) {
        return selectedBoardChildId;
      }
      ancestorId = ancestorModel.parentId ? String(ancestorModel.parentId) : null;
    }
    return null;
  })();

  // Mirror snapAlignment in a ref so the board drag handler (which captures
  // the value in a closure on drag start) always reads the latest toggle
  // state — otherwise flipping the toggle mid-session appears to have no
  // effect until the component remounts.
  const snapAlignmentRef = useRef(snapAlignment);
  useEffect(() => { snapAlignmentRef.current = snapAlignment; }, [snapAlignment]);

  // Clipboard for copy/paste of board children.
  const copiedInstanceIdRef = useRef<string | null>(null);

  function clearBoardSelection() {
    setSelectedBoardChildId(null);
    setSelectedGridCellKey(null);
    setEditingTextBoxId(null);
  }

  // ── Pointer down on a board item ─────────────────────────────────

  function handleBoardItemPointerDown({
    child,
    childId,
    event,
    geom,
    frame,
  }: {
    child: ComponentInstanceModel;
    childId: string;
    event: ReactMouseEvent<HTMLDivElement>;
    geom: CanonicalGeometry;
    frame: { x: number; y: number; width: number; height: number };
  }) {
    const pointer = getPointerClientPosition(event);
    if (!pointer) {
      return;
    }

    preventPointerEvent(event);
    setSelectedBoardChildId(childId);
    if (!isBoardGridComponentType(child.componentType)) {
      setSelectedGridCellKey(null);
    }

    const itemViewportRect = getViewportRectForSurfaceFrame(frame, eff);
    const resizeEdges = getPointerPositionWithinRenderedItem(event, frame)
      ?? (itemViewportRect
        ? getResizeEdgesForRect(pointer.x, pointer.y, itemViewportRect)
        : {
          left: false,
          right: false,
          top: false,
          bottom: false,
        });
    const parentId = child.parentId ? String(child.parentId) : null;
    const parentViewportRect = getSurfaceViewportRect(
      parentId, activeBoardId, viewportMetrics,
      boardRenderWidth, boardRenderHeight, activeSurfaceFrames, eff,
    );
    const parentSurfaceDimensions = getSurfaceDimensions(parentId, activeBoardId, canonicalGeometries, instances);
    if (!parentViewportRect) {
      return;
    }

    const interactionClampW = parentSurfaceDimensions.width;
    const interactionClampH = parentSurfaceDimensions.height;
    const parentScreenW = Math.max(parentViewportRect.width, 1);
    const parentScreenH = Math.max(parentViewportRect.height, 1);

    // Ctrl+drag starts a rotate interaction instead of move/resize.
    // Konva events expose the native MouseEvent on `evt`.
    const nativeDown = (event as any).evt ?? event;
    const isRotate = nativeDown.ctrlKey || nativeDown.metaKey;

    const startFrame = {
      ...child.frame,
      x: geom.localX,
      y: geom.localY,
      width: geom.localWidth,
      height: geom.localHeight,
      background: geom.background ?? 'transparent',
      borderColor: geom.borderColor ?? 'transparent',
      borderWidth: geom.borderWidth ?? 0,
      borderRadius: geom.borderRadius ?? 0,
    } as ComponentFrame;

    if (isRotate && itemViewportRect) {
      const centerScreenX = itemViewportRect.left + itemViewportRect.width / 2;
      const centerScreenY = itemViewportRect.top + itemViewportRect.height / 2;
      const startAngleRad = Math.atan2(pointer.y - centerScreenY, pointer.x - centerScreenX);
      const startAngleDeg = startAngleRad * (180 / Math.PI);
      const currentRotation = startFrame.rotation ?? 0;

      setViewportCursor(ROTATE_CURSOR);
      setBoardInteraction({
        kind: 'rotate',
        instanceId: childId,
        pointerX: pointer.x,
        pointerY: pointer.y,
        boardUnitsPerPixelX: interactionClampW / parentScreenW,
        boardUnitsPerPixelY: interactionClampH / parentScreenH,
        surfaceWidth: interactionClampW,
        surfaceHeight: interactionClampH,
        startFrame,
        parentId,
        rotateCenterScreenX: centerScreenX,
        rotateCenterScreenY: centerScreenY,
        startAngleDeg,
        startRotation: currentRotation,
      });
      return;
    }

    setViewportCursor(hasResizeEdge(resizeEdges) ? getResizeCursor(resizeEdges) : 'move');
    setBoardInteraction({
      kind: hasResizeEdge(resizeEdges) ? 'resize' : 'move',
      instanceId: childId,
      pointerX: pointer.x,
      pointerY: pointer.y,
      boardUnitsPerPixelX: interactionClampW / parentScreenW,
      boardUnitsPerPixelY: interactionClampH / parentScreenH,
      surfaceWidth: interactionClampW,
      surfaceHeight: interactionClampH,
      startFrame,
      resizeEdges,
      parentId,
      siblings: (() => {
        if (!parentId) return [];
        const parent = instances[parentId];
        if (!parent) return [];
        const out: { x: number; y: number; width: number; height: number }[] = [];
        for (const siblingId of parent.children.map(String)) {
          if (siblingId === childId) continue;
          const sibling = instances[siblingId];
          if (!sibling || isMovableComponentType(sibling.componentType)) continue;
          const g = canonicalGeometries[siblingId];
          if (!g) continue;
          out.push({ x: g.localX, y: g.localY, width: g.localWidth, height: g.localHeight });
        }
        return out;
      })(),
    });
  }

  // ── Pointer move over a board item (cursor update) ───────────────

  function handleBoardItemPointerMove({
    event,
    frame,
  }: {
    event: ReactMouseEvent<HTMLDivElement>;
    frame: { x: number; y: number; width: number; height: number };
  }) {
    // When Ctrl/Cmd is held, show a grab cursor to indicate rotate mode.
    // Konva events expose the native MouseEvent on `evt`; React events
    // have ctrlKey directly — check both paths.
    const nativeMove = (event as any).evt ?? event;
    if (nativeMove.ctrlKey || nativeMove.metaKey) {
      setViewportCursor(ROTATE_CURSOR);
      return;
    }

    const pointer = getPointerClientPosition(event);
    const itemViewportRect = getViewportRectForSurfaceFrame(frame, eff);
    const resizeEdges = getPointerPositionWithinRenderedItem(event, frame)
      ?? (pointer && itemViewportRect
        ? getResizeEdgesForRect(pointer.x, pointer.y, itemViewportRect)
        : null);
    if (!resizeEdges) {
      return;
    }

    setViewportCursor(getResizeCursor(resizeEdges));
  }

  // ── Global pointer-move / pointer-up during drag ─────────────────

  useEffect(() => {
    if (!boardInteraction) {
      return undefined;
    }

    const interaction = boardInteraction;

    function handlePointerMove(event: globalThis.MouseEvent) {
      const pointer = getPointerClientPosition(event);
      if (!pointer) {
        return;
      }

      // ── Rotate interaction ──────────────────────────────────────────
      if (interaction.kind === 'rotate'
        && interaction.rotateCenterScreenX != null
        && interaction.rotateCenterScreenY != null
        && interaction.startAngleDeg != null
        && interaction.startRotation != null
      ) {
        const currentAngleRad = Math.atan2(
          pointer.y - interaction.rotateCenterScreenY,
          pointer.x - interaction.rotateCenterScreenX,
        );
        const currentAngleDeg = currentAngleRad * (180 / Math.PI);
        let delta = currentAngleDeg - interaction.startAngleDeg;

        // Snap to 15-degree increments when Shift is held.
        if (event.shiftKey) {
          const raw = interaction.startRotation + delta;
          const snapped = Math.round(raw / 15) * 15;
          delta = snapped - interaction.startRotation;
        }

        const nextRotation = interaction.startRotation + delta;

        onUpdateComponent(interaction.instanceId, (instance) => ({
          ...instance,
          frame: { ...(instance.frame ?? interaction.startFrame), rotation: nextRotation },
        }));
        return;
      }

      // ── Move / resize interaction ───────────────────────────────────
      const dx = (pointer.x - interaction.pointerX) * interaction.boardUnitsPerPixelX;
      const dy = (pointer.y - interaction.pointerY) * interaction.boardUnitsPerPixelY;

      const SNAP_THRESHOLD = 3; // mm
      const w = interaction.startFrame.width;
      const h = interaction.startFrame.height;
      const targetX = interaction.startFrame.x + dx;
      const targetY = interaction.startFrame.y + dy;

      function snapAxis(
        start: number,
        size: number,
        siblings: readonly { start: number; size: number }[],
      ): { value: number; guides: number[] } {
        if (!snapAlignmentRef.current) return { value: start, guides: [] };
        const candidates = [
          { mine: start, kind: 'near' },
          { mine: start + size / 2, kind: 'center' },
          { mine: start + size, kind: 'far' },
        ] as const;
        const lines: { at: number; delta: number }[] = [];
        for (const s of siblings) {
          const sibLines = [s.start, s.start + s.size / 2, s.start + s.size];
          for (const c of candidates) {
            for (const sl of sibLines) {
              const delta = sl - c.mine;
              if (Math.abs(delta) <= SNAP_THRESHOLD) {
                lines.push({ at: sl, delta });
              }
            }
          }
        }
        if (lines.length === 0) return { value: start, guides: [] };
        lines.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
        const bestDelta = lines[0].delta;
        const guides = lines
          .filter((l) => Math.abs(l.delta - bestDelta) < 0.01)
          .map((l) => l.at);
        return { value: start + bestDelta, guides };
      }

      const sibs = interaction.siblings ?? [];
      const snappedX = snapAxis(
        targetX,
        w,
        sibs.map((s) => ({ start: s.x, size: s.width })),
      );
      const snappedY = snapAxis(
        targetY,
        h,
        sibs.map((s) => ({ start: s.y, size: s.height })),
      );

      const activeGuides: AlignmentGuide[] = [];
      if (snappedX.guides.length > 0) {
        const fromY = Math.min(snappedY.value, ...sibs.map((s) => s.y));
        const toY = Math.max(snappedY.value + h, ...sibs.map((s) => s.y + s.height));
        for (const at of snappedX.guides) activeGuides.push({ axis: 'x', at, from: fromY, to: toY });
      }
      if (snappedY.guides.length > 0) {
        const fromX = Math.min(snappedX.value, ...sibs.map((s) => s.x));
        const toX = Math.max(snappedX.value + w, ...sibs.map((s) => s.x + s.width));
        for (const at of snappedY.guides) activeGuides.push({ axis: 'y', at, from: fromX, to: toX });
      }
      setAlignmentGuides(activeGuides);

      onUpdateComponent(interaction.instanceId, (instance) => {
        const nextFrame = interaction.kind === 'move'
          ? {
            ...interaction.startFrame,
            x: Math.max(0, Math.min(snappedX.value, interaction.surfaceWidth - w)),
            y: Math.max(0, Math.min(snappedY.value, interaction.surfaceHeight - h)),
          }
          : (() => {
            const resizedFrame = resizeBoardItemFrame(interaction.startFrame, dx, dy, interaction.resizeEdges ?? {
              left: false,
              right: true,
              top: false,
              bottom: true,
            }, interaction.surfaceWidth, interaction.surfaceHeight);

            if (!isBoardGridComponentType(instance.componentType)) {
              return resizedFrame;
            }

            const gridMetrics = resolveBoardGridLayout(
              instance.componentType,
              getBoardGridCells(instance).map((cell) => ({ row: cell.y, column: cell.x })),
            );
            const resizeEdges = interaction.resizeEdges ?? {
              left: false,
              right: true,
              top: false,
              bottom: true,
            };
            const widthDrivenCellSize = resizedFrame.width / Math.max(gridMetrics.totalWidth, 1);
            const heightDrivenCellSize = resizedFrame.height / Math.max(
              gridMetrics.totalHeight * (interaction.boardUnitsPerPixelY / Math.max(interaction.boardUnitsPerPixelX, 0.0001)),
              1,
            );
            const useWidthDrivenSize = (resizeEdges.left || resizeEdges.right) && !(resizeEdges.top || resizeEdges.bottom)
              ? true
              : (resizeEdges.top || resizeEdges.bottom) && !(resizeEdges.left || resizeEdges.right)
                ? false
                : Math.abs(dx) >= Math.abs(dy);
            const resolvedCellSize = Math.max(1, useWidthDrivenSize ? widthDrivenCellSize : heightDrivenCellSize);
            const nextWidth = resolvedCellSize * gridMetrics.totalWidth;
            const nextHeight = resolvedCellSize
              * gridMetrics.totalHeight
              * (interaction.boardUnitsPerPixelY / Math.max(interaction.boardUnitsPerPixelX, 0.0001));
            const anchoredRight = interaction.startFrame.x + interaction.startFrame.width;
            const anchoredBottom = interaction.startFrame.y + interaction.startFrame.height;

            return {
              ...resizedFrame,
              x: resizeEdges.left && !resizeEdges.right ? anchoredRight - nextWidth : resizedFrame.x,
              y: resizeEdges.top && !resizeEdges.bottom ? anchoredBottom - nextHeight : resizedFrame.y,
              width: nextWidth,
              height: nextHeight,
            };
          })();

        return {
          ...instance,
          frame: clampItemFrame(nextFrame, interaction.surfaceWidth, interaction.surfaceHeight),
        };
      });
    }

    function handlePointerUp() {
      setViewportCursor('default');
      setBoardInteraction(null);
      setAlignmentGuides([]);
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [boardInteraction, onUpdateComponent, snapAlignment]);

  // ── Keyboard shortcuts (delete, copy, paste, duplicate) ──────────

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
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && (event.key === 'c' || event.key === 'C')) {
        if (resolvedSelectedBoardChildId) {
          event.preventDefault();
          copiedInstanceIdRef.current = resolvedSelectedBoardChildId;
        }
        return;
      }

      if (isMeta && (event.key === 'd' || event.key === 'D')) {
        if (resolvedSelectedBoardChildId) {
          event.preventDefault();
          const sourceInstance = instances[resolvedSelectedBoardChildId];
          const targetParentId = currentSurfaceId
            ?? (sourceInstance?.parentId ? String(sourceInstance.parentId) : null);
          const newId = onDuplicateComponent(resolvedSelectedBoardChildId, {
            targetParentId,
            focus: false,
            frameOffset: { x: 16, y: 16 },
          });
          if (newId) setSelectedBoardChildId(newId);
        }
        return;
      }

      if (isMeta && (event.key === 'v' || event.key === 'V')) {
        const sourceId = copiedInstanceIdRef.current;
        if (!sourceId || !instances[sourceId]) {
          return;
        }
        event.preventDefault();
        const sourceInstance = instances[sourceId];
        const targetParentId = currentSurfaceId
          ?? (sourceInstance.parentId ? String(sourceInstance.parentId) : null);
        const newId = onDuplicateComponent(sourceId, {
          targetParentId,
          focus: false,
          frameOffset: { x: 16, y: 16 },
        });
        if (newId) setSelectedBoardChildId(newId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolvedSelectedBoardChildId, onRemoveComponent, onDuplicateComponent, instances, currentSurfaceId]);

  // ── Ctrl key cursor toggle (rotate hint) ───────────────────────────

  useEffect(() => {
    if (!resolvedSelectedBoardChildId || boardInteraction) return undefined;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Control' || event.key === 'Meta') {
        setViewportCursor(event.type === 'keydown' ? ROTATE_CURSOR : 'default');
      }
    }

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, [resolvedSelectedBoardChildId, boardInteraction]);

  return {
    boardInteraction,
    alignmentGuides,
    viewportCursor,
    snapAlignment,
    setSnapAlignment,
    copiedInstanceIdRef,
    handleBoardItemPointerDown,
    handleBoardItemPointerMove,
    setSelectedBoardChildId,
    selectedBoardChildId,
    resolvedSelectedBoardChildId,
    setSelectedGridCellKey,
    selectedGridCellKey,
    editingTextBoxId,
    setEditingTextBoxId,
    clearBoardSelection,
  };
}
