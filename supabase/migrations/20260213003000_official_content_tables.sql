begin;

create table if not exists public.official_exercise_defs (
  id text primary key,
  name text not null,
  description text not null default '',
  thumbnail_url text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create table if not exists public.official_workout_templates (
  id text primary key,
  name text not null,
  description text not null default '',
  tagline text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create index if not exists idx_official_exercise_defs_name on public.official_exercise_defs (lower(name));
create index if not exists idx_official_exercise_defs_updated_at on public.official_exercise_defs (updated_at desc);
create index if not exists idx_official_exercise_defs_published_at on public.official_exercise_defs (published_at desc);

create index if not exists idx_official_workout_templates_name on public.official_workout_templates (lower(name));
create index if not exists idx_official_workout_templates_updated_at on public.official_workout_templates (updated_at desc);
create index if not exists idx_official_workout_templates_published_at on public.official_workout_templates (published_at desc);

create or replace function public.official_content_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_official_exercise_defs_updated_at on public.official_exercise_defs;
create trigger trg_official_exercise_defs_updated_at
before update on public.official_exercise_defs
for each row execute function public.official_content_touch_updated_at();

drop trigger if exists trg_official_workout_templates_updated_at on public.official_workout_templates;
create trigger trg_official_workout_templates_updated_at
before update on public.official_workout_templates
for each row execute function public.official_content_touch_updated_at();

alter table public.official_exercise_defs enable row level security;
alter table public.official_workout_templates enable row level security;

drop policy if exists "Authenticated read official exercise defs" on public.official_exercise_defs;
create policy "Authenticated read official exercise defs"
  on public.official_exercise_defs
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated read official workout templates" on public.official_workout_templates;
create policy "Authenticated read official workout templates"
  on public.official_workout_templates
  for select
  using (auth.role() = 'authenticated');

commit;
