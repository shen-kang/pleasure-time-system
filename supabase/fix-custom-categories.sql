-- Run this once in Supabase SQL Editor for existing projects.
-- It allows user-created activity categories and permits deleting spend records.

alter table public.activity_records
  drop constraint if exists activity_records_category_check;

drop policy if exists "Users can delete own spends"
  on public.entertainment_spends;

create policy "Users can delete own spends"
  on public.entertainment_spends for delete
  using (auth.uid() = user_id);
