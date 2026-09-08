import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';

import { getBuiltInComponentManifest } from '@turnbased/engine-components';
import type { BuiltInComponentType } from '@turnbased/engine-components';

import { renderComponentIcon } from '../../componentMeta';
import type { CustomRulebookComponent, EditorProject } from '../../types';
import { formatDimensions } from '../../units';
import { useCatalogProductDetail } from '../../useSupplierCatalog';
import { useUserSettings } from '../../../userSettings';
import { SERIF_STACK } from './rulebookStyles';

export interface ComponentsChapterPageProps {
  project: EditorProject;
  /* When the user edits the inline description for a real catalog instance.
     Stored on `ComponentInstanceModel.notes` so the gallery / inspector sees
     the same string. */
  onUpdateInstanceNotes: (instanceId: string, notes: string) => void;
  /* When the user edits the inline name for a real catalog instance. */
  onUpdateInstanceName: (instanceId: string, displayName: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onEditCatalogItem: (instanceId: string) => void;

  /* Custom-only entries — live solely in EditorRuleConfig.customComponents. */
  onUpdateCustomComponent: (id: string, patch: Partial<Omit<CustomRulebookComponent, 'id'>>) => void;
  onRemoveCustomComponent: (id: string) => void;
}

interface CatalogListing {
  kind: 'catalog';
  instanceId: string;
  componentType: string;
  name: string;
  description: string;
  catalogProductTitle: string;
  catalogVariantTitle: string;
  catalogSlug: string;
  catalogVariantId: string;
  physicalWidthMm: number | null;
  physicalHeightMm: number | null;
}

interface CustomListing {
  kind: 'custom';
  id: string;
  name: string;
  description: string;
}

type Listing = CatalogListing | CustomListing;

function removeSizeFromCatalogName(name: string): string {
  return name
    .replace(
      /\s+\d+(?:\.\d+)?\s*(?:"|″|in|inch|inches)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:"|″|in|inch|inches)?\s*$/i,
      '',
    )
    .replace(/\s+\d+(?:\.\d+)?\s*(?:"|″|in|inch|inches)\s*$/i, '')
    .trim();
}

function buildListings(project: EditorProject): Listing[] {
  // Top-level instances (no parent) represent the physical pieces the user
  // would actually order — boards, decks, tile sheets. Sub-items like cards
  // inside a deck are listed in the gallery's per-deck editor, not the
  // top-level components chapter, so the rulebook stays focused on physical
  // SKUs.
  const catalog: CatalogListing[] = project.rootInstanceIds
    .map((instanceId) => project.instances[instanceId])
    .filter((instance): instance is NonNullable<typeof instance> => Boolean(instance))
    .map((instance) => {
      const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
      return {
        kind: 'catalog' as const,
        instanceId: String(instance.instanceId),
        componentType: instance.componentType,
        name: String(instance.displayName ?? instance.properties?.label ?? manifest.displayName),
        description: typeof instance.notes === 'string' ? instance.notes : '',
        catalogProductTitle:
          typeof instance.properties?.catalogProductTitle === 'string'
            ? instance.properties.catalogProductTitle
            : typeof instance.properties?.catalogSlug === 'string'
              ? instance.properties.catalogSlug
              : manifest.displayName,
        catalogVariantTitle:
          typeof instance.properties?.catalogVariantTitle === 'string'
            ? instance.properties.catalogVariantTitle
            : typeof instance.properties?.catalogVariantId === 'string'
              ? instance.properties.catalogVariantId
              : '',
        catalogSlug:
          typeof instance.properties?.catalogSlug === 'string' ? instance.properties.catalogSlug : '',
        catalogVariantId:
          typeof instance.properties?.catalogVariantId === 'string'
            ? instance.properties.catalogVariantId
            : '',
        physicalWidthMm:
          typeof instance.properties?.physicalWidthMm === 'number'
            ? instance.properties.physicalWidthMm
            : null,
        physicalHeightMm:
          typeof instance.properties?.physicalHeightMm === 'number'
            ? instance.properties.physicalHeightMm
            : null,
      };
    });

  const custom: CustomListing[] = project.rules.customComponents.map((entry) => ({
    kind: 'custom' as const,
    id: entry.id,
    name: entry.name,
    description: entry.description,
  }));

  return [...catalog, ...custom];
}

const listScrollStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
  paddingRight: '0.4rem',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  padding: '0.7rem 0.85rem 0.8rem 0.85rem',
  border: '1px solid rgba(120, 95, 50, 0.22)',
  borderRadius: '10px',
  background: 'rgba(255, 253, 246, 0.72)',
  boxShadow: '0 1px 0 rgba(120, 95, 50, 0.05)',
};

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
};

const typeBadgeStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.18rem 0.5rem',
  borderRadius: '999px',
  border: '1px solid rgba(15, 118, 110, 0.25)',
  background: 'rgba(236, 253, 245, 0.75)',
  color: '#0f766e',
  fontFamily: SERIF_STACK,
  fontStyle: 'italic',
  fontSize: '0.72rem',
};

const customBadgeStyle: CSSProperties = {
  ...typeBadgeStyle,
  border: '1px solid rgba(180, 83, 9, 0.4)',
  background: 'rgba(255, 247, 235, 0.95)',
  color: '#9a3412',
};

const nameInputStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  border: 'none',
  background: 'transparent',
  color: '#3b2412',
  fontFamily: SERIF_STACK,
  fontSize: '1.02rem',
  fontWeight: 700,
  padding: '0.12rem 0.25rem',
  borderRadius: '6px',
  outline: 'none',
};

const descriptionInputStyle: CSSProperties = {
  width: '100%',
  minHeight: '52px',
  resize: 'vertical',
  border: '1px solid rgba(120, 95, 50, 0.15)',
  background: 'rgba(255, 253, 246, 0.95)',
  color: '#3b2412',
  fontFamily: SERIF_STACK,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  padding: '0.4rem 0.55rem',
  borderRadius: '8px',
  outline: 'none',
};

const removeButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '26px',
  height: '26px',
  borderRadius: '999px',
  border: 'none',
  background: 'rgba(120, 95, 50, 0.08)',
  color: 'rgba(120, 60, 30, 0.7)',
  cursor: 'pointer',
  flexShrink: 0,
};

export function ComponentsChapterPage({
  project,
  onUpdateInstanceNotes,
  onUpdateInstanceName,
  onRemoveInstance,
  onEditCatalogItem,
  onUpdateCustomComponent,
  onRemoveCustomComponent,
}: ComponentsChapterPageProps) {
  const listings = useMemo(() => buildListings(project), [project]);

  return (
    <div
      data-layout="componentsChapterRoot"
      /* sits where the regular textarea body sits — fills the page's
         flexible center region. The list scrolls internally so the
         page chrome (title row + page number flourish) stays put. */
      style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
    >
      <div
        data-layout="componentsChapterIntro"
        /* one-line nudge sitting above the list, explaining the contract:
           items in this list are the physical pieces the rulebook lists,
           AND they correspond 1:1 to the gallery. */
        style={{
          flex: '0 0 auto',
          fontFamily: SERIF_STACK,
          fontStyle: 'italic',
          color: 'rgba(80, 55, 25, 0.78)',
          fontSize: '0.84rem',
          lineHeight: 1.45,
        }}
      >
        Pick the physical pieces that come in the box. Catalog picks show up in the Component Editor
        automatically; descriptions live next to each piece in the rulebook.
      </div>

      <div data-layout="componentsChapterList" style={listScrollStyle}>
        {listings.length === 0 ? (
          <div
            data-layout="componentsChapterEmptyState"
            style={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              color: 'rgba(120, 95, 50, 0.6)',
              fontSize: '0.9rem',
              padding: '0.6rem 0.2rem',
            }}
          >
            No components yet. Use Add component in the page header.
          </div>
        ) : (
          listings.map((listing) => (
            <ListingCard
              key={listing.kind === 'catalog' ? `catalog:${listing.instanceId}` : `custom:${listing.id}`}
              listing={listing}
              onUpdateInstanceNotes={onUpdateInstanceNotes}
              onUpdateInstanceName={onUpdateInstanceName}
              onRemoveInstance={onRemoveInstance}
              onEditCatalogItem={onEditCatalogItem}
              onUpdateCustomComponent={onUpdateCustomComponent}
              onRemoveCustomComponent={onRemoveCustomComponent}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ListingCardProps {
  listing: Listing;
  onUpdateInstanceNotes: (instanceId: string, notes: string) => void;
  onUpdateInstanceName: (instanceId: string, displayName: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onEditCatalogItem: (instanceId: string) => void;
  onUpdateCustomComponent: (id: string, patch: Partial<Omit<CustomRulebookComponent, 'id'>>) => void;
  onRemoveCustomComponent: (id: string) => void;
}

function ListingCard({
  listing,
  onUpdateInstanceNotes,
  onUpdateInstanceName,
  onRemoveInstance,
  onEditCatalogItem,
  onUpdateCustomComponent,
  onRemoveCustomComponent,
}: ListingCardProps) {
  const { preferredUnits } = useUserSettings();
  const catalogSlug = listing.kind === 'catalog' ? listing.catalogSlug : '';
  const catalogVariantId = listing.kind === 'catalog' ? listing.catalogVariantId : '';
  const { detail } = useCatalogProductDetail(catalogSlug || null);

  if (listing.kind === 'catalog') {
    const manifest = getBuiltInComponentManifest(listing.componentType as BuiltInComponentType);
    const fetchedProductTitle = detail ? detail.customTitle || detail.title || detail.slug : '';
    const fetchedVariantTitle = detail?.productVariants.find(
      (variant) => variant.id === catalogVariantId,
    )?.title;
    const dimensionText =
      listing.physicalWidthMm && listing.physicalHeightMm
        ? formatDimensions(listing.physicalWidthMm, listing.physicalHeightMm, preferredUnits)
        : '';
    const linkedItemName = removeSizeFromCatalogName(fetchedProductTitle || listing.catalogProductTitle);
    const linkedItemText = [
      linkedItemName || fetchedProductTitle || listing.catalogProductTitle,
      dimensionText,
      fetchedVariantTitle || listing.catalogVariantTitle,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <div data-layout="componentsChapterCard" data-card-kind="catalog" style={cardStyle}>
        <div
          data-layout="componentsChapterCatalogHeader"
          /* first row keeps supplier item/edit and remove controls together,
             so the destructive action visually belongs to the physical item. */
          style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}
        >
          <span
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(236, 253, 245, 0.95)',
              border: '1px solid rgba(15, 118, 110, 0.18)',
              flex: '0 0 auto',
            }}
          >
            {renderComponentIcon(listing.componentType, { size: 14, style: { color: '#0f766e' } })}
          </span>
          <span
            style={{
              ...typeBadgeStyle,
              fontStyle: 'normal',
              flex: '0 1 auto',
              minWidth: 0,
              width: 'fit-content',
              maxWidth: '100%',
              whiteSpace: 'normal',
              lineHeight: 1.35,
              textAlign: 'left',
            }}
          >
            {linkedItemText || 'item'}
          </span>
          {['board', 'deck', 'tile'].includes(listing.componentType) && (
            <button
              type="button"
              onClick={() => onEditCatalogItem(listing.instanceId)}
              aria-label={`Edit linked catalog item for ${listing.name || manifest.displayName}`}
              title={`Edit linked catalog item: ${linkedItemText || listing.catalogSlug || manifest.displayName}`}
              style={removeButtonStyle}
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemoveInstance(listing.instanceId)}
            aria-label={`Remove ${listing.name || manifest.displayName}`}
            title="Remove from project"
            style={removeButtonStyle}
          >
            <Trash2 size={13} />
          </button>
        </div>
        <div
          data-layout="componentsChapterComponentNameRow"
          /* second row is the user-facing component identity used in the
             game text, separate from the supplier catalog item above. */
        >
          <input
            value={listing.name}
            onChange={(event) => onUpdateInstanceName(listing.instanceId, event.target.value)}
            placeholder="Player-facing component name"
            aria-label="Component name"
            style={{ ...nameInputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <textarea
          value={listing.description}
          onChange={(event) => onUpdateInstanceNotes(listing.instanceId, event.target.value)}
          placeholder="In-game description: what players call this and how it is used…"
          aria-label="Component description"
          style={descriptionInputStyle}
        />
      </div>
    );
  }

  return (
    <div data-layout="componentsChapterCard" data-card-kind="custom" style={cardStyle}>
      <div data-layout="componentsChapterCardHeader" style={cardHeaderStyle}>
        <span
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '8px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255, 247, 235, 0.95)',
            border: '1px solid rgba(180, 83, 9, 0.3)',
            flex: '0 0 auto',
            color: '#9a3412',
          }}
        >
          <AlertTriangle size={13} />
        </span>
        <input
          value={listing.name}
          onChange={(event) => onUpdateCustomComponent(listing.id, { name: event.target.value })}
          placeholder="Custom component name"
          aria-label="Custom component name"
          style={nameInputStyle}
        />
        <span
          style={customBadgeStyle}
          title="Custom components don't exist in the supplier catalog and can't be ordered through this site."
        >
          custom · not orderable
        </span>
        <button
          type="button"
          onClick={() => onRemoveCustomComponent(listing.id)}
          aria-label={`Remove ${listing.name || 'custom component'}`}
          title="Remove custom component"
          style={removeButtonStyle}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        value={listing.description}
        onChange={(event) => onUpdateCustomComponent(listing.id, { description: event.target.value })}
        placeholder="Describe this custom component for the rulebook…"
        aria-label="Custom component description"
        style={descriptionInputStyle}
      />
    </div>
  );
}
