import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Brush,
  CheckCircle2,
  Flag,
  Layers3,
  Sparkles,
  Users,
} from 'lucide-react';

import { createSimpleRulesBrief, getRulesBriefSuggestions } from '../editor/aiBuilder';
import { buildProjectWithAI, getCreatorEnvironmentStatus } from '../editor/aiBuildService';
import { commitProjectVersion } from '../editor/git';
import { renderIcon } from '../editor/iconography';
import { buildPreviewRuntime } from '../editor/runtime';
import { saveEditorProject } from '../editor/storage';
import { createDefaultRulesBrief } from '../editor/project';
import { saveProjectWorkspace } from '../editor/workspace';
import { createWorkspaceFiles } from '../editor/shipping';
import type { RulesBuilderBrief } from '../editor/types';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

function clampPlayerCount(value: number): number {
  return Math.max(1, Math.min(6, value));
}

function updatePlayerRange(
  current: RulesBuilderBrief,
  patch: Partial<Pick<RulesBuilderBrief, 'minPlayers' | 'maxPlayers'>>,
): RulesBuilderBrief {
  const minPlayers = clampPlayerCount(patch.minPlayers ?? current.minPlayers);
  const maxPlayers = clampPlayerCount(patch.maxPlayers ?? current.maxPlayers);
  return {
    ...current,
    minPlayers: Math.min(minPlayers, maxPlayers),
    maxPlayers: Math.max(minPlayers, maxPlayers),
  };
}

const PANEL_STYLE = {
  padding: '1.4rem',
  borderRadius: '24px',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(16,185,129,0.14)',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
} as const;

export const CreateBlankProject = () => {
  const [brief, setBrief] = useState<RulesBuilderBrief>(() => createDefaultRulesBrief());
  const [aiFeedback, setAiFeedback] = useState<{ title: string; body: string } | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
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
    setAiFeedback(null);

    try {
      const buildResult = await buildProjectWithAI(brief);
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
      setAiFeedback({
        title: 'AI build failed',
        body: error instanceof Error ? error.message : 'The project could not be generated right now.',
      });
    } finally {
      setIsBuilding(false);
    }
  }

  const playerRangeLabel = brief.minPlayers === brief.maxPlayers
    ? `${brief.maxPlayers} player${brief.maxPlayers === 1 ? '' : 's'}`
    : `${brief.minPlayers}-${brief.maxPlayers} players`;
  const seatPreviewCount = brief.maxPlayers;
  const canBuild = brief.name.trim().length > 0 && brief.theme.trim().length > 0 && brief.artStyle.trim().length > 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1180px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)' }}>
        <div style={{ ...PANEL_STYLE, display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <div>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.45rem' }}>
              AI-first game creation
            </p>
            <h1 style={{ margin: '0 0 0.6rem 0' }}>Start with the setup</h1>
            <p style={{ color: '#0f766e', lineHeight: 1.7, margin: 0 }}>
              Enter the core setup once, then let AI generate a shared board view, clickable player summary strip, linked player views, and starter block resources.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(240,253,244,0.9)', color: '#065f46', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem' }}>
                <Layers3 size={18} />
                <strong>Generated shell</strong>
              </div>
              Shared main board, persistent player strip, linked player views, and 6 starting blocks per seat.
            </div>

            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(239,246,255,0.92)', color: '#155e75', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem' }}>
                <Bot size={18} />
                <strong>AI build mode</strong>
              </div>
              {environmentStatus.aiBuildLabel}
            </div>

            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(255,247,237,0.92)', color: '#9a3412', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem' }}>
                <CheckCircle2 size={18} />
                <strong>Version history</strong>
              </div>
              {environmentStatus.versionControlLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setBrief(createSimpleRulesBrief());
                setAiFeedback(null);
              }}
              style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.85)', color: '#064e3b', padding: '0.65rem 0.9rem' }}
            >
              Try example setup
            </button>
            <button
              onClick={() => {
                setBrief(createDefaultRulesBrief());
                setAiFeedback(null);
              }}
              style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.85)', color: '#064e3b', padding: '0.65rem 0.9rem' }}
            >
              Reset form
            </button>
          </div>

          <div style={{ padding: '1rem', borderRadius: '20px', background: 'linear-gradient(145deg, rgba(16,185,129,0.1), rgba(14,165,233,0.08))', border: '1px solid rgba(15,118,110,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.8rem' }}>
              <div>
                <div style={{ color: '#0f766e', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Previewed setup</div>
                <div style={{ fontWeight: 800, color: '#064e3b' }}>{brief.name || 'Untitled linked-view prototype'}</div>
              </div>
              <div style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.8)', color: '#065f46', fontSize: '0.82rem' }}>
                {playerRangeLabel}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {Array.from({ length: seatPreviewCount }, (_, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.7rem 0.8rem', borderRadius: '16px', background: 'rgba(255,255,255,0.82)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#ec4899', '#f59e0b'][index % 6]} 24%, white)` }}>
                    {renderIcon(['crown', 'shield', 'sparkles', 'leaf', 'flame', 'gem'][index % 6], { size: 18, style: { color: '#064e3b' } })}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#064e3b' }}>Player {index + 1}</div>
                    <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>Linked view + 6 starting blocks</div>
                  </div>
                  <ArrowRight size={16} color="#0f766e" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...PANEL_STYLE, display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr)' }}>
            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
              Game name
              <input
                value={brief.name}
                onChange={(event) => setBrief((current) => ({ ...current, name: event.target.value }))}
                placeholder="Lantern Blocks, Clockwork Orchard, Drift Market..."
                style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
              Min players
              <input
                type="number"
                min={1}
                max={6}
                value={brief.minPlayers}
                onChange={(event) => setBrief((current) => updatePlayerRange(current, { minPlayers: Number(event.target.value) || 1 }))}
                style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
              Max players
              <input
                type="number"
                min={1}
                max={6}
                value={brief.maxPlayers}
                onChange={(event) => setBrief((current) => updatePlayerRange(current, { maxPlayers: Number(event.target.value) || 1 }))}
                style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.12)' }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
              Theme
              <div style={{ position: 'relative' }}>
                <Sparkles size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#0f766e' }} />
                <input
                  value={brief.theme}
                  onChange={(event) => setBrief((current) => ({ ...current, theme: event.target.value }))}
                  placeholder="Harbor guilds, dream gardens, relic racers..."
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
                  placeholder="Cozy woodcut, bright sci-fi schematic..."
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
                onChange={(event) => setBrief((current) => ({ ...current, hasDistinctSoloMode: event.target.checked, minPlayers: event.target.checked ? Math.min(current.minPlayers, 1) : current.minPlayers }))}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                  <Users size={16} />
                  Distinct solo mode
                </span>
                <span style={{ display: 'block', marginTop: '0.2rem', lineHeight: 1.6 }}>Create metadata that tells AI to give solo play its own interpretation, not just “play both sides.”</span>
              </span>
            </label>

            <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1rem', borderRadius: '18px', background: 'rgba(255,247,237,0.92)', color: '#9a3412' }}>
              <input
                type="checkbox"
                checked={brief.isCampaignGame}
                onChange={(event) => setBrief((current) => ({ ...current, isCampaignGame: event.target.checked }))}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                  <Flag size={16} />
                  Campaign game
                </span>
                <span style={{ display: 'block', marginTop: '0.2rem', lineHeight: 1.6 }}>Bias the generated shell and naming toward chapters, progression, and durable identity across sessions.</span>
              </span>
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(239,246,255,0.92)', color: '#155e75' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                <Users size={16} />
                Player range
              </div>
              <div style={{ marginTop: '0.35rem', lineHeight: 1.5 }}>{playerRangeLabel}</div>
            </div>
            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                <Layers3 size={16} />
                Default scaffold
              </div>
              <div style={{ marginTop: '0.35rem', lineHeight: 1.5 }}>Main board + {seatPreviewCount} linked player views + 6 blocks each.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setAiFeedback(getRulesBriefSuggestions(brief))}
              style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.15)', background: 'rgba(255,255,255,0.85)', color: '#064e3b', padding: '0.75rem 1rem' }}
            >
              Get setup suggestions
            </button>
            <button
              onClick={handleBuildWithAI}
              disabled={isBuilding || !canBuild}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '999px', border: 'none', background: isBuilding || !canBuild ? 'rgba(16,185,129,0.45)' : 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', padding: '0.75rem 1rem', cursor: isBuilding ? 'wait' : canBuild ? 'pointer' : 'not-allowed' }}
            >
              {isBuilding ? 'Building with AI...' : 'Build with AI'}
              {!isBuilding && <ArrowRight size={16} />}
            </button>
          </div>

          {!canBuild && (
            <div style={{ color: '#0f766e', fontSize: '0.84rem', lineHeight: 1.6 }}>
              Enter a game name, theme, and art style to build the first linked multi-view scaffold.
            </div>
          )}

          {aiFeedback && (
            <div style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(239,246,255,0.92)', color: '#155e75' }}>
              <div style={{ fontWeight: 800, color: '#064e3b', marginBottom: '0.35rem' }}>{aiFeedback.title}</div>
              <div style={{ lineHeight: 1.6 }}>{aiFeedback.body}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
