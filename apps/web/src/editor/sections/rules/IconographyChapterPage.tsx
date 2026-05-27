import type { CSSProperties } from 'react';

import { getProjectIconToken } from '../../components/TextBoxContent';
import { IconArtworkPreview } from '../art/IconArtworkPreview';
import type { EditorIconAsset, EditorProject } from '../../types';
import { SERIF_STACK } from './rulebookStyles';

export interface IconographyChapterPageProps {
  project: EditorProject;
  onUpdateIconDescription: (iconId: string, description: string) => void;
}

// Reference-plaque palette: warm parchment top fading into oak below, deep
// brown ink, teal accent for the :token: chip. Mirrors the rulebook page
// background so the cards feel like printed entries instead of UI tiles.
const PLAQUE_BACKGROUND = 'linear-gradient(168deg, rgba(255, 252, 240, 0.97) 0%, rgba(243, 228, 192, 0.94) 60%, rgba(232, 213, 168, 0.92) 100%)';
const PLAQUE_BORDER = '1px solid rgba(120, 95, 50, 0.32)';
const PLAQUE_SHADOW = '0 1px 0 rgba(255, 250, 235, 0.85) inset, 0 -1px 0 rgba(120, 80, 35, 0.08) inset, 0 6px 14px rgba(80, 55, 25, 0.12), 0 1px 2px rgba(60, 40, 20, 0.18)';
const PLAQUE_INK = '#3b2412';
const PLAQUE_INK_MUTED = 'rgba(80, 55, 25, 0.78)';
const ACCENT_TEAL = '#0d9488';
const GOLD_LINE = 'rgba(170, 120, 45, 0.55)';

const ICON_WELL_SIZE = 96;

// One-time class registration so we can use :hover / :focus pseudo-classes
// without adding a global CSS file. The block is keyed off this constant
// (className IconographyChapterPage) to avoid double-injection on HMR.
const STYLE_TAG_ID = 'turnbased-iconography-chapter-styles';
const HOVER_RULES = `
.tb-icon-plaque {
  position: relative;
  transition: transform 160ms ease, box-shadow 220ms ease, border-color 220ms ease;
}
.tb-icon-plaque:hover {
  transform: translateY(-1px);
  box-shadow:
    0 1px 0 rgba(255, 250, 235, 0.9) inset,
    0 -1px 0 rgba(120, 80, 35, 0.1) inset,
    0 10px 22px rgba(80, 55, 25, 0.18),
    0 2px 4px rgba(60, 40, 20, 0.22);
  border-color: rgba(170, 120, 45, 0.55);
}
.tb-icon-plaque__well {
  position: relative;
  transition: transform 220ms ease, box-shadow 220ms ease;
}
.tb-icon-plaque:hover .tb-icon-plaque__well {
  transform: rotate(-1.2deg) scale(1.02);
  box-shadow:
    0 1px 0 rgba(255, 250, 235, 0.6) inset,
    0 0 0 2px rgba(255, 252, 240, 0.55) inset,
    0 0 0 4px rgba(170, 120, 45, 0.18),
    0 6px 14px rgba(80, 55, 25, 0.18);
}
.tb-icon-plaque__textarea {
  transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}
.tb-icon-plaque__textarea:focus {
  border-color: rgba(15, 118, 110, 0.6);
  background: rgba(255, 253, 244, 0.96);
  box-shadow:
    0 1px 0 rgba(255, 252, 240, 0.75) inset,
    0 0 0 3px rgba(15, 118, 110, 0.18);
}
`;
if (typeof document !== 'undefined' && !document.getElementById(STYLE_TAG_ID)) {
  const styleTag = document.createElement('style');
  styleTag.id = STYLE_TAG_ID;
  styleTag.textContent = HOVER_RULES;
  document.head.appendChild(styleTag);
}

const introWrapStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.15rem 0.1rem 0.05rem 0.1rem',
};

const introTextStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontStyle: 'italic',
  color: PLAQUE_INK_MUTED,
  fontSize: '0.9rem',
  lineHeight: 1.5,
  letterSpacing: '0.01em',
  flex: '1 1 auto',
  minWidth: 0,
};

const ornamentDotStyle: CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: GOLD_LINE,
  boxShadow: '0 0 0 2px rgba(255, 252, 240, 0.9), 0 0 0 3px rgba(170, 120, 45, 0.18)',
  flex: '0 0 auto',
};

const gridStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
  gap: '0.9rem',
  paddingRight: '0.5rem',
  paddingBottom: '0.4rem',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${ICON_WELL_SIZE + 18}px minmax(0, 1fr)`,
  gap: '0.9rem',
  alignItems: 'stretch',
  padding: '0.9rem 1rem 0.85rem 1rem',
  border: PLAQUE_BORDER,
  borderRadius: '14px',
  background: PLAQUE_BACKGROUND,
  boxShadow: PLAQUE_SHADOW,
  color: PLAQUE_INK,
  position: 'relative',
};

// Coin-stamped medallion: warm parchment core, double bevel (inner highlight
// + outer gilded ring), tiny notch on the rim to evoke a printer's plate.
const iconWellStyle: CSSProperties = {
  width: `${ICON_WELL_SIZE}px`,
  height: `${ICON_WELL_SIZE}px`,
  borderRadius: '14px',
  background: 'radial-gradient(circle at 28% 22%, rgba(255, 253, 240, 0.96), rgba(232, 212, 165, 0.92) 70%, rgba(214, 188, 132, 0.92) 100%)',
  border: '1px solid rgba(140, 105, 55, 0.45)',
  boxShadow:
    '0 1px 0 rgba(255, 250, 235, 0.55) inset, 0 0 0 2px rgba(255, 252, 240, 0.55) inset, 0 0 0 3px rgba(170, 120, 45, 0.22), 0 3px 8px rgba(80, 55, 25, 0.18)',
  display: 'grid',
  placeItems: 'center',
  flex: '0 0 auto',
  alignSelf: 'center',
};

const headingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.6rem',
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontWeight: 800,
  color: PLAQUE_INK,
  fontSize: '1.08rem',
  letterSpacing: '0.012em',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textShadow: '0 1px 0 rgba(255, 250, 235, 0.6)',
};

const tokenChipStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace",
  fontWeight: 700,
  fontSize: '0.74rem',
  color: '#0f766e',
  background: 'linear-gradient(180deg, rgba(236, 253, 245, 0.95) 0%, rgba(204, 240, 226, 0.95) 100%)',
  border: '1px solid rgba(15, 118, 110, 0.36)',
  borderRadius: '999px',
  padding: '0.15rem 0.6rem',
  letterSpacing: '0.03em',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.55) inset, 0 1px 2px rgba(15, 80, 70, 0.14)',
};

// Index numeral in the top-right corner — gives each entry a catalog feel.
const cardIndexStyle: CSSProperties = {
  position: 'absolute',
  top: '0.55rem',
  right: '0.7rem',
  fontFamily: SERIF_STACK,
  fontStyle: 'italic',
  fontSize: '0.72rem',
  color: 'rgba(140, 100, 50, 0.55)',
  letterSpacing: '0.04em',
  pointerEvents: 'none',
};

// Decorative divider: thin gilded line that fades at the edges, with a small
// diamond ornament centered on it (echoing illuminated chapter dividers).
const ornamentDividerStyle: CSSProperties = {
  position: 'relative',
  height: '12px',
  margin: '0.6rem 0 0.55rem 0',
};

const ornamentLineStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 0,
  right: 0,
  height: '1px',
  transform: 'translateY(-50%)',
  background: `linear-gradient(90deg, rgba(170, 120, 45, 0) 0%, ${GOLD_LINE} 18%, ${GOLD_LINE} 82%, rgba(170, 120, 45, 0) 100%)`,
};

const ornamentDiamondStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '7px',
  height: '7px',
  background: 'rgba(170, 120, 45, 0.85)',
  transform: 'translate(-50%, -50%) rotate(45deg)',
  boxShadow: '0 0 0 2px rgba(255, 252, 240, 0.95), 0 0 0 3px rgba(170, 120, 45, 0.25)',
};

const descriptionStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '76px',
  resize: 'vertical',
  border: '1px solid rgba(120, 95, 50, 0.25)',
  background: 'rgba(255, 251, 238, 0.88)',
  color: PLAQUE_INK,
  fontFamily: SERIF_STACK,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  padding: '0.55rem 0.65rem',
  borderRadius: '10px',
  outline: 'none',
  boxShadow: '0 1px 0 rgba(255, 252, 240, 0.75) inset, 0 1px 2px rgba(60, 40, 20, 0.05)',
};

const emptyStateStyle: CSSProperties = {
  margin: '0.3rem 0.2rem 0',
  padding: '1.4rem 1.1rem',
  border: '1px dashed rgba(120, 95, 50, 0.34)',
  borderRadius: '14px',
  background: 'linear-gradient(180deg, rgba(255, 252, 240, 0.7) 0%, rgba(245, 232, 200, 0.55) 100%)',
  fontFamily: SERIF_STACK,
  color: PLAQUE_INK_MUTED,
  fontSize: '0.92rem',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.45rem',
};

const emptyStateGlyphStyle: CSSProperties = {
  fontFamily: SERIF_STACK,
  fontSize: '1.4rem',
  color: 'rgba(170, 120, 45, 0.75)',
  letterSpacing: '0.18em',
  lineHeight: 1,
};

function iconName(item: EditorIconAsset): string {
  return item.name.trim() || item.inlineCode.trim().replaceAll(':', '') || item.iconKey || 'icon';
}

function formatIndex(n: number): string {
  // Two-digit catalog-style numerals: 01, 02, ... 99, then plain past that.
  if (n < 100) return n.toString().padStart(2, '0');
  return n.toString();
}

export function IconographyChapterPage({ project, onUpdateIconDescription }: IconographyChapterPageProps) {
  const icons = project.art.icons;

  return (
    <div
      data-layout="iconographyChapterRoot"
      /* page-style reference plaque grid that fills the rulebook chapter
         body. The intro stays pinned; the icon grid scrolls underneath. */
      style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}
    >
      <div
        data-layout="iconographyChapterIntro"
        /* italic preamble flanked by small gilded ornaments — sets the
           illuminated-manuscript tone before the icon plaques. */
        style={introWrapStyle}
      >
        <span aria-hidden style={ornamentDotStyle} />
        <span style={introTextStyle}>
          Icons from the Art section appear here automatically. Use each
          {' '}
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace",
              color: ACCENT_TEAL,
              background: 'rgba(15, 118, 110, 0.08)',
              border: '1px solid rgba(15, 118, 110, 0.18)',
              borderRadius: '4px',
              padding: '0.02rem 0.3rem',
              fontStyle: 'normal',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            :token:
          </span>
          {' '}
          in rulebook text and describe what it means in play.
        </span>
        <span aria-hidden style={ornamentDotStyle} />
      </div>

      {icons.length === 0 ? (
        <div data-layout="iconographyEmptyState" style={emptyStateStyle}>
          <span aria-hidden style={emptyStateGlyphStyle}>✦ ⁂ ✦</span>
          <span style={{ fontStyle: 'italic' }}>
            No icons yet — visit the Art section to forge your first one, and it will appear here as a reference plaque.
          </span>
        </div>
      ) : (
        <div data-layout="iconographyGrid" style={gridStyle}>
          {icons.map((icon, index) => {
            const name = iconName(icon);
            const token = getProjectIconToken(icon);
            return (
              <article
                key={icon.id}
                data-layout="iconographyCard"
                className="tb-icon-plaque"
                /* one illuminated plaque per icon: embossed medallion left,
                   heading + token + flourished divider + parchment slip body */
                style={cardStyle}
              >
                <span aria-hidden style={cardIndexStyle}>№ {formatIndex(index + 1)}</span>

                <div data-layout="iconographyCardIconWell" className="tb-icon-plaque__well" style={iconWellStyle}>
                  <IconArtworkPreview item={icon} project={project} size={70} />
                </div>

                <div
                  data-layout="iconographyCardBody"
                  /* heading row pinned at the top, ornament divider, then the
                     description fills whatever space is left */
                  style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <div data-layout="iconographyCardHeading" style={headingRowStyle}>
                    <span style={nameStyle} title={name}>{name}</span>
                    <span style={tokenChipStyle} title={`Insert ${token} into rulebook prose`}>{token}</span>
                  </div>

                  <div data-layout="iconographyCardDivider" aria-hidden style={ornamentDividerStyle}>
                    <span style={ornamentLineStyle} />
                    <span style={ornamentDiamondStyle} />
                  </div>

                  <textarea
                    className="tb-icon-plaque__textarea"
                    value={icon.description}
                    onChange={(event) => onUpdateIconDescription(icon.id, event.target.value)}
                    placeholder="What this icon means in play…"
                    aria-label={`Description for ${name}`}
                    style={descriptionStyle}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
