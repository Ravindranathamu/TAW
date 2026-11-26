-- ============================================================================
-- TAW: owner-editable dispatch pricing rates
-- Additive only. The base schema is unchanged so existing golden hashes remain
-- valid; fresh installs apply this file in order after the base schema.
-- ============================================================================

alter table public.taw_companies
  add column if not exists base_fee numeric not null default 3500,
  add column if not exists per_km_rate numeric not null default 180;

-- The whole-workspace RPC predates these columns and intentionally leaves them
-- untouched. These two small RPCs read and write only the rate columns.
create or replace function public.taw_get_pricing_rates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text := public.taw_current_company_id();
  v_base_fee numeric;
  v_per_km_rate numeric;
begin
  select base_fee, per_km_rate into v_base_fee, v_per_km_rate
  from public.taw_companies
  where id = v_company_id;

  return jsonb_build_object(
    'baseFee', coalesce(v_base_fee, 3500),
    'perKmRate', coalesce(v_per_km_rate, 180)
  );
end;
$$;

create or replace function public.taw_save_pricing_rates(p_base_fee numeric, p_per_km_rate numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text := public.taw_current_company_id();
begin
  if v_company_id is null or v_company_id = '' then
    raise exception 'TAW: no company scope in session';
  end if;

  update public.taw_companies
  set base_fee = greatest(0, coalesce(p_base_fee, 3500)),
      per_km_rate = greatest(0, coalesce(p_per_km_rate, 180))
  where id = v_company_id;

  return found;
end;
$$;

grant execute on function public.taw_get_pricing_rates() to authenticated;
grant execute on function public.taw_save_pricing_rates(numeric, numeric) to authenticated;
