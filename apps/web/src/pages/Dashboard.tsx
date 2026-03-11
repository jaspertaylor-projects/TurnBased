

// Mock data until Supabase client is connected
const MOCK_PROJECTS = [
  { id: '1', name: 'My First Game', created_at: new Date().toISOString() },
];

export const Dashboard = () => {
    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>My Projects</h1>
                <a href="#/templates" style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                    + New Project
                </a>
            </div>

            <div style={{ marginTop: '2rem' }}>
                {MOCK_PROJECTS.length === 0 ? (
                    <p>No projects found. Create one from a template!</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {MOCK_PROJECTS.map(proj => (
                            <div key={proj.id} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{proj.name}</h3>
                                    <span style={{ fontSize: '0.875rem', color: '#666' }}>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
                                </div>
                                <button style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Open Editor
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
