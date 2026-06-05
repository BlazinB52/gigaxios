alter table public.fuel_entries
  add column if not exists override_mileage_validation boolean default false,
  add column if not exists override_mileage_reason text;

alter table public.service_entries
  add column if not exists override_mileage_validation boolean default false,
  add column if not exists override_mileage_reason text;

alter table public.shifts
  add column if not exists start_mileage_override boolean default false,
  add column if not exists start_mileage_override_reason text,
  add column if not exists end_mileage_override boolean default false,
  add column if not exists end_mileage_override_reason text;
