import type { Dispatch, SetStateAction } from 'react';

import { SECTION_OPTIONS } from '../constants';
import type { EditorSection } from '../constants';
import { panelStyle, inputStyle, sidebarSectionStyle, textareaStyle } from '../styles';
import type { EditorProject } from '../types';

function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '0.46rem 0.5rem',
        borderRadius: '14px',
        border: 'none',
        background: active ? 'rgba(16,185,129,0.14)' : 'transparent',
        color: active ? '#064e3b' : '#0f766e',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.88rem',
        fontWeight: active ? 700 : 500,
        minWidth: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label.toLowerCase()}
      </span>
    </button>
  );
}

export function EditorSidebar({
  project,
  activeSection,
  setActiveSection,
  boardCount,
  supportZoneCount,
  componentCount,
  onOpenComponentEditor,
  onRenameProject,
  onUpdateDescription,
}: {
  project: EditorProject;
  activeSection: EditorSection;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  boardCount: number;
  supportZoneCount: number;
  componentCount: number;
  /**
   * Opens the component editor section. Always lands on the intermediate
   * gallery view — the plus-icon and inline outline list were removed since
   * they duplicated the gallery's affordances.
   */
  onOpenComponentEditor: () => void;
  onRenameProject: (name: string) => void;
  onUpdateDescription: (description: string) => void;
}) {
  return (
    <aside
      style={{
        ...panelStyle,
        width: '228px',
        boxSizing: 'border-box',
        height: '100%',
        overflow: 'auto',
        padding: '0.5rem 0.7rem 0.8rem 0.7rem',
        borderRadius: 0,
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: '1px solid rgba(15,118,110,0.12)',
        boxShadow: 'none',
      }}
    >
      <div style={{ marginBottom: '0.7rem' }}>
        <input
          value={project.name}
          onChange={(event) => onRenameProject(event.target.value)}
          aria-label="Project name"
          style={{
            width: '100%',
            border: 'none',
            borderBottom: '1px solid rgba(15,118,110,0.12)',
            background: 'transparent',
            color: '#064e3b',
            fontSize: '1rem',
            fontWeight: 800,
            lineHeight: 1.25,
            padding: '0 0 0.45rem 0',
            borderRadius: 0,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: '0.15rem' }}>
        {SECTION_OPTIONS.map((section) => {
          const isActive = section.id === activeSection;
          // Component editor gets its own click handler so clicking the sidebar
          // button drops the user into the intermediate gallery view instead of
          // an arbitrary component.
          if (section.id === 'component_editor') {
            return (
              <SectionButton
                key={section.id}
                active={isActive}
                label={section.label}
                onClick={onOpenComponentEditor}
              />
            );
          }
          return (
            <SectionButton
              key={section.id}
              active={isActive}
              label={section.label}
              onClick={() => setActiveSection(section.id)}
            />
          );
        })}
      </div>

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.45rem' }}>
        <details style={sidebarSectionStyle}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '0.55rem 0.7rem', fontWeight: 700, color: '#064e3b', fontSize: '0.82rem' }}>
            Workspace
          </summary>
          <div style={{ padding: '0 0.7rem 0.7rem 0.7rem', display: 'grid', gap: '0.55rem' }}>
            <input
              value={project.name}
              onChange={(event) => onRenameProject(event.target.value)}
              style={{ ...inputStyle, padding: '0.55rem 0.65rem', fontSize: '0.82rem', borderRadius: 0 }}
            />
            <textarea
              value={project.description}
              onChange={(event) => onUpdateDescription(event.target.value)}
              style={{ ...textareaStyle, minHeight: '70px', padding: '0.55rem 0.65rem', fontSize: '0.82rem', borderRadius: 0 }}
            />
          </div>
        </details>

        <details style={sidebarSectionStyle}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '0.55rem 0.7rem', fontWeight: 700, color: '#064e3b', fontSize: '0.82rem' }}>
            Stats
          </summary>
          <div style={{ padding: '0 0.7rem 0.7rem 0.7rem', display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.78rem' }}>
            <div>{project.seats.length} players</div>
            <div>{componentCount} components</div>
            <div>{boardCount} boards</div>
            <div>{supportZoneCount} top-level zones</div>
          </div>
        </details>
      </div>
    </aside>
  );
}
