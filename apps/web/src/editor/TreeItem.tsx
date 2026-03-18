import { getBuiltInComponentManifest } from '@turnbased/engine-components';
import type { BuiltInComponentType } from '@turnbased/engine-components';

import type { EditorProject } from './types';

export function TreeItem({
  project,
  instanceId,
  depth,
  selectedId,
  onSelect,
}: {
  project: EditorProject;
  instanceId: string;
  depth: number;
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
}) {
  const instance = project.instances[instanceId];
  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);

  return (
    <div>
      <button
        onClick={() => onSelect(instanceId)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '0.55rem 0.7rem',
          marginTop: depth === 0 ? 0 : '0.3rem',
          borderRadius: '12px',
          border: selectedId === instanceId ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(15,118,110,0.1)',
          background: selectedId === instanceId ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.76)',
          marginLeft: `${depth * 12}px`,
          color: '#064e3b',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{instance.displayName ?? manifest.displayName}</div>
        <div style={{ fontSize: '0.76rem', color: '#0f766e' }}>{instance.componentType}</div>
      </button>
      {instance.children.map((childId) => (
        <TreeItem
          key={childId}
          project={project}
          instanceId={childId}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
