# Supabase Operations

## Edge Function: `token-exchange`

Set required secrets:

```bash
supabase secrets set JWT_SECRET=<your-supabase-jwt-secret>
supabase secrets set PRIVY_APP_ID=<your-privy-app-id>
supabase secrets set ALLOWED_ORIGINS="https://your-production-domain.com,http://localhost:3000"
```

Deploy:

```bash
supabase functions deploy token-exchange --no-verify-jwt
```

Source:

- `supabase/functions/token-exchange/index.ts`

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

## Production Checklist

1. `supabase db push`
2. `supabase functions deploy token-exchange --no-verify-jwt`
3. Verify function call from app succeeds with `200`.
4. Verify RLS by querying `workouts` and `exercise_defs` from two different users.
