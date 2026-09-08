import { useEffect, useRef, useState } from 'react';
import { useUndoRedo, useUndoRedoKeyboard } from '../editor/useUndoRedo';
import {
  renameProject,
  syncAllGeneratedBoardChildren,
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
import { DEFAULT_EDITOR_SECTION, readEditorSection } from '../editor/constants';
import type { EditorSection } from '../editor/constants';
import { readProjectIdFromHash } from '../editor/helpers';
import { EditorSidebar } from '../editor/components/EditorSidebar';
import { VisualsSection } from '../editor/sections/VisualsSection';
import { ComponentsWorkbench } from '../editor/componentStudio/ComponentsWorkbench';
import { VersionsSection } from '../editor/sections/VersionsSection';
import { AppLayoutSection } from '../editor/sections/AppLayoutSection';
import { ArtSection } from '../editor/sections/ArtSection';
import { RulesSection } from '../editor/sections/RulesSection';
import { PlaytestSection } from '../editor/sections/PlaytestSection';
import { WorkshopSection } from '../editor/sections/WorkshopSection';
import { PrintSection } from '../editor/sections/PrintSection';
import { StatsSection } from '../editor/sections/StatsSection';
import {
  commitActiveProjectVersion,
  createProjectVersionBranch,
  DEFAULT_VERSION_BRANCH_NAME,
  getProjectGitStatus,
  getProjectVersionGraph,
  restoreProjectFromCommit,
  syncProjectWorkspace,
  type ProjectGitStatus,
  type ProjectVersionGraph,
} from '../editor/git';
import { EditorFrame } from '../editor/components/EditorFrame';
import { createEditorComponentActions } from '../editor/editorComponentActions';

const SIDEBAR_OPEN_KEY = 'turnbased.editor.sidebarOpen';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

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
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [paletteOwnerId] = useState<string | null>('player_one');
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  // Version history lives in IndexedDB, so status + graph arrive async and
  // are refreshed after every workspace autosave or version action.
  const [gitStatus, setGitStatus] = useState<ProjectGitStatus | null>(null);
  const [versionGraph, setVersionGraph] = useState<ProjectVersionGraph | null>(null);
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0);
  const [versionBusy, setVersionBusy] = useState(false);
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const versionLock = useRef(false);
  const loadedProjectId = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  // The sidebar behaves like a drawer: it slides out of view and the canvas
  // reclaims the space. The open/closed choice is remembered across sessions.
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (window.innerWidth < 900) return false;
    return window.localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false';
  });
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen));
  }, [isSidebarOpen]);
  useEffect(() => {
    const resize = () => { if (window.innerWidth < 900) setIsSidebarOpen(false); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    // Guards against a stale async load landing after a newer hashchange.
    let activeLoadId = 0;

    const syncRoute = async () => {
      const loadId = ++activeLoadId;
      const nextProjectId = readProjectIdFromHash();
      if (loadedProjectId.current === nextProjectId && nextProjectId) {
        setActiveSection(readEditorSection(window.location.hash));
        return;
      }
      let loadedProject: EditorProject | null;
      try {
        loadedProject = nextProjectId ? await loadEditorProject(nextProjectId) : null;
      } catch (error) {
        if (loadId !== activeLoadId) return;
        loadedProjectId.current = null;
        setProjectId(nextProjectId);
        resetProjectHistory(null);
        setEditorNotice(error instanceof Error ? error.message : 'This saved game could not be opened.');
        return;
      }
      if (loadId !== activeLoadId) {
        return;
      }
      const nextProject = loadedProject ? syncAllGeneratedBoardChildren(loadedProject) : null;
      const pendingNotice = window.sessionStorage.getItem(PENDING_EDITOR_NOTICE_KEY);

      loadedProjectId.current = nextProjectId;
      setProjectId(nextProjectId);
      resetProjectHistory(nextProject);
      setActiveSection(readEditorSection(window.location.hash));
      setSelectedComponentId(null);
      setPlacementId(null);
      setGitStatus(null);
      setVersionGraph(null);
      setEditorNotice(pendingNotice);
      if (pendingNotice) {
        window.sessionStorage.removeItem(PENDING_EDITOR_NOTICE_KEY);
      }
    };

    const onHashChange = () => { void syncRoute(); };
    void syncRoute();
    window.addEventListener('hashchange', onHashChange);
    return () => {
      activeLoadId += 1;
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [resetProjectHistory]);

  useEffect(() => {
    if (!project) {
      return;
    }

    let cancelled = false;
    setSaveStatus('saving');
    saveEditorProject(project).then(() => {
      if (!cancelled) setSaveStatus('saved');
    }).catch((error) => {
      if (!cancelled) {
        setSaveStatus('error');
        setEditorNotice(error instanceof Error ? error.message : 'Your changes could not be saved. Export a backup before closing.');
      }
    });
    return () => { cancelled = true; };
  }, [project]);

  useEffect(() => {
    if (!project || project.phase !== 'ready') {
      return;
    }

    let cancelled = false;
    const workspaceRuntime = buildPreviewRuntime(project);
    (async () => {
      await syncProjectWorkspace(project, workspaceRuntime);
      const [nextStatus, nextGraph] = await Promise.all([
        getProjectGitStatus(project, workspaceRuntime),
        getProjectVersionGraph(project.id),
      ]);
      if (!cancelled) {
        setGitStatus(nextStatus);
        setVersionGraph(nextGraph);
      }
    })().catch((error) => {
      console.error('[turnbased] workspace sync failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, [project, versionsRefreshKey]);

  useUndoRedoKeyboard(
    () => { if (!versionLock.current) undoProject(); },
    () => { if (!versionLock.current) redoProject(); },
  );

  const runtime = project ? buildPreviewRuntime(project) : null;
  const resolvedSelectedComponentId = project && selectedComponentId && project.instances[selectedComponentId]
    ? selectedComponentId
    : null;
  const selectedComponent = project && resolvedSelectedComponentId ? project.instances[resolvedSelectedComponentId] ?? null : null;

  if (!projectId) {
    return <div data-layout="editorLoading" style={{ padding: '2rem' }}>Loading project...</div>;
  }

  if (!project || !runtime) {
    return (
      <div data-layout="editorUnavailable" style={{ padding: '2rem' }}>
        <h1>Project not found</h1>
        <p role="alert">{editorNotice || 'This local project could not be loaded. Open your workshop to find your other games.'}</p>
        <a href="#/dashboard">Back to Dashboard</a>
      </div>
    );
  }

  if (project.phase !== 'ready') {
    return (
      <div data-layout="editorSetupRequired" style={{ padding: '2rem' }}>
        <h1>Build this project with AI first</h1>
        <p>This workspace is still in the setup phase. Finish making the game before opening the post-build editor.</p>
        <a href="#/new">Back to new game</a>
      </div>
    );
  }

  const currentProject = project;
  const currentRuntime = runtime;
  // Placeholders until the async IndexedDB read lands (see the sync effect).
  const currentGitStatus: ProjectGitStatus = gitStatus ?? {
    changedPaths: [],
    trackedPaths: [],
    headCommitSha: null,
    hasChanges: false,
  };
  const currentVersionGraph: ProjectVersionGraph = versionGraph ?? {
    activeBranchName: DEFAULT_VERSION_BRANCH_NAME,
    activeCommitSha: null,
    commits: [],
    branchNames: [DEFAULT_VERSION_BRANCH_NAME],
  };

  // Map each version (branch) to its head commit so the sidebar dropdown can
  // switch versions. Commits arrive newest-first, so the first one seen per
  // branch is its head.
  const branchHeadShas = new Map<string, string>();
  currentVersionGraph.commits.forEach((commit) => {
    const branchName = commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME;
    if (!branchHeadShas.has(branchName)) {
      branchHeadShas.set(branchName, commit.commitSha);
    }
  });
  const versionOptions = Array.from(branchHeadShas.keys()).map((name) => ({
    name,
    isActive: name === currentVersionGraph.activeBranchName,
  }));

  function commitProject(nextProject: EditorProject) {
    if (versionLock.current) return;
    setProject({ ...nextProject, updatedAt: new Date().toISOString() });
    setEditorNotice(null);
  }

  async function handleSaveVersion(message?: string) {
    if (versionLock.current) return;
    versionLock.current = true;
    setVersionBusy(true);
    try {
      await saveEditorProject(currentProject);
      const result = await commitActiveProjectVersion(currentProject, currentRuntime, message);
      if (loadedProjectId.current !== currentProject.id) return;
      if (result.project !== currentProject) {
        setProject(result.project);
      }
      setVersionsRefreshKey((key) => key + 1);
      setEditorNotice(
        result.remoteError
          ? `Saved locally. Remote sync is unavailable right now: ${result.remoteError}`
          : `Saved ${result.commit.message}.`,
      );
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to save this version.');
    } finally {
      versionLock.current = false;
      setVersionBusy(false);
    }
  }

  async function handleCreateVersion(branchName: string) {
    if (versionLock.current) return;
    versionLock.current = true;
    setVersionBusy(true);
    try {
      const result = await createProjectVersionBranch(currentProject, currentRuntime, branchName);
      if (loadedProjectId.current !== currentProject.id) return;
      if (result.project !== currentProject) {
        setProject(result.project);
      }
      setVersionsRefreshKey((key) => key + 1);
      setActiveSection('versions');
      setEditorNotice(
        result.remoteError
          ? `Created "${branchName}" locally. Remote sync is unavailable right now: ${result.remoteError}`
          : `Created "${branchName}".`,
      );
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to create that version branch.');
    } finally {
      versionLock.current = false;
      setVersionBusy(false);
    }
  }

  async function handleRestoreVersion(commitSha: string) {
    if (versionLock.current) return;
    versionLock.current = true;
    setVersionBusy(true);
    try {
      const status = await getProjectGitStatus(currentProject, currentRuntime);
      if (status.hasChanges) {
        await commitActiveProjectVersion(currentProject, currentRuntime, 'Safety checkpoint before switching versions');
      }
      const restoredProject = await restoreProjectFromCommit(currentProject.id, commitSha);
      await saveEditorProject(restoredProject);
      if (loadedProjectId.current !== currentProject.id) return;
      resetProjectHistory(restoredProject);
      setRestoreEpoch((epoch) => epoch + 1);
      setSelectedComponentId(null);
      setVersionsRefreshKey((key) => key + 1);
      setEditorNotice(status.hasChanges ? 'Version restored. Your previous work is kept in a safety checkpoint.' : 'Version restored.');
    } catch (error) {
      setEditorNotice(error instanceof Error ? error.message : 'Unable to restore that version.');
    } finally {
      versionLock.current = false;
      setVersionBusy(false);
    }
  }

  function handleSwitchVersion(branchName: string) {
    const commitSha = branchHeadShas.get(branchName);
    if (commitSha) void handleRestoreVersion(commitSha);
  }

  const { handleAddComponent, handleAddCatalogComponent, handleUpdateCatalogComponent, updateComponent, removeComponent, duplicateComponent, openComponentEditor, selectComponent } = createEditorComponentActions({
    project: currentProject, paletteOwnerId, selectedComponentId, setSelectedComponentId, setActiveSection, onChange: commitProject, setNotice: setEditorNotice,
  });

  function renderActiveSection() {
    const sectionKey = `${currentProject.id}-${restoreEpoch}`;
    const activeCheckpoint = currentVersionGraph.commits.find((commit) => commit.commitSha === currentVersionGraph.activeCommitSha);
    const playtestVersionLabel = `${currentVersionGraph.activeBranchName}${activeCheckpoint ? ` · v${activeCheckpoint.versionNumber}` : ''}${currentGitStatus.hasChanges ? ' · working draft' : ''}`;
    switch (activeSection) {
      case 'workshop':
        return <WorkshopSection project={currentProject} onNavigate={setActiveSection} versionCount={currentVersionGraph.commits.length} />;
      case 'card_studio':
        return <ComponentsWorkbench key={`${sectionKey}-cards`} project={currentProject} onChange={commitProject} initialKind="card" onOpenPlacement={(id) => { setSelectedComponentId(id); setPlacementId(id); setActiveSection('component_editor'); }} />;
      case 'playtest':
        return <PlaytestSection key={sectionKey} project={currentProject} onChange={commitProject} versionSha={currentVersionGraph.activeCommitSha} versionLabel={playtestVersionLabel} />;
      case 'print':
        return <PrintSection project={currentProject} onNavigate={setActiveSection} />;
      case 'rules':
        return (
          <RulesSection
            key={sectionKey}
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
            gitStatus={currentGitStatus}
            versionGraph={currentVersionGraph}
            onCreateVersion={handleCreateVersion}
            project={currentProject}
            busy={versionBusy}
            onSaveCheckpoint={handleSaveVersion}
            onRestoreCommit={handleRestoreVersion}
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
        if (!placementId || !resolvedSelectedComponentId) {
          return <ComponentsWorkbench key={`${sectionKey}-${resolvedSelectedComponentId ?? 'gallery'}`} project={currentProject} onChange={commitProject} selectedComponentId={resolvedSelectedComponentId} onOpenPlacement={(id) => { setSelectedComponentId(id); setPlacementId(id); }} />;
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
            onReturnToGallery={() => setPlacementId(null)}
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
    <EditorFrame busy={versionBusy} activeSection={activeSection} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen((value) => !value)} sidebar={
        <EditorSidebar
          project={currentProject}
          isOpen={isSidebarOpen}
          activeSection={activeSection === 'card_studio' ? 'component_editor' : activeSection}
          setActiveSection={(next) => { setActiveSection(next); if (window.innerWidth < 900) setIsSidebarOpen(false); }}
          onOpenComponentEditor={() => { setPlacementId(null); openComponentEditor(); if (window.innerWidth < 900) setIsSidebarOpen(false); }}
          onRenameProject={(name) => commitProject(renameProject(currentProject, name))}
          activeVersionName={currentVersionGraph.activeBranchName}
          versionOptions={versionOptions}
          onSaveVersion={() => { void handleSaveVersion(); }}
          saveStatus={saveStatus}
          versionBusy={versionBusy}
          onSwitchVersion={handleSwitchVersion}
          onCreateVersion={handleCreateVersion}
          notice={editorNotice}
          onDismissNotice={() => setEditorNotice(null)}
        />
    }>{renderActiveSection()}</EditorFrame>
  );
};
