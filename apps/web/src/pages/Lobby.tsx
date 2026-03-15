import { useEffect, useEffectEvent, useMemo, useState } from 'react';

import { loadEditorProjects } from '../editor/storage';
import type { EditorProject } from '../editor/types';
import { supabase } from '../lib/supabaseClient';
import {
  createRoom,
  ensurePlayableSession,
  joinRoom,
  previewRoomJoin,
} from '../rooms/api';
import type { RoomJoinState, RoomLicenseMode } from '../rooms/types';

interface OwnedListingSummary {
  id: string;
  title: string;
  build_id: string;
}

interface RoomSummary {
  id: string;
  join_code: string;
  status: string;
  license_mode: RoomLicenseMode;
  project_name: string | null;
  last_activity_at: string;
}

function readLobbyParams() {
  const [, query = ''] = window.location.hash.split('?');
  const params = new URLSearchParams(query);

  return {
    projectId: params.get('projectId'),
    mode: (params.get('mode') as RoomLicenseMode | null) ?? null,
    listingId: params.get('listingId'),
  };
}

const cardStyle = {
  padding: '1.5rem',
  background: 'rgba(255,255,255,0.9)',
  borderRadius: '22px',
  border: '1px solid rgba(16,185,129,0.14)',
  boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
};

export const Lobby = () => {
  const [joinCode, setJoinCode] = useState('');
  const [joinPreview, setJoinPreview] = useState<RoomJoinState | null>(null);
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const [projects, setProjects] = useState<EditorProject[]>([]);
  const [ownedListings, setOwnedListings] = useState<OwnedListingSummary[]>([]);
  const [myRooms, setMyRooms] = useState<RoomSummary[]>([]);

  const [createMode, setCreateMode] = useState<RoomLicenseMode>('playtest');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchMyRooms = useEffectEvent(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from('mp_rooms')
      .select('id, join_code, status, license_mode, project_name, last_activity_at, mp_room_members!inner(user_id)')
      .eq('mp_room_members.user_id', currentUserId)
      .order('last_activity_at', { ascending: false });

    if (!error && data) {
      setMyRooms(data as RoomSummary[]);
    }
  });

  const fetchOwnedListings = useEffectEvent(async (currentUserId: string, guest: boolean) => {
    if (guest) {
      setOwnedListings([]);
      return;
    }

    const [{ data: listings }, { data: entitlements }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, build_id, dev_id')
        .eq('status', 'published'),
      supabase
        .from('entitlements')
        .select('listing_id')
        .eq('buyer_id', currentUserId),
    ]);

    const entitlementIds = new Set((entitlements ?? []).map((entry) => entry.listing_id));
    const owned = (listings ?? [])
      .filter((listing) => listing.build_id && (listing.dev_id === currentUserId || entitlementIds.has(listing.id)))
      .map((listing) => ({
        id: listing.id,
        title: listing.title,
        build_id: listing.build_id,
      }));

    setOwnedListings(owned);
    if (!selectedListingId && owned[0]) {
      setSelectedListingId(owned[0].id);
    }
  });

  useEffect(() => {
    const syncPageState = async () => {
      const params = readLobbyParams();
      const localProjects = loadEditorProjects();
      setProjects(localProjects);
      setSelectedProjectId((current) => current || params.projectId || localProjects[0]?.id || '');
      setCreateMode(params.mode ?? 'playtest');
      setSelectedListingId((current) => current || params.listingId || '');

      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setIsGuest(Boolean(user?.is_anonymous));

      if (!user) {
        setOwnedListings([]);
        setMyRooms([]);
        return;
      }

      await Promise.all([
        fetchMyRooms(user.id),
        fetchOwnedListings(user.id, Boolean(user.is_anonymous)),
      ]);
    };

    syncPageState();
    window.addEventListener('hashchange', syncPageState);
    return () => window.removeEventListener('hashchange', syncPageState);
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedListing = useMemo(
    () => ownedListings.find((listing) => listing.id === selectedListingId) ?? null,
    [ownedListings, selectedListingId],
  );

  async function handlePreviewJoin(nextCode: string) {
    if (nextCode.trim().length < 3) {
      setJoinPreview(null);
      return;
    }

    try {
      await ensurePlayableSession();
      const preview = await previewRoomJoin(nextCode);
      setJoinPreview(preview);
      setJoinError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to inspect this room.';
      setJoinPreview(null);
      setJoinError(message);
    }
  }

  async function handleJoinWithCode(event: React.FormEvent) {
    event.preventDefault();
    if (!joinCode.trim()) {
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      await ensurePlayableSession();
      const preview = await previewRoomJoin(joinCode);
      setJoinPreview(preview);

      if (!preview.can_join) {
        throw new Error(preview.message ?? 'This room cannot be joined right now.');
      }

      const roomId = await joinRoom(joinCode);
      window.location.hash = `#/play/room/${roomId}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join room.';
      setJoinError(message);
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleCreateRoom() {
    setCreateError('');

    if (!userId || isGuest) {
      setCreateError('Sign in with a full account to host rooms.');
      return;
    }

    setCreateLoading(true);

    try {
      if (createMode === 'playtest') {
        if (!selectedProject) {
          throw new Error('Choose a local prototype to host as a playtest room.');
        }

        const roomId = await createRoom({
          licenseMode: 'playtest',
          maxPlayers,
          projectSnapshot: selectedProject,
          projectName: selectedProject.name,
        });

        window.location.hash = `#/play/room/${roomId}`;
        return;
      }

      if (!selectedListing) {
        throw new Error('Choose an owned listing to host an ownership-gated room.');
      }

      const roomId = await createRoom({
        licenseMode: 'owned_required',
        maxPlayers,
        buildId: selectedListing.build_id,
        listingId: selectedListing.id,
        projectName: selectedListing.title,
      });

      window.location.hash = `#/play/room/${roomId}`;
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create room.');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ maxWidth: '760px', marginBottom: '1.5rem' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
          Multiplayer Rooms
        </p>
        <h1 style={{ marginBottom: '0.65rem' }}>Playtest snapshots and entitlement-gated rooms share one flow.</h1>
        <p style={{ color: '#0f766e', lineHeight: 1.7, margin: 0 }}>
          Create live playtest rooms from your local component-first projects, or launch ownership-gated rooms from marketplace listings.
          Joining automatically validates seat capacity, guest policy, and one-owner-present access rules before anyone enters the match.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)', gap: '1rem', alignItems: 'start' }}>
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Join a Room</h2>
          <p style={{ color: '#0f766e', marginTop: 0 }}>
            Enter a code to validate the room first. If you are not signed in yet, we will create a guest play session automatically for eligible playtests.
          </p>

          <form onSubmit={handleJoinWithCode} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="ABC123"
              value={joinCode}
              onChange={(event) => {
                const nextValue = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                setJoinCode(nextValue);
                setJoinPreview(null);
                setJoinError('');
              }}
              onBlur={() => void handlePreviewJoin(joinCode)}
              style={{
                flex: '1 1 220px',
                padding: '0.85rem 0.95rem',
                borderRadius: '14px',
                border: '1px solid rgba(15,118,110,0.12)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontSize: '1rem',
              }}
            />
            <button
              type="submit"
              disabled={joinLoading || joinCode.length < 3}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.85rem 1.2rem',
                background: 'linear-gradient(135deg, #0f766e, #10b981)',
                color: 'white',
              }}
            >
              {joinLoading ? 'Joining...' : 'Join Room'}
            </button>
          </form>

          {joinPreview && (
            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '18px', background: 'rgba(240,253,244,0.9)', color: '#065f46' }}>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(16,185,129,0.16)' }}>
                  {joinPreview.license_mode === 'owned_required' ? 'Owned Room' : 'Playtest'}
                </span>
                <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(14,165,233,0.14)' }}>
                  {joinPreview.seat_slots_remaining} seat{joinPreview.seat_slots_remaining === 1 ? '' : 's'} open
                </span>
                {joinPreview.is_guest && (
                  <span style={{ padding: '0.35rem 0.65rem', borderRadius: '999px', background: 'rgba(249,115,22,0.14)' }}>
                    Guest Session
                  </span>
                )}
              </div>
              <strong>{joinPreview.project_name ?? 'Untitled Room'}</strong>
              <p style={{ margin: '0.45rem 0 0 0' }}>{joinPreview.message}</p>
            </div>
          )}

          {joinError && (
            <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: '16px', background: 'rgba(254,226,226,0.9)', color: '#b91c1c' }}>
              {joinError}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Host a Room</h2>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => setCreateMode('playtest')}
              style={{
                borderRadius: '999px',
                padding: '0.7rem 0.95rem',
                border: createMode === 'playtest' ? 'none' : '1px solid rgba(15,118,110,0.16)',
                background: createMode === 'playtest' ? 'linear-gradient(135deg, #064e3b, #10b981)' : 'rgba(255,255,255,0.82)',
                color: createMode === 'playtest' ? 'white' : '#065f46',
              }}
            >
              Playtest
            </button>
            <button
              onClick={() => setCreateMode('owned_required')}
              style={{
                borderRadius: '999px',
                padding: '0.7rem 0.95rem',
                border: createMode === 'owned_required' ? 'none' : '1px solid rgba(15,118,110,0.16)',
                background: createMode === 'owned_required' ? 'linear-gradient(135deg, #9a3412, #f59e0b)' : 'rgba(255,255,255,0.82)',
                color: createMode === 'owned_required' ? 'white' : '#92400e',
              }}
            >
              Ownership Required
            </button>
          </div>

          {createMode === 'playtest' ? (
            <>
              <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                Local prototype snapshot
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  style={{ padding: '0.8rem 0.9rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}
                >
                  {projects.length === 0 && <option value="">No local projects yet</option>}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <p style={{ marginTop: 0, color: '#0f766e', fontSize: '0.92rem' }}>
                This room stores a snapshot of your current browser workspace in Supabase so every player replays the same engine state locally.
              </p>
            </>
          ) : (
            <>
              <label style={{ display: 'grid', gap: '0.35rem', color: '#92400e', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                Owned marketplace listing
                <select
                  value={selectedListingId}
                  onChange={(event) => setSelectedListingId(event.target.value)}
                  style={{ padding: '0.8rem 0.9rem', borderRadius: '14px', border: '1px solid rgba(217,119,6,0.18)' }}
                >
                  {ownedListings.length === 0 && <option value="">No owned listings available</option>}
                  {ownedListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title}
                    </option>
                  ))}
                </select>
              </label>
              <p style={{ marginTop: 0, color: '#92400e', fontSize: '0.92rem' }}>
                These rooms stay joinable only while at least one entitled owner or creator remains active.
              </p>
            </>
          )}

          <label style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.84rem', marginBottom: '1rem' }}>
            Max players
            <select
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
              style={{ padding: '0.8rem 0.9rem', borderRadius: '14px', border: '1px solid rgba(15,118,110,0.12)' }}
            >
              {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <button
            onClick={handleCreateRoom}
            disabled={createLoading}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '999px',
              padding: '0.9rem 1.1rem',
              background: createMode === 'playtest'
                ? 'linear-gradient(135deg, #064e3b, #10b981)'
                : 'linear-gradient(135deg, #9a3412, #f59e0b)',
              color: 'white',
            }}
          >
            {createLoading ? 'Creating...' : 'Create Room'}
          </button>

          {createError && (
            <div style={{ marginTop: '0.9rem', padding: '0.85rem 0.95rem', borderRadius: '16px', background: 'rgba(254,226,226,0.9)', color: '#b91c1c' }}>
              {createError}
            </div>
          )}
        </section>
      </div>

      <section style={{ ...cardStyle, marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>My Active Rooms</h2>
            <p style={{ color: '#0f766e', marginBottom: 0 }}>
              Rejoin a room, grab its code, or resume a playtest session.
            </p>
          </div>
          {isGuest && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '999px', background: 'rgba(249,115,22,0.14)', color: '#9a3412' }}>
              Guest accounts can join playtests but cannot host rooms.
            </div>
          )}
        </div>

        {myRooms.length === 0 ? (
          <div style={{ marginTop: '1rem', padding: '1.2rem', borderRadius: '18px', background: 'rgba(240,253,244,0.86)', color: '#065f46' }}>
            You are not in any active rooms yet.
          </div>
        ) : (
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.8rem' }}>
            {myRooms.map((room) => (
              <div
                key={room.id}
                style={{
                  padding: '1rem',
                  borderRadius: '18px',
                  border: '1px solid rgba(16,185,129,0.14)',
                  background: 'rgba(255,255,255,0.82)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{room.project_name ?? 'Untitled Room'}</strong>
                  <div style={{ marginTop: '0.3rem', color: '#0f766e', fontSize: '0.9rem' }}>
                    Code {room.join_code} · {room.license_mode === 'owned_required' ? 'Owned room' : 'Playtest'} · Updated {new Date(room.last_activity_at).toLocaleString()}
                  </div>
                </div>
                <a
                  href={`#/play/room/${room.id}`}
                  style={{
                    padding: '0.75rem 0.95rem',
                    borderRadius: '999px',
                    background: 'rgba(16,185,129,0.12)',
                    color: '#065f46',
                    textDecoration: 'none',
                  }}
                >
                  Open Room
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
