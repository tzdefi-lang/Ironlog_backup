begin;

-- 1) Drop any existing policies on these tables first.
--    (required before altering user_id type if current policies reference it)
do $$
declare p record;
begin
  if to_regclass('public.workouts') is not null then
    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'workouts'
    loop
      execute format('drop policy if exists %I on public.workouts', p.policyname);
    end loop;
  end if;

  if to_regclass('public.exercise_defs') is not null then
    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'exercise_defs'
    loop
      execute format('drop policy if exists %I on public.exercise_defs', p.policyname);
    end loop;
  end if;
end
$$;

-- 2) Detach legacy foreign keys to auth.users before changing column types.
alter table if exists public.workouts drop constraint if exists workouts_user_id_fkey;
alter table if exists public.exercise_defs drop constraint if exists exercise_defs_user_id_fkey;

-- 3) Convert user_id columns from uuid -> text only when needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workouts'
      and column_name = 'user_id'
      and data_type = 'uuid'
  ) then
    alter table public.workouts
      alter column user_id type text using user_id::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercise_defs'
      and column_name = 'user_id'
      and data_type = 'uuid'
  ) then
    alter table public.exercise_defs
      alter column user_id type text using user_id::text;
  end if;
end
$$;

-- 4) Ensure RLS is enabled.
alter table if exists public.workouts enable row level security;
alter table if exists public.exercise_defs enable row level security;

-- 5) Create canonical Privy-compatible policies.
do $$
begin
  if to_regclass('public.workouts') is not null then
    create policy "Users manage own workouts"
      on public.workouts
      for all
      using (auth.uid()::text = user_id)
      with check (auth.uid()::text = user_id);
  end if;

  if to_regclass('public.exercise_defs') is not null then
    create policy "Users manage own exercise_defs"
      on public.exercise_defs
      for all
      using (auth.uid()::text = user_id)
      with check (auth.uid()::text = user_id);
  end if;
end
$$;

commit;
