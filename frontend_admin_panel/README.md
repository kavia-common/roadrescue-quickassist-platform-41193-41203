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

## Tooling / PostCSS (caniuse-lite) build errors

If the dev preview/build fails with an error like:

- `Loading PostCSS "postcss-preset-env" plugin failed: Cannot find module 'caniuse-lite/data/features/...'`

This typically indicates a missing/corrupted `caniuse-lite` install or a mismatched Browserslist DB.

Remediation:

1. Reinstall deps (fresh `node_modules`)
2. Update Browserslist DB:
   - `npm run browserslist:update`

This repo also pins `caniuse-lite` + `browserslist` in `package.json` to make installs deterministic.

Demo admin (mock mode): `admin@example.com` / `password123`

See `../assets/supabase.md` for suggested table schemas.
