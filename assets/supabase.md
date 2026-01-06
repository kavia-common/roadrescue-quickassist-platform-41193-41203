# Supabase integration (Admin Panel)

The admin panel can run in:

- **Supabase mode** when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set
- **Mock mode** otherwise (localStorage)

See the user website `assets/supabase.md` for recommended `profiles`, `requests`, and `fees` tables.

Admin-specific usage:
- lists users from `profiles`
- approves mechanics (sets `approved=true` and role to `approved_mechanic`)
- lists/updates requests (status and mechanic assignment)
- stores fee parameters in `fees` (optional)
