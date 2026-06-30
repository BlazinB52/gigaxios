create table if not exists public.shift_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  date date not null,
  platform text,
  deduction_type text not null,
  amount numeric not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.shift_deductions enable row level security;

create policy "Users can view their own shift deductions"
  on public.shift_deductions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own shift deductions"
  on public.shift_deductions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own shift deductions"
  on public.shift_deductions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own shift deductions"
  on public.shift_deductions
  for delete
  using (auth.uid() = user_id);

create index if not exists shift_deductions_user_id_idx
  on public.shift_deductions(user_id);

create index if not exists shift_deductions_shift_id_idx
  on public.shift_deductions(shift_id);

create index if not exists shift_deductions_date_idx
  on public.shift_deductions(date);
