interface ZoneShape {
  id: string;
  name: string;
  entityIds: string[];
  ownerId?: string | null;
}

interface EntityShape {
  id: string;
  properties: Record<string, unknown>;
  componentType: string;
  ownerId?: string | null;
}

interface ZoneAffordance {
  selected?: boolean;
  highlighted?: boolean;
  dropTarget?: boolean;
  interactable?: boolean;
}

interface EntityAffordance {
  selected?: boolean;
  highlighted?: boolean;
  dragSource?: boolean;
  interactable?: boolean;
}

interface ZoneCardProps {
  zone: ZoneShape;
  entities: Record<string, EntityShape>;
  players: Record<string, { displayName: string }>;
  zoneState?: ZoneAffordance | null;
  entityStates?: Record<string, EntityAffordance | null | undefined>;
  getSeatColor: (ownerId: string | null | undefined) => string;
  onZoneClick: () => void;
  onEntityClick: (entityId: string) => void;
}

export function ZoneCard({
  zone,
  entities,
  players,
  zoneState,
  entityStates,
  getSeatColor,
  onZoneClick,
  onEntityClick,
}: ZoneCardProps) {
  return (
    <div
      onClick={onZoneClick}
      style={{
        borderRadius: '20px',
        border: zoneState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
        background: zoneState?.highlighted || zoneState?.dropTarget ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.86)',
        padding: '1rem',
        cursor: zoneState?.interactable ? 'pointer' : 'default',
        minHeight: '160px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
        <div>
          <h3 style={{ margin: 0 }}>{zone.name}</h3>
          <div style={{ marginTop: '0.25rem', color: '#0f766e', fontSize: '0.84rem' }}>
            {zone.entityIds.length} piece{zone.entityIds.length === 1 ? '' : 's'}
          </div>
        </div>
        {zone.ownerId && (
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '999px',
            background: getSeatColor(zone.ownerId),
            border: '1px solid rgba(15,23,42,0.12)',
          }} />
        )}
      </div>

      <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.9rem' }}>
        {zone.entityIds.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No pieces here yet.</div>
        )}
        {zone.entityIds.map((entityId) => {
          const entity = entities[entityId];
          const entityState = entityStates?.[entityId];
          const label = String(entity.properties.label ?? entity.id);

          return (
            <button
              key={entity.id}
              onClick={(event) => {
                event.stopPropagation();
                onEntityClick(entity.id);
              }}
              style={{
                textAlign: 'left',
                padding: '0.75rem 0.85rem',
                borderRadius: '14px',
                border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.12)',
                background: entityState?.highlighted || entityState?.dragSource ? 'rgba(14,165,233,0.14)' : 'rgba(248,250,252,0.92)',
                color: '#064e3b',
                cursor: entityState?.interactable ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <strong>{label}</strong>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: getSeatColor(entity.ownerId),
                  border: '1px solid rgba(15,23,42,0.12)',
                }} />
              </div>
              <div style={{ color: '#0f766e', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                {entity.componentType} · owner {players[entity.ownerId ?? '']?.displayName ?? 'neutral'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
