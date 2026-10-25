-- Simple campaign-wide OPTIONAL attunement capacity toggle.
-- Off by default. Enabled = three selected magic items per character.
-- This migration only stores configuration; it intentionally does NOT apply
-- caps to equipped inventory or change existing magic item effect consumers.
-- The future validated item selector must enforce this policy atomically.
begin;

alter table public.campaign_item_pool_settings
  add column if not exists attunement_enabled boolean not null default false;

alter table public.campaign_item_pool_settings
  add column if not exists attunement_max_items smallint not null default 3
    check (attunement_max_items = 3);

-- Existing row is never overwritten; other campaign settings are preserved.
insert into public.campaign_item_pool_settings(id)
values (1)
on conflict (id) do nothing;

-- Existing SELECT RLS lets authenticated players and the admin read the rule
-- later; only this authenticated-admin RPC is authorized to change it.
create or replace function public.set_campaign_attunement_rule_v1(
  p_enabled boolean
) returns table (
  enabled boolean,
  max_items smallint,
  selection_ready boolean,
  effects_enforced boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, private, auth
as $rule$
begin
  if p_enabled is null then
    raise exception 'Choose whether optional attunement is enabled'
      using errcode = '22023';
  end if;
  if auth.uid() is null or not coalesce(private.current_user_is_admin(),false) then
    raise exception 'Only an authenticated admin can change attunement settings'
      using errcode = '42501';
  end if;
  update public.campaign_item_pool_settings s
  set attunement_enabled=p_enabled,
      updated_at=timezone('utc',now()),
      updated_by=auth.uid()
  where s.id=1;
  if not found then
    raise exception 'Campaign settings row is missing'
      using errcode = 'P0002';
  end if;
  return query
  select s.attunement_enabled,s.attunement_max_items,
         false::boolean,false::boolean
  from public.campaign_item_pool_settings s where s.id=1;
end
$rule$;

revoke all on function public.set_campaign_attunement_rule_v1(boolean)
  from public, anon, authenticated;
grant execute on function public.set_campaign_attunement_rule_v1(boolean)
  to authenticated;

comment on function public.set_campaign_attunement_rule_v1(boolean) is
'Authenticated-admin only; stores OFF-by-default optional three-item limit. It does not yet enforce magic selections or modify gear/effects.';

commit;
