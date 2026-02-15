begin;

create or replace function public.migrate_legacy_user_data_by_email()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_current_user_id text := auth.uid()::text;
  v_email text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
  v_old_user_ids text[] := '{}';
  v_workouts integer := 0;
  v_exercise_defs integer := 0;
begin
  if v_current_user_id is null then
    return jsonb_build_object(
      'migrated', false,
      'reason', 'unauthenticated'
    );
  end if;

  if v_email is null then
    return jsonb_build_object(
      'migrated', false,
      'reason', 'email_missing'
    );
  end if;

  select coalesce(array_agg(u.id::text), '{}')
  into v_old_user_ids
  from auth.users u
  where lower(coalesce(u.email, '')) = v_email
    and u.id::text <> v_current_user_id;

  if coalesce(array_length(v_old_user_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'migrated', false,
      'reason', 'no_legacy_user'
    );
  end if;

  update public.workouts
  set user_id = v_current_user_id
  where user_id = any(v_old_user_ids);
  get diagnostics v_workouts = row_count;

  update public.exercise_defs
  set user_id = v_current_user_id
  where user_id = any(v_old_user_ids);
  get diagnostics v_exercise_defs = row_count;

  return jsonb_build_object(
    'migrated', true,
    'reason', 'ok',
    'email', v_email,
    'legacy_user_ids', v_old_user_ids,
    'migrated_workouts', v_workouts,
    'migrated_exercise_defs', v_exercise_defs
  );
end;
$$;

revoke all on function public.migrate_legacy_user_data_by_email() from public;
grant execute on function public.migrate_legacy_user_data_by_email() to authenticated;

commit;
