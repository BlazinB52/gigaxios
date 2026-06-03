create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  price_id text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

drop policy if exists "Users can select their own subscription" on public.subscriptions;

create policy "Users can select their own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

