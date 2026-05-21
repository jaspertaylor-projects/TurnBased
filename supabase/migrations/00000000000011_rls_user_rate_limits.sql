-- Enable RLS on user_rate_limits.
-- Table is only accessed by the SECURITY DEFINER function mp_append_move(),
-- which bypasses RLS, so no policies are needed — default-deny blocks any
-- direct client access via PostgREST.
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;
