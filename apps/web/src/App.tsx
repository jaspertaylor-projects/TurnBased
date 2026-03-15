import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import { Home } from './pages/Home'
import { Auth } from './pages/Auth'
import { Settings } from './pages/Settings'
import { Templates } from './pages/Templates'
import { Dashboard } from './pages/Dashboard'
import { Editor } from './pages/Editor'
import { Assets } from './pages/Assets'
import { Play } from './pages/Play'
import { Lobby } from './pages/Lobby'
import { Marketplace } from './pages/Marketplace'

function App() {
  const [route, setRoute] = useState(window.location.hash);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Read route on load
    const onHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    // Check auth on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
        window.removeEventListener('hashchange', onHashChange);
        subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
      await supabase.auth.signOut();
      window.location.hash = '#/';
  }

  const renderRoute = () => {
      if (route.startsWith('#/editor/')) return <Editor />
      if (route.startsWith('#/assets/')) return <Assets />
      if (route.startsWith('#/play/')) return <Play />
      if (route.startsWith('#/lobby')) return <Lobby />
      switch (route) {
          case '#/auth': return <Auth />
          case '#/marketplace': return <Marketplace />
          case '#/settings': return <Settings />
          case '#/templates': return <Templates />
          case '#/dashboard': return <Dashboard />
          default: return <Home />
      }
  }

  const isGuest = session?.user?.is_anonymous;

  return (
    <>
      <nav style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(240,253,244,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="#/" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--text-primary)', marginRight: 'auto' }}>TurnBased.</a>
        
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {session ? (
                <>
                    <a href="#/marketplace" style={{ color: 'var(--text-secondary)' }}>Marketplace</a>
                    <a href="#/lobby" style={{ color: 'var(--text-secondary)' }}>Rooms</a>
                    {!isGuest && <a href="#/dashboard" style={{ color: 'var(--text-secondary)' }}>Dashboard</a>}
                    {!isGuest && <a href="#/settings" style={{ color: 'var(--text-secondary)' }}>Settings</a>}
                    <button 
                         onClick={handleSignOut} 
                         style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', padding: '0.4rem 1rem', borderRadius: '4px' }}
                    >
                         Sign Out
                    </button>
                </>
            ) : (
                <>
                    <a href="#/marketplace" style={{ color: 'var(--text-secondary)' }}>Marketplace</a>
                    <a href="#/lobby" style={{ color: 'var(--text-secondary)' }}>Rooms</a>
                    <a href="#/auth" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '0.5rem 1.25rem', borderRadius: '4px', fontWeight: 'bold' }}>
                         Sign In
                    </a>
                </>
            )}
        </div>
      </nav>
      <main>
        {renderRoute()}
      </main>
    </>
  )
}

export default App
