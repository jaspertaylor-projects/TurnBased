
import type { CSSProperties } from 'react';

import { AppPageFrame } from '../components/AppPageFrame';
import { updateUserSettings, useUserSettings, type UserLengthUnit } from '../userSettings';

const UNIT_OPTIONS: { value: UserLengthUnit; label: string }[] = [
  { value: 'inches', label: 'Inches (in)' },
  { value: 'mm', label: 'Millimeters (mm)' },
];

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

export const Settings = () => {
  const userSettings = useUserSettings();

  return (
    <AppPageFrame contentStyle={{ maxWidth: '960px', margin: '0 auto' }}>
      <h1>Account Settings</h1>

      <section data-layout="preferencesSection" /* user-level preferences that persist across projects */ style={{ marginTop: '2rem' }}>
        <h2>Preferences</h2>
        <div data-layout="measurementUnitsRow" /* toggles inches vs. millimeters for every physical dimension display */ style={{ display: 'grid', gap: '0.55rem', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, color: '#064e3b' }}>Measurement Units</div>
            <div style={{ color: '#0f766e', fontSize: '0.85rem' }}>Applied to every board, tile, and deck dimension shown in the editor.</div>
          </div>
          <div role="radiogroup" aria-label="Preferred units" style={{ display: 'inline-flex', gap: '0.5rem' }}>
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

      <section style={{ marginTop: '2rem' }}>
        <h2>Subscription Tier</h2>
        <p>Current Tier: <strong>Free</strong></p>
        <button style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>
          Upgrade to Pro
        </button>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Usage & Quotas</h2>
        <ul>
          <li>AI Prompts Used Today: 0 / 10</li>
          <li>Art Storage Used: 0 / 1GB</li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Wallet</h2>
        <p>Current Balance: <strong>$0.00</strong></p>
        <button style={{ padding: '0.5rem 1rem', background: '#eab308', color: 'white', border: 'none', borderRadius: '4px' }}>
          Add Credits
        </button>
      </section>
    </AppPageFrame>
  );
};
