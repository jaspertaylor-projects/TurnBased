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
  updateProjectBrief,
  updateProjectDescription,
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
import { panelStyle, sectionTitleStyle } from '../editor/styles';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { VisualsSection } from '../editor/sections/VisualsSection';
import { ComponentGallery } from '../editor/sections/ComponentGallery';
import { VersionsSection } from '../editor/sections/VersionsSection';
import { AppLayoutSection } from '../editor/sections/AppLayoutSection';
import { ArtSection, STUDIO_BG_VALUE } from '../editor/sections/ArtSection';
import { RulesSection } from '../editor/sections/RulesSection';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import { commitProjectVersion, getProjectGitStatus, listProjectGitCommits, restoreProjectFromCommit } from '../editor/git';
import { createWorkspaceFiles } from '../editor/shipping';
import { saveProjectWorkspace } from '../editor/workspace';
import { GrassBackdrop } from '../components/GrassBackdrop';

const GRASS_BACKDROP_HEIGHT = 55;

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';
const SUPPORT_ZONE_COMPONENT_TYPES = new Set([
  'space',
  'zone',
  'track',
  'deck',
  'hand',
  'discard',
  'bag',
  'score-track',
]);

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
  const [commitMessage, setCommitMessage] = useState('Checkpoint workspace');

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
  const boardInstances = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType === 'board');
  const topLevelSupportZones = currentProject.rootInstanceIds.filter((instanceId) => {
    const componentType = currentProject.instances[instanceId]?.componentType;
    return componentType ? SUPPORT_ZONE_COMPONENT_TYPES.has(componentType) : false;
  });
  const componentOutlineIds = listComponentOutlineIds(currentProject);
  const gitStatus = getProjectGitStatus(currentProject, currentRuntime);
  const gitHistory = listProjectGitCommits(currentProject.id);

  function commitProject(nextProject: EditorProject) {
    setProject(nextProject);
    setEditorNotice(null);
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
      // Offset applied to the new clone's frame.x/y so a pasted copy doesn't
      // sit exactly on top of the original. Applied inline so the duplicate
      // and the frame nudge commit atomically in a single project update —
      // otherwise a follow-up updateComponent call reads a stale
      // currentProject (React state hasn't flushed yet) and clobbers the
      // duplicate.
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
    // Clicking "component editor" in the sidebar always lands the user on the
    // intermediate gallery view — `selectedComponentId = null` triggers the
    // gallery in `renderActiveSection` (see the `component_editor` case).
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

  function renderActiveSection() {
    switch (activeSection) {
      case 'rules':
        return (
          <RulesSection
            project={currentProject}
            onUpdateRules={(updater) => commitProject(updateProjectRules(currentProject, updater))}
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
            gitHistory={gitHistory}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onCreateCommit={async () => {
              try {
                const result = await commitProjectVersion(currentProject, currentRuntime, commitMessage);
                if (result.project !== currentProject) {
                  setProject(result.project);
                }
                setCommitMessage('Checkpoint workspace');
                setEditorNotice(
                  result.remoteError
                    ? `Workspace committed locally. Remote sync is unavailable right now: ${result.remoteError}`
                    : 'Workspace committed to version history.',
                );
              } catch (error) {
                setEditorNotice(error instanceof Error ? error.message : 'Unable to create a version checkpoint.');
              }
            }}
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
        // Intermediate gallery view: shown whenever no component is selected.
        // Selecting a card (or creating a new component) calls back into
        // `selectComponent` / `createTopLevelComponent`, which set
        // `selectedComponentId` and drop us into the per-component editor.
        if (!resolvedSelectedComponentId) {
          return (
            <ComponentGallery
              project={currentProject}
              componentOutlineIds={componentOutlineIds}
              onSelectComponent={selectComponent}
              onCreateComponent={createTopLevelComponent}
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

  // For canvas-based sections (component editor, art, rules), the page
  // container must stretch children to fill the full viewport height and
  // avoid wrapping. Rules joins this list so the rulebook spread can fill
  // the available viewport height rather than being squeezed by the
  // non-canvas grid wrapper.
  const isCanvasSection = activeSection === 'component_editor' || activeSection === 'art' || activeSection === 'rules';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '228px minmax(0, 1fr)',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      ...(activeSection === 'art' ? { background: STUDIO_BG_VALUE } : {}),
    }}>
      <EditorSidebar
        project={currentProject}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        boardCount={boardInstances.length}
        supportZoneCount={topLevelSupportZones.length}
        componentCount={Object.keys(currentProject.instances).length}
        onOpenComponentEditor={openComponentEditor}
        onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
        onUpdateDescription={(description) => commitProject(updateProjectDescription(currentProject, description))}
      />

      {/* editorViewport — single container for ALL section content (canvas and non-canvas).
          Everything that isn't the navbar or the sidebar renders inside this div.
          The viewport reserves bottom padding so the persistent GrassBackdrop at
          the bottom of the editor doesn't cover section content. The grass is
          absolutely positioned, so the reserved padding is the space sections
          can't draw into. */}
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
        {isCanvasSection ? (
          <>
            {renderActiveSection()}
            {editorNotice && activeSection !== 'art' && (
              <div style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                ...panelStyle,
                background: 'rgba(255,247,237,0.94)',
                border: '1px solid rgba(249,115,22,0.18)',
                zIndex: 100,
                maxWidth: '60%',
              }}>
                <p style={{ ...sectionTitleStyle, marginBottom: '0.25rem', color: '#c2410c' }}>Notice</p>
                <p style={{ margin: 0, color: '#9a3412' }}>{editorNotice}</p>
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateRows: 'auto auto minmax(0, 1fr)',
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

            {editorNotice && (
              <div style={{ ...panelStyle, background: 'rgba(255,247,237,0.94)', border: '1px solid rgba(249,115,22,0.18)' }}>
                <p style={{ ...sectionTitleStyle, marginBottom: '0.25rem', color: '#c2410c' }}>Notice</p>
                <p style={{ margin: 0, color: '#9a3412' }}>{editorNotice}</p>
              </div>
            )}

            {renderActiveSection()}
          </div>
        )}

        <GrassBackdrop height={GRASS_BACKDROP_HEIGHT} />
      </div>
    </div>
  );
};
