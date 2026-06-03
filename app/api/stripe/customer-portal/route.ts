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

    const stripe = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Could not load billing details." }, { status: 500 });
    }

    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found yet." }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${getEnv("NEXT_PUBLIC_APP_URL")}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Customer portal error:", error);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
