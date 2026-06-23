import { useEffect, useState } from 'react';
import { useUndoRedo, useUndoRedoKeyboard } from '../editor/useUndoRedo';
import {
  addProjectComponent,
  duplicateComponentSubtree,
  listValidParents,
  removeComponentInstance,
  renameProject,
  syncAllGeneratedBoardChildren,
  syncGeneratedBoardChildren,
  updateComponentInstance,
  updateProjectAppLayout,
  updateProjectArt,
  appendBriefList,
  updateProjectBrief,
  updateProjectRules,
  updateProjectSettings,
} from '../editor/project';
import { loadEditorProject, saveEditorProject } from '../editor/storage';
import {
  buildPreviewRuntime,
} from '../editor/runtime';
import type { EditorProject } from '../editor/types';
import { DEFAULT_EDITOR_SECTION, SECTION_OPTIONS } from '../editor/constants';
import type { EditorSection } from '../editor/constants';
import { readProjectIdFromHash } from '../editor/helpers';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { VisualsSection } from '../editor/sections/VisualsSection';
import { ComponentGallery } from '../editor/sections/ComponentGallery';
import { VersionsSection } from '../editor/sections/VersionsSection';
import { AppLayoutSection } from '../editor/sections/AppLayoutSection';
import { ArtSection, STUDIO_BG_VALUE } from '../editor/sections/ArtSection';
import { RulesSection } from '../editor/sections/RulesSection';
import { StatsSection } from '../editor/sections/StatsSection';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import type { CatalogComponentSelection } from '../editor/sections/rules/ComponentPicker';
import type { NewComponentCatalog } from '../editor/sections/rules/NewComponentDialog';
import {
  commitActiveProjectVersion,
  createProjectVersionBranch,
  DEFAULT_VERSION_BRANCH_NAME,
  getProjectGitStatus,
  getProjectVersionGraph,
  restoreProjectFromCommit,
} from '../editor/git';
import { createWorkspaceFiles } from '../editor/shipping';
import { saveProjectWorkspace } from '../editor/workspace';
import { GrassBackdrop } from '../components/GrassBackdrop';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const GRASS_BACKDROP_HEIGHT = 55;
/** Width of the editor sidebar drawer when open (the closed width is 0). */
const SIDEBAR_WIDTH = 232;
/** localStorage key remembering whether the sidebar drawer is open. */
const SIDEBAR_OPEN_KEY = 'turnbased.editor.sidebarOpen';
/** Shared easing so the grid column and the panel slide stay perfectly in sync. */
const SIDEBAR_TRANSITION = 'transform 0.28s ease, left 0.28s ease, grid-template-columns 0.28s ease';
/** Width of the drawer-pull rail that rides the sidebar's right edge. */
const RAIL_WIDTH = 20;
/** Radius on the rail's free (exposed) edge so it reads as a rounded pull tab. */
const RAIL_RADIUS = 10;
/** Drawer-pull tones drawn from the existing palette: the leafy forest green
 *  (tabletop.forest.bright) and the warm ink-brown already used on the parchment
 *  rulebook pages. The rail is a solid fill with a contrasting border + chevron;
 *  hover swaps fill and accent (see hover handlers). */
const RAIL_GREEN = '#3f9168';
const RAIL_BROWN = '#3b2412';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

// Component types that represent physical, designable game objects.
// These appear in the Component Gallery. `tile` and `deck` are now authorable
// top-level types (the gallery's "New component" menu lists them alongside
// `board`), so they must also show up in the gallery listing. Conceptual
// types (zone, hand, discard, bag, counter, score-track, network, track)
// belong in App Layout where the creator configures placement and
// game-structure concerns.
const COMPONENT_EDITOR_TYPES = new Set(['board', 'tile', 'deck', 'piece', 'token', 'card']);

function isMovableTemplateType(componentType: string): boolean {
  return componentType === 'piece' || componentType === 'token';
}

function listComponentOutlineIds(project: EditorProject): string[] {
  const movableTemplateIds = Object.values(project.instances)
    .filter((instance) => isMovableTemplateType(instance.componentType))
    .map((instance) => String(instance.instanceId));

  const designableRootIds = project.rootInstanceIds.filter(
    (instanceId) => COMPONENT_EDITOR_TYPES.has(project.instances[instanceId]?.componentType ?? ''),
  );

  return Array.from(new Set([...designableRootIds, ...movableTemplateIds]));
}

export const Editor = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const projectHistory = useUndoRedo<EditorProject | null>(null);
  const {
    value: project,
    set: setProject,
    undo: undoProject,
    redo: redoProject,
    reset: resetProjectHistory,
  } = projectHistory;
  const [activeSection, setActiveSection] = useState<EditorSection>(DEFAULT_EDITOR_SECTION);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [paletteOwnerId] = useState<string | null>('player_one');
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  // The sidebar behaves like a drawer: it slides out of view and the canvas
  // reclaims the space. The open/closed choice is remembered across sessions.
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false';
  });
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    const syncRoute = () => {
      const nextProjectId = readProjectIdFromHash();
      const loadedProject = nextProjectId ? loadEditorProject(nextProjectId) : null;
      const nextProject = loadedProject ? syncAllGeneratedBoardChildren(loadedProject) : null;
      const pendingNotice = window.sessionStorage.getItem(PENDING_EDITOR_NOTICE_KEY);

      setProjectId(nextProjectId);
      resetProjectHistory(nextProject);
      setActiveSection(DEFAULT_EDITOR_SECTION);
      setSelectedComponentId(null);
      setEditorNotice(pendingNotice);
      if (pendingNotice) {
        window.sessionStorage.removeItem(PENDING_EDITOR_NOTICE_KEY);
      }
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [resetProjectHistory]);

  useEffect(() => {
    if (!project) {
      return;
    }

    saveEditorProject(project);
  }, [project]);

  useEffect(() => {
    if (!project || project.phase !== 'ready') {
      return;
    }

    const runtime = buildPreviewRuntime(project);
    saveProjectWorkspace(project.id, createWorkspaceFiles(project, runtime));
  }, [project]);

  useUndoRedoKeyboard(undoProject, redoProject);

  const runtime = project ? buildPreviewRuntime(project) : null;
  const resolvedSelectedComponentId = project && selectedComponentId && project.instances[selectedComponentId]
    ? selectedComponentId
    : null;
  const selectedComponent = project && resolvedSelectedComponentId ? project.instances[resolvedSelectedComponentId] ?? null : null;

  if (!projectId) {
    return <div style={{ padding: '2rem' }}>Loading project...</div>;
  }

  if (!project || !runtime) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Project not found</h1>
        <p>This local project could not be loaded. Create a new workspace from the dashboard and try again.</p>
        <a href="#/dashboard">Back to Dashboard</a>
      </div>
    );
  }

  if (project.phase !== 'ready') {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Build this project with AI first</h1>
        <p>This workspace is still in the setup phase. Finish making the game before opening the post-build editor.</p>
        <a href="#/new">Back to new game</a>
      </div>
    );
  }

  const currentProject = project;
  const currentRuntime = runtime;
  const currentSectionMeta = SECTION_OPTIONS.find((section) => section.id === activeSection) ?? SECTION_OPTIONS[0];
  const componentOutlineIds = listComponentOutlineIds(currentProject);
  const gitStatus = getProjectGitStatus(currentProject, currentRuntime);
  const versionGraph = getProjectVersionGraph(currentProject.id);

  // Map each version (branch) to its head commit so the sidebar dropdown can
  // switch versions. Commits arrive newest-first, so the first one seen per
  // branch is its head.
  const branchHeadShas = new Map<string, string>();
  versionGraph.commits.forEach((commit) => {
    const branchName = commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME;
    if (!branchHeadShas.has(branchName)) {
      branchHeadShas.set(branchName, commit.commitSha);
    }
  });
  const versionOptions = Array.from(branchHeadShas.keys()).map((name) => ({
    name,
    isActive: name === versionGraph.activeBranchName,
  }));

  function commitProject(nextProject: EditorProject) {
    setProject(nextProject);
    setEditorNotice(null);
  }

  async function handleSaveVersion() {
    try {
      const result = await commitActiveProjectVersion(currentProject, currentRuntime);
      if (result.project !== currentProject) {
        setProject(result.project);
      }
      setEditorNotice(
        result.remoteError
          ? `Saved locally. Remote sync is unavailable right now: ${result.remoteError}`
          : `Saved ${result.commit.message}.`,
      );
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to save this version.');
    }
  }

  async function handleCreateVersion(branchName: string) {
    try {
      const result = await createProjectVersionBranch(currentProject, currentRuntime, branchName);
      if (result.project !== currentProject) {
        setProject(result.project);
      }
      setActiveSection('versions');
      setEditorNotice(
        result.remoteError
          ? `Created "${branchName}" locally. Remote sync is unavailable right now: ${result.remoteError}`
          : `Created "${branchName}".`,
      );
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to create that version branch.');
    }
  }

  function handleSwitchVersion(branchName: string) {
    const headSha = branchHeadShas.get(branchName);
    if (!headSha || headSha === versionGraph.activeCommitSha) {
      return;
    }
    try {
      const restoredProject = restoreProjectFromCommit(currentProject.id, headSha);
      resetProjectHistory(restoredProject);
      setSelectedComponentId(null);
      setEditorNotice(`Switched to ${branchName}.`);
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to switch versions.');
    }
  }

  function handleAddComponent(
    type: BuiltInComponentType,
    preferredParentId?: string | null,
    options: {
      focusNewComponent?: boolean;
      initializeComponent?: (instance: ComponentInstanceModel) => ComponentInstanceModel;
    } = {},
  ) {
    const focusNewComponent = options.focusNewComponent ?? true;
    const initializeComponent = options.initializeComponent;
    const validParentIds = listValidParents(currentProject, type).map((instance) => String(instance.instanceId));
    const resolvedParentId = preferredParentId === undefined
      ? (
        selectedComponentId && validParentIds.includes(selectedComponentId)
          ? selectedComponentId
          : validParentIds[0] ?? null
      )
      : preferredParentId;
    const result = addProjectComponent(currentProject, type, resolvedParentId, paletteOwnerId);

    if (result.issue) {
      setEditorNotice(result.issue);
      return null;
    }

    const initializedProject = result.instanceId && initializeComponent
      ? updateComponentInstance(result.project, result.instanceId, initializeComponent)
      : result.project;
    const nextProject = result.instanceId
      ? syncGeneratedBoardChildren(initializedProject, result.instanceId)
      : initializedProject;

    commitProject(nextProject);
    if (result.instanceId && focusNewComponent) {
      setSelectedComponentId(result.instanceId);
    }
    return result.instanceId ?? null;
  }

  function handleAddCatalogComponent(selection: CatalogComponentSelection) {
    handleAddComponent(selection.type, null, {
      focusNewComponent: false,
      initializeComponent: (instance) => ({
        ...instance,
        displayName: selection.componentName,
        notes: selection.gameDescription,
        properties: {
          ...instance.properties,
          label: selection.componentName,
          catalogSlug: selection.productSlug,
          catalogVariantId: selection.variantId,
          catalogProductTitle: selection.productTitle,
          catalogVariantTitle: selection.variantTitle,
          ...(selection.physicalWidthMm ? { physicalWidthMm: selection.physicalWidthMm } : {}),
          ...(selection.physicalHeightMm ? { physicalHeightMm: selection.physicalHeightMm } : {}),
          ...(selection.maxCards ? { maxCards: selection.maxCards } : {}),
        },
      }),
    });
  }

  function handleUpdateCatalogComponent(instanceId: string, selection: CatalogComponentSelection) {
    const current = currentProject.instances[instanceId];
    if (!current) return;
    if (current.componentType !== selection.type) {
      setEditorNotice('Choose a catalog item from the same component genre.');
      return;
    }

    updateComponent(instanceId, (instance) => ({
      ...instance,
      displayName: selection.componentName,
      notes: selection.gameDescription,
      properties: {
        ...instance.properties,
        label: selection.componentName,
        catalogSlug: selection.productSlug,
        catalogVariantId: selection.variantId,
        catalogProductTitle: selection.productTitle,
        catalogVariantTitle: selection.variantTitle,
        ...(selection.physicalWidthMm ? { physicalWidthMm: selection.physicalWidthMm } : {}),
        ...(selection.physicalHeightMm ? { physicalHeightMm: selection.physicalHeightMm } : {}),
        ...(selection.maxCards ? { maxCards: selection.maxCards } : {}),
      },
    }));
  }

  function updateComponent(
    instanceId: string,
    updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
  ) {
    const nextProject = updateComponentInstance(currentProject, instanceId, updater);
    commitProject(syncGeneratedBoardChildren(nextProject, instanceId));
  }

  function removeComponent(instanceId: string) {
    commitProject(removeComponentInstance(currentProject, instanceId));
    if (selectedComponentId === instanceId) {
      setSelectedComponentId(null);
    }
  }

  function duplicateComponent(
    instanceId: string,
    options: {
      targetParentId?: string | null;
      focus?: boolean;
      frameOffset?: { x: number; y: number };
    } = {},
  ): string | null {
    const result = duplicateComponentSubtree(currentProject, instanceId, {
      targetParentId: options.targetParentId,
      displayNameSuffix: ' Copy',
    });
    if (result.issue) {
      setEditorNotice(result.issue);
      return null;
    }
    let nextProject = result.project;
    if (result.instanceId && options.frameOffset) {
      nextProject = updateComponentInstance(nextProject, result.instanceId, (instance) => {
        if (!instance.frame) return instance;
        return {
          ...instance,
          frame: {
            ...instance.frame,
            x: (instance.frame.x ?? 0) + (options.frameOffset?.x ?? 0),
            y: (instance.frame.y ?? 0) + (options.frameOffset?.y ?? 0),
          },
        };
      });
    }
    commitProject(nextProject);
    if (result.instanceId && options.focus) {
      setSelectedComponentId(result.instanceId);
    }
    return result.instanceId ?? null;
  }

  function openComponentEditor() {
    setActiveSection('component_editor');
    setSelectedComponentId(null);
  }

  function selectComponent(instanceId: string | null) {
    setActiveSection('component_editor');
    setSelectedComponentId(instanceId);
  }

  function createTopLevelComponent(type: BuiltInComponentType) {
    setActiveSection('component_editor');
    handleAddComponent(type, null, { focusNewComponent: true });
  }

  // Catalog-first creation from the gallery's "New component" dialog: the
  // component is born already tied to the chosen catalog item, then opened.
  function createCatalogTopLevelComponent(type: 'board' | 'deck' | 'tile', catalog: NewComponentCatalog) {
    setActiveSection('component_editor');
    handleAddComponent(type, null, {
      focusNewComponent: true,
      initializeComponent: (instance) => ({
        ...instance,
        properties: {
          ...instance.properties,
          catalogSlug: catalog.catalogSlug,
          catalogVariantId: catalog.catalogVariantId,
          ...(catalog.catalogProductTitle ? { catalogProductTitle: catalog.catalogProductTitle } : {}),
          ...(catalog.catalogVariantTitle ? { catalogVariantTitle: catalog.catalogVariantTitle } : {}),
          ...(catalog.physicalWidthMm != null ? { physicalWidthMm: catalog.physicalWidthMm } : {}),
          ...(catalog.physicalHeightMm != null ? { physicalHeightMm: catalog.physicalHeightMm } : {}),
          ...(catalog.maxCards != null ? { maxCards: catalog.maxCards } : {}),
        },
      }),
    });
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'rules':
        return (
          <RulesSection
            project={currentProject}
            onUpdateRules={(updater) => commitProject(updateProjectRules(currentProject, updater))}
            onAppendProjectTheme={(theme) => commitProject(updateProjectBrief(currentProject, (brief) => ({
              ...brief,
              theme: appendBriefList(brief.theme, theme),
            })))}
            onAppendProjectArtStyle={(style) => commitProject(updateProjectBrief(currentProject, (brief) => ({
              ...brief,
              artStyle: appendBriefList(brief.artStyle, style),
            })))}
            onAddCatalogComponent={handleAddCatalogComponent}
            onUpdateCatalogComponent={handleUpdateCatalogComponent}
            onUpdateInstanceNotes={(instanceId, notes) => updateComponent(instanceId, (instance) => ({
              ...instance,
              notes,
            }))}
            onUpdateInstanceName={(instanceId, displayName) => updateComponent(instanceId, (instance) => ({
              ...instance,
              displayName,
            }))}
            onRemoveInstance={removeComponent}
            onUpdateIconDescription={(iconId, description) => commitProject(updateProjectArt(currentProject, (art) => ({
              ...art,
              icons: art.icons.map((icon) => icon.id === iconId ? { ...icon, description } : icon),
            })))}
          />
        );
      case 'stats':
        return (
          <StatsSection
            project={currentProject}
            onUpdateBrief={(updater) => commitProject(updateProjectBrief(currentProject, updater))}
            onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
          />
        );
      case 'art':
        return (
          <ArtSection
            project={currentProject}
            projectId={currentProject.id}
            onUpdateArt={(updater) => commitProject(updateProjectArt(currentProject, updater))}
            onUpdateTheme={(value) => commitProject(
              updateProjectBrief(
                updateProjectArt(currentProject, (art) => ({
                  ...art,
                  theme: value,
                })),
                (brief) => ({
                  ...brief,
                  theme: value,
                }),
              ),
            )}
            onAssignPaletteColor={(paletteId, value) => commitProject(updateProjectSettings(currentProject, (settings) => ({
              ...settings,
              colorPalette: {
                ...settings.colorPalette,
                [paletteId]: value,
              },
            })))}
            onSavePalette={(palette) => commitProject(updateProjectSettings(currentProject, (settings) => ({
              ...settings,
              colorPalette: palette,
            })))}
          />
        );
      case 'versions':
        return (
          <VersionsSection
            gitStatus={gitStatus}
            versionGraph={versionGraph}
            onCreateVersion={handleCreateVersion}
            onRestoreCommit={(commitSha) => {
              try {
                const restoredProject = restoreProjectFromCommit(currentProject.id, commitSha);
                resetProjectHistory(restoredProject);
                setSelectedComponentId(null);
                setEditorNotice(`Restored ${commitSha}.`);
              } catch (error) {
                setEditorNotice(error instanceof Error ? error.message : 'Unable to restore that version.');
              }
            }}
          />
        );
      case 'app_layout':
        return (
          <AppLayoutSection
            project={currentProject}
            onUpdateLayout={(updater) => commitProject(updateProjectAppLayout(currentProject, updater))}
          />
        );
      case 'component_editor':
      default:
        if (!resolvedSelectedComponentId) {
          return (
            <ComponentGallery
              project={currentProject}
              componentOutlineIds={componentOutlineIds}
              onSelectComponent={selectComponent}
              onCreateComponent={createTopLevelComponent}
              onCreateCatalogComponent={createCatalogTopLevelComponent}
            />
          );
        }
        return (
          <VisualsSection
            project={currentProject}
            selectedComponentId={resolvedSelectedComponentId}
            selectedComponent={selectedComponent}
            onSelectComponent={selectComponent}
            onAddComponent={handleAddComponent}
            onUpdateComponent={updateComponent}
            onRemoveComponent={removeComponent}
            onDuplicateComponent={duplicateComponent}
            onReturnToGallery={() => setSelectedComponentId(null)}
            onAssignProjectPaletteColor={(paletteId, value) => commitProject(updateProjectSettings(currentProject, (settings) => ({
              ...settings,
              colorPalette: {
                ...settings.colorPalette,
                [paletteId]: value,
              },
            })))}
          />
        );
    }
  }

  const isCanvasSection = activeSection === 'component_editor' || activeSection === 'art' || activeSection === 'rules';

  return (
    <div className="editor-shell" style={{
      position: 'relative',
      display: 'grid',
      // The first column collapses to 0 when the drawer is closed so the canvas
      // reclaims the space; the panel itself slides in lockstep (see drawer).
      gridTemplateColumns: isSidebarOpen ? `${SIDEBAR_WIDTH}px minmax(0, 1fr)` : '0px minmax(0, 1fr)',
      transition: SIDEBAR_TRANSITION,
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      // The component editor shares the app's cozy cream backdrop + grass like
      // every other section; its "table" feel comes from the canvas surface
      // itself, not from a separate dark page background. The Art studio keeps
      // its own backdrop.
      background: activeSection === 'art' ? STUDIO_BG_VALUE : undefined,
    }}>
      <div
        data-layout="editorSidebarDrawer"
        /* clipping drawer shell: the sidebar slides left out of this box and the
           grid column collapses, so the panel tucks away cleanly off-canvas */
        style={{ position: 'relative', height: '100%', minWidth: 0, overflow: 'hidden' }}
      >
        <EditorSidebar
          project={currentProject}
          isOpen={isSidebarOpen}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          onOpenComponentEditor={openComponentEditor}
          onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
          activeVersionName={versionGraph.activeBranchName}
          versionOptions={versionOptions}
          onSaveVersion={handleSaveVersion}
          onSwitchVersion={handleSwitchVersion}
          onCreateVersion={handleCreateVersion}
          notice={editorNotice}
          onDismissNotice={() => setEditorNotice(null)}
        />
      </div>

      <button
        type="button"
        data-layout="editorSidebarToggle"
        /* leafy-green/brown drawer-pull rail flush against the sidebar's
           interior right edge; rides to the far-left edge when the drawer
           closes so it stays reachable. Brown fill + green border/chevron at
           rest; the two swap on hover. */
        onClick={() => setIsSidebarOpen((value) => !value)}
        aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
        aria-expanded={isSidebarOpen}
        title={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = RAIL_GREEN;
          el.style.borderColor = RAIL_BROWN;
          el.style.color = RAIL_BROWN;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = RAIL_BROWN;
          el.style.borderColor = RAIL_GREEN;
          el.style.color = RAIL_GREEN;
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          // Tucked onto the sidebar's interior right edge (its right side meets
          // the seam) when open, sliding to the far-left edge when closed.
          left: isSidebarOpen ? `${SIDEBAR_WIDTH - RAIL_WIDTH}px` : '0px',
          zIndex: 60,
          width: RAIL_WIDTH,
          height: '100%',
          padding: 0,
          border: `2px solid ${RAIL_GREEN}`,
          // Round only the exposed edge — the interior (left) edge when open,
          // the canvas-facing (right) edge once it's docked far-left.
          borderTopLeftRadius: isSidebarOpen ? RAIL_RADIUS : 0,
          borderBottomLeftRadius: isSidebarOpen ? RAIL_RADIUS : 0,
          borderTopRightRadius: isSidebarOpen ? 0 : RAIL_RADIUS,
          borderBottomRightRadius: isSidebarOpen ? 0 : RAIL_RADIUS,
          background: RAIL_BROWN,
          color: RAIL_GREEN,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: SIDEBAR_TRANSITION,
        }}
      >
        {isSidebarOpen
          ? <ChevronLeft size={19} strokeWidth={3.25} />
          : <ChevronRight size={19} strokeWidth={3.25} />}
      </button>

      <div
        id="editor-viewport"
        data-layout="editorViewport"
        style={{
          position: 'relative',
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: `${GRASS_BACKDROP_HEIGHT}px`,
          boxSizing: 'border-box',
        }}
      >
        {isCanvasSection || activeSection === 'versions' ? (
          renderActiveSection()
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: '0.85rem',
            padding: '0.75rem 2.5rem 1rem 2.5rem',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '0.2rem 0.15rem 0 0.15rem', color: '#0f766e', fontSize: '0.84rem', display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#064e3b' }}>
                {currentSectionMeta.label.toLowerCase()}
              </span>
            </div>

            {renderActiveSection()}
          </div>
        )}

        <GrassBackdrop height={GRASS_BACKDROP_HEIGHT} />
      </div>
    </div>
  );
};
