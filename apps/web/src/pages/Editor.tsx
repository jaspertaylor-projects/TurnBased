import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createUIAffordanceState,
} from '@turnbased/engine-ui';
import type { UISelectionState } from '@turnbased/engine-ui';
import {
  getBuiltInComponentManifest,
  listBuiltInComponents,
} from '@turnbased/engine-components';
import type { BuiltInComponentType, ComponentInstanceModel, ComponentPropertyDefinition } from '@turnbased/engine-components';
import {
  createPlayerId,
  createZoneId,
} from '@turnbased/shared-types';

import {
  addProjectAdvancedHook,
  advancedHookCatalog,
  experimentalOverrideCatalog,
  getProjectModeLabel,
  getProjectModeSupportSummary,
  getRequiredWarningsForMode,
  projectWarningCatalog,
  removeProjectAdvancedHook,
  setProjectMode,
  updateProjectAdvancedHook,
} from '../editor/capabilities';
import { generateGroundedAdvice } from '../editor/ai';
import {
  commitProjectToGit,
  getProjectGitStatus,
  listProjectGitCommits,
  restoreProjectFromCommit,
} from '../editor/git';
import { currentProjectVersionPins } from '../editor/manifest';
import {
  addProjectComponent,
  listValidParents,
  removeComponentInstance,
  renameProject,
  updateComponentInstance,
  updateProjectDescription,
  updateProjectRules,
  updateProjectSeats,
} from '../editor/project';
import { loadEditorProject, saveEditorProject } from '../editor/storage';
import {
  createCompatibilityWarnings,
  createLocalBuildRecord,
  getLatestBuild,
  listProjectBuilds,
  saveLocalBuildRecord,
} from '../editor/shipping';
import { applyPreviewActions, buildPreviewRuntime, createPreviewMoveTree } from '../editor/runtime';
import type {
  EditorProject,
  ProjectAcknowledgedWarningId,
  ProjectAdvancedHookType,
  ProjectExperimentalOverrideId,
} from '../editor/types';

const EMPTY_SELECTION: UISelectionState = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

const containerStyle: CSSProperties = {
  minHeight: 'calc(100vh - 88px)',
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr) 360px',
  gap: '1rem',
  padding: '1rem',
  alignItems: 'start',
  boxSizing: 'border-box',
};

const panelStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(16,185,129,0.14)',
  borderRadius: '20px',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
  padding: '1rem',
  backdropFilter: 'blur(12px)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '0.84rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#0f766e',
  margin: '0 0 0.8rem 0',
};

function readProjectIdFromHash(): string | null {
  const hash = window.location.hash;
  const parts = hash.split('/');
  return parts.length > 2 ? parts[2] ?? null : null;
}

function TreeItem({
  project,
  instanceId,
  depth,
  selectedId,
  onSelect,
}: {
  project: EditorProject;
  instanceId: string;
  depth: number;
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
}) {
  const instance = project.instances[instanceId];
  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);

  return (
    <div>
      <button
        onClick={() => onSelect(instanceId)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '0.65rem 0.8rem',
          marginTop: depth === 0 ? 0 : '0.35rem',
          borderRadius: '14px',
          border: selectedId === instanceId ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(15,118,110,0.12)',
          background: selectedId === instanceId ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.72)',
          marginLeft: `${depth * 14}px`,
          color: '#064e3b',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 700 }}>{instance.displayName ?? manifest.displayName}</div>
        <div style={{ fontSize: '0.8rem', color: '#0f766e' }}>{manifest.displayName} · {instance.componentType}</div>
      </button>
      {instance.children.map((childId) => (
        <TreeItem
          key={childId}
          project={project}
          instanceId={childId}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function parsePropertyValue(definition: ComponentPropertyDefinition, rawValue: string): string | number | boolean | string[] {
  if (definition.kind === 'number') {
    return rawValue === '' ? 0 : Number(rawValue);
  }

  if (definition.kind === 'boolean') {
    return rawValue === 'true';
  }

  if (definition.kind === 'string_array') {
    return rawValue.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return rawValue;
}

function getOwnerColor(project: EditorProject, ownerId: string | null | undefined): string {
  return project.seats.find((seat) => seat.id === ownerId)?.color ?? '#94a3b8';
}

function getHookLabel(hookType: ProjectAdvancedHookType): string {
  return advancedHookCatalog.find((hook) => hook.type === hookType)?.label ?? hookType;
}

function createPreviewSignature(project: EditorProject): string {
  return JSON.stringify({
    rootInstanceIds: project.rootInstanceIds,
    instances: project.instances,
    rules: project.rules,
    seats: project.seats,
  });
}

export const Editor = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<EditorProject | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [selection, setSelection] = useState<UISelectionState>(EMPTY_SELECTION);
  const [previewState, setPreviewState] = useState<ReturnType<typeof buildPreviewRuntime>['initialState'] | null>(null);
  const [paletteOwnerId, setPaletteOwnerId] = useState<string | null>('player_one');
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('What should I add next to make this prototype stronger?');
  const [aiResult, setAiResult] = useState<ReturnType<typeof generateGroundedAdvice> | null>(null);
  const [shippingNotice, setShippingNotice] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('Checkpoint current prototype');
  const [buildNotes, setBuildNotes] = useState('Browser-generated snapshot');
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseDescription, setReleaseDescription] = useState('');
  const [showExperimentalSetup, setShowExperimentalSetup] = useState(false);
  const [experimentalAcknowledgements, setExperimentalAcknowledgements] = useState<ProjectAcknowledgedWarningId[]>([]);
  const [experimentalOverrideSelections, setExperimentalOverrideSelections] = useState<ProjectExperimentalOverrideId[]>([]);
  const [experimentalConfirmationText, setExperimentalConfirmationText] = useState('');

  useEffect(() => {
    const syncRoute = () => {
      const nextProjectId = readProjectIdFromHash();
      const nextProject = nextProjectId ? loadEditorProject(nextProjectId) : null;

      setProjectId(nextProjectId);
      setProject(nextProject);
      setSelectedComponentId(null);
      setSelectedHookId(nextProject?.manifest.customHooks[0]?.id ?? null);
      setSelection(EMPTY_SELECTION);
      setPreviewState(nextProject ? buildPreviewRuntime(nextProject).initialState : null);
      setReleaseTitle(nextProject?.name ?? '');
      setReleaseDescription(nextProject?.description ?? '');
      setShowExperimentalSetup(false);
      if (nextProject) {
        setExperimentalAcknowledgements(
          getRequiredWarningsForMode('experimental').filter((warningId) => (
            nextProject.manifest.capabilities.acknowledgedWarnings.includes(warningId)
          )),
        );
        setExperimentalOverrideSelections(nextProject.manifest.capabilities.enabledOverrides);
      } else {
        setExperimentalAcknowledgements([]);
        setExperimentalOverrideSelections([]);
      }
      setExperimentalConfirmationText('');
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

  const runtime = project ? buildPreviewRuntime(project) : null;
  const moveTree = previewState && runtime ? createPreviewMoveTree(previewState, runtime) : null;
  const affordances = moveTree ? createUIAffordanceState(moveTree, { selection }) : null;
  const selectedComponent = project && selectedComponentId ? project.instances[selectedComponentId] : null;

  if (!projectId) {
    return <div style={{ padding: '2rem' }}>Loading project...</div>;
  }

  if (!project) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Project not found</h1>
        <p>This local project could not be loaded. Create a new workspace from the dashboard and try again.</p>
        <a href="#/dashboard">Back to Dashboard</a>
      </div>
    );
  }

  const currentProject = project;
  const currentRuntime = runtime!;
  const compatibilityWarnings = createCompatibilityWarnings(currentProject, currentRuntime);
  const gitStatus = getProjectGitStatus(currentProject, currentRuntime);
  const latestPreviewBuild = getLatestBuild(currentProject.id, 'preview');
  const latestReleaseBuild = getLatestBuild(currentProject.id, 'release');
  const versionPinsAreCurrent = JSON.stringify(currentProject.manifest.versionPins) === JSON.stringify(currentProjectVersionPins);
  const modeSupport = getProjectModeSupportSummary(currentProject);
  const currentModeLabel = getProjectModeLabel(currentProject.manifest.capabilities.mode);
  const requiredExperimentalWarnings = getRequiredWarningsForMode('experimental');
  const buildHistory = listProjectBuilds(currentProject.id);
  const gitHistory = listProjectGitCommits(currentProject.id);
  const activeHookId = selectedHookId && currentProject.manifest.customHooks.some((hook) => hook.id === selectedHookId)
    ? selectedHookId
    : currentProject.manifest.customHooks[0]?.id ?? null;
  const selectedHook = activeHookId
    ? currentProject.manifest.customHooks.find((hook) => hook.id === activeHookId) ?? null
    : null;
  const experimentalReady = (
    requiredExperimentalWarnings.every((warningId) => experimentalAcknowledgements.includes(warningId)) &&
    experimentalOverrideSelections.length > 0 &&
    experimentalConfirmationText.trim() === 'EXPERIMENTAL'
  );

  function commitProject(nextProject: EditorProject) {
    const shouldResetPreview = !project || createPreviewSignature(project) !== createPreviewSignature(nextProject);
    const nextHookId = nextProject.manifest.customHooks.length === 0
      ? null
      : selectedHookId && nextProject.manifest.customHooks.some((hook) => hook.id === selectedHookId)
        ? selectedHookId
        : nextProject.manifest.customHooks[0].id;

    setProject(nextProject);
    setSelectedHookId(nextHookId);
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

  function updateSelectedComponent(
    updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
  ) {
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
      currentRuntime,
      canonicalActions,
      currentProject.rules.targetScore,
      currentProject.rules.maxTurns,
    );

    setPreviewState(nextState);
    setSelection(EMPTY_SELECTION);
    setEditorNotice(null);
  }

  function handleCreateBuild(kind: 'preview' | 'release') {
    const { project: pinnedProject, build } = createLocalBuildRecord(currentProject, currentRuntime, {
      kind,
      notes: buildNotes,
      releaseTitle: kind === 'release' ? releaseTitle || currentProject.name : undefined,
      releaseDescription: kind === 'release' ? releaseDescription || currentProject.description : undefined,
    });

    saveLocalBuildRecord(build);
    commitProject(pinnedProject);
    setShippingNotice(
      kind === 'release'
        ? `Published ${build.releaseTitle ?? build.projectName} as snapshot ${build.commitSha}.`
        : `Created preview build ${build.commitSha}.`,
    );
  }

  function handleCreateCommit() {
    try {
      const commit = commitProjectToGit(currentProject, currentRuntime, commitMessage);
      setCommitMessage('Checkpoint current prototype');
      setShippingNotice(`Saved commit ${commit.commitSha}.`);
    } catch (error) {
      setShippingNotice(error instanceof Error ? error.message : 'Unable to create a commit right now.');
    }
  }

  function handleRestoreCommit(commitSha: string) {
    try {
      const restoredProject = restoreProjectFromCommit(currentProject.id, commitSha);
      commitProject(restoredProject);
      setSelectedComponentId(null);
      setShippingNotice(`Restored workspace to commit ${commitSha}.`);
    } catch (error) {
      setShippingNotice(error instanceof Error ? error.message : 'Unable to restore that commit.');
    }
  }

  function handleEnableAdvancedMode() {
    if (currentProject.manifest.capabilities.mode !== 'standard') {
      return;
    }

    const nextProject = setProjectMode(currentProject, 'advanced', {
      acknowledgedWarnings: getRequiredWarningsForMode('advanced'),
    });
    commitProject(nextProject);
    setShowExperimentalSetup(false);
    setShippingNotice('Advanced extension mode enabled. Stay inside the documented hook contracts while building custom logic.');
  }

  function toggleExperimentalAcknowledgement(warningId: ProjectAcknowledgedWarningId) {
    setExperimentalAcknowledgements((currentWarnings) => (
      currentWarnings.includes(warningId)
        ? currentWarnings.filter((value) => value !== warningId)
        : [...currentWarnings, warningId]
    ));
  }

  function toggleExperimentalOverrideSelection(overrideId: ProjectExperimentalOverrideId) {
    setExperimentalOverrideSelections((currentOverrides) => (
      currentOverrides.includes(overrideId)
        ? currentOverrides.filter((value) => value !== overrideId)
        : [...currentOverrides, overrideId]
    ));
  }

  function handleActivateExperimentalMode() {
    if (!experimentalReady || currentProject.manifest.capabilities.mode === 'experimental') {
      return;
    }

    const nextProject = setProjectMode(currentProject, 'experimental', {
      acknowledgedWarnings: experimentalAcknowledgements,
      enabledOverrides: experimentalOverrideSelections,
    });
    commitProject(nextProject);
    setShowExperimentalSetup(false);
    setExperimentalConfirmationText('');
    setShippingNotice('Experimental override mode activated. Release snapshots still work, but marketplace publishing is now restricted for this project.');
  }

  function handleAddAdvancedHook(hookType: ProjectAdvancedHookType) {
    if (currentProject.manifest.capabilities.mode === 'standard') {
      setEditorNotice('Enable Advanced Extension Mode before creating custom hook stubs.');
      return;
    }

    const { project: nextProject, hook } = addProjectAdvancedHook(currentProject, hookType);
    commitProject(nextProject);
    setSelectedHookId(hook.id);
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

  function renderEntityChips(zoneId: string) {
    if (!previewState) {
      return null;
    }

    return previewState.zones[zoneId]?.entityIds.map((entityId) => {
      const entity = previewState.entities[entityId];
      const entityState = affordances?.entityStates[entityId];

      return (
        <button
          key={entityId}
          onClick={() => handleEntityClick(entityId)}
          style={{
            border: entityState?.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.2)',
            background: entityState?.interactable ? 'rgba(16,185,129,0.15)' : 'rgba(240,253,244,0.9)',
            borderRadius: '999px',
            padding: '0.4rem 0.75rem',
            color: '#064e3b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: entityState?.interactable ? 'pointer' : 'default',
            margin: '0 0.35rem 0.35rem 0',
          }}
        >
          <span
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '999px',
              background: getOwnerColor(currentProject, entity.ownerId),
              display: 'inline-block',
            }}
          />
          <span>{String(entity.properties.label ?? entity.type)}</span>
        </button>
      );
    });
  }

  function renderZoneCard(instanceId: string) {
    if (!previewState) {
      return null;
    }

    const instance = currentProject.instances[instanceId];
    const zoneState = affordances?.zoneStates[instanceId];
    const selected = selection.selectedZoneId === instanceId;
    const zone = previewState.zones[instanceId];

    return (
      <button
        key={instanceId}
        onClick={() => handleZoneClick(instanceId)}
        style={{
          width: '100%',
          textAlign: 'left',
          borderRadius: '18px',
          border: zoneState?.dropTarget || selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.18)',
          background: zoneState?.highlighted ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.82)',
          padding: '0.85rem',
          boxSizing: 'border-box',
          cursor: zoneState?.interactable || selection.selectedEntityId ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#064e3b' }}>{zone?.name ?? instance.displayName}</div>
            <div style={{ fontSize: '0.82rem', color: '#0f766e' }}>{instance.componentType}</div>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#0f766e' }}>
            {zone?.entityIds.length ?? 0}
            {zone?.maxCapacity !== null ? ` / ${zone?.maxCapacity}` : ''}
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', minHeight: '2rem' }}>
          {renderEntityChips(instanceId)}
        </div>
      </button>
    );
  }

  const boardInstances = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType === 'board');
  const topLevelSupportZones = currentProject.rootInstanceIds.filter((instanceId) => currentProject.instances[instanceId]?.componentType !== 'board');
  const availablePalette = listBuiltInComponents();

  return (
    <div style={containerStyle}>
      <aside style={{ ...panelStyle, position: 'sticky', top: '92px', maxHeight: 'calc(100vh - 110px)', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <p style={sectionTitleStyle}>Project</p>
            <input
              value={currentProject.name}
              onChange={(event) => commitProject(renameProject(currentProject, event.target.value))}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#064e3b',
                padding: 0,
              }}
            />
          </div>
        </div>

        <textarea
          value={currentProject.description}
          onChange={(event) => commitProject(updateProjectDescription(currentProject, event.target.value))}
          style={{
            width: '100%',
            minHeight: '84px',
            borderRadius: '14px',
            border: '1px solid rgba(15,118,110,0.12)',
            padding: '0.8rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            color: '#064e3b',
            marginTop: '0.9rem',
          }}
        />

        <div style={{ marginTop: '1rem' }}>
          <p style={sectionTitleStyle}>Component Palette</p>
          <label style={{ display: 'block', fontSize: '0.82rem', color: '#0f766e', marginBottom: '0.45rem' }}>Owner for new pieces</label>
          <select
            value={paletteOwnerId ?? ''}
            onChange={(event) => setPaletteOwnerId(event.target.value || null)}
            style={{
              width: '100%',
              padding: '0.7rem 0.8rem',
              borderRadius: '12px',
              border: '1px solid rgba(15,118,110,0.12)',
              marginBottom: '0.75rem',
            }}
          >
            <option value="">No owner</option>
            {currentProject.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.name}</option>)}
          </select>
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {availablePalette.map((manifest) => (
              <button
                key={manifest.type}
                onClick={() => handleAddComponent(manifest.type as BuiltInComponentType)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 0.8rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(255,255,255,0.82)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#064e3b' }}>{manifest.displayName}</div>
                <div style={{ fontSize: '0.8rem', color: '#0f766e' }}>{manifest.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <p style={sectionTitleStyle}>Project Tree</p>
          {currentProject.rootInstanceIds.length === 0 ? (
            <p style={{ margin: 0, color: '#0f766e', fontSize: '0.9rem' }}>Start by adding a board, a zone, or a collection from the palette.</p>
          ) : (
            currentProject.rootInstanceIds.map((instanceId) => (
              <TreeItem
                key={instanceId}
                project={currentProject}
                instanceId={instanceId}
                depth={0}
                selectedId={selectedComponentId}
                onSelect={setSelectedComponentId}
              />
            ))
          )}
        </div>
      </aside>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ ...panelStyle, paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <p style={sectionTitleStyle}>Layout Editor</p>
              <h2 style={{ margin: 0 }}>Board and Zone Surface</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.45rem 0.7rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.82rem' }}>
                {currentProject.rootInstanceIds.length} root components
              </span>
              <span style={{ padding: '0.45rem 0.7rem', borderRadius: '999px', background: 'rgba(14,165,233,0.12)', color: '#155e75', fontSize: '0.82rem' }}>
                {currentRuntime.destinationZoneIds.length} playable destinations
              </span>
            </div>
          </div>

          {editorNotice && (
            <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.9rem', borderRadius: '14px', background: 'rgba(249,115,22,0.12)', color: '#9a3412' }}>
              {editorNotice}
            </div>
          )}

          {currentRuntime.requirements.length > 0 && (
            <div style={{ marginTop: '0.9rem', padding: '0.9rem', borderRadius: '16px', background: 'rgba(250,204,21,0.14)', color: '#854d0e' }}>
              {currentRuntime.requirements.join(' ')}
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            {boardInstances.map((boardId) => {
              const board = currentProject.instances[boardId];
              const width = Number(board.properties.width ?? 3) || 3;
              const spaces = board.children.filter((childId) => currentProject.instances[childId]?.componentType === 'space');
              const nestedZones = board.children.filter((childId) => currentProject.instances[childId]?.componentType !== 'space');

              return (
                <div key={boardId} style={{ borderRadius: '24px', padding: '1rem', background: 'linear-gradient(145deg, rgba(16,185,129,0.12), rgba(250,204,21,0.10))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.8rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#064e3b' }}>{String(board.properties.label ?? board.displayName ?? 'Board')}</div>
                      <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>grid board · {width} columns</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gap: '0.75rem' }}>
                    {spaces.map((spaceId) => renderZoneCard(spaceId))}
                  </div>
                  {nestedZones.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {nestedZones.map((zoneId) => renderZoneCard(zoneId))}
                    </div>
                  )}
                </div>
              );
            })}

            {topLevelSupportZones.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {topLevelSupportZones.map((instanceId) => renderZoneCard(instanceId))}
              </div>
            )}

            {boardInstances.length === 0 && topLevelSupportZones.length === 0 && (
              <div style={{ padding: '2rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.25)', textAlign: 'center', color: '#0f766e' }}>
                Add a board or a zone to start laying out the prototype.
              </div>
            )}
          </div>
        </div>

        <div style={{ ...panelStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <p style={sectionTitleStyle}>Preview</p>
              <h2 style={{ margin: 0 }}>Live Move Overlay</h2>
            </div>
            <button
              onClick={() => setPreviewState(currentRuntime.initialState)}
              style={{
                border: '1px solid rgba(15,118,110,0.15)',
                background: 'rgba(255,255,255,0.82)',
                borderRadius: '999px',
                padding: '0.55rem 0.9rem',
                color: '#064e3b',
              }}
            >
              Reset Preview
            </button>
          </div>

          {previewState && affordances && moveTree ? (
            <>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {currentProject.seats.map((seat) => (
                  <div key={seat.id} style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: previewState.turnState.activePlayerId === seat.id ? 'rgba(16,185,129,0.16)' : 'rgba(240,253,244,0.9)', color: '#064e3b' }}>
                    {seat.name}: {previewState.players[seat.id]?.score ?? 0}
                  </div>
                ))}
                <div style={{ padding: '0.55rem 0.8rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)', color: '#075985' }}>
                  Turn {previewState.turnState.turnNumber} · {previewState.turnState.currentPhase}
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {affordances.availableActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      if (action.kind === 'global') {
                        executeMove(action.id);
                      } else {
                        setSelection({
                          ...selection,
                          selectedActionId: action.id,
                        });
                      }
                    }}
                    disabled={!action.enabled}
                    style={{
                      borderRadius: '999px',
                      border: action.selected ? '2px solid #f97316' : '1px solid rgba(15,118,110,0.15)',
                      background: action.ready ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.82)',
                      padding: '0.55rem 0.85rem',
                      color: '#064e3b',
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#0f766e' }}>Build out the structure to unlock the live preview.</p>
          )}
        </div>
      </section>

      <aside style={{ display: 'grid', gap: '1rem' }}>
        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Inspector</p>
          {selectedComponent ? (
            <>
              <h3 style={{ marginBottom: '0.8rem' }}>{selectedComponent.displayName ?? getBuiltInComponentManifest(selectedComponent.componentType as BuiltInComponentType).displayName}</h3>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#0f766e', marginBottom: '0.35rem' }}>Display name</label>
              <input
                value={selectedComponent.displayName ?? ''}
                onChange={(event) => updateSelectedComponent((instance) => ({
                  ...instance,
                  displayName: event.target.value,
                }))}
                style={{ width: '100%', padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', boxSizing: 'border-box', marginBottom: '0.8rem' }}
              />

              {(selectedComponent.componentType === 'piece' || selectedComponent.componentType === 'token' || selectedComponent.componentType === 'zone' || selectedComponent.componentType === 'hand' || selectedComponent.componentType === 'deck') && (
                <>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#0f766e', marginBottom: '0.35rem' }}>Owner seat</label>
                  <select
                    value={selectedComponent.bindings.ownerId ?? ''}
                    onChange={(event) => updateSelectedComponent((instance) => ({
                      ...instance,
                      bindings: {
                        ...instance.bindings,
                        ownerId: event.target.value ? createPlayerId(event.target.value) : undefined,
                      },
                    }))}
                    style={{ width: '100%', padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', marginBottom: '0.8rem' }}
                  >
                    <option value="">No owner</option>
                    {currentProject.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.name}</option>)}
                  </select>
                </>
              )}

              <div style={{ display: 'grid', gap: '0.7rem' }}>
                {Object.entries(getBuiltInComponentManifest(selectedComponent.componentType as BuiltInComponentType).propertyDefinitions).map(([key, definition]) => {
                  const value = selectedComponent.properties[key];

                  if (definition.kind === 'boolean') {
                    return (
                      <label key={key} style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                        {definition.label}
                        <select
                          value={String(Boolean(value))}
                          onChange={(event) => updateSelectedComponent((instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              [key]: parsePropertyValue(definition, event.target.value),
                            },
                          }))}
                          style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      </label>
                    );
                  }

                  if (definition.kind === 'enum') {
                    return (
                      <label key={key} style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                        {definition.label}
                        <select
                          value={String(value ?? '')}
                          onChange={(event) => updateSelectedComponent((instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              [key]: event.target.value,
                            },
                          }))}
                          style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                        >
                          {(definition.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    );
                  }

                  return (
                    <label key={key} style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                      {definition.label}
                      <input
                        type={definition.kind === 'number' ? 'number' : 'text'}
                        value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                        onChange={(event) => updateSelectedComponent((instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            [key]: parsePropertyValue(definition, event.target.value),
                          },
                        }))}
                        style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                      />
                    </label>
                  );
                })}
              </div>

              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                  Placement index
                  <input
                    type="number"
                    value={selectedComponent.placement?.index ?? 0}
                    onChange={(event) => updateSelectedComponent((instance) => ({
                      ...instance,
                      placement: {
                        ...instance.placement,
                        index: Number(event.target.value),
                      },
                    }))}
                    style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                  />
                </label>
                <button
                  onClick={() => {
                    commitProject(removeComponentInstance(currentProject, selectedComponent.instanceId));
                    setSelectedComponentId(null);
                  }}
                  style={{
                    borderRadius: '14px',
                    border: '1px solid rgba(239,68,68,0.18)',
                    background: 'rgba(254,226,226,0.82)',
                    padding: '0.75rem 0.9rem',
                    color: '#b91c1c',
                  }}
                >
                  Remove Component
                </button>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: '#0f766e' }}>Select any component from the tree or layout to edit its properties and ownership.</p>
          )}
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Project Mode</p>
          <div
            style={{
              padding: '0.9rem',
              borderRadius: '16px',
              background: currentProject.manifest.capabilities.mode === 'experimental'
                ? 'rgba(254,226,226,0.82)'
                : currentProject.manifest.capabilities.mode === 'advanced'
                  ? 'rgba(254,249,195,0.9)'
                  : 'rgba(240,253,244,0.9)',
              color: currentProject.manifest.capabilities.mode === 'experimental'
                ? '#991b1b'
                : currentProject.manifest.capabilities.mode === 'advanced'
                  ? '#854d0e'
                  : '#065f46',
            }}
          >
            <strong>{currentModeLabel}</strong>
            <div style={{ marginTop: '0.35rem', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {modeSupport.supportDescription}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
            <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#065f46', fontSize: '0.78rem' }}>
              {modeSupport.supportLabel}
            </span>
            <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: modeSupport.marketplaceEligible ? 'rgba(14,165,233,0.12)' : 'rgba(254,226,226,0.85)', color: modeSupport.marketplaceEligible ? '#075985' : '#991b1b', fontSize: '0.78rem' }}>
              {modeSupport.marketplaceEligible ? 'Marketplace-ready path' : 'Marketplace restricted'}
            </span>
            <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', fontSize: '0.78rem' }}>
              {currentProject.manifest.customHooks.length} custom hook{currentProject.manifest.customHooks.length === 1 ? '' : 's'}
            </span>
          </div>

          {modeSupport.reducedGuarantees.length > 0 && (
            <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.45rem' }}>
              {modeSupport.reducedGuarantees.map((warning) => (
                <div key={warning} style={{ padding: '0.65rem 0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(15,118,110,0.12)', color: '#0f766e', fontSize: '0.84rem' }}>
                  {warning}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '0.8rem', color: '#155e75', fontSize: '0.8rem' }}>
            AI policy: {modeSupport.aiGuidance}
          </div>
          <div style={{ marginTop: '0.35rem', color: '#0f766e', fontSize: '0.78rem' }}>
            Docs: {modeSupport.citations.join(' · ')}
          </div>

          {currentProject.manifest.capabilities.mode === 'standard' && (
            <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.7rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.86)' }}>
                <strong style={{ color: '#064e3b' }}>Upgrade to Advanced Extension Mode</strong>
                <div style={{ marginTop: '0.35rem', color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  Unlock documented hook stubs for predicates, targets, scoring, derived views, AI hints, and affordance policies without touching core engine behavior.
                </div>
                <button
                  onClick={handleEnableAdvancedMode}
                  style={{ marginTop: '0.75rem', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #0f766e, #10b981)', color: 'white', padding: '0.6rem 0.95rem' }}
                >
                  Enable Advanced Mode
                </button>
              </div>
              <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(254,249,195,0.9)', color: '#854d0e', fontSize: '0.84rem', lineHeight: 1.5 }}>
                Experimental overrides stay hidden until Advanced Mode is enabled first. That keeps the mainstream path safe and progressive.
              </div>
            </div>
          )}

          {currentProject.manifest.capabilities.mode === 'advanced' && (
            <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.7rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.86)' }}>
                <strong style={{ color: '#064e3b' }}>Experimental Engine Override Mode</strong>
                <div style={{ marginTop: '0.35rem', color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  Use this only when documented extension hooks are not enough. Activation is permanent and narrows support guarantees.
                </div>
                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <button
                    onClick={() => setShowExperimentalSetup((currentValue) => !currentValue)}
                    style={{ borderRadius: '999px', border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(254,226,226,0.82)', color: '#991b1b', padding: '0.6rem 0.95rem' }}
                  >
                    {showExperimentalSetup ? 'Hide Experimental Checklist' : 'Prepare Experimental Upgrade'}
                  </button>
                </div>
              </div>

              {showExperimentalSetup && (
                <div style={{ padding: '0.95rem', borderRadius: '16px', background: 'rgba(255,250,250,0.96)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div style={{ color: '#991b1b', fontWeight: 700, marginBottom: '0.55rem' }}>Step 1: Acknowledge reduced guarantees</div>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {requiredExperimentalWarnings.map((warningId) => {
                      const warning = projectWarningCatalog[warningId];
                      return (
                        <label key={warningId} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '0.65rem', alignItems: 'start', color: '#7f1d1d', fontSize: '0.84rem' }}>
                          <input
                            type="checkbox"
                            checked={experimentalAcknowledgements.includes(warningId)}
                            onChange={() => toggleExperimentalAcknowledgement(warningId)}
                            style={{ marginTop: '0.2rem' }}
                          />
                          <span>
                            <strong>{warning.title}</strong>
                            <br />
                            {warning.description}
                            <br />
                            <span style={{ color: '#9a3412' }}>Reference: {warning.citation}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div style={{ color: '#991b1b', fontWeight: 700, marginTop: '0.9rem', marginBottom: '0.55rem' }}>Step 2: Select the override surface</div>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {experimentalOverrideCatalog.map((override) => (
                      <label key={override.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '0.65rem', alignItems: 'start', color: '#7f1d1d', fontSize: '0.84rem' }}>
                        <input
                          type="checkbox"
                          checked={experimentalOverrideSelections.includes(override.id)}
                          onChange={() => toggleExperimentalOverrideSelection(override.id)}
                          style={{ marginTop: '0.2rem' }}
                        />
                        <span>
                          <strong>{override.label}</strong> ({override.risk} risk)
                          <br />
                          {override.description}
                        </span>
                      </label>
                    ))}
                  </div>

                  <label style={{ display: 'grid', gap: '0.35rem', color: '#7f1d1d', fontSize: '0.84rem', marginTop: '0.9rem' }}>
                    Step 3: Type <code>EXPERIMENTAL</code> to permanently flag this project
                    <input
                      value={experimentalConfirmationText}
                      onChange={(event) => setExperimentalConfirmationText(event.target.value)}
                      style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.18)' }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                    <button
                      onClick={handleActivateExperimentalMode}
                      disabled={!experimentalReady}
                      style={{
                        borderRadius: '999px',
                        border: 'none',
                        background: experimentalReady ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(248,113,113,0.5)',
                        color: 'white',
                        padding: '0.6rem 0.95rem',
                        cursor: experimentalReady ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Activate Experimental Mode
                    </button>
                    <button
                      onClick={() => setShowExperimentalSetup(false)}
                      style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.86)', color: '#064e3b', padding: '0.6rem 0.95rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentProject.manifest.capabilities.mode === 'experimental' && (
            <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.55rem' }}>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(254,226,226,0.82)', color: '#991b1b', fontSize: '0.84rem', lineHeight: 1.5 }}>
                This project is permanently marked experimental. Release snapshots remain available, but marketplace publication is currently disabled.
              </div>
              {currentProject.manifest.capabilities.enabledOverrides.map((overrideId) => {
                const override = experimentalOverrideCatalog.find((entry) => entry.id === overrideId);
                return (
                  <div key={overrideId} style={{ padding: '0.65rem 0.75rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.18)', color: '#7f1d1d', background: 'rgba(255,255,255,0.86)', fontSize: '0.84rem' }}>
                    <strong>{override?.label ?? overrideId}</strong>
                    <br />
                    {override?.description ?? 'Configured experimental override.'}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Advanced Hooks</p>
          {currentProject.manifest.capabilities.mode === 'standard' ? (
            <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.5 }}>
              Advanced hook stubs stay hidden in Standard Mode. Enable Advanced Extension Mode to register custom predicates, target generators, scoring helpers, derived views, AI hints, and affordance policies.
            </div>
          ) : (
            <>
              <div style={{ color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.5 }}>
                Register hook stubs here, then keep their behavior inside the documented extension boundaries.
              </div>
              <div style={{ marginTop: '0.35rem', color: '#155e75', fontSize: '0.78rem' }}>
                Reference: docs/engine/extension-points.md
              </div>

              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.5rem' }}>
                {advancedHookCatalog.map((hookTemplate) => (
                  <button
                    key={hookTemplate.type}
                    onClick={() => handleAddAdvancedHook(hookTemplate.type)}
                    style={{ textAlign: 'left', padding: '0.75rem 0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.86)' }}
                  >
                    <div style={{ fontWeight: 700, color: '#064e3b' }}>Add {hookTemplate.label}</div>
                    <div style={{ color: '#0f766e', fontSize: '0.8rem', marginTop: '0.2rem' }}>{hookTemplate.description}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.55rem' }}>
                {currentProject.manifest.customHooks.length === 0 ? (
                  <p style={{ margin: 0, color: '#0f766e' }}>No custom hook stubs registered yet.</p>
                ) : (
                  currentProject.manifest.customHooks.map((hook) => (
                    <button
                      key={hook.id}
                      onClick={() => setSelectedHookId(hook.id)}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem 0.8rem',
                        borderRadius: '14px',
                        border: activeHookId === hook.id ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(15,118,110,0.12)',
                        background: activeHookId === hook.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.86)',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#064e3b' }}>{hook.name}</div>
                      <div style={{ color: '#0f766e', fontSize: '0.8rem' }}>{getHookLabel(hook.hookType)} · {hook.status}</div>
                    </button>
                  ))
                )}
              </div>

              {selectedHook && (
                <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.7rem', paddingTop: '0.9rem', borderTop: '1px solid rgba(15,118,110,0.12)' }}>
                  <div style={{ fontWeight: 700, color: '#064e3b' }}>Editing {selectedHook.name}</div>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    Hook name
                    <input
                      value={selectedHook.name}
                      onChange={(event) => commitProject(updateProjectAdvancedHook(currentProject, selectedHook.id, (hook) => ({
                        ...hook,
                        name: event.target.value,
                      })))}
                      style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    File path
                    <input
                      value={selectedHook.filePath}
                      onChange={(event) => commitProject(updateProjectAdvancedHook(currentProject, selectedHook.id, (hook) => ({
                        ...hook,
                        filePath: event.target.value,
                      })))}
                      style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    Status
                    <select
                      value={selectedHook.status}
                      onChange={(event) => commitProject(updateProjectAdvancedHook(currentProject, selectedHook.id, (hook) => ({
                        ...hook,
                        status: event.target.value as typeof hook.status,
                      })))}
                      style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                    >
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    Description
                    <textarea
                      value={selectedHook.description}
                      onChange={(event) => commitProject(updateProjectAdvancedHook(currentProject, selectedHook.id, (hook) => ({
                        ...hook,
                        description: event.target.value,
                      })))}
                      style={{ minHeight: '76px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    Hook stub
                    <textarea
                      value={selectedHook.code}
                      onChange={(event) => commitProject(updateProjectAdvancedHook(currentProject, selectedHook.id, (hook) => ({
                        ...hook,
                        code: event.target.value,
                      })))}
                      style={{ minHeight: '180px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical', fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', fontSize: '0.8rem' }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      commitProject(removeProjectAdvancedHook(currentProject, selectedHook.id));
                      setSelectedHookId(null);
                    }}
                    style={{ borderRadius: '14px', border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(254,226,226,0.82)', padding: '0.75rem 0.9rem', color: '#b91c1c' }}
                  >
                    Remove Hook Stub
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Rules Editor</p>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Prototype mode
            <select
              value={currentProject.rules.prototypeMode}
              onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                ...rules,
                prototypeMode: event.target.value as EditorProject['rules']['prototypeMode'],
              })))}
              style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            >
              <option value="territory">Territory Control</option>
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
              Target score
              <input
                type="number"
                min={1}
                value={currentProject.rules.targetScore}
                onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                  ...rules,
                  targetScore: Math.max(1, Number(event.target.value) || 1),
                })))}
                style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
              Max turns
              <input
                type="number"
                min={1}
                value={currentProject.rules.maxTurns}
                onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                  ...rules,
                  maxTurns: Math.max(1, Number(event.target.value) || 1),
                })))}
                style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Turn phases
            <input
              value={currentProject.rules.phases.join(', ')}
              onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                ...rules,
                phases: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
              })))}
              style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Rules text
            <textarea
              value={currentProject.rules.rulesText}
              onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                ...rules,
                rulesText: event.target.value,
              })))}
              style={{ minHeight: '92px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem' }}>
            Designer notes
            <textarea
              value={currentProject.rules.designerNotes}
              onChange={(event) => commitProject(updateProjectRules(currentProject, (rules) => ({
                ...rules,
                designerNotes: event.target.value,
              })))}
              style={{ minHeight: '92px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical' }}
            />
          </label>

          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.55rem' }}>
            {currentProject.seats.map((seat, index) => (
              <div key={seat.id} style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: '0.55rem' }}>
                <input
                  value={seat.name}
                  onChange={(event) => commitProject(updateProjectSeats(currentProject, (seats) => seats.map((currentSeat, seatIndex) => (
                    seatIndex === index ? { ...currentSeat, name: event.target.value } : currentSeat
                  ))))}
                  style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                />
                <input
                  type="color"
                  value={seat.color}
                  onChange={(event) => commitProject(updateProjectSeats(currentProject, (seats) => seats.map((currentSeat, seatIndex) => (
                    seatIndex === index ? { ...currentSeat, color: event.target.value } : currentSeat
                  ))))}
                  style={{ width: '100%', minHeight: '44px', padding: '0.25rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Move Debugger</p>
          {moveTree ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
                Active player: {previewState?.players[previewState.turnState.activePlayerId]?.displayName}
                <br />
                Available actions: {moveTree.availableActions.length}
              </div>
              {moveTree.availableActions.map((action) => (
                <div key={action.id} style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                  <div style={{ fontWeight: 700, color: '#064e3b' }}>{action.displayName}</div>
                  <div style={{ color: '#0f766e', fontSize: '0.84rem', marginTop: '0.25rem' }}>{action.explanation?.summary}</div>
                  <div style={{ color: '#155e75', fontSize: '0.78rem', marginTop: '0.45rem' }}>
                    Sources: {action.interactableEntities.join(', ') || 'none'} · Destinations: {action.validDestinations.join(', ') || 'none'}
                  </div>
                  <button
                    onClick={() => executeMove(action.id, {
                      selectedEntityId: action.interactableEntities[0] ?? null,
                      selectedZoneId: action.validDestinations[0] ?? null,
                    })}
                    style={{
                      marginTop: '0.65rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(15,118,110,0.15)',
                      background: 'rgba(255,255,255,0.82)',
                      padding: '0.45rem 0.8rem',
                      color: '#064e3b',
                    }}
                  >
                    Run Suggested Request
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#0f766e' }}>Legal actions will appear here once the preview can compile.</p>
          )}
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Ship Snapshot</p>
          <div style={{ padding: '0.8rem', borderRadius: '14px', background: versionPinsAreCurrent ? 'rgba(240,253,244,0.92)' : 'rgba(254,249,195,0.9)', color: versionPinsAreCurrent ? '#065f46' : '#854d0e' }}>
            Version pins: core {currentProject.manifest.versionPins.engineCore} · components {currentProject.manifest.versionPins.engineComponents} · ui {currentProject.manifest.versionPins.engineUi}
            <br />
            {versionPinsAreCurrent
              ? 'Manifest pins match the current workspace packages.'
              : `Current workspace packages are ${currentProjectVersionPins.engineCore}/${currentProjectVersionPins.engineComponents}/${currentProjectVersionPins.engineUi}. Building will refresh the manifest pins.`}
          </div>

          {shippingNotice && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 0.85rem', borderRadius: '14px', background: 'rgba(14,165,233,0.12)', color: '#075985' }}>
              {shippingNotice}
            </div>
          )}

          <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
            {compatibilityWarnings.length === 0 ? (
              <div style={{ padding: '0.75rem 0.85rem', borderRadius: '14px', background: 'rgba(240,253,244,0.92)', color: '#065f46' }}>
                No compatibility warnings. This snapshot is ready to build.
              </div>
            ) : (
              compatibilityWarnings.map((warning) => (
                <div
                  key={`${warning.code}:${warning.message}`}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '14px',
                    background: warning.severity === 'blocking'
                      ? 'rgba(254,226,226,0.92)'
                      : warning.severity === 'warning'
                        ? 'rgba(254,249,195,0.92)'
                        : 'rgba(239,246,255,0.92)',
                    color: warning.severity === 'blocking'
                      ? '#b91c1c'
                      : warning.severity === 'warning'
                        ? '#854d0e'
                        : '#155e75',
                  }}
                >
                  <strong style={{ textTransform: 'capitalize' }}>{warning.severity}</strong>: {warning.message}
                </div>
              ))
            )}
          </div>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginTop: '0.9rem' }}>
            Build notes
            <textarea
              value={buildNotes}
              onChange={(event) => setBuildNotes(event.target.value)}
              style={{ minHeight: '78px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            Release title
            <input
              value={releaseTitle}
              onChange={(event) => setReleaseTitle(event.target.value)}
              style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            Release description
            <textarea
              value={releaseDescription}
              onChange={(event) => setReleaseDescription(event.target.value)}
              style={{ minHeight: '78px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button
              onClick={() => handleCreateBuild('preview')}
              style={{ borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #0f766e, #22c55e)', color: 'white', padding: '0.6rem 0.95rem' }}
            >
              Create Preview Build
            </button>
            <button
              onClick={() => handleCreateBuild('release')}
              style={{ borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)', color: 'white', padding: '0.6rem 0.95rem' }}
            >
              Publish Snapshot
            </button>
            {latestPreviewBuild && (
              <a
                href={`#/play/local/${latestPreviewBuild.id}`}
                style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.6rem 0.95rem', color: '#064e3b', textDecoration: 'none' }}
              >
                Open Latest Preview
              </a>
            )}
            {latestReleaseBuild && (
              <a
                href={`#/play/local/${latestReleaseBuild.id}`}
                style={{ borderRadius: '999px', border: '1px solid rgba(14,165,233,0.18)', background: 'rgba(239,246,255,0.92)', padding: '0.6rem 0.95rem', color: '#075985', textDecoration: 'none' }}
              >
                Open Latest Release
              </a>
            )}
          </div>

          <div style={{ marginTop: '0.95rem', display: 'grid', gap: '0.7rem' }}>
            {buildHistory.length === 0 ? (
              <p style={{ margin: 0, color: '#0f766e' }}>No build snapshots yet.</p>
            ) : (
              buildHistory.slice(0, 4).map((build) => (
                <div key={build.id} style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <strong style={{ color: '#064e3b' }}>{build.kind === 'release' ? build.releaseTitle ?? build.projectName : build.projectName}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#155e75' }}>{build.commitSha}</span>
                  </div>
                  <div style={{ marginTop: '0.3rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    {build.kind === 'release' ? 'Published' : 'Preview'} · {new Date(build.createdAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: '#155e75', fontSize: '0.8rem' }}>
                    Files: {Object.keys(build.files).join(', ')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                    <a
                      href={`#/play/local/${build.id}`}
                      style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.45rem 0.8rem', color: '#064e3b', textDecoration: 'none' }}
                    >
                      Open Build
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Git History</p>
          <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
            Head commit: {gitStatus.headCommitSha ?? 'No commits yet'}
            <br />
            Tracked files: {gitStatus.trackedPaths.length}
            <br />
            Changed paths: {gitStatus.changedPaths.length}
          </div>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.82rem', marginTop: '0.8rem' }}>
            Commit message
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              style={{ padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleCreateCommit}
              style={{ borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', padding: '0.6rem 0.95rem' }}
            >
              Commit Workspace
            </button>
          </div>

          <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.45rem' }}>
            {gitStatus.changedPaths.length === 0 ? (
              <p style={{ margin: 0, color: '#0f766e' }}>Workspace matches the latest commit.</p>
            ) : (
              gitStatus.changedPaths.map((path) => (
                <div key={path} style={{ padding: '0.55rem 0.7rem', borderRadius: '12px', background: 'rgba(239,246,255,0.92)', color: '#155e75', fontSize: '0.82rem' }}>
                  {path}
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '0.95rem', display: 'grid', gap: '0.7rem' }}>
            {gitHistory.length === 0 ? (
              <p style={{ margin: 0, color: '#0f766e' }}>Create a commit to start reversible history.</p>
            ) : (
              gitHistory.slice(0, 5).map((commit) => (
                <div key={commit.id} style={{ padding: '0.8rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <strong style={{ color: '#064e3b' }}>{commit.message}</strong>
                    <span style={{ color: '#155e75', fontSize: '0.78rem' }}>{commit.commitSha}</span>
                  </div>
                  <div style={{ marginTop: '0.3rem', color: '#0f766e', fontSize: '0.82rem' }}>
                    {new Date(commit.createdAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: '#155e75', fontSize: '0.8rem' }}>
                    {commit.changedPaths.join(', ')}
                  </div>
                  <button
                    onClick={() => handleRestoreCommit(commit.commitSha)}
                    style={{ marginTop: '0.65rem', borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.45rem 0.8rem', color: '#064e3b' }}
                  >
                    Revert To This Commit
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Grounded AI</p>
          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            style={{ width: '100%', minHeight: '92px', padding: '0.75rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
            <button
              onClick={() => previewState && setAiResult(generateGroundedAdvice(aiPrompt, currentProject, currentRuntime, previewState))}
              style={{ borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #10b981, #84cc16)', color: 'white', padding: '0.6rem 0.95rem' }}
            >
              Generate Advice
            </button>
            <button
              onClick={() => setAiPrompt('Explain the current legal moves and overlays.')}
              style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.6rem 0.95rem', color: '#064e3b' }}
            >
              Explain Moves
            </button>
            <button
              onClick={() => setAiPrompt('What should I add next to make this prototype stronger?')}
              style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.82)', padding: '0.6rem 0.95rem', color: '#064e3b' }}
            >
              Suggest Next Steps
            </button>
          </div>

          {aiResult && (
            <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.7rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '16px', background: 'rgba(240,253,244,0.9)' }}>
                <div style={{ fontWeight: 800, color: '#064e3b' }}>{aiResult.title}</div>
                <div style={{ color: '#065f46', lineHeight: 1.6, marginTop: '0.45rem', whiteSpace: 'pre-wrap' }}>{aiResult.body}</div>
              </div>
              <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(239,246,255,0.92)', color: '#155e75', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                {aiResult.groundingSummary}
              </div>
              <div style={{ color: '#0f766e', fontSize: '0.8rem' }}>
                Grounded in: {aiResult.citations.join(', ')}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
