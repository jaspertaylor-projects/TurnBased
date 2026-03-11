import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
// In a real app we'd import Stripe lib: 
// import Stripe from 'https://esm.sh/stripe@14.10.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('No signature present');

    const bodyText = await req.text();
    // Verify signature:
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, ...);
    // const event = stripe.webhooks.constructEvent(bodyText, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);

    // --- MVP Mock Logic: assuming verifying succeeded and parsing JSON --
    let event;
    try {
        event = JSON.parse(bodyText);
    } catch (e) {
        throw new Error('Invalid JSON');
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Ensure we passed buyer_id and listing_id inside the session metadata when we created the checkout session initially.
        const buyerId = session.metadata?.buyer_id;
        const listingId = session.metadata?.listing_id;
        const paymentIntent = session.payment_intent;
        const amountTotal = session.amount_total;

        if (!buyerId || !listingId) {
             console.error("Missing metadata required to fulfill purchase", session);
             return new Response('Unhandled format', { headers: corsHeaders, status: 200 }); // Stripe requires 200
        }

        // Initialize Service Role to overcome RLS and write to `purchases` 
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Insert Purchase Record
        const { error: purchaseErr } = await supabaseAdmin.from('purchases').insert({
            buyer_id: buyerId,
            listing_id: listingId,
            stripe_payment_intent: paymentIntent,
            price_cents: amountTotal
        });

        if (purchaseErr) {
             console.error("Purchase logging failed", purchaseErr);
             throw new Error('Database insert failed');
        }

        // 2. Grant Entitlement
        const { error: entitleErr } = await supabaseAdmin.rpc('grant_entitlement', {
             p_buyer_id: buyerId,
             p_listing_id: listingId
        });

        if (entitleErr) {
             console.error("Entitlement granting failed", entitleErr);
             throw new Error('Entitlement failed');
        }
    }

    // Acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Stripe Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
