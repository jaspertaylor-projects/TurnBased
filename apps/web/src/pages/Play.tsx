import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const Play = () => {
    const [targetType, setTargetType] = useState<'build' | 'room' | null>(null);
    const [targetId, setTargetId] = useState<string | null>(null);
    
    const [buildUrl, setBuildUrl] = useState<string | null>(null);
    const [roomInfo, setRoomInfo] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const hash = window.location.hash;
        const parts = hash.split('/');
        if (parts.length > 3 && parts[2] === 'room') {
            setTargetType('room');
            setTargetId(parts[3]);
        } else if (parts.length > 2) {
            setTargetType('build');
            setTargetId(parts[2]);
        }
    }, []);

    useEffect(() => {
        if (!targetId) return;

        if (targetType === 'build') {
             fetchBuildMetadata(targetId);
        } else if (targetType === 'room') {
             fetchRoomData(targetId);
        }
    }, [targetId, targetType]);

    const fetchBuildMetadata = async (id: string) => {
         try {
            const { data, error } = await supabase
                .from('project_builds')
                .select('r2_prefix, projects(name)')
                .eq('id', id)
                .single();
            
            if (error || !data) throw new Error('Build not found or inaccessible.');
            setBuildUrl(`https://play.turnbased.dev/${data.r2_prefix}/index.html`);
         } catch (err: any) {
             setError(err.message);
         }
    };

    const fetchRoomData = async (roomId: string) => {
         try {
            // 1. Get Room Details and Build info
            const { data: room, error: roomErr } = await supabase
                .from('mp_rooms')
                .select('*, project_builds(r2_prefix)')
                .eq('id', roomId)
                .single();
                
            if (roomErr || !room) throw new Error('Room not found');
            setRoomInfo(room);
            setBuildUrl(`https://play.turnbased.dev/${room.project_builds.r2_prefix}/index.html`);

            // 2. Initial Members fetch
            const { data: activeMembers } = await supabase
                .from('mp_room_members')
                .select('*')
                .eq('room_id', roomId)
                .is('left_at', null);
            if (activeMembers) setMembers(activeMembers);

            // 3. Subscribe to Realtime Members
            const membersChannel = supabase.channel(`room_members:${roomId}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'mp_room_members',
                    filter: `room_id=eq.${roomId}`
                }, () => {
                    // Refresh members on change (simplified approach)
                    supabase
                      .from('mp_room_members')
                      .select('*')
                      .eq('room_id', roomId)
                      .is('left_at', null)
                      .then(({ data }) => {
                          if (data) setMembers(data);
                      });
                })
                .subscribe();

            // 4. Subscribe to Realtime Moves
            const movesChannel = supabase.channel(`room_moves:${roomId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mp_moves',
                    filter: `room_id=eq.${roomId}`
                }, (payload) => {
                     // In a real implementation we would postMessage this payload.new.move to the iframe
                     console.log('Received new move via realtime:', payload.new);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(membersChannel);
                supabase.removeChannel(movesChannel);
            };

         } catch (err: any) {
             setError(err.message);
         }
    };

    const sendMockMoveToRoom = async () => {
         if (targetType !== 'room' || !targetId) return;
         
         const { error } = await supabase.rpc('mp_append_move', {
             p_room_id: targetId,
             p_move: { type: 'MOCK_PING', timestamp: Date.now() }
         });
         
         if (error) {
             console.error("Failed to append move", error);
             alert("Error appending move: " + error.message);
         }
    };

    if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;
    if (!targetId || !buildUrl) return <div style={{ padding: '2rem' }}>Loading Sandbox...</div>;

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#1e293b', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', color: 'white', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <strong>Game Sandbox</strong>
                   {roomInfo ? (
                       <span style={{ fontSize: '14px', background: '#3b82f6', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                           ROOM CODE: {roomInfo.join_code}
                       </span>
                   ) : (
                       <span style={{ fontSize: '12px', color: '#94a3b8' }}>BUILD ID: {targetId}</span>
                   )}
                </div>
                
                {targetType === 'room' && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <span style={{ fontSize: '12px' }}>👥 {members.length} {members.length === 1 ? 'Player' : 'Players'}</span>
                         <button 
                            onClick={sendMockMoveToRoom}
                            style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '12px' }}
                         >
                            Test Send Move
                         </button>
                    </div>
                )}
                
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
