-- Tighten Replicate Magic Item wildcard eligibility so rarity alone cannot admit
-- campaign reagents, recipes, or other non-magic catalogue rows.
create or replace function private.artificer_plan_item_is_eligible_v1(
  p_option_catalog_id uuid,
  p_item_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_option public.class_feature_option_catalog%rowtype;
  v_item public.items_catalog%rowtype;
  v_schema jsonb;
  v_type text;
  v_rarity text;
  v_source text;
  v_excluded text;
  v_is_magic_item boolean;
begin
  select * into v_option
  from public.class_feature_option_catalog
  where id=p_option_catalog_id
    and option_type='artificer-plan'
    and source='EFA'
    and lower(coalesce(class_key,''))='artificer';
  if not found then return false; end if;

  v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
  if v_schema->>'kind' <> 'magic-item' then return false; end if;

  select * into v_item from public.items_catalog where id=p_item_id;
  if not found then return false; end if;

  v_type:=lower(btrim(coalesce(v_item.item_type,v_item.payload->>'uiType','')));
  v_rarity:=lower(btrim(coalesce(v_item.item_rarity,v_item.payload->>'rarity','')));
  v_source:=upper(btrim(coalesce(v_item.payload->>'source','')));
  v_is_magic_item:=nullif(btrim(coalesce(v_item.payload->>'type','')),'') is not null
    or lower(coalesce(v_item.payload->>'wondrous','false'))='true';

  -- Canonical item rows must positively identify as magic. In the current catalogue,
  -- imported magic weapons/armor/etc. carry payload.type and Wondrous Items carry
  -- wondrous=true. Alchemy, recipe, and other non-magic rows carry neither.
  if not v_is_magic_item then return false; end if;

  if nullif(v_schema->>'rarity','') is not null and v_rarity<>lower(v_schema->>'rarity') then return false; end if;
  if coalesce((v_schema->>'excludeCursed')::boolean,false)
     and lower(coalesce(v_item.payload->>'curse','false'))='true' then return false; end if;
  if lower(coalesce(v_schema->>'itemType',''))='wondrous item'
     and not (v_type='wondrous item' or lower(coalesce(v_item.payload->>'wondrous','false'))='true') then return false; end if;

  for v_excluded in
    select value from jsonb_array_elements_text(coalesce(v_schema->'excludeTypes','[]'::jsonb))
  loop
    if v_type like '%'||lower(v_excluded)||'%' then return false; end if;
  end loop;

  -- Campaign-wide preferred-version convention: a same-name 2024 DMG row wins.
  if v_source<>'XDMG' and exists(
    select 1
    from public.items_catalog preferred
    where lower(regexp_replace(preferred.item_name,'[^a-zA-Z0-9]+','','g'))
          =lower(regexp_replace(v_item.item_name,'[^a-zA-Z0-9]+','','g'))
      and upper(coalesce(preferred.payload->>'source',''))='XDMG'
  ) then return false; end if;

  return true;
end;
$$;

revoke all on function private.artificer_plan_item_is_eligible_v1(uuid,uuid) from public;
grant execute on function private.artificer_plan_item_is_eligible_v1(uuid,uuid) to service_role;
