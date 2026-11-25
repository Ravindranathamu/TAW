# TAW golden master

The golden master is a **clean template**, not a production database dump. It contains the full schema, RLS, RPCs, a reference vehicle catalog and verification SQL. It contains **zero client data**.

## Files

| File | Role |
| --- | --- |
| `supabase/migrations/20261124000100_taw_schema.sql` | All TAW tables, RLS policies, `taw_get_workspace`, `taw_save_workspace`, `taw_public_tracking`, `poll_taw_license` |
| `supabase/seed_vehicles_sl.sql` | 43 Sri Lankan vehicle models used by dispatch auto-spec lookup |
| `supabase/golden-master/manifest.sql` | Version, checksums and expected table list |
| `supabase/golden-master/verify.sql` | Fails if any client table has rows |

## Apply to a fresh Supabase project

```sql
-- 1. schema
\i supabase/migrations/20261124000100_taw_schema.sql
-- 2. reference catalog only
\i supabase/seed_vehicles_sl.sql
-- 3. manifest
\i supabase/golden-master/manifest.sql
-- 4. verification
\i supabase/golden-master/verify.sql
```

Expected verification result:

- All 15 client tables report `PASS` with `n = 0`.
- `reference_catalog_rows = 43` → `PASS`.
- `custom_catalog_rows = 0` → `PASS`.
- RLS is enabled on every `taw_%` table except the two public manifest tables.
- `taw_get_workspace`, `taw_save_workspace`, `taw_public_tracking` and `poll_taw_license` exist as security-definer functions.
- `efficiency_kmpl` columns hold system-derived values only. No owner-entered km/L exists in the schema or UI.
- Final notice: `TAW golden master verification PASSED — zero client data, 43 reference models.`

## What is deliberately excluded

Never add these to the golden master:

- Company records (`taw_companies`)
- Carrier trucks (`taw_vehicles`)
- Drivers/helpers (`taw_staff`)
- Trips, invoices, payroll, expenses or notifications
- Court cases, maintenance or fuel logs
- Partners, partner jobs or licence keys
- Custom catalog rows (`company_id <> 'GLOBAL'`)

Local demo seed data lives only in `src/lib/seed.ts` and is persisted in the browser's `localStorage` under `taw_state_v1_*`.

## Updating the catalog

1. Add the model to `catalogRows` in `src/lib/seed.ts`.
2. Add the matching row to `supabase/seed_vehicles_sl.sql`.
3. Increment `catalog_rows` and `version` in `supabase/golden-master/manifest.sql`.
4. Recompute SHA-256:

```powershell
Get-FileHash -Algorithm SHA256 `
  'supabase\migrations\20261124000100_taw_schema.sql',`
  'supabase\seed_vehicles_sl.sql' | Select-Object Path,Hash
```

5. Paste the hashes into `manifest.sql` and re-run verification on a fresh database.

## New client installation flow

1. Developer portal creates/authorises the Supabase project and issues a TAW licence key.
2. Apply the four golden-master files above.
3. Set `app_metadata.company_id` on each company user; the RPCs use it to scope all rows.
4. Bake the Supabase URL/anon key and licence RPC values into the deployed build; give the user only the app URL, installation ID and initial login.
5. User signs in; TAW creates the company row on first workspace save.
6. Portal licence status is polled by installation ID from **Settings → Developer-portal licence**.

The app never creates or provisions Supabase projects. That remains a developer-portal operation.
