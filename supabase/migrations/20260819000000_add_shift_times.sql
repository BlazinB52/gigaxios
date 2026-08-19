alter table public.shifts
  add column if not exists start_time text,
  add column if not exists end_time text;

update public.shifts
set status = 'closed'
where status is null;

alter table public.shifts
  alter column status set default 'closed';
