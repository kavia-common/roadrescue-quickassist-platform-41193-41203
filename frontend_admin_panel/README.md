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

## Demo login button (Supabase mode)
To show a **DEMO login** button on the admin login screen (Supabase sign-in using preset credentials), set:

- `REACT_APP_DEMO_ADMIN_ENABLED=true`
- `REACT_APP_DEMO_ADMIN_EMAIL=<demo-admin-email>`
- `REACT_APP_DEMO_ADMIN_PASSWORD=<demo-admin-password>`

Notes:
- The DEMO button is intended for **Supabase mode** (requires `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY`).
- In mock mode, the login form is already prefilled with demo credentials.

See `../assets/supabase.md` for suggested table schemas.
