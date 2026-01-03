-- 1. Reset: Drop the old table if it exists
drop table if exists rooms;

-- 2. New Schema: Create table with 'name' as Primary Key (Text)
create table rooms (
  name text primary key,        -- ID matches the room name string
  document integer[] not null default '{}'::integer[],      -- y-supabase storage
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Security: Enable RLS and Public Access
alter table rooms enable row level security;

create policy "Public Access"
on rooms
for all
using (true)
with check (true);

-- 4. Realtime: Enable listening on this table
-- This fixes the 422 "Failed to load resource" error for Realtime
alter publication supabase_realtime add table rooms;
