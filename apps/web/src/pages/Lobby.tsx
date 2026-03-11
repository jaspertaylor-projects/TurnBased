import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const Lobby = () => {
    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [myRooms, setMyRooms] = useState<any[]>([]);

    useEffect(() => {
        fetchMyRooms();
    }, []);

    const fetchMyRooms = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Fetch rooms where user is host or member
        const { data } = await supabase
            .from('mp_rooms')
            .select('*, mp_room_members!inner(user_id)')
            .eq('mp_room_members.user_id', user.id)
            .order('last_activity_at', { ascending: false });
            
        if (data) setMyRooms(data);
    };

    const handleCreateRoom = async () => {
        // Since we don't have a UI to select build yet, we'll just show an alert
        alert("To create a room, you need to select a published build. We'll navigate to dashboard for now.");
        window.location.hash = '#/dashboard';
    };

    const handleJoinWithCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        
        setLoading(true);
        setError('');
        
        try {
            const { data: roomId, error: joinErr } = await supabase.rpc('mp_join_room', {
                p_join_code: joinCode.trim().toUpperCase()
            });
            
            if (joinErr) throw joinErr;
            
            // Navigate to play view with the room ID
            window.location.hash = `#/play/room/${roomId}`;
            
        } catch (err: any) {
            const msg = err.message || 'Failed to join room';
            setError(msg);
            
            // Provide a helpful hint if it's an ownership issue
            if (msg.includes('Requires game ownership')) {
                setError(msg + " You can purchase access in the Marketplace.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <h2>Multiplayer Lobby</h2>
            
            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
                <div style={{ flex: 1, padding: '2rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3>Join a Game</h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '1rem' }}>Enter a room code to join an active playtest.</p>
                    
                    <form onSubmit={handleJoinWithCode} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                            type="text" 
                            placeholder="e.g. ABC-123" 
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}
                            maxLength={6}
                        />
                        <button 
                            type="submit" 
                            disabled={loading || joinCode.length < 3}
                            style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            {loading ? 'Joining...' : 'Join'}
                        </button>
                    </form>
                    {error && <p style={{ color: 'red', fontSize: '14px', marginTop: '0.5rem' }}>{error}</p>}
                </div>

                <div style={{ flex: 1, padding: '2rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3>Host a Game</h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '1rem' }}>Start a new playtest room from one of your published builds.</p>
                    <button 
                         onClick={handleCreateRoom}
                         style={{ width: '100%', padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Create Room
                    </button>
                </div>
            </div>

            <div style={{ marginTop: '3rem' }}>
                <h3>My Active Rooms</h3>
                {myRooms.length === 0 ? (
                    <p style={{ color: '#64748b' }}>You are not in any active rooms.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {myRooms.map(room => (
                            <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <div>
                                    <strong>Code: {room.join_code}</strong>
                                    <span style={{ marginLeft: '1rem', fontSize: '12px', padding: '0.2rem 0.5rem', background: room.status === 'open' ? '#dcfce7' : '#f1f5f9', borderRadius: '12px' }}>
                                        {room.status}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => window.location.hash = `#/play/room/${room.id}`}
                                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Rejoin
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
