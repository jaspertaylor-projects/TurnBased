import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface LinkedSeatSummaryItem {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  summary: string;
  active?: boolean;
  onSelect?: () => void;
}

export interface LinkedSeatSummaryStripProps {
  title?: string;
  items: readonly LinkedSeatSummaryItem[];
}

export interface LinkedViewStageProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export interface GamePreviewWindowProps {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export interface GameTableHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export interface GameSurfacePopupProps {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export interface GameInfoPanelProps {
  label: string;
  value: string;
  action?: ReactNode;
}

export interface ResourceDockSection {
  id: string;
  title: string;
  meta?: string;
  accent: string;
  content: ReactNode;
}

export interface ResourceDockProps {
  sections: readonly ResourceDockSection[];
}

export interface PlayerLinkedViewStageProps extends LinkedViewStageProps {
  backLabel?: string;
  onBack?: () => void;
}

const shellStyle: CSSProperties = {
  borderRadius: '28px',
  background:
    'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.14), transparent 22rem), radial-gradient(circle at 80% 10%, rgba(22,163,74,0.14), transparent 24rem), linear-gradient(180deg, #123726, #0b2418)',
  border: '10px solid rgba(9,10,10,0.96)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.32)',
};

function SeatSummaryButton({
  item,
}: {
  item: LinkedSeatSummaryItem;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered || Boolean(item.active);

  return (
    <button
      onClick={item.onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: expanded ? '220px' : '68px',
        maxWidth: expanded ? '260px' : '68px',
        transition: 'all 180ms ease',
        padding: '0.7rem',
        borderRadius: '999px',
        border: item.active ? '2px solid rgba(6,78,59,0.28)' : '1px solid rgba(15,118,110,0.12)',
        background: item.active ? 'rgba(240,253,244,0.98)' : 'rgba(255,255,255,0.88)',
        cursor: item.onSelect ? 'pointer' : 'default',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: '44px',
          height: '44px',
          minWidth: '44px',
          borderRadius: '999px',
          display: 'grid',
          placeItems: 'center',
          background: `color-mix(in srgb, ${item.color} 22%, white)`,
          color: '#064e3b',
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${item.color} 28%, rgba(6,78,59,0.08))`,
        }}
      >
        {item.icon}
      </span>
      <span
        style={{
          display: 'grid',
          gap: '0.15rem',
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateX(0)' : 'translateX(8px)',
          transition: 'all 180ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 800, color: '#064e3b', fontSize: '0.92rem' }}>{item.label}</span>
        <span style={{ color: '#0f766e', fontSize: '0.8rem' }}>{item.summary}</span>
      </span>
    </button>
  );
}

export function LinkedSeatSummaryStrip({
  title = 'Players',
  items,
}: LinkedSeatSummaryStripProps) {
  return (
    <div style={{ padding: 0 }}>
      <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0f766e', marginBottom: '0.75rem' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
        {items.map((item) => (
          <SeatSummaryButton key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function GamePreviewWindow({
  title,
  toolbar,
  children,
}: GamePreviewWindowProps) {
  return (
    <section
      style={{
        ...shellStyle,
        overflow: 'hidden',
      }}
    >
      {title || toolbar ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '1rem 1rem 0.85rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.26)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>{title}</div>
          {toolbar}
        </div>
      ) : null}
      <div
        style={{
          minHeight: '680px',
          padding: '1rem',
          position: 'relative',
          background:
            'radial-gradient(circle at 30% 20%, rgba(74,222,128,0.08), transparent 20rem), radial-gradient(circle at 70% 0%, rgba(34,197,94,0.08), transparent 20rem), linear-gradient(180deg, rgba(11,36,24,0.84), rgba(8,26,18,0.92))',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function GameSurfacePopup({
  open,
  title,
  subtitle,
  children,
}: GameSurfacePopupProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'grid',
        placeItems: 'center',
        padding: '1.25rem',
        background: 'rgba(2, 6, 23, 0.58)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: 'min(100%, 560px)',
          padding: '1.2rem',
          borderRadius: '28px',
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(15,118,110,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0f766e' }}>
            Session Setup
          </div>
          <h3 style={{ margin: 0, color: '#064e3b', fontSize: '1.45rem', lineHeight: 1.1 }}>
            {title}
          </h3>
          {subtitle ? <p style={{ margin: 0, color: '#0f766e', lineHeight: 1.6 }}>{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function GameTableHeader({
  title,
  subtitle,
  action,
}: GameTableHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'end',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3f3f46' }}>
          Game Preview
        </div>
        <h2 style={{ margin: 0, color: '#111827', fontSize: '1.7rem', lineHeight: 1.1 }}>
          {title}
        </h2>
        {subtitle ? <p style={{ margin: 0, color: '#3f3f46', lineHeight: 1.5 }}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function GameInfoPanel({
  label,
  value,
  action,
}: GameInfoPanelProps) {
  return (
    <div
      style={{
        minWidth: '220px',
        padding: '0.9rem',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(15,118,110,0.12)',
        display: 'grid',
        gap: '0.6rem',
      }}
    >
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e' }}>
        {label}
      </div>
      <div style={{ fontWeight: 800, color: '#064e3b', fontSize: '1rem' }}>{value}</div>
      {action}
    </div>
  );
}

export function ResourceDock({
  sections,
}: ResourceDockProps) {
  return (
    <div
      style={{
        borderRadius: '26px',
        padding: '1rem',
        background: 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(15,118,110,0.1)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.9rem',
      }}
    >
      {sections.map((section) => (
        <div
          key={section.id}
          style={{
            padding: '0.9rem',
            borderRadius: '20px',
            background: 'rgba(247,255,249,0.92)',
            border: '1px solid rgba(15,118,110,0.1)',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '4px',
                  background: section.accent,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 800, color: '#064e3b' }}>{section.title}</span>
            </div>
            {section.meta ? <span style={{ color: '#0f766e', fontSize: '0.84rem' }}>{section.meta}</span> : null}
          </div>
          {section.content}
        </div>
      ))}
    </div>
  );
}

export function LinkedViewStage({
  title,
  subtitle,
  action,
  children,
}: LinkedViewStageProps) {
  return (
    <section
      style={{
        borderRadius: '28px',
        padding: '1.15rem',
        minHeight: '520px',
        background: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(15,118,110,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0f766e', marginBottom: '0.35rem' }}>
            View
          </div>
          <h3 style={{ margin: 0, color: '#064e3b', fontSize: '1.5rem' }}>{title}</h3>
          {subtitle ? <p style={{ margin: '0.45rem 0 0 0', color: '#0f766e', lineHeight: 1.6 }}>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PlayerLinkedViewStage({
  title,
  subtitle,
  action,
  children,
  backLabel = 'Back to Main Board',
  onBack,
}: PlayerLinkedViewStageProps) {
  return (
    <LinkedViewStage
      title={title}
      subtitle={subtitle}
      action={(
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {onBack ? (
            <button
              onClick={onBack}
              style={{
                border: '1px solid rgba(15,118,110,0.14)',
                background: 'rgba(255,255,255,0.86)',
                borderRadius: '999px',
                padding: '0.6rem 0.9rem',
                color: '#064e3b',
              }}
            >
              {backLabel}
            </button>
          ) : null}
          {action}
        </div>
      )}
    >
      {children}
    </LinkedViewStage>
  );
}
