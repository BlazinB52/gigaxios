import { supabase } from "@/app/lib/supabaseClient";
import { SavedShift } from "@/app/lib/types";

export async function loadShiftsFromSupabase(userId: string): Promise<SavedShift[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("userId", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error loading shifts:", error);
    return [];
  }

  return data || [];
}

export async function saveShiftToSupabase(shift: SavedShift, userId: string) {
  const { error } = await supabase.from("shifts").upsert({
    ...shift,
    userId,
  });

  if (error) {
    console.error("Error saving shift:", error);
  }
}