-- Magic Initiate spell replacement at level gain.
-- Each feat instance owns its chosen spell list and its three feat-owned spell rows.
-- Replacement is optional, per instance, same spell level, and same chosen spell list.
-- The level-1 free-cast resource keeps its current uses_remaining value when replaced.

create or replace function private.level_up_magic_initiate_replacement_groups_v1(
  p_character_id uuid,
  p_to_level integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_instance public.character_option_grant_instances%rowtype;
  v_option public.character_option_catalog%rowtype;
  v_list text;
  v_group_id text;
  v_replace_options jsonb;
  v_fields jsonb;
  v_with_options jsonb;
  v_row record;
  v_groups jsonb:='[]'::jsonb;
  v_owned_count integer;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 then return '[]'::jsonb; end if;

  for v_instance in
    select gi.*
    from public.character_option_grant_instances gi
    where gi.character_id=p_character_id
      and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1('Magic Initiate')
      and upper(coalesce(gi.option_source,''))='XPHB'
    order by gi.acquisition_level,gi.instance_key
  loop
    select * into v_option from public.character_option_catalog where id=v_instance.option_id;
    if not found
       or lower(coalesce(v_option.description,'')) not like '%whenever you gain a new level%'
       or lower(coalesce(v_option.description,'')) not like '%same level from the chosen spell list%' then
      continue;
    end if;

    v_list:=lower(coalesce(
      v_instance.choices#>>'{spell-list,0,value}',
      v_instance.choices#>>'{spell-list,0,label}',
      ''
    ));
    if v_list not in ('cleric','druid','wizard') then continue; end if;

    select count(*) into v_owned_count
    from public.character_spells cs
    where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_instance.instance_key;
    if v_owned_count<>3 then continue; end if;

    v_group_id:='replacement-magic-initiate-'||substr(md5(v_instance.instance_key),1,12);
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',cs.id::text,'value',cs.id::text,'label',s.name,'source',s.source,'kind','spell',
      'metadata',jsonb_build_object(
        'assignmentId',cs.id,'spellId',s.id,'spellKey',s.spell_key,'level',s.level,
        'instanceKey',v_instance.instance_key,'spellList',initcap(v_list)
      )
    ) order by s.level,s.name),'[]'::jsonb)
    into v_replace_options
    from public.character_spells cs
    join public.spells_catalog_preferred s on s.id=cs.spell_id
    where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_instance.instance_key;

    v_fields:=jsonb_build_array(jsonb_build_object(
      'id','replace','label','Magic Initiate spell to replace','kind','spell','count',1,'required',false,
      'cadence','level-up','replacementCadence','level-up','options',v_replace_options,
      'metadata',jsonb_build_object('instanceKey',v_instance.instance_key,'spellList',initcap(v_list))
    ));

    for v_row in
      select cs.id as assignment_id,cs.spell_id,s.level
      from public.character_spells cs
      join public.spells_catalog_preferred s on s.id=cs.spell_id
      where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_instance.instance_key
      order by s.level,s.name
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell',
        'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'spellList',initcap(v_list))
      ) order by s.name),'[]'::jsonb)
      into v_with_options
      from public.spells_catalog_preferred s
      where s.level=v_row.level
        and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)=v_list)
        and not exists(
          select 1 from public.character_spells owned
          where owned.character_id=p_character_id
            and owned.source_type='feat'
            and owned.source_key=v_instance.instance_key
            and owned.spell_id=s.id
        );

      v_fields:=v_fields||jsonb_build_array(jsonb_build_object(
        'id','with-'||v_row.assignment_id::text,
        'label','New '||case when v_row.level=0 then 'cantrip' else 'level 1 spell' end||' from the '||initcap(v_list)||' list',
        'kind','spell','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_with_options,
        'activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','replace','values',jsonb_build_array(v_row.assignment_id::text)),
        'metadata',jsonb_build_object('instanceKey',v_instance.instance_key,'spellList',initcap(v_list),'spellLevel',v_row.level)
      ));
    end loop;

    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id',v_group_id,'ownerType','replacement','ownerKey',v_instance.instance_key,
      'label','Magic Initiate ('||initcap(v_list)||') spell change','source','XPHB','placement','class','level',p_to_level,
      'helper','Optional: replace one spell chosen for this Magic Initiate instance with a different spell of the same level from its '||initcap(v_list)||' list.',
      'metadata',jsonb_build_object(
        'family','magic-initiate','instanceKey',v_instance.instance_key,'spellList',initcap(v_list),'replacementCadence','level-up'
      ),
      'fields',v_fields
    ));
  end loop;
  return v_groups;
end;
$$;

create or replace function private.apply_level_up_magic_initiate_replacements_v1(
  p_character_id uuid,
  p_to_level integer,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:=private.level_up_magic_initiate_replacement_groups_v1(p_character_id,p_to_level);
  v_group jsonb;
  v_group_id text;
  v_instance_key text;
  v_input jsonb;
  v_replace jsonb;
  v_assignment_id uuid;
  v_with jsonb;
  v_with_field text;
  v_new_spell_id uuid;
  v_assignment public.character_spells%rowtype;
  v_old_spell public.spells_catalog%rowtype;
  v_new_spell public.spells_catalog%rowtype;
  v_instance public.character_option_grant_instances%rowtype;
  v_list text;
  v_choice_field text;
  v_current_choices jsonb;
  v_next_choices jsonb;
  v_replaced boolean;
  v_sheet jsonb;
  v_sheet_instances jsonb;
  v_next_sheet_instances jsonb;
  v_summary jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then
    raise exception 'Magic Initiate replacement selections must be an object.';
  end if;

  for v_group in select value from jsonb_array_elements(v_groups)
  loop
    v_group_id:=v_group->>'id';
    v_instance_key:=v_group#>>'{metadata,instanceKey}';
    v_input:=coalesce(p_selections->v_group_id,'{}'::jsonb);
    if jsonb_typeof(v_input)<>'object' then raise exception 'Magic Initiate replacement group % must be an object.',v_group_id; end if;
    v_replace:=coalesce(v_input->'replace','[]'::jsonb);

    if jsonb_array_length(v_replace)=0 then
      if exists(
        select 1 from jsonb_each(v_input) e
        where e.key<>'replace' and jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0
      ) then raise exception 'Choose the Magic Initiate spell being replaced first.'; end if;
      continue;
    end if;
    if jsonb_array_length(v_replace)<>1 then raise exception 'Choose exactly one Magic Initiate spell to replace.'; end if;

    begin v_assignment_id:=(v_replace->>0)::uuid; exception when others then raise exception 'Magic Initiate replacement requires a canonical owned spell assignment.'; end;
    if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,0,options}') o where o->>'key'=v_assignment_id::text) then
      raise exception 'The selected Magic Initiate spell is not owned by this feat instance.';
    end if;

    select * into v_assignment
    from public.character_spells
    where id=v_assignment_id and character_id=p_character_id and source_type='feat' and source_key=v_instance_key
    for update;
    if not found then raise exception 'The selected Magic Initiate spell assignment is missing.'; end if;
    select * into v_old_spell from public.spells_catalog_preferred where id=v_assignment.spell_id;
    if not found then raise exception 'The current Magic Initiate spell is unavailable from the preferred catalogue.'; end if;

    v_with_field:='with-'||v_assignment_id::text;
    v_with:=coalesce(v_input->v_with_field,'[]'::jsonb);
    if jsonb_array_length(v_with)<>1 then raise exception 'Choose exactly one replacement for %.',v_old_spell.name; end if;
    begin v_new_spell_id:=(v_with->>0)::uuid; exception when others then raise exception 'Magic Initiate replacement requires a canonical spell id.'; end;
    if not exists(
      select 1 from jsonb_array_elements(v_group->'fields') f,jsonb_array_elements(f->'options') o
      where f->>'id'=v_with_field and o->>'key'=v_new_spell_id::text
    ) then raise exception 'The replacement Magic Initiate spell is not source-legal for this feat instance.'; end if;

    select * into v_new_spell from public.spells_catalog_preferred where id=v_new_spell_id;
    if not found then raise exception 'The replacement Magic Initiate spell is unavailable.'; end if;
    select * into v_instance
    from public.character_option_grant_instances
    where character_id=p_character_id and instance_key=v_instance_key
      and private.normalize_player_choice_name_v1(option_name)=private.normalize_player_choice_name_v1('Magic Initiate')
    for update;
    if not found then raise exception 'Magic Initiate feat-instance authority is missing.'; end if;

    v_list:=lower(coalesce(v_instance.choices#>>'{spell-list,0,value}',v_instance.choices#>>'{spell-list,0,label}',''));
    if v_list not in ('cleric','druid','wizard')
       or v_new_spell.level<>v_old_spell.level
       or not exists(select 1 from unnest(coalesce(v_new_spell.classes,'{}'::text[])) c where lower(c)=v_list) then
      raise exception 'Magic Initiate replacement must be a spell of the same level from the feat instance''s chosen spell list.';
    end if;
    if exists(
      select 1 from public.character_spells cs
      where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_instance_key
        and cs.id<>v_assignment_id and cs.spell_id=v_new_spell.id
    ) then raise exception '% is already chosen for this Magic Initiate instance.',v_new_spell.name; end if;

    v_choice_field:=case when v_old_spell.level=0 then 'cantrips-'||v_list else 'level-1-'||v_list end;
    v_current_choices:=coalesce(v_instance.choices->v_choice_field,'[]'::jsonb);
    if jsonb_typeof(v_current_choices)<>'array' then raise exception 'Magic Initiate feat-instance spell choices are malformed.'; end if;
    v_replaced:=false;
    select coalesce(jsonb_agg(
      case when coalesce(e.value#>>'{metadata,spellId}',e.value->>'value',e.value->>'key','')=v_old_spell.id::text
        then jsonb_build_object(
          'key',v_new_spell.id::text,'value',v_new_spell.id::text,'label',v_new_spell.name,'kind','spell','source',v_new_spell.source,
          'metadata',jsonb_build_object('spellId',v_new_spell.id,'spellKey',v_new_spell.spell_key,'level',v_new_spell.level)
        )
        else e.value end
      order by e.ord
    ),'[]'::jsonb),
    bool_or(coalesce(e.value#>>'{metadata,spellId}',e.value->>'value',e.value->>'key','')=v_old_spell.id::text)
    into v_next_choices,v_replaced
    from jsonb_array_elements(v_current_choices) with ordinality e(value,ord);
    if not coalesce(v_replaced,false) then raise exception 'The old Magic Initiate spell was not found in feat-instance choice authority.'; end if;

    update public.character_spells
    set spell_id=v_new_spell.id,
        known=true,
        prepared=true,
        always_available=true,
        raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object(
          'replacedAtLevel',p_to_level,'replacedSpellId',v_old_spell.id,'replacementFeature','Magic Initiate','spellList',initcap(v_list)
        ),
        updated_at=now()
    where id=v_assignment_id;

    update public.character_option_grant_instances
    set choices=jsonb_set(coalesce(choices,'{}'::jsonb),array[v_choice_field],v_next_choices,true),updated_at=now()
    where character_id=p_character_id and instance_key=v_instance_key;

    select coalesce(sheet,'{}'::jsonb) into v_sheet
    from public.character_sheets where character_id=p_character_id for update;
    v_sheet_instances:=case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end;
    if not exists(select 1 from jsonb_array_elements(v_sheet_instances) item where item->>'instanceId'=v_instance_key) then
      raise exception 'Magic Initiate sheet feat-instance authority is missing.';
    end if;
    select coalesce(jsonb_agg(
      case when item.value->>'instanceId'=v_instance_key
        then jsonb_set(item.value,array['choices',v_choice_field],v_next_choices,true)
        else item.value end
      order by item.ord
    ),'[]'::jsonb)
    into v_next_sheet_instances
    from jsonb_array_elements(v_sheet_instances) with ordinality item(value,ord);
    v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',v_next_sheet_instances,true);
    update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
    update public.players p set sheet=v_sheet,updated_at=now()
    where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','magic-initiate','instanceKey',v_instance_key,'spellList',initcap(v_list),
      'spellLevel',v_new_spell.level,'replaced',v_old_spell.name,'with',v_new_spell.name,'source','XPHB'
    ));
  end loop;
  return v_summary;
end;
$$;

create or replace function private.level_up_replacement_groups_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select coalesce(private.level_up_metamagic_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb)
      || coalesce(private.level_up_mystic_arcanum_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb)
      || coalesce(private.level_up_lore_discoveries_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb)
      || coalesce(private.level_up_magic_initiate_replacement_groups_v1(p_character_id,p_to_level),'[]'::jsonb);
$$;

create or replace function private.apply_level_up_replacements_v1(p_character_id uuid,p_to_level integer,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_summary jsonb:='[]'::jsonb;
  v_part jsonb;
  v_key text;
  v_magic_groups jsonb:=private.level_up_magic_initiate_replacement_groups_v1(p_character_id,p_to_level);
begin
  if jsonb_typeof(v_input)<>'object' then raise exception 'Replacement selections must be a JSON object.'; end if;
  for v_key in select key from jsonb_each(v_input)
  loop
    if v_key not in ('replacement-sorcerer-metamagic','replacement-warlock-mystic-arcanum','replacement-bard-lore-magical-discoveries')
       and not exists(select 1 from jsonb_array_elements(v_magic_groups) g where g->>'id'=v_key) then
      raise exception 'Replacement payload contains an unexpected group: %.',v_key;
    end if;
  end loop;

  v_part:=private.apply_level_up_metamagic_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-sorcerer-metamagic','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  v_part:=private.apply_level_up_mystic_arcanum_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-warlock-mystic-arcanum','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  v_part:=private.apply_level_up_lore_discoveries_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-bard-lore-magical-discoveries','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  v_part:=private.apply_level_up_magic_initiate_replacements_v1(p_character_id,p_to_level,v_input);
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  return v_summary;
end;
$$;

revoke all on function private.level_up_magic_initiate_replacement_groups_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_magic_initiate_replacements_v1(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.level_up_magic_initiate_replacement_groups_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_magic_initiate_replacements_v1(uuid,integer,jsonb) to service_role;
