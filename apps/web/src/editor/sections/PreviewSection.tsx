import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Bot, RotateCcw, UserRound } from 'lucide-react';
import type { CompiledLegalMoveTree, GameState } from '@turnbased/engine-core';
import { resolveBoardAppearanceProperties } from '@turnbased/engine-components';
import {
  BoardGrid,
  BoardSurface,
  getAffordancePulseStyle,
  GameInfoPanel,
  GameTableHeader,
  GamePreviewWindow,
  GameSurfacePopup,
  LinkedSeatSummaryStrip,
  PlayerLinkedViewStage,
  ResourceDock,
  useEngineUiMotionStyles,
} from '@turnbased/engine-ui';
import type { LinkedSeatSummaryItem, UIAffordanceState, UISelectionState } from '@turnbased/engine-ui';

import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  getBoardGridCells,
  getGridCellAppearance,
  getResolvedBoardItemFrame,
  isBoardGridComponentType,
  isMovableComponentType,
} from '../boardLayout';
import { renderComponentIcon } from '../componentMeta';
import { TextBoxContent } from '../components/TextBoxContent';
import { getOwnerColor } from '../helpers';
import { renderIcon } from '../iconography';
import { resolveProjectPaletteColorValue } from '../projectPalette';
import { toPreviewZoneId } from '../runtime';
import type { EditorProject } from '../types';

const EMPTY_SELECTION: UISelectionState = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

function renderImageAreaContent(properties: Record<string, unknown>) {
  const imageUrl = typeof properties.imageUrl === 'string' ? properties.imageUrl.trim() : '';
  const opacity = typeof properties.opacity === 'number' ? properties.opacity : 1;
  const objectFit = properties.objectFit === 'cover' || properties.objectFit === 'fill' ? properties.objectFit : 'contain';

  if (!imageUrl) {
    return <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No image</span>;
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

export function PreviewSection({
  project,
  boardInstances,
  topLevelSupportZones,
  previewState,
  affordances,
  moveTree,
  selection,
  onResetPreview,
  onExecuteMove,
  onSetSelection,
  onEntityClick,
  onZoneClick,
}: {
  project: EditorProject;
  boardInstances: string[];
  topLevelSupportZones: string[];
  previewState: GameState | null;
  affordances: UIAffordanceState | null;
  moveTree: CompiledLegalMoveTree | null;
  selection: UISelectionState;
  onResetPreview: () => void;
  onExecuteMove: (actionId: string, overrides?: Partial<UISelectionState>) => void;
  onSetSelection: (selection: UISelectionState) => void;
  onEntityClick: (entityId: string) => void;
  onZoneClick: (zoneId: string) => void;
}) {
  useEngineUiMotionStyles();

  const [activeViewId, setActiveViewId] = useState(project.views.selectedViewId || project.views.defaultViewId);
  const [hasStarted, setHasStarted] = useState(false);
  const [showStartPopup, setShowStartPopup] = useState(false);
  const [playMode, setPlayMode] = useState<'manual' | 'ai'>('manual');
  const resolvePaletteColor = (value: string | null | undefined) => (
    resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value ?? null
  );

  const viewMap = useMemo(
    () => new Map(project.views.items.map((view) => [view.id, view])),
    [project.views.items],
  );
  const activeView = viewMap.get(activeViewId) ?? viewMap.get(project.views.defaultViewId) ?? project.views.items[0];
  const linkedSeat = activeView?.linkedSeatId
    ? project.seats.find((seat) => seat.id === activeView.linkedSeatId) ?? null
    : null;

  const mainBoardId = boardInstances[0] ?? null;
  const mainBoard = mainBoardId ? project.instances[mainBoardId] : null;
  const mainBoardChildIds = mainBoard
    ? mainBoard.children.map(String).filter((childId) => {
      const child = project.instances[childId];
      return child && !isMovableComponentType(child.componentType);
    })
    : [];
  const playerZoneIdsBySeat = Object.fromEntries(project.seats.map((seat) => [
    seat.id,
    topLevelSupportZones.filter((instanceId) => project.instances[instanceId]?.bindings.ownerId === seat.id),
  ]));
  const sharedZoneIds = topLevelSupportZones.filter((instanceId) => !project.instances[instanceId]?.bindings.ownerId);
  const linkedZoneIds = linkedSeat ? playerZoneIdsBySeat[linkedSeat.id] ?? [] : [];
  const activePlayerName = previewState
    ? previewState.players[previewState.turnState.activePlayerId]?.displayName ?? 'Unknown player'
    : 'Ready to start';
  const endTurnAction = hasStarted
    ? affordances?.availableActions.find((action) => action.id === 'territory:end-turn' || action.label.toLowerCase() === 'end turn') ?? null
    : null;

  function collectNestedResourcePileIds(instanceId: string): string[] {
    const instance = project.instances[instanceId];
    if (!instance) {
      return [];
    }

    return instance.children.flatMap((childId) => {
      const child = project.instances[childId];
      if (!child) {
        return [];
      }

      if (child.componentType === 'resource-pile') {
        return [String(child.instanceId)];
      }

      return collectNestedResourcePileIds(String(child.instanceId));
    });
  }

  function getRenderableZoneIds(instanceId: string): string[] {
    const resourcePileIds = collectNestedResourcePileIds(instanceId);
    return resourcePileIds.length > 0 ? resourcePileIds : [instanceId];
  }

  function getZoneEntityIds(instanceId: string): string[] {
    if (!previewState) {
      return [];
    }

    return getRenderableZoneIds(instanceId).flatMap((zoneId) => previewState.zones[toPreviewZoneId(zoneId)]?.entityIds ?? []);
  }

  function hasInfiniteSupply(instanceId: string): boolean {
    const instance = project.instances[instanceId];
    if (!instance) {
      return false;
    }

    return instance.children.some((childId) => {
      const child = project.instances[childId];
      if (!child) {
        return false;
      }

      if ((child.componentType === 'piece' || child.componentType === 'token') && child.properties.supplyMode === 'infinite') {
        return true;
      }

      return hasInfiniteSupply(String(child.instanceId));
    });
  }

  function getSeatReserveEntityIds(seatId: string): string[] {
    if (!previewState) {
      return [];
    }

    const zoneIds = playerZoneIdsBySeat[seatId] ?? [];
    return zoneIds.flatMap((zoneId) => getZoneEntityIds(zoneId));
  }

  function countSeatResources(seatId: string): number {
    if (!previewState) {
      return project.seats.find((seat) => seat.id === seatId)?.resources.startingBlocks ?? 0;
    }

    return getSeatReserveEntityIds(seatId).length;
  }

  function handleResetGame() {
    onResetPreview();
    onSetSelection(EMPTY_SELECTION);
    setActiveViewId(project.views.defaultViewId);
    setShowStartPopup(false);
    setHasStarted(false);
  }

  function handleOpenStartPopup() {
    setPlayMode('manual');
    setShowStartPopup(true);
  }

  function handleConfirmStart() {
    onResetPreview();
    onSetSelection(EMPTY_SELECTION);
    setActiveViewId(project.views.defaultViewId);
    setShowStartPopup(false);
    setHasStarted(true);
  }

  function handleEntityDragStart(entityId: string) {
    if (!hasStarted) {
      return;
    }

    onSetSelection({
      ...EMPTY_SELECTION,
      selectedEntityId: entityId,
      dragEntityId: entityId,
    });
  }

  function handleEntityDragEnd() {
    if (!selection.dragEntityId) {
      return;
    }

    onSetSelection({
      ...selection,
      dragEntityId: null,
    });
  }

  function handleZoneDrop(zoneId: string) {
    if (!moveTree || !selection.dragEntityId) {
      return;
    }

    const typedZoneId = toPreviewZoneId(zoneId);
    const matchingAction = moveTree.availableActions.find((action) => (
      action.interactableEntities.includes(selection.dragEntityId ?? '')
      && action.validDestinations.includes(typedZoneId)
    ));

    if (matchingAction) {
      onExecuteMove(matchingAction.id, {
        selectedEntityId: selection.dragEntityId,
        selectedZoneId: typedZoneId,
        dragEntityId: null,
      });
      return;
    }

    onSetSelection({
      ...selection,
      dragEntityId: null,
    });
  }

  function renderCube(entityId: string) {
    if (!previewState) {
      return null;
    }

    const entity = previewState.entities[entityId];
    const entityState = affordances?.entityStates[entityId];
    const canInteract = hasStarted && Boolean(entityState?.interactable);
    const shouldPulse = hasStarted && Boolean(
      entityState?.interactable
      || entityState?.highlighted
      || entityState?.dragSource
      || entityState?.selected
    );

    return (
      <button
        key={entityId}
        type="button"
        draggable={canInteract}
        onDragStart={() => handleEntityDragStart(entityId)}
        onDragEnd={handleEntityDragEnd}
        onClick={() => {
          if (hasStarted) {
            onEntityClick(entityId);
          }
        }}
        title={entity.ownerId ? `${previewState.players[entity.ownerId]?.displayName ?? 'Player'} cube` : 'Cube'}
        style={{
          width: '20px',
          height: '20px',
          padding: 0,
          borderRadius: '6px',
          appearance: 'none',
          border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.16)',
          backgroundColor: entity.properties.colorMode === 'owner'
            ? getOwnerColor(project, entity.ownerId)
            : '#94a3b8',
          backgroundImage: 'none',
          backgroundClip: 'padding-box',
          display: 'inline-block',
          lineHeight: 0,
          cursor: canInteract ? 'grab' : 'default',
          boxShadow: entityState?.dragSource ? '0 0 0 3px rgba(14,165,233,0.18)' : 'none',
          transition: 'transform 140ms ease, filter 140ms ease',
          ...getAffordancePulseStyle(shouldPulse, 'entity'),
        }}
      />
    );
  }

  function renderMainBoard() {
    if (!previewState || !mainBoard) {
      return (
        <div style={{ padding: '2rem', borderRadius: '24px', border: '1px dashed rgba(15,118,110,0.24)', textAlign: 'center', color: '#0f766e', background: 'rgba(255,255,255,0.8)' }}>
          Add a board in the component editor to launch the preview.
        </div>
      );
    }

    const boardAppearance = resolveBoardAppearanceProperties(mainBoard.properties);

    return (
      <BoardSurface
        items={mainBoardChildIds.map((childId, index) => {
          const child = project.instances[childId];
          if (!child) {
            return null;
          }

          const frame = getResolvedBoardItemFrame(child, index);
          const isGrid = isBoardGridComponentType(child.componentType);
          const zoneId = toPreviewZoneId(childId);
          const zone = previewState.zones[zoneId];
          const zoneState = affordances?.zoneStates[zoneId];
          const isDropSurface = child.componentType === 'space' || child.componentType === 'zone';
          const gridCellIds = isGrid
            ? child.children.map(String).filter((cellId) => project.instances[cellId]?.componentType === 'space')
            : [];
          const shouldPulse = isGrid
            ? hasStarted && gridCellIds.some((cellId) => {
              const cellState = affordances?.zoneStates[toPreviewZoneId(cellId)];
              return Boolean(
                cellState?.interactable
                || cellState?.highlighted
                || cellState?.dropTarget
                || cellState?.selected
              );
            })
            : hasStarted && Boolean(
              zoneState?.interactable
              || zoneState?.highlighted
              || zoneState?.dropTarget
              || zoneState?.selected
            );
          const dropTarget = isGrid
            ? gridCellIds.some((cellId) => Boolean(affordances?.zoneStates[toPreviewZoneId(cellId)]?.dropTarget))
            : Boolean(zoneState?.dropTarget);
          const selected = isGrid
            ? gridCellIds.some((cellId) => Boolean(affordances?.zoneStates[toPreviewZoneId(cellId)]?.selected))
            : Boolean(zoneState?.selected);

          return {
            id: childId,
            label: String(child.properties.label ?? child.displayName ?? 'Board Item'),
            typeLabel: child.componentType.replace('-', ' '),
            icon: renderComponentIcon(child.componentType, { size: 16, style: { color: '#064e3b' } }),
            showHeader: child.componentType !== 'text-box',
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            background: dropTarget ? 'rgba(250,204,21,0.18)' : (resolvePaletteColor(frame.background) ?? frame.background),
            borderColor: dropTarget ? '#f97316' : (resolvePaletteColor(frame.borderColor) ?? frame.borderColor),
            borderWidth: dropTarget ? 3 : frame.borderWidth,
            borderRadius: frame.borderRadius,
            selected,
            highlighted: shouldPulse,
            dropTarget,
            onClick: !isGrid && isDropSurface && hasStarted ? () => onZoneClick(childId) : undefined,
            onDragOver: isDropSurface
              ? (event: DragEvent<HTMLDivElement>) => {
                if (hasStarted && selection.dragEntityId) {
                  event.preventDefault();
                }
              }
              : undefined,
            onDrop: isDropSurface
              ? (event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                handleZoneDrop(childId);
              }
              : undefined,
            content: child.componentType === 'text-box'
              ? (
                <TextBoxContent
                  project={project}
                  properties={child.properties}
                  emptyPlaceholder="Add text in the component editor."
                />
              )
              : child.componentType === 'image-area'
              ? renderImageAreaContent(child.properties)
              : child.componentType === 'card'
              ? (
                <div style={{ display: 'grid', gap: '0.45rem', color: '#064e3b' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{String(child.properties.title ?? child.properties.label ?? 'Card')}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#0f766e', lineHeight: 1.5 }}>
                    {String(child.properties.subtitle ?? 'Card text')}
                  </span>
                </div>
              )
              : isGrid
              ? (() => {
                const gridCells = getBoardGridCells(child);

                return (
                  <BoardGrid
                    kind={child.componentType as 'hex-grid' | 'square-grid' | 'checkerboard-grid'}
                    cells={gridCellIds.map((cellId, cellIndex) => {
                      const cell = project.instances[cellId];
                      const cellZoneId = toPreviewZoneId(cellId);
                      const cellZone = previewState.zones[cellZoneId];
                      const cellState = affordances?.zoneStates[cellZoneId];
                      const cellAppearance = getGridCellAppearance(child);
                      const row = typeof cell?.placement?.coordinates?.y === 'number'
                        ? cell.placement.coordinates.y
                        : (gridCells[cellIndex]?.y ?? cellIndex);
                      const column = typeof cell?.placement?.coordinates?.x === 'number'
                        ? cell.placement.coordinates.x
                        : (gridCells[cellIndex]?.x ?? 0);

                      return {
                        id: cellId,
                        row,
                        column,
                        label: String(cell?.properties.label ?? cell?.displayName ?? `Cell ${cellIndex + 1}`),
                        background: cellState?.dropTarget
                          ? 'rgba(250,204,21,0.24)'
                          : (resolvePaletteColor(cellAppearance.background) ?? cellAppearance.background),
                        textureId: cellAppearance.textureId,
                        textureOpacity: cellAppearance.textureOpacity,
                        borderColor: cellState?.dropTarget
                          ? '#f97316'
                          : (resolvePaletteColor(cellAppearance.borderColor) ?? (child.componentType === 'hex-grid' ? undefined : 'rgba(15,118,110,0.18)')),
                        borderWidth: cellState?.dropTarget ? 2 : cellAppearance.borderWidth,
                        borderRadius: cellAppearance.borderRadius,
                        selected: Boolean(cellState?.selected),
                        highlighted: Boolean(cellState?.highlighted || cellState?.interactable),
                        dropTarget: Boolean(cellState?.dropTarget),
                        onClick: hasStarted ? () => onZoneClick(cellId) : undefined,
                        onDragOver: (event: DragEvent<HTMLDivElement>) => {
                          if (hasStarted && selection.dragEntityId) {
                            event.preventDefault();
                          }
                        },
                        onDrop: (event: DragEvent<HTMLDivElement>) => {
                          event.preventDefault();
                          handleZoneDrop(cellId);
                        },
                        content: (cellZone?.entityIds ?? []).length
                          ? (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                              {cellZone?.entityIds.map((entityId) => renderCube(entityId))}
                            </div>
                          )
                          : null,
                      };
                    })}
                  />
                );
              })()
              : (
                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                  {(zone?.entityIds ?? []).length
                    ? zone?.entityIds.map((entityId) => renderCube(entityId))
                    : (
                      <span style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center' }}>
                        {isDropSurface ? 'Drop pieces here' : 'Styled board item'}
                      </span>
                    )}
                </div>
              ),
          };
        }).filter((item): item is NonNullable<typeof item> => Boolean(item))}
        width={BOARD_SURFACE_WIDTH}
        height={BOARD_SURFACE_HEIGHT}
        minHeight={520}
        surfaceAppearance={{
          background: resolvePaletteColor(boardAppearance.surfaceColor) ?? boardAppearance.surfaceColor,
          textureId: boardAppearance.surfaceTexture,
          borderColor: resolvePaletteColor(boardAppearance.surfaceBorderColor) ?? boardAppearance.surfaceBorderColor,
          borderWidth: boardAppearance.surfaceBorderWidth,
          borderStyle: boardAppearance.surfaceBorderStyle,
        }}
        showItemHeader={false}
        emptyState={(
          <div style={{ maxWidth: '320px', display: 'grid', gap: '0.55rem', color: '#0f766e' }}>
            <strong style={{ color: '#064e3b' }}>Add board subcomponents like spaces, cards, tracks, networks, or grids</strong>
            <span>The preview board mirrors that authored board surface directly.</span>
          </div>
        )}
      />
    );
  }

  function getZoneMeta(instanceId: string): string {
    const instance = project.instances[instanceId];
    if (!instance) {
      return 'Shared zone';
    }

    return hasInfiniteSupply(instanceId) ? 'Infinite source' : 'Shared zone';
  }

  function renderSupportDock() {
    if (!previewState) {
      return null;
    }

    return (
      <ResourceDock
        sections={[
          ...project.seats.map((seat) => {
            const entityIds = getSeatReserveEntityIds(seat.id);

            return {
              id: seat.id,
              title: seat.name,
              meta: `${entityIds.length} cubes`,
              accent: seat.color,
              content: (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveViewId(project.views.items.find((view) => view.linkedSeatId === seat.id)?.id ?? project.views.defaultViewId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#064e3b',
                      cursor: 'pointer',
                      justifySelf: 'start',
                    }}
                  >
                    {renderIcon(seat.identity.iconKey, { size: 16, style: { color: '#064e3b' } })}
                    View
                  </button>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                    {entityIds.length ? entityIds.map((entityId) => renderCube(entityId)) : <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No cubes</span>}
                  </div>
                </div>
              ),
            };
          }),
          ...sharedZoneIds.map((zoneId) => {
            const entityIds = getZoneEntityIds(zoneId);
            return {
              id: zoneId,
              title: project.instances[zoneId]?.displayName ?? 'Shared Zone',
              meta: getZoneMeta(zoneId),
              accent: '#84cc16',
              content: (
                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                  {entityIds.length
                    ? entityIds.map((entityId) => renderCube(entityId))
                    : <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No pieces here</span>}
                </div>
              ),
            };
          }),
        ]}
      />
    );
  }

  function renderPlayerView(zoneIds: string[], emptyMessage: string) {
    if (!previewState) {
      return null;
    }

    if (zoneIds.length === 0) {
      return (
        <div style={{ padding: '1.8rem', borderRadius: '24px', border: '1px dashed rgba(15,118,110,0.24)', textAlign: 'center', color: '#0f766e', background: 'rgba(255,255,255,0.82)' }}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
        {zoneIds.map((zoneId) => {
          const zone = project.instances[zoneId];
          const entityIds = getZoneEntityIds(zoneId);
          return (
            <div
              key={zoneId}
              style={{
                padding: '0.95rem',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(15,118,110,0.1)',
                display: 'grid',
                gap: '0.75rem',
                minHeight: '220px',
              }}
            >
              <div style={{ fontWeight: 800, color: '#064e3b' }}>{zone?.displayName ?? 'Zone'}</div>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignContent: 'start' }}>
                {entityIds.length
                  ? entityIds.map((entityId) => renderCube(entityId))
                  : <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No cubes here yet.</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const seatItems: LinkedSeatSummaryItem[] = project.seats.map((seat) => ({
    id: seat.id,
    label: seat.name,
    color: seat.color,
    icon: renderIcon(seat.identity.iconKey, { size: 20, style: { color: '#064e3b' } }) as LinkedSeatSummaryItem['icon'],
    summary: `${countSeatResources(seat.id)} cubes`,
    active: activeView?.linkedSeatId === seat.id,
    onSelect: () => setActiveViewId(project.views.items.find((view) => view.linkedSeatId === seat.id)?.id ?? project.views.defaultViewId),
  }));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <GameTableHeader
        title={project.name}
        action={(
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            {hasStarted ? (
              <button
                type="button"
                onClick={handleResetGame}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  border: '1px solid rgba(15,23,42,0.16)',
                  background: 'rgba(255,255,255,0.94)',
                  borderRadius: '999px',
                  padding: '0.65rem 1rem',
                  color: '#111827',
                  fontWeight: 700,
                }}
              >
                <RotateCcw size={16} />
                Reset Game
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenStartPopup}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #064e3b, #10b981)',
                  borderRadius: '999px',
                  padding: '0.65rem 1rem',
                  color: 'white',
                  fontWeight: 700,
                }}
                >
                  <UserRound size={16} />
                  Start Game
                </button>
            )}
          </div>
        )}
      />

      <GamePreviewWindow>
        <div style={{ display: 'grid', gap: '1rem', height: '100%', alignContent: 'start' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            <LinkedSeatSummaryStrip items={seatItems} />
            <GameInfoPanel
              label="Turn"
              value={hasStarted ? activePlayerName : 'Ready to start'}
              action={hasStarted && endTurnAction?.enabled ? (
                <button
                  type="button"
                  onClick={() => onExecuteMove(endTurnAction.id)}
                  style={{
                    border: 'none',
                    background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                    color: 'white',
                    borderRadius: '999px',
                    padding: '0.55rem 0.85rem',
                    fontWeight: 700,
                  }}
                >
                  End Turn
                </button>
              ) : undefined}
            />
          </div>

          {activeView?.kind === 'player' && linkedSeat ? (
            <PlayerLinkedViewStage title={linkedSeat.name} onBack={() => setActiveViewId(project.views.defaultViewId)}>
              {renderPlayerView(linkedZoneIds, 'No player resources yet.')}
            </PlayerLinkedViewStage>
          ) : (
            <div
              style={{
                minHeight: '520px',
                display: 'grid',
                gridTemplateRows: '1fr auto',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  borderRadius: '30px',
                  background: 'linear-gradient(160deg, rgba(16,185,129,0.16), rgba(14,165,233,0.08), rgba(250,204,21,0.12))',
                  border: '1px solid rgba(15,118,110,0.12)',
                  display: 'grid',
                  minHeight: '420px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', minHeight: '0' }}>
                  {renderMainBoard()}
                </div>
              </div>

              {renderSupportDock()}
            </div>
          )}

          <GameSurfacePopup
            open={showStartPopup && !hasStarted}
            title="Choose how to start this match"
            subtitle="Preview starts on the shared board. For now, manual play lets you control every seat while we finish built-in AI seat support."
          >
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setPlayMode('manual')}
                  style={{
                    textAlign: 'left',
                    borderRadius: '22px',
                    border: playMode === 'manual' ? '2px solid rgba(6,78,59,0.24)' : '1px solid rgba(15,118,110,0.14)',
                    background: playMode === 'manual' ? 'rgba(240,253,244,0.98)' : 'rgba(255,255,255,0.92)',
                    color: '#064e3b',
                    padding: '1rem',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>Play all turns yourself</span>
                  <span style={{ color: '#0f766e', lineHeight: 1.5 }}>
                    Take each seat manually while you test rules, movement, and the shared linked-view flow.
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  onClick={() => setPlayMode('ai')}
                  style={{
                    textAlign: 'left',
                    borderRadius: '22px',
                    border: '1px solid rgba(15,118,110,0.14)',
                    background: 'rgba(248,250,252,0.96)',
                    color: '#94a3b8',
                    padding: '1rem',
                    display: 'grid',
                    gap: '0.35rem',
                    cursor: 'not-allowed',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.96rem' }}>
                    <Bot size={16} />
                    AI seats coming soon
                  </span>
                  <span style={{ lineHeight: 1.5 }}>
                    Shared seat automation is being wired into the same legal-move-first preview flow.
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowStartPopup(false)}
                  style={{
                    border: '1px solid rgba(15,118,110,0.14)',
                    background: 'rgba(255,255,255,0.88)',
                    borderRadius: '999px',
                    padding: '0.7rem 1rem',
                    color: '#064e3b',
                    fontWeight: 700,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStart}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #064e3b, #10b981)',
                    borderRadius: '999px',
                    padding: '0.7rem 1rem',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  <UserRound size={16} />
                  Start Playing
                </button>
              </div>
            </div>
          </GameSurfacePopup>
        </div>
      </GamePreviewWindow>
    </div>
  );
}
