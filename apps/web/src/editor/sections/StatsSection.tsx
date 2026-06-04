import type { CSSProperties, ReactNode } from 'react';
import { Clock, Sparkles, Users } from 'lucide-react';

import { NumericInput } from '../../components/NumericInput';
import type { EditorProject } from '../types';

function clampPlayerCount(value: number): number {
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function clampAge(value: number): number {
  return Math.max(0, Math.min(99, Math.trunc(Number.isFinite(value) ? value : 0)));
}

function clampPlaytime(value: number): number {
  return Math.max(1, Math.min(999, Math.trunc(Number.isFinite(value) ? value : 1)));
}

const SERIF_STACK = "'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif";

// Board-game-box info-panel palette: warm kraft cardboard background,
// deep forest-green ink, brass accents. Lives entirely inside this file
// so it stays close to where it's used.
const BOX_BACKGROUND = 'linear-gradient(155deg, #f1e2c0 0%, #d8c08b 60%, #c4a866 100%)';
const BOX_BORDER = '1px solid rgba(80, 55, 25, 0.45)';
const BOX_INK = '#1f3a2b';
const BOX_INK_MUTED = 'rgba(31, 58, 43, 0.65)';
const BOX_DIVIDER = 'rgba(80, 55, 25, 0.28)';
const BOX_INPUT_BG = 'rgba(255, 252, 240, 0.85)';

const boxPanelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1.4rem 1.5rem 1.25rem 1.5rem',
  borderRadius: '14px',
  border: BOX_BORDER,
  background: BOX_BACKGROUND,
  color: BOX_INK,
  boxShadow: '0 10px 30px rgba(60, 40, 20, 0.18), inset 0 1px 0 rgba(255, 250, 230, 0.55)',
};

const titleInputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  color: BOX_INK,
  fontFamily: SERIF_STACK,
  fontWeight: 800,
  fontSize: '1.9rem',
  letterSpacing: '0.01em',
  padding: '0.1rem 0.2rem',
  borderRadius: '6px',
  outline: 'none',
};

const eyebrowStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontStyle: 'italic',
  color: BOX_INK_MUTED,
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr auto',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.6rem 0.1rem',
};

const rowLabelStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontWeight: 700,
  fontSize: '1.02rem',
  color: BOX_INK,
  letterSpacing: '0.02em',
};

const rowSubStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontStyle: 'italic',
  fontSize: '0.78rem',
  color: BOX_INK_MUTED,
};

const numericFieldStyle: CSSProperties = {
  width: '64px',
  textAlign: 'center',
  border: '1px solid rgba(80, 55, 25, 0.35)',
  background: BOX_INPUT_BG,
  color: BOX_INK,
  fontFamily: SERIF_STACK,
  fontWeight: 700,
  fontSize: '1rem',
  padding: '0.3rem 0.4rem',
  borderRadius: '8px',
  outline: 'none',
};

const dashStyle: CSSProperties = {
  color: BOX_INK_MUTED,
  fontFamily: SERIF_STACK,
  fontWeight: 700,
  fontSize: '1.1rem',
};

const iconWellStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  background: 'rgba(80, 55, 25, 0.12)',
  border: '1px solid rgba(80, 55, 25, 0.25)',
  display: 'grid',
  placeItems: 'center',
  color: BOX_INK,
};

const dividerStyle: CSSProperties = {
  height: '1px',
  background: `linear-gradient(90deg, transparent 0%, ${BOX_DIVIDER} 18%, ${BOX_DIVIDER} 82%, transparent 100%)`,
  margin: '0 -0.25rem',
};

export function StatsSection({
  project,
  onUpdateBrief,
  onRenameProject,
}: {
  project: EditorProject;
  onUpdateBrief: (updater: (brief: EditorProject['brief']) => EditorProject['brief']) => void;
  /* Edits the name in the Stats panel mirror to the top-level project.name so
     the sidebar / dashboard title stays in sync with brief.name. */
  onRenameProject: (name: string) => void;
}) {
  const brief = project.brief;
  // Display name reads from brief.name (the source of truth for marketing
  // copy) but falls back to the legacy project.name if the brief is empty.
  const displayName = brief.name || project.name || '';

  return (
    <div
      data-layout="statsSectionRoot"
      /* centered column with the board-game-box info panel + secondary
         meta notes underneath. Both are bounded by the sidebar's main
         scroll region — the panel itself never scrolls. */
      style={{ display: 'grid', gap: '1rem', overflow: 'auto', alignContent: 'start' }}
    >
      <div
        data-layout="statsSectionColumn"
        /* fixed-width column wrapper. Matches the visual rhythm of the
           other editor surfaces (≈780px target reading width). */
        style={{ display: 'grid', maxWidth: '780px', margin: '0 auto', width: '100%', gap: '1rem' }}
      >
        <div
          data-layout="statsBoxPanel"
          /* the actual board-game-box-side-panel: title, then a stacked list
             of Players / Age / Playtime rows. Kraft-cardboard background. */
          style={boxPanelStyle}
        >
          <div data-layout="statsBoxHeader" /* eyebrow label + editable title */ style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={eyebrowStyle}>A tabletop game by you</span>
            <input
              value={displayName}
              onChange={(event) => {
                const next = event.target.value;
                // Keep both top-level name and brief.name in sync — the
                // sidebar reads project.name, the rulebook header reads
                // brief.name. Splitting them creates drift the user has to
                // chase.
                onRenameProject(next);
                onUpdateBrief((current) => ({ ...current, name: next }));
              }}
              placeholder="Untitled game"
              aria-label="Game title"
              style={titleInputStyle}
            />
          </div>

          <div data-layout="statsBoxDivider" aria-hidden style={dividerStyle} />

          <StatRow
            icon={<Users size={18} strokeWidth={2.2} />}
            label="Players"
            sub={brief.minPlayers === brief.maxPlayers ? `${brief.minPlayers} player${brief.minPlayers === 1 ? '' : 's'}` : `${brief.minPlayers}–${brief.maxPlayers} players`}
            value={(
              <>
                <NumericInput
                  min={1}
                  max={6}
                  value={brief.minPlayers}
                  onValueChange={(value) => onUpdateBrief((current) => {
                    const next = clampPlayerCount(value);
                    return {
                      ...current,
                      minPlayers: Math.min(next, current.maxPlayers),
                      maxPlayers: Math.max(next, current.maxPlayers),
                    };
                  })}
                  aria-label="Minimum players"
                  style={numericFieldStyle}
                />
                <span style={dashStyle}>–</span>
                <NumericInput
                  min={1}
                  max={6}
                  value={brief.maxPlayers}
                  onValueChange={(value) => onUpdateBrief((current) => {
                    const next = clampPlayerCount(value);
                    return {
                      ...current,
                      minPlayers: Math.min(current.minPlayers, next),
                      maxPlayers: Math.max(current.minPlayers, next),
                    };
                  })}
                  aria-label="Maximum players"
                  style={numericFieldStyle}
                />
              </>
            )}
          />

          <div data-layout="statsBoxDivider" aria-hidden style={dividerStyle} />

          <StatRow
            icon={<Sparkles size={18} strokeWidth={2.2} />}
            label="Ages"
            sub={brief.minAge > 0 ? `${brief.minAge}+ years` : 'All ages'}
            value={(
              <>
                <NumericInput
                  min={0}
                  max={99}
                  value={brief.minAge}
                  onValueChange={(value) => onUpdateBrief((current) => ({ ...current, minAge: clampAge(value) }))}
                  aria-label="Suggested minimum age"
                  style={numericFieldStyle}
                />
                <span style={{ ...dashStyle, fontStyle: 'italic', fontSize: '0.95rem' }}>+</span>
              </>
            )}
          />

          <div data-layout="statsBoxDivider" aria-hidden style={dividerStyle} />

          <StatRow
            icon={<Clock size={18} strokeWidth={2.2} />}
            label="Playtime"
            sub={
              brief.playtimeMinMinutes === brief.playtimeMaxMinutes
                ? `${brief.playtimeMinMinutes} min`
                : `${brief.playtimeMinMinutes}–${brief.playtimeMaxMinutes} min`
            }
            value={(
              <>
                <NumericInput
                  min={1}
                  max={999}
                  value={brief.playtimeMinMinutes}
                  onValueChange={(value) => onUpdateBrief((current) => {
                    const next = clampPlaytime(value);
                    return {
                      ...current,
                      playtimeMinMinutes: Math.min(next, current.playtimeMaxMinutes),
                      playtimeMaxMinutes: Math.max(next, current.playtimeMaxMinutes),
                    };
                  })}
                  aria-label="Minimum playtime in minutes"
                  style={numericFieldStyle}
                />
                <span style={dashStyle}>–</span>
                <NumericInput
                  min={1}
                  max={999}
                  value={brief.playtimeMaxMinutes}
                  onValueChange={(value) => onUpdateBrief((current) => {
                    const next = clampPlaytime(value);
                    return {
                      ...current,
                      playtimeMinMinutes: Math.min(current.playtimeMinMinutes, next),
                      playtimeMaxMinutes: Math.max(current.playtimeMinMinutes, next),
                    };
                  })}
                  aria-label="Maximum playtime in minutes"
                  style={numericFieldStyle}
                />
                <span style={{ ...dashStyle, fontStyle: 'italic', fontSize: '0.85rem', marginLeft: '0.15rem' }}>min</span>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}

interface StatRowProps {
  icon: ReactNode;
  label: string;
  sub: string;
  value: ReactNode;
}

function StatRow({ icon, label, sub, value }: StatRowProps) {
  return (
    <div data-layout="statsBoxRow" /* one icon + label + editable value triplet inside the info box */ style={rowStyle}>
      <div data-layout="statsBoxRowIcon" style={iconWellStyle}>
        {icon}
      </div>
      <div data-layout="statsBoxRowLabel" style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 }}>
        <span style={rowLabelStyle}>{label}</span>
        <span style={rowSubStyle}>{sub}</span>
      </div>
      <div data-layout="statsBoxRowControls" /* tightly-packed numeric inputs for the row's value */ style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifySelf: 'end' }}>
        {value}
      </div>
    </div>
  );
}
