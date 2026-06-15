import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import {
  BarChart3, BookOpen, Check, ChevronDown, GitBranch, LayoutPanelTop, Palette, Plus,
  Save, Shapes, Sparkles, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SECTION_OPTIONS } from '../constants';
import type { EditorSection } from '../constants';
import { panelStyle } from '../styles';
import { tabletop } from '../theme/tabletop';
import type { EditorProject } from '../types';

const SECTION_ICONS: Record<EditorSection, LucideIcon> = {
  rules: BookOpen,
  stats: BarChart3,
  art: Palette,
  component_editor: Shapes,
  versions: GitBranch,
  app_layout: LayoutPanelTop,
};

function SectionButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: '0.5rem 0.6rem 0.5rem 0.7rem',
        borderRadius: '11px',
        border: active ? `1px solid ${tabletop.brass.base}` : '1px solid transparent',
        background: active
          ? 'linear-gradient(180deg, rgba(216,185,119,0.32), rgba(184,146,78,0.18))'
          : 'transparent',
        color: active ? tabletop.ink.strong : tabletop.ink.soft,
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        fontSize: '0.9rem',
        fontWeight: active ? 800 : 600,
        minWidth: 0,
        cursor: 'pointer',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.4)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(184,146,78,0.10)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* brass rail marks the active section like a tab on a binder */}
      {active ? (
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 999, background: tabletop.brass.deep }} />
      ) : null}
      <Icon size={16} style={{ flexShrink: 0, color: active ? tabletop.brass.deep : tabletop.ink.faint }} />
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
  versionOptions,
  onSaveVersion,
  onSwitchVersion,
  onCreateVersion,
  notice,
  onDismissNotice,
}: {
  project: EditorProject;
  activeSection: EditorSection;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  activeVersionName: string;
  /** All saved versions (branches) with the active one flagged, for the
   * version-switch dropdown opened from the branch icon. */
  versionOptions: Array<{ name: string; isActive: boolean }>;
  /**
   * Opens the component editor section. Always lands on the intermediate
   * gallery view — the plus-icon and inline outline list were removed since
   * they duplicated the gallery's affordances.
   */
  onOpenComponentEditor: () => void;
  onRenameProject: (name: string) => void;
  onSaveVersion: () => void;
  onSwitchVersion: (name: string) => void;
  onCreateVersion: (name: string) => void;
  /** Transient status line (save confirmations, errors). Rendered as a small
   * dismissible chip tucked into the header so it never covers the canvas. */
  notice: string | null;
  onDismissNotice: () => void;
}) {
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [nextVersionName, setNextVersionName] = useState('');

  function closeVersionMenu() {
    setIsVersionMenuOpen(false);
    setIsCreatingVersion(false);
    setNextVersionName('');
  }

  function submitVersionName() {
    const trimmed = nextVersionName.trim();
    if (!trimmed) return;
    onCreateVersion(trimmed);
    closeVersionMenu();
  }

  // Close the version dropdown on Escape for keyboard parity with click-away.
  useEffect(() => {
    if (!isVersionMenuOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVersionMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVersionMenuOpen]);

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
        borderRight: `2px solid ${tabletop.brass.deep}`,
        boxShadow: '6px 0 18px rgba(36,22,8,0.22)',
      }}
    >
      <div
        data-layout="editorProjectHeader"
        /* project header keeps the game title, version switcher, and save control as one identity block */
        style={{
          position: 'relative',
          marginBottom: '0.7rem',
          paddingBottom: '0.68rem',
          borderBottom: `1px solid ${tabletop.parchment.edge}`,
        }}
      >
        <div
          data-layout="editorProjectNameRow"
          /* project name row with a save icon beside it for one-click version commits */
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 32px', gap: '0.35rem', alignItems: 'center' }}
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
              minWidth: 0,
            }}
          />
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

        <button
          type="button"
          data-layout="editorVersionSwitcher"
          /* version-control pill: opens the version-switch dropdown (and the
             new-version action lives inside it — there is no separate +) */
          onClick={() => setIsVersionMenuOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={isVersionMenuOpen}
          title="Switch version"
          style={{
            marginTop: '0.42rem',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.34rem',
            minWidth: 0,
            borderRadius: '999px',
            border: '1px solid rgba(15,118,110,0.16)',
            background: isVersionMenuOpen ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.6)',
            color: '#0f766e',
            fontSize: '0.74rem',
            fontWeight: 600,
            lineHeight: 1.2,
            padding: '0.3rem 0.5rem',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <GitBranch size={13} style={{ flex: '0 0 auto' }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeVersionName}
          </span>
          <ChevronDown
            size={13}
            style={{ flex: '0 0 auto', marginLeft: 'auto', transition: 'transform 0.15s', transform: isVersionMenuOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {isVersionMenuOpen ? (
          <>
            <div
              data-layout="editorVersionMenuBackdrop"
              /* invisible click-away layer that dismisses the dropdown */
              onClick={closeVersionMenu}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />
            <div
              data-layout="editorVersionMenu"
              /* version-switch dropdown: pick a saved version, or start a new one */
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% - 0.4rem)',
                left: 0,
                right: 0,
                zIndex: 50,
                display: 'grid',
                gap: '0.12rem',
                padding: '0.35rem',
                borderRadius: '14px',
                border: '1px solid rgba(15,118,110,0.16)',
                background: 'rgba(255,255,255,0.98)',
                boxShadow: '0 18px 40px rgba(6,78,59,0.18)',
                maxHeight: '50vh',
                overflowY: 'auto',
              }}
            >
              <div
                data-layout="editorVersionMenuLabel"
                /* small section label above the version list */
                style={{ padding: '0.15rem 0.4rem 0.2rem', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#0f766e' }}
              >
                Switch version
              </div>
              {versionOptions.length === 0 ? (
                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.74rem', color: '#0f766e' }}>
                  No saved versions yet.
                </div>
              ) : (
                versionOptions.map((option) => (
                  <button
                    key={option.name}
                    type="button"
                    role="option"
                    aria-selected={option.isActive}
                    onClick={() => {
                      if (!option.isActive) onSwitchVersion(option.name);
                      closeVersionMenu();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '10px',
                      border: 'none',
                      background: option.isActive ? 'rgba(16,185,129,0.14)' : 'transparent',
                      color: option.isActive ? '#064e3b' : '#0f766e',
                      fontSize: '0.78rem',
                      fontWeight: option.isActive ? 800 : 600,
                      padding: '0.4rem 0.45rem',
                      cursor: 'pointer',
                      minWidth: 0,
                    }}
                  >
                    <GitBranch size={13} style={{ flex: '0 0 auto' }} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {option.name}
                    </span>
                    {option.isActive ? <Check size={13} style={{ flex: '0 0 auto', marginLeft: 'auto', color: '#0d9488' }} /> : null}
                  </button>
                ))
              )}

              <div style={{ height: 1, background: 'rgba(15,118,110,0.12)', margin: '0.2rem 0.2rem' }} />

              {isCreatingVersion ? (
                <div
                  data-layout="editorNewVersionForm"
                  /* compact inline form for naming a new local version branch */
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.3rem', padding: '0.15rem 0.2rem 0.25rem' }}
                >
                  <input
                    value={nextVersionName}
                    onChange={(event) => setNextVersionName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitVersionName();
                      if (event.key === 'Escape') closeVersionMenu();
                    }}
                    placeholder="powerful spells"
                    aria-label="New version name"
                    autoFocus
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
              ) : (
                <button
                  type="button"
                  data-layout="editorNewVersionAction"
                  /* opens the inline name form for a fresh version branch */
                  onClick={() => setIsCreatingVersion(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#0d9488',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.45rem',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} style={{ flex: '0 0 auto' }} />
                  New version
                </button>
              )}
            </div>
          </>
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
          const Icon = SECTION_ICONS[section.id];
          if (section.id === 'component_editor') {
            return (
              <SectionButton
                key={section.id}
                active={isActive}
                label={section.label}
                icon={Icon}
                onClick={onOpenComponentEditor}
              />
            );
          }
          return (
            <SectionButton
              key={section.id}
              active={isActive}
              label={section.label}
              icon={Icon}
              onClick={() => setActiveSection(section.id)}
            />
          );
        })}
      </div>

    </aside>
  );
}
