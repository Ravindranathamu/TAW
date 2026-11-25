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

These values are applied by the initial deployment and are build-time only. The app never asks the owner to enter them; **Settings → Workspace connection** shows read-only connection status. Local demo mode needs none of these variables.

## Supabase setup

Apply, in order:

1. `supabase/migrations/20261124000100_taw_schema.sql`
2. `supabase/seed_vehicles_sl.sql`
3. `supabase/golden-master/manifest.sql`
4. `supabase/golden-master/verify.sql`

Then set each company user's `app_metadata.company_id`. Admin users need `app_metadata.role = "ravsoft_admin"`.

## Licence verification

TAW uses the shared RAVBsoft order pipeline. The developer shares the portal's public `/start` link; the client selects TAW and a plan, and the portal assigns a `TAW-LK-XXXXXXXX` installation ID during provisioning. The installation starts as `Trial` (30 days, every feature unlocked) and becomes `Active` after payment.

`poll_taw_license(p_license_key text)` returns `valid`, `product`, `plan`, `status`, `expires_at`, `seats`, `installation_id`, `holder`, `server_time` and `message`. Despite the legacy parameter name, the new portal migration resolves either:

1. a `TAW-LK-*` installation ID (preferred) from `developer_client_installations`, returning `Trial` or `Active`; or
2. an older `TAW-YYYYMMDD-XXXXXXXX` key from `developer_license_keys` as a compatibility fallback.

Only TAW product rows are accepted. Installations that are `Expired` or `Suspended` lock the app without touching data. A successful check starts a 7-day offline grace window; a backwards device clock forces a fresh online check before access continues. Settings → Licence shows the installation ID, plan, trial days or paid expiry, the last successful portal check and remaining offline grace. The owner gets a daily activation prompt from day 15 of the trial (24-hour snooze) and a one-time thank-you after activation. TAW polls the portal every six hours while signed in. The local `taw_licences` table remains a clean admin-only compatibility table and is never part of client data.

Set `VITE_MASTER_LICENSE_URL` and `VITE_MASTER_LICENSE_ANON_KEY` to the master portal project. The poll is outbound-only; TAW exposes no inbound licence endpoint.

## Portal-managed deployment

The developer portal treats TAW as its own product line:

- The client order is received on the portal's **Orders** tab, then reviewed, provisioned, deployed and handed over with the app link, installation ID and initial owner login.
- **Register installation** creates `developer_client_installations` with the same `TAW-LK-*` ID and status `Trial`.
- **Activate** switches that installation to `Active`, writes the paid expiry and records a payment. TAW activation unlocks every feature.
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
