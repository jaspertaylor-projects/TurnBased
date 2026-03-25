import { useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import { getBuiltInComponentManifest } from '@turnbased/engine-components';
import type { BuiltInComponentType } from '@turnbased/engine-components';

import { renderComponentIcon } from '../componentMeta';
import { SECTION_OPTIONS } from '../constants';
import type { ComponentEditorMode, EditorSection } from '../constants';
import { panelStyle, inputStyle, sidebarSectionStyle, textareaStyle } from '../styles';
import type { EditorProject } from '../types';

function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Unknown Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

function getComponentSubtitle(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  if (instance.componentType === 'piece' || instance.componentType === 'token') {
    const parentLabel = instance.parentId ? getComponentLabel(project, String(instance.parentId)) : 'Unplaced';
    return `Movable ${manifest.displayName.toLowerCase()} · ${parentLabel}`;
  }

  return manifest.displayName;
}

function SectionButton({
  active,
  label,
  onClick,
  action,
  onMouseEnter,
  onMouseLeave,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  action?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '0.35rem',
        borderRadius: '14px',
        background: active ? 'rgba(16,185,129,0.14)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          textAlign: 'left',
          padding: '0.46rem 0.5rem',
          borderRadius: '14px',
          border: 'none',
          background: 'transparent',
          color: active ? '#064e3b' : '#0f766e',
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.88rem',
          fontWeight: active ? 700 : 500,
          minWidth: 0,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label.toLowerCase()}
        </span>
      </button>
      {action ? <div style={{ paddingRight: '0.25rem' }}>{action}</div> : null}
    </div>
  );
}

export function EditorSidebar({
  project,
  activeSection,
  setActiveSection,
  boardCount,
  supportZoneCount,
  componentCount,
  componentOutlineIds,
  selectedOutlineComponentId,
  componentEditorMode,
  onOpenComponentEditor,
  onStartCreateComponent,
  onSelectOutlineComponent,
  onRenameProject,
  onUpdateDescription,
}: {
  project: EditorProject;
  activeSection: EditorSection;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  boardCount: number;
  supportZoneCount: number;
  componentCount: number;
  componentOutlineIds: string[];
  selectedOutlineComponentId: string | null;
  componentEditorMode: ComponentEditorMode;
  onOpenComponentEditor: () => void;
  onStartCreateComponent: () => void;
  onSelectOutlineComponent: (instanceId: string) => void;
  onRenameProject: (name: string) => void;
  onUpdateDescription: (description: string) => void;
}) {
  const [hoveredSection, setHoveredSection] = useState<EditorSection | null>(null);

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
          if (section.id === 'component_editor') {
            const isActive = activeSection === 'component_editor';
            const showCreateAction = hoveredSection === 'component_editor';

            return (
              <div key={section.id} style={{ display: 'grid', gap: '0.2rem' }}>
                <SectionButton
                  active={isActive}
                  label={section.label}
                  onClick={onOpenComponentEditor}
                  onMouseEnter={() => setHoveredSection('component_editor')}
                  onMouseLeave={() => setHoveredSection((current) => (current === 'component_editor' ? null : current))}
                  action={(
                    <button
                      type="button"
                      title="Make new component"
                      aria-label="Make new component"
                      onClick={(event) => {
                        event.stopPropagation();
                        onStartCreateComponent();
                      }}
                      style={{
                        width: '26px',
                        height: '26px',
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '999px',
                        border: '1px solid rgba(15,118,110,0.16)',
                        background: showCreateAction ? 'rgba(255,255,255,0.88)' : 'transparent',
                        color: showCreateAction ? '#064e3b' : 'rgba(15,118,110,0)',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                />

                {isActive ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.18rem',
                      marginLeft: '0.8rem',
                      paddingLeft: '0.5rem',
                      borderLeft: '1px solid rgba(15,118,110,0.12)',
                    }}
                  >
                    {componentOutlineIds.length > 0 ? componentOutlineIds.map((instanceId) => {
                      const instance = project.instances[instanceId];
                      if (!instance) {
                        return null;
                      }

                      const isSelected = selectedOutlineComponentId === instanceId && componentEditorMode === 'edit';

                      return (
                        <button
                          key={instanceId}
                          type="button"
                          onClick={() => onSelectOutlineComponent(instanceId)}
                          style={{
                            textAlign: 'left',
                            padding: '0.45rem 0.5rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: isSelected ? 'rgba(249,115,22,0.12)' : 'transparent',
                            color: isSelected ? '#9a3412' : '#0f766e',
                            display: 'grid',
                            gap: '0.14rem',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              minWidth: 0,
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 700 : 600,
                            }}
                          >
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '7px',
                                display: 'grid',
                                placeItems: 'center',
                                background: isSelected ? 'rgba(255,237,213,0.95)' : 'rgba(255,255,255,0.82)',
                                border: '1px solid rgba(15,118,110,0.1)',
                                flex: '0 0 auto',
                              }}
                            >
                              {renderComponentIcon(instance.componentType, {
                                size: 12,
                                style: { color: isSelected ? '#c2410c' : '#0f766e' },
                              })}
                            </span>
                            <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getComponentLabel(project, instanceId)}
                            </span>
                          </span>
                          <span style={{ paddingLeft: '1.65rem', fontSize: '0.72rem', color: isSelected ? '#c2410c' : '#6b7280' }}>
                            {getComponentSubtitle(project, instanceId)}
                          </span>
                        </button>
                      );
                    }) : (
                      <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', color: '#6b7280' }}>
                        No outline components yet.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          }

          const isActive = section.id === activeSection;
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
