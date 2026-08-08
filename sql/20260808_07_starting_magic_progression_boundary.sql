-- Starting-magic exactness must remain strict without preventing later level-up
-- spell grants. Mark rows created by the Forge's starting-magic transaction and
-- scope the deferred exactness check to those rows only.

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
  v_character_id uuid;
  v_class_name text := coalesce(nullif(p_payload #>> '{sheet,className}', ''), nullif(p_payload #>> '{sheet,class}', ''), '');
  v_subclass_name text := coalesce(nullif(p_payload #>> '{sheet,subclassName}', ''), '');
  v_background_expanded jsonb := coalesce(p_payload #> '{sheet,backgroundExpandedSpells}', '[]'::jsonb);
  v_source_type text;
  v_access_type text;
  v_source_key text;
  v_prepared boolean;
  v_level integer;
  v_name text;
  v_seen_proxy uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if jsonb_typeof(v_magic) <> 'array' or jsonb_typeof(v_proxy) <> 'array' then raise exception 'Starting spell choices must be JSON arrays.'; end if;
  if jsonb_array_length(v_magic) > 200 then raise exception 'Too many starting spell selections.'; end if;

  select coalesce(array_agg((entry ->> 'spell_id')::uuid), '{}'::uuid[])
  into v_seen_proxy
  from jsonb_array_elements(v_proxy) entry
  where nullif(entry ->> 'spell_id', '') is not null;

  for v_choice in
    select value from jsonb_array_elements(v_magic)
    where coalesce(value ->> 'source_type', 'class') = 'class'
      and coalesce(value ->> 'access_type', '') = 'background-expanded'
  loop
    v_level := coalesce((v_choice ->> 'level')::integer, 0);
    select s.* into v_placeholder
    from public.spells_catalog s
    where s.level = v_level
      and v_class_name = any(coalesce(s.classes, '{}'::text[]))
      and not (s.id = any(v_seen_proxy))
    order by case when s.source = 'XPHB' then 0 when s.source = 'PHB' then 1 else 2 end, s.name
    limit 1;
    if not found then raise exception 'Could not resolve a canonical class-list proxy for Background-expanded spell selection at level %.', v_level; end if;
    v_seen_proxy := array_append(v_seen_proxy, v_placeholder.id);
    v_proxy := v_proxy || jsonb_build_array(jsonb_build_object('spell_id', v_placeholder.id, 'prepared', coalesce((v_choice ->> 'prepared')::boolean, v_level = 0)));
  end loop;

  v_character_id := public.create_player_character_v2(p_payload, v_proxy);
  delete from public.character_spells where character_id = v_character_id;

  for v_choice in select value from jsonb_array_elements(v_magic)
  loop
    if nullif(v_choice ->> 'spell_id', '') is null then raise exception 'Every starting magic selection requires a canonical spell_id.'; end if;
    select s.* into v_spell from public.spells_catalog s where s.id = (v_choice ->> 'spell_id')::uuid;
    if not found then raise exception 'Starting magic selection references an unavailable spell.'; end if;
    v_source_type := coalesce(nullif(v_choice ->> 'source_type', ''), 'class');
    v_source_key := coalesce(nullif(v_choice ->> 'source_key', ''), v_source_type);
    v_access_type := coalesce(nullif(v_choice ->> 'access_type', ''), 'class-list');
    v_prepared := coalesce((v_choice ->> 'prepared')::boolean, v_spell.level = 0);
    v_name := lower(btrim(v_spell.name));

    if v_source_type = 'class' then
      if v_access_type = 'background-expanded' then
        if jsonb_typeof(v_background_expanded) <> 'array' or not exists (
          select 1 from jsonb_array_elements_text(v_background_expanded) allowed where lower(btrim(allowed)) = v_name
        ) then raise exception 'Spell % is not granted to this class by the selected Background.', v_spell.name; end if;
      elsif not (v_class_name = any(coalesce(v_spell.classes, '{}'::text[]))) then
        raise exception 'Spell % is not on the selected class list.', v_spell.name;
      end if;
    elsif v_source_type = 'subclass' then
      if not ((lower(v_class_name) = 'fighter' and lower(v_subclass_name) = 'eldritch knight') or (lower(v_class_name) = 'rogue' and lower(v_subclass_name) = 'arcane trickster')) then
        raise exception 'Subclass spell source is not valid for % / %.', v_class_name, v_subclass_name;
      end if;
      if not ('Wizard' = any(coalesce(v_spell.classes, '{}'::text[]))) then raise exception 'Spell % is not on the Wizard list required by this subclass.', v_spell.name; end if;
    else
      raise exception 'Unsupported starting magic source type % in create_player_character_v3.', v_source_type;
    end if;

    insert into public.character_spells(character_id, spell_id, source_type, source_key, known, prepared, raw_payload)
    values (
      v_character_id, v_spell.id, v_source_type, v_source_key, true, v_prepared,
      jsonb_build_object('creator','shared_character_forge_player_v3','startingMagic',true,'grantedAtCreationLevel',coalesce(nullif(p_payload #>> '{sheet,level}','')::integer,1),'accessType',v_access_type)
    )
    on conflict (character_id, spell_id, source_type, source_key) do update
      set known = excluded.known, prepared = excluded.prepared, raw_payload = excluded.raw_payload;
  end loop;

  return v_character_id;
end;
$function$;

create or replace function private.validate_player_forge_starting_magic_exactness_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_sheet jsonb;
  v_expected jsonb;
  v_expected_count integer;
  v_actual_count integer;
begin
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id = new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then return new; end if;

  v_expected := coalesce(v_sheet -> 'startingMagicSelections', '[]'::jsonb);
  if jsonb_typeof(v_expected) <> 'array' then raise exception 'startingMagicSelections must be a JSON array.'; end if;
  select count(*) into v_expected_count from jsonb_array_elements(v_expected);
  select count(*) into v_actual_count
  from public.character_spells
  where character_id = new.character_id and coalesce((raw_payload ->> 'startingMagic')::boolean, false);

  if v_expected_count <> v_actual_count then raise exception 'Starting magic summary does not match authoritative starting spell rows.'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_expected) expected
    where not exists (
      select 1 from public.character_spells cs
      where cs.character_id = new.character_id
        and coalesce((cs.raw_payload ->> 'startingMagic')::boolean, false)
        and cs.spell_id = (expected ->> 'spell_id')::uuid
        and cs.source_type = coalesce(nullif(expected ->> 'source_type', ''), 'class')
        and cs.source_key = coalesce(nullif(expected ->> 'source_key', ''), coalesce(nullif(expected ->> 'source_type', ''), 'class'))
        and cs.prepared = coalesce((expected ->> 'prepared')::boolean, false)
    )
  ) then raise exception 'Starting magic summary contains a spell/source/prepared state that was not materialized.'; end if;
  return new;
end;
$function$;
