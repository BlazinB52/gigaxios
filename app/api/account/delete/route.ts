import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/app/lib/stripe";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendAccountDeletedAdminEmail } from "@/app/lib/adminDeletionEmail";

const APP_TABLES = [
  "pay_adjustments",
  "pay_entries",
  "pay_periods",
  "fuel_entries",
  "service_entries",
  "maintenance_reminders",
  "service_intervals",
  "shifts",
  "vehicles",
  "subscriptions",
] as const;

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("does not exist") === true ||
    error.message?.toLowerCase().includes("could not find the table") === true
  );
}

function isMissingStripeSubscriptionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const stripeError = error as {
    code?: string;
    statusCode?: number;
    message?: string;
  };

  return (
    stripeError.code === "resource_missing" ||
    stripeError.statusCode === 404 ||
    stripeError.message?.includes("No such subscription") === true
  );
}

async function getCurrentUserAndClient() {
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
    return { user: null, supabase };
  }

  return { user, supabase };
}

async function cancelStripeSubscriptions(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load billing details.");
  }

  if (!data?.stripe_subscription_id && !data?.stripe_customer_id) {
    return false;
  }

  const stripe = getStripe();
  const subscriptionIds = new Set<string>();

  if (data.stripe_subscription_id) {
    subscriptionIds.add(data.stripe_subscription_id);
  }

  if (data.stripe_customer_id) {
    const subscriptions = await stripe.subscriptions.list({
      customer: data.stripe_customer_id,
      status: "all",
      limit: 100,
    });

    for (const subscription of subscriptions.data) {
      if (["active", "trialing", "past_due", "unpaid"].includes(subscription.status)) {
        subscriptionIds.add(subscription.id);
      }
    }
  }

  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (isMissingStripeSubscriptionError(error)) {
        console.warn(
          `Stripe subscription ${subscriptionId} was already missing during account deletion.`,
          error
        );
        continue;
      }

      throw error;
    }
  }

  return true;
}

async function deleteUserRows(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  for (const table of APP_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);

    if (error && !isMissingTableError(error)) {
      console.error(`Account deletion failed while deleting ${table}:`, error);
      throw new Error(`Could not delete ${table}.`);
    }
  }
}

async function getDeletionReason(request: Request) {
  try {
    const body = await request.json();
    return typeof body?.reason === "string" ? body.reason : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getCurrentUserAndClient();

    if (!user) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.email ?? "";
    const reason = await getDeletionReason(request);
    const stripeCancellationAttempted = await cancelStripeSubscriptions(userId);
    await deleteUserRows(userId);

    const supabaseAdmin = getSupabaseAdmin();
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
      true
    );

    if (deleteUserError) {
      throw new Error("Could not delete the account.");
    }

    const deletedAt = new Date().toISOString();

    try {
      await sendAccountDeletedAdminEmail({
        userId,
        email: userEmail,
        reason,
        deletedAt,
        stripeCancellationAttempted,
        appRecordsDeleted: true,
        authUserDeleted: true,
      });
    } catch (emailError) {
      console.warn("Failed to send account deletion admin email:", emailError);
    }

    await supabase.auth.signOut();

    return NextResponse.json({ redirectTo: "/" });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Could not delete your account. Please try again or contact support." },
      { status: 500 }
    );
  }
}
