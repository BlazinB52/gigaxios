import { supabase } from "@/app/lib/supabaseClient";
import { SavedShift, ShiftDeduction } from "@/app/lib/types";

type ShiftDeductionRow = {
  id: string;
  user_id: string | null;
  shift_id: string | null;
  date: string | null;
  platform: string | null;
  deduction_type: string | null;
  amount: number | string | null;
  notes: string | null;
  created_at: string | null;
};

export type NewShiftDeduction = {
  id?: string;
  userId: string;
  shiftId: string;
  date: string;
  platform: string;
  deductionType: string;
  amount: number;
  notes?: string;
};

function toShiftDeduction(row: ShiftDeductionRow): ShiftDeduction {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    shiftId: row.shift_id ?? "",
    date: row.date ?? "",
    platform: row.platform ?? "",
    deductionType: row.deduction_type ?? "",
    amount: Number(row.amount || 0),
    notes: row.notes ?? "",
    createdAt: row.created_at ?? undefined,
  };
}

export function getShiftDeductionsTotal(shift: Pick<SavedShift, "deductions">) {
  return (shift.deductions ?? []).reduce(
    (total, deduction) => total + Number(deduction.amount || 0),
    0
  );
}

export function getShiftsDeductionsTotal(shifts: Array<Pick<SavedShift, "deductions">>) {
  return shifts.reduce((total, shift) => total + getShiftDeductionsTotal(shift), 0);
}

export async function loadShiftDeductionsFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from("shift_deductions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase shift deductions load error:", error.message);
    return [];
  }

  return ((data ?? []) as ShiftDeductionRow[]).map(toShiftDeduction);
}

export async function saveShiftDeductionsToSupabase(deductions: NewShiftDeduction[]) {
  const rows = deductions
    .filter((deduction) => deduction.amount > 0 && deduction.deductionType.trim())
    .map((deduction) => ({
      id: deduction.id ?? crypto.randomUUID(),
      user_id: deduction.userId,
      shift_id: deduction.shiftId,
      date: deduction.date,
      platform: deduction.platform,
      deduction_type: deduction.deductionType.trim(),
      amount: deduction.amount,
      notes: deduction.notes?.trim() || null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("shift_deductions").insert(rows);
  if (error) {
    console.error("Supabase shift deductions save error:", error.message);
    throw error;
  }
}
