import { useState } from 'react';

// Mock data until Supabase client is connected
const MOCK_TEMPLATES = [
  { id: '1', name: 'Basic Board Game', description: 'A starter kit for standard turn-based board games.' },
  { id: '2', name: 'Card Game Starter', description: 'Deck management and hand state defaults.' },
];

export const Templates = () => {
  const [loading, setLoading] = useState(false);

  const handleCreateProject = async (templateId: string) => {
    setLoading(true);
    try {
      // Mocked API call mirroring the Edge Function payload
      console.log(`Creating project from template ${templateId}`);
      alert(`Simulation: Sent request to /git/create-project-from-template`);
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Choose a Template</h1>
      <p>Start your new project from an existing blueprint.</p>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
        {MOCK_TEMPLATES.map((tmpl) => (
          <div key={tmpl.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', width: '300px' }}>
            <h3>{tmpl.name}</h3>
            <p style={{ color: '#555' }}>{tmpl.description}</p>
            <button 
              onClick={() => handleCreateProject(tmpl.id)}
              disabled={loading}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Creating...' : 'Use Template'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
