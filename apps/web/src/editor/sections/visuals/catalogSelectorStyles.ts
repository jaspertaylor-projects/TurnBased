import type { CSSProperties } from 'react';

export const infoBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#065f46',
  background: 'rgba(236,253,245,0.95)',
  border: '1px solid rgba(15,118,110,0.15)',
  borderRadius: '8px',
  padding: '0.3rem 0.6rem',
};

export const priceBadgeStyle: CSSProperties = {
  ...infoBadgeStyle,
  color: '#92400e',
  background: 'rgba(254,243,199,0.85)',
  border: '1px solid rgba(217,119,6,0.2)',
};

export const sectionDividerStyle: CSSProperties = {
  borderTop: '1px solid rgba(120,95,50,0.14)',
  paddingTop: '0.6rem',
  marginTop: '0.3rem',
};

export const groupTitleStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '0.5rem',
};

export const catalogErrorStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: '#dc2626',
  lineHeight: 1.4,
  marginBottom: '0.3rem',
};
