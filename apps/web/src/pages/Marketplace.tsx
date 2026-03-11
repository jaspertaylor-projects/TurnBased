import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const Marketplace = () => {
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [buyingId, setBuyingId] = useState<string | null>(null);

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async () => {
        setLoading(true);
        try {
            // Fetch published listings
            const { data, error: fetchErr } = await supabase
                .from('listings')
                .select('*, projects(name), project_builds(r2_prefix)')
                .eq('status', 'published')
                .order('created_at', { ascending: false });

            if (fetchErr) throw fetchErr;

            // Fetch user's entitlements to mark things as "Owned"
            const { data: { user } } = await supabase.auth.getUser();
            if (user && data) {
                const { data: entitlements } = await supabase
                    .from('entitlements')
                    .select('listing_id')
                    .eq('buyer_id', user.id);
                
                const ownedSet = new Set(entitlements?.map(e => e.listing_id) || []);
                const enriched = data.map(l => ({ ...l, isOwned: ownedSet.has(l.id) }));
                setListings(enriched);
            } else {
                setListings(data || []);
            }
        } catch (err: any) {
             setError(err.message || 'Error loading marketplace');
        } finally {
             setLoading(false);
        }
    };

    const handleMockPurchase = async (listing: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
             alert("Please login to purchase");
             return;
        }

        setBuyingId(listing.id);
        try {
            // Mock a Stripe webhook invocation since we don't have real Stripe keys
            // This is purely for development testing
            const { error: invokeErr } = await supabase.functions.invoke('stripe-webhook', {
                body: {
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                             metadata: {
                                  buyer_id: user.id,
                                  listing_id: listing.id
                             },
                             payment_intent: 'mock_pi_' + Date.now(),
                             amount_total: listing.price_cents
                        }
                    }
                },
                headers: {
                    'stripe-signature': 'mock_signature' // Mock
                }
            });

            if (invokeErr) throw invokeErr;

            alert("Purchase successful! You now own " + listing.title);
            fetchListings(); // Refresh to show "Owned"

        } catch (err: any) {
             alert("Test Purchase Failed: " + err.message);
        } finally {
             setBuyingId(null);
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading Marketplace...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            <h2>Marketplace</h2>
            <p style={{ color: '#64748b', marginBottom: '2rem' }}>Discover and purchase new board games from the community.</p>

            {listings.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                     <h3 style={{ color: '#94a3b8' }}>No published games found</h3>
                     <p style={{ color: '#cbd5e1' }}>Check back later or publish your own!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                    {listings.map(listing => (
                         <div key={listing.id} style={{ display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                             
                             {/* Cover Image Placeholder */}
                             <div style={{ height: '160px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <span style={{ fontSize: '48px' }}>🎲</span>
                             </div>
                             
                             <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                 <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{listing.title}</h3>
                                 <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.875rem', flex: 1 }}>
                                     {listing.description || 'No description provided.'}
                                 </p>
                                 
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                     <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>
                                         ${(listing.price_cents / 100).toFixed(2)}
                                     </span>
                                     
                                     {listing.isOwned ? (
                                         <div style={{ display: 'flex', gap: '0.5rem' }}>
                                             <button 
                                                 onClick={() => window.location.hash = '#/lobby'}
                                                 style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                             >
                                                 Play
                                             </button>
                                             <button
                                                 onClick={() => alert('Mock: Create a new room with license_mode="owned_required" & listing_id=' + listing.id)}
                                                 style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                             >
                                                Host
                                             </button>
                                         </div>
                                     ) : (
                                         <button 
                                             onClick={() => handleMockPurchase(listing)}
                                             disabled={buyingId === listing.id}
                                             style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                         >
                                             {buyingId === listing.id ? 'Processing...' : 'Buy Now'}
                                         </button>
                                     )}
                                 </div>
                             </div>
                         </div>
                    ))}
                </div>
            )}
        </div>
    );
};
