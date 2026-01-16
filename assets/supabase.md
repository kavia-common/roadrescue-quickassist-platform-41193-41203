# Supabase integration (Admin Panel)

The admin panel can run in:

- **Supabase mode** when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set
- **Mock mode** otherwise (localStorage)

## Supabase-only admin auth (enforced)

When Supabase is configured, the admin panel **does not** fall back to local/mock auth. Admins must authenticate via **Supabase Auth**.

Admin-specific usage:
- lists users from `profiles`
- approves mechanics (sets `approved=true` and role to `approved_mechanic`)
- lists/updates requests (status and mechanic assignment)
- stores fee parameters in `fees` (optional)

## Password reset flow

The Admin Portal (`/admin`) includes:
- "Forgot password?" -> calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- Recovery link returns to `/admin` with `type=recovery`, where the UI prompts for a new password and calls `supabase.auth.updateUser({ password })`.

### Required env var

- `REACT_APP_FRONTEND_URL`: the deployed origin of this admin panel (used to build the `redirectTo` URL).
  - Example: `https://your-admin-domain.com`
  - Must be allowed in Supabase Auth "Redirect URLs".

See the user website `assets/supabase.md` for recommended `profiles`, `requests`, and `fees` tables.
