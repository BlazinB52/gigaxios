import { SavedShift } from "./types";
import { supabase } from "@/app/lib/supabaseClient";

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

export async function loadShiftsFromSupabase() {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase load error:", error.message);
    return [];
  }

  return data.map((shift) => ({
    id: shift.id,
    date: shift.date,
    platform: shift.platform,
    beginningMileage: shift.beginning_mileage,
    endingMileage: shift.ending_mileage,
    deliveries: shift.deliveries,
    hoursWorked: shift.hours_worked,
    basePay: shift.base_pay,
    tips: shift.tips,
    otherPay: shift.other_pay,
    grossPay: shift.gross_pay,
    status: shift.status,
    notes: shift.notes,
  }));
}


export function saveShifts(shifts: SavedShift[]) {
  saveRecords<SavedShift>(SHIFTS_STORAGE_KEY, shifts);
}