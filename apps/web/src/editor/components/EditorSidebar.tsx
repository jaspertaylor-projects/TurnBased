import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { GitBranch, Plus, Save, Sparkles, X } from 'lucide-react';

import { SECTION_OPTIONS } from '../constants';
import type { EditorSection } from '../constants';
import { panelStyle } from '../styles';
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
  onOpenComponentEditor,
  onRenameProject,
  activeVersionName,
  onSaveVersion,
  onCreateVersion,
  notice,
  onDismissNotice,
}: {
  project: EditorProject;
  activeSection: EditorSection;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  activeVersionName: string;
  /**
   * Opens the component editor section. Always lands on the intermediate
   * gallery view — the plus-icon and inline outline list were removed since
   * they duplicated the gallery's affordances.
   */
  onOpenComponentEditor: () => void;
  onRenameProject: (name: string) => void;
  onSaveVersion: () => void;
  onCreateVersion: (name: string) => void;
  /** Transient status line (save confirmations, errors). Rendered as a small
   * dismissible chip tucked into the header so it never covers the canvas. */
  notice: string | null;
  onDismissNotice: () => void;
}) {
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [nextVersionName, setNextVersionName] = useState('');

  function submitVersionName() {
    const trimmed = nextVersionName.trim();
    if (!trimmed) return;
    onCreateVersion(trimmed);
    setNextVersionName('');
    setIsCreatingVersion(false);
  }

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
      <div
        data-layout="editorProjectHeader"
        /* project header keeps the game title, active version, and save control as one identity block */
        style={{
          marginBottom: '0.7rem',
          paddingBottom: '0.68rem',
          borderBottom: '1px solid rgba(15,118,110,0.12)',
        }}
      >
        <div
          data-layout="editorProjectNameRow"
          /* project name row with a save icon beside it for one-click version commits */
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 32px', gap: '0.35rem', alignItems: 'start' }}
        >
          <div
            data-layout="editorProjectTitleStack"
            /* title stack makes the active version read as a subtitle under the game name */
            style={{ display: 'grid', gap: '0.18rem', minWidth: 0 }}
          >
            <input
              value={project.name}
              onChange={(event) => onRenameProject(event.target.value)}
              aria-label="Project name"
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: '#064e3b',
                fontSize: '1rem',
                fontWeight: 800,
                lineHeight: 1.18,
                padding: 0,
                borderRadius: 0,
                boxSizing: 'border-box',
              }}
            />
            <div
              data-layout="editorVersionSubtitle"
              /* active version subtitle belongs to the project title rather than the section nav */
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: 0,
                color: '#0f766e',
                fontSize: '0.74rem',
                lineHeight: 1.25,
              }}
            >
              <GitBranch size={12} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                version: {activeVersionName}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingVersion((value) => !value)}
                aria-label="Create new version"
                title="Create new version"
                style={{
                  width: 19,
                  height: 19,
                  marginLeft: 'auto',
                  borderRadius: '999px',
                  border: '1px solid rgba(15,118,110,0.14)',
                  background: 'rgba(255,255,255,0.72)',
                  color: '#0d9488',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onSaveVersion}
            aria-label="Save current version"
            title="Save current version"
            style={{
              width: 30,
              height: 30,
              borderRadius: '999px',
              border: '1px solid rgba(15,118,110,0.18)',
              background: 'rgba(240,253,244,0.9)',
              color: '#064e3b',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Save size={15} />
          </button>
        </div>
        {isCreatingVersion ? (
          <div
            data-layout="editorNewVersionForm"
            /* compact inline form for naming a new local version branch */
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.3rem', marginTop: '0.55rem' }}
          >
            <input
              value={nextVersionName}
              onChange={(event) => setNextVersionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitVersionName();
                if (event.key === 'Escape') setIsCreatingVersion(false);
              }}
              placeholder="powerful spells"
              aria-label="New version name"
              style={{
                minWidth: 0,
                borderRadius: '9px',
                border: '1px solid rgba(15,118,110,0.16)',
                padding: '0.34rem 0.45rem',
                color: '#064e3b',
                fontSize: '0.74rem',
              }}
            />
            <button
              type="button"
              onClick={submitVersionName}
              disabled={!nextVersionName.trim()}
              style={{
                borderRadius: '9px',
                border: 'none',
                background: nextVersionName.trim() ? '#0d9488' : 'rgba(13,148,136,0.25)',
                color: 'white',
                padding: '0.34rem 0.5rem',
                fontWeight: 800,
                cursor: nextVersionName.trim() ? 'pointer' : 'default',
                fontSize: '0.72rem',
              }}
            >
              Add
            </button>
          </div>
        ) : null}

        {notice ? (
          <div
            data-layout="editorNoticeChip"
            /* small dismissible status chip tucked under the project header so
               transient save/error notices live in the sidebar instead of
               floating over the canvas */
            style={{
              marginTop: '0.6rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.4rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '12px',
              background: 'rgba(255,247,237,0.92)',
              border: '1px solid rgba(249,115,22,0.22)',
              color: '#9a3412',
              fontSize: '0.72rem',
              lineHeight: 1.3,
              boxShadow: '0 6px 14px rgba(124,45,18,0.1)',
            }}
          >
            <Sparkles size={13} style={{ flex: '0 0 auto', marginTop: 1, color: '#c2410c' }} />
            <span style={{ minWidth: 0, flex: '1 1 auto', wordBreak: 'break-word' }}>{notice}</span>
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label="Dismiss notice"
              title="Dismiss"
              style={{
                flex: '0 0 auto',
                width: 16,
                height: 16,
                borderRadius: '999px',
                border: 'none',
                background: 'transparent',
                color: '#c2410c',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}
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

    </aside>
  );
}
