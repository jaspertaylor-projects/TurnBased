/**
 * Tabletop material design tokens — the single source of truth for the
 * "designing a board game on a premium gaming table" look. Colours are grouped
 * by the physical material they evoke (wood desk, felt play-mat, parchment
 * cards, brass fittings, ink) so the editor reads as one crafted object instead
 * of a web form.
 *
 * SCOPE: this material language is intentionally confined to the **component
 * editor**. Other editor sections keep the cozy-forest palette (see
 * `editor/styles.ts`). When styling component-editor inspectors, use the
 * `tabletop*` CSSProperties exports at the bottom of this file instead of the
 * shared cozy primitives.
 */
import type { CSSProperties } from 'react';

export const tabletop = {
  // ── Wood (desk / frame / sidebar) ──────────────────────────────────
  // Desaturated warm-taupe. Kept low-saturation on purpose: this is a
  // colour-critical work surface, so the frame stays close to neutral and
  // doesn't bias the component colours the creator is judging.
  wood: {
    deepest: '#211f1a',
    deep: '#322f28',
    base: '#4a463c',
    mid: '#5d5749',
    light: '#79715f',
    highlight: '#948b76',
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

/** The ambient editor backdrop: a calm, dim, near-neutral warm-charcoal so
 *  the colours on the board read true (a coloured backdrop would bias colour
 *  judgement). A faint warm glow up top keeps it cozy rather than clinical. */
export const ambientRoom = `
  radial-gradient(120% 95% at 50% -10%, rgba(210,196,168,0.12), rgba(0,0,0,0) 55%),
  radial-gradient(150% 130% at 50% 115%, rgba(0,0,0,0.5), rgba(0,0,0,0) 60%),
  linear-gradient(165deg, #383229, #26221c 60%, #1d1a15)
`;

/** Soft drop shadow tuned for parchment cards resting on the desk. */
export const cardShadow = '0 2px 4px rgba(36,22,8,0.18), 0 14px 30px rgba(36,22,8,0.28)';
/** Inset shadow for "carved into wood / sunken field" inputs. */
export const sunkenShadow = 'inset 0 1px 2px rgba(36,22,8,0.22), inset 0 0 0 1px rgba(255,255,255,0.35)';

// ── Component-editor inspector styles (parchment + brass + ink) ───────
// These mirror the shape of the cozy primitives in editor/styles.ts but in
// the tabletop material language. Component-editor inspector files import
// them (often aliased to inputStyle/labelStyle/etc.) so the rest of the app
// keeps its cozy look.

export const tabletopPanel: CSSProperties = {
  background: parchmentSurface,
  border: `1px solid ${tabletop.parchment.edge}`,
  borderRadius: '16px',
  boxShadow: cardShadow,
  padding: '1rem',
};

export const tabletopSectionTitle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: tabletop.brass.deep,
  margin: '0 0 0.7rem 0',
};

export const tabletopLabel: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  color: tabletop.ink.soft,
  fontSize: '0.82rem',
  fontWeight: 600,
};

export const tabletopField: CSSProperties = {
  width: '100%',
  padding: '0.72rem 0.82rem',
  borderRadius: '10px',
  border: `1px solid ${tabletop.parchment.edge}`,
  boxSizing: 'border-box',
  color: tabletop.ink.strong,
  backgroundColor: tabletop.parchment.sunken,
  boxShadow: sunkenShadow,
  fontWeight: 600,
};

export const tabletopTextarea: CSSProperties = {
  ...tabletopField,
  minHeight: '92px',
  resize: 'vertical',
  fontWeight: 500,
  lineHeight: 1.5,
};

export const tabletopMuted: CSSProperties = {
  margin: 0,
  color: tabletop.ink.soft,
  lineHeight: 1.6,
};
