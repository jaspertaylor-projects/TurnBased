-- Marketplace Listings
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dev_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    build_id UUID NOT NULL REFERENCES project_builds(id),
    title TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 500, -- e.g., $5.00
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    stripe_payment_intent TEXT UNIQUE, -- null if granted free, otherwise the stripe PI
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entitlements (The actual access right, usually 1:1 with purchases but separate so devs can grant directly)
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(buyer_id, listing_id)
);

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Policies
-- --------------------------------------------------------

-- Listings: Published ones are visible to all. Devs see their own regardless of status.
CREATE POLICY "Published listings visible to all"
    ON listings FOR SELECT
    USING (status = 'published');

CREATE POLICY "Devs can see and edit their own listings"
    ON listings FOR ALL
    USING (auth.uid() = dev_id);

-- Purchases: Buyers can see their own
CREATE POLICY "Buyers see own purchases"
    ON purchases FOR SELECT
    USING (auth.uid() = buyer_id);

-- Entitlements: Buyers see their own
CREATE POLICY "Buyers see own entitlements"
    ON entitlements FOR SELECT
    USING (auth.uid() = buyer_id);

-- Note: We DO NOT allow direct inserts to `purchases` or `entitlements` from the client.
-- These must occur via the Stripe webhook (which runs as SERVICE_ROLE) or a dedicated RPC for free grants.

-- --------------------------------------------------------
-- RPCs
-- --------------------------------------------------------

-- Helper to grant entitlement (can be used for free items, or called by Edge Functions)
CREATE OR REPLACE FUNCTION grant_entitlement(p_buyer_id UUID, p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Idempotent insert
    INSERT INTO entitlements (buyer_id, listing_id)
    VALUES (p_buyer_id, p_listing_id)
    ON CONFLICT (buyer_id, listing_id) DO NOTHING;
END;
$$;
