-- ============================================================================
-- TAW golden-master verification
-- Run on a fresh Supabase project AFTER schema + seed + manifest.
-- Pass condition: every client table is empty, reference catalog has 43 rows,
-- RLS is enabled, and the workspace/licence RPCs exist.
-- ============================================================================

\echo '== TAW GOLDEN MASTER VERIFICATION =='

select m.version, m.built_on, m.catalog_rows, array_length(m.client_tables, 1) as client_table_count, m.notes
from public.taw_golden_manifest m;

with counts as (
  select 'taw_companies' as tbl, count(*) as n from public.taw_companies
  union all select 'taw_vehicles', count(*) from public.taw_vehicles
  union all select 'taw_staff', count(*) from public.taw_staff
  union all select 'taw_court_cases', count(*) from public.taw_court_cases
  union all select 'taw_service_rules', count(*) from public.taw_service_rules
  union all select 'taw_maintenance', count(*) from public.taw_maintenance
  union all select 'taw_fuel_logs', count(*) from public.taw_fuel_logs
  union all select 'taw_trips', count(*) from public.taw_trips
  union all select 'taw_partners', count(*) from public.taw_partners
  union all select 'taw_partner_jobs', count(*) from public.taw_partner_jobs
  union all select 'taw_invoices', count(*) from public.taw_invoices
  union all select 'taw_payroll', count(*) from public.taw_payroll
  union all select 'taw_expenses', count(*) from public.taw_expenses
  union all select 'taw_notifications', count(*) from public.taw_notifications
  union all select 'taw_licences', count(*) from public.taw_licences
)
select tbl, n, case when n = 0 then 'PASS' else 'FAIL — CLIENT DATA PRESENT' end as result from counts order by tbl;

select count(*) as reference_catalog_rows,
       case when count(*) = 43 then 'PASS' else 'FAIL — expected 43' end as result
from public.taw_vehicle_catalog where company_id = 'GLOBAL' and custom = false;

select count(*) as custom_catalog_rows,
       case when count(*) = 0 then 'PASS' else 'FAIL — client catalog rows present' end as result
from public.taw_vehicle_catalog where company_id <> 'GLOBAL';

select schemaname, tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public' and tablename like 'taw_%'
order by tablename;

select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('taw_get_workspace','taw_save_workspace','taw_public_tracking','poll_taw_license')
order by p.proname;

do $$
declare
  bad text[] := '{}'::text[];
  r record;
begin
  for r in
    select 'taw_companies' as tbl, count(*) as n from public.taw_companies
    union all select 'taw_vehicles', count(*) from public.taw_vehicles
    union all select 'taw_staff', count(*) from public.taw_staff
    union all select 'taw_court_cases', count(*) from public.taw_court_cases
    union all select 'taw_service_rules', count(*) from public.taw_service_rules
    union all select 'taw_maintenance', count(*) from public.taw_maintenance
    union all select 'taw_fuel_logs', count(*) from public.taw_fuel_logs
    union all select 'taw_trips', count(*) from public.taw_trips
    union all select 'taw_partners', count(*) from public.taw_partners
    union all select 'taw_partner_jobs', count(*) from public.taw_partner_jobs
    union all select 'taw_invoices', count(*) from public.taw_invoices
    union all select 'taw_payroll', count(*) from public.taw_payroll
    union all select 'taw_expenses', count(*) from public.taw_expenses
    union all select 'taw_notifications', count(*) from public.taw_notifications
    union all select 'taw_licences', count(*) from public.taw_licences
  loop
    if r.n > 0 then bad := array_append(bad, format('%s=%s', r.tbl, r.n)); end if;
  end loop;

  if (select count(*) from public.taw_vehicle_catalog where company_id = 'GLOBAL' and custom = false) <> 43 then
    bad := array_append(bad, 'catalog<>43');
  end if;
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename like 'taw_%' and rowsecurity = false
      and tablename not in ('taw_golden_manifest', 'taw_golden_file')
  ) then
    bad := array_append(bad, 'rls-missing');
  end if;

  if (select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('taw_get_workspace','taw_save_workspace','taw_public_tracking','poll_taw_license')
    ) <> 4 then
    bad := array_append(bad, 'rpcs-missing');
  end if;

  if coalesce(array_length(bad, 1), 0) > 0 then
    raise exception 'TAW golden master verification FAILED: %', array_to_string(bad, ', ');
  end if;

  raise notice 'TAW golden master verification PASSED — zero client data, 43 reference models.';
end $$;
