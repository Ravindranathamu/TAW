# Agent notes — TAW-Carrier

## Product identity

- This project is **TAW**, a separate RAVBsoft product line for vehicle carriers.
- It is **not** the earlier TAW licence/deployment console in `../TAW`. Do not overwrite that project.
- Licensing, releases and deployment are managed through the RAVBsoft developer portal at <https://ravsoft-portal.pages.dev/developer>.
- Portal admins are identified by Supabase JWT `app_metadata.role = "ravsoft_admin"`.

## Non-negotiable rules

1. **Golden copy stays clean.** Never put client vehicles, staff, trips, invoices, companies or licence keys in `supabase/migrations/`, `supabase/seed_vehicles_sl.sql`, `supabase/golden-master/` or docs. Demo data belongs only in `src/lib/seed.ts` and browser storage.
2. **No live Supabase provisioning.** No credentials were supplied. Local golden-master files are the deliverable.
3. **No AI lookup in the owner UI.** The Sri Lankan vehicle directory is reference data, maintained by the developer and seeded from `seed_vehicles_sl.sql`.
4. **Match RAVBsoft stack.** React 19 + Vite + TypeScript + Supabase + lucide-react + React Router. Do not introduce Next.js.
5. **Phone-first.** All owner pages must work in a ~520 px shell with bottom navigation; driver and customer tracking views are mobile-first.
6. **Role by login only.** Owners use `/login`, drivers use `/driver-login`, customers use the public `/track/:token` link. Never add a role selector.
7. **Efficiency is system-derived.** `efficiencyKmpl` must be calculated from completed runs and fuel logs, never entered by an owner and never defaulted.
8. **Driver GPS is automatic.** No manual coordinate form. Browser `watchPosition` is the fallback; the native Capacitor wrapper provides screen-off tracking.
9. **Pricing formula is canonical:** `((base + km × perKm) × weightTier × roadFactor) + highwayTolls`. Tolls are pass-through and excluded from VAT.
10. **IRD serial format:** `YYMMM_QQQQ_XXXXX`, e.g. `26NOV_TAW_00042`.

## Layout of the code

- `src/types.ts` — canonical domain model; schema mirrors it.
- `src/lib/pricing.ts` — quote engine, toll and route estimates, P&L helpers.
- `src/lib/matching.ts` — carrier fit/compliance and driver eligibility.
- `src/lib/invoice.ts` — IRD serials, invoice lines, PDF generation, WhatsApp helpers.
- `src/lib/seed.ts` — **local demo only**; never imported by golden-master SQL.
- `src/lib/cloud.ts` — Supabase client, workspace RPC calls, portal licence check, device id.
- `src/state/TawStore.tsx` — all UI state and mutations; demo persistence and cloud push/pull.
- `src/components/Layout.tsx` — owner-only mobile shell, bottom nav, More grid.
- `src/lib/efficiency.ts` — system km/L from completed runs + fuel records.
- `src/lib/location.ts` — automatic GPS watcher; native background plugin with browser fallback.
- `src/lib/waha.ts` — WAHA send/import helpers and webhook parsing.
- `src/pages/` — one file per module.
- `supabase/` — golden-master schema, reference seed, manifest and verification.

## Before changing the golden schema

- Update `src/types.ts` and the SQL columns/RPC mapping together.
- Regenerate the SHA-256 entries in `supabase/golden-master/manifest.sql` after editing `20261124000100_taw_schema.sql`, `20261126000300_taw_pricing_rates.sql` or `seed_vehicles_sl.sql`.
- Re-run `supabase/golden-master/verify.sql` on a fresh database; it must pass with zero client data.
- Run `npm run build` before finishing any UI change.

## Verification commands

```bash
npm run typecheck
npm run build
npm run dev   # port 5180
```

Browser smoke path: owner login → dashboard → dispatch autocomplete/map pins/partner fallback → fleet/fuel → trips/invoice → settings/WAHA; driver login → active trip automatic GPS; public `/track/:token`.
