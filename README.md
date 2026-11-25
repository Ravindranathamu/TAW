# TAW — Vehicle Carrier Management

TAW is a new, standalone RAVBsoft product line for vehicle-carrier and fleet-management companies. It is phone-first, installable as a PWA, and includes owner, driver and customer-tracking views.

This repository is the **golden copy first** deliverable: a clean local template with the full schema, a Sri Lanka vehicle-directory seed, verification SQL, docs and a working React application. **No live Supabase project has been provisioned** and no client data is included in the golden files.

## Stack

Matches the existing RAVBsoft developer model rather than the Next.js suggestion in the original product plan:

- React 19 + Vite + TypeScript
- Supabase JS (auth + workspace RPCs)
- React Router
- lucide-react, Leaflet, jsPDF, qrcode
- Capacitor + background-geolocation for the native driver wrapper
- Cloudflare Pages deployment (`npm run deploy`)
- RAVBsoft developer portal: <https://ravsoft-portal.pages.dev/developer>

## Run locally

```bash
npm install
cp .env.example .env   # optional; demo mode needs no credentials
npm run dev            # http://127.0.0.1:5180
```

Open `/login` for owners or `/driver-login` for drivers and choose the demo option, or sign in with the account issued by the company. Demo state is stored only in browser `localStorage`. No data leaves the device. Customers never log in — they open the public `/track/:token` link sent by TAW.

For cloud mode, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or set them in **Settings → Workspace connection**). The app loads the workspace through `taw_get_workspace()` and persists changes through `taw_save_workspace()`. Public tracking uses the token-scoped `taw_public_tracking()` RPC, which is granted to `anon`.

## What is included

- **Owner view:** owner-only sign-in, dashboard, smart dispatch, carrier fleet, driver/helper assignment, trip history, compliance renewals, vehicle directory, maintenance/warranties, fuel/mileage anomalies, invoices, finance/P&L, partner network, court cases, live map, settings.
- **Driver PWA:** separate driver sign-in, active trips, automatic GPS publishing, milestone updates, customer contact, tracking-link sharing, vehicle document checklist. There is no manual coordinate form.
- **Customer view:** public `/track/:token` link with no login, live map, status timeline, driver contact, ETA and QR code. It polls automatically for new positions.
- **WAHA WhatsApp:** send quotes, dispatch notices and live locations through WAHA; import a customer's WhatsApp location pin from a webhook payload or share link.
- **Fallback dispatch:** if no carrier fits, the order is passed to an active TAW partner with the app installed and the commission is retained. Trips are marked `SUBCONTRACTED`.
- **Pricing:** `(base + distance × km rate) × weight tier × road factor + highway tolls`, with discount and pass-through toll handling.
- **Compliance alerts:** 30/14/3-day lead times for insurance, revenue licence, fitness, emissions, finance, service intervals, tyres, battery warranty, driving licences and court dates.
- **IRD invoices:** `YYMMM_QQQQ_XXXXX` serials, 18% VAT on service charges, non-VAT toll pass-through, PDF via jsPDF, duplicates and WhatsApp delivery.
- **Partner sync:** TAW-to-TAW handover, external carriers, subcontracting, commission, margin and settlement tracking.
- **System-calculated km/L.** Owners never enter efficiency. TAW derives it from completed runs (odometer difference) and linked fuel records, with a full-tank fallback. No default 6.5 km/L assumption is used.
- **No AI lookup in the owner UI.** Dispatch shows only a search box with type-ahead suggestions; the directory is reference data maintained by the developer through golden-master updates.

## Screen-off GPS

Browser PWAs cannot guarantee location updates when the phone screen is off or the browser is suspended. The driver app therefore uses two modes:

- **Browser/PWA:** `navigator.geolocation.watchPosition` publishes live positions while the driver page is open.
- **Native TAW wrapper:** `startAutomaticGps()` registers `@capacitor-community/background-geolocation`, which keeps publishing with the screen off once the Android/iOS native projects are added.

The native wrapper must be generated and installed on the driver's phone for true screen-off tracking. See [docs/NATIVE_GPS.md](docs/NATIVE_GPS.md). No manual location entry exists by design.

## Golden copy

```text
supabase/
  migrations/20261124000100_taw_schema.sql
  seed_vehicles_sl.sql
  golden-master/
    manifest.sql
    verify.sql
docs/
  GOLDEN_MASTER.md
  DEPLOYMENT.md
  USER_GUIDE.md
AGENTS.md
```

Apply order on a fresh Supabase project:

1. `supabase/migrations/20261124000100_taw_schema.sql`
2. `supabase/seed_vehicles_sl.sql` (43 Sri Lankan vehicle models)
3. `supabase/golden-master/manifest.sql`
4. `supabase/golden-master/verify.sql` — must report **zero client data**

See [docs/GOLDEN_MASTER.md](docs/GOLDEN_MASTER.md) for the full procedure and update rules.

## Licensing and deployment

TAW follows the shared RAVBsoft order → provisioning → handover → trial → activation flow. The developer portal assigns a `TAW-LK-*` installation ID, registers it as a 30-day full-access trial, and activates it after payment. TAW-Carrier polls `poll_taw_license` outbound with that installation ID (legacy `TAW-*` keys still work), records the activation, and shows owner-only day-15 and one-time thank-you prompts. Licensing never provisions Supabase itself; portal admins use `app_metadata.role = "ravsoft_admin"`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server on port 5180 |
| `npm run build` | Type-check and production build into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript only |
| `npm run deploy` | Build and deploy `dist/` to Cloudflare Pages project `taw-carrier` |

## Source plan

Derived from the shared Google AI Mode plan: <https://share.google/aimode/r4JyobuyWFkiX6sun>. Stack decisions were deliberately changed to match the RAVBsoft Vite/React model, and the "AI vehicle lookup" feature was replaced by a developer-maintained catalog.
