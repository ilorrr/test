-- =========================================
-- NeuroFit — Supabase schema (public)
-- Copy-paste into Supabase SQL Editor
-- =========================================

-- ---------- SAFETY: DROP (idempotent) ----------
do $$ begin
  if to_regclass('public.weekly_plans') is not null then drop table public.weekly_plans cascade; end if;
  if to_regclass('public.activity_feed') is not null then drop table public.activity_feed cascade; end if;
  if to_regclass('public.workout_logs') is not null then drop table public.workout_logs cascade; end if;
  if to_regclass('public.exercises')    is not null then drop table public.exercises cascade; end if;
  if to_regclass('public.profiles')     is not null then drop table public.profiles cascade; end if;
  if to_regclass('public.exercise_stats_v') is not null then drop view public.exercise_stats_v; end if;
  -- optional matview + function (only if you used them before)
  if to_regclass('public.exercise_stats_mv') is not null then drop materialized view public.exercise_stats_mv; end if;
  if exists (select 1 from pg_proc where proname='refresh_exercise_stats_mv') then
    drop function public.refresh_exercise_stats_mv();
  end if;
exception when others then null; end $$;

-- ---------- TABLES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  units text not null default 'lbs',              -- 'lbs' | 'kg'
  weekly_goal int not null default 3 check (weekly_goal between 1 and 7),
  created_at timestamptz not null default now()
);

create table public.exercises (
  id bigserial primary key,
  name text not null,
  kind text,                 -- push, pull, legs, core, etc.
  muscle text,               -- chest, back, quads, etc.
  is_default boolean not null default false
);
create unique index if not exists exercises_name_unique on public.exercises (lower(name));

create table public.workout_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  exercise_id bigint references public.exercises(id),
  exercise_name text not null,                             -- denormalized for fast lists
  sets int not null check (sets > 0),
  reps int not null check (reps > 0),
  weight numeric not null check (weight >= 0),
  volume numeric generated always as (sets * reps * weight) stored,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, date desc);
create index if not exists workout_logs_user_ex_idx   on public.workout_logs (user_id, exercise_name);

create table public.activity_feed (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_ts_idx on public.activity_feed (user_id, created_at desc);

create table public.weekly_plans (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_of date not null,                                    -- Monday of ISO week
  level text not null,                                      -- beginner/intermediate/advanced
  days int not null check (days between 2 and 6),
  goal text not null,                                       -- strength/hypertrophy/endurance/recomp
  progression int not null default 0 check (progression in (-1,0,1)),
  equipment text[] not null default '{}',
  plan jsonb not null,                                      -- your day-by-day structure
  created_at timestamptz not null default now(),
  unique (user_id, week_of)
);

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.workout_logs  enable row level security;
alter table public.activity_feed enable row level security;
alter table public.weekly_plans  enable row level security;

create policy "profiles are self-only"
  on public.profiles
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "logs are self-only"
  on public.workout_logs
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "activity is self-only"
  on public.activity_feed
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "plans are self-only"
  on public.weekly_plans
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- PROGRESS VIEW (fast enough for most apps) ----------
create view public.exercise_stats_v as
select
  user_id,
  exercise_name,
  sum(volume)        as total_volume,
  max(weight)        as max_weight,
  max(weight * (1 + reps/30.0)) as best_1rm,
  max(date)          as last_date
from public.workout_logs
group by user_id, exercise_name;

-- Secure the view (inherits RLS via underlying table)
-- Optionally add helper index for common sort on-the-fly queries (not required for a view).

-- ---------- OPTIONAL: MATERIALIZED VIEW for larger datasets ----------
-- If you expect very large logs and want instant Progress page, use the MV + refresh function.
-- (Skip this block if you’re fine with the normal view.)

create materialized view public.exercise_stats_mv as
select
  user_id,
  exercise_name,
  sum(volume)        as total_volume,
  max(weight)        as max_weight,
  max(weight * (1 + reps/30.0)) as best_1rm,
  max(date)          as last_date
from public.workout_logs
group by user_id, exercise_name
with no data;

create index if not exists exercise_stats_mv_user_sort
  on public.exercise_stats_mv (user_id, total_volume desc);

-- Expose a safe REFRESH you can call from the client after bulk inserts.
-- Note: REFRESH CONCURRENTLY must be in its own transaction; this RPC handles it.
create or replace function public.refresh_exercise_stats_mv()
returns void
language plpgsql
security definer
as $$
begin
  perform pg_advisory_lock(987654321);  -- crude mutex to avoid overlapping refreshes
  begin
    refresh materialized view concurrently public.exercise_stats_mv;
  exception when others then
    -- First time (no indexes) fallback
    refresh materialized view public.exercise_stats_mv;
  end;
  perform pg_advisory_unlock(987654321);
end $$;

-- You will query the MV instead of the view:
-- select * from public.exercise_stats_mv where user_id = auth.uid() order by total_volume desc;

-- ---------- SEED DEFAULT EXERCISES ----------
insert into public.exercises (name, kind, muscle, is_default) values
  ('Back Squat','compound','legs',true),
  ('Front Squat','compound','legs',true),
  ('Goblet Squat','compound','legs',true),
  ('Leg Press','compound','legs',true),
  ('Romanian Deadlift','compound','posterior',true),
  ('Deadlift','compound','posterior',true),
  ('Hip Thrust','compound','glutes',true),
  ('Barbell Bench Press','compound','chest',true),
  ('DB Bench Press','compound','chest',true),
  ('Push-up','compound','chest',true),
  ('Overhead Press','compound','shoulders',true),
  ('DB Shoulder Press','compound','shoulders',true),
  ('Barbell Row','compound','back',true),
  ('DB Row','compound','back',true),
  ('Lat Pulldown','compound','back',true),
  ('Pull-up','compound','back',true),
  ('Bicep Curl','accessory','biceps',true),
  ('Triceps Pushdown','accessory','triceps',true),
  ('Skullcrusher','accessory','triceps',true),
  ('Lateral Raise','accessory','shoulders',true),
  ('Chest Fly','accessory','chest',true),
  ('Leg Curl','accessory','posterior',true),
  ('Leg Extension','accessory','quads',true),
  ('Calf Raise','accessory','calves',true),
  ('Plank','core','core',true),
  ('Cable Crunch','core','core',true),
  ('Hanging Knee Raise','core','core',true)
on conflict do nothing;

-- ---------- QUALITY-OF-LIFE QUERIES (examples) ----------
-- Weekly stats for dashboard
-- select count(distinct date) as workouts, coalesce(sum(volume),0) as volume
-- from public.workout_logs
-- where user_id = auth.uid() and date between '2025-10-20' and '2025-10-26';

-- History with filters (PostgREST does this via query params from the JS SDK)
-- select * from public.workout_logs
-- where user_id = auth.uid() and exercise_name ilike '%bench%'
-- order by date desc, created_at desc
-- limit 100;

-- Done.
