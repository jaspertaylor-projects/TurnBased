-- Local seed data. Runs during `supabase db reset` (per supabase/config.toml).
-- Anything in here exists ONLY on local development databases — these
-- credentials must never be deployed to hosted Supabase.

-- ─────────────────────────────────────────────────────────────────────────
-- Local dev account
--
-- Email:    dev@turnbased.local
-- Password: dev-local-only
--
-- Pre-confirmed so the local sign-in flow works without going through the
-- mailpit verification step. Use this account when exercising AI flows
-- (ai-project-builder, ai-rules-writer, etc.) — those edge functions all
-- require an authenticated user, and seeding the account here means anyone
-- on the team can sign in to local dev with a fresh `supabase db reset`.
-- The account starts with $50.00 of local-only AI wallet balance.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_email    text := 'dev@turnbased.local';
  v_password text := 'dev-local-only';
BEGIN
  -- Skip if the row already exists. `supabase db reset` truncates first,
  -- but guarding makes the seed safe to run via psql ad-hoc too.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated', 'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Local Dev"}'::jsonb,
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      NOW(), NOW(), NOW()
    );
  END IF;

  INSERT INTO public.profiles (id, wallet_cents)
  VALUES (v_user_id, 5000)
  ON CONFLICT (id) DO UPDATE
    SET wallet_cents = 5000;
END $$;
