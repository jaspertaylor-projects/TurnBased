import { useEffect, useState } from 'react';
import { createUIAffordanceState } from '@turnbased/engine-ui';
import type { UISelectionState } from '@turnbased/engine-ui';
import {
  addProjectComponent,
  listValidParents,
  removeComponentInstance,
  renameProject,
  updateComponentInstance,
  updateProjectAppLayout,
  updateProjectDescription,
} from '../editor/project';
import { loadEditorProject, saveEditorProject } from '../editor/storage';
import { applyPreviewActions, buildPreviewRuntime, createPreviewMoveTree } from '../editor/runtime';
import type { EditorProject } from '../editor/types';
import { EMPTY_SELECTION, SECTION_OPTIONS } from '../editor/constants';
import type { EditorSection } from '../editor/constants';
import { createPreviewSignature, readProjectIdFromHash } from '../editor/helpers';
import { pageStyle, panelStyle, sectionTitleStyle } from '../editor/styles';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { RequirementsNotice } from '../editor/components/RequirementsNotice';
import { VisualsSection } from '../editor/sections/VisualsSection';
import { PreviewSection } from '../editor/sections/PreviewSection';
import { ComponentEditorSection } from '../editor/sections/ComponentEditorSection';
import { VersionsSection } from '../editor/sections/VersionsSection';
import { AppLayoutSection } from '../editor/sections/AppLayoutSection';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import { createZoneId } from '@turnbased/shared-types';
import { commitProjectVersion, getProjectGitStatus, listProjectGitCommits, restoreProjectFromCommit } from '../editor/git';
import { createWorkspaceFiles } from '../editor/shipping';
import { saveProjectWorkspace } from '../editor/workspace';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

export const Editor = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<EditorProject | null>(null);
  const [activeSection, setActiveSection] = useState<EditorSection>('visual');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<UISelectionState>(EMPTY_SELECTION);
  const [previewState, setPreviewState] = useState<ReturnType<typeof buildPreviewRuntime>['initialState'] | null>(null);
  const [paletteOwnerId, setPaletteOwnerId] = useState<string | null>('player_one');
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('Checkpoint workspace');

  useEffect(() => {
    const syncRoute = () => {
      const nextProjectId = readProjectIdFromHash();
      const nextProject = nextProjectId ? loadEditorProject(nextProjectId) : null;
      const pendingNotice = window.sessionStorage.getItem(PENDING_EDITOR_NOTICE_KEY);

      setProjectId(nextProjectId);
      setProject(nextProject);
      setActiveSection('visual');
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
  const selectedComponent = project && selectedComponentId ? project.instances[selectedComponentId] : null;

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
        <p>This workspace is still in the rules brief phase. Finish the AI build before opening the post-build editor.</p>
        <a href="#/new">Back to the rules builder</a>
      </div>
    );
  }

  const currentProject = project;
  const currentRuntime = runtime;
  const currentSectionMeta = SECTION_OPTIONS.find((section) => section.id === activeSection) ?? SECTION_OPTIONS[0];
  const boardInstances = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType === 'board');
  const topLevelSupportZones = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType !== 'board');
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

  function handleAddComponent(type: BuiltInComponentType) {
    const validParentIds = listValidParents(currentProject, type).map((instance) => String(instance.instanceId));
    const preferredParentId = selectedComponentId && validParentIds.includes(selectedComponentId)
      ? selectedComponentId
      : validParentIds[0] ?? null;
    const result = addProjectComponent(currentProject, type, preferredParentId, paletteOwnerId);

    if (result.issue) {
      setEditorNotice(result.issue);
      return;
    }

    commitProject(result.project);
    if (result.instanceId) {
      setSelectedComponentId(result.instanceId);
    }
  }

  function updateSelectedComponent(updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) {
    if (!selectedComponentId) {
      return;
    }

    commitProject(updateComponentInstance(currentProject, selectedComponentId, updater));
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

    const canonicalActions = moveTree.materialize(request);
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

    const typedZoneId = createZoneId(zoneId);

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

    if (affordances.zoneStates[zoneId]?.interactable) {
      setSelection({
        ...selection,
        selectedZoneId: typedZoneId,
      });
    }
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'components':
        return (
          <ComponentEditorSection
            project={currentProject}
            paletteOwnerId={paletteOwnerId}
            onPaletteOwnerChange={setPaletteOwnerId}
            selectedComponentId={selectedComponentId}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponentId}
            onAddComponent={handleAddComponent}
            onUpdateSelectedComponent={updateSelectedComponent}
            onRemoveSelectedComponent={() => {
              if (!selectedComponent) {
                return;
              }
              commitProject(removeComponentInstance(currentProject, selectedComponent.instanceId));
              setSelectedComponentId(null);
            }}
          />
        );
      case 'preview':
        return (
          <PreviewSection
            project={currentProject}
            boardInstances={boardInstances}
            topLevelSupportZones={topLevelSupportZones}
            previewState={previewState}
            affordances={affordances}
            moveTree={moveTree}
            selection={selection}
            onResetPreview={() => setPreviewState(currentRuntime.initialState)}
            onExecuteMove={(actionId) => executeMove(actionId)}
            onSetSelection={setSelection}
            onEntityClick={handleEntityClick}
            onZoneClick={handleZoneClick}
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
      case 'visual':
      default:
        return (
          <VisualsSection
            project={currentProject}
            boardInstances={boardInstances}
            topLevelSupportZones={topLevelSupportZones}
            selectedComponentId={selectedComponentId}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponentId}
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
        onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
        onUpdateDescription={(description) => commitProject(updateProjectDescription(currentProject, description))}
      />

      <section style={{ flex: '1 1 760px', minWidth: 0, display: 'grid', gap: '0.85rem', padding: '0.85rem 1rem 1rem 1rem' }}>
        <div style={{ padding: '0.2rem 0.15rem 0 0.15rem', color: '#0f766e', fontSize: '0.84rem', display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#064e3b' }}>{currentSectionMeta.label.toLowerCase()}</span>
          <span>{currentSectionMeta.description}</span>
        </div>

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
