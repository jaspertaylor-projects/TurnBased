/**
 * Tabletop material design tokens — the single source of truth for the
 * "designing a board game on a premium gaming table" look. Colours are grouped
 * by the physical material they evoke (wood desk, felt play-mat, parchment
 * cards, brass fittings, ink) so the editor reads as one crafted object instead
 * of a web form.
 *
 * Keep new editor chrome referencing these tokens rather than hard-coding
 * hexes, so a palette tweak propagates everywhere.
 */

export const tabletop = {
  // ── Wood (desk / frame / sidebar) ──────────────────────────────────
  wood: {
    deepest: '#241608',
    deep: '#33210f',
    base: '#4a3018',
    mid: '#603d1f',
    light: '#7d5630',
    highlight: '#9a6e3f',
  },

  // ── Felt / baize (play surface under the board) ────────────────────
  felt: {
    deep: '#1f3a2c',
    base: '#274838',
    lit: '#35624b',
  },

  // ── Parchment (inspector cards, panels) ────────────────────────────
  parchment: {
    lit: '#f7efda',
    base: '#f1e6cb',
    deep: '#e7d8b4',
    edge: '#d4bd8f',
    sunken: '#fbf5e6',
  },

  // ── Brass (accents, dividers, active states, fittings) ─────────────
  brass: {
    light: '#d8b977',
    base: '#b8924e',
    deep: '#8a6a33',
    shadow: '#5f481f',
  },

  // ── Ink (text on parchment / wood) ─────────────────────────────────
  ink: {
    strong: '#2c2012',
    base: '#43321d',
    soft: '#6f5836',
    faint: '#9a855e',
    onWood: '#f3e4c6',
    onWoodSoft: 'rgba(243,228,198,0.62)',
  },

  // ── Forest accent (kept brand colour, used for actions/selection) ──
  forest: {
    deep: '#1d4d33',
    base: '#2f6f49',
    bright: '#3f9168',
    teal: '#0f766e',
  },
} as const;

// ── Composite material backgrounds (CSS) ─────────────────────────────

/** Warm walnut wood with vignette + faint grain — the desk surface. */
export const woodSurface = `
  radial-gradient(130% 100% at 50% 0%, rgba(255,225,180,0.10), rgba(0,0,0,0) 55%),
  radial-gradient(120% 120% at 50% 120%, rgba(0,0,0,0.45), rgba(0,0,0,0) 60%),
  repeating-linear-gradient(94deg, rgba(0,0,0,0.05) 0 2px, rgba(255,255,255,0.012) 2px 5px),
  linear-gradient(160deg, ${tabletop.wood.mid}, ${tabletop.wood.base} 45%, ${tabletop.wood.deep})
`;

/** Deep forest felt with a soft central light and fine weave. */
export const feltSurface = `
  radial-gradient(110% 90% at 50% 32%, rgba(180,230,200,0.10), rgba(0,0,0,0) 60%),
  radial-gradient(140% 130% at 50% 110%, rgba(0,0,0,0.40), rgba(0,0,0,0) 62%),
  repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, rgba(255,255,255,0.02) 1px 3px),
  repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0 1px, rgba(255,255,255,0.015) 1px 3px),
  linear-gradient(160deg, ${tabletop.felt.lit}, ${tabletop.felt.base} 55%, ${tabletop.felt.deep})
`;

/** Aged parchment card with a faint warm bloom. */
export const parchmentSurface = `
  radial-gradient(120% 90% at 30% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%),
  linear-gradient(165deg, ${tabletop.parchment.lit}, ${tabletop.parchment.base} 60%, ${tabletop.parchment.deep})
`;

/** Brushed brass gradient for fittings, plaques and active rails. */
export const brassSurface = `linear-gradient(160deg, ${tabletop.brass.light}, ${tabletop.brass.base} 55%, ${tabletop.brass.deep})`;

/** A slim walnut bar for chrome (top toolbar, breadcrumb nameplate, sidebar). */
export const woodBar = `linear-gradient(180deg, ${tabletop.wood.light}, ${tabletop.wood.mid} 48%, ${tabletop.wood.base})`;
/** A taller walnut panel for the sidebar — slightly deeper at the bottom. */
export const woodPanel = `
  radial-gradient(120% 60% at 50% 0%, rgba(255,225,180,0.10), rgba(0,0,0,0) 60%),
  repeating-linear-gradient(2deg, rgba(0,0,0,0.05) 0 3px, rgba(255,255,255,0.012) 3px 9px),
  linear-gradient(180deg, ${tabletop.wood.mid}, ${tabletop.wood.base} 55%, ${tabletop.wood.deep})
`;

/** The ambient editor backdrop: a warm, lamplit room of dark wood so the lit
 *  table and parchment cards pop. */
export const ambientRoom = `
  radial-gradient(120% 95% at 50% -10%, rgba(120,86,48,0.30), rgba(0,0,0,0) 55%),
  radial-gradient(150% 130% at 50% 115%, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%),
  linear-gradient(165deg, ${tabletop.wood.deep}, ${tabletop.wood.deepest})
`;

/** Soft drop shadow tuned for parchment cards resting on the desk. */
export const cardShadow = '0 2px 4px rgba(36,22,8,0.18), 0 14px 30px rgba(36,22,8,0.28)';
/** Inset shadow for "carved into wood / sunken field" inputs. */
export const sunkenShadow = 'inset 0 1px 2px rgba(36,22,8,0.22), inset 0 0 0 1px rgba(255,255,255,0.35)';
