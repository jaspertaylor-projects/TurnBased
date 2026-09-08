import { useState, useEffect } from 'react';
import { Leaf, Plus, Settings as SettingsIcon } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { Settings } from './pages/Settings';
import { Dashboard } from './pages/Dashboard';
import { Editor } from './pages/Editor';
import { Assets } from './pages/Assets';
import { Play } from './pages/Play';
import { Lobby } from './pages/Lobby';
import { Marketplace } from './pages/Marketplace';
import { CreateBlankProject } from './pages/CreateBlankProject';
import { CreateGame } from './pages/CreateGame';
import './components/workshop/workshop.css';
import { usePageZoomLock } from './usePageZoomLock';

const APP_NAV_HEIGHT = 88;

function isLandingRoute(route: string) {
  return route === '' || route === '#/';
}

function App() {
  const [route, setRoute] = useState(window.location.hash);
  const [session, setSession] = useState<Session | null>(null);
  const isLanding = isLandingRoute(route);

  usePageZoomLock();

  useEffect(() => {
    // Read route on load
    const onHashChange = () => {
      const nextRoute = window.location.hash || '#/';
      if (nextRoute === '#/templates') {
        window.location.hash = '#/new';
        return;
      }
      setRoute(nextRoute);
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    // Check auth on load
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .catch(() => setSession(null));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    if (isLanding) {
      html.style.overflow = '';
      body.style.overflow = '';
    } else {
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    }

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [isLanding]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.hash = '#/';
  };

  const renderRoute = () => {
    if (route.startsWith('#/editor/')) return <Editor />;
    if (route.startsWith('#/assets/')) return <Assets />;
    if (route.startsWith('#/play/')) return <Play />;
    if (route.startsWith('#/lobby')) return <Lobby />;
    switch (route) {
      case '#/auth':
        return <Auth />;
      case '#/new':
        return <CreateGame />;
      case '#/new/guided':
        return <CreateBlankProject />;
      case '#/marketplace':
        return <Marketplace />;
      case '#/settings':
        return <Settings />;
      case '#/dashboard':
        return <Dashboard />;
      default:
        return <Home />;
    }
  };

  const isGuest = session?.user?.is_anonymous;

  return (
    <>
      <nav className="workshop-nav" aria-label="Main navigation">
        <a href="#/" className="workshop-wordmark" aria-label="TurnBased home">
          <Leaf size={23} strokeWidth={1.6} />
          TurnBased<span>.</span>
        </a>
        <div data-layout="primaryNavigation" className="workshop-nav__links">
          <a
            href="#/dashboard"
            className="workshop-nav__link"
            aria-current={route === '#/dashboard' ? 'page' : undefined}
          >
            My workshop
          </a>
          <a
            href="#/new"
            className="workshop-button workshop-button--primary"
            aria-current={route === '#/new' ? 'page' : undefined}
          >
            <Plus size={15} /> New game
          </a>
        </div>
        <div data-layout="accountNavigation" className="workshop-nav__account">
          <a href="#/settings" className="workshop-nav__settings" aria-label="Settings" title="Settings">
            <SettingsIcon size={17} />
          </a>
          {session && !isGuest ? (
            <button onClick={() => void handleSignOut()}>Sign out</button>
          ) : (
            <a href="#/auth" className="workshop-nav__link">
              Sign in
            </a>
          )}
        </div>
      </nav>
      <main
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          height: isLanding ? 'auto' : `calc(100vh - ${APP_NAV_HEIGHT}px)`,
          overflow: isLanding ? 'visible' : 'hidden',
        }}
      >
        {renderRoute()}
      </main>
    </>
  );
}

export default App;
