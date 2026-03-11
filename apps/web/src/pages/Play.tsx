import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const Play = () => {
    const [buildId, setBuildId] = useState<string | null>(null);
    const [buildUrl, setBuildUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash;
        const parts = hash.split('/');
        if (parts.length > 2) {
            setBuildId(parts[2]);
        }
    }, []);

    useEffect(() => {
        const fetchBuildMetadata = async () => {
             if (!buildId) return;
             try {
                // Fetch public metadata on the build from Supabase
                const { data, error } = await supabase
                    .from('project_builds')
                    .select('r2_prefix, projects(name)')
                    .eq('id', buildId)
                    .single();
                
                if (error || !data) throw new Error('Build not found or inaccessible.');

                // Assemble the Mock Play Environment string corresponding to the R2 Storage
                // Standard production setup would serve this out of a custom domain origin to enforce CSP sandboxing safely
                setBuildUrl(`https://play.turnbased.dev/${data.r2_prefix}/index.html`);

             } catch (err: any) {
                 setError(err.message);
             }
        }
        fetchBuildMetadata();
    }, [buildId]);

    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;
    if (!buildId || !buildUrl) return <div style={{ padding: '2rem' }}>Loading Sandbox...</div>;

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#1e293b', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', color: 'white', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <strong>Game Sandbox</strong>
                   <span style={{ fontSize: '12px', color: '#94a3b8' }}>ID: {buildId}</span>
                </div>
                <div>
                     <button onClick={() => window.location.hash = '#/dashboard'} style={{ background: 'transparent', color: 'white', border: '1px solid #475569', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>Back to Menu</button>
                </div>
            </div>
            {/* The primary security boundary: ensure `allow-same-origin` isn't blindly thrown on the iframe. Play acts from an independent web origin. */}
            <iframe 
               src={buildUrl} 
               sandbox="allow-scripts allow-pointer-lock allow-fullscreen"
               style={{ flex: 1, border: 'none', background: 'white' }} 
               title="Game Sandbox"
            />
        </div>
    );
};
