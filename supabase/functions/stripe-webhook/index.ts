
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
//
// DEPLOYMENT INSTRUCTION:
// This function acts as a Webhook and must be publicly accessible to Stripe.
// You MUST deploy it with the --no-verify-jwt flag (unless you configured config.toml):
//
// supabase functions deploy stripe-webhook --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

// FIX: Access Deno via globalThis to resolve TypeScript errors when types are missing
const Deno = (globalThis as any).Deno;

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
      return new Response("No signature", { status: 400, headers: corsHeaders });
  }

  const body = await req.text();
  let event;

  try {
    // FIX: Must use constructEventAsync in Edge Runtime (Deno) because synchronous crypto is not supported
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err: any) {
    console.error(`⚠️  Webhook signature verification failed.`, err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
  }

  console.log(`Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        
        let userId = session.client_reference_id;
        const stripeCustomerId = session.customer as string;
        const customerEmail = session.customer_details?.email;

        // --- SMART FALLBACK LOGIC ---
        // If Stripe didn't send the user ID (e.g. direct link), look up by Email.
        if (!userId && customerEmail) {
            console.log(`No client_reference_id. Looking up user by email: ${customerEmail}`);
            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", customerEmail)
                .single();
            
            if (profile) {
                userId = profile.id;
                console.log(`Found matching user profile: ${userId}`);
            }
        }

        if (!userId) {
            console.error("CRITICAL: Could not identify user by ID or Email. Manual intervention required.");
            break;
        }

        // Calculate subscription dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 Day Subscription

        // Update the user profile
        const { error: updateError } = await supabase.from("profiles").update({
            plan_status: "paid",
            credits_remaining: 30, // Reset to full monthly limit
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            stripe_customer_id: stripeCustomerId // Save this for future renewals!
        }).eq("id", userId);

        if (updateError) {
            console.error("Error upgrading user profile:", updateError);
            throw updateError;
        } 
        
        console.log(`Successfully upgraded user ${userId} to paid plan.`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer as string;
        const customerEmail = invoice.customer_email;
        
        // Find user by Stripe Customer ID
        let { data: user, error: findError } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", stripeCustomerId)
            .single();

        // --- SELF-HEALING LOGIC ---
        // If we can't find them by Customer ID, try finding them by Email and saving the ID for next time.
        if ((findError || !user) && customerEmail) {
             console.log(`Renewal: User not found by Stripe ID. Trying email: ${customerEmail}`);
             const { data: emailUser } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", customerEmail)
                .single();
            
            if (emailUser) {
                user = emailUser;
                // Heal the record: Save the Stripe ID so next month works perfectly
                await supabase.from("profiles").update({ stripe_customer_id: stripeCustomerId }).eq("id", user.id);
                console.log(`Self-healed profile for user ${user.id} with Stripe ID`);
            }
        }

        if (!user) {
            console.error(`Could not find user for renewal (Stripe ID: ${stripeCustomerId}, Email: ${customerEmail})`);
            break;
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        await supabase.from("profiles").update({
            plan_status: "paid",
            credits_remaining: 30, // Reset monthly credits
            subscription_end_date: endDate.toISOString()
        }).eq("id", user.id);

        console.log(`Successfully renewed subscription for user ${user.id}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer as string;

        const { data: user } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", stripeCustomerId)
            .single();

        if (user) {
             await supabase.from("profiles").update({
                plan_status: "expired"
             }).eq("id", user.id);
             console.log(`Subscription deleted/expired for user ${user.id}`);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("Webhook processing logic failed:", err);
    return new Response(`Error: ${err.message}`, { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
