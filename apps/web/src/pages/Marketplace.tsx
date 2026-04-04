import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AppPageFrame } from '../components/AppPageFrame';

interface MarketplaceListing {
    id: string;
    title: string;
    description: string | null;
    price_cents: number;
    isOwned?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export const Marketplace = () => {
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
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
            const baseListings = (data ?? []) as MarketplaceListing[];
            if (user) {
                const { data: entitlements } = await supabase
                    .from('entitlements')
                    .select('listing_id')
                    .eq('buyer_id', user.id);
                
                const ownedSet = new Set(entitlements?.map(e => e.listing_id) || []);
                const enriched = baseListings.map((listing) => ({ ...listing, isOwned: ownedSet.has(listing.id) }));
                setListings(enriched);
            } else {
                setListings(baseListings);
            }
        } catch (error: unknown) {
             setError(getErrorMessage(error, 'Error loading marketplace'));
        } finally {
             setLoading(false);
        }
    };

    const handleMockPurchase = async (listing: MarketplaceListing) => {
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

        } catch (error: unknown) {
             alert("Test Purchase Failed: " + getErrorMessage(error, 'Mock purchase failed.'));
        } finally {
             setBuyingId(null);
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading Marketplace...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    return (
        <AppPageFrame contentStyle={{ maxWidth: '1000px', margin: '0 auto' }}>
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
                             <div style={{ height: '160px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="64" height="64" fill="currentColor">
                                     <path d="M256 0 C300 0, 316 40, 316 65 C316 90, 300 115, 256 115 C212 115, 196 90, 196 65 C196 40, 212 0, 256 0 Z M256 125 C310 125, 360 140, 420 200 C430 210, 440 240, 420 250 C400 260, 370 230, 360 230 C340 230, 330 250, 330 300 L360 490 C360 510, 310 510, 300 480 L256 320 L212 480 C202 510, 152 510, 152 490 L182 300 C182 250, 172 230, 152 230 C142 230, 112 260, 92 250 C72 240, 82 210, 92 200 C152 140, 202 125, 256 125 Z" />
                                 </svg>
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
                                                 onClick={() => {
                                                     const params = new URLSearchParams({
                                                         mode: 'owned_required',
                                                         listingId: listing.id,
                                                     });
                                                     window.location.hash = `#/lobby?${params.toString()}`;
                                                 }}
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
        </AppPageFrame>
    );
};
