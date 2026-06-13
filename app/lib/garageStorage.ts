import { supabase } from "@/app/lib/supabaseClient";

// IMPORTANT: Run this SQL in Supabase to support per-vehicle reminders:
//
// ALTER TABLE public.maintenance_reminders
// DROP CONSTRAINT IF EXISTS maintenance_reminders_user_id_title_key;
//
// ALTER TABLE public.maintenance_reminders
// ADD CONSTRAINT maintenance_reminders_user_id_vehicle_id_title_key
// UNIQUE (user_id, vehicle_id, title);

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
  status: string;
  isPrimary: boolean;
};

export type ServiceEntry = {
  id: string;
  userId: string;
  vehicleId?: string;
  date: string;
  odometer: string;
  serviceType: string;
  cost: string;
  notes: string;
  overrideMileageValidation?: boolean;
  overrideMileageReason?: string | null;
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

export type ServiceInterval = {
  id: string;
  userId: string;
  vehicleId: string | null;
  serviceType: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastDoneOdometer: number | null;
  lastDoneDate: string | null;
};

export type GeneralSettings = {
  weekStartsOn: string;
  notificationsEnabled: boolean;
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
  userId: string,
  vehicleId?: string
): Promise<ServiceEntry[]> {
  let query = supabase
    .from("service_entries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase service load error:", error.message);
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    vehicleId: entry.vehicle_id ?? undefined,
    date: entry.date,
    odometer: entry.odometer ?? "",
    serviceType: entry.service_type ?? "",
    cost: entry.cost ?? "",
    notes: entry.notes ?? "",
    overrideMileageValidation: entry.override_mileage_validation ?? false,
    overrideMileageReason: entry.override_mileage_reason ?? null,
  }));
}

export async function saveServiceEntryToSupabase(entry: ServiceEntry) {
  const { error } = await supabase.from("service_entries").insert({
    user_id: entry.userId,
    vehicle_id: entry.vehicleId || null,
    date: entry.date,
    odometer: entry.odometer || null,
    service_type: entry.serviceType,
    cost: entry.cost || null,
    notes: entry.notes,
    override_mileage_validation: entry.overrideMileageValidation ?? false,
    override_mileage_reason: entry.overrideMileageValidation
      ? entry.overrideMileageReason || null
      : null,
  });

  if (error) {
    console.error("Supabase service save error:", error.message);
  }
}

export async function loadMaintenanceRemindersFromSupabase(
  userId: string,
  vehicleId?: string
): Promise<MaintenanceReminder[]> {
  let query = supabase
    .from("maintenance_reminders")
    .select("*")
    .eq("user_id", userId)
    .order("due_odometer", { ascending: true, nullsFirst: false });

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;

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
    status: data.status ?? "active",
    isPrimary: data.is_primary ?? false,
  };
}

export async function loadVehiclesFromSupabase(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((v) => ({
    id: v.id,
    userId: v.user_id,
    year: v.year ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    trim: v.trim ?? "",
    color: v.color ?? "",
    licensePlate: v.license_plate ?? "",
    vin: v.vin ?? "",
    notes: v.notes ?? "",
    status: v.status ?? "active",
    isPrimary: v.is_primary ?? false,
  }));
}

export async function loadPrimaryVehicleFromSupabase(userId: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
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
    status: data.status ?? "active",
    isPrimary: data.is_primary ?? false,
  };
}

export async function loadCurrentOdometer(userId: string, vehicleId?: string): Promise<number> {
  let query = supabase
    .from("shifts")
    .select("ending_mileage")
    .eq("user_id", userId)
    .not("ending_mileage", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return 0;
  return parseFloat(data[0].ending_mileage) || 0;
}

export function computeServiceStats(entries: ServiceEntry[]) {
  const totalServices = entries.length;
  const totalSpent = entries.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
  const lastServiceOdometer = entries[0]?.odometer ?? "--";
  return { totalServices, totalSpent, lastServiceOdometer };
}

export async function saveMaintenanceReminderToSupabase(reminder: MaintenanceReminder) {
  const dueOdometer =
    Number(reminder.lastDoneOdometer || 0) + Number(reminder.intervalMiles || 0);

  const { error } = await supabase.from("maintenance_reminders").insert({
    user_id: reminder.userId,
    title: reminder.title,
    last_done_odometer: reminder.lastDoneOdometer || null,
    interval_miles: reminder.intervalMiles || null,
    due_odometer: dueOdometer || null,
    due_date: reminder.dueDate || null,
    notes: reminder.notes,
  });

  if (error) {
    console.error("Supabase reminder save error:", error.message);
  }
}

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

export async function loadServiceIntervalsFromSupabase(
  userId: string,
  vehicleId?: string
): Promise<ServiceInterval[]> {
  let query = supabase
    .from("service_intervals")
    .select("*")
    .eq("user_id", userId);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    vehicleId: entry.vehicle_id ?? null,
    serviceType: entry.service_type ?? "",
    intervalMiles: entry.interval_miles ?? null,
    intervalMonths: entry.interval_months ?? null,
    lastDoneOdometer: entry.last_done_odometer ?? null,
    lastDoneDate: entry.last_done_date ?? null,
  }));
}

export async function saveServiceIntervalsToSupabase(
  userId: string,
  vehicleId: string,
  intervals: ServiceInterval[]
): Promise<void> {
  await supabase
    .from("service_intervals")
    .delete()
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  if (intervals.length === 0) return;

  const { error } = await supabase.from("service_intervals").insert(
    intervals.map((interval) => ({
      user_id: userId,
      vehicle_id: vehicleId,
      service_type: interval.serviceType,
      interval_miles: interval.intervalMiles,
      interval_months: interval.intervalMonths,
      last_done_odometer: interval.lastDoneOdometer ?? null,
      last_done_date: interval.lastDoneDate ?? null,
    }))
  );

  if (error) console.error("Supabase service intervals save error:", error.message);
}

export function getIntervalForServiceType(
  intervals: ServiceInterval[],
  serviceType: string
): ServiceInterval | null {
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

function getDefaultInterval(
  serviceType: string
): { intervalMiles: number | null; intervalMonths: number | null } {
  switch (serviceType) {
    case "Oil Change": return { intervalMiles: 5000, intervalMonths: null };
    case "Tire Rotation": return { intervalMiles: 5000, intervalMonths: null };
    case "Brake Repair": return { intervalMiles: 20000, intervalMonths: null };
    case "Transmission Service": return { intervalMiles: 40000, intervalMonths: null };
    case "Battery Check": return { intervalMiles: 50000, intervalMonths: null };
    case "Tires": return { intervalMiles: 50000, intervalMonths: null };
    case "Wipers": return { intervalMiles: null, intervalMonths: 12 };
    case "Inspection": return { intervalMiles: null, intervalMonths: 12 };
    case "Registration Renewal": return { intervalMiles: null, intervalMonths: 12 };
    default: return { intervalMiles: 5000, intervalMonths: null };
  }
}

export async function generateRemindersFromIntervals(
  userId: string,
  vehicleId: string
): Promise<void> {
  const intervals = await loadServiceIntervalsFromSupabase(userId, vehicleId);

  for (const interval of intervals) {
    const isDateBased =
      interval.intervalMonths !== null && interval.intervalMiles === null;

    if (isDateBased) {
      if (!interval.lastDoneDate) continue;

      const lastDate = new Date(interval.lastDoneDate + "T12:00:00");
      lastDate.setMonth(lastDate.getMonth() + (interval.intervalMonths ?? 0));
      const dueDate = lastDate.toISOString().split("T")[0];

      await supabase
        .from("maintenance_reminders")
        .delete()
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .eq("title", interval.serviceType);

      const { error } = await supabase.from("maintenance_reminders").insert({
        user_id: userId,
        vehicle_id: vehicleId,
        title: interval.serviceType,
        due_odometer: null,
        due_date: dueDate,
        last_done_odometer: interval.lastDoneOdometer,
        interval_miles: null,
        notes: "",
      });

      if (error) console.error("generateReminders insert error:", error.message);
    } else {
      if (interval.lastDoneOdometer === null) continue;

      const dueOdometer = interval.lastDoneOdometer + (interval.intervalMiles ?? 0);

      await supabase
        .from("maintenance_reminders")
        .delete()
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .eq("title", interval.serviceType);

      const { error } = await supabase.from("maintenance_reminders").insert({
        user_id: userId,
        vehicle_id: vehicleId,
        title: interval.serviceType,
        due_odometer: dueOdometer,
        due_date: null,
        last_done_odometer: interval.lastDoneOdometer,
        interval_miles: interval.intervalMiles,
        notes: "",
      });

      if (error) console.error("generateReminders insert error:", error.message);
    }
  }
}

const DATE_BASED_TYPES = ["Wipers", "Inspection", "Registration Renewal"];

export async function autoUpdateIntervalFromService(
  userId: string,
  serviceType: string,
  odometer: number,
  serviceDate: string,
  vehicleId: string
): Promise<void> {
  const isDateBased = DATE_BASED_TYPES.includes(serviceType);

  const { data: existing } = await supabase
    .from("service_intervals")
    .select("id")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .eq("service_type", serviceType)
    .limit(1);

  if (existing && existing.length > 0) {
    if (isDateBased) {
      const { error } = await supabase
        .from("service_intervals")
        .update({ last_done_odometer: odometer, last_done_date: serviceDate })
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .eq("service_type", serviceType);
      if (error) console.error("autoUpdateInterval update error:", error.message);
    } else {
      const { error } = await supabase
        .from("service_intervals")
        .update({ last_done_odometer: odometer })
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId)
        .eq("service_type", serviceType);
      if (error) console.error("autoUpdateInterval update error:", error.message);
    }
  } else {
    const defaults = getDefaultInterval(serviceType);
    const { error } = await supabase.from("service_intervals").insert({
      user_id: userId,
      vehicle_id: vehicleId,
      service_type: serviceType,
      interval_miles: defaults.intervalMiles,
      interval_months: defaults.intervalMonths,
      last_done_odometer: isDateBased ? null : odometer,
      last_done_date: isDateBased ? serviceDate : null,
    });
    if (error) console.error("autoUpdateInterval insert error:", error.message);
  }

  await generateRemindersFromIntervals(userId, vehicleId);
}

export async function clearIntervalLastDone(
  userId: string,
  serviceType: string,
  vehicleId?: string
): Promise<void> {
  let query = supabase
    .from("service_intervals")
    .update({ last_done_odometer: null, last_done_date: null })
    .eq("user_id", userId)
    .eq("service_type", serviceType);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { error } = await query;
  if (error) console.error("Clear interval error:", error.message);
}
