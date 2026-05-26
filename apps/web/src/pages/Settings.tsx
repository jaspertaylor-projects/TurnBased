import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CreditCard, Ruler, Sparkles } from 'lucide-react';

import { AppPageFrame } from '../components/AppPageFrame';
import { supabase } from '../lib/supabaseClient';
import {
  IMAGE_GENERATION_MODEL_OPTIONS,
  RULES_WRITER_MODEL_OPTIONS,
  getModelLabel,
  type AIModelOption,
} from '../editor/aiModelCatalog';
import {
  formatCents,
  formatExactUsd,
  formatUsdEstimate,
  getCompletionTokens,
  getPlatformFeeUsd,
  getPromptTokens,
  getProviderUsd,
  getTotalChargedUsd,
  getWalletDebitUsd,
  type BillingLedgerRow,
} from '../editor/billingDisplay';
import { updateUserSettings, useUserSettings, type UserLengthUnit } from '../userSettings';

const UNIT_OPTIONS: { value: UserLengthUnit; label: string }[] = [
  { value: 'inches', label: 'Inches (in)' },
  { value: 'mm', label: 'Millimeters (mm)' },
];

type SettingsTab = 'ai' | 'payments' | 'preferences';

function unitButtonStyle(isActive: boolean): CSSProperties {
  return {
    padding: '0.55rem 1.1rem',
    borderRadius: '10px',
    border: isActive ? '1px solid #0f766e' : '1px solid rgba(15,118,110,0.22)',
    background: isActive ? 'rgba(16,185,129,0.16)' : 'rgba(248,250,252,0.95)',
    color: isActive ? '#064e3b' : '#334155',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    minWidth: '136px',
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function readSurface(meta: Record<string, unknown> | null): string {
  const surface = meta?.surface;
  if (typeof surface === 'string') return surface;
  const prompt = meta?.prompt;
  if (typeof prompt === 'string') return prompt.length > 48 ? `${prompt.slice(0, 48)}...` : prompt;
  return 'AI call';
}

function tabStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '999px',
    border: active ? '1px solid rgba(13,148,136,0.8)' : '1px solid rgba(15,118,110,0.18)',
    background: active ? 'rgba(13,148,136,0.16)' : 'rgba(255,255,255,0.86)',
    color: active ? '#064e3b' : '#334155',
    padding: '0.5rem 0.85rem',
    fontWeight: 800,
    cursor: 'pointer',
  };
}

function ModelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: AIModelOption[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  return (
    <label data-layout="accountAIModelSelect" style={{ display: 'grid', gap: '0.45rem', color: '#064e3b', fontWeight: 800 }}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ borderRadius: '10px', border: '1px solid rgba(15,118,110,0.18)', padding: '0.65rem 0.75rem', fontSize: '0.94rem' }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <span style={{ color: '#0f766e', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.45 }}>{selected.description}</span>
    </label>
  );
}

export const Settings = () => {
  const userSettings = useUserSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedPriceId, setExpandedPriceId] = useState<string | null>(null);
  const [billing, setBilling] = useState<{
    loading: boolean;
    error: string | null;
    walletCents: number | null;
    history: BillingLedgerRow[];
  }>({ loading: false, error: null, walletCents: null, history: [] });
  const totalSpentCents = useMemo(
    () => billing.history.reduce((sum, row) => sum + getTotalChargedUsd(row), 0),
    [billing.history],
  );

  useEffect(() => {
    if (activeTab !== 'payments') return;
    let cancelled = false;
    async function loadBilling() {
      setBilling((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.is_anonymous) throw new Error('Sign in to view account balance.');
        const [{ data: profile, error: profileError }, { data: history, error: historyError }] = await Promise.all([
          supabase.from('profiles').select('wallet_cents').eq('id', session.user.id).single(),
          supabase
            .from('ai_usage_ledger')
            .select('id, provider, model_id, modality, provider_cost_cents, platform_fee_cents, total_charged_cents, request_meta, response_meta, created_at')
            .order('created_at', { ascending: false }),
        ]);
        if (profileError) throw new Error(profileError.message);
        if (historyError) throw new Error(historyError.message);
        if (!cancelled) {
          setBilling({
            loading: false,
            error: null,
            walletCents: typeof profile?.wallet_cents === 'number' ? profile.wallet_cents : 0,
            history: (history ?? []) as BillingLedgerRow[],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setBilling((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Unable to load billing history.',
          }));
        }
      }
    }
    void loadBilling();
    return () => { cancelled = true; };
  }, [activeTab, refreshKey]);

  return (
    <AppPageFrame contentStyle={{ maxWidth: '960px', margin: '0 auto' }}>
      <h1>Account Settings</h1>

      <div data-layout="accountSettingsTabs" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <button type="button" onClick={() => setActiveTab('ai')} style={tabStyle(activeTab === 'ai')}><Sparkles size={15} /> AI models</button>
        <button type="button" onClick={() => setActiveTab('payments')} style={tabStyle(activeTab === 'payments')}><CreditCard size={15} /> Payments</button>
        <button type="button" onClick={() => setActiveTab('preferences')} style={tabStyle(activeTab === 'preferences')}><Ruler size={15} /> Preferences</button>
      </div>

      {activeTab === 'ai' ? (
        <section data-layout="accountAISection" style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <h2>Default AI Models</h2>
          <ModelSelect
            label="Writing rules"
            value={userSettings.defaultAIModels.rulesWriter}
            options={RULES_WRITER_MODEL_OPTIONS}
            onChange={(rulesWriter) => updateUserSettings((prev) => ({
              ...prev,
              defaultAIModels: { ...prev.defaultAIModels, rulesWriter },
            }))}
          />
          <ModelSelect
            label="Creating images"
            value={userSettings.defaultAIModels.imageGeneration}
            options={IMAGE_GENERATION_MODEL_OPTIONS}
            onChange={(imageGeneration) => updateUserSettings((prev) => ({
              ...prev,
              defaultAIModels: { ...prev.defaultAIModels, imageGeneration },
            }))}
          />
          <p style={{ color: '#0f766e', lineHeight: 1.5 }}>
            These model choices are used by the rulebook and art AI tools.
          </p>
        </section>
      ) : null}

      {activeTab === 'payments' ? (
        <section data-layout="accountPaymentsSection" style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <div data-layout="accountPaymentsHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{ margin: 0 }}>Payments</h2>
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} style={{ borderRadius: '999px', border: '1px solid rgba(15,118,110,0.22)', background: 'white', color: '#064e3b', padding: '0.45rem 0.85rem', fontWeight: 800, cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
          {billing.error ? <div data-layout="accountPaymentsError" style={{ color: '#991b1b', background: 'rgba(254,226,226,0.9)', borderRadius: '10px', padding: '0.7rem' }}>{billing.error}</div> : null}
          <div data-layout="accountPaymentsSummary" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div data-layout="accountBalanceCard" style={{ borderRadius: '14px', background: 'rgba(240,253,244,0.8)', border: '1px solid rgba(15,118,110,0.14)', padding: '1rem' }}>
              <div style={{ color: '#0f766e', fontWeight: 800 }}>Account balance</div>
              <div style={{ color: '#064e3b', fontSize: '2rem', fontWeight: 900 }}>{billing.loading ? '...' : formatCents(billing.walletCents)}</div>
            </div>
            <div data-layout="accountSpendCard" style={{ borderRadius: '14px', background: 'rgba(255,253,246,0.9)', border: '1px solid rgba(120,95,50,0.16)', padding: '1rem' }}>
              <div style={{ color: '#8a6a34', fontWeight: 800 }}>Total model charges</div>
              <div style={{ color: '#3b2412', fontSize: '2rem', fontWeight: 900 }}>{formatUsdEstimate(totalSpentCents)}</div>
            </div>
          </div>
          <div data-layout="accountModelHistory" style={{ display: 'grid', gap: '0.5rem' }}>
            <h3>Model call history</h3>
            {billing.history.length > 0 ? billing.history.map((row) => {
              const expanded = expandedPriceId === row.id;
              const promptTokens = getPromptTokens(row);
              const completionTokens = getCompletionTokens(row);
              return (
              <div key={row.id} data-layout="accountModelHistoryRow" style={{ display: 'grid', gap: '0.6rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.1)', background: 'rgba(255,255,255,0.86)', padding: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#064e3b', fontWeight: 900 }}>{getModelLabel(row.model_id)}</div>
                  <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>{row.provider} / {row.modality} - {readSurface(row.request_meta)}</div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{formatDate(row.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#334155', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#3b2412', fontSize: '0.94rem' }}>{formatUsdEstimate(getTotalChargedUsd(row))}</strong>
                  <div>Provider {formatUsdEstimate(getProviderUsd(row))}</div>
                  <div>Fee {formatUsdEstimate(getPlatformFeeUsd(row))}</div>
                  <button type="button" onClick={() => setExpandedPriceId(expanded ? null : row.id)} style={{ marginTop: '0.3rem', border: '1px solid rgba(15,118,110,0.24)', borderRadius: '999px', background: 'rgba(240,253,244,0.82)', color: '#064e3b', padding: '0.22rem 0.55rem', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer' }}>
                    {expanded ? 'Hide exact' : 'Exact price'}
                  </button>
                </div>
              </div>
                {expanded ? (
                  <div data-layout="accountExactPrice" style={{ borderRadius: '10px', background: 'rgba(240,253,244,0.72)', border: '1px solid rgba(15,118,110,0.12)', padding: '0.6rem 0.7rem', color: '#064e3b', fontSize: '0.78rem', lineHeight: 1.55 }}>
                    <div><strong>Exact total:</strong> {formatExactUsd(getTotalChargedUsd(row))}</div>
                    <div><strong>Exact provider cost:</strong> {formatExactUsd(getProviderUsd(row))}</div>
                    <div><strong>Exact platform fee:</strong> {formatExactUsd(getPlatformFeeUsd(row))}</div>
                    <div><strong>Wallet debit:</strong> {formatCents(row.total_charged_cents)}{getWalletDebitUsd(row) !== getTotalChargedUsd(row) ? ' rounded to whole cents' : ''}</div>
                    {promptTokens !== null || completionTokens !== null ? (
                      <div><strong>Tokens:</strong> {promptTokens ?? 0} prompt / {completionTokens ?? 0} completion</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );}) : (
              <div data-layout="accountModelHistoryEmpty" style={{ color: '#0f766e', background: 'rgba(240,253,244,0.65)', borderRadius: '12px', padding: '0.85rem' }}>
                {billing.loading ? 'Loading model call history...' : 'No model calls recorded yet.'}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'preferences' ? (
        <section data-layout="preferencesSection" style={{ marginTop: '1rem' }}>
          <h2>Preferences</h2>
          <div data-layout="measurementUnitsRow" style={{ display: 'grid', gap: '0.55rem', marginTop: '0.75rem' }}>
            <div data-layout="measurementUnitsHeader" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, color: '#064e3b' }}>Measurement Units</div>
              <div style={{ color: '#0f766e', fontSize: '0.85rem' }}>Applied to every board, tile, and deck dimension shown in the editor.</div>
            </div>
            <div data-layout="measurementUnitsControls" role="radiogroup" aria-label="Preferred units" style={{ display: 'inline-flex', gap: '0.5rem' }}>
              {UNIT_OPTIONS.map(({ value, label }) => {
                const isActive = userSettings.preferredUnits === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => updateUserSettings((prev) => ({ ...prev, preferredUnits: value }))}
                    style={unitButtonStyle(isActive)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </AppPageFrame>
  );
};
