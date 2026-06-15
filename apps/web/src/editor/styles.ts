import type { CSSProperties } from 'react';

import { tabletop, parchmentSurface, cardShadow, sunkenShadow } from './theme/tabletop';

/** Root layout for editor pages — flex row that fills the main content area. */
export const pageStyle: CSSProperties = {
  flex: '1 1 0',
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0,
  padding: 0,
  alignItems: 'flex-start',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  maxWidth: '100vw',
};

/** A parchment card resting on the desk — the default surface for panels and
 *  inspector sections. */
export const panelStyle: CSSProperties = {
  background: parchmentSurface,
  border: `1px solid ${tabletop.parchment.edge}`,
  borderRadius: '16px',
  boxShadow: cardShadow,
  padding: '1rem',
};

/** Small engraved-brass section heading. */
export const sectionTitleStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: tabletop.brass.deep,
  margin: '0 0 0.7rem 0',
};

export const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  color: tabletop.ink.soft,
  fontSize: '0.82rem',
  fontWeight: 600,
};

/** A field "carved" into the parchment — sunken cream with an inset shadow. */
export const inputStyle: CSSProperties = {
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

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '92px',
  resize: 'vertical',
  fontWeight: 500,
  lineHeight: 1.5,
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: tabletop.ink.soft,
  lineHeight: 1.6,
};
