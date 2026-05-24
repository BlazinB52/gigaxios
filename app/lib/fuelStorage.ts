
import { supabase } from "@/app/lib/supabaseClient";

export type FuelEntry = {
  id: string;
  userId?: string;
  date: string;
  odometer: string;
  gallons: string;
  pricePerGallon: string;
  totalCost: string;
  notes: string;
  mpg?: number;
  costPerMile?: number;
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

export async function loadFuelEntriesFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from("fuel_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fuel load error:", error.message);
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    userId: entry.user_id ?? "",
    date: entry.date,
    odometer: entry.odometer ?? "",
    gallons: entry.gallons ?? "",
    pricePerGallon: entry.price_per_gallon ?? "",
    totalCost: (
      Number(entry.gallons || 0) * Number(entry.price_per_gallon || 0)
    ).toFixed(2),
    notes: entry.notes ?? "",
    mpg: entry.mpg != null ? Number(entry.mpg) : undefined,
    costPerMile: entry.cost_per_mile != null ? Number(entry.cost_per_mile) : undefined,
  }));
}

export async function saveFuelEntryToSupabase(entry: FuelEntry) {
  const currentOdometer = Number(entry.odometer);
  const currentGallons = Number(entry.gallons);
  const currentPpg = Number(entry.pricePerGallon);

  const { data: prevData } = await supabase
    .from("fuel_entries")
    .select("odometer")
    .eq("user_id", entry.userId)
    .lt("odometer", currentOdometer)
    .order("odometer", { ascending: false })
    .limit(1);

  let milesSinceLastFillup: number | null = null;
  let mpg: number | null = null;
  let costPerMile: number | null = null;

  if (prevData && prevData.length > 0) {
    const miles = currentOdometer - Number(prevData[0].odometer);
    if (miles > 0 && currentGallons > 0) {
      milesSinceLastFillup = miles;
      mpg = miles / currentGallons;
      if (mpg > 0 && currentPpg > 0) {
        costPerMile = currentPpg / mpg;
      }
    }
  }

  const { error } = await supabase.from("fuel_entries").insert({
    user_id: entry.userId,
    date: entry.date,
    odometer: entry.odometer,
    gallons: entry.gallons,
    price_per_gallon: entry.pricePerGallon,
    total_cost: entry.totalCost,
    notes: entry.notes,
    miles_since_last_fillup: milesSinceLastFillup,
    mpg,
    cost_per_mile: costPerMile,
  });

  if (error) {
    console.error("Supabase fuel save error:", error.message);
  }
}