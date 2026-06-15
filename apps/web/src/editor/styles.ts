import type { CSSProperties } from 'react';

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

export const panelStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(16,185,129,0.14)',
  borderRadius: '20px',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
  padding: '1rem',
  backdropFilter: 'blur(12px)',
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#0f766e',
  margin: '0 0 0.7rem 0',
};

export const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  color: '#0f766e',
  fontSize: '0.84rem',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: '12px',
  border: '1px solid rgba(15,118,110,0.12)',
  boxSizing: 'border-box',
  color: '#064e3b',
  background: 'rgba(255,255,255,0.9)',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '92px',
  resize: 'vertical',
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#0f766e',
  lineHeight: 1.6,
};
