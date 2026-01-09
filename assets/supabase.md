# Supabase integration (Admin Panel)

The admin panel can run in:

- **Supabase mode** when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set
- **Mock mode** otherwise (localStorage)

See the user website `assets/supabase.md` for the implemented schema and RLS policies.

Admin-specific usage:
- lists users from `profiles`
- approves mechanics (updates `profiles.role` / approval workflow if implemented at app level)
- lists/updates requests (status and mechanic assignment)
- stores fee parameters in `fees` (optional, if enabled in your build)
