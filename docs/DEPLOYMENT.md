# Deployment

TAW is deployed through the existing RAVBsoft developer-portal model. The portal is the control plane for licence keys, releases and customer installations.

## Build

```bash
npm install
npm run build
```

The production output is `dist/`. It includes the PWA manifest, service worker, favicon and icons.

## Local preview

```bash
npm run preview
```

## Cloudflare Pages

`npm run deploy` runs the build and then:

```bash
npx wrangler pages deploy dist --project-name taw-carrier --branch main
```

The portal can also deploy a built zip/folder. Configure these environment variables at build time:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Company workspace Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable key for that project |
| `VITE_PORTAL_URL` | Developer portal URL |
| `VITE_MASTER_LICENSE_URL` | Supabase project hosting the licence RPC |
| `VITE_MASTER_LICENSE_ANON_KEY` | Publishable key for the licence RPC |
| `VITE_GOOGLE_MAPS_KEY` | Optional; built-in route table and map pins are used when blank |
| `VITE_WAHA_URL` | WAHA base URL, e.g. `https://waha.example.com` |
| `VITE_WAHA_API_KEY` | WAHA `X-Api-Key` |
| `VITE_WAHA_SESSION` | WAHA session name, default `default` |
| `VITE_WAHA_WEBHOOK_SECRET` | Shared secret for incoming WAHA webhooks |
| `VITE_WAHA_WEBHOOK_RELAY_URL` | Public relay that forwards WAHA events to the app |

Settings entered in the app are stored on the device and override build-time values.

## Supabase setup

Apply, in order:

1. `supabase/migrations/20261124000100_taw_schema.sql`
2. `supabase/seed_vehicles_sl.sql`
3. `supabase/golden-master/manifest.sql`
4. `supabase/golden-master/verify.sql`

Then set each company user's `app_metadata.company_id`. Admin users need `app_metadata.role = "ravsoft_admin"`.

## Licence verification

`poll_workshop_license(p_license_key text)` returns a JSON object with `valid`, `plan`, `status`, `expires_at`, `seats` and `message`. The app calls it from Settings. Insert active licence rows into `taw_licences` from the **portal admin** side only; they are never part of the golden master.

## Post-deploy checks

- `/manifest.webmanifest` and `/sw.js` return 200.
- `/track/:token` loads without requiring sign-in.
- Demo mode works with no environment variables.
- Cloud mode loads a workspace through `taw_get_workspace()`.
- `/track/:token` polls `taw_public_tracking()` and shows new GPS without sign-in.
- A small edit persists through `taw_save_workspace()` and reloads correctly.
- Driver automatic GPS publishes points without a manual coordinate form. Use the native wrapper for screen-off tracking.
- Settings licence check returns the expected portal status.
