import { supabase } from "@/app/lib/supabaseClient";

export type Vehicle = {
  id: string;
  userId: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  licensePlate: string;
  vin: string;
  notes: string;
};

export type ServiceEntry = {
    id: string;
    userId: string;
    date: string;
    odometer: string;
    serviceType: string;
    cost: string;
    notes: string;
};

export type MaintenanceReminder = {
    id: string;
    userId: string;
    title: string;
    lastDoneOdometer: string;
    intervalMiles: string;
    dueOdometer: string;
    dueDate: string;
    notes: string;
};

export async function deleteServiceEntryFromSupabase(id: string) {
    const { error } = await supabase
        .from("service_entries")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Supabase service delete error:", error.message);
    }
}

export async function loadServiceEntriesFromSupabase(
    userId: string
): Promise<ServiceEntry[]> {
    const { data, error } = await supabase
        .from("service_entries")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

    if (error) {
        console.error("Supabase service load error:", error.message);
        return [];
    }

    return data.map((entry) => ({
        id: entry.id,
        userId: entry.user_id,
        date: entry.date,
        odometer: entry.odometer ?? "",
        serviceType: entry.service_type ?? "",
        cost: entry.cost ?? "",
        notes: entry.notes ?? "",
    }));
}

export async function saveServiceEntryToSupabase(
    entry: ServiceEntry
) {
    const { error } = await supabase.from("service_entries").insert({
        user_id: entry.userId,
        date: entry.date,
        odometer: entry.odometer || null,
        service_type: entry.serviceType,
        cost: entry.cost || null,
        notes: entry.notes,
    });

    if (error) {
        console.error("Supabase service save error:", error.message);
    }
}

export async function loadMaintenanceRemindersFromSupabase(
    userId: string
): Promise<MaintenanceReminder[]> {
    const { data, error } = await supabase
        .from("maintenance_reminders")
        .select("*")
        .eq("user_id", userId)
        .order("due_odometer", { ascending: true, nullsFirst: false });

    if (error) {
        console.error("Supabase reminder load error:", error.message);
        return [];
    }

    return data.map((entry) => ({
        id: entry.id,
        userId: entry.user_id,
        title: entry.title ?? "",
        lastDoneOdometer: entry.last_done_odometer ?? "",
        intervalMiles: entry.interval_miles ?? "",
        dueOdometer: entry.due_odometer ?? "",
        dueDate: entry.due_date ?? "",
        notes: entry.notes ?? "",
    }));
}

export async function loadVehicleFromSupabase(userId: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    year: data.year ?? "",
    make: data.make ?? "",
    model: data.model ?? "",
    trim: data.trim ?? "",
    color: data.color ?? "",
    licensePlate: data.license_plate ?? "",
    vin: data.vin ?? "",
    notes: data.notes ?? "",
  };
}

export async function loadCurrentOdometer(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("shifts")
    .select("ending_mileage")
    .eq("user_id", userId)
    .not("ending_mileage", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 0;
  return parseFloat(data[0].ending_mileage) || 0;
}

export function computeServiceStats(entries: ServiceEntry[]) {
  const totalServices = entries.length;
  const totalSpent = entries.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
  const lastServiceOdometer = entries[0]?.odometer ?? "--";
  return { totalServices, totalSpent, lastServiceOdometer };
}

export async function saveMaintenanceReminderToSupabase(
    reminder: MaintenanceReminder
) {
    const dueOdometer =
        Number(reminder.lastDoneOdometer || 0) + Number(reminder.intervalMiles || 0);

    console.log("[saveReminder] inserting:", JSON.stringify({
        user_id: reminder.userId,
        title: reminder.title,
        last_done_odometer: reminder.lastDoneOdometer,
        interval_miles: reminder.intervalMiles,
        due_odometer: dueOdometer,
        due_date: reminder.dueDate || null,
    }));

    const { error } = await supabase.from("maintenance_reminders").insert({
        user_id: reminder.userId,
        title: reminder.title,
        last_done_odometer: reminder.lastDoneOdometer || null,
        interval_miles: reminder.intervalMiles || null,
        due_odometer: dueOdometer || null,
        due_date: reminder.dueDate || null,
        notes: reminder.notes,
    });

    console.log("[saveReminder] error:", error);
    if (error) {
        console.error("Supabase reminder save error:", error.message);
    }

}

export type ServiceInterval = {
  id: string;
  userId: string;
  serviceType: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
};

export type GeneralSettings = {
  weekStartsOn: string;
  notificationsEnabled: boolean;
};

export async function saveVehicleToSupabase(vehicle: Vehicle): Promise<void> {
  const existing = await loadVehicleFromSupabase(vehicle.userId);

  if (existing) {
    const { error } = await supabase
      .from("vehicles")
      .update({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        color: vehicle.color,
        license_plate: vehicle.licensePlate,
        vin: vehicle.vin,
        notes: vehicle.notes,
      })
      .eq("user_id", vehicle.userId);

    if (error) console.error("Supabase vehicle update error:", error.message);
  } else {
    const { error } = await supabase.from("vehicles").insert({
      user_id: vehicle.userId,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      color: vehicle.color,
      license_plate: vehicle.licensePlate,
      vin: vehicle.vin,
      notes: vehicle.notes,
    });

    if (error) console.error("Supabase vehicle insert error:", error.message);
  }
}

export async function loadServiceIntervalsFromSupabase(userId: string): Promise<ServiceInterval[]> {
  const { data, error } = await supabase
    .from("service_intervals")
    .select("*")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data.map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    serviceType: entry.service_type ?? "",
    intervalMiles: entry.interval_miles ?? null,
    intervalMonths: entry.interval_months ?? null,
  }));
}

export async function saveServiceIntervalsToSupabase(userId: string, intervals: ServiceInterval[]): Promise<void> {
  await supabase.from("service_intervals").delete().eq("user_id", userId);

  if (intervals.length === 0) return;

  const { error } = await supabase.from("service_intervals").insert(
    intervals.map((interval) => ({
      user_id: userId,
      service_type: interval.serviceType,
      interval_miles: interval.intervalMiles,
      interval_months: interval.intervalMonths,
    }))
  );

  if (error) console.error("Supabase service intervals save error:", error.message);
}

export function getIntervalForServiceType(intervals: ServiceInterval[], serviceType: string): ServiceInterval | null {
  return intervals.find((i) => i.serviceType === serviceType) ?? null;
}

export async function deleteMaintenanceReminderFromSupabase(id: string) {
  const { error } = await supabase
    .from("maintenance_reminders")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase reminder delete error:", error.message);
  }
}
