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
