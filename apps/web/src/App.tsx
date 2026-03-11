import { useState, useEffect } from 'react'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { Templates } from './pages/Templates'
import { Dashboard } from './pages/Dashboard'
import { Editor } from './pages/Editor'
import { Assets } from './pages/Assets'

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const renderRoute = () => {
      if (route.startsWith('#/editor/')) return <Editor />
      if (route.startsWith('#/assets/')) return <Assets />
      switch (route) {
          case '#/settings': return <Settings />
          case '#/templates': return <Templates />
          case '#/dashboard': return <Dashboard />
          default: return <Home />
      }
  }

  return (
    <>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', gap: '1rem' }}>
        <a href="#/">Home</a>
        <a href="#/dashboard">Dashboard</a>
        <a href="#/templates">Templates</a>
        <a href="#/settings">Settings</a>
      </nav>
      <main>
        {renderRoute()}
      </main>
    </>
  )
}

export default App
