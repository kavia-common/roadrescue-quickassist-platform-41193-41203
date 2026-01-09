# Supabase integration (Admin Panel)

The admin panel can run in:

- **Supabase mode** when `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set
- **Mock mode** otherwise (localStorage)

See the user website `assets/supabase.md` for the implemented schema, triggers, indexes, and RLS policies.

Note: a performance/index migration was applied on 2026-01-09 to add missing `requests` analytics/search columns and indexes (including GIN indexes for `location_text` and `issue_description`).

Admin-specific usage (expected by RLS):

- Admins have `app_metadata.role = admin`
- Admin can:
  - view/update any `profiles`, `mechanic_profiles`, `requests`, `request_notes`
  - approve mechanics by updating `profiles.approved = true` (and ensuring `profiles.role='mechanic'`)
  - manage request status and mechanic assignment
