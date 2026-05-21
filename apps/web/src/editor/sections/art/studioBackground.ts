import type { CSSProperties } from 'react';

export const STUDIO_BG_VALUE = `
  radial-gradient(ellipse 80% 60% at 20% 10%, rgba(45,106,79,0.12) 0%, transparent 60%),
  radial-gradient(ellipse 70% 50% at 85% 30%, rgba(180,145,60,0.10) 0%, transparent 55%),
  radial-gradient(ellipse 90% 70% at 50% 90%, rgba(27,67,50,0.10) 0%, transparent 60%),
  radial-gradient(ellipse 50% 40% at 70% 70%, rgba(200,160,50,0.06) 0%, transparent 50%),
  linear-gradient(175deg, rgba(240,253,244,0.95) 0%, rgba(254,252,232,0.5) 40%, rgba(236,253,245,0.7) 100%)
`;

export const STUDIO_BG_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background: STUDIO_BG_VALUE,
};
