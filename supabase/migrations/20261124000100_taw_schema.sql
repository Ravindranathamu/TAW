-- ============================================================================
-- TAW — golden-master schema (zero client data)
-- Product line: TAW (RAVBsoft). Stack: Supabase Postgres.
-- Run this on a fresh Supabase project before loading seed_vehicles_sl.sql.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.taw_current_company_id()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', ''),
    auth.uid()::text
  );
$$;

create or replace function public.taw_is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'ravsoft_admin', false);
$$;

create or replace function public.taw_txt(v jsonb, k text, fallback text default '')
returns text
language sql
immutable
as $$
  select coalesce(v ->> k, fallback);
$$;

create or replace function public.taw_num(v jsonb, k text, fallback numeric default 0)
returns numeric
language sql
immutable
as $$
  select coalesce((v ->> k)::numeric, fallback);
$$;

create or replace function public.taw_int(v jsonb, k text, fallback integer default 0)
returns integer
language sql
immutable
as $$
  select coalesce((v ->> k)::integer, fallback);
$$;

create or replace function public.taw_bool(v jsonb, k text, fallback boolean default false)
returns boolean
language sql
immutable
as $$
  select coalesce((v ->> k)::boolean, fallback);
$$;

create or replace function public.taw_json(v jsonb, k text)
returns jsonb
language sql
immutable
as $$
  select coalesce(v -> k, '{}'::jsonb);
$$;

create or replace function public.taw_array(v jsonb, k text)
returns jsonb
language sql
immutable
as $$
  select coalesce(v -> k, '[]'::jsonb);
$$;

create or replace function public.taw_text_array(v jsonb, k text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    (select array_agg(e order by ord) from jsonb_array_elements_text(coalesce(v -> k, '[]'::jsonb)) with ordinality as t(e, ord)),
    '{}'::text[]
  );
$$;

create or replace function public.taw_int_array(v jsonb, k text)
returns integer[]
language sql
immutable
as $$
  select coalesce(
    (select array_agg(e::integer order by ord) from jsonb_array_elements_text(coalesce(v -> k, '[]'::jsonb)) with ordinality as t(e, ord)),
    '{}'::integer[]
  );
$$;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.taw_companies (
  id text primary key,
  name text not null,
  registered_name text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  tin text not null default '',
  vat_rate numeric not null default 18,
  vat_registered boolean not null default true,
  partner_code text not null default '',
  drive_root_folder_id text not null default '',
  alert_days integer[] not null default array[30, 14, 3],
  currency text not null default 'LKR',
  setup_complete boolean not null default false,
  created_at text not null default now()::text
);

create table if not exists public.taw_vehicle_catalog (
  company_id text not null default 'GLOBAL',
  id text not null,
  make text not null,
  model text not null,
  year_range text not null default '',
  body_type text not null default '',
  length_mm integer not null default 0,
  min_weight_kg integer not null default 0,
  max_weight_kg integer not null default 0,
  custom boolean not null default false,
  primary key (company_id, id)
);

create table if not exists public.taw_vehicles (
  id text primary key,
  company_id text not null,
  plate text not null default '',
  make text not null default '',
  model text not null default '',
  year integer not null default 0,
  chassis text not null default '',
  engine text not null default '',
  body_type text not null default '',
  colour text not null default '',
  max_payload_kg integer not null default 0,
  deck_length_mm integer not null default 0,
  status text not null default 'AVAILABLE',
  odometer_km numeric not null default 0,
  -- System-derived from completed runs + fuel logs; never owner-entered.
  efficiency_kmpl numeric not null default 0,
  compliance jsonb not null default '[]'::jsonb,
  finance jsonb,
  tyres jsonb not null default '[]'::jsonb,
  battery jsonb,
  note text not null default '',
  created_at text not null default now()::text
);

create table if not exists public.taw_staff (
  id text primary key,
  company_id text not null,
  name text not null default '',
  role text not null default 'PERMANENT_DRIVER',
  nic text not null default '',
  phone text not null default '',
  emergency_contact text not null default '',
  address text not null default '',
  license_number text not null default '',
  license_classes text[] not null default '{}',
  license_expiry text not null default '',
  license_held_by_police boolean not null default false,
  temporary_permit_until text,
  monthly_salary numeric,
  per_trip_wage numeric,
  batta_per_trip numeric,
  epf_eligible boolean not null default false,
  active boolean not null default true,
  note text not null default ''
);

create table if not exists public.taw_court_cases (
  id text primary key,
  company_id text not null,
  staff_id text,
  vehicle_id text,
  date text not null default '',
  court text not null default '',
  case_number text not null default '',
  description text not null default '',
  fine_amount numeric not null default 0,
  status text not null default 'PENDING'
);

create table if not exists public.taw_service_rules (
  id text primary key,
  company_id text not null,
  label text not null default '',
  interval_km integer not null default 0,
  last_done_km integer not null default 0,
  note text not null default ''
);

create table if not exists public.taw_maintenance (
  id text primary key,
  company_id text not null,
  vehicle_id text not null,
  date text not null default '',
  odometer_km numeric not null default 0,
  category text not null default 'OTHER',
  type text not null default 'REPAIR',
  description text not null default '',
  workshop text not null default '',
  labour_cost numeric not null default 0,
  parts jsonb not null default '[]'::jsonb,
  total_cost numeric not null default 0,
  next_due_km numeric
);

create table if not exists public.taw_fuel_logs (
  id text primary key,
  company_id text not null,
  vehicle_id text not null,
  trip_id text,
  staff_id text,
  date text not null default '',
  station text not null default '',
  odometer_km numeric not null default 0,
  litres numeric not null default 0,
  cost numeric not null default 0,
  full_tank boolean not null default true,
  receipt_url text not null default '',
  efficiency_kmpl numeric,
  anomaly boolean not null default false
);

create table if not exists public.taw_trips (
  id text primary key,
  company_id text not null,
  code text not null default '',
  enquiry_only boolean not null default false,
  status text not null default 'ENQUIRY',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_vehicle jsonb not null default '{}'::jsonb,
  route jsonb not null default '{}'::jsonb,
  vehicle_id text,
  support_vehicle_id text,
  staff_id text,
  support_staff_id text,
  helper_ids text[] not null default '{}',
  start_km numeric,
  end_km numeric,
  price jsonb not null default '{}'::jsonb,
  payment_status text not null default 'UNPAID',
  partner_job_id text,
  milestones jsonb not null default '[]'::jsonb,
  gps jsonb,
  tracking_token text not null default '',
  photos_folder_url text not null default '',
  note text not null default '',
  created_at text not null default now()::text,
  completed_at text
);

create table if not exists public.taw_partners (
  id text primary key,
  company_id text not null,
  company_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  truck_plate text not null default '',
  driver_phone text not null default '',
  agreed_rate numeric not null default 0,
  commission_pct numeric not null default 0,
  external boolean not null default true,
  taw_partner_id text not null default '',
  link_state text not null default 'PENDING'
);

create table if not exists public.taw_partner_jobs (
  id text primary key,
  company_id text not null,
  partner_id text not null,
  trip_id text not null,
  mode text not null default 'SUBCONTRACT',
  customer_price numeric not null default 0,
  partner_payout numeric not null default 0,
  commission numeric not null default 0,
  settled boolean not null default false,
  created_at text not null default now()::text
);

create table if not exists public.taw_invoices (
  id text primary key,
  company_id text not null,
  trip_id text not null,
  kind text not null default 'TAX_INVOICE',
  serial text not null default '',
  date text not null default now()::text,
  supply_date text not null default '',
  place_of_supply text not null default '',
  customer_name text not null default '',
  customer_tin text not null default '',
  customer_address text not null default '',
  customer_phone text not null default '',
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  payment_status text not null default 'UNPAID',
  copy_type text not null default 'ORIGINAL',
  drive_folder_url text not null default ''
);

create table if not exists public.taw_payroll (
  id text primary key,
  company_id text not null,
  staff_id text not null,
  month text not null,
  base numeric not null default 0,
  batta numeric not null default 0,
  deductions numeric not null default 0,
  net numeric not null default 0,
  paid boolean not null default false,
  paid_at text
);

create table if not exists public.taw_expenses (
  id text primary key,
  company_id text not null,
  date text not null default '',
  category text not null default '',
  vehicle_id text,
  amount numeric not null default 0,
  note text not null default ''
);

create table if not exists public.taw_notifications (
  id text primary key,
  company_id text not null,
  kind text not null default 'SYSTEM',
  severity text not null default 'OK',
  title text not null default '',
  detail text not null default '',
  due_date text not null default '',
  days_left integer not null default 0,
  link_to text not null default '',
  read boolean not null default false
);

create table if not exists public.taw_licences (
  license_key text primary key,
  company_id text not null default '',
  plan text not null default '',
  status text not null default '',
  expires_at text not null default '',
  seats integer not null default 0,
  active boolean not null default true,
  created_at text not null default now()::text
);

create table if not exists public.taw_golden_manifest (
  singleton boolean primary key default true check (singleton),
  version text not null,
  built_on text not null,
  catalog_rows integer not null default 0,
  client_tables text[] not null default '{}',
  notes text not null default ''
);

-- indexes
create index if not exists idx_taw_vehicles_company on public.taw_vehicles(company_id);
create index if not exists idx_taw_staff_company on public.taw_staff(company_id);
create index if not exists idx_taw_trips_company on public.taw_trips(company_id);
create index if not exists idx_taw_invoices_company on public.taw_invoices(company_id);
create index if not exists idx_taw_fuel_company on public.taw_fuel_logs(company_id);
create index if not exists idx_taw_maintenance_company on public.taw_maintenance(company_id);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  scoped text[] := array[
    'taw_vehicles','taw_staff','taw_court_cases','taw_service_rules','taw_maintenance',
    'taw_fuel_logs','taw_trips','taw_partners','taw_partner_jobs','taw_invoices',
    'taw_payroll','taw_expenses','taw_notifications'
  ];
  clause text;
begin
  foreach t in array scoped loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists taw_scope on public.%I', t);
    clause := 'company_id = public.taw_current_company_id() or public.taw_is_admin()';
    execute format('create policy taw_scope on public.%I for all to authenticated using (%s) with check (%s)', t, clause, clause);
  end loop;

  alter table public.taw_companies enable row level security;
  drop policy if exists taw_scope on public.taw_companies;
  create policy taw_scope on public.taw_companies for all to authenticated
    using (id = public.taw_current_company_id() or public.taw_is_admin())
    with check (id = public.taw_current_company_id() or public.taw_is_admin());

  alter table public.taw_vehicle_catalog enable row level security;
  drop policy if exists taw_read on public.taw_vehicle_catalog;
  create policy taw_read on public.taw_vehicle_catalog for select to authenticated, anon
    using (company_id = 'GLOBAL' or company_id = public.taw_current_company_id());
  drop policy if exists taw_write on public.taw_vehicle_catalog;
  create policy taw_write on public.taw_vehicle_catalog for all to authenticated
    using ((company_id = public.taw_current_company_id() and custom) or public.taw_is_admin())
    with check ((company_id = public.taw_current_company_id() and custom) or public.taw_is_admin());

  alter table public.taw_licences enable row level security;
  drop policy if exists taw_admin_only on public.taw_licences;
  create policy taw_admin_only on public.taw_licences for all to authenticated
    using (public.taw_is_admin()) with check (public.taw_is_admin());

  alter table public.taw_golden_manifest enable row level security;
  drop policy if exists taw_public_read on public.taw_golden_manifest;
  create policy taw_public_read on public.taw_golden_manifest for select to anon, authenticated using (true);
end $$;

-- ---------------------------------------------------------------------------
-- workspace RPCs — the app persists a whole company workspace per mutation
-- ---------------------------------------------------------------------------
create or replace function public.taw_get_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text := public.taw_current_company_id();
  v_state jsonb;
begin
  select jsonb_build_object(
    'company', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'registeredName', c.registered_name,
        'address', c.address,
        'phone', c.phone,
        'email', c.email,
        'tin', c.tin,
        'vatRate', c.vat_rate,
        'vatRegistered', c.vat_registered,
        'partnerCode', c.partner_code,
        'driveRootFolderId', c.drive_root_folder_id,
        'alertDays', c.alert_days,
        'currency', c.currency,
        'setupComplete', c.setup_complete,
        'createdAt', c.created_at
      ) from public.taw_companies c where c.id = v_company_id
    ),
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'make', x.make, 'model', x.model, 'yearRange', x.year_range,
        'bodyType', x.body_type, 'lengthMm', x.length_mm, 'minWeightKg', x.min_weight_kg,
        'maxWeightKg', x.max_weight_kg, 'custom', x.custom
      ) order by x.make, x.model)
      from public.taw_vehicle_catalog x
      where x.company_id = 'GLOBAL' or x.company_id = v_company_id
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select jsonb_agg(to_jsonb(v) - 'company_id' order by v.plate)
      from public.taw_vehicles v where v.company_id = v_company_id
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(to_jsonb(s) - 'company_id' order by s.name)
      from public.taw_staff s where s.company_id = v_company_id
    ), '[]'::jsonb),
    'courtCases', coalesce((
      select jsonb_agg(to_jsonb(c) - 'company_id' order by c.date)
      from public.taw_court_cases c where c.company_id = v_company_id
    ), '[]'::jsonb),
    'serviceRules', coalesce((
      select jsonb_agg(to_jsonb(r) - 'company_id' order by r.label)
      from public.taw_service_rules r where r.company_id = v_company_id
    ), '[]'::jsonb),
    'maintenance', coalesce((
      select jsonb_agg(to_jsonb(m) - 'company_id' order by m.date desc)
      from public.taw_maintenance m where m.company_id = v_company_id
    ), '[]'::jsonb),
    'fuelLogs', coalesce((
      select jsonb_agg(to_jsonb(f) - 'company_id' order by f.date desc)
      from public.taw_fuel_logs f where f.company_id = v_company_id
    ), '[]'::jsonb),
    'trips', coalesce((
      select jsonb_agg(to_jsonb(t) - 'company_id' order by t.created_at desc)
      from public.taw_trips t where t.company_id = v_company_id
    ), '[]'::jsonb),
    'partners', coalesce((
      select jsonb_agg(to_jsonb(p) - 'company_id' order by p.company_name)
      from public.taw_partners p where p.company_id = v_company_id
    ), '[]'::jsonb),
    'partnerJobs', coalesce((
      select jsonb_agg(to_jsonb(j) - 'company_id' order by j.created_at desc)
      from public.taw_partner_jobs j where j.company_id = v_company_id
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) - 'company_id' order by i.date desc)
      from public.taw_invoices i where i.company_id = v_company_id
    ), '[]'::jsonb),
    'payroll', coalesce((
      select jsonb_agg(to_jsonb(p) - 'company_id' order by p.month desc)
      from public.taw_payroll p where p.company_id = v_company_id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(e) - 'company_id' order by e.date desc)
      from public.taw_expenses e where e.company_id = v_company_id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) - 'company_id' order by n.days_left)
      from public.taw_notifications n where n.company_id = v_company_id
    ), '[]'::jsonb)
  ) into v_state;

  return v_state;
end;
$$;

-- Public customer link: no login, token-scoped, returns only tracking fields.
create or replace function public.taw_public_tracking(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.taw_trips%rowtype;
  v_company public.taw_companies%rowtype;
  v_staff public.taw_staff%rowtype;
  v_vehicle public.taw_vehicles%rowtype;
begin
  select * into v_trip from public.taw_trips where tracking_token = p_token limit 1;
  if not found or coalesce(p_token, '') = '' then
    return null;
  end if;

  select * into v_company from public.taw_companies where id = v_trip.company_id;
  if v_trip.staff_id is not null then
    select * into v_staff from public.taw_staff where id = v_trip.staff_id and company_id = v_trip.company_id;
  end if;
  if v_trip.vehicle_id is not null then
    select * into v_vehicle from public.taw_vehicles where id = v_trip.vehicle_id and company_id = v_trip.company_id;
  end if;

  return jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id, 'name', v_company.name, 'phone', v_company.phone,
      'email', v_company.email, 'address', v_company.address
    ),
    'trip', jsonb_build_object(
      'id', v_trip.id, 'code', v_trip.code, 'status', v_trip.status,
      'customerName', v_trip.customer_name, 'customerVehicle', v_trip.customer_vehicle,
      'route', v_trip.route, 'price', v_trip.price, 'gps', v_trip.gps,
      'milestones', v_trip.milestones, 'trackingToken', v_trip.tracking_token,
      'createdAt', v_trip.created_at, 'completedAt', v_trip.completed_at
    ),
    'driver', case when v_staff.id is null then null else jsonb_build_object(
      'id', v_staff.id, 'name', v_staff.name, 'phone', v_staff.phone, 'role', v_staff.role
    ) end,
    'vehicle', case when v_vehicle.id is null then null else jsonb_build_object(
      'id', v_vehicle.id, 'plate', v_vehicle.plate, 'make', v_vehicle.make, 'model', v_vehicle.model
    ) end
  );
end;
$$;

revoke all on function public.taw_public_tracking(text) from public;
grant execute on function public.taw_public_tracking(text) to anon, authenticated;

create or replace function public.taw_save_workspace(p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text := public.taw_current_company_id();
  c jsonb := coalesce(p_state -> 'company', '{}'::jsonb);
begin
  if v_company_id is null or v_company_id = '' then
    raise exception 'TAW: no company scope in session';
  end if;
  if coalesce(c ->> 'id', '') = '' then
    raise exception 'TAW: company id is required';
  end if;
  if c ->> 'id' <> v_company_id and not public.taw_is_admin() then
    raise exception 'TAW: company scope mismatch';
  end if;

  insert into public.taw_companies (
    id, name, registered_name, address, phone, email, tin, vat_rate, vat_registered,
    partner_code, drive_root_folder_id, alert_days, currency, setup_complete, created_at
  ) values (
    c ->> 'id', public.taw_txt(c, 'name'), public.taw_txt(c, 'registeredName'),
    public.taw_txt(c, 'address'), public.taw_txt(c, 'phone'), public.taw_txt(c, 'email'),
    public.taw_txt(c, 'tin'), public.taw_num(c, 'vatRate', 18), public.taw_bool(c, 'vatRegistered', true),
    public.taw_txt(c, 'partnerCode'), public.taw_txt(c, 'driveRootFolderId'),
    public.taw_int_array(c, 'alertDays'), public.taw_txt(c, 'currency', 'LKR'),
    public.taw_bool(c, 'setupComplete'), public.taw_txt(c, 'createdAt', now()::text)
  ) on conflict (id) do update set
    name = excluded.name, registered_name = excluded.registered_name, address = excluded.address,
    phone = excluded.phone, email = excluded.email, tin = excluded.tin, vat_rate = excluded.vat_rate,
    vat_registered = excluded.vat_registered, partner_code = excluded.partner_code,
    drive_root_folder_id = excluded.drive_root_folder_id, alert_days = excluded.alert_days,
    currency = excluded.currency, setup_complete = excluded.setup_complete, created_at = excluded.created_at;

  -- company-owned rows are replaced atomically with the submitted workspace
  delete from public.taw_vehicles where company_id = v_company_id;
  delete from public.taw_staff where company_id = v_company_id;
  delete from public.taw_court_cases where company_id = v_company_id;
  delete from public.taw_service_rules where company_id = v_company_id;
  delete from public.taw_maintenance where company_id = v_company_id;
  delete from public.taw_fuel_logs where company_id = v_company_id;
  delete from public.taw_trips where company_id = v_company_id;
  delete from public.taw_partners where company_id = v_company_id;
  delete from public.taw_partner_jobs where company_id = v_company_id;
  delete from public.taw_invoices where company_id = v_company_id;
  delete from public.taw_payroll where company_id = v_company_id;
  delete from public.taw_expenses where company_id = v_company_id;
  delete from public.taw_notifications where company_id = v_company_id;
  delete from public.taw_vehicle_catalog where company_id = v_company_id;

  insert into public.taw_vehicle_catalog (company_id, id, make, model, year_range, body_type, length_mm, min_weight_kg, max_weight_kg, custom)
  select v_company_id, public.taw_txt(x, 'id'), public.taw_txt(x, 'make'), public.taw_txt(x, 'model'),
         public.taw_txt(x, 'yearRange'), public.taw_txt(x, 'bodyType'), public.taw_int(x, 'lengthMm'),
         public.taw_int(x, 'minWeightKg'), public.taw_int(x, 'maxWeightKg'), true
  from jsonb_array_elements(public.taw_array(p_state, 'catalog')) as t(x)
  where public.taw_bool(x, 'custom') and public.taw_txt(x, 'id') <> '';

  insert into public.taw_vehicles (
    id, company_id, plate, make, model, year, chassis, engine, body_type, colour,
    max_payload_kg, deck_length_mm, status, odometer_km, efficiency_kmpl,
    compliance, finance, tyres, battery, note, created_at
  )
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'plate'), public.taw_txt(x,'make'),
    public.taw_txt(x,'model'), public.taw_int(x,'year'), public.taw_txt(x,'chassis'), public.taw_txt(x,'engine'),
    public.taw_txt(x,'bodyType'), public.taw_txt(x,'colour'), public.taw_int(x,'maxPayloadKg'),
    public.taw_int(x,'deckLengthMm'), public.taw_txt(x,'status','AVAILABLE'), public.taw_num(x,'odometerKm'),
    public.taw_num(x,'efficiencyKmpl'), public.taw_array(x,'compliance'),
    case when x -> 'finance' is null then null else x -> 'finance' end,
    public.taw_array(x,'tyres'),
    case when x -> 'battery' is null then null else x -> 'battery' end,
    public.taw_txt(x,'note'), public.taw_txt(x,'createdAt', now()::text)
  from jsonb_array_elements(public.taw_array(p_state, 'vehicles')) as t(x);

  insert into public.taw_staff (
    id, company_id, name, role, nic, phone, emergency_contact, address, license_number,
    license_classes, license_expiry, license_held_by_police, temporary_permit_until,
    monthly_salary, per_trip_wage, batta_per_trip, epf_eligible, active, note
  )
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'name'), public.taw_txt(x,'role'),
    public.taw_txt(x,'nic'), public.taw_txt(x,'phone'), public.taw_txt(x,'emergencyContact'),
    public.taw_txt(x,'address'), public.taw_txt(x,'licenseNumber'), public.taw_text_array(x,'licenseClasses'),
    public.taw_txt(x,'licenseExpiry'), public.taw_bool(x,'licenseHeldByPolice'),
    nullif(public.taw_txt(x,'temporaryPermitUntil'), '')::text,
    (x ->> 'monthlySalary')::numeric, (x ->> 'perTripWage')::numeric, (x ->> 'battaPerTrip')::numeric,
    public.taw_bool(x,'epfEligible'), public.taw_bool(x,'active', true), public.taw_txt(x,'note')
  from jsonb_array_elements(public.taw_array(p_state, 'staff')) as t(x);

  insert into public.taw_court_cases (id, company_id, staff_id, vehicle_id, date, court, case_number, description, fine_amount, status)
  select public.taw_txt(x,'id'), v_company_id, nullif(public.taw_txt(x,'staffId'),''), nullif(public.taw_txt(x,'vehicleId'),''),
    public.taw_txt(x,'date'), public.taw_txt(x,'court'), public.taw_txt(x,'caseNumber'),
    public.taw_txt(x,'description'), public.taw_num(x,'fineAmount'), public.taw_txt(x,'status','PENDING')
  from jsonb_array_elements(public.taw_array(p_state, 'courtCases')) as t(x);

  insert into public.taw_service_rules (id, company_id, label, interval_km, last_done_km, note)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'label'), public.taw_int(x,'intervalKm'),
    public.taw_int(x,'lastDoneKm'), public.taw_txt(x,'note')
  from jsonb_array_elements(public.taw_array(p_state, 'serviceRules')) as t(x);

  insert into public.taw_maintenance (id, company_id, vehicle_id, date, odometer_km, category, type, description, workshop, labour_cost, parts, total_cost, next_due_km)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'vehicleId'), public.taw_txt(x,'date'),
    public.taw_num(x,'odometerKm'), public.taw_txt(x,'category','OTHER'), public.taw_txt(x,'type','REPAIR'),
    public.taw_txt(x,'description'), public.taw_txt(x,'workshop'), public.taw_num(x,'labourCost'),
    public.taw_array(x,'parts'), public.taw_num(x,'totalCost'), (x ->> 'nextDueKm')::numeric
  from jsonb_array_elements(public.taw_array(p_state, 'maintenance')) as t(x);

  insert into public.taw_fuel_logs (id, company_id, vehicle_id, trip_id, staff_id, date, station, odometer_km, litres, cost, full_tank, receipt_url, efficiency_kmpl, anomaly)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'vehicleId'), nullif(public.taw_txt(x,'tripId'),''),
    nullif(public.taw_txt(x,'staffId'),''), public.taw_txt(x,'date'), public.taw_txt(x,'station'),
    public.taw_num(x,'odometerKm'), public.taw_num(x,'litres'), public.taw_num(x,'cost'),
    public.taw_bool(x,'fullTank', true), public.taw_txt(x,'receiptUrl'), (x ->> 'efficiencyKmpl')::numeric,
    public.taw_bool(x,'anomaly')
  from jsonb_array_elements(public.taw_array(p_state, 'fuelLogs')) as t(x);

  insert into public.taw_trips (
    id, company_id, code, enquiry_only, status, customer_name, customer_phone, customer_vehicle,
    route, vehicle_id, support_vehicle_id, staff_id, support_staff_id, helper_ids, start_km, end_km,
    price, payment_status, partner_job_id, milestones, gps, tracking_token, photos_folder_url,
    note, created_at, completed_at
  )
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'code'), public.taw_bool(x,'enquiryOnly'),
    public.taw_txt(x,'status','ENQUIRY'), public.taw_txt(x,'customerName'), public.taw_txt(x,'customerPhone'),
    public.taw_json(x,'customerVehicle'), public.taw_json(x,'route'),
    nullif(public.taw_txt(x,'vehicleId'),''), nullif(public.taw_txt(x,'supportVehicleId'),''),
    nullif(public.taw_txt(x,'staffId'),''), nullif(public.taw_txt(x,'supportStaffId'),''),
    public.taw_text_array(x,'helperIds'), (x ->> 'startKm')::numeric, (x ->> 'endKm')::numeric,
    public.taw_json(x,'price'), public.taw_txt(x,'paymentStatus','UNPAID'), nullif(public.taw_txt(x,'partnerJobId'),''),
    public.taw_array(x,'milestones'), case when x -> 'gps' is null then null else x -> 'gps' end,
    public.taw_txt(x,'trackingToken'), public.taw_txt(x,'photosFolderUrl'), public.taw_txt(x,'note'),
    public.taw_txt(x,'createdAt', now()::text), nullif(public.taw_txt(x,'completedAt'),'')
  from jsonb_array_elements(public.taw_array(p_state, 'trips')) as t(x);

  insert into public.taw_partners (id, company_id, company_name, contact_name, phone, truck_plate, driver_phone, agreed_rate, commission_pct, external, taw_partner_id, link_state)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'companyName'), public.taw_txt(x,'contactName'),
    public.taw_txt(x,'phone'), public.taw_txt(x,'truckPlate'), public.taw_txt(x,'driverPhone'),
    public.taw_num(x,'agreedRate'), public.taw_num(x,'commissionPct'), public.taw_bool(x,'external', true),
    public.taw_txt(x,'tawPartnerId'), public.taw_txt(x,'linkState','PENDING')
  from jsonb_array_elements(public.taw_array(p_state, 'partners')) as t(x);

  insert into public.taw_partner_jobs (id, company_id, partner_id, trip_id, mode, customer_price, partner_payout, commission, settled, created_at)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'partnerId'), public.taw_txt(x,'tripId'),
    public.taw_txt(x,'mode','SUBCONTRACT'), public.taw_num(x,'customerPrice'), public.taw_num(x,'partnerPayout'),
    public.taw_num(x,'commission'), public.taw_bool(x,'settled'), public.taw_txt(x,'createdAt', now()::text)
  from jsonb_array_elements(public.taw_array(p_state, 'partnerJobs')) as t(x);

  insert into public.taw_invoices (
    id, company_id, trip_id, kind, serial, date, supply_date, place_of_supply, customer_name,
    customer_tin, customer_address, customer_phone, lines, subtotal, vat_amount, total,
    payment_status, copy_type, drive_folder_url
  )
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'tripId'), public.taw_txt(x,'kind','TAX_INVOICE'),
    public.taw_txt(x,'serial'), public.taw_txt(x,'date', now()::text), public.taw_txt(x,'supplyDate'),
    public.taw_txt(x,'placeOfSupply'), public.taw_txt(x,'customerName'), public.taw_txt(x,'customerTin'),
    public.taw_txt(x,'customerAddress'), public.taw_txt(x,'customerPhone'), public.taw_array(x,'lines'),
    public.taw_num(x,'subtotal'), public.taw_num(x,'vatAmount'), public.taw_num(x,'total'),
    public.taw_txt(x,'paymentStatus','UNPAID'), public.taw_txt(x,'copyType','ORIGINAL'), public.taw_txt(x,'driveFolderUrl')
  from jsonb_array_elements(public.taw_array(p_state, 'invoices')) as t(x);

  insert into public.taw_payroll (id, company_id, staff_id, month, base, batta, deductions, net, paid, paid_at)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'staffId'), public.taw_txt(x,'month'),
    public.taw_num(x,'base'), public.taw_num(x,'batta'), public.taw_num(x,'deductions'), public.taw_num(x,'net'),
    public.taw_bool(x,'paid'), nullif(public.taw_txt(x,'paidAt'),'')
  from jsonb_array_elements(public.taw_array(p_state, 'payroll')) as t(x);

  insert into public.taw_expenses (id, company_id, date, category, vehicle_id, amount, note)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'date'), public.taw_txt(x,'category'),
    nullif(public.taw_txt(x,'vehicleId'),''), public.taw_num(x,'amount'), public.taw_txt(x,'note')
  from jsonb_array_elements(public.taw_array(p_state, 'expenses')) as t(x);

  insert into public.taw_notifications (id, company_id, kind, severity, title, detail, due_date, days_left, link_to, read)
  select public.taw_txt(x,'id'), v_company_id, public.taw_txt(x,'kind','SYSTEM'), public.taw_txt(x,'severity','OK'),
    public.taw_txt(x,'title'), public.taw_txt(x,'detail'), public.taw_txt(x,'dueDate'), public.taw_int(x,'daysLeft'),
    public.taw_txt(x,'linkTo'), public.taw_bool(x,'read')
  from jsonb_array_elements(public.taw_array(p_state, 'notifications')) as t(x);

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- developer-portal licence poll (used by the app's Settings page)
-- ---------------------------------------------------------------------------
create or replace function public.poll_workshop_license(p_license_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.taw_licences%rowtype;
begin
  select * into r
  from public.taw_licences
  where upper(license_key) = upper(coalesce(p_license_key, ''))
  limit 1;

  if not found then
    return jsonb_build_object(
      'valid', false, 'plan', '', 'status', 'NOT_FOUND', 'expires_at', '',
      'seats', 0, 'message', 'Licence key was not found in the RAVBsoft portal.'
    );
  end if;

  if not r.active or r.status <> 'ACTIVE' then
    return jsonb_build_object(
      'valid', false, 'plan', r.plan, 'status', r.status, 'expires_at', r.expires_at,
      'seats', r.seats, 'message', 'This licence is not active.'
    );
  end if;

  if r.expires_at <> '' and r.expires_at < now()::text then
    return jsonb_build_object(
      'valid', false, 'plan', r.plan, 'status', 'EXPIRED', 'expires_at', r.expires_at,
      'seats', r.seats, 'message', 'This licence has expired.'
    );
  end if;

  return jsonb_build_object(
    'valid', true, 'plan', r.plan, 'status', r.status, 'expires_at', r.expires_at,
    'seats', r.seats, 'message', 'TAW licence is active.'
  );
end;
$$;

grant execute on function public.taw_get_workspace() to authenticated;
grant execute on function public.taw_save_workspace(jsonb) to authenticated;
grant execute on function public.poll_workshop_license(text) to anon, authenticated;
grant select on public.taw_vehicle_catalog to anon, authenticated;
grant select on public.taw_golden_manifest to anon, authenticated;

-- Client tables are intentionally empty in the golden copy.
-- Reference (non-client) catalog rows are loaded by seed_vehicles_sl.sql.
