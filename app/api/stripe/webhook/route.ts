import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/app/lib/stripe";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    currentPeriodStart: unixToIso(item?.current_period_start),
    currentPeriodEnd: unixToIso(item?.current_period_end),
    priceId: item?.price?.id ?? null,
  };
}

async function findUserIdForStripeRecord(options: {
  subscription?: Stripe.Subscription | null;
  subscriptionId?: string | null;
  customerId?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const metadataUserId = options.subscription?.metadata?.supabase_user_id;
  if (metadataUserId) return metadataUserId;

  if (options.subscriptionId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", options.subscriptionId)
      .maybeSingle();

    if (data?.user_id) return data.user_id as string;
  }

  if (options.customerId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", options.customerId)
      .maybeSingle();

    if (data?.user_id) return data.user_id as string;
  }

  return null;
}

async function upsertSubscription(subscription: Stripe.Subscription, userId?: string | null) {
  const supabaseAdmin = getSupabaseAdmin();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const resolvedUserId =
    userId ??
    (await findUserIdForStripeRecord({
      subscription,
      subscriptionId: subscription.id,
      customerId,
    }));

  if (!resolvedUserId) {
    console.warn("Skipping subscription upsert because user id could not be resolved.", {
      subscriptionId: subscription.id,
      customerId,
    });
    return;
  }

  const { currentPeriodStart, currentPeriodEnd, priceId } =
    getSubscriptionPeriod(subscription);

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: resolvedUserId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: priceId,
      trial_start: unixToIso(subscription.trial_start),
      trial_end: unixToIso(subscription.trial_end),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const userId = session.metadata?.supabase_user_id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertSubscription(subscription, userId);
    return;
  }

  if (userId && customerId) {
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        status: "none",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw error;
    }
  }
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const stripe = getStripe();
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscription(subscription);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
