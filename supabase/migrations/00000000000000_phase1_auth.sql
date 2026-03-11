-- Tiers Enum
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'payg');

-- Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL DEFAULT 'free',
    wallet_cents INTEGER NOT NULL DEFAULT 0,
    monthly_included_cents_remaining INTEGER NOT NULL DEFAULT 0,
    ai_prompts_used_today INTEGER NOT NULL DEFAULT 0,
    ai_prompts_date DATE NOT NULL DEFAULT CURRENT_DATE,
    art_bytes_used BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies
CREATE POLICY "Users can view own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (new.id);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RPC: Consume daily prompt
CREATE OR REPLACE FUNCTION consume_daily_prompt()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    current_used INTEGER;
    current_date_tracked DATE;
    is_pro BOOLEAN;
BEGIN
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get current state
    SELECT ai_prompts_used_today, ai_prompts_date, tier = 'pro'
    INTO current_used, current_date_tracked, is_pro
    FROM profiles WHERE id = user_id;

    -- Reset counter if it's a new day
    IF current_date_tracked < CURRENT_DATE THEN
        current_used := 0;
        UPDATE profiles SET ai_prompts_date = CURRENT_DATE, ai_prompts_used_today = 0 WHERE id = user_id;
    END IF;

    -- Enforce limits (e.g., 10 for free, 100 for pro)
    IF (NOT is_pro AND current_used >= 10) OR (is_pro AND current_used >= 100) THEN
        RETURN FALSE; 
    END IF;

    -- Consume
    UPDATE profiles SET ai_prompts_used_today = ai_prompts_used_today + 1 WHERE id = user_id;
    RETURN TRUE;
END;
$$;

-- RPC: Wallet debit
CREATE OR REPLACE FUNCTION wallet_debit(amount_cents INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    current_wallet INTEGER;
BEGIN
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT wallet_cents INTO current_wallet FROM profiles WHERE id = user_id;

    IF current_wallet < amount_cents THEN
        RETURN FALSE;
    END IF;

    UPDATE profiles SET wallet_cents = wallet_cents - amount_cents WHERE id = user_id;
    RETURN TRUE;
END;
$$;

-- RPC: Consume monthly credits
CREATE OR REPLACE FUNCTION consume_monthly_credits(amount_cents INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID := auth.uid();
    current_credits INTEGER;
BEGIN
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT monthly_included_cents_remaining INTO current_credits FROM profiles WHERE id = user_id;

    IF current_credits < amount_cents THEN
        RETURN FALSE;
    END IF;

    UPDATE profiles SET monthly_included_cents_remaining = monthly_included_cents_remaining - amount_cents WHERE id = user_id;
    RETURN TRUE;
END;
$$;
