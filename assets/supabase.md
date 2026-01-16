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

The Admin Portal supports a dedicated reset route and a **mandatory callback route**:

- **Forgot password?** sends a reset email via:
  `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- The reset email link must redirect back to the SPA at:
  **`/auth/callback`** (MANDATORY)
- The `/auth/callback` page lets Supabase parse tokens / code and then forwards to:
  **`/reset-password`**
- The `/reset-password` page prompts for a new password and calls:
  `supabase.auth.updateUser({ password })`
- After success, the UI redirects the admin back to **`/admin`** (login screen).

### Supabase Redirect URLs (required)

In Supabase Dashboard → Authentication → URL Configuration, ensure these are allowed:

- `https://<your-admin-domain>/auth/callback`
- `https://<your-admin-domain>/reset-password`
- `https://<your-admin-domain>/admin`

### Required env var

- `REACT_APP_FRONTEND_URL`: the deployed origin of this admin panel (used to build the `redirectTo` URL).
  - Example: `https://your-admin-domain.com`
  - Must be allowed in Supabase Auth "Redirect URLs".

See the user website `assets/supabase.md` for recommended `profiles`, `requests`, and `fees` tables.
