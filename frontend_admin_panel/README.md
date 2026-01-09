# RoadRescue – QuickAssist (Admin Panel)

Admin interface to manage users/mechanics, requests, fees, and basic analytics.

## Key flows

- Login (admin account)
- Dashboard KPIs
- User Management (approve mechanics)
- Request Management (reassign/change status/close)
- Fee Settings
- Analytics (lightweight)

## Auth & Data

This app supports two modes:

1. **Supabase mode**: if `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` are set, auth uses `supabase.auth` and persistence uses Supabase tables.
2. **Mock mode**: otherwise uses `localStorage` with seeded demo data.

Demo admin (mock mode): `admin@example.com` / `password123`

## DEMO login (hardcoded, in-app)
The admin login screen includes an always-available **DEMO login** button that:

- does **not** depend on any environment variables
- does **not** require an existing Supabase user
- bypasses Supabase/RLS profile checks by using a local DEMO admin session
- guarantees navigation to `/dashboard`

Logging out exits DEMO mode.

See `../assets/supabase.md` for the Supabase schema used when running in Supabase mode.
