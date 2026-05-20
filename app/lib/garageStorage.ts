import { supabase } from "@/app/lib/supabaseClient";


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
        .order("due_odometer", { ascending: true });

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

export async function saveMaintenanceReminderToSupabase(
    reminder: MaintenanceReminder
) {
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
