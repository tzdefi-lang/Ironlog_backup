# Supabase Operations

## Edge Function: `token-exchange`

Set required secrets:

```bash
supabase secrets set JWT_SECRET=<your-supabase-jwt-secret>
supabase secrets set PRIVY_APP_ID=<your-privy-app-id>
```

Deploy:

```bash
supabase functions deploy token-exchange --no-verify-jwt
```

Source:

- `supabase/functions/token-exchange/index.ts`

## Edge Function: `official-content-admin`

Set required secrets:

```bash
supabase secrets set JWT_SECRET=<your-supabase-jwt-secret>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
supabase secrets set ADMIN_EMAILS=<comma-separated-admin-emails>
```

Deploy:

```bash
supabase functions deploy official-content-admin --no-verify-jwt
```

Source:

- `supabase/functions/official-content-admin/index.ts`

## Database Migrations

Apply all local migrations:

```bash
supabase db push
```

Current key migrations:

- `20260211183031_privy_user_id_text_and_rls.sql`
  - converts `workouts.user_id` and `exercise_defs.user_id` to `text` (when needed)
  - recreates RLS policies for token-exchange JWT claims
- `20260212101500_migrate_legacy_data_by_email.sql`
  - creates `public.migrate_legacy_user_data_by_email()`
- `20260213003000_official_content_tables.sql`
  - creates `public.official_exercise_defs` and `public.official_workout_templates`
  - enables RLS with authenticated read-only access

## Production Checklist

1. `supabase db push`
2. `supabase functions deploy token-exchange --no-verify-jwt`
3. `supabase functions deploy official-content-admin --no-verify-jwt`
4. Verify function call from app succeeds with `200`.
5. Verify RLS by querying `workouts`, `exercise_defs`, `official_exercise_defs`, and `official_workout_templates` from two different users.
