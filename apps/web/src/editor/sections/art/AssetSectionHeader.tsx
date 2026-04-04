import { Plus } from 'lucide-react';

export function AssetSectionHeader({
  title,
  description,
  onAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: '0.18rem' }}>
        <div style={{ color: '#064e3b', fontWeight: 800 }}>{title}</div>
        <div style={{ color: '#0f766e', fontSize: '0.8rem', lineHeight: 1.45 }}>{description}</div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          borderRadius: '999px',
          border: '1px solid rgba(15,118,110,0.14)',
          background: 'rgba(240,253,244,0.94)',
          color: '#065f46',
          padding: '0.55rem 0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <Plus size={14} />
        Add
      </button>
    </div>
  );
}
