import { SavedShift } from "./types";

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

export function saveShifts(shifts: SavedShift[]) {
  saveRecords<SavedShift>(SHIFTS_STORAGE_KEY, shifts);
}