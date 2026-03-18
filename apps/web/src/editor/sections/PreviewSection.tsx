import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Blocks, Eye, LayoutPanelTop } from 'lucide-react';
import type { CompiledLegalMoveTree, GameState } from '@turnbased/engine-core';
import type { UIAffordanceState, UISelectionState } from '@turnbased/engine-ui';

import { getOwnerColor } from '../helpers';
import { renderIcon } from '../iconography';
import { mutedTextStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

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
  onExecuteMove: (actionId: string) => void;
  onSetSelection: (selection: UISelectionState) => void;
  onEntityClick: (entityId: string) => void;
  onZoneClick: (zoneId: string) => void;
}) {
  const [activeViewId, setActiveViewId] = useState(project.views.selectedViewId || project.views.defaultViewId);

  useEffect(() => {
    setActiveViewId(project.views.selectedViewId || project.views.defaultViewId);
  }, [project.id, project.views.defaultViewId, project.views.selectedViewId]);

  const viewMap = useMemo(
    () => new Map(project.views.items.map((view) => [view.id, view])),
    [project.views.items],
  );
  const activeView = viewMap.get(activeViewId) ?? viewMap.get(project.views.defaultViewId) ?? project.views.items[0];
  const linkedSeat = activeView?.linkedSeatId
    ? project.seats.find((seat) => seat.id === activeView.linkedSeatId) ?? null
    : null;
  const sharedZoneIds = topLevelSupportZones.filter((instanceId) => !project.instances[instanceId]?.bindings.ownerId);
  const linkedZoneIds = linkedSeat
    ? topLevelSupportZones.filter((instanceId) => project.instances[instanceId]?.bindings.ownerId === linkedSeat.id)
    : [];

  function countSeatResources(seatId: string): number {
    if (!previewState) {
      return project.seats.find((seat) => seat.id === seatId)?.resources.startingBlocks ?? 0;
    }

    return Object.values(previewState.entities).filter((entity) => entity.ownerId === seatId).length;
  }

  function renderPreviewEntityChips(zoneId: string) {
    if (!previewState) {
      return null;
    }

    const entityIds = previewState.zones[zoneId]?.entityIds ?? [];
    if (entityIds.length === 0) {
      return <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>Empty</span>;
    }

    return entityIds.map((entityId) => {
      const entity = previewState.entities[entityId];
      const entityState = affordances?.entityStates[entityId];

      return (
        <button
          key={entityId}
          onClick={() => onEntityClick(entityId)}
          style={{
            border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.2)',
            background: entityState?.interactable ? 'rgba(16,185,129,0.15)' : 'rgba(240,253,244,0.9)',
            borderRadius: '999px',
            padding: '0.4rem 0.75rem',
            color: '#064e3b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: entityState?.interactable ? 'pointer' : 'default',
          }}
        >
          <span
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '999px',
              background: getOwnerColor(project, entity.ownerId),
              display: 'inline-block',
            }}
          />
          <span>{String(entity.properties.label ?? entity.type)}</span>
        </button>
      );
    });
  }

  function renderPreviewZoneCard(instanceId: string) {
    if (!previewState) {
      return null;
    }

    const instance = project.instances[instanceId];
    const zoneState = affordances?.zoneStates[instanceId];
    const selected = selection.selectedZoneId === instanceId;
    const zone = previewState.zones[instanceId];

    return (
      <button
        key={instanceId}
        onClick={() => onZoneClick(instanceId)}
        style={{
          width: '100%',
          textAlign: 'left',
          borderRadius: '18px',
          border: zoneState?.dropTarget || selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.18)',
          background: zoneState?.highlighted ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.82)',
          padding: '0.85rem',
          boxSizing: 'border-box',
          cursor: zoneState?.interactable || selection.selectedEntityId ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#064e3b' }}>{zone?.name ?? instance.displayName}</div>
            <div style={{ fontSize: '0.82rem', color: '#0f766e' }}>{instance.componentType}</div>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#0f766e' }}>
            {zone?.entityIds.length ?? 0}
            {zone?.maxCapacity !== null ? ` / ${zone?.maxCapacity}` : ''}
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', minHeight: '2rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {renderPreviewEntityChips(instanceId)}
        </div>
      </button>
    );
  }

  function renderBoardCollection() {
    if (boardInstances.length === 0) {
      return (
        <div style={{ padding: '2rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.25)', textAlign: 'center', color: '#0f766e' }}>
          Add a board or a zone in the Visuals section to preview gameplay.
        </div>
      );
    }

    return boardInstances.map((boardId) => {
      const board = project.instances[boardId];
      const width = Number(board.properties.width ?? 3) || 3;
      const spaces = board.children.filter((childId) => project.instances[childId]?.componentType === 'space');
      const nestedZones = board.children.filter((childId) => project.instances[childId]?.componentType !== 'space');

      return (
        <div key={boardId} style={{ borderRadius: '24px', padding: '1rem', background: 'linear-gradient(145deg, rgba(16,185,129,0.12), rgba(250,204,21,0.10))' }}>
          <div style={{ marginBottom: '0.9rem' }}>
            <div style={{ fontWeight: 800, color: '#064e3b' }}>{String(board.properties.label ?? board.displayName ?? 'Board')}</div>
            <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>shared board · {width} columns</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gap: '0.75rem' }}>
            {spaces.map((spaceId) => renderPreviewZoneCard(spaceId))}
          </div>

          {nestedZones.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {nestedZones.map((zoneId) => renderPreviewZoneCard(zoneId))}
            </div>
          )}
        </div>
      );
    });
  }

  function renderZoneCollection(zoneIds: string[], emptyMessage: string) {
    if (zoneIds.length === 0) {
      return (
        <div style={{ padding: '1.2rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.25)', textAlign: 'center', color: '#0f766e' }}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {zoneIds.map((instanceId) => renderPreviewZoneCard(instanceId))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <p style={sectionTitleStyle}>Live Preview</p>
            <h2 style={{ margin: 0 }}>{project.appLayout.shellTitle || project.name}</h2>
            <p style={{ ...mutedTextStyle, marginTop: '0.45rem' }}>{project.appLayout.introText}</p>
          </div>

          <button
            onClick={onResetPreview}
            style={{
              border: '1px solid rgba(15,118,110,0.15)',
              background: 'rgba(255,255,255,0.82)',
              borderRadius: '999px',
              padding: '0.55rem 0.9rem',
              color: '#064e3b',
            }}
          >
            Reset Preview
          </button>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          {project.appLayout.hudItems.map((item) => (
            <span key={item} style={{ padding: '0.5rem 0.8rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.82rem' }}>
              {item}
            </span>
          ))}
          <span style={{ padding: '0.5rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.12)', color: '#075985', fontSize: '0.82rem' }}>
            {project.appLayout.linkedViewLabel}: {activeView?.label ?? 'Main Board'}
          </span>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem', color: '#0f766e', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <LayoutPanelTop size={16} />
            {project.appLayout.summaryStripLabel}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {project.seats.map((seat) => {
              const playerView = project.views.items.find((view) => view.linkedSeatId === seat.id);
              const isSelected = activeView?.linkedSeatId === seat.id;
              const resourceCount = countSeatResources(seat.id);

              return (
                <button
                  key={seat.id}
                  onClick={() => setActiveViewId(playerView?.id ?? project.views.defaultViewId)}
                  style={{
                    textAlign: 'left',
                    padding: '0.9rem',
                    borderRadius: '20px',
                    border: isSelected ? '2px solid rgba(6,78,59,0.3)' : '1px solid rgba(15,118,110,0.12)',
                    background: isSelected ? 'rgba(240,253,244,0.95)' : 'rgba(255,255,255,0.82)',
                    display: 'grid',
                    gridTemplateColumns: '48px minmax(0, 1fr) auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${seat.color} 28%, white)` }}>
                    {renderIcon(seat.identity.iconKey, { size: 20, style: { color: '#064e3b' } })}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#064e3b' }}>{seat.name}</div>
                    <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>{resourceCount} {project.appLayout.resourceSummaryLabel.toLowerCase()}</div>
                  </div>
                  <ArrowRightLeft size={16} color="#0f766e" />
                </button>
              );
            })}
          </div>
        </div>

        {previewState && affordances && moveTree ? (
          <>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {project.seats.map((seat) => (
                <div key={seat.id} style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: previewState.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)', color: '#064e3b' }}>
                  {seat.name}: {countSeatResources(seat.id)}
                </div>
              ))}
              <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)', color: '#075985' }}>
                Turn {previewState.turnState.turnNumber} · {previewState.turnState.currentPhase}
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {affordances.availableActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    if (action.kind === 'global') {
                      onExecuteMove(action.id);
                      return;
                    }

                    onSetSelection({
                      ...selection,
                      selectedActionId: action.id,
                    });
                  }}
                  disabled={!action.enabled}
                  style={{
                    borderRadius: '999px',
                    border: action.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.15)',
                    background: action.ready ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.82)',
                    padding: '0.55rem 0.85rem',
                    color: '#064e3b',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p style={{ ...mutedTextStyle, marginTop: '1rem' }}>Build out the structure to unlock the live preview.</p>
        )}
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 0.95fr)' }}>
        <div style={{ ...panelStyle, display: 'grid', gap: '1rem' }}>
          <div>
            <p style={sectionTitleStyle}>{activeView?.kind === 'player' ? project.appLayout.linkedViewLabel : 'Shared View'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeView?.kind === 'player' ? renderIcon(linkedSeat?.identity.iconKey, { size: 18, style: { color: '#064e3b' } }) : <Eye size={18} color="#064e3b" />}
              <h3 style={{ margin: 0, color: '#064e3b' }}>{activeView?.label ?? 'Main Board'}</h3>
            </div>
            <p style={{ ...mutedTextStyle, marginTop: '0.45rem' }}>{activeView?.description ?? 'Live linked view preview.'}</p>
          </div>

          {activeView?.kind === 'player'
            ? renderZoneCollection(linkedZoneIds, 'This player does not have a linked personal area yet.')
            : (
              <>
                {renderBoardCollection()}
                {sharedZoneIds.length > 0 && renderZoneCollection(sharedZoneIds, 'No shared support zones yet.')}
              </>
            )}
        </div>

        <div style={{ ...panelStyle, display: 'grid', gap: '0.9rem', alignContent: 'start' }}>
          <div>
            <p style={sectionTitleStyle}>Shared Shell</p>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {project.appLayout.sidePanels.map((panel) => (
                <div key={panel} style={{ padding: '0.7rem 0.8rem', borderRadius: '16px', background: 'rgba(255,255,255,0.82)', color: '#064e3b', border: '1px solid rgba(15,118,110,0.08)' }}>
                  {panel}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0.9rem', borderRadius: '18px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
              <Blocks size={16} />
              Resource Summary
            </div>
            <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.45rem' }}>
              {project.seats.map((seat) => (
                <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span>{seat.name}</span>
                  <strong>{countSeatResources(seat.id)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0.9rem', borderRadius: '18px', background: 'rgba(239,246,255,0.92)', color: '#155e75' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Board Context</div>
            <div style={{ lineHeight: 1.6 }}>
              Shared boards: {boardInstances.length}
              <br />
              Shared support zones: {sharedZoneIds.length}
              <br />
              Linked player areas: {project.views.items.filter((view) => view.kind === 'player').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
