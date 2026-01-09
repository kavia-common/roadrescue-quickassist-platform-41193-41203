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

Demo admin (DEMO ONLY hardcoded): `admin@demo.local` / `demo1234`

See `../assets/supabase.md` for suggested table schemas.
