import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { STUDIO_BG_STYLE } from './studioBackground';

/**
 * Bounded shell used by every Art sub-page. Three flex regions, all anchored
 * to the section's viewport slot (Rule 4 in .agents/goldenrules.md):
 *
 *   - header  (flex: 0 0 auto)  back-bar + title, pinned at the top
 *   - body    (flex: 1 1 auto)  the only region that scrolls
 *   - footer  (flex: 0 0 auto)  optional persistent space pinned at the bottom
 *
 * The shell itself uses overflow: hidden — it does NOT scroll. Children sent
 * via `children` flow inside the scrollable body without needing their own
 * scroll wrapper.
 */
export function SubPageShell({
  title,
  icon,
  onBack,
  actions,
  footer,
  children,
}: {
  title: string;
  icon: ReactNode;
  onBack: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-layout="subPageShellRoot"
      /* bounded shell — see goldenrules Rule 4 */
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={STUDIO_BG_STYLE} />

      <div
        data-layout="subPageShellHeader"
        /* pinned top: back-bar + title; stays visible while the body scrolls */
        style={{ position: 'relative', zIndex: 1, flex: '0 0 auto', maxWidth: '780px', width: '100%', margin: '0 auto', padding: '0.5rem 0.5rem 0 0.5rem', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0 1rem 0' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              border: 'none', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
              borderRadius: '999px', padding: '0.45rem 0.8rem', color: '#064e3b',
              fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(6,78,59,0.06)',
            }}
          >
            <ArrowLeft size={14} /> Art
          </button>
          <div style={{ flex: 1 }} />
          {actions}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#0d9488' }}>{icon}</span>
          <span style={{ color: '#064e3b', fontWeight: 800, fontSize: '1.15rem' }}>{title}</span>
        </div>
      </div>

      <div
        data-layout="subPageShellBody"
        /* the only region that scrolls — children render here */
        style={{ position: 'relative', zIndex: 1, flex: '1 1 auto', minHeight: 0, overflow: 'auto', maxWidth: '780px', width: '100%', margin: '0 auto', padding: '0.5rem 0.5rem 1rem 0.5rem', boxSizing: 'border-box' }}
      >
        {children}
      </div>

      {footer ? (
        <div
          data-layout="subPageShellFooter"
          /* pinned bottom: persistent space anchored to the viewport, never
             scrolls. Width matches the body's centered column so the footer
             reads as part of the same surface. */
          style={{ position: 'relative', zIndex: 1, flex: '0 0 auto', maxWidth: '780px', width: '100%', margin: '0 auto', padding: '0 0.5rem 0.5rem 0.5rem', boxSizing: 'border-box' }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
