-- Complete the shared Player Forge -> create_player_character_v3 boundary.
-- v3 owns Spell-step starting magic for native class spells, Background-expanded
-- class access, and XPHB Eldritch Knight / Arcane Trickster spellcasting.
-- Species/feat/class-feature grants remain owned by their separate source systems.

create or replace function public.create_player_character_v3(
  p_payload jsonb,
  p_spell_choices jsonb default '[]'::jsonb,
  p_magic_selections jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_proxy jsonb := coalesce(p_spell_choices, '[]'::jsonb);
  v_magic jsonb := coalesce(p_magic_selections, '[]'::jsonb);
  v_choice jsonb;
  v_spell public.spells_catalog%rowtype;
  v_placeholder public.spells_catalog%rowtype;
  v_class public.class_catalog%rowtype;
  v_character_id uuid;
  v_class_key text := lower(coalesce(nullif(p_payload #>> '{sheet,classKey}', ''), nullif(p_payload #>> '{sheet,meta,classKey}', ''), ''));
  v_class_name text;
  v_subclass_name text := coalesce(nullif(p_payload #>> '{sheet,subclassName}', ''), '');
  v_background_expanded jsonb := coalesce(p_payload #> '{sheet,backgroundExpandedSpells}', '[]'::jsonb);
  v_source_type text;
  v_access_type text;
  v_source_key text;
  v_source_label text;
  v_casting_stat text;
  v_prepared boolean;
  v_level integer;
  v_name text;
  v_seen_proxy uuid[] := '{}'::uuid[];
  v_seen_magic uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_magic) <> 'array' or jsonb_typeof(v_proxy) <> 'array' then
    raise exception 'Starting spell choices must be JSON arrays.';
  end if;
  if jsonb_array_length(v_magic) > 200 then
    raise exception 'Too many starting spell selections.';
  end if;

  select * into v_class
  from public.class_catalog c
  where lower(c.class_key) = v_class_key
  order by case when c.source='XPHB' then 0 when c.source='PHB' then 1 else 2 end, c.updated_at desc
  limit 1;
  if not found then
    raise exception 'The selected class is unavailable for guarded starting-magic validation.';
  end if;
  v_class_name := v_class.class_name;

  select coalesce(array_agg((entry ->> 'spell_id')::uuid), '{}'::uuid[])
  into v_seen_proxy
  from jsonb_array_elements(v_proxy) entry
  where nullif(entry ->> 'spell_id', '') is not null;

  -- Background-expanded selections still consume normal class spell-count slots.
  -- v2 understands only the native class list, so provide a temporary same-level
  -- native proxy solely for its compatibility checks. v3 replaces that row below.
  for v_choice in
    select value from jsonb_array_elements(v_magic)
    where coalesce(value ->> 'source_type', 'class') = 'class'
      and coalesce(value ->> 'access_type', '') = 'background-expanded'
  loop
    begin
      v_level := coalesce((v_choice ->> 'level')::integer, 0);
    exception when others then
      raise exception 'Background-expanded starting magic requires a valid spell level.';
    end;
    select s.* into v_placeholder
    from public.spells_catalog s
    where s.level = v_level
      and exists(select 1 from unnest(coalesce(s.classes, '{}'::text[])) c where lower(c)=lower(v_class_name))
      and not (s.id = any(v_seen_proxy))
      and public.is_preferred_spell_version_v1(s.id)
    order by case when s.source = 'XPHB' then 0 when s.source = 'PHB' then 1 else 2 end, s.name
    limit 1;
    if not found then
      raise exception 'Could not resolve a canonical class-list proxy for Background-expanded spell selection at level %.', v_level;
    end if;
    v_seen_proxy := array_append(v_seen_proxy, v_placeholder.id);
    v_proxy := v_proxy || jsonb_build_array(jsonb_build_object(
      'spell_id', v_placeholder.id,
      'prepared', coalesce((v_choice ->> 'prepared')::boolean, v_level = 0)
    ));
  end loop;

  v_character_id := public.create_player_character_v2(p_payload, v_proxy);

  -- Remove only v2's temporary/base starting rows. Do not delete rows owned by
  -- other source systems if a future immediate materializer adds them here.
  delete from public.character_spells cs
  where cs.character_id = v_character_id
    and coalesce(cs.raw_payload ->> 'creator', '') = 'shared_character_forge_player_v2';

  for v_choice in select value from jsonb_array_elements(v_magic)
  loop
    if nullif(v_choice ->> 'spell_id', '') is null then
      raise exception 'Every starting magic selection requires a canonical spell_id.';
    end if;
    begin
      select s.* into v_spell
      from public.spells_catalog s
      where s.id = (v_choice ->> 'spell_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Every starting magic selection requires a canonical spell_id.';
    end;
    if not found or not public.is_preferred_spell_version_v1(v_spell.id) then
      raise exception 'Starting magic selection references an unavailable or non-preferred spell.';
    end if;
    if v_spell.id = any(v_seen_magic) then
      raise exception 'Duplicate starting magic spell selections are not allowed.';
    end if;
    v_seen_magic := array_append(v_seen_magic, v_spell.id);

    v_source_type := coalesce(nullif(v_choice ->> 'source_type', ''), 'class');
    v_source_key := coalesce(nullif(v_choice ->> 'source_key', ''), v_source_type);
    v_access_type := coalesce(nullif(v_choice ->> 'access_type', ''), case when v_source_type='subclass' then 'subclass' else 'class-list' end);
    v_prepared := coalesce((v_choice ->> 'prepared')::boolean, v_spell.level = 0);
    v_level := v_spell.level;
    v_name := lower(btrim(v_spell.name));

    if v_source_type = 'class' then
      if nullif(v_class.spellcasting_ability, '') is null then
        raise exception '% does not have base-class spellcasting for a class-source starting spell.', v_class_name;
      end if;
      if v_access_type = 'background-expanded' then
        if jsonb_typeof(v_background_expanded) <> 'array'
           or not exists (
             select 1 from jsonb_array_elements_text(v_background_expanded) allowed
             where lower(btrim(allowed)) = v_name
           ) then
          raise exception 'Spell % is not granted to this class by the selected Background.', v_spell.name;
        end if;
      elsif v_access_type = 'class-list' then
        if not exists(select 1 from unnest(coalesce(v_spell.classes, '{}'::text[])) c where lower(c)=lower(v_class_name)) then
          raise exception 'Spell % is not on the selected class list.', v_spell.name;
        end if;
      else
        raise exception 'Unsupported class starting-magic access type %.', v_access_type;
      end if;
      v_source_key := v_class.class_key;
      v_source_label := v_class.class_name;
      v_casting_stat := v_class.spellcasting_ability;
    elsif v_source_type = 'subclass' then
      if not (
        (lower(v_class.class_key) = 'fighter' and lower(v_subclass_name) = 'eldritch knight')
        or (lower(v_class.class_key) = 'rogue' and lower(v_subclass_name) = 'arcane trickster')
      ) then
        raise exception 'Subclass spell source is not valid for % / %.', v_class_name, v_subclass_name;
      end if;
      if v_access_type not in ('subclass','fixed') then
        raise exception 'Unsupported subclass starting-magic access type %.', v_access_type;
      end if;
      if not exists(select 1 from unnest(coalesce(v_spell.classes, '{}'::text[])) c where lower(c)='wizard') then
        raise exception 'Spell % is not on the Wizard list required by this subclass.', v_spell.name;
      end if;
      if v_access_type='fixed'
         and not (lower(v_class.class_key)='rogue' and lower(v_subclass_name)='arcane trickster' and v_spell.level=0 and v_name='mage hand') then
        raise exception 'The fixed subclass starting spell is not valid for %.', v_subclass_name;
      end if;
      v_source_label := v_subclass_name;
      v_casting_stat := 'int';
    else
      raise exception 'Unsupported starting magic source type % in create_player_character_v3.', v_source_type;
    end if;

    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload
    ) values(
      v_character_id,v_spell.id,v_source_type,v_source_key,v_source_label,true,
      case when v_spell.level=0 then true else v_prepared end,
      v_spell.level=0,
      v_casting_stat,
      jsonb_build_object(
        'creator','shared_character_forge_player_v3',
        'startingMagic',true,
        'grantedAtCreationLevel',coalesce(nullif(p_payload #>> '{sheet,level}','')::integer,1),
        'accessType',v_access_type
      )
    )
    on conflict(character_id,spell_id,source_type,source_key) do update
    set known=excluded.known,
        prepared=excluded.prepared,
        always_available=excluded.always_available,
        casting_stat=excluded.casting_stat,
        source_label=excluded.source_label,
        raw_payload=excluded.raw_payload,
        updated_at=now();
  end loop;

  return v_character_id;
end;
$function$;

create or replace function private.validate_player_forge_starting_spells_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_sheet jsonb;
  v_creator text;
  v_class_key text;
  v_class_name text;
  v_class_source text;
  v_subclass_name text;
  v_class_level integer;
  v_class_id uuid;
  v_spellcasting_ability text;
  v_cantrips_required integer := 0;
  v_leveled_required integer := 0;
  v_prepared_required integer := 0;
  v_maximum_spell_level integer := 0;
  v_cantrips_selected integer := 0;
  v_leveled_selected integer := 0;
  v_prepared_selected integer := 0;
  v_invalid_count integer := 0;
  v_fixed_count integer := 0;
  v_spell_slots jsonb;
  v_v3 boolean := false;
  v_background_expanded jsonb := '[]'::jsonb;
begin
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id = new.character_id;
  v_creator := coalesce(v_sheet #>> '{meta,creator}', '');
  if v_creator <> 'shared_character_forge_player_v2' then return new; end if;

  v_v3 := v_sheet ? 'startingMagicSelections';
  if v_v3 and jsonb_typeof(v_sheet->'startingMagicSelections') <> 'array' then
    raise exception 'startingMagicSelections must be a JSON array.';
  end if;
  v_background_expanded := coalesce(v_sheet->'backgroundExpandedSpells','[]'::jsonb);
  v_subclass_name := lower(coalesce(v_sheet->>'subclassName',v_sheet #>> '{meta,subclassName}',''));
  v_class_level := greatest(1, least(20, coalesce(new.class_level, (v_sheet ->> 'level')::integer, 1)));

  select c.id,c.class_key,c.class_name,c.source,c.spellcasting_ability
  into v_class_id,v_class_key,v_class_name,v_class_source,v_spellcasting_ability
  from public.class_catalog_preferred c where c.id=new.class_id limit 1;
  if v_class_id is null then
    raise exception 'The selected class progression could not be validated for starting spells.';
  end if;

  -- XPHB Eldritch Knight / Arcane Trickster own a subclass-source prepared
  -- spell model even though Fighter/Rogue have no base-class spellcasting.
  if nullif(v_spellcasting_ability,'') is null then
    if v_v3 and v_class_source='XPHB' and v_class_level>=3 and (
      (lower(v_class_key)='fighter' and v_subclass_name='eldritch knight')
      or (lower(v_class_key)='rogue' and v_subclass_name='arcane trickster')
    ) then
      v_cantrips_required := case when lower(v_class_key)='fighter' then case when v_class_level>=10 then 3 else 2 end else case when v_class_level>=10 then 4 else 3 end end;
      v_leveled_required := case
        when v_class_level=3 then 3 when v_class_level in (4,5,6) then 4
        when v_class_level=7 then 5 when v_class_level=8 then 6 when v_class_level=9 then 6
        when v_class_level=10 then 7 when v_class_level in (11,12) then 8
        when v_class_level=13 then 9 when v_class_level=14 then 10 when v_class_level=15 then 10
        when v_class_level=16 then 11 when v_class_level in (17,18) then 11
        when v_class_level in (19,20) then 12 + case when v_class_level=20 then 1 else 0 end
        else 0 end;
      v_prepared_required := v_leveled_required;
      v_maximum_spell_level := case when v_class_level between 3 and 6 then 1 when v_class_level between 7 and 12 then 2 when v_class_level between 13 and 18 then 3 else 4 end;

      select
        count(*) filter(where s.level=0),
        count(*) filter(where s.level>0),
        count(*) filter(where s.level>0 and cs.prepared),
        count(*) filter(where
          cs.source_type<>'subclass'
          or s.level<0
          or (s.level>0 and s.level>v_maximum_spell_level)
          or not exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard')
          or coalesce(cs.raw_payload->>'accessType','') not in ('subclass','fixed')
          or (coalesce(cs.raw_payload->>'accessType','')='fixed' and not (lower(v_class_key)='rogue' and v_subclass_name='arcane trickster' and s.level=0 and lower(btrim(s.name))='mage hand'))
        ),
        count(*) filter(where coalesce(cs.raw_payload->>'accessType','')='fixed' and lower(btrim(s.name))='mage hand')
      into v_cantrips_selected,v_leveled_selected,v_prepared_selected,v_invalid_count,v_fixed_count
      from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id
      where cs.character_id=new.character_id and coalesce((cs.raw_payload->>'startingMagic')::boolean,false);

      if v_invalid_count>0 then raise exception 'One or more subclass starting spells are not legal for % level %.',v_subclass_name,v_class_level; end if;
      if lower(v_class_key)='rogue' and v_fixed_count<>1 then raise exception 'Arcane Trickster starting magic requires the fixed Mage Hand cantrip exactly once.'; end if;
      if lower(v_class_key)='fighter' and v_fixed_count<>0 then raise exception 'Eldritch Knight does not have a fixed starting cantrip.'; end if;
      if v_cantrips_selected<>v_cantrips_required then raise exception 'Choose exactly % subclass starting cantrip(s); received %.',v_cantrips_required,v_cantrips_selected; end if;
      if v_leveled_selected<>v_leveled_required then raise exception 'Choose exactly % subclass starting leveled spell(s); received %.',v_leveled_required,v_leveled_selected; end if;
      if v_prepared_selected<>v_prepared_required then raise exception 'Mark exactly % subclass starting leveled spell(s) as prepared; received %.',v_prepared_required,v_prepared_selected; end if;
      return new;
    end if;

    select count(*) into v_invalid_count
    from public.character_spells cs
    where cs.character_id=new.character_id
      and (case when v_v3 then coalesce((cs.raw_payload->>'startingMagic')::boolean,false) else cs.source_type='class' end);
    if v_invalid_count<>0 then raise exception 'This class does not grant starting spell choices at level %.',v_class_level; end if;
    return new;
  end if;

  select coalesce(p.cantrips_known,0),coalesce(p.spells_known,0),coalesce(p.spell_slots,'[]'::jsonb)
  into v_cantrips_required,v_leveled_required,v_spell_slots
  from public.class_level_progression p where p.class_id=v_class_id and p.class_level=v_class_level;
  if not found then raise exception 'The selected class level has no canonical spell progression row.'; end if;

  if jsonb_typeof(v_spell_slots)='array' then
    select coalesce(max((entry.ordinality)::integer) filter(where (entry.value #>> '{}')::integer>0),0)
    into v_maximum_spell_level
    from jsonb_array_elements(v_spell_slots) with ordinality as entry(value,ordinality);
  elsif jsonb_typeof(v_spell_slots)='object' then
    v_maximum_spell_level := greatest(0,coalesce((v_spell_slots->>'pactSlotLevel')::integer,0));
  else
    v_maximum_spell_level := 0;
  end if;

  if lower(v_class_key)='wizard' then
    v_leveled_required := 6 + greatest(0,v_class_level-1)*2;
    v_prepared_required := least(v_leveled_required,coalesce((select p.spells_known from public.class_level_progression p where p.class_id=v_class_id and p.class_level=v_class_level),0));
  else
    v_prepared_required := v_leveled_required;
  end if;

  select
    count(*) filter(where s.level=0 and cs.source_type='class'),
    count(*) filter(where s.level>0 and cs.source_type='class'),
    count(*) filter(where s.level>0 and cs.source_type='class' and cs.prepared),
    count(*) filter(where
      cs.source_type<>'class'
      or s.level<0
      or (s.level>0 and s.level>v_maximum_spell_level)
      or (
        v_v3 and coalesce(cs.raw_payload->>'accessType','class-list') not in ('class-list','background-expanded')
      )
      or not (
        exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c) in (lower(v_class_name),lower(v_class_key)))
        or (
          v_v3
          and coalesce(cs.raw_payload->>'accessType','')='background-expanded'
          and jsonb_typeof(v_background_expanded)='array'
          and exists(select 1 from jsonb_array_elements_text(v_background_expanded) allowed where lower(btrim(allowed))=lower(btrim(s.name)))
        )
      )
    )
  into v_cantrips_selected,v_leveled_selected,v_prepared_selected,v_invalid_count
  from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id
  where cs.character_id=new.character_id
    and (case when v_v3 then coalesce((cs.raw_payload->>'startingMagic')::boolean,false) else cs.source_type='class' end);

  if v_invalid_count>0 then raise exception 'One or more starting spells are not legal for % level %.',v_class_name,v_class_level; end if;
  if v_cantrips_selected<>v_cantrips_required then raise exception 'Choose exactly % starting cantrip(s); received %.',v_cantrips_required,v_cantrips_selected; end if;
  if v_leveled_selected<>v_leveled_required then raise exception 'Choose exactly % starting leveled spell(s); received %.',v_leveled_required,v_leveled_selected; end if;
  if v_prepared_selected<>v_prepared_required then raise exception 'Mark exactly % starting leveled spell(s) as prepared; received %.',v_prepared_required,v_prepared_selected; end if;
  return new;
end;
$function$;

revoke all on function public.create_player_character_v3(jsonb,jsonb,jsonb) from public;
grant execute on function public.create_player_character_v3(jsonb,jsonb,jsonb) to authenticated,service_role;
revoke all on function private.validate_player_forge_starting_spells_v1() from public,anon,authenticated;
grant execute on function private.validate_player_forge_starting_spells_v1() to service_role;
