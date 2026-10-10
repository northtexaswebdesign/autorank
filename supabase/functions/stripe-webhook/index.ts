// Stripe webhook: turns payments into plan changes on public.profiles.
//
// DEPLOYMENT INSTRUCTION:
// This function acts as a Webhook and must be publicly accessible to Stripe.
// You MUST deploy it with the --no-verify-jwt flag (unless you configured config.toml):
//
// supabase functions deploy stripe-webhook --no-verify-jwt
//
// Safety rules:
// - Every event id is recorded in public.stripe_events first, so a redelivered event is never applied twice.
// - Any database error returns 500 and forgets the event id, so Stripe retries it.
// - Users are matched by the id the app passes to checkout (client_reference_id) or by the saved Stripe customer
//   id. The email is only a fallback for a profile that has no Stripe customer yet, and it never replaces an
//   existing customer id (so a stranger cannot attach their subscription to someone else's account).
// - Dates come from Stripe's billing period when available.
// - Optional secret STRIPE_MIN_AMOUNT_CENTS: a checkout paying less than this does not upgrade the account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const Deno = (globalThis as any).Deno;

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const MONTHLY_CREDITS = 30;
const MIN_AMOUNT_CENTS = Number(Deno.env.get("STRIPE_MIN_AMOUNT_CENTS") || 0);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** The one profile with this email (case-insensitive), or null when there are none or several. */
const profileByEmail = async (email?: string | null): Promise<{ id: string; stripe_customer_id: string | null } | null> => {
  if (!email) return null;
  const { data, error } = await supabase.from("profiles").select("id, stripe_customer_id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).limit(2);
  if (error) throw error;
  return data && data.length === 1 ? data[0] : null;
};

const profileByCustomer = async (customerId?: string | null): Promise<{ id: string } | null> => {
  if (!customerId) return null;
  const { data, error } = await supabase.from("profiles").select("id").eq("stripe_customer_id", customerId).limit(2);
  if (error) throw error;
  if (data && data.length > 1) console.error(`Stripe customer ${customerId} is linked to ${data.length} profiles; using the first.`);
  return data?.[0] ?? null;
};

const updateProfile = async (id: string, values: Record<string, unknown>) => {
  const { error } = await supabase.from("profiles").update(values).eq("id", id);
  if (error) throw error;
};

/** The billing period end of a subscription, if Stripe can tell us. */
const subscriptionPeriodEnd = async (subscriptionId?: string | null): Promise<Date | null> => {
  if (!subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  } catch (e: any) {
    console.error("Could not read subscription period:", e.message);
    return null;
  }
};

const handleEvent = async (event: any) => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = (session.customer as string) || null;
      const email = session.customer_details?.email;

      if (MIN_AMOUNT_CENTS && (session.amount_total ?? 0) < MIN_AMOUNT_CENTS) {
        console.error(`Checkout ${session.id} paid ${session.amount_total} cents, below STRIPE_MIN_AMOUNT_CENTS; not upgrading.`);
        return;
      }

      // 1. the app's own user id; 2. a profile already linked to this customer; 3. a unique email with no customer yet
      let userId: string | null = null;
      if (UUID.test(session.client_reference_id || "")) {
        const { data, error } = await supabase.from("profiles").select("id").eq("id", session.client_reference_id).maybeSingle();
        if (error) throw error;
        userId = data?.id ?? null;
      }
      if (!userId) userId = (await profileByCustomer(customerId))?.id ?? null;
      if (!userId) {
        const byEmail = await profileByEmail(email);
        if (byEmail && (!byEmail.stripe_customer_id || byEmail.stripe_customer_id === customerId)) userId = byEmail.id;
      }
      if (!userId) {
        console.error(`CRITICAL: checkout ${session.id} (customer ${customerId}, email ${email}) matches no account. Set it by hand in Admin: Users.`);
        return;
      }

      const start = new Date();
      const end = (await subscriptionPeriodEnd(session.subscription as string)) ?? addDays(start, 30);
      // subscription_start_date first: a database trigger resets end date and credits when it changes,
      // so the real values are written in a second update.
      await updateProfile(userId, { subscription_start_date: start.toISOString() });
      await updateProfile(userId, {
        plan_status: "paid",
        credits_remaining: MONTHLY_CREDITS,
        subscription_end_date: end.toISOString(),
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      });
      console.log(`Upgraded user ${userId} to paid until ${end.toISOString()}.`);
      return;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      // the first invoice of a new subscription arrives together with checkout.session.completed, which handles it
      if (invoice.billing_reason === "subscription_create") return;
      const customerId = (invoice.customer as string) || null;

      let user = await profileByCustomer(customerId);
      if (!user) {
        const byEmail = await profileByEmail(invoice.customer_email);
        if (byEmail && !byEmail.stripe_customer_id) {
          user = byEmail;
          await updateProfile(byEmail.id, { stripe_customer_id: customerId });
          console.log(`Linked Stripe customer ${customerId} to user ${byEmail.id} by email.`);
        }
      }
      if (!user) {
        console.error(`CRITICAL: renewal invoice ${invoice.id} (customer ${customerId}, email ${invoice.customer_email}) matches no account.`);
        return;
      }

      const periodEnd = invoice.lines?.data?.[0]?.period?.end;
      const end = periodEnd ? new Date(periodEnd * 1000) : addDays(new Date(), 30);
      await updateProfile(user.id, { plan_status: "paid", credits_remaining: MONTHLY_CREDITS, subscription_end_date: end.toISOString() });
      console.log(`Renewed user ${user.id} until ${end.toISOString()}.`);
      return;
    }

    case "customer.subscription.deleted": {
      const user = await profileByCustomer(event.data.object.customer as string);
      if (user) {
        await updateProfile(user.id, { plan_status: "expired" });
        console.log(`Subscription ended for user ${user.id}.`);
      }
      return;
    }
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return reply(400, "No signature");

  const body = await req.text();
  let event;
  try {
    // constructEventAsync: synchronous crypto is not available in the Edge Runtime
    event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return reply(400, `Webhook Error: ${err.message}`);
  }

  // claim the event id; a redelivery of an event we already handled is acknowledged and skipped
  const { error: claimError } = await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") {
      console.log(`Event ${event.id} already handled; skipping.`);
      return reply(200, { received: true, duplicate: true });
    }
    console.error("Could not record the event:", claimError.message);
    return reply(500, "Could not record the event");
  }

  console.log(`Processing event ${event.id}: ${event.type}`);
  try {
    await handleEvent(event);
  } catch (err: any) {
    console.error("Webhook processing failed:", err?.message || err);
    // forget the event so Stripe's retry is processed again
    await supabase.from("stripe_events").delete().eq("id", event.id);
    return reply(500, `Error: ${err?.message || "processing failed"}`);
  }
  return reply(200, { received: true });
});
