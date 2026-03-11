-- AI Models Catalog
CREATE TABLE ai_models (
    provider TEXT NOT NULL, -- 'openrouter', 'fal'
    model_id TEXT NOT NULL,
    modality TEXT NOT NULL, -- 'text', 'code', 'image'
    enabled BOOLEAN NOT NULL DEFAULT true,
    tier_min subscription_tier NOT NULL DEFAULT 'free',
    price_meta JSONB,
    PRIMARY KEY (provider, model_id)
);

-- AI Usage Ledger
CREATE TABLE ai_usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    modality TEXT NOT NULL,
    provider_cost_cents INTEGER NOT NULL DEFAULT 0,
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    total_charged_cents INTEGER NOT NULL DEFAULT 0,
    request_meta JSONB,
    response_meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (provider, model_id) REFERENCES ai_models (provider, model_id)
);

-- Enable RLS
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Policies: Models are publicly readable
CREATE POLICY "Models readable by all authenticated users"
    ON ai_models FOR SELECT
    TO authenticated
    USING (enabled = true);

-- Policies: Ledger entries
CREATE POLICY "Users can read own ledger"
    ON ai_usage_ledger FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ledger entries"
    ON ai_usage_ledger FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Insert Default Model
INSERT INTO ai_models (provider, model_id, modality, tier_min)
VALUES ('openrouter', 'anthropic/claude-3-haiku', 'code', 'free');
