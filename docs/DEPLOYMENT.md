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

`poll_taw_license(p_license_key text)` returns a JSON object with `valid`, `product`, `plan`, `status`, `expires_at`, `seats` and `message`. The app calls it from Settings. It accepts only keys whose `product` is `TAW`; Torque ERP/ScanPlan keys are rejected. Insert active licence rows into `taw_licences` from the **portal admin** side only; they are never part of the golden master.

The master RAVBsoft developer portal also exposes the same `poll_taw_license` RPC against `developer_license_keys` where `product = 'TAW'`. Set `VITE_MASTER_LICENSE_URL` to the master portal project when TAW is managed centrally.

## Portal-managed deployment

The developer portal now treats TAW as its own product line:

- Register the carrier as software `TAW` with a `TAW-LK-XXXXXXXX` installation ID.
- Issue the licence from **Fleet → TAW licence keys**; the generated `TAW-YYYYMMDD-XXXXXXXX` key is stored in the master licence registry and accepted only by `poll_taw_license`.
- TAW has an independent release train (`0.1.0` in the golden master), so a Torque ERP deploy never changes a TAW installation.
- The portal's one-click Deploy action queues a product-scoped update run and posts the release payload to the client's deploy webhook. Set the webhook to a Cloudflare Pages/Netlify deploy hook for `taw-carrier`.
- Client data is never included in the golden master; additive migrations preserve each carrier's own Supabase project.

## Post-deploy checks

- `/manifest.webmanifest` and `/sw.js` return 200.
- `/track/:token` loads without requiring sign-in.
- Demo mode works with no environment variables.
- Cloud mode loads a workspace through `taw_get_workspace()`.
- `/track/:token` polls `taw_public_tracking()` and shows new GPS without sign-in.
- A small edit persists through `taw_save_workspace()` and reloads correctly.
- Driver automatic GPS publishes points without a manual coordinate form. Use the native wrapper for screen-off tracking.
- Settings licence check returns the expected portal status.
