import type { ComponentInstanceModel } from '@turnbased/engine-components';

import { getOwnerColor } from '../helpers';
import { panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

export function VisualsSection({
  project,
  boardInstances,
  topLevelSupportZones,
  selectedComponentId,
  selectedComponent,
  onSelectComponent,
}: {
  project: EditorProject;
  boardInstances: string[];
  topLevelSupportZones: string[];
  selectedComponentId: string | null;
  selectedComponent: ComponentInstanceModel | null;
  onSelectComponent: (instanceId: string | null) => void;
}) {
  function renderVisualEntityChips(zoneId: string) {
    const zoneInstance = project.instances[zoneId];
    const entityIds = zoneInstance.children.filter((childId) => {
      const child = project.instances[childId];
      return child?.componentType === 'piece' || child?.componentType === 'token';
    });

    if (entityIds.length === 0) {
      return <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>No pieces here yet.</span>;
    }

    return entityIds.map((entityId) => {
      const entity = project.instances[entityId];
      const isSelected = selectedComponentId === entityId;
      return (
        <button
          key={entityId}
          onClick={(event) => {
            event.stopPropagation();
            onSelectComponent(entityId);
          }}
          style={{
            border: isSelected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.16)',
            background: 'rgba(240,253,244,0.94)',
            borderRadius: '999px',
            padding: '0.38rem 0.7rem',
            color: '#064e3b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <span
            style={{
              width: '0.72rem',
              height: '0.72rem',
              borderRadius: '999px',
              background: getOwnerColor(project, entity.bindings.ownerId),
              display: 'inline-block',
            }}
          />
          <span>{String(entity.properties.label ?? entity.displayName ?? entity.componentType)}</span>
        </button>
      );
    });
  }

  function renderVisualZoneCard(instanceId: string) {
    const instance = project.instances[instanceId];
    const label = String(instance.properties.label ?? instance.displayName ?? 'Zone');
    const isSelected = selectedComponentId === instanceId;

    return (
      <button
        key={instanceId}
        onClick={() => onSelectComponent(instanceId)}
        style={{
          width: '100%',
          textAlign: 'left',
          borderRadius: '18px',
          border: isSelected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.18)',
          background: 'rgba(255,255,255,0.88)',
          padding: '0.85rem',
          boxSizing: 'border-box',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#064e3b' }}>{label}</div>
            <div style={{ fontSize: '0.82rem', color: '#0f766e' }}>{instance.componentType}</div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#0f766e' }}>{instance.children.length} items</div>
        </div>
        <div style={{ marginTop: '0.75rem', minHeight: '2rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {renderVisualEntityChips(instanceId)}
        </div>
      </button>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ ...panelStyle, display: 'grid', gap: '1rem' }}>
        <div>
          <p style={sectionTitleStyle}>Visual</p>
          <h2 style={{ margin: 0 }}>Board and zone surface</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <span style={{ padding: '0.42rem 0.7rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.82rem' }}>
            {project.rootInstanceIds.length} root components
          </span>
          <span style={{ padding: '0.42rem 0.7rem', borderRadius: '999px', background: 'rgba(14,165,233,0.12)', color: '#155e75', fontSize: '0.82rem' }}>
            {boardInstances.length} boards
          </span>
          <span style={{ padding: '0.42rem 0.7rem', borderRadius: '999px', background: 'rgba(250,204,21,0.16)', color: '#854d0e', fontSize: '0.82rem' }}>
            {topLevelSupportZones.length} support zones
          </span>
          {selectedComponent && (
            <span style={{ padding: '0.42rem 0.7rem', borderRadius: '999px', background: 'rgba(249,115,22,0.14)', color: '#9a3412', fontSize: '0.82rem' }}>
              Selected {selectedComponent.displayName ?? selectedComponent.componentType}
            </span>
          )}
        </div>

        {boardInstances.map((boardId) => {
          const board = project.instances[boardId];
          const width = Number(board.properties.width ?? 3) || 3;
          const spaces = board.children.filter((childId) => project.instances[childId]?.componentType === 'space');
          const nestedZones = board.children.filter((childId) => project.instances[childId]?.componentType !== 'space');
          const boardSelected = selectedComponentId === boardId;

          return (
            <div
              key={boardId}
              style={{
                borderRadius: '24px',
                padding: '1rem',
                background: 'linear-gradient(145deg, rgba(16,185,129,0.12), rgba(250,204,21,0.10))',
                border: boardSelected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.08)',
              }}
            >
              <button
                onClick={() => onSelectComponent(boardId)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  textAlign: 'left',
                  marginBottom: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, color: '#064e3b' }}>{String(board.properties.label ?? board.displayName ?? 'Board')}</div>
                <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>grid board · {width} columns</div>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gap: '0.75rem' }}>
                {spaces.map((spaceId) => renderVisualZoneCard(spaceId))}
              </div>

              {nestedZones.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {nestedZones.map((zoneId) => renderVisualZoneCard(zoneId))}
                </div>
              )}
            </div>
          );
        })}

        {topLevelSupportZones.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {topLevelSupportZones.map((instanceId) => renderVisualZoneCard(instanceId))}
          </div>
        )}

        {boardInstances.length === 0 && topLevelSupportZones.length === 0 && (
          <div style={{ padding: '2rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.25)', textAlign: 'center', color: '#0f766e' }}>
            Build with AI to generate a board or add layout components in the component editor.
          </div>
        )}
      </div>
    </div>
  );
}
