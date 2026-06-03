import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/app/lib/stripe";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function getCurrentUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }

    const appUrl = getEnv("NEXT_PUBLIC_APP_URL");
    const priceId = getEnv("STRIPE_PRICE_ID");
    const couponId = getEnv("STRIPE_COUPON_ID");
    const stripe = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingSubscription, error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json({ error: "Could not load billing details." }, { status: 500 });
    }

    let customerId = existingSubscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      const { error } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "none",
        },
        { onConflict: "user_id" }
      );

      if (error) {
        return NextResponse.json({ error: "Could not save billing details." }, { status: 500 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      discounts: [
        {
          coupon: couponId,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
