import { SavedShift } from "./types";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftDeductionsFromSupabase } from "@/app/lib/shiftDeductions";

export function loadRecords<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  const saved = localStorage.getItem(key);

  if (!saved) return [];

  try {
    return JSON.parse(saved) as T[];
  } catch {
    return [];
  }
}

export function saveRecords<T>(key: string, records: T[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(key, JSON.stringify(records));
}

export const SHIFTS_STORAGE_KEY = "savedShifts";

export function loadShifts() {
  return loadRecords<SavedShift>(SHIFTS_STORAGE_KEY);
}

export async function loadShiftsFromSupabase(userId?: string) {
  let query = supabase
    .from("shifts")
    .select("*")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase load error:", error.message);
    return [];
  }

  const deductions = userId ? await loadShiftDeductionsFromSupabase(userId) : [];
  const deductionsByShiftId = deductions.reduce((groups, deduction) => {
    const current = groups.get(deduction.shiftId) ?? [];
    current.push(deduction);
    groups.set(deduction.shiftId, current);
    return groups;
  }, new Map<string, typeof deductions>());

  return data.map((shift) => ({
    id: shift.id,
    userId: shift.user_id ?? "",
    vehicleId: shift.vehicle_id ?? undefined,
    date: shift.date,
    startTime: shift.start_time ?? undefined,
    endTime: shift.end_time ?? undefined,
    platform: shift.platform,
    beginningMileage: shift.beginning_mileage,
    endingMileage: shift.ending_mileage,
    startMileageOverride: shift.start_mileage_override ?? false,
    startMileageOverrideReason: shift.start_mileage_override_reason ?? null,
    endMileageOverride: shift.end_mileage_override ?? false,
    endMileageOverrideReason: shift.end_mileage_override_reason ?? null,
    deliveries: shift.deliveries ?? "",
    hoursWorked: shift.hours_worked ?? "",
    basePay: shift.base_pay ?? "",
    tips: shift.tips ?? "",
    otherPay: shift.other_pay ?? "",
    grossPay: shift.gross_pay ?? "",
    deductions: deductionsByShiftId.get(shift.id) ?? [],
    status: shift.status ?? "closed",
    notes: shift.notes ?? "",
  }));
}

export function saveShifts(shifts: SavedShift[]) {
  saveRecords<SavedShift>(SHIFTS_STORAGE_KEY, shifts);
}
