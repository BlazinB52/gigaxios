
import { supabase } from "@/app/lib/supabaseClient";

export type FuelEntry = {
  id: string;
  userId?: string;
  vehicleId?: string;
  date: string;
  odometer: string;
  gallons: string;
  pricePerGallon: string;
  totalCost: string;
  totalCostSource?: "stored" | "fallback";
  notes: string;
  mpg?: number;
  costPerMile?: number;
  createdAt?: string;
  isFullFillUp?: boolean;
  overrideMileageValidation?: boolean;
  overrideMileageReason?: string | null;
};

type FuelTotalCostInput = {
  id?: string;
  totalCost?: string | number | null | undefined;
  gallons?: string | number | null | undefined;
  pricePerGallon?: string | number | null | undefined;
};

const STORAGE_KEY = "gigaxios-fuel";
const FUEL_TOTAL_COST_WARNING_TOLERANCE = 0.02;

function toFiniteNumber(value: string | number | null | undefined) {
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function calculateFuelTotalCost({
  gallons,
  pricePerGallon,
}: Pick<FuelTotalCostInput, "gallons" | "pricePerGallon">) {
  const gallonCount = toFiniteNumber(gallons);
  const price = toFiniteNumber(pricePerGallon);

  if (gallonCount === null || price === null) {
    return null;
  }

  return gallonCount * price;
}

function warnOnFuelTotalCostMismatch(input: FuelTotalCostInput) {
  const storedTotal = toFiniteNumber(input.totalCost);
  const calculatedTotal = calculateFuelTotalCost(input);

  if (storedTotal === null || calculatedTotal === null) {
    return;
  }

  if (Math.abs(storedTotal - calculatedTotal) > FUEL_TOTAL_COST_WARNING_TOLERANCE) {
    console.warn("Fuel total_cost differs from gallons * price_per_gallon.", {
      id: input.id,
      storedTotalCost: storedTotal,
      calculatedTotalCost: calculatedTotal,
    });
  }
}

export function hasStoredFuelTotalCost(input: FuelTotalCostInput) {
  return toFiniteNumber(input.totalCost) !== null;
}

export function getFuelEntryTotalCost(input: FuelTotalCostInput) {
  const storedTotal = toFiniteNumber(input.totalCost);
  if (storedTotal !== null) {
    return storedTotal;
  }

  return calculateFuelTotalCost(input) ?? 0;
}

export function formatFuelEntryTotalCost(input: FuelTotalCostInput) {
  return getFuelEntryTotalCost(input).toFixed(2);
}

export function calculateFuelEntryTotalCostFallback({
  gallons,
  pricePerGallon,
}: Pick<FuelTotalCostInput, "gallons" | "pricePerGallon">) {
  return (calculateFuelTotalCost({ gallons, pricePerGallon }) ?? 0).toFixed(2);
}

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

export async function loadFuelEntriesFromSupabase(userId: string): Promise<FuelEntry[]> {
  const { data, error } = await supabase
    .from("fuel_entries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fuel load error:", error.message);
    return [];
  }

  return data.map((entry) => {
    warnOnFuelTotalCostMismatch({
      id: entry.id,
      totalCost: entry.total_cost,
      gallons: entry.gallons,
      pricePerGallon: entry.price_per_gallon,
    });

    return {
      id: entry.id,
      userId: entry.user_id ?? "",
      vehicleId: entry.vehicle_id ?? undefined,
      date: entry.date,
      odometer: entry.odometer ?? "",
      gallons: entry.gallons ?? "",
      pricePerGallon: entry.price_per_gallon ?? "",
      totalCost: formatFuelEntryTotalCost({
        totalCost: entry.total_cost,
        gallons: entry.gallons,
        pricePerGallon: entry.price_per_gallon,
      }),
      totalCostSource: hasStoredFuelTotalCost({ totalCost: entry.total_cost })
        ? "stored"
        : "fallback",
      notes: entry.notes ?? "",
      mpg: entry.mpg != null ? Number(entry.mpg) : undefined,
      costPerMile: entry.cost_per_mile != null ? Number(entry.cost_per_mile) : undefined,
      createdAt: entry.created_at ?? undefined,
      isFullFillUp: entry.is_full_fill_up ?? true,
      overrideMileageValidation: entry.override_mileage_validation ?? false,
      overrideMileageReason: entry.override_mileage_reason ?? null,
    };
  });
}

export async function saveFuelEntryToSupabase(entry: FuelEntry) {
  const currentOdometer = Number(entry.odometer);
  const currentGallons = Number(entry.gallons);
  const currentPpg = Number(entry.pricePerGallon);
  const isFullFillUp = entry.isFullFillUp ?? true;

  let milesSinceLastFillup: number | null = null;
  let mpg: number | null = null;
  let costPerMile: number | null = null;

  if (isFullFillUp) {
    const { data: prevData } = await supabase
      .from("fuel_entries")
      .select("odometer")
      .eq("user_id", entry.userId)
      .eq("is_full_fill_up", true)
      .lt("odometer", currentOdometer)
      .order("odometer", { ascending: false })
      .limit(1);

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
  }

  const { error } = await supabase.from("fuel_entries").insert({
    user_id: entry.userId,
    vehicle_id: entry.vehicleId || null,
    date: entry.date,
    odometer: entry.odometer,
    gallons: entry.gallons,
    price_per_gallon: entry.pricePerGallon,
    total_cost: formatFuelEntryTotalCost(entry),
    notes: entry.notes,
    is_full_fill_up: isFullFillUp,
    miles_since_last_fillup: milesSinceLastFillup,
    mpg,
    cost_per_mile: costPerMile,
    override_mileage_validation: entry.overrideMileageValidation ?? false,
    override_mileage_reason: entry.overrideMileageValidation
      ? entry.overrideMileageReason || null
      : null,
  });

  if (error) {
    console.error("Supabase fuel save error:", error.message);
    throw error;
  }
}
