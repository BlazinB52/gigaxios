import { supabase } from "@/app/lib/supabaseClient";

type MileageReading = {
  value: string | number | null | undefined;
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function maxFromReadings(readings: MileageReading[]) {
  return readings.reduce<number | null>((max, reading) => {
    const value = toNumber(reading.value);
    if (value === null) return max;
    return max === null ? value : Math.max(max, value);
  }, null);
}

function applyVehicleFilter<T>(
  query: T,
  vehicleId?: string
): T {
  if (!vehicleId) return query;
  return (query as { eq(column: string, value: string): T }).eq("vehicle_id", vehicleId);
}

export async function loadHighestMileageReading({
  userId,
  vehicleId,
  excludeShiftId,
}: {
  userId: string;
  vehicleId?: string;
  excludeShiftId?: string;
}) {
  let shiftsQuery = supabase
    .from("shifts")
    .select("id, beginning_mileage, ending_mileage")
    .eq("user_id", userId);

  shiftsQuery = applyVehicleFilter(shiftsQuery, vehicleId);

  if (excludeShiftId) {
    shiftsQuery = shiftsQuery.neq("id", excludeShiftId);
  }

  let fuelQuery = supabase
    .from("fuel_entries")
    .select("odometer")
    .eq("user_id", userId);

  fuelQuery = applyVehicleFilter(fuelQuery, vehicleId);

  let serviceQuery = supabase
    .from("service_entries")
    .select("odometer")
    .eq("user_id", userId);

  serviceQuery = applyVehicleFilter(serviceQuery, vehicleId);

  const [shiftsResult, fuelResult, serviceResult] = await Promise.all([
    shiftsQuery,
    fuelQuery,
    serviceQuery,
  ]);

  if (shiftsResult.error) {
    console.error("Mileage validation shift load error:", shiftsResult.error.message);
  }
  if (fuelResult.error) {
    console.error("Mileage validation fuel load error:", fuelResult.error.message);
  }
  if (serviceResult.error) {
    console.error("Mileage validation service load error:", serviceResult.error.message);
  }

  const shiftReadings =
    shiftsResult.data?.flatMap((shift) => [
      { value: shift.beginning_mileage },
      { value: shift.ending_mileage },
    ]) ?? [];
  const fuelReadings = fuelResult.data?.map((entry) => ({ value: entry.odometer })) ?? [];
  const serviceReadings =
    serviceResult.data?.map((entry) => ({ value: entry.odometer })) ?? [];

  return maxFromReadings([...shiftReadings, ...fuelReadings, ...serviceReadings]);
}

export async function loadPreviousFuelMileageReading({
  userId,
  vehicleId,
  date,
  odometer,
}: {
  userId: string;
  vehicleId?: string;
  date: string;
  odometer: string;
}) {
  const currentOdometer = toNumber(odometer);

  if (!date || currentOdometer === null) {
    return null;
  }

  let query = supabase
    .from("fuel_entries")
    .select("odometer")
    .eq("user_id", userId)
    .or(`date.lt.${date},and(date.eq.${date},odometer.lte.${currentOdometer})`)
    .order("date", { ascending: false })
    .order("odometer", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  query = vehicleId
    ? query.eq("vehicle_id", vehicleId)
    : query.is("vehicle_id", null);

  const { data, error } = await query;

  if (error) {
    console.error("Mileage validation fuel sequence load error:", error.message);
    return null;
  }

  return maxFromReadings(data?.map((entry) => ({ value: entry.odometer })) ?? []);
}

export async function loadPreviousShiftMileageReading({
  userId,
  vehicleId,
  date,
  mileage,
  excludeShiftId,
}: {
  userId: string;
  vehicleId?: string;
  date: string;
  mileage: string;
  excludeShiftId?: string;
}) {
  const currentMileage = toNumber(mileage);

  if (!date || currentMileage === null) {
    return null;
  }

  let query = supabase
    .from("shifts")
    .select("id, beginning_mileage, ending_mileage")
    .eq("user_id", userId)
    .or(`date.lt.${date},and(date.eq.${date},beginning_mileage.lte.${currentMileage})`)
    .order("date", { ascending: false })
    .order("beginning_mileage", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  query = vehicleId
    ? query.eq("vehicle_id", vehicleId)
    : query.is("vehicle_id", null);

  if (excludeShiftId) {
    query = query.neq("id", excludeShiftId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Mileage validation shift sequence load error:", error.message);
    return null;
  }

  const previousShift = data?.[0];

  if (!previousShift) {
    return null;
  }

  const endingMileage = toNumber(previousShift.ending_mileage);
  return endingMileage ?? toNumber(previousShift.beginning_mileage);
}

export function needsMileageException({
  mileage,
  highestMileage,
}: {
  mileage: string;
  highestMileage: number | null;
}) {
  const currentMileage = toNumber(mileage);
  return currentMileage !== null && highestMileage !== null && currentMileage < highestMileage;
}
