interface BuildEmbedViewProps {
  buildUrl: string;
  targetId: string;
}

export function BuildEmbedView({ buildUrl, targetId }: BuildEmbedViewProps) {
  return (
    <div style={{ width: '100vw', height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1e293b', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', color: 'white', alignItems: 'center' }}>
        <div>
          <strong>Published Build</strong>
          <span style={{ marginLeft: '1rem', fontSize: '0.84rem', color: '#cbd5e1' }}>Build {targetId}</span>
        </div>
        <button
          onClick={() => { window.location.hash = '#/dashboard'; }}
          style={{ background: 'transparent', color: 'white', border: '1px solid #475569', borderRadius: '4px', padding: '0.35rem 0.8rem' }}
        >
          Back
        </button>
      </div>
      <iframe
        src={buildUrl}
        sandbox="allow-scripts allow-pointer-lock allow-fullscreen"
        style={{ flex: 1, border: 'none', background: 'white' }}
        title="Published Build"
      />
    </div>
  );
}
