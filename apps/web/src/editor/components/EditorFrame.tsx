import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EditorSection } from '../constants';

export function EditorFrame({ busy, activeSection, isSidebarOpen, onToggleSidebar, sidebar, children }: {
  busy: boolean;
  activeSection: EditorSection;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const framed = activeSection === 'stats' || activeSection === 'app_layout';
  return (
    <div data-layout="editorShell" className="editor-shell" style={{ position: 'relative', display: 'grid', gridTemplateColumns: isSidebarOpen ? '232px minmax(0,1fr)' : '0px minmax(0,1fr)', height: '100%', minHeight: 0, overflow: 'hidden', transition: 'grid-template-columns 0.2s ease', background: '#f5f0e5' }}>
      <div inert={busy || undefined} data-layout="editorSidebarDrawer" style={{ position: 'relative', height: '100%', minWidth: 0, overflow: 'hidden' }}>{sidebar}</div>
      <button disabled={busy} type="button" data-layout="editorSidebarToggle" aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'} aria-expanded={isSidebarOpen} onClick={onToggleSidebar} style={{ position: 'absolute', top: 16, left: isSidebarOpen ? 216 : 0, zIndex: 60, width: 22, height: 46, padding: 0, background: '#214e3b', color: '#f9efd6', border: '1px solid #476d4a', borderRadius: '0 9px 9px 0', display: 'grid', placeItems: 'center', transition: 'left 0.2s ease' }}>
        {isSidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
      <div inert={busy || undefined} id="editor-viewport" data-layout="editorViewport" style={{ minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: framed ? '24px 30px' : 0 }}>
        {children}
      </div>
      {busy && <div role="status" data-layout="checkpointBusyOverlay" style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(246,243,231,.78)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(2px)', color: '#31543e', fontWeight: 700 }}>Securing your checkpoint…</div>}
    </div>
  );
}
