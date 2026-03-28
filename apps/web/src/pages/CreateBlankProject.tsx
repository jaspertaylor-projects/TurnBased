import { useEffect, useState } from 'react';
import { Brush, Flag, Users } from 'lucide-react';

import { NumericInput } from '../components/NumericInput';
import { buildProjectWithAI, getCreatorEnvironmentStatus } from '../editor/aiBuildService';
import { commitProjectVersion } from '../editor/git';
import { buildPreviewRuntime } from '../editor/runtime';
import { createDefaultRulesBrief, normalizeRulesBuilderBrief } from '../editor/project';
import { saveEditorProject } from '../editor/storage';
import { saveProjectWorkspace } from '../editor/workspace';
import { createWorkspaceFiles } from '../editor/shipping';
import type { RulesBuilderBrief } from '../editor/types';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

function updatePlayerRange(
  current: RulesBuilderBrief,
  patch: Partial<Pick<RulesBuilderBrief, 'minPlayers' | 'maxPlayers'>>,
): RulesBuilderBrief {
  const minPlayers = Math.max(1, Math.min(6, patch.minPlayers ?? current.minPlayers));
  const maxPlayers = Math.max(1, Math.min(6, patch.maxPlayers ?? current.maxPlayers));
  return {
    ...current,
    minPlayers: Math.min(minPlayers, maxPlayers),
    maxPlayers: Math.max(minPlayers, maxPlayers),
  };
}

export const CreateBlankProject = () => {
  const [brief, setBrief] = useState<RulesBuilderBrief>(() => createDefaultRulesBrief());
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [environmentStatus, setEnvironmentStatus] = useState<{
    aiBuildLabel: string;
    versionControlLabel: string;
  }>({
    aiBuildLabel: 'Checking AI build availability...',
    versionControlLabel: 'Checking backup mode...',
  });

  useEffect(() => {
    let cancelled = false;

    getCreatorEnvironmentStatus().then((status) => {
      if (cancelled) {
        return;
      }

      setEnvironmentStatus({
        aiBuildLabel: status.aiBuildLabel,
        versionControlLabel: status.versionControlLabel,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBuildWithAI() {
    setIsBuilding(true);
    setBuildError(null);

    try {
      const normalizedBrief = normalizeRulesBuilderBrief(brief);
      const buildResult = await buildProjectWithAI(normalizedBrief);
      const runtime = buildPreviewRuntime(buildResult.project);
      const files = createWorkspaceFiles(buildResult.project, runtime);

      saveEditorProject(buildResult.project);
      saveProjectWorkspace(buildResult.project.id, files);

      const commitResult = await commitProjectVersion(
        buildResult.project,
        runtime,
        buildResult.usedAI ? 'AI generated linked multi-view starter project' : 'Generated linked multi-view starter scaffold',
      );

      saveEditorProject(commitResult.project);
      const buildSummary = [
        buildResult.usedAI
          ? `AI build complete${buildResult.model ? ` via ${buildResult.model}` : ''}.`
          : `Local scaffold created${buildResult.fallbackReason ? `: ${buildResult.fallbackReason}` : '.'}`,
        buildResult.cost
          ? buildResult.cost.pricingKnown
            ? `Estimated AI call cost: $${(buildResult.cost.estimatedCostUsd ?? (buildResult.cost.totalChargedCents / 100)).toFixed(4)}.`
            : 'AI call cost is not configured for this model yet.'
          : 'No hosted AI cost was recorded for this build.',
        commitResult.remoteCommitted
          ? 'Version history is backed up to Supabase.'
          : 'Version history currently lives in this browser.',
      ].join(' ');
      window.sessionStorage.setItem(PENDING_EDITOR_NOTICE_KEY, buildSummary);
      window.location.hash = `#/editor/${commitResult.project.id}`;
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'The game could not be created right now.');
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ padding: '1.5rem', borderRadius: '28px', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(16,185,129,0.14)', boxShadow: '0 18px 48px rgba(6,78,59,0.08)', display: 'grid', gap: '1rem' }}>
        <div>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.45rem' }}>
            New Game
          </p>
          <h1 style={{ margin: '0 0 0.6rem 0' }}>Create a game</h1>
          <p style={{ color: '#0f766e', lineHeight: 1.7, margin: 0 }}>
            Start with the basics. After the first build, these settings stay editable in the editor&apos;s Settings tab.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr)' }}>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Game name
            <input
              value={brief.name}
              onChange={(event) => setBrief((current) => ({ ...current, name: event.target.value }))}
              placeholder="New game"
              style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Min players
            <NumericInput
              min={1}
              max={6}
              value={brief.minPlayers}
              onValueChange={(value) => setBrief((current) => updatePlayerRange(current, { minPlayers: value }))}
              style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Max players
            <NumericInput
              min={1}
              max={6}
              value={brief.maxPlayers}
              onValueChange={(value) => setBrief((current) => updatePlayerRange(current, { maxPlayers: value }))}
              style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Theme
            <div style={{ position: 'relative' }}>
              <Users size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#0f766e' }} />
              <input
                value={brief.theme}
                onChange={(event) => setBrief((current) => ({ ...current, theme: event.target.value }))}
                placeholder="none"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </div>
          </label>

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Art style
            <div style={{ position: 'relative' }}>
              <Brush size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#0f766e' }} />
              <input
                value={brief.artStyle}
                onChange={(event) => setBrief((current) => ({ ...current, artStyle: event.target.value }))}
                placeholder="none"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </div>
          </label>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '18px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
            <input
              type="checkbox"
              checked={brief.hasDistinctSoloMode}
              onChange={(event) => setBrief((current) => ({ ...current, hasDistinctSoloMode: event.target.checked }))}
              style={{ marginTop: '0.2rem' }}
            />
            <span>Distinct solo mode</span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '18px', background: 'rgba(255,247,237,0.92)', color: '#9a3412' }}>
            <input
              type="checkbox"
              checked={brief.isCampaignGame}
              onChange={(event) => setBrief((current) => ({ ...current, isCampaignGame: event.target.checked }))}
              style={{ marginTop: '0.2rem' }}
            />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <Flag size={16} />
              Campaign game
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gap: '0.65rem', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '0.95rem', borderRadius: '18px', background: 'rgba(239,246,255,0.92)', color: '#155e75', lineHeight: 1.6 }}>
            {environmentStatus.aiBuildLabel}
          </div>
          <div style={{ padding: '0.95rem', borderRadius: '18px', background: 'rgba(255,247,237,0.92)', color: '#9a3412', lineHeight: 1.6 }}>
            {environmentStatus.versionControlLabel}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleBuildWithAI}
            disabled={isBuilding || brief.name.trim().length === 0}
            style={{ borderRadius: '999px', border: 'none', background: isBuilding ? 'rgba(16,185,129,0.45)' : 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', padding: '0.8rem 1.15rem', cursor: isBuilding ? 'wait' : 'pointer' }}
          >
            {isBuilding ? 'Making game...' : 'Make Game'}
          </button>
        </div>

        {buildError && (
          <div style={{ padding: '0.95rem', borderRadius: '18px', background: 'rgba(254,226,226,0.9)', color: '#991b1b', lineHeight: 1.6 }}>
            {buildError}
          </div>
        )}
      </div>
    </div>
  );
};
