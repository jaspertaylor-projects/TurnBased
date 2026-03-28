import { useEffect, useState } from 'react';
import { createUIAffordanceState } from '@turnbased/engine-ui';
import type { UISelectionState } from '@turnbased/engine-ui';
import {
  addProjectComponent,
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
  updateProjectSettings,
} from '../editor/project';
import { loadEditorProject, saveEditorProject } from '../editor/storage';
import {
  applyPreviewActions,
  buildPreviewRuntime,
  createPreviewMoveTree,
  normalizePreviewActions,
  toPreviewZoneId,
} from '../editor/runtime';
import type { EditorProject } from '../editor/types';
import { EMPTY_SELECTION, SECTION_OPTIONS } from '../editor/constants';
import type { ComponentEditorMode, EditorSection } from '../editor/constants';
import { createPreviewSignature, readProjectIdFromHash } from '../editor/helpers';
import { pageStyle, panelStyle, sectionTitleStyle } from '../editor/styles';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { RequirementsNotice } from '../editor/components/RequirementsNotice';
import { VisualsSection } from '../editor/sections/VisualsSection';
import { PreviewSection } from '../editor/sections/PreviewSection';
import { VersionsSection } from '../editor/sections/VersionsSection';
import { AppLayoutSection } from '../editor/sections/AppLayoutSection';
import { ArtSection } from '../editor/sections/ArtSection';
import { SettingsSection } from '../editor/sections/SettingsSection';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import { commitProjectVersion, getProjectGitStatus, listProjectGitCommits, restoreProjectFromCommit } from '../editor/git';
import { createWorkspaceFiles } from '../editor/shipping';
import { saveProjectWorkspace } from '../editor/workspace';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

function isMovableTemplateType(componentType: string): boolean {
  return componentType === 'piece' || componentType === 'token';
}

function listComponentOutlineIds(project: EditorProject): string[] {
  const movableTemplateIds = Object.values(project.instances)
    .filter((instance) => isMovableTemplateType(instance.componentType))
    .map((instance) => String(instance.instanceId));

  return Array.from(new Set([...project.rootInstanceIds, ...movableTemplateIds]));
}

function findComponentOutlineId(project: EditorProject, instanceId: string | null): string | null {
  if (!instanceId) {
    return null;
  }

  let currentId: string | null = instanceId;
  while (currentId) {
    const instance: EditorProject['instances'][string] | undefined = project.instances[currentId];
    if (!instance) {
      return null;
    }

    if (!instance.parentId || isMovableTemplateType(instance.componentType)) {
      return currentId;
    }

    currentId = String(instance.parentId);
  }

  return null;
}

export const Editor = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<EditorProject | null>(null);
  const [activeSection, setActiveSection] = useState<EditorSection>('preview');
  const [componentEditorMode, setComponentEditorMode] = useState<ComponentEditorMode>('edit');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<UISelectionState>(EMPTY_SELECTION);
  const [previewState, setPreviewState] = useState<ReturnType<typeof buildPreviewRuntime>['initialState'] | null>(null);
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
      setProject(nextProject);
      setActiveSection('preview');
      setComponentEditorMode('edit');
      setSelectedComponentId(null);
      setSelection(EMPTY_SELECTION);
      setPreviewState(nextProject ? buildPreviewRuntime(nextProject).initialState : null);
      setEditorNotice(pendingNotice);
      if (pendingNotice) {
        window.sessionStorage.removeItem(PENDING_EDITOR_NOTICE_KEY);
      }
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

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

  const runtime = project ? buildPreviewRuntime(project) : null;
  const moveTree = previewState && runtime ? createPreviewMoveTree(previewState, runtime) : null;
  const affordances = moveTree ? createUIAffordanceState(moveTree, { selection }) : null;
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
  const topLevelSupportZones = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType !== 'board');
  const componentOutlineIds = listComponentOutlineIds(currentProject);
  const selectedOutlineComponentId = findComponentOutlineId(currentProject, resolvedSelectedComponentId);
  const gitStatus = getProjectGitStatus(currentProject, currentRuntime);
  const gitHistory = listProjectGitCommits(currentProject.id);

  function commitProject(nextProject: EditorProject) {
    const shouldResetPreview = createPreviewSignature(currentProject) !== createPreviewSignature(nextProject);

    setProject(nextProject);
    if (shouldResetPreview) {
      setPreviewState(buildPreviewRuntime(nextProject).initialState);
      setSelection(EMPTY_SELECTION);
    }
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
      setComponentEditorMode('edit');
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

  function executeMove(actionId: string, overrides: Partial<UISelectionState> = {}) {
    if (!moveTree || !previewState || !runtime) {
      return;
    }

    const nextSelection = {
      ...selection,
      ...overrides,
    };
    const request = {
      actionId,
      selectedEntityId: nextSelection.selectedEntityId ?? undefined,
      destinationZoneId: nextSelection.selectedZoneId ?? undefined,
      targetEntityId: nextSelection.selectedTargetEntityId ?? undefined,
      subChoiceSelections: nextSelection.subChoiceSelections,
    };
    const validation = moveTree.validate(request);
    if (!validation.isValid) {
      setEditorNotice(validation.errors.join(' '));
      setSelection(nextSelection);
      return;
    }

    const canonicalActions = normalizePreviewActions(currentProject, previewState, moveTree.materialize(request));
    const nextState = applyPreviewActions(
      previewState,
      runtime,
      canonicalActions,
      currentProject.rules.targetScore,
      currentProject.rules.maxTurns,
    );

    setPreviewState(nextState);
    setSelection(EMPTY_SELECTION);
    setEditorNotice(null);
  }

  function openComponentEditor() {
    setActiveSection('component_editor');
    setComponentEditorMode(componentOutlineIds.length === 0 ? 'create' : 'edit');

    if (!selectedComponentId && componentOutlineIds.length > 0) {
      setSelectedComponentId(componentOutlineIds[0]);
    }
  }

  function selectComponent(instanceId: string | null) {
    setActiveSection('component_editor');
    setComponentEditorMode('edit');
    setSelectedComponentId(instanceId);
  }

  function startCreateComponent() {
    setActiveSection('component_editor');
    setComponentEditorMode('create');
  }

  function handleEntityClick(entityId: string) {
    if (!affordances) {
      return;
    }

    const entityState = affordances.entityStates[entityId];
    if (!entityState?.interactable && selection.selectedEntityId !== entityId) {
      return;
    }

    setSelection({
      ...EMPTY_SELECTION,
      selectedEntityId: selection.selectedEntityId === entityId ? null : entityId,
    });
  }

  function handleZoneClick(zoneId: string) {
    if (!moveTree || !affordances) {
      return;
    }

    const typedZoneId = toPreviewZoneId(zoneId);

    if (selection.selectedEntityId) {
      const matchingAction = moveTree.availableActions.find((action) => (
        action.interactableEntities.includes(selection.selectedEntityId ?? '') &&
        action.validDestinations.includes(typedZoneId)
      ));

      if (matchingAction) {
        executeMove(matchingAction.id, {
          selectedEntityId: selection.selectedEntityId,
          selectedZoneId: typedZoneId,
        });
        return;
      }
    }

    if (affordances.zoneStates[typedZoneId]?.interactable) {
      setSelection({
        ...selection,
        selectedZoneId: typedZoneId,
      });
    }
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'settings':
        return (
          <SettingsSection
            project={currentProject}
            onUpdateBrief={(updater) => commitProject(updateProjectBrief(currentProject, updater))}
            onUpdateSettings={(updater) => commitProject(updateProjectSettings(currentProject, updater))}
          />
        );
      case 'preview':
        return (
          <PreviewSection
            key={`${currentProject.id}:${currentProject.views.defaultViewId}:${currentProject.views.selectedViewId}`}
            project={currentProject}
            boardInstances={boardInstances}
            topLevelSupportZones={topLevelSupportZones}
            previewState={previewState}
            affordances={affordances}
            moveTree={moveTree}
            selection={selection}
            onResetPreview={() => setPreviewState(currentRuntime.initialState)}
            onExecuteMove={(actionId, overrides) => executeMove(actionId, overrides)}
            onSetSelection={setSelection}
            onEntityClick={handleEntityClick}
            onZoneClick={handleZoneClick}
          />
        );
      case 'art':
        return (
          <ArtSection
            project={currentProject}
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
                setProject(restoredProject);
                setPreviewState(buildPreviewRuntime(restoredProject).initialState);
                setSelectedComponentId(null);
                setSelection(EMPTY_SELECTION);
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
        return (
          <VisualsSection
            project={currentProject}
            selectedComponentId={resolvedSelectedComponentId}
            selectedComponent={selectedComponent}
            onSelectComponent={selectComponent}
            onAddComponent={handleAddComponent}
            onUpdateComponent={updateComponent}
            onRemoveComponent={removeComponent}
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

  return (
    <div style={pageStyle}>
      <EditorSidebar
        project={currentProject}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        boardCount={boardInstances.length}
        supportZoneCount={topLevelSupportZones.length}
        componentCount={Object.keys(currentProject.instances).length}
        componentOutlineIds={componentOutlineIds}
        selectedOutlineComponentId={selectedOutlineComponentId}
        componentEditorMode={componentEditorMode}
        onOpenComponentEditor={openComponentEditor}
        onStartCreateComponent={startCreateComponent}
        onSelectOutlineComponent={selectComponent}
        onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
        onUpdateDescription={(description) => commitProject(updateProjectDescription(currentProject, description))}
      />

      <section style={{ flex: '1 1 760px', minWidth: 0, display: 'grid', gap: '0.85rem', padding: '0.75rem 1rem 1rem 1rem' }}>
        {activeSection !== 'component_editor' ? (
          <div style={{ padding: '0.2rem 0.15rem 0 0.15rem', color: '#0f766e', fontSize: '0.84rem', display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#064e3b' }}>
              {currentSectionMeta.label.toLowerCase()}
            </span>
          </div>
        ) : null}

        {editorNotice && (
          <div style={{ ...panelStyle, background: 'rgba(255,247,237,0.94)', border: '1px solid rgba(249,115,22,0.18)' }}>
            <p style={{ ...sectionTitleStyle, marginBottom: '0.25rem', color: '#c2410c' }}>Notice</p>
            <p style={{ margin: 0, color: '#9a3412' }}>{editorNotice}</p>
          </div>
        )}

        <RequirementsNotice requirements={runtime.requirements} />
        {renderActiveSection()}
      </section>
    </div>
  );
};
