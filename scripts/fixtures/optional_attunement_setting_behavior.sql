\set ON_ERROR_STOP on
create role authenticated;
create role anon;
create role service_role;
create schema if not exists auth;
create schema if not exists private;

create table public.user_profiles(id uuid primary key,role text not null);
create or replace function auth.uid() returns uuid language sql stable as $f$
 select nullif(current_setting('fixture.uid',true),'')::uuid
$f$;
create or replace function private.current_user_is_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth as $f$
 select auth.uid() is not null and exists(
   select 1 from public.user_profiles up
   where up.id=auth.uid() and up.role='admin')
$f$;

create table public.campaign_item_pool_settings (
 id smallint primary key default 1 check(id=1),
 future_tech_enabled boolean not null default false,
 updated_at timestamptz not null default timezone('utc',now()),
 updated_by uuid
);
insert into public.campaign_item_pool_settings
(id,future_tech_enabled) values(1,true);
alter table public.campaign_item_pool_settings enable row level security;
create policy campaign_item_pool_settings_read on public.campaign_item_pool_settings
 for select to authenticated using(true);
grant select on public.campaign_item_pool_settings to authenticated;
insert into public.user_profiles values
 ('aaaaaaaa-0000-4000-8000-000000000001','admin'),
 ('aaaaaaaa-0000-4000-8000-000000000002','player');

\i sql/20261025_01_optional_campaign_attunement_setting.sql

do $tests$
declare
 settings record;
 outcome record;
 denied boolean;
begin
 select * into settings from public.campaign_item_pool_settings where id=1;
 if settings.attunement_enabled is distinct from false or settings.attunement_max_items<>3
    or settings.future_tech_enabled is distinct from true
 then raise exception 'OFF default or existing campaign setting changed: %',to_jsonb(settings); end if;
 if has_function_privilege('anon','public.set_campaign_attunement_rule_v1(boolean)','EXECUTE')
    or not has_function_privilege('authenticated','public.set_campaign_attunement_rule_v1(boolean)','EXECUTE')
    or has_table_privilege('authenticated','public.campaign_item_pool_settings','UPDATE')
 then raise exception 'Setting writable by untrusted role or not callable by authenticated admin'; end if;
 perform set_config('fixture.uid','',true);
 denied:=false;
 begin
  perform public.set_campaign_attunement_rule_v1(true);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous call toggled attunement'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 denied:=false;
 begin
  perform public.set_campaign_attunement_rule_v1(true);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Player toggled attunement'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 denied:=false;
 begin
  perform public.set_campaign_attunement_rule_v1(null);
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Null rule input was silently accepted'; end if;
 select * into outcome from public.set_campaign_attunement_rule_v1(true);
 if outcome.enabled is distinct from true or outcome.max_items<>3
    or outcome.selection_ready or outcome.effects_enforced
 then raise exception 'ON result falsely claimed magic enforcement: %',to_jsonb(outcome); end if;
 select * into settings from public.campaign_item_pool_settings where id=1;
 if not settings.attunement_enabled or not settings.future_tech_enabled
    or settings.updated_by<>'aaaaaaaa-0000-4000-8000-000000000001'
 then raise exception 'Admin setting damaged existing campaign item-pool state: %',to_jsonb(settings); end if;
 select * into outcome from public.set_campaign_attunement_rule_v1(false);
 if outcome.enabled is distinct from false or outcome.max_items<>3
 then raise exception 'Admin could not turn OFF optional attunement: %',to_jsonb(outcome); end if;
 select * into outcome from public.set_campaign_attunement_rule_v1(false);
 if outcome.enabled is distinct from false then raise exception 'OFF replay failed'; end if;
end $tests$;

select 'Optional attunement OFF default, three-item config, admin-only ACL, future-tech independence passed' result;
