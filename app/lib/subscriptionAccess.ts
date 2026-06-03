import { supabase } from "@/app/lib/supabaseClient";

export const FULL_ACCESS_STATUSES = ["trialing", "active", "past_due"];
export const FREE_ACCOUNT_DAY_LIMIT = 7;

export type SubscriptionAccessState = {
  status: string;
  isSubscribed: boolean;
  trialRequired: boolean;
  accountAgeDays: number;
  trialEnd: string | null;
};

type SubscriptionRow = {
  status: string | null;
  trial_end: string | null;
};

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

function getAccountAgeDays(createdAt: string | undefined) {
  if (!createdAt) return 0;

  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return 0;

  return Math.max(0, Math.floor((Date.now() - createdTime) / 86400000));
}

export function canAccessFullApp(status: string | null | undefined) {
  return FULL_ACCESS_STATUSES.includes(normalizeStatus(status));
}

export function calculateSubscriptionAccess({
  subscription,
  userCreatedAt,
}: {
  subscription: SubscriptionRow | null;
  userCreatedAt?: string;
}): SubscriptionAccessState {
  const status = normalizeStatus(subscription?.status);
  const isSubscribed = canAccessFullApp(status);
  const accountAgeDays = getAccountAgeDays(userCreatedAt);

  return {
    status,
    isSubscribed,
    trialRequired: !isSubscribed && accountAgeDays >= FREE_ACCOUNT_DAY_LIMIT,
    accountAgeDays,
    trialEnd: subscription?.trial_end ?? null,
  };
}

export async function loadSubscriptionAccess({
  userId,
  userCreatedAt,
}: {
  userId: string;
  userCreatedAt?: string;
}) {
  const { data: subscriptionData } = await supabase
    .from("subscriptions")
    .select("status, trial_end")
    .eq("user_id", userId)
    .maybeSingle();

  return calculateSubscriptionAccess({
    subscription: (subscriptionData as SubscriptionRow | null) ?? null,
    userCreatedAt,
  });
}

export function formatTrialEndDate(trialEnd: string | null) {
  if (!trialEnd) return "";

  return new Date(trialEnd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/*
Testing notes:
1. A new user under 7 days old should have full preview access with no card required.
2. During days 0-7, the user can create unlimited shifts and fuel entries.
3. At account age 7+ days with no subscription, trial-required mode should block new data creation.
4. A user with status "trialing" should have full write access.
5. A user with status "active" should have full write access.
*/
