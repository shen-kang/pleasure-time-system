create table if not exists public.activity_records (
  id uuid primary key,
  profile_id text not null,
  category text not null check (category in ('投资', '套利', '健身', '羽毛球', '阅读')),
  hours integer not null check (hours >= 0 and hours <= 24),
  minutes integer not null check (minutes >= 0 and minutes <= 59),
  decimal_hours numeric(8, 2) not null,
  focus_score integer not null check (focus_score >= 0 and focus_score <= 20),
  points numeric(10, 2) not null,
  earned_minutes numeric(10, 1) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entertainment_spends (
  id uuid primary key,
  profile_id text not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  created_at timestamptz not null default now()
);

create index if not exists activity_records_profile_created_idx
  on public.activity_records (profile_id, created_at desc);

create index if not exists entertainment_spends_profile_created_idx
  on public.entertainment_spends (profile_id, created_at desc);

alter table public.activity_records enable row level security;
alter table public.entertainment_spends enable row level security;

drop policy if exists "single user activity access" on public.activity_records;
drop policy if exists "single user spend access" on public.entertainment_spends;

-- Single-user version for this app.
-- The app writes the same NEXT_PUBLIC_APP_PROFILE_ID from Mac and iPhone.
-- For personal use this is the simplest setup; add Supabase Auth later if you want account-level privacy.
create policy "single user activity access"
  on public.activity_records for all
  using (true)
  with check (true);

create policy "single user spend access"
  on public.entertainment_spends for all
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.activity_records;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.entertainment_spends;
exception
  when duplicate_object then null;
end $$;
