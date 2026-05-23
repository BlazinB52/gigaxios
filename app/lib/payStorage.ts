import { supabase } from "@/app/lib/supabaseClient";

export type PayEntry = {
    id: string;
    userId?: string;
    date: string;
    platform: string;
    entryType: "shift" | "mga" | "delayed_tip" | "bonus" | "correction";
    payPeriodStart: string;
    payPeriodEnd: string;
    deliveries: string;
    hours: string;
    basePay: string;
    tips: string;
    adjustments: string;
    grossPay: string;
    notes?: string;
};

const PAY_STORAGE_KEY = "gigaxios-pay";

export async function loadPayEntriesFromSupabase(userId: string): Promise<PayEntry[]> {
  const { data, error } = await supabase
    .from("pay_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase pay load error:", error.message);
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    date: entry.date,
    platform: entry.platform ?? "",
    entryType: entry.entry_type ?? "shift",
    payPeriodStart: entry.pay_period_start ?? "",
    payPeriodEnd: entry.pay_period_end ?? "",
    deliveries: entry.deliveries ?? "",
    hours: entry.hours ?? "",
    basePay: entry.base_pay ?? "",
    tips: entry.tips ?? "",
    adjustments: entry.adjustments ?? "",
    grossPay: entry.gross_pay ?? "",
    notes: entry.notes ?? "",
  }));
}

export async function savePayEntryToSupabase(entry: PayEntry) {
  const { error } = await supabase.from("pay_entries").insert({
    id: entry.id,
    user_id: entry.userId,
    date: entry.date,
    platform: entry.platform,
    entry_type: entry.entryType,
    pay_period_start: entry.payPeriodStart || null,
    pay_period_end: entry.payPeriodEnd || null,
    deliveries: entry.deliveries,
    hours: entry.hours,
    base_pay: entry.basePay,
    tips: entry.tips,
    adjustments: entry.adjustments,
    gross_pay: entry.grossPay,
    notes: entry.notes,
  });

  if (error) {
    console.error("Supabase pay save error:", error.message);
  }
}

export function loadPayEntries(): PayEntry[] {
    if (typeof window === "undefined") return [];

    const data = localStorage.getItem(PAY_STORAGE_KEY);

    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function savePayEntries(entries: PayEntry[]) {
    if (typeof window === "undefined") return;

    localStorage.setItem(PAY_STORAGE_KEY, JSON.stringify(entries));
}