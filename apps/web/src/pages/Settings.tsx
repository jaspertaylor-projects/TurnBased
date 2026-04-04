
import { AppPageFrame } from '../components/AppPageFrame';

export const Settings = () => {
  return (
    <AppPageFrame contentStyle={{ maxWidth: '960px', margin: '0 auto' }}>
      <h1>Account Settings</h1>
      
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
