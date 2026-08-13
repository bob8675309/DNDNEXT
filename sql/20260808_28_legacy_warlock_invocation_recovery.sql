-- One-time normalization for XPHB Warlocks created before class-option instance authority.
-- Recovery records the character's current Invocation set; it does not invent historical
-- acquisition order and it cannot be used as an Invocation replacement operation.
-- Lessons of the First Ones is deliberately excluded because its historical Origin-feat
-- effects cannot be reconstructed safely from an Invocation name alone.

create or replace function public.get_character_invocation_recovery_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_expected integer:=0;
  v_actual integer:=0;
  v_legacy jsonb:='[]'::jsonb;
  v_legacy_count integer:=0;
  v_legacy_name text;
  v_option public.class_feature_option_catalog%rowtype;
  v_options jsonb:='[]'::jsonb;
  v_groups jsonb:='[]'::jsonb;
  v_initial jsonb:='{}'::jsonb;
  v_fields jsonb:='[]'::jsonb;
  v_child_options jsonb:='[]'::jsonb;
  v_child_kind text;
  v_child_id text;
  v_slot integer;
  v_group_id text;
  v_recoverable boolean:=true;
  v_reason text:=null;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review this Invocation recovery.' using errcode='42501';
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then
    return jsonb_build_object('required',false,'recoverable',false,'reason','Character progression has not been initialized.');
  end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then
    return jsonb_build_object('required',false,'recoverable',false,'reason','Invocation recovery applies only to 2024 Warlocks.');
  end if;

  v_expected:=private.xphb_warlock_invocation_count_v1(v_progression.class_level);
  select count(*) into v_actual
  from public.character_class_option_grant_instances
  where character_id=p_character_id and option_type='eldritch-invocation';

  if v_actual=v_expected then
    return jsonb_build_object('required',false,'recoverable',true,'level',v_progression.class_level,'expected',v_expected,'actual',v_actual,'groups','[]'::jsonb,'initialSelections','{}'::jsonb);
  end if;
  if v_actual<>0 then
    return jsonb_build_object(
      'required',true,'recoverable',false,'level',v_progression.class_level,'expected',v_expected,'actual',v_actual,
      'reason','This Warlock has a partial normalized Invocation history. A GM must reconcile it before leveling.','groups','[]'::jsonb,'initialSelections','{}'::jsonb
    );
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  v_legacy:=case when jsonb_typeof(v_sheet->'eldritchInvocations')='array' then v_sheet->'eldritchInvocations' else '[]'::jsonb end;
  v_legacy_count:=jsonb_array_length(v_legacy);

  if exists(
    select 1 from jsonb_array_elements_text(v_legacy) entry(value)
    where private.normalize_player_choice_name_v1(entry.value)=private.normalize_player_choice_name_v1('Lessons of the First Ones')
  ) then
    v_recoverable:=false;
    v_reason:='This legacy Warlock records Lessons of the First Ones. Its Origin-feat effects require GM reconciliation before Invocation history can be normalized.';
  elsif v_legacy_count not in (0,v_expected) then
    v_recoverable:=false;
    v_reason:=format('The legacy sheet records %s Invocation name(s), but level %s requires %s. A GM must reconcile the current set first.',v_legacy_count,v_progression.class_level,v_expected);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','eldritch-invocation','description',coalesce(o.description,''),
    'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'repeatable',o.repeatable,'prerequisites',o.prerequisites,'choiceSchema',o.choice_schema)
  ) order by o.name),'[]'::jsonb)
  into v_options
  from public.class_feature_option_catalog o
  where o.option_type='eldritch-invocation'
    and o.source='XPHB'
    and lower(coalesce(o.class_key,''))='warlock'
    and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=v_progression.class_level
    and coalesce(o.choice_schema->>'kind','')<>'origin-feat';

  if not v_recoverable then
    return jsonb_build_object('required',true,'recoverable',false,'level',v_progression.class_level,'expected',v_expected,'actual',v_actual,'reason',v_reason,'groups','[]'::jsonb,'initialSelections','{}'::jsonb,'legacyInvocations',v_legacy);
  end if;

  for v_slot in 1..v_expected loop
    v_group_id:='warlock-invocation-recovery-'||v_slot::text;
    v_fields:=jsonb_build_array(jsonb_build_object(
      'id','invocation','label','Current Invocation '||v_slot::text,'kind','eldritch-invocation','count',1,'required',true,'cadence','level-up','options',v_options,
      'metadata',jsonb_build_object('recovery',true,'slot',v_slot)
    ));

    for v_option in
      select * from public.class_feature_option_catalog o
      where o.option_type='eldritch-invocation'
        and o.source='XPHB'
        and lower(coalesce(o.class_key,''))='warlock'
        and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=v_progression.class_level
        and coalesce(o.choice_schema->>'kind','') in ('warlock-damage-cantrip','warlock-attack-cantrip')
      order by o.name
    loop
      v_child_kind:=coalesce(v_option.choice_schema->>'kind','');
      v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_option.name),'[^a-z0-9]+','-','g'));
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell','description',coalesce(s.description,''),
        'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level)
      ) order by s.name),'[]'::jsonb)
      into v_child_options
      from public.spells_catalog_preferred s
      where s.level=0
        and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='warlock')
        and (coalesce(array_length(s.damage_types,1),0)>0 or coalesce(s.damage_dice,'')<>'')
        and (v_child_kind<>'warlock-attack-cantrip' or coalesce(btrim(s.attack_type),'')<>'')
        and (
          coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)=0
          or (lower(coalesce(s.range_unit,'')) in ('feet','foot','ft') and coalesce(s.range_distance,0)>=(v_option.choice_schema->>'minRangeFeet')::integer)
          or (lower(coalesce(s.range_unit,'')) in ('mile','miles') and coalesce(s.range_distance,0)>0)
        );
      v_fields:=v_fields||jsonb_build_array(jsonb_build_object(
        'id',v_child_id,'label',v_option.name||': affected cantrip','kind','spell','count',1,'required',true,'cadence','level-up','options',v_child_options,
        'activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','invocation','values',jsonb_build_array(v_option.option_key)),
        'metadata',jsonb_build_object('invocationOptionKey',v_option.option_key,'choiceKind',v_child_kind,'distinctPerRepeat',coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false))
      ));
    end loop;

    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id',v_group_id,'ownerType','class-option-recovery','ownerKey','warlock-invocation-recovery-'||v_slot::text,
      'label','Current Eldritch Invocation '||v_slot::text,'source','XPHB','placement','class','level',v_progression.class_level,
      'helper','Record the Invocation currently on the legacy character. This does not replace or retrain an Invocation.',
      'fields',v_fields,'metadata',jsonb_build_object('family','eldritch-invocation-recovery','slot',v_slot,'historicalOrderUnknown',true)
    ));

    if v_legacy_count=v_expected then
      v_legacy_name:=v_legacy->>(v_slot-1);
      select * into v_option
      from public.class_feature_option_catalog o
      where o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
        and private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(v_legacy_name)
        and coalesce(o.choice_schema->>'kind','')<>'origin-feat'
      limit 1;
      if not found then
        return jsonb_build_object('required',true,'recoverable',false,'level',v_progression.class_level,'expected',v_expected,'actual',v_actual,'reason','A legacy Invocation name does not match the canonical 2024 Invocation catalogue. A GM must reconcile it first.','groups','[]'::jsonb,'initialSelections','{}'::jsonb,'legacyInvocations',v_legacy);
      end if;
      v_initial:=jsonb_set(v_initial,array[v_group_id,'invocation'],jsonb_build_array(v_option.option_key),true);
    end if;
  end loop;

  return jsonb_build_object(
    'required',true,'recoverable',true,'level',v_progression.class_level,'expected',v_expected,'actual',v_actual,
    'reason',case when v_legacy_count=v_expected then 'Confirm the current Invocation set and supply any missing dependent cantrip choices.' else 'Record the character''s current Invocation set once before leveling.' end,
    'groups',v_groups,'initialSelections',v_initial,'legacyInvocations',v_legacy
  );
end;
$$;

create or replace function public.recover_character_invocations_v1(
  p_character_id uuid,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_expected integer:=0;
  v_actual integer:=0;
  v_legacy jsonb:='[]'::jsonb;
  v_legacy_names text[]:='{}'::text[];
  v_selected_names text[]:='{}'::text[];
  v_nonrepeatable text[]:='{}'::text[];
  v_seen_children text[]:='{}'::text[];
  v_pending jsonb:='[]'::jsonb;
  v_item jsonb;
  v_slot integer;
  v_group_id text;
  v_invocation_key text;
  v_option public.class_feature_option_catalog%rowtype;
  v_requirement text;
  v_child_kind text;
  v_child_id text;
  v_child_key text;
  v_child_choice jsonb;
  v_child_token text;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_names jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to normalize this Invocation history.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then raise exception 'Invocation recovery selections must be a JSON object.'; end if;

  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then raise exception 'Invocation recovery applies only to 2024 Warlocks.'; end if;

  v_expected:=private.xphb_warlock_invocation_count_v1(v_progression.class_level);
  select count(*) into v_actual from public.character_class_option_grant_instances where character_id=p_character_id and option_type='eldritch-invocation';
  if v_actual=v_expected then return public.get_character_invocation_recovery_v1(p_character_id); end if;
  if v_actual<>0 then raise exception 'Partial normalized Invocation history requires GM reconciliation before recovery.'; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_legacy:=case when jsonb_typeof(v_sheet->'eldritchInvocations')='array' then v_sheet->'eldritchInvocations' else '[]'::jsonb end;
  if jsonb_array_length(v_legacy) not in (0,v_expected) then raise exception 'The legacy Invocation count does not match this Warlock level.'; end if;
  if exists(select 1 from jsonb_array_elements_text(v_legacy) entry(value) where private.normalize_player_choice_name_v1(entry.value)=private.normalize_player_choice_name_v1('Lessons of the First Ones')) then
    raise exception 'Lessons of the First Ones requires GM reconciliation because its historical Origin-feat effects cannot be inferred safely.';
  end if;
  select coalesce(array_agg(private.normalize_player_choice_name_v1(entry.value) order by entry.ord),'{}'::text[])
  into v_legacy_names
  from jsonb_array_elements_text(v_legacy) with ordinality entry(value,ord);

  for v_slot in 1..v_expected loop
    v_group_id:='warlock-invocation-recovery-'||v_slot::text;
    if jsonb_array_length(coalesce(p_selections#>array[v_group_id,'invocation'],'[]'::jsonb))<>1 then raise exception 'Recovery slot % requires exactly one current Invocation.',v_slot; end if;
    v_invocation_key:=p_selections#>array[v_group_id,'invocation']->>0;
    select * into v_option
    from public.class_feature_option_catalog o
    where o.option_key=v_invocation_key and o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
      and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=v_progression.class_level
      and coalesce(o.choice_schema->>'kind','')<>'origin-feat';
    if not found then raise exception 'Recovery slot % contains an unavailable Invocation.',v_slot; end if;

    if not v_option.repeatable then
      if private.normalize_player_choice_name_v1(v_option.name)=any(v_nonrepeatable) then raise exception '% is not repeatable.',v_option.name; end if;
      v_nonrepeatable:=array_append(v_nonrepeatable,private.normalize_player_choice_name_v1(v_option.name));
    end if;
    v_selected_names:=array_append(v_selected_names,private.normalize_player_choice_name_v1(v_option.name));
    v_child_kind:=coalesce(v_option.choice_schema->>'kind','');
    v_child_choice:=null;

    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
      v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_option.name),'[^a-z0-9]+','-','g'));
      if jsonb_array_length(coalesce(p_selections#>array[v_group_id,v_child_id],'[]'::jsonb))<>1 then raise exception '% requires exactly one affected cantrip.',v_option.name; end if;
      v_child_key:=p_selections#>array[v_group_id,v_child_id]->>0;
      begin v_spell_id:=v_child_key::uuid; exception when others then raise exception '% requires a valid cantrip id.',v_option.name; end;
      select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
      if not found or v_spell.level<>0
         or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
         or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
        raise exception '% requires a preferred Warlock damage cantrip.',v_option.name;
      end if;
      if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then raise exception '% requires an attack-roll cantrip.',v_option.name; end if;
      if coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)>0 and not(
        (lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') and coalesce(v_spell.range_distance,0)>=(v_option.choice_schema->>'minRangeFeet')::integer)
        or (lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') and coalesce(v_spell.range_distance,0)>0)
      ) then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
      v_child_choice:=jsonb_build_object('key',v_spell.id::text,'value',v_spell.id::text,'label',v_spell.name,'source',v_spell.source,'kind','spell','metadata',jsonb_build_object('spellId',v_spell.id,'spellKey',v_spell.spell_key));
      v_child_token:=private.normalize_player_choice_name_v1(v_option.name)||'|'||v_spell.id::text;
      if coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then raise exception 'Repeated % instances must use different affected cantrips.',v_option.name; end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    end if;

    v_pending:=v_pending||jsonb_build_array(jsonb_build_object(
      'slot',v_slot,'optionId',v_option.id,'optionKey',v_option.option_key,'name',v_option.name,'source',v_option.source,
      'choices',case when v_child_choice is null then '{}'::jsonb else jsonb_build_object('child',v_child_choice) end
    ));
  end loop;

  if array_length(v_legacy_names,1)=v_expected then
    if (select array_agg(value order by value) from unnest(v_legacy_names) value) is distinct from (select array_agg(value order by value) from unnest(v_selected_names) value) then
      raise exception 'Invocation recovery must preserve the current Invocation names already recorded on the legacy sheet.';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(v_pending) loop
    select * into v_option from public.class_feature_option_catalog where id=(v_item->>'optionId')::uuid;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_option.prerequisites->'requiresOptions','[]'::jsonb)) loop
      if not(private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then raise exception '% requires % to be part of the current Invocation set.',v_option.name,v_requirement; end if;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(v_pending) loop
    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values (
      p_character_id,
      'warlock-invocation-slot-'||(v_item->>'slot'),
      (v_item->>'optionId')::uuid,
      'eldritch-invocation',
      v_progression.class_level,
      coalesce(v_item->'choices','{}'::jsonb),
      jsonb_build_object('source','legacy-recovery','recoveredCurrentState',true,'historicalOrderUnknown',true,'recoveryAtLevel',v_progression.class_level,'slot',(v_item->>'slot')::integer),
      now()
    );
    v_names:=v_names||to_jsonb(v_item->>'name');
  end loop;

  v_sheet:=jsonb_set(v_sheet,'{eldritchInvocations}',v_names,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,invocationRecovery}',jsonb_build_object('version',1,'recoveredAtLevel',v_progression.class_level,'historicalOrderUnknown',true,'recoveredAt',now()),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return public.get_character_invocation_recovery_v1(p_character_id);
end;
$$;

revoke all on function public.get_character_invocation_recovery_v1(uuid) from public;
grant execute on function public.get_character_invocation_recovery_v1(uuid) to authenticated,service_role;
revoke all on function public.recover_character_invocations_v1(uuid,jsonb) from public;
grant execute on function public.recover_character_invocations_v1(uuid,jsonb) to authenticated,service_role;
