

export const Home = () => {
    return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>TurnBased Platform</h1>
            <p>Welcome to the TurnBased Board Game Creator</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                <a href="#/settings" style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>Account Settings</a>
            </div>
        </div>
    )
}
