import { supabase } from "@/app/lib/supabaseClient";

export const DUPLICATE_SHIFT_MESSAGE =
  "Possible duplicate shift found. Review your existing records before saving.";

type DuplicateShiftCheck = {
  userId: string;
  vehicleId?: string | null;
  date: string;
  beginningMileage: string;
  endingMileage: string;
  platform?: string | null;
  excludeShiftId?: string;
};

export async function hasDuplicateClosedShift({
  userId,
  vehicleId,
  date,
  beginningMileage,
  endingMileage,
  platform,
  excludeShiftId,
}: DuplicateShiftCheck): Promise<boolean> {
  let query = supabase
    .from("shifts")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("beginning_mileage", beginningMileage)
    .eq("ending_mileage", endingMileage)
    .eq("status", "closed")
    .limit(1);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  } else {
    query = query.is("vehicle_id", null);
  }

  if (platform?.trim()) {
    query = query.eq("platform", platform.trim());
  }

  if (excludeShiftId) {
    query = query.neq("id", excludeShiftId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Duplicate shift check error:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}
