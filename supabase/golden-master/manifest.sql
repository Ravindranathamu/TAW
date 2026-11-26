-- ============================================================================
-- TAW golden-master manifest
-- Run AFTER the schema migration and seed. Records the exact clean template.
-- SHA-256 values were generated from the files in this folder on 2026-11-24.
-- ============================================================================

create table if not exists public.taw_golden_file (
  path text primary key,
  sha256 text not null,
  purpose text not null default ''
);

alter table public.taw_golden_file enable row level security;
drop policy if exists taw_public_read on public.taw_golden_file;
create policy taw_public_read on public.taw_golden_file for select to anon, authenticated using (true);
grant select on public.taw_golden_file to anon, authenticated;

insert into public.taw_golden_file (path, sha256, purpose) values
  ('supabase/migrations/20261124000100_taw_schema.sql', '9928B01FB3DE9CD1986DC95EA4C3D04B9736EB4A51AE9540AB4E7F1761FA415B', 'Full clean TAW schema, RLS, trial/activation, clock guard, public tracking and workspace/licence RPCs'),
  ('supabase/migrations/20261126000300_taw_pricing_rates.sql', 'E07B83903256C95B7E94142AD1553E96D9C4DCD1F7507BC958645A8BF25C7961', 'Additive migration: owner-editable base fee and per-km rate with scoped read/write RPCs'),
  ('supabase/seed_vehicles_sl.sql', '7BDBA30C311CB62E88170EE0B67F6BA06D5582F36D275BD9023DD1BF8FFAFE73', '43-model Sri Lanka vehicle directory (reference data, not client data)'),
  ('supabase/golden-master/manifest.sql', 'MANAGED', 'This manifest'),
  ('supabase/golden-master/verify.sql', 'MANAGED', 'Zero-client-data verification'),
  ('src/types.ts', 'MANAGED', 'Canonical domain model mirrored by the schema'),
  ('src/lib/seed.ts', 'MANAGED', 'Local demo seed (must never be loaded into the golden master)')
on conflict (path) do update set sha256 = excluded.sha256, purpose = excluded.purpose;

insert into public.taw_golden_manifest (singleton, version, built_on, catalog_rows, client_tables, notes)
values (
  true,
  'taw-golden-0.1.0',
  '2026-11-24',
  43,
  array[
    'taw_companies','taw_vehicles','taw_staff','taw_court_cases','taw_service_rules',
    'taw_maintenance','taw_fuel_logs','taw_trips','taw_partners','taw_partner_jobs',
    'taw_invoices','taw_payroll','taw_expenses','taw_notifications','taw_licences'
  ],
  'Golden copy: full clean schema + Sri Lanka catalog reference seed. No vehicles, staff, trips, invoices, companies or licence keys are included.'
)
on conflict (singleton) do update set
  version = excluded.version,
  built_on = excluded.built_on,
  catalog_rows = excluded.catalog_rows,
  client_tables = excluded.client_tables,
  notes = excluded.notes;
