alter table public.fuel_entries
  add column if not exists is_full_fill_up boolean default true;
