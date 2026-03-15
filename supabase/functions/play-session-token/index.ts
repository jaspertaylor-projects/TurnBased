import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `ps_${Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      },
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { roomId } = await req.json();
    if (!roomId) {
      throw new Error('Missing roomId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: room, error: roomError } = await supabaseAdmin
      .from('mp_rooms')
      .select('id, status, license_mode')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'open' && room.status !== 'playing') {
      throw new Error('Room is not active');
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('mp_room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error('You are not an active member of this room');
    }

    if (room.license_mode === 'owned_required') {
      const { data: ownerState, error: ownerError } = await supabaseAdmin.rpc('mp_room_has_active_owner', {
        p_room_id: roomId,
      });

      if (ownerError || !ownerState) {
        throw new Error('Owned rooms require an entitled player to remain present.');
      }
    }

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from('mp_play_sessions')
      .insert({
        room_id: roomId,
        user_id: user.id,
        token_hash: tokenHash,
        scope: 'room',
        expires_at: expiresAt,
        metadata: {
          licenseMode: room.license_mode,
        },
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return new Response(JSON.stringify({
      token,
      roomId,
      scope: 'room',
      expiresAt,
      licenseMode: room.license_mode,
      canWrite: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to mint play session token';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
