-- EFA Artificer Replicate Magic Item authority.
-- Learned plans are class-option knowledge, not inventory. Wildcard plans bind one
-- canonical items_catalog row to the learned plan instance.

create or replace function private.artificer_plan_count_v1(p_level integer)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when coalesce(p_level,0) >= 18 then 8
    when coalesce(p_level,0) >= 14 then 7
    when coalesce(p_level,0) >= 10 then 6
    when coalesce(p_level,0) >= 6 then 5
    when coalesce(p_level,0) >= 2 then 4
    else 0 end;
$$;

create or replace function private.artificer_plan_slot_level_v1(p_slot integer)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_slot between 1 and 4 then 2
    when p_slot = 5 then 6
    when p_slot = 6 then 10
    when p_slot = 7 then 14
    when p_slot = 8 then 18
    else null end;
$$;

-- Normalize the imported EFA source tables. jsonb_path_query sees the same nested
-- tables through more than one path, so DISTINCT is intentional here.
with feature as (
  select entries
  from public.class_feature_catalog
  where lower(class_key)='artificer'
    and upper(class_source)='EFA'
    and lower(name)='replicate magic item'
  order by level
  limit 1
), source_tables as (
  select distinct j as tbl
  from feature f
  cross join lateral jsonb_path_query(f.entries, '$.** ? (@.type == "table")') j
  where lower(coalesce(j->>'caption','')) like '%magic item plan%'
), source_rows as (
  select distinct
    tbl->>'caption' as caption,
    coalesce((regexp_match(tbl->>'caption','(?i)level\s+([0-9]+)\+'))[1]::integer,2) as min_level,
    r.value->>0 as raw_name
  from source_tables
  cross join lateral jsonb_array_elements(tbl->'rows') r(value)
), normalized as (
  select
    caption,
    min_level,
    raw_name,
    btrim(regexp_replace(
      case
        when raw_name like '{@item %' then regexp_replace(raw_name,'^\\{@item ([^|}]+).*$','\\1')
        when raw_name like '{@filter %' then regexp_replace(raw_name,'^\\{@filter ([^|}]+).*$','\\1')
        else raw_name end,
      '\\*+$','','g'
    )) as plan_name,
    raw_name like '{@filter %' as wildcard
  from source_rows
), ranked as (
  select distinct on (lower(regexp_replace(plan_name,'[^a-zA-Z0-9]+','','g')))
    caption,min_level,raw_name,plan_name,wildcard
  from normalized
  where nullif(plan_name,'') is not null
  order by lower(regexp_replace(plan_name,'[^a-zA-Z0-9]+','','g')), min_level
)
insert into public.class_feature_option_catalog(
  option_key,option_type,name,source,class_key,feature_types,page,description,
  prerequisites,additional_spells,repeatable,choice_schema,metadata,raw_payload,updated_at
)
select
  'artificer-plan:'||lower(trim(both '-' from regexp_replace(plan_name,'[^a-zA-Z0-9]+','-','g')))||'|EFA',
  'artificer-plan',
  plan_name,
  'EFA',
  'artificer',
  array['artificer-plan'],
  13,
  case when wildcard then plan_name else 'Learn the '||plan_name||' Magic Item Plan.' end,
  jsonb_build_object('minClassLevel',min_level),
  '[]'::jsonb,
  wildcard,
  case
    when lower(raw_name) like '%rarity=common%' then jsonb_build_object(
      'kind','magic-item','rarity','common','excludeTypes',jsonb_build_array('potion','scroll'),
      'excludeCursed',true,'distinctPerRepeat',true
    )
    when lower(raw_name) like '%rarity=uncommon%' then jsonb_build_object(
      'kind','magic-item','rarity','uncommon','itemType','wondrous item',
      'excludeCursed',true,'distinctPerRepeat',true
    )
    when lower(raw_name) like '%rarity=rare%' then jsonb_build_object(
      'kind','magic-item','rarity','rare','itemType','wondrous item',
      'excludeCursed',true,'distinctPerRepeat',true
    )
    else '{}'::jsonb end,
  jsonb_build_object('sourceFeature','Replicate Magic Item','sourceTable',caption,'sourceDerived',true),
  jsonb_build_object('normalizedFrom','EFA Replicate Magic Item table','caption',caption,'rawName',raw_name),
  now()
from ranked
on conflict(option_key) do update set
  option_type=excluded.option_type,
  name=excluded.name,
  source=excluded.source,
  class_key=excluded.class_key,
  feature_types=excluded.feature_types,
  page=excluded.page,
  description=excluded.description,
  prerequisites=excluded.prerequisites,
  additional_spells=excluded.additional_spells,
  repeatable=excluded.repeatable,
  choice_schema=excluded.choice_schema,
  metadata=excluded.metadata,
  raw_payload=excluded.raw_payload,
  updated_at=now();

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

  if nullif(v_schema->>'rarity','') is not null and v_rarity<>lower(v_schema->>'rarity') then return false; end if;
  if coalesce((v_schema->>'excludeCursed')::boolean,false)
     and lower(coalesce(v_item.payload->>'curse','false'))='true' then return false; end if;
  if lower(coalesce(v_schema->>'itemType',''))='wondrous item'
     and not (v_type='wondrous item' or lower(coalesce(v_item.payload->>'wondrous','false'))='true') then return false; end if;

  for v_excluded in select value from jsonb_array_elements_text(coalesce(v_schema->'excludeTypes','[]'::jsonb))
  loop
    if v_type like '%'||lower(v_excluded)||'%' then return false; end if;
  end loop;

  -- Campaign-wide preferred-version convention: a same-name 2024 DMG row wins.
  if v_source<>'XDMG' and exists(
    select 1 from public.items_catalog preferred
    where lower(regexp_replace(preferred.item_name,'[^a-zA-Z0-9]+','','g'))
          =lower(regexp_replace(v_item.item_name,'[^a-zA-Z0-9]+','','g'))
      and upper(coalesce(preferred.payload->>'source',''))='XDMG'
  ) then return false; end if;
  return true;
end;
$$;

create or replace function private.artificer_plan_item_options_v1(p_option_catalog_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',i.id::text,
    'value',i.id::text,
    'label',i.item_name,
    'source',coalesce(i.payload->>'source','Campaign'),
    'kind','item',
    'description',coalesce(i.payload->>'rulesShort',i.payload->>'item_description',''),
    'metadata',jsonb_build_object(
      'itemId',i.id,
      'itemKey',i.item_key,
      'itemType',i.item_type,
      'rarity',i.item_rarity,
      'source',coalesce(i.payload->>'source','Campaign')
    )
  ) order by i.item_name,coalesce(i.payload->>'source','')),'[]'::jsonb)
  from public.items_catalog i
  where private.artificer_plan_item_is_eligible_v1(p_option_catalog_id,i.id);
$$;

create or replace function private.artificer_plan_parent_options_v1(
  p_character_id uuid,
  p_level integer,
  p_allow_existing boolean default false,
  p_exclude_instance_key text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,
    'value',o.option_key,
    'label',o.name,
    'source',o.source,
    'kind','artificer-plan',
    'description',coalesce(o.description,''),
    'metadata',jsonb_build_object(
      'optionId',o.id,
      'optionKey',o.option_key,
      'repeatable',o.repeatable,
      'prerequisites',o.prerequisites,
      'choiceSchema',o.choice_schema
    )
  ) order by coalesce((o.prerequisites->>'minClassLevel')::integer,1),o.name),'[]'::jsonb)
  from public.class_feature_option_catalog o
  where o.option_type='artificer-plan'
    and o.source='EFA'
    and lower(coalesce(o.class_key,''))='artificer'
    and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=greatest(1,coalesce(p_level,1))
    and (
      o.repeatable
      or p_allow_existing
      or not exists(
        select 1 from public.character_class_option_grant_instances gi
        where gi.character_id=p_character_id
          and gi.option_catalog_id=o.id
          and (p_exclude_instance_key is null or gi.instance_key<>p_exclude_instance_key)
      )
    );
$$;

create or replace function private.artificer_plan_fields_v1(
  p_group_id text,
  p_character_id uuid,
  p_level integer,
  p_plan_active_when jsonb default null,
  p_allow_existing boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_fields jsonb;
  v_option public.class_feature_option_catalog%rowtype;
  v_active jsonb;
begin
  v_fields:=jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id','plan','label','Magic Item Plan','kind','artificer-plan','count',1,'required',true,
    'options',private.artificer_plan_parent_options_v1(p_character_id,p_level,p_allow_existing,null),
    'cadence','level-up','replacementCadence','level-up','activeWhen',p_plan_active_when
  )));
  for v_option in
    select * from public.class_feature_option_catalog
    where option_type='artificer-plan' and source='EFA' and lower(coalesce(class_key,''))='artificer'
      and choice_schema->>'kind'='magic-item'
      and coalesce((prerequisites->>'minClassLevel')::integer,1)<=greatest(1,coalesce(p_level,1))
    order by name
  loop
    v_active:=jsonb_build_object('groupId',p_group_id,'fieldId','plan','values',jsonb_build_array(v_option.option_key));
    v_fields:=v_fields||jsonb_build_array(jsonb_build_object(
      'id','item-'||lower(trim(both '-' from regexp_replace(v_option.name,'[^a-zA-Z0-9]+','-','g'))),
      'label',v_option.name||': concrete magic item',
      'kind','item','count',1,'required',true,
      'options',private.artificer_plan_item_options_v1(v_option.id),
      'cadence','level-up','activeWhen',v_active,
      'metadata',jsonb_build_object('planOptionKey',v_option.option_key,'choiceSchema',v_option.choice_schema)
    ));
  end loop;
  return v_fields;
end;
$$;

create or replace function private.level_up_artificer_plan_groups_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_before integer;
  v_after integer;
  v_slot integer;
  v_group_id text;
  v_out jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 then return v_out; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(v_class.class_key)<>'artificer' or upper(v_class.source)<>'EFA' then return v_out; end if;
  v_before:=private.artificer_plan_count_v1(v_progression.class_level);
  v_after:=private.artificer_plan_count_v1(p_to_level);
  if v_after<=v_before then return v_out; end if;
  for v_slot in v_before+1..v_after loop
    v_group_id:='artificer-plan-slot-'||v_slot::text;
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'id',v_group_id,'ownerType','class-option','ownerKey','artificer-plan-'||v_slot::text,
      'label','Magic Item Plan '||v_slot::text,'source','EFA','placement','class','level',p_to_level,
      'helper','Choose the new Magic Item Plan gained at this Artificer level. Wildcard plans require a concrete canonical item.',
      'fields',private.artificer_plan_fields_v1(v_group_id,p_character_id,p_to_level,null,false),
      'metadata',jsonb_build_object('family','artificer-plan','slot',v_slot,'acquisitionLevel',p_to_level,'progressionDelta',true)
    ));
  end loop;
  return v_out;
end;
$$;

create or replace function private.level_up_artificer_plan_replacement_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_existing jsonb;
  v_keys jsonb;
  v_active jsonb;
  v_fields jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 or v_progression.class_level<2 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(v_class.class_key)<>'artificer' or upper(v_class.source)<>'EFA' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',gi.instance_key,'value',gi.instance_key,
    'label',o.name||case when gi.choices->'child'->>'label' is not null then ' — '||(gi.choices->'child'->>'label') else '' end,
    'source','EFA','kind','artificer-plan-instance',
    'metadata',jsonb_build_object('instanceId',gi.id,'optionId',o.id,'optionKey',o.option_key)
  ) order by gi.instance_key),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(gi.instance_key) order by gi.instance_key),'[]'::jsonb)
  into v_existing,v_keys
  from public.character_class_option_grant_instances gi
  join public.class_feature_option_catalog o on o.id=gi.option_catalog_id
  where gi.character_id=p_character_id and gi.option_type='artificer-plan';
  if jsonb_array_length(v_existing)=0 then return '[]'::jsonb; end if;

  v_active:=jsonb_build_object('groupId','artificer-plan-replacement','fieldId','replace','values',v_keys);
  v_fields:=jsonb_build_array(jsonb_build_object(
    'id','replace','label','Replace an existing plan (optional)','kind','artificer-plan-instance','count',1,
    'required',false,'options',v_existing,'cadence','level-up'
  ));
  v_fields:=v_fields||private.artificer_plan_fields_v1('artificer-plan-replacement',p_character_id,p_to_level,v_active,true);
  return jsonb_build_array(jsonb_build_object(
    'id','artificer-plan-replacement','ownerType','class-option','ownerKey','artificer-plan-replacement',
    'label','Replace a Magic Item Plan','source','EFA','placement','class','level',p_to_level,
    'helper','Optional: whenever you gain an Artificer level, replace one learned plan with another plan legal for the new level.',
    'fields',v_fields,
    'metadata',jsonb_build_object('family','artificer-plan','progressionReplacement',true,'acquisitionLevel',p_to_level)
  ));
end;
$$;

create or replace function private.validate_artificer_plan_choice_v1(
  p_character_id uuid,
  p_level integer,
  p_plan_option_key text,
  p_item_id uuid default null,
  p_exclude_instance_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_option public.class_feature_option_catalog%rowtype;
  v_item public.items_catalog%rowtype;
  v_schema jsonb;
  v_choices jsonb:='{}'::jsonb;
begin
  select * into v_option
  from public.class_feature_option_catalog
  where option_key=p_plan_option_key and option_type='artificer-plan' and source='EFA' and lower(coalesce(class_key,''))='artificer';
  if not found then raise exception 'The selected Magic Item Plan is not canonical EFA plan authority.'; end if;
  if coalesce((v_option.prerequisites->>'minClassLevel')::integer,1)>p_level then
    raise exception '% requires Artificer level %.',v_option.name,v_option.prerequisites->>'minClassLevel';
  end if;
  if not v_option.repeatable and exists(
    select 1 from public.character_class_option_grant_instances gi
    where gi.character_id=p_character_id and gi.option_catalog_id=v_option.id
      and (p_exclude_instance_key is null or gi.instance_key<>p_exclude_instance_key)
  ) then raise exception '% is already a learned Magic Item Plan.',v_option.name; end if;

  v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
  if v_schema->>'kind'='magic-item' then
    if p_item_id is null then raise exception '% requires a concrete magic item.',v_option.name; end if;
    if not private.artificer_plan_item_is_eligible_v1(v_option.id,p_item_id) then
      raise exception 'The selected item is not legal for %.',v_option.name;
    end if;
    if coalesce((v_schema->>'distinctPerRepeat')::boolean,false) and exists(
      select 1 from public.character_class_option_grant_instances gi
      where gi.character_id=p_character_id and gi.option_catalog_id=v_option.id
        and (p_exclude_instance_key is null or gi.instance_key<>p_exclude_instance_key)
        and gi.choices #>> '{child,key}'=p_item_id::text
    ) then raise exception 'Each repeat of % must choose a different magic item.',v_option.name; end if;
    select * into v_item from public.items_catalog where id=p_item_id;
    v_choices:=jsonb_build_object('child',jsonb_build_object(
      'kind','item','key',v_item.id::text,'value',v_item.id::text,'label',v_item.item_name,
      'source',coalesce(v_item.payload->>'source','Campaign'),
      'metadata',jsonb_build_object('itemId',v_item.id,'itemKey',v_item.item_key,'itemType',v_item.item_type,'rarity',v_item.item_rarity,'source',coalesce(v_item.payload->>'source','Campaign'))
    ));
  elsif p_item_id is not null then
    raise exception '% is a fixed Magic Item Plan and does not accept a wildcard item.',v_option.name;
  end if;

  return jsonb_build_object(
    'optionId',v_option.id,'optionKey',v_option.option_key,'name',v_option.name,'source',v_option.source,
    'repeatable',v_option.repeatable,'minClassLevel',coalesce((v_option.prerequisites->>'minClassLevel')::integer,1),
    'choices',v_choices
  );
end;
$$;

create or replace function private.sync_character_artificer_plan_projection_v1(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
  v_selections jsonb;
  v_group jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if v_sheet is null then return; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'key',o.option_key,'name',o.name,'source',o.source,'kind','artificer-plan',
    'instanceKey',gi.instance_key,'acquiredLevel',gi.acquired_level,
    'item',case when gi.choices ? 'child' then gi.choices->'child' else null end
  )) order by gi.instance_key),'[]'::jsonb)
  into v_selections
  from public.character_class_option_grant_instances gi
  join public.class_feature_option_catalog o on o.id=gi.option_catalog_id
  where gi.character_id=p_character_id and gi.option_type='artificer-plan';
  v_group:=jsonb_build_object(
    'label','Magic Item Plans','kind','artificer-plan','sourceFeature','Replicate Magic Item','source','EFA',
    'level',2,'count',jsonb_array_length(v_selections),'placement','class','subclassName',null,
    'cadence','creation','replacementCadence','level-up','selections',v_selections,'normalizedAuthority',true
  );
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices,artificer-magic-item-plans}',v_group,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$$;

create or replace function private.materialize_player_forge_artificer_plans_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_class public.class_catalog%rowtype;
  v_sheet jsonb;
  v_source jsonb;
  v_group jsonb;
  v_plan_selection jsonb;
  v_plan_key text;
  v_option public.class_feature_option_catalog%rowtype;
  v_schema jsonb;
  v_child_field jsonb;
  v_child_selection jsonb;
  v_item_id uuid;
  v_resolved jsonb;
  v_slot integer;
  v_count integer;
  v_slot_level integer;
  v_acquired integer;
begin
  select * into v_class from public.class_catalog where id=new.class_id;
  if not found or lower(v_class.class_key)<>'artificer' or upper(v_class.source)<>'EFA' then return new; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  v_count:=private.artificer_plan_count_v1(new.class_level);
  if v_count=0 then return new; end if;
  v_source:=case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end;

  for v_slot in 1..v_count loop
    v_group:=v_source->('artificer-plan-slot-'||v_slot::text);
    if v_group is null then raise exception 'Player Forge is missing Magic Item Plan slot %.',v_slot; end if;
    v_plan_selection:=v_group #> '{fields,plan,selections}';
    if jsonb_typeof(v_plan_selection)<>'array' or jsonb_array_length(v_plan_selection)<>1 then
      raise exception 'Magic Item Plan slot % requires exactly one plan.',v_slot;
    end if;
    v_plan_key:=v_plan_selection->0->>'key';
    select * into v_option from public.class_feature_option_catalog where option_key=v_plan_key;
    if not found then raise exception 'Magic Item Plan slot % references an unknown plan.',v_slot; end if;
    v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
    v_item_id:=null;
    if v_schema->>'kind'='magic-item' then
      select value into v_child_field
      from jsonb_each(coalesce(v_group->'fields','{}'::jsonb))
      where value #>> '{metadata,planOptionKey}'=v_plan_key
      limit 1;
      v_child_selection:=v_child_field->'selections';
      if jsonb_typeof(v_child_selection)<>'array' or jsonb_array_length(v_child_selection)<>1 then
        raise exception '% requires one concrete magic item.',v_option.name;
      end if;
      begin v_item_id:=(v_child_selection->0->>'key')::uuid;
      exception when others then raise exception '% requires a canonical item id.',v_option.name; end;
    end if;
    v_resolved:=private.validate_artificer_plan_choice_v1(new.character_id,new.class_level,v_plan_key,v_item_id,null);
    v_slot_level:=private.artificer_plan_slot_level_v1(v_slot);
    v_acquired:=greatest(v_slot_level,coalesce((v_resolved->>'minClassLevel')::integer,v_slot_level));
    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,'artificer-plan-'||v_slot::text,(v_resolved->>'optionId')::uuid,'artificer-plan',v_acquired,
      coalesce(v_resolved->'choices','{}'::jsonb),
      jsonb_build_object('creator','shared_character_forge_player_v2','slot',v_slot,'slotAcquisitionLevel',v_slot_level,'startingLevel',new.class_level,'materializesInventory',false),now()
    );
  end loop;
  perform private.sync_character_artificer_plan_projection_v1(new.character_id);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_artificer_plans_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_artificer_plans_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_artificer_plans_v1();

create or replace function private.apply_level_up_artificer_plans_v1(
  p_character_id uuid,
  p_to_level integer,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_groups jsonb;
  v_replacement_groups jsonb;
  v_group jsonb;
  v_group_selection jsonb;
  v_plan_keys jsonb;
  v_plan_key text;
  v_option public.class_feature_option_catalog%rowtype;
  v_schema jsonb;
  v_child_field jsonb;
  v_child_keys jsonb;
  v_item_id uuid;
  v_resolved jsonb;
  v_instance_key text;
  v_replace_keys jsonb;
  v_replace_key text;
  v_added jsonb:='[]'::jsonb;
  v_replaced jsonb:='[]'::jsonb;
  v_expected_keys text[]='{}'::text[];
  v_key text;
begin
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then raise exception 'Artificer plan selections must be an object.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or p_to_level<>v_progression.class_level+1 then return jsonb_build_object('added',v_added,'replacements',v_replaced); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(v_class.class_key)<>'artificer' or upper(v_class.source)<>'EFA' then
    if exists(select 1 from jsonb_object_keys(coalesce(p_selections,'{}'::jsonb))) then raise exception 'Artificer plan selections were supplied for a non-Artificer level.'; end if;
    return jsonb_build_object('added',v_added,'replacements',v_replaced);
  end if;

  v_groups:=private.level_up_artificer_plan_groups_v1(p_character_id,p_to_level);
  for v_group in select value from jsonb_array_elements(v_groups) loop
    v_expected_keys:=array_append(v_expected_keys,v_group->>'id');
    v_group_selection:=coalesce(p_selections->(v_group->>'id'),'{}'::jsonb);
    v_plan_keys:=coalesce(v_group_selection->'plan','[]'::jsonb);
    if jsonb_typeof(v_plan_keys)<>'array' or jsonb_array_length(v_plan_keys)<>1 then raise exception '% requires exactly one plan.',v_group->>'label'; end if;
    v_plan_key:=v_plan_keys->>0;
    select * into v_option from public.class_feature_option_catalog where option_key=v_plan_key and option_type='artificer-plan';
    if not found then raise exception '% contains a non-canonical plan.',v_group->>'label'; end if;
    v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb); v_item_id:=null;
    if v_schema->>'kind'='magic-item' then
      select value into v_child_field from jsonb_array_elements(v_group->'fields')
      where value #>> '{metadata,planOptionKey}'=v_plan_key limit 1;
      v_child_keys:=coalesce(v_group_selection->(v_child_field->>'id'),'[]'::jsonb);
      if jsonb_typeof(v_child_keys)<>'array' or jsonb_array_length(v_child_keys)<>1 then raise exception '% requires one concrete magic item.',v_option.name; end if;
      begin v_item_id:=(v_child_keys->>0)::uuid; exception when others then raise exception '% requires a canonical item id.',v_option.name; end;
    end if;
    v_resolved:=private.validate_artificer_plan_choice_v1(p_character_id,p_to_level,v_plan_key,v_item_id,null);
    v_instance_key:=v_group->>'ownerKey';
    insert into public.character_class_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at)
    values(p_character_id,v_instance_key,(v_resolved->>'optionId')::uuid,'artificer-plan',p_to_level,coalesce(v_resolved->'choices','{}'::jsonb),jsonb_build_object('creator','character_progression_v5','slot',v_group #>> '{metadata,slot}','materializesInventory',false),now());
    v_added:=v_added||jsonb_build_array(jsonb_build_object('instanceKey',v_instance_key,'plan',v_resolved->>'name','item',v_resolved #> '{choices,child}'));
  end loop;

  v_replacement_groups:=private.level_up_artificer_plan_replacement_group_v1(p_character_id,p_to_level);
  if jsonb_array_length(v_replacement_groups)>0 then
    v_group:=v_replacement_groups->0; v_expected_keys:=array_append(v_expected_keys,v_group->>'id');
    v_group_selection:=coalesce(p_selections->(v_group->>'id'),'{}'::jsonb);
    v_replace_keys:=coalesce(v_group_selection->'replace','[]'::jsonb);
    if jsonb_typeof(v_replace_keys)<>'array' then raise exception 'Artificer replacement selection must be an array.'; end if;
    if jsonb_array_length(v_replace_keys)>1 then raise exception 'Only one Magic Item Plan may be replaced per Artificer level.'; end if;
    if jsonb_array_length(v_replace_keys)=1 then
      v_replace_key:=v_replace_keys->>0;
      if not exists(select 1 from public.character_class_option_grant_instances where character_id=p_character_id and instance_key=v_replace_key and option_type='artificer-plan') then raise exception 'The selected Artificer plan instance cannot be replaced.'; end if;
      v_plan_keys:=coalesce(v_group_selection->'plan','[]'::jsonb);
      if jsonb_typeof(v_plan_keys)<>'array' or jsonb_array_length(v_plan_keys)<>1 then raise exception 'Replacing a Magic Item Plan requires one replacement plan.'; end if;
      v_plan_key:=v_plan_keys->>0;
      select * into v_option from public.class_feature_option_catalog where option_key=v_plan_key and option_type='artificer-plan';
      if not found then raise exception 'The replacement Magic Item Plan is not canonical.'; end if;
      v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb); v_item_id:=null;
      if v_schema->>'kind'='magic-item' then
        select value into v_child_field from jsonb_array_elements(v_group->'fields')
        where value #>> '{metadata,planOptionKey}'=v_plan_key limit 1;
        v_child_keys:=coalesce(v_group_selection->(v_child_field->>'id'),'[]'::jsonb);
        if jsonb_typeof(v_child_keys)<>'array' or jsonb_array_length(v_child_keys)<>1 then raise exception '% requires one concrete magic item.',v_option.name; end if;
        begin v_item_id:=(v_child_keys->>0)::uuid; exception when others then raise exception '% requires a canonical item id.',v_option.name; end;
      end if;
      v_resolved:=private.validate_artificer_plan_choice_v1(p_character_id,p_to_level,v_plan_key,v_item_id,v_replace_key);
      update public.character_class_option_grant_instances
      set option_catalog_id=(v_resolved->>'optionId')::uuid,option_type='artificer-plan',acquired_level=p_to_level,
          choices=coalesce(v_resolved->'choices','{}'::jsonb),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('creator','character_progression_v5','replacedAtLevel',p_to_level,'materializesInventory',false),updated_at=now()
      where character_id=p_character_id and instance_key=v_replace_key and option_type='artificer-plan';
      v_replaced:=v_replaced||jsonb_build_array(jsonb_build_object('instanceKey',v_replace_key,'plan',v_resolved->>'name','item',v_resolved #> '{choices,child}'));
    elsif jsonb_array_length(coalesce(v_group_selection->'plan','[]'::jsonb))>0 then
      raise exception 'Choose the existing Magic Item Plan to replace before choosing a replacement.';
    end if;
  end if;

  for v_key in select key from jsonb_each(coalesce(p_selections,'{}'::jsonb)) loop
    if not (v_key=any(v_expected_keys)) then raise exception 'Artificer plan payload contains an unexpected group: %.',v_key; end if;
  end loop;
  perform private.sync_character_artificer_plan_projection_v1(p_character_id);
  return jsonb_build_object('added',v_added,'replacements',v_replaced);
end;
$$;

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_base jsonb;
  v_progression public.character_progression%rowtype;
  v_extra jsonb:='[]'::jsonb;
  v_replacement jsonb:='[]'::jsonb;
  v_battle_master jsonb:='[]'::jsonb;
  v_wizard_savant jsonb:='[]'::jsonb;
  v_wizard_signature jsonb:='[]'::jsonb;
  v_artificer jsonb:='[]'::jsonb;
  v_artificer_replacement jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_replacement:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,v_progression.class_level+1);
  v_battle_master:=private.level_up_battle_master_maneuver_group_v1(p_character_id,v_progression.class_level+1);
  v_wizard_savant:=private.level_up_wizard_savant_group_v1(p_character_id,v_progression.class_level+1);
  v_wizard_signature:=private.level_up_wizard_signature_group_v1(p_character_id,v_progression.class_level+1);
  v_artificer:=private.level_up_artificer_plan_groups_v1(p_character_id,v_progression.class_level+1);
  v_artificer_replacement:=private.level_up_artificer_plan_replacement_group_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb)||coalesce(v_replacement,'[]'::jsonb)||coalesce(v_battle_master,'[]'::jsonb)||coalesce(v_wizard_savant,'[]'::jsonb)||coalesce(v_wizard_signature,'[]'::jsonb)||coalesce(v_artificer,'[]'::jsonb)||coalesce(v_artificer_replacement,'[]'::jsonb),true);
end;
$$;

create or replace function public.complete_character_level_up_v5(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_replacements jsonb:=coalesce(v_input->'replacement_selections','{}'::jsonb);
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_invocation_replacement jsonb:=coalesce(v_all_class->'warlock-invocation-replacement','{}'::jsonb);
  v_battle_master jsonb:=coalesce(v_all_class->'fighter-battle-master-maneuvers','{}'::jsonb);
  v_wizard_savant jsonb:=coalesce(v_all_class->'wizard-savant-spellbook-addition','{}'::jsonb);
  v_wizard_signature jsonb:=coalesce(v_all_class->'wizard-signature-spells','{}'::jsonb);
  v_artificer jsonb:='{}'::jsonb;
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'-'wizard-savant-spellbook-addition'-'wizard-signature-spells';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_battle_summary jsonb:='[]'::jsonb;
  v_wizard_summary jsonb:='[]'::jsonb;
  v_signature_summary jsonb:='[]'::jsonb;
  v_artificer_summary jsonb:=jsonb_build_object('added','[]'::jsonb,'replacements','[]'::jsonb);
  v_standard_summary jsonb:='[]'::jsonb;
  v_replacement_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
  v_key text;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  for v_key in select key from jsonb_each(v_all_class) loop
    if v_key like 'artificer-plan-slot-%' or v_key='artificer-plan-replacement' then
      v_artificer:=jsonb_set(v_artificer,array[v_key],v_all_class->v_key,true);
      v_forward_class:=v_forward_class-v_key;
    end if;
  end loop;

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances);
  v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1(p_character_id,v_to,v_battle_master,v_input->>'subclass_name');
  v_wizard_summary:=private.apply_level_up_wizard_savant_v1(p_character_id,v_to,v_wizard_savant,v_input->>'subclass_name');
  v_artificer_summary:=private.apply_level_up_artificer_plans_v1(p_character_id,v_to,v_artificer);
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_replacement_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_battle_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb)||coalesce(v_artificer_summary->'replacements','[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');
  v_signature_summary:=private.apply_level_up_wizard_signature_spells_v1(p_character_id,v_to,v_wizard_signature);
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if jsonb_array_length(v_replacement_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_replacement_summary); end if;
  if jsonb_array_length(v_wizard_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_savant_delta',v_wizard_summary); end if;
  if jsonb_array_length(v_signature_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_signature_delta',v_signature_summary); end if;
  if jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then
    v_level_choice:=v_level_choice||jsonb_build_object('artificer_plan_delta',v_artificer_summary);
  end if;
  if jsonb_array_length(v_replacement_summary)>0 or jsonb_array_length(v_wizard_summary)>0 or jsonb_array_length(v_signature_summary)>0 or jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 then
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)
        ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_replacement_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizard_savant_selection',v_wizard_savant,'wizard_savant_delta',v_wizard_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizard_signature_selection',v_wizard_signature,'wizard_signature_delta',v_signature_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then jsonb_build_object('artificer_plan_selections',v_artificer,'artificer_plan_delta',v_artificer_summary) else '{}'::jsonb end,
        updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)
      ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacements',v_replacement_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizardSavantDelta',v_wizard_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizardSignatureDelta',v_signature_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then jsonb_build_object('artificerPlanDelta',v_artificer_summary) else '{}'::jsonb end
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_replacement_summary,'wizardSavant',v_wizard_summary,'wizardSignature',v_signature_summary,'artificerPlans',v_artificer_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.artificer_plan_count_v1(integer) from public;
revoke all on function private.artificer_plan_slot_level_v1(integer) from public;
revoke all on function private.artificer_plan_item_is_eligible_v1(uuid,uuid) from public;
revoke all on function private.artificer_plan_item_options_v1(uuid) from public;
revoke all on function private.artificer_plan_parent_options_v1(uuid,integer,boolean,text) from public;
revoke all on function private.artificer_plan_fields_v1(text,uuid,integer,jsonb,boolean) from public;
revoke all on function private.level_up_artificer_plan_groups_v1(uuid,integer) from public;
revoke all on function private.level_up_artificer_plan_replacement_group_v1(uuid,integer) from public;
revoke all on function private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text) from public;
revoke all on function private.sync_character_artificer_plan_projection_v1(uuid) from public;
revoke all on function private.materialize_player_forge_artificer_plans_v1() from public;
revoke all on function private.apply_level_up_artificer_plans_v1(uuid,integer,jsonb) from public;

grant execute on function private.artificer_plan_count_v1(integer) to service_role;
grant execute on function private.artificer_plan_slot_level_v1(integer) to service_role;
grant execute on function private.artificer_plan_item_is_eligible_v1(uuid,uuid) to service_role;
grant execute on function private.artificer_plan_item_options_v1(uuid) to service_role;
grant execute on function private.artificer_plan_parent_options_v1(uuid,integer,boolean,text) to service_role;
grant execute on function private.artificer_plan_fields_v1(text,uuid,integer,jsonb,boolean) to service_role;
grant execute on function private.level_up_artificer_plan_groups_v1(uuid,integer) to service_role;
grant execute on function private.level_up_artificer_plan_replacement_group_v1(uuid,integer) to service_role;
grant execute on function private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text) to service_role;
grant execute on function private.sync_character_artificer_plan_projection_v1(uuid) to service_role;
grant execute on function private.materialize_player_forge_artificer_plans_v1() to service_role;
grant execute on function private.apply_level_up_artificer_plans_v1(uuid,integer,jsonb) to service_role;
