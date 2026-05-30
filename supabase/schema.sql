-- Run this in your Supabase SQL editor

create table if not exists fasting_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('start','stop','recall')),
  time timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists fasting_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  status text not null check (status in ('fasting','eating','done')),
  start_time timestamptz,
  stop_time timestamptz,
  updated_at timestamptz default now()
);

create table if not exists weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

create table if not exists period_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz default now(),
  unique(user_id, start_date)
);

-- Row-level security: users can only see/edit their own data
alter table fasting_logs    enable row level security;
alter table fasting_state   enable row level security;
alter table weight_entries  enable row level security;
alter table period_entries  enable row level security;

create policy "own fasting_logs"   on fasting_logs   for all using (auth.uid() = user_id);
create policy "own fasting_state"  on fasting_state  for all using (auth.uid() = user_id);
create policy "own weight_entries" on weight_entries for all using (auth.uid() = user_id);
create policy "own period_entries" on period_entries for all using (auth.uid() = user_id);
