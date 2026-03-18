import type { Dispatch, SetStateAction } from 'react';

import { SECTION_OPTIONS } from '../constants';
import { panelStyle, inputStyle, sidebarSectionStyle, textareaStyle } from '../styles';
import type { EditorProject } from '../types';
import type { EditorSection } from '../constants';

export function EditorSidebar({
  project,
  activeSection,
  setActiveSection,
  boardCount,
  supportZoneCount,
  componentCount,
  onRenameProject,
  onUpdateDescription,
}: {
  project: EditorProject;
  activeSection: EditorSection;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  boardCount: number;
  supportZoneCount: number;
  componentCount: number;
  onRenameProject: (name: string) => void;
  onUpdateDescription: (description: string) => void;
}) {
  return (
    <aside
      style={{
        ...panelStyle,
        flex: '0 0 228px',
        width: '228px',
        minHeight: 'calc(100vh - 88px)',
        position: 'sticky',
        top: '88px',
        alignSelf: 'start',
        padding: '0.8rem 0.7rem',
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
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                textAlign: 'left',
                padding: '0.42rem 0.5rem',
                borderRadius: 0,
                border: 'none',
                background: isActive ? 'rgba(16,185,129,0.14)' : 'transparent',
                color: isActive ? '#064e3b' : '#0f766e',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <span>{section.label.toLowerCase()}</span>
            </button>
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
