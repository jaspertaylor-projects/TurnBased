import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

import { inputStyle, labelStyle, textareaStyle } from '../../styles';
import type { EditorArtReference } from '../../types';
import { formatTagList, parseTagList } from './artUtils';

export function ArtReferenceCard({
  item,
  categoryLabel,
  categoryPlaceholder,
  showCategory = true,
  showTags = true,
  showHeader = true,
  collapsible = false,
  namePlaceholder = 'Harbor captain',
  descriptionPlaceholder = 'Describe the silhouette, material language, outfit, or environmental cues we should keep consistent.',
  onChange,
  onRemove,
}: {
  item: EditorArtReference;
  categoryLabel?: string;
  categoryPlaceholder?: string;
  showCategory?: boolean;
  showTags?: boolean;
  showHeader?: boolean;
  collapsible?: boolean;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  onChange: (next: EditorArtReference) => void;
  onRemove: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div style={{ borderRadius: '18px', border: '1px solid rgba(15,118,110,0.1)', background: 'rgba(248,250,252,0.86)', padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
      {showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ color: '#064e3b', fontWeight: 700 }}>{item.name.trim() || 'Untitled Asset'}</div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete asset"
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '999px',
              border: '1px solid rgba(239,68,68,0.18)',
              background: 'rgba(254,242,242,0.96)',
              color: '#b91c1c',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: showCategory ? 'minmax(0, 1.2fr) minmax(0, 0.8fr)' : 'minmax(0, 1fr)', gap: '0.75rem' }}>
        {showHeader ? (
          <label style={labelStyle}>
            Name
            <input
              value={item.name}
              onChange={(event) => onChange({ ...item, name: event.target.value })}
              placeholder={namePlaceholder}
              style={inputStyle}
            />
          </label>
        ) : null}
        {showCategory ? (
          <label style={labelStyle}>
            {categoryLabel}
            <input
              value={item.category}
              onChange={(event) => onChange({ ...item, category: event.target.value })}
              placeholder={categoryPlaceholder}
              style={inputStyle}
            />
          </label>
        ) : null}
      </div>

      {!showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => collapsible ? setIsCollapsed((current) => !current) : undefined}
            aria-label={collapsible ? (isCollapsed ? 'Expand art style' : 'Collapse art style') : undefined}
            aria-expanded={collapsible ? !isCollapsed : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.2rem 0',
              border: 'none',
              background: 'none',
              cursor: collapsible ? 'pointer' : 'default',
              textAlign: 'left',
              color: '#064e3b',
            }}
          >
            <div style={{ minWidth: 0, display: 'grid', gap: '0.12rem', flex: 1 }}>
              <div style={{ color: '#064e3b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name.trim() || 'Unnamed Style'}
              </div>
            </div>
            {collapsible ? (
              <ChevronDown
                size={16}
                style={{
                  color: '#0d9488',
                  flexShrink: 0,
                  transition: 'transform 180ms ease',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              />
            ) : null}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete asset"
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '999px',
              border: '1px solid rgba(239,68,68,0.18)',
              background: 'rgba(254,242,242,0.96)',
              color: '#b91c1c',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      {!collapsible || !isCollapsed ? (
        <>
          {!showHeader ? (
            <label style={labelStyle}>
              Name
              <input
                value={item.name}
                onChange={(event) => onChange({ ...item, name: event.target.value })}
                placeholder={namePlaceholder}
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={labelStyle}>
            Description
            <textarea
              value={item.description}
              onChange={(event) => onChange({ ...item, description: event.target.value })}
              placeholder={descriptionPlaceholder}
              style={{ ...textareaStyle, minHeight: '88px' }}
            />
          </label>
        </>
      ) : null}

      {showTags ? (
        <label style={labelStyle}>
          Tags
          <input
            value={formatTagList(item.tags)}
            onChange={(event) => onChange({ ...item, tags: parseTagList(event.target.value) })}
            placeholder="boss, undead, swamp, brass"
            style={inputStyle}
          />
        </label>
      ) : null}
    </div>
  );
}
