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
 -- ============================================================
 -- Add user_id column to existing tables (for auth-based isolation)
 -- ============================================================
 alter table public.activity_records add column if not exists user_id uuid references auth.users not null default auth.uid();
 alter table public.entertainment_spends add column if not exists user_id uuid references auth.users not null default auth.uid();
 
 -- ============================================================
 -- Create categories table (user-defined activity types)
 -- ============================================================
 create table if not exists public.categories (
   id uuid primary key default gen_random_uuid(),
   user_id uuid references auth.users not null default auth.uid(),
   name text not null,
   color text not null default '#0EA5A4',
   created_at timestamptz not null default now(),
   unique(user_id, name)
 );
 
 -- ============================================================
 -- Drop old single-user policies
 -- ============================================================
 drop policy if exists "single user activity access" on public.activity_records;
 drop policy if exists "single user spend access" on public.entertainment_spends;
 
 -- ============================================================
 -- New RLS policies for activity_records (auth-based)
 -- ============================================================
 create policy "Users can read own activity records"
   on public.activity_records for select
   using (auth.uid() = user_id);
 
 create policy "Users can insert own activity records"
   on public.activity_records for insert
   with check (auth.uid() = user_id);
 
 create policy "Users can delete own activity records"
   on public.activity_records for delete
   using (auth.uid() = user_id);
 
 -- ============================================================
 -- New RLS policies for entertainment_spends (auth-based)
 -- ============================================================
 create policy "Users can read own spends"
   on public.entertainment_spends for select
   using (auth.uid() = user_id);
 
 create policy "Users can insert own spends"
   on public.entertainment_spends for insert
   with check (auth.uid() = user_id);
 
 -- ============================================================
 -- RLS policies for categories
 -- ============================================================
 alter table public.categories enable row level security;
 
 create policy "Users can read own categories"
   on public.categories for select
   using (auth.uid() = user_id);
 
 create policy "Users can insert own categories"
   on public.categories for insert
   with check (auth.uid() = user_id);
 
 create policy "Users can update own categories"
   on public.categories for update
   using (auth.uid() = user_id);
 
 create policy "Users can delete own categories"
   on public.categories for delete
   using (auth.uid() = user_id);
 
 -- ============================================================
 -- Enable realtime for categories
 -- ============================================================
 do $$
 begin
   alter publication supabase_realtime add table public.categories;
 exception
   when duplicate_object then null;
 end $$;
 
 -- ============================================================
 -- Grant table access to anon and authenticated roles
 -- ============================================================
 grant usage on schema public to anon, authenticated;
 grant all on all tables in schema public to anon, authenticated;
 grant all on all sequences in schema public to anon, authenticated;
