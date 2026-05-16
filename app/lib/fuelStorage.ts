
import { supabase } from "@/app/lib/supabaseClient";

export type FuelEntry = {
  id: string;
  date: string;
  odometer: string;
  gallons: string;
  pricePerGallon: string;
  totalCost: string;
  notes?: string;
};

const STORAGE_KEY = "gigaxios-fuel";

export function loadFuelEntries(): FuelEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  try {
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export function saveFuelEntries(entries: FuelEntry[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function loadFuelEntriesFromSupabase() {
  const { data, error } = await supabase
    .from("fuel_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fuel load error:", error.message);
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    date: entry.date,
    odometer: entry.odometer,
    gallons: entry.gallons,
    pricePerGallon: "",
    totalCost: entry.total_cost,
    notes: entry.notes,
  }));
}