import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import {
  getBuiltInComponentManifest,
  listAuthorableBuiltInComponents,
} from '@turnbased/engine-components';
import type { BuiltInComponentType } from '@turnbased/engine-components';

import { renderComponentIcon } from '../componentMeta';
import { tabletop, parchmentSurface, cardShadow } from '../theme/tabletop';
import type { EditorProject } from '../types';

const ALLOWED_TOP_LEVEL_TYPES = new Set(['board', 'deck', 'tile']);
const TOP_LEVEL_COMPONENT_OPTIONS = listAuthorableBuiltInComponents('top-level')
  .filter((manifest) => ALLOWED_TOP_LEVEL_TYPES.has(manifest.type));

function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) return 'Unknown Component';
  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

function getComponentSubtitle(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) return 'Component';
  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  if (instance.componentType === 'piece' || instance.componentType === 'token') {
    const parentLabel = instance.parentId ? getComponentLabel(project, String(instance.parentId)) : 'Unplaced';
    return `Movable ${manifest.displayName.toLowerCase()} · ${parentLabel}`;
  }
  return manifest.displayName;
}

function getComponentQuantity(project: EditorProject, instanceId: string): number {
  const instance = project.instances[instanceId];
  if (!instance) return 1;
  if (instance.componentType !== 'piece' && instance.componentType !== 'token') return 1;
  const qty = instance.properties.quantity;
  return typeof qty === 'number' && Number.isFinite(qty) && qty > 1 ? Math.trunc(qty) : 1;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const pageStyle: CSSProperties = {
  height: '100%',
  overflow: 'auto',
  padding: '1.75rem 2rem 2.5rem 2rem',
  display: 'grid',
  alignContent: 'start',
  gap: '1.25rem',
};

const headingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
};

const cardBaseStyle: CSSProperties = {
  display: 'grid',
  gap: '0.65rem',
  padding: '1.1rem 1rem 1rem 1rem',
  borderRadius: '16px',
  border: `1px solid ${tabletop.parchment.edge}`,
  background: parchmentSurface,
  boxShadow: cardShadow,
  cursor: 'pointer',
  textAlign: 'left',
  color: tabletop.ink.strong,
  minHeight: '156px',
  transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
};

const cardPreviewStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  aspectRatio: '4 / 3',
  borderRadius: '12px',
  background: 'linear-gradient(160deg, #4a4742, #3a3732 60%, #2c2925)',
  border: `1px solid ${tabletop.brass.deep}`,
  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 3px rgba(34,32,28,0.5)',
};

const createCardStyle: CSSProperties = {
  ...cardBaseStyle,
  background: 'rgba(247,239,218,0.45)',
  border: `1.5px dashed ${tabletop.brass.base}`,
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

interface ComponentCardProps {
  project: EditorProject;
  instanceId: string;
  onSelect: (instanceId: string) => void;
}

function ComponentCard({ project, instanceId, onSelect }: ComponentCardProps) {
  const instance = project.instances[instanceId];
  if (!instance) return null;

  const quantity = getComponentQuantity(project, instanceId);
  const label = getComponentLabel(project, instanceId);
  const subtitle = getComponentSubtitle(project, instanceId);

  return (
    <button
      type="button"
      data-layout="componentGalleryCard"
      /* gallery entry — click to enter the detail editor for this instance */
      onClick={() => onSelect(instanceId)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 4px 8px rgba(36,22,8,0.22), 0 20px 40px rgba(36,22,8,0.34)';
        el.style.borderColor = tabletop.brass.base;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'none';
        el.style.boxShadow = cardBaseStyle.boxShadow as string;
        el.style.borderColor = tabletop.parchment.edge;
      }}
      style={cardBaseStyle}
    >
      <div data-layout="componentCardPreview" /* felt-mat thumbnail with the component glyph */ style={cardPreviewStyle}>
        {renderComponentIcon(instance.componentType, { size: 46, style: { color: '#f3e4c6' } })}
      </div>
      <div data-layout="componentCardLabelRow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
        <span style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, fontSize: '1.18rem', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        {quantity > 1 ? (
          <span style={{ flex: '0 0 auto', fontSize: '0.72rem', fontWeight: 800, color: '#3a2c10', background: 'linear-gradient(180deg, #d8b977, #b8924e)', borderRadius: '8px', padding: '0.1rem 0.45rem', border: `1px solid ${tabletop.brass.deep}` }}>
            ×{quantity}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: '0.78rem', color: tabletop.ink.soft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {subtitle}
      </div>
    </button>
  );
}

interface CreateComponentCardProps {
  onCreateComponent: (type: BuiltInComponentType) => void;
}

function CreateComponentCard({ onCreateComponent }: CreateComponentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div data-layout="createComponentCardWrapper" /* hosts the new-component button + its popover menu */ style={{ position: 'relative' }}>
      <button
        type="button"
        data-layout="createComponentCard"
        /* opens a small popover with the list of top-level component types */
        onClick={() => setMenuOpen((open) => !open)}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(-3px)';
          el.style.boxShadow = '0 4px 8px rgba(36,22,8,0.22), 0 20px 40px rgba(36,22,8,0.34)';
          el.style.borderColor = tabletop.brass.deep;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'none';
          el.style.boxShadow = cardBaseStyle.boxShadow as string;
          el.style.borderColor = tabletop.brass.base;
        }}
        style={createCardStyle}
      >
        <div style={{ ...cardPreviewStyle, background: 'rgba(247,239,218,0.5)', border: `1.5px dashed ${tabletop.brass.base}`, boxShadow: 'none' }}>
          <Plus size={44} color={tabletop.brass.deep} strokeWidth={2.5} />
        </div>
        <div style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, fontSize: '1.18rem' }}>New component</div>
        <div style={{ fontSize: '0.78rem', color: tabletop.ink.soft }}>Board, tile, or deck</div>
      </button>

      {menuOpen ? (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
          <div
            data-layout="createComponentMenu"
            /* popover listing authorable top-level component types */
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              marginTop: '0.35rem',
              borderRadius: '14px',
              border: `1px solid ${tabletop.brass.base}`,
              background: parchmentSurface,
              boxShadow: cardShadow,
              padding: '0.3rem',
              display: 'grid',
              gap: '0.2rem',
            }}
          >
            {TOP_LEVEL_COMPONENT_OPTIONS.map((manifest) => (
              <button
                key={manifest.type}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onCreateComponent(manifest.type as BuiltInComponentType);
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.65rem 0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: '#064e3b',
                  display: 'grid',
                  gap: '0.14rem',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(184,146,78,0.16)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', fontWeight: 700 }}>
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '7px',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(236,253,245,0.95)',
                      border: '1px solid rgba(15,118,110,0.1)',
                      flex: '0 0 auto',
                    }}
                  >
                    {renderComponentIcon(manifest.type, { size: 13, style: { color: '#0f766e' } })}
                  </span>
                  {manifest.displayName}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>
                  {manifest.description}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

interface ComponentGalleryProps {
  project: EditorProject;
  componentOutlineIds: string[];
  onSelectComponent: (instanceId: string) => void;
  onCreateComponent: (type: BuiltInComponentType) => void;
}

export function ComponentGallery({ project, componentOutlineIds, onSelectComponent, onCreateComponent }: ComponentGalleryProps) {
  return (
    <div data-layout="componentGalleryPage" className="tabletop-surface" /* intermediate view between sidebar and per-component editor */ style={pageStyle}>
      <div data-layout="componentGalleryHeading" style={headingRowStyle}>
        <div>
          <div style={{ color: tabletop.brass.light, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em' }}>Component Editor</div>
          <h1 style={{ margin: '0.15rem 0 0 0', fontFamily: '"Cormorant Garamond", Georgia, serif', color: tabletop.ink.onWood, fontSize: '2rem', fontWeight: 700, letterSpacing: '0.01em' }}>Your components</h1>
        </div>
        <div style={{ color: tabletop.ink.onWoodSoft, fontSize: '0.88rem' }}>
          {componentOutlineIds.length === 0
            ? 'No components yet — create your first one to start.'
            : `${componentOutlineIds.length} component${componentOutlineIds.length === 1 ? '' : 's'}`}
        </div>
      </div>

      <div data-layout="componentGalleryGrid" style={gridStyle}>
        {componentOutlineIds.map((instanceId) => (
          <ComponentCard
            key={instanceId}
            project={project}
            instanceId={instanceId}
            onSelect={onSelectComponent}
          />
        ))}
        <CreateComponentCard onCreateComponent={onCreateComponent} />
      </div>
    </div>
  );
}
