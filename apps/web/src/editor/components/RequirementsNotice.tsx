import { panelStyle, sectionTitleStyle } from '../styles';

export function RequirementsNotice({ requirements }: { requirements: string[] }) {
  if (requirements.length === 0) {
    return null;
  }

  return (
    <div style={{ ...panelStyle, background: 'rgba(255,251,235,0.92)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <p style={sectionTitleStyle}>Needs Attention</p>
      <p style={{ margin: 0, color: '#92400e', lineHeight: 1.6 }}>{requirements.join(' ')}</p>
    </div>
  );
}
