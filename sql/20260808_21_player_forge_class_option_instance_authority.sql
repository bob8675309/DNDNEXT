-- Normalized per-acquisition class option authority for Player Forge.
-- Initial family: XPHB Eldritch Invocations. The table is intentionally generic so
-- Maneuvers, Arcane Shots, Runes, and other optional-feature families can reuse it.

create table if not exists public.character_class_option_grant_instances (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  instance_key text not null,
  option_catalog_id uuid not null references public.class_feature_option_catalog(id) on delete restrict,
  option_type text not null,
  acquired_level integer not null check (acquired_level between 1 and 20),
  choices jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id, instance_key)
);
create index if not exists character_class_option_instances_character_idx
  on public.character_class_option_grant_instances(character_id, option_type, acquired_level);

alter table public.character_class_option_grant_instances enable row level security;
drop policy if exists character_class_option_grant_instances_rpc_only on public.character_class_option_grant_instances;
create policy character_class_option_grant_instances_rpc_only
on public.character_class_option_grant_instances
for all to anon, authenticated
using (false) with check (false);

create or replace function private.guard_direct_class_option_authority_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, auth
as $$
begin
  if current_user in ('anon','authenticated') and not coalesce(private.current_user_is_admin(),false) then
    raise exception 'Players cannot directly grant, change, or remove authoritative class option instances.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists character_class_option_instances_direct_authority_guard_v1 on public.character_class_option_grant_instances;
create trigger character_class_option_instances_direct_authority_guard_v1
before insert or update or delete on public.character_class_option_grant_instances
for each row execute function private.guard_direct_class_option_authority_mutation_v1();

create or replace function private.xphb_warlock_invocation_count_v1(p_level integer)
returns integer language sql immutable set search_path=pg_catalog as $$
  select case
    when greatest(1,least(20,coalesce(p_level,1))) >= 18 then 10
    when greatest(1,least(20,coalesce(p_level,1))) >= 15 then 9
    when greatest(1,least(20,coalesce(p_level,1))) >= 12 then 8
    when greatest(1,least(20,coalesce(p_level,1))) >= 9 then 7
    when greatest(1,least(20,coalesce(p_level,1))) >= 7 then 6
    when greatest(1,least(20,coalesce(p_level,1))) >= 5 then 5
    when greatest(1,least(20,coalesce(p_level,1))) >= 2 then 3
    else 1 end;
$$;

create or replace function private.xphb_warlock_invocation_slot_level_v1(p_slot integer)
returns integer language sql immutable set search_path=pg_catalog as $$
  select case greatest(1,least(10,coalesce(p_slot,1)))
    when 1 then 1 when 2 then 2 when 3 then 2 when 4 then 5 when 5 then 5
    when 6 then 7 when 7 then 9 when 8 then 12 when 9 then 15 when 10 then 18 end;
$$;

create or replace function private.validate_and_materialize_player_forge_class_options_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_choices jsonb := '{}'::jsonb;
  v_class_key text;
  v_class_source text;
  v_expected integer := 0;
  v_actual integer := 0;
  v_slot integer;
  v_slot_level integer;
  v_group_key text;
  v_group jsonb;
  v_invocation_field jsonb;
  v_invocation_selection jsonb;
  v_option public.class_feature_option_catalog%rowtype;
  v_option_key text;
  v_requirement text;
  v_selected_names text[] := '{}'::text[];
  v_seen_children text[] := '{}'::text[];
  v_child_kind text;
  v_child_field jsonb;
  v_child_selection jsonb;
  v_child_key text;
  v_child_token text;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_feat_id uuid;
  v_legacy boolean := false;
  v_class_option_group_count integer := 0;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs where cs.character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','') <> 'shared_character_forge_player_v2' then return new; end if;

  select lower(cc.class_key), upper(cc.source) into v_class_key,v_class_source
  from public.class_catalog cc where cc.id=new.class_id;
  v_choices := case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end;

  select count(*) into v_class_option_group_count
  from jsonb_each(v_choices) entry
  where entry.value->>'ownerType'='class-option'
    and entry.value #>> '{metadata,family}'='eldritch-invocation';

  if v_class_key <> 'warlock' or v_class_source <> 'XPHB' then
    if v_class_option_group_count > 0 then
      raise exception 'Eldritch Invocation source choices are only valid for an XPHB Warlock.';
    end if;
    return new;
  end if;

  select exists(
    select 1 from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) legacy
    where legacy.value->>'kind'='eldritch-invocation'
  ) or exists(
    select 1 from private.player_forge_source_choice_legacy_v1 legacy where legacy.character_id=new.character_id
  ) into v_legacy;

  v_expected := private.xphb_warlock_invocation_count_v1(new.class_level);
  if v_class_option_group_count=0 and v_legacy then return new; end if;
  if v_class_option_group_count <> v_expected then
    raise exception 'Warlock level % requires exactly % source-owned Eldritch Invocation instance(s); received %.',new.class_level,v_expected,v_class_option_group_count;
  end if;

  delete from public.character_class_option_grant_instances
  where character_id=new.character_id and option_type='eldritch-invocation';

  for v_slot in 1..v_expected loop
    v_slot_level := private.xphb_warlock_invocation_slot_level_v1(v_slot);
    v_group_key := 'warlock-invocation-slot-' || v_slot::text;
    v_group := v_choices -> v_group_key;
    if jsonb_typeof(v_group) <> 'object'
       or v_group->>'ownerType' <> 'class-option'
       or v_group #>> '{metadata,family}' <> 'eldritch-invocation'
       or coalesce((v_group #>> '{metadata,slot}')::integer,0) <> v_slot
       or coalesce((v_group #>> '{metadata,acquisitionLevel}')::integer,0) <> v_slot_level
       or coalesce((v_group->>'level')::integer,0) <> v_slot_level
       or v_group->>'placement' <> 'class' then
      raise exception 'Warlock Invocation instance % has an invalid source-owned group shape.',v_slot;
    end if;

    v_invocation_field := v_group #> '{fields,invocation}';
    if jsonb_typeof(v_invocation_field) <> 'object'
       or jsonb_typeof(coalesce(v_invocation_field->'selections','[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_invocation_field->'selections','[]'::jsonb)) <> 1 then
      raise exception 'Warlock Invocation instance % requires exactly one Invocation selection.',v_slot;
    end if;
    v_invocation_selection := (v_invocation_field->'selections')->0;
    v_option_key := coalesce(v_invocation_selection->>'key','');
    select * into v_option from public.class_feature_option_catalog o
    where o.option_key=v_option_key and o.option_type='eldritch-invocation'
      and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock';
    if not found then raise exception 'Warlock Invocation instance % contains an unknown Invocation option.',v_slot; end if;
    if coalesce((v_option.prerequisites->>'minClassLevel')::integer,1) > v_slot_level then
      raise exception '% is not available at the acquisition level for Invocation slot %.',v_option.name,v_slot;
    end if;
    if not v_option.repeatable and private.normalize_player_choice_name_v1(v_option.name)=any(v_selected_names) then
      raise exception '% is not repeatable and cannot fill multiple Invocation slots.',v_option.name;
    end if;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_option.prerequisites->'requiresOptions','[]'::jsonb)) loop
      if not (private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then
        raise exception '% requires % to have been acquired in an earlier Invocation slot.',v_option.name,v_requirement;
      end if;
    end loop;

    v_child_kind := coalesce(v_option.choice_schema->>'kind','');
    v_child_field := null;
    select field.value into v_child_field
    from jsonb_each(case when jsonb_typeof(v_group->'fields')='object' then v_group->'fields' else '{}'::jsonb end) field
    where field.key <> 'invocation'
      and exists(
        select 1 from jsonb_array_elements_text(coalesce(field.value #> '{activeWhen,values}','[]'::jsonb)) active_key
        where active_key=v_option.option_key
      )
    limit 1;

    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip','origin-feat') then
      if jsonb_typeof(v_child_field) <> 'object'
         or jsonb_array_length(coalesce(v_child_field->'selections','[]'::jsonb)) <> 1 then
        raise exception '% requires exactly one dependent source choice.',v_option.name;
      end if;
      v_child_selection := (v_child_field->'selections')->0;
      v_child_key := coalesce(v_child_selection->>'value',v_child_selection->>'key','');
      v_child_token := private.normalize_player_choice_name_v1(v_option.name) || '|' || v_child_key;
      if coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_option.name;
      end if;
      v_seen_children := array_append(v_seen_children,v_child_token);

      if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
        begin v_spell_id := v_child_key::uuid; exception when others then raise exception '% requires a valid cantrip id.',v_option.name; end;
        select * into v_spell from public.spells_catalog s where s.id=v_spell_id;
        if not found or not public.is_preferred_spell_version_v1(v_spell.id)
           or v_spell.level<>0
           or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
           or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
          raise exception '% requires a preferred Warlock damage cantrip.',v_option.name;
        end if;
        if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then
          raise exception '% requires a Warlock cantrip that deals damage with an attack roll.',v_option.name;
        end if;
        if coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)>0 then
          if lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') then
            if coalesce(v_spell.range_distance,0) < (v_option.choice_schema->>'minRangeFeet')::integer then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
          elsif lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') then
            if coalesce(v_spell.range_distance,0)<=0 then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
          else
            raise exception '% requires a cantrip with a measurable range.',v_option.name;
          end if;
        end if;
      elsif v_child_kind='origin-feat' then
        begin v_feat_id := v_child_key::uuid; exception when others then raise exception 'Lessons of the First Ones requires a valid Origin feat id.'; end;
        if not exists(select 1 from public.character_option_catalog_preferred f where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_option.choice_schema->>'category','O')) then
          raise exception 'Lessons of the First Ones requires a source-valid Origin feat.';
        end if;
        if not exists(
          select 1 from jsonb_array_elements(coalesce(v_sheet->'featGrantInstances','[]'::jsonb)) instance
          where instance->>'acquisitionOwnerType'='class-option'
            and instance->>'acquisitionOwnerKey'=v_group_key
            and instance->>'optionId'=v_feat_id::text
        ) then
          raise exception 'Lessons of the First Ones feat instance must match its Invocation source choice.';
        end if;
      end if;
    else
      if exists(
        select 1 from jsonb_each(case when jsonb_typeof(v_group->'fields')='object' then v_group->'fields' else '{}'::jsonb end) field
        where field.key<>'invocation' and jsonb_array_length(coalesce(field.value->'selections','[]'::jsonb))>0
      ) then
        raise exception '% does not accept a permanent dependent creation choice.',v_option.name;
      end if;
      v_child_selection := null;
    end if;

    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,v_group_key,v_option.id,'eldritch-invocation',v_slot_level,
      case when v_child_selection is null then '{}'::jsonb else jsonb_build_object('child',v_child_selection) end,
      jsonb_build_object('source','player-forge','slot',v_slot,'family','eldritch-invocation'),now()
    );
    v_selected_names := array_append(v_selected_names,private.normalize_player_choice_name_v1(v_option.name));
  end loop;
  return new;
end;
$$;

revoke all on function private.validate_and_materialize_player_forge_class_options_v1() from public,anon,authenticated;
grant execute on function private.validate_and_materialize_player_forge_class_options_v1() to service_role;

drop trigger if exists character_progression_validate_player_forge_class_options_v1 on public.character_progression;
create constraint trigger character_progression_validate_player_forge_class_options_v1
after insert or update of class_id,class_level,level_choices on public.character_progression
deferrable initially deferred
for each row execute function private.validate_and_materialize_player_forge_class_options_v1();

create or replace function public.get_character_class_option_grants_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to view these character class options.' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',g.id,'instanceKey',g.instance_key,'optionId',o.id,'optionKey',o.option_key,
      'optionType',o.option_type,'name',o.name,'source',o.source,'acquiredLevel',g.acquired_level,
      'repeatable',o.repeatable,'prerequisites',o.prerequisites,'choiceSchema',o.choice_schema,
      'choices',g.choices,'metadata',g.metadata
    ) order by g.acquired_level,g.instance_key)
    from public.character_class_option_grant_instances g
    join public.class_feature_option_catalog o on o.id=g.option_catalog_id
    where g.character_id=p_character_id
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.get_character_class_option_grants_v1(uuid) from public;
grant execute on function public.get_character_class_option_grants_v1(uuid) to authenticated,service_role;
