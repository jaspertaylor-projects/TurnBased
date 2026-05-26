import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

import {
  getBuiltInComponentManifest,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
} from '@turnbased/engine-components';

import { renderComponentIcon } from '../../componentMeta';
import type { CustomRulebookComponent, EditorProject } from '../../types';
import { SERIF_STACK } from './rulebookStyles';
import { ComponentPicker } from './ComponentPicker';
import { CustomComponentModal, type CustomComponentDraft } from './CustomComponentModal';

export interface ComponentsChapterPageProps {
  project: EditorProject;
  /* When the user picks a catalog type from the "+ Add" picker. The editor
     owns the actual addProjectComponent call so the new instance shows up in
     the gallery as well. */
  onAddCatalogComponent: (type: BuiltInComponentType) => void;
  /* When the user edits the inline description for a real catalog instance.
     Stored on `ComponentInstanceModel.notes` so the gallery / inspector sees
     the same string. */
  onUpdateInstanceNotes: (instanceId: string, notes: string) => void;
  /* When the user edits the inline name for a real catalog instance. */
  onUpdateInstanceName: (instanceId: string, displayName: string) => void;
  onRemoveInstance: (instanceId: string) => void;

  /* Custom-only entries — live solely in EditorRuleConfig.customComponents. */
  onAddCustomComponent: (entry: CustomRulebookComponent) => void;
  onUpdateCustomComponent: (id: string, patch: Partial<Omit<CustomRulebookComponent, 'id'>>) => void;
  onRemoveCustomComponent: (id: string) => void;
}

interface CatalogListing {
  kind: 'catalog';
  instanceId: string;
  componentType: string;
  name: string;
  description: string;
}

interface CustomListing {
  kind: 'custom';
  id: string;
  name: string;
  description: string;
}

type Listing = CatalogListing | CustomListing;

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

const addButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.55rem 0.9rem',
  borderRadius: '999px',
  border: '1px dashed rgba(15, 118, 110, 0.5)',
  background: 'rgba(236, 253, 245, 0.6)',
  color: '#0f766e',
  cursor: 'pointer',
  fontFamily: SERIF_STACK,
  fontWeight: 700,
  fontSize: '0.86rem',
  alignSelf: 'flex-start',
};

export function ComponentsChapterPage({
  project,
  onAddCatalogComponent,
  onUpdateInstanceNotes,
  onUpdateInstanceName,
  onRemoveInstance,
  onAddCustomComponent,
  onUpdateCustomComponent,
  onRemoveCustomComponent,
}: ComponentsChapterPageProps) {
  const listings = useMemo(() => buildListings(project), [project]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomComponentDraft | null>(null);

  function handlePickerSelect(type: BuiltInComponentType) {
    setPickerOpen(false);
    onAddCatalogComponent(type);
  }

  function openCustomModal() {
    setPickerOpen(false);
    setCustomDraft({ name: '', description: '' });
  }

  function submitCustomDraft() {
    if (!customDraft) return;
    const trimmedName = customDraft.name.trim();
    if (!trimmedName) return;
    onAddCustomComponent({
      id: `custom_component_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      name: trimmedName,
      description: customDraft.description.trim(),
    });
    setCustomDraft(null);
  }

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
        Pick the physical pieces that come in the box. Catalog picks show up in the
        Component Editor automatically; descriptions live next to each piece in the rulebook.
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
            No components yet. Add one from the catalog below.
          </div>
        ) : (
          listings.map((listing) => (
            <ListingCard
              key={listing.kind === 'catalog' ? `catalog:${listing.instanceId}` : `custom:${listing.id}`}
              listing={listing}
              onUpdateInstanceNotes={onUpdateInstanceNotes}
              onUpdateInstanceName={onUpdateInstanceName}
              onRemoveInstance={onRemoveInstance}
              onUpdateCustomComponent={onUpdateCustomComponent}
              onRemoveCustomComponent={onRemoveCustomComponent}
            />
          ))
        )}
      </div>

      <div
        data-layout="componentsChapterPickerRow"
        /* sits below the scrolling list; the picker pops upward so the
           list never gets squashed. */
        style={{ flex: '0 0 auto', position: 'relative' }}
      >
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          style={addButtonStyle}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
        >
          <Plus size={14} />
          Add component
        </button>

        {pickerOpen ? (
          <ComponentPicker
            onSelect={handlePickerSelect}
            onChooseCustom={openCustomModal}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </div>

      {customDraft ? (
        <CustomComponentModal
          draft={customDraft}
          onChange={setCustomDraft}
          onCancel={() => setCustomDraft(null)}
          onSubmit={submitCustomDraft}
        />
      ) : null}
    </div>
  );
}

interface ListingCardProps {
  listing: Listing;
  onUpdateInstanceNotes: (instanceId: string, notes: string) => void;
  onUpdateInstanceName: (instanceId: string, displayName: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onUpdateCustomComponent: (id: string, patch: Partial<Omit<CustomRulebookComponent, 'id'>>) => void;
  onRemoveCustomComponent: (id: string) => void;
}

function ListingCard({
  listing,
  onUpdateInstanceNotes,
  onUpdateInstanceName,
  onRemoveInstance,
  onUpdateCustomComponent,
  onRemoveCustomComponent,
}: ListingCardProps) {
  if (listing.kind === 'catalog') {
    const manifest = getBuiltInComponentManifest(listing.componentType as BuiltInComponentType);
    return (
      <div data-layout="componentsChapterCard" data-card-kind="catalog" style={cardStyle}>
        <div data-layout="componentsChapterCardHeader" style={cardHeaderStyle}>
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
          <input
            value={listing.name}
            onChange={(event) => onUpdateInstanceName(listing.instanceId, event.target.value)}
            placeholder="Component name"
            aria-label="Component name"
            style={nameInputStyle}
          />
          <span style={typeBadgeStyle} title={manifest.description}>
            {manifest.displayName}
          </span>
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
        <textarea
          value={listing.description}
          onChange={(event) => onUpdateInstanceNotes(listing.instanceId, event.target.value)}
          placeholder="Describe this component for the rulebook…"
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
