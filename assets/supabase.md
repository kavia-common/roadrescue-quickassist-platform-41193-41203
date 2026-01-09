# Supabase integration (Admin Panel)

The admin panel can run in:

- **Supabase mode** when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set
- **Mock mode** otherwise (localStorage)

See the user website `assets/supabase.md` for recommended `profiles`, `requests`, and `fees` tables.

Admin-specific usage:
- lists users from `profiles` (does **not** require `profiles.email`)
  - If you want emails in the admin UI, the app will attempt to enrich them from `auth.users.email` using the Supabase Admin API.
  - This requires using a **service role key** in `REACT_APP_SUPABASE_KEY`. If you use an anon key, the UI will still load but emails may show as `(unknown)`.
- approves mechanics (sets `approved=true` and role to `approved_mechanic`)
- lists/updates requests (status and mechanic assignment)
- stores fee parameters in `fees` (optional)

## Required `public.profiles` schema

The frontends expect `public.profiles` to include at least:

- `id uuid primary key references auth.users(id)`
- `role text` (default `user`)
- `approved boolean` (default `false`)
- `profile jsonb` (mechanic profile fields like `{ name, serviceArea }`)
- `full_name text` (optional)
- `created_at timestamptz`, `updated_at timestamptz`

If you see SQL errors like `column profiles.approved does not exist`, run the migration in:
`assets/supabase_profiles_migration.sql.md`
