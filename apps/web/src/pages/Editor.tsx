import { useState, useEffect } from 'react';

const mockListTree = async () => ['index.html', 'src/main.ts', 'src/game/reducer.ts'];
const mockReadFile = async (path: string) => {
    const files: Record<string, string> = {
        'index.html': '<html>\n  <body>\n    <h1>TurnBased Game</h1>\n  </body>\n</html>',
        'src/main.ts': 'console.log("Game Loaded!");',
        'src/game/reducer.ts': 'export const reducer = (state, action) => state;'
    };
    return files[path] || '';
};

export const Editor = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState('');

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Extract ProjectID from route hash
  useEffect(() => {
    const hash = window.location.hash;
    const parts = hash.split('/');
    if (parts.length > 2) {
      setProjectId(parts[2]);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      mockListTree().then(setFiles);
    }
  }, [projectId]);

  const openFile = async (path: string) => {
    setActiveFile(path);
    const data = await mockReadFile(path);
    setContent(data);
  };

  const handleCommit = () => {
    alert(`Committed changes -> ${commitMessage}`);
    setCommitMessage('');
  };

  const handleAskAI = async () => {
    setLoadingAi(true);
    setAiSuggestion(null);
    try {
      // Simulate calling /ai/code-agent Edge Function
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiSuggestion(`// AI Suggestion based on your prompt:\n// -> ${aiPrompt}\n\nfunction newFeature() {\n  console.log("implemented");\n}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion) {
        setContent(content + '\n' + aiSuggestion);
        setAiSuggestion(null);
        setShowAiPanel(false);
    }
  };

  if (!projectId) return <div>Loading Project ID...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', position: 'relative' }}>
      {/* File Tree Pane */}
      <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '1rem', background: '#f9fafb' }}>
        <h3>Files</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {files.map(f => (
            <li 
              key={f} 
              onClick={() => openFile(f)}
              style={{ padding: '0.5rem', cursor: 'pointer', background: activeFile === f ? '#e5e7eb' : 'transparent', borderRadius: '4px' }}
            >
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Code Editor Pane */}
      <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Editor: {activeFile || 'No file selected'}</h3>
            {activeFile && (
                <button 
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  style={{ padding: '0.5rem 1rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✨ Ask AI Agent
                </button>
            )}
        </div>
        <textarea 
          style={{ flex: 1, width: '100%', padding: '1rem', fontFamily: 'monospace', fontSize: '14px', resize: 'none', marginTop: '1rem' }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!activeFile}
          placeholder={activeFile ? "Edit code here..." : "Select a file from the tree to edit"}
        />
      </div>

      {/* AI Panel Overlay (Mock UI) */}
      {showAiPanel && (
          <div style={{ position: 'absolute', top: '10%', left: '30%', right: '30%', backgroundColor: 'white', border: '1px solid #ccc', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '2rem', borderRadius: '8px', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>AI Code Agent</h3>
                  <button onClick={() => setShowAiPanel(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <textarea 
                      placeholder="E.g. Add a health property to the player model..."
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      style={{ height: '100px', padding: '0.5rem', fontFamily: 'sans-serif' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <select style={{ padding: '0.5rem' }}>
                          <option value="anthropic/claude-3-haiku">Claude 3 Haiku (Free Tier)</option>
                          <option value="anthropic/claude-3-sonnet" disabled>Claude 3 Sonnet (Pro Required)</option>
                      </select>
                      <button 
                          onClick={handleAskAI} 
                          disabled={!aiPrompt || loadingAi}
                          style={{ padding: '0.5rem 1.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                          {loadingAi ? 'Thinking...' : 'Generate Edit'}
                      </button>
                  </div>
              </div>

              {aiSuggestion && (
                  <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      <h4>Proposed Changes:</h4>
                      <pre style={{ overflowX: 'auto', background: '#e2e8f0', padding: '1rem', fontSize: '12px' }}>
                          {aiSuggestion}
                      </pre>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setAiSuggestion(null)} style={{ padding: '0.5rem 1rem' }}>Reject</button>
                          <button onClick={applyAiSuggestion} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Accept & Apply</button>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Git Changes Pane */}
      <div style={{ width: '300px', borderLeft: '1px solid #ccc', padding: '1rem', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
        <h3>Source Control</h3>
        <p style={{ fontSize: '14px', color: '#555' }}>Tracked edits will appear here.</p>
        
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea 
                placeholder="Commit message" 
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                style={{ height: '80px', padding: '0.5rem', resize: 'none' }}
            />
            <button 
                onClick={handleCommit}
                disabled={!commitMessage}
                style={{ padding: '0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                Commit Changes
            </button>
        </div>
      </div>
    </div>
  );
}
