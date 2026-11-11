-- I2-C EXACT ORIGINAL signed Forge / signup source from live PG17 read-only.
-- DISPOSABLE LOCAL GoTrue + PostgreSQL only. Install AFTER entire historical
-- I1-B..O suite, not before, preserving all earlier original RED/GREEN logs.
-- No hosted Supabase. No player IDs or sheet contents are copied from live.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('public.create_player_character_v2(jsonb,jsonb)') IS NULL
 OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'I2C must run after the disposable signed original Forge history suite'; END IF;
END $guard$;

-- Only local legacy-v1 spell-amount helper needs two data columns present in
-- current production; original Fighter test source requires zero spells.
ALTER TABLE public.class_level_progression
 ADD COLUMN IF NOT EXISTS cantrips_known integer DEFAULT 0,
 ADD COLUMN IF NOT EXISTS spells_known integer DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.user_profiles(
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'player'
);

-- SOURCE-ORIGINAL public.character_source_priority_v1(p_source text) MD5 fdcc080cd95e6ce282631191869893c1
CREATE OR REPLACE FUNCTION public.character_source_priority_v1(p_source text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case upper(coalesce(p_source,''))
    when 'XPHB' then 0
    when 'EFA' then 1
    when 'TCE' then 2
    when 'PHB' then 3
    else 10
  end;
$function$
;

-- SOURCE-ORIGINAL private.starting_spell_requirements_v2(p_class_id uuid) MD5 878650d06e4b984ae7968359dda4d187
CREATE OR REPLACE FUNCTION private.starting_spell_requirements_v2(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class public.class_catalog%rowtype;
  v_level public.class_level_progression%rowtype;
  v_cantrips integer := 0;
  v_leveled integer := 0;
  v_prepared integer := 0;
begin
  select * into v_class from public.class_catalog where id=p_class_id;
  if v_class.id is null then return jsonb_build_object('cantrips',0,'leveled',0,'prepared',0); end if;
  select * into v_level from public.class_level_progression where class_id=p_class_id and class_level=1;
  v_cantrips := greatest(0,coalesce(v_level.cantrips_known,0));
  if v_class.class_key='wizard' then
    v_leveled := 6;
    v_prepared := greatest(0,coalesce(v_level.spells_known,4));
  elsif v_class.spellcasting_ability is not null then
    v_leveled := greatest(0,coalesce(v_level.spells_known,0));
    v_prepared := v_leveled;
  end if;
  return jsonb_build_object('cantrips',v_cantrips,'leveled',v_leveled,'prepared',v_prepared);
end;
$function$
;

-- SOURCE-ORIGINAL public.create_player_character_v1(p_payload jsonb, p_spell_choices jsonb) MD5 e2db5802f1f51b93f5b9d374a835e4b9
CREATE OR REPLACE FUNCTION public.create_player_character_v1(p_payload jsonb, p_spell_choices jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_user uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
  v_sheet jsonb;
  v_name text;
  v_class_key text;
  v_class public.class_catalog%rowtype;
  v_character_id uuid;
  v_tags text[] := array['player-character']::text[];
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[] := '{}'::uuid[];
  v_prepared boolean;
  v_cantrip_count integer := 0;
  v_leveled_count integer := 0;
  v_prepared_count integer := 0;
  v_requirements jsonb;
  v_required_cantrips integer;
  v_required_leveled integer;
  v_required_prepared integer;
begin
  if v_user is null then
    raise exception 'Sign in is required to create a player character.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Character payload must be a JSON object.';
  end if;
  if jsonb_typeof(coalesce(p_spell_choices,'[]'::jsonb)) <> 'array' then
    raise exception 'Spell choices must be an array.';
  end if;
  if jsonb_array_length(coalesce(p_spell_choices,'[]'::jsonb)) > 12 then
    raise exception 'Too many starting spell choices.';
  end if;

  if exists (
    select 1
    from public.character_permissions cp
    join public.characters c on c.id = cp.character_id
    where cp.user_id = v_user
      and cp.can_edit
      and 'player-character' = any(coalesce(c.tags,'{}'::text[]))
  ) then
    raise exception 'This account already has a linked player character.' using errcode = '23505';
  end if;

  v_name := btrim(coalesce(v_payload->>'name',''));
  if char_length(v_name) < 2 then raise exception 'Character name must be at least 2 characters.'; end if;
  if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer.'; end if;
  if exists (select 1 from public.characters where lower(name)=lower(v_name)) then
    raise exception 'A character named % already exists.', v_name using errcode = '23505';
  end if;

  v_sheet := coalesce(v_payload->'sheet','{}'::jsonb);
  if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object.'; end if;
  v_class_key := lower(btrim(coalesce(v_sheet->>'classKey',v_sheet->'meta'->>'classKey','')));
  if v_class_key = '' or v_class_key = 'civilian' then
    raise exception 'Choose a 2024 adventuring class.';
  end if;

  select * into v_class
  from public.class_catalog
  where class_key = v_class_key
  order by public.character_source_priority_v1(source), source
  limit 1;
  if v_class.id is null then
    raise exception 'The class % is not available.', v_class_key using errcode = 'P0002';
  end if;

  if coalesce(nullif(v_sheet->>'level','')::integer,1) <> 1 then
    raise exception 'New player characters must begin at level 1.';
  end if;

  v_requirements := private.starting_spell_requirements_v2(v_class.id);
  v_required_cantrips := coalesce((v_requirements->>'cantrips')::integer,0);
  v_required_leveled := coalesce((v_requirements->>'leveled')::integer,0);
  v_required_prepared := coalesce((v_requirements->>'prepared')::integer,0);

  for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices,'[]'::jsonb)) loop
    begin
      v_spell_id := (v_choice->>'spell_id')::uuid;
    exception when others then
      raise exception 'Every spell choice must include a valid spell_id.';
    end;
    if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen := array_append(v_seen,v_spell_id);

    select * into v_spell from public.spells_catalog where id = v_spell_id;
    if v_spell.id is null then raise exception 'A selected spell was not found.' using errcode = 'P0002'; end if;
    if not public.is_preferred_spell_version_v1(v_spell.id) then raise exception '% must use the preferred catalog version.', v_spell.name; end if;
    if v_spell.level not in (0,1) then raise exception '% is not a valid level-one spell choice.', v_spell.name; end if;
    if not exists (
      select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) as class_name
      where lower(class_name) = lower(v_class.class_name)
    ) then
      raise exception '% is not on the % class spell list.', v_spell.name, v_class.class_name;
    end if;

    begin
      v_prepared := coalesce((v_choice->>'prepared')::boolean,false);
    exception when others then
      v_prepared := false;
    end;

    if v_spell.level = 0 then
      v_cantrip_count := v_cantrip_count + 1;
    else
      v_leveled_count := v_leveled_count + 1;
      if v_prepared then v_prepared_count := v_prepared_count + 1; end if;
    end if;
  end loop;

  if v_cantrip_count <> v_required_cantrips then
    raise exception 'Choose exactly % starting cantrip(s).', v_required_cantrips;
  end if;
  if v_leveled_count <> v_required_leveled then
    raise exception 'Choose exactly % starting level-one spell(s).', v_required_leveled;
  end if;
  if v_prepared_count <> v_required_prepared then
    raise exception 'Mark exactly % level-one spell(s) as prepared.', v_required_prepared;
  end if;

  if jsonb_typeof(v_payload->'tags') = 'array' then
    select array_agg(distinct tag order by tag) into v_tags
    from (
      select lower(btrim(value)) as tag from jsonb_array_elements_text(v_payload->'tags') where btrim(value) <> ''
      union all select 'player-character'
    ) normalized;
  end if;

  v_sheet := v_sheet
    || jsonb_build_object(
      'classKey',v_class.class_key,
      'className',v_class.class_name,
      'class',v_class.class_name,
      'level',1,
      'rulesetSource',v_class.source,
      'ruleset',v_class.ruleset,
      'proficiencyBonus',2,
      'hitDice','1d' || coalesce(v_class.hit_die,8)::text
    );
  v_sheet := v_sheet || jsonb_build_object(
    'meta',coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
      'classKey',v_class.class_key,
      'className',v_class.class_name,
      'level',1,
      'rulesetSource',v_class.source,
      'ruleset',v_class.ruleset,
      'creator','player_character_creator_v1'
    )
  );

  insert into public.characters(
    name,race,role,description,motivation,quirk,mannerism,voice,secret,affiliation,status,background,tags,kind,
    storefront_enabled,is_hidden,state,updated_at
  ) values (
    v_name,
    nullif(btrim(v_payload->>'race'),''),
    coalesce(nullif(btrim(v_payload->>'role'),''),v_class.class_name),
    nullif(btrim(v_payload->>'description'),''),
    nullif(btrim(v_payload->>'motivation'),''),
    nullif(btrim(v_payload->>'quirk'),''),
    nullif(btrim(v_payload->>'mannerism'),''),
    nullif(btrim(v_payload->>'voice'),''),
    nullif(btrim(v_payload->>'secret'),''),
    nullif(btrim(v_payload->>'affiliation'),''),
    'alive',
    nullif(btrim(v_payload->>'background'),''),
    coalesce(v_tags,array['player-character']::text[]),
    'npc',false,true,'resting',now()
  ) returning id into v_character_id;

  insert into public.character_sheets(character_id,sheet,updated_at)
  values(v_character_id,v_sheet,now());

  insert into public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert)
  values(v_character_id,v_user,true,true,false);

  insert into public.character_progression(
    character_id,class_id,class_level,experience_points,pending_level_up,created_by,updated_at
  ) values(v_character_id,v_class.id,1,0,false,v_user,now());

  insert into public.character_level_events(
    character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
  ) values(
    v_character_id,'player_character_created',null,1,null,0,
    jsonb_build_object('classKey',v_class.class_key,'source','XPHB','ruleset',v_class.ruleset),v_user
  );

  for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices,'[]'::jsonb)) loop
    v_spell_id := (v_choice->>'spell_id')::uuid;
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    begin v_prepared := coalesce((v_choice->>'prepared')::boolean,false); exception when others then v_prepared := false; end;
    insert into public.character_spells(
      character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat,raw_payload
    ) values(
      v_character_id,v_spell_id,'class',v_class.class_name,
      case when v_spell.level=0 then true else v_prepared end,
      v_spell.level=0,
      v_class.spellcasting_ability,
      jsonb_build_object('grantedAtLevel',1,'rulesetSource',v_class.source,'creator','player_character_creator_v1')
    );
  end loop;

  update public.players set name=v_name,sheet=v_sheet,updated_at=now() where user_id=v_user;
  if not found then
    insert into public.players(user_id,name,sheet,updated_at) values(v_user,v_name,v_sheet,now());
  end if;

  return v_character_id;
end;
$function$
;

-- SOURCE-ORIGINAL public.create_player_character_v2(p_payload jsonb, p_spell_choices jsonb) MD5 0351f0a00acae023278e1b8b065b00c9
CREATE OR REPLACE FUNCTION public.create_player_character_v2(p_payload jsonb, p_spell_choices jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$ declare v_user uuid := auth.uid(); v_payload jsonb := coalesce(p_payload, '{}'::jsonb); v_sheet jsonb; v_name text; v_class_key text; v_level integer; v_class public.class_catalog%rowtype; v_level_row public.class_level_progression%rowtype; v_character_id uuid; v_tags text[] := array['player-character']::text[]; v_creation_request_id uuid; v_portrait_library_id uuid; v_visual_asset_id uuid; v_portrait public.npc_portrait_library%rowtype; v_asset public.npc_visual_assets%rowtype; v_portrait_url text; v_portrait_storage_path text; v_portrait_thumb_url text; v_portrait_shop_url text; v_portrait_source text; v_image_url text; v_sprite_path text; v_sprite_key text; v_sprite_scale double precision; v_choice jsonb; v_spell_id uuid; v_spell public.spells_catalog%rowtype; v_seen uuid[] := '{}'::uuid[]; v_prepared boolean; v_has_spell_choices boolean := false; v_spell_selection_pending boolean := false; begin if v_user is null then raise exception 'Sign in is required to create a player character.' using errcode = '42501'; end if; if jsonb_typeof(v_payload) <> 'object' then raise exception 'Character payload must be a JSON object.'; end if; if jsonb_typeof(coalesce(p_spell_choices, '[]'::jsonb)) <> 'array' then raise exception 'Spell choices must be an array.'; end if; if jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 100 then raise exception 'Too many starting spell choices.'; end if; if nullif(btrim(v_payload->>'creation_request_id'), '') is not null then begin v_creation_request_id := (v_payload->>'creation_request_id')::uuid; exception when invalid_text_representation then raise exception 'creation_request_id must be a valid UUID.'; end; select c.id into v_character_id from public.characters c join public.character_permissions cp on cp.character_id = c.id where c.creation_request_id = v_creation_request_id and cp.user_id = v_user and cp.can_edit limit 1; if found then return v_character_id; end if; if exists (select 1 from public.characters where creation_request_id = v_creation_request_id) then raise exception 'This creation request belongs to another account.' using errcode = '42501'; end if; end if; v_name := btrim(coalesce(v_payload->>'name', '')); if char_length(v_name) < 2 then raise exception 'Character name must be at least 2 characters.'; end if; if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer.'; end if; if exists (select 1 from public.characters where lower(name) = lower(v_name)) then raise exception 'A character named % already exists.', v_name using errcode = '23505'; end if; v_sheet := coalesce(v_payload->'sheet', '{}'::jsonb); if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object.'; end if; v_class_key := lower(btrim(coalesce(v_sheet->>'classKey', v_sheet->'meta'->>'classKey', ''))); if v_class_key = '' or v_class_key = 'civilian' then raise exception 'Choose an adventuring class.'; end if; begin v_level := coalesce(nullif(v_sheet->>'level', '')::integer, 1); exception when invalid_text_representation then raise exception 'Starting level must be a whole number from 1 to 20.'; end; if v_level < 1 or v_level > 20 then raise exception 'Starting level must be between 1 and 20.'; end if; select * into v_class from public.class_catalog where class_key = v_class_key order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end, updated_at desc limit 1; if v_class.id is null then raise exception 'The class % is not available.', v_class_key using errcode = 'P0002'; end if; select * into v_level_row from public.class_level_progression where class_id = v_class.id and class_level = v_level; if v_level_row.class_id is null then raise exception 'Progression metadata for % level % is unavailable.', v_class.class_name, v_level using errcode = 'P0002'; end if; if jsonb_typeof(v_payload->'tags') = 'array' then select array_agg(distinct tag order by tag) into v_tags from (select lower(btrim(value)) as tag from jsonb_array_elements_text(v_payload->'tags') where btrim(value) <> '' union all select 'player-character') normalized; end if; if nullif(btrim(v_payload->>'portrait_library_id'), '') is not null then begin v_portrait_library_id := (v_payload->>'portrait_library_id')::uuid; exception when invalid_text_representation then raise exception 'portrait_library_id must be a valid UUID.'; end; select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active; if not found then raise exception 'Selected portrait is not active or was not found.'; end if; end if; if nullif(btrim(v_payload->>'visual_asset_id'), '') is not null then begin v_visual_asset_id := (v_payload->>'visual_asset_id')::uuid; exception when invalid_text_representation then raise exception 'visual_asset_id must be a valid UUID.'; end; select * into v_asset from public.npc_visual_assets where id = v_visual_asset_id and is_active; if not found then raise exception 'Selected visual asset is not active or was not found.'; end if; if v_portrait_library_id is not null and v_asset.portrait_library_id <> v_portrait_library_id then raise exception 'Selected sprite asset does not belong to the selected portrait.'; end if; if v_portrait_library_id is null then v_portrait_library_id := v_asset.portrait_library_id; select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active; if not found then raise exception 'Sprite asset portrait is not active or was not found.'; end if; end if; end if; v_portrait_storage_path := coalesce(nullif(btrim(v_portrait.storage_path), ''), nullif(btrim(v_payload->>'portrait_storage_path'), '')); v_portrait_url := coalesce(nullif(btrim(v_portrait.public_url), ''), nullif(btrim(v_payload->>'portrait_url'), '')); v_portrait_thumb_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_thumb_url'), '')); v_portrait_shop_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_shop_url'), '')); v_portrait_source := case when v_portrait_library_id is not null then 'library' else coalesce(nullif(btrim(v_payload->>'portrait_source'), ''), 'default') end; v_image_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'image_url'), '')); v_sprite_path := coalesce(nullif(btrim(v_asset.sprite_path), ''), nullif(btrim(v_payload->>'sprite_path'), '')); v_sprite_key := coalesce(case when v_visual_asset_id is not null then v_visual_asset_id::text end, nullif(btrim(v_payload->>'sprite_key'), '')); v_sprite_scale := coalesce(v_asset.default_scale::double precision, nullif(v_payload->>'sprite_scale', '')::double precision); v_has_spell_choices := jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 0; v_spell_selection_pending := v_class.spellcasting_ability is not null and not v_has_spell_choices; v_sheet := v_sheet || jsonb_build_object('classKey', v_class.class_key, 'className', v_class.class_name, 'class', v_class.class_name, 'level', v_level, 'rulesetSource', v_class.source, 'ruleset', v_class.ruleset, 'proficiencyBonus', v_level_row.proficiency_bonus, 'hitDice', v_level::text || 'd' || coalesce(v_class.hit_die, 8)::text, 'spellSlots', v_level_row.spell_slots, 'startingSpellSelectionPending', v_spell_selection_pending); v_sheet := v_sheet || jsonb_build_object('meta', coalesce(v_sheet->'meta', '{}'::jsonb) || jsonb_build_object('classKey', v_class.class_key, 'className', v_class.class_name, 'level', v_level, 'rulesetSource', v_class.source, 'ruleset', v_class.ruleset, 'creator', 'shared_character_forge_player_v2', 'creationRequestId', v_creation_request_id, 'startingSpellSelectionPending', v_spell_selection_pending)); insert into public.characters(name, race, role, description, motivation, quirk, mannerism, voice, secret, affiliation, status, background, tags, kind, storefront_enabled, portrait_library_id, visual_asset_id, creation_request_id, portrait_url, portrait_storage_path, portrait_thumb_url, portrait_shop_url, portrait_source, image_url, sprite_key, sprite_path, sprite_scale, location_id, last_known_location_id, home_location_id, is_hidden, state, updated_at) values (v_name, nullif(btrim(v_payload->>'race'), ''), coalesce(nullif(btrim(v_payload->>'role'), ''), v_class.class_name), nullif(btrim(v_payload->>'description'), ''), nullif(btrim(v_payload->>'motivation'), ''), nullif(btrim(v_payload->>'quirk'), ''), nullif(btrim(v_payload->>'mannerism'), ''), nullif(btrim(v_payload->>'voice'), ''), nullif(btrim(v_payload->>'secret'), ''), nullif(btrim(v_payload->>'affiliation'), ''), 'alive', nullif(btrim(v_payload->>'background'), ''), coalesce(v_tags, array['player-character']::text[]), 'npc', false, v_portrait_library_id, v_visual_asset_id, v_creation_request_id, v_portrait_url, v_portrait_storage_path, v_portrait_thumb_url, v_portrait_shop_url, v_portrait_source, v_image_url, v_sprite_key, v_sprite_path, v_sprite_scale, null, null, null, true, 'resting', now()) returning id into v_character_id; insert into public.character_sheets(character_id, sheet, updated_at) values(v_character_id, v_sheet, now()); insert into public.character_permissions(character_id, user_id, can_inventory, can_edit, can_convert) values(v_character_id, v_user, true, true, false); insert into public.character_progression(character_id, class_id, class_level, experience_points, pending_level_up, created_by, updated_at) values(v_character_id, v_class.id, v_level, v_level_row.xp_threshold, false, v_user, now()) on conflict (character_id) do update set class_id = excluded.class_id, class_level = excluded.class_level, experience_points = excluded.experience_points, pending_level_up = false, created_by = coalesce(public.character_progression.created_by, excluded.created_by), updated_at = now(); insert into public.character_level_events(character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by) values(v_character_id, 'player_character_created', null, v_level, null, v_level_row.xp_threshold, jsonb_build_object('classKey', v_class.class_key, 'source', v_class.source, 'ruleset', v_class.ruleset, 'startingLevel', v_level, 'startingSpellSelectionPending', v_spell_selection_pending), v_user); for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices, '[]'::jsonb)) loop begin v_spell_id := (v_choice->>'spell_id')::uuid; exception when others then raise exception 'Every spell choice must include a valid spell_id.'; end; if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if; v_seen := array_append(v_seen, v_spell_id); select * into v_spell from public.spells_catalog where id = v_spell_id; if v_spell.id is null then raise exception 'A selected spell was not found.' using errcode = 'P0002'; end if; if not exists (select 1 from unnest(coalesce(v_spell.classes, '{}'::text[])) class_name where lower(class_name) = lower(v_class.class_name)) then raise exception '% is not on the % class spell list.', v_spell.name, v_class.class_name; end if; begin v_prepared := coalesce((v_choice->>'prepared')::boolean, false); exception when others then v_prepared := false; end; insert into public.character_spells(character_id, spell_id, source_type, source_label, prepared, always_available, casting_stat, raw_payload) values(v_character_id, v_spell_id, 'class', v_class.class_name, case when v_spell.level = 0 then true else v_prepared end, v_spell.level = 0, v_class.spellcasting_ability, jsonb_build_object('grantedAtCreationLevel', v_level, 'creator', 'shared_character_forge_player_v2')); end loop; insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now(); return v_character_id; exception when unique_violation then if v_creation_request_id is not null then select c.id into v_character_id from public.characters c join public.character_permissions cp on cp.character_id = c.id where c.creation_request_id = v_creation_request_id and cp.user_id = v_user and cp.can_edit limit 1; if found then return v_character_id; end if; end if; raise; end; $function$
;

-- SOURCE-ORIGINAL public.sync_user_profile() MD5 dd7113eec05655a661309838acce6030
CREATE OR REPLACE FUNCTION public.sync_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  profile_name text;
BEGIN
  profile_name := left(
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data->>'character_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      'New Player'
    ),
    80
  );

  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'player')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.players (user_id, name)
  VALUES (NEW.id, profile_name)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

DO $hashes$
BEGIN
 IF md5(pg_get_functiondef('private.starting_spell_requirements_v2(uuid)'::regprocedure))<>'878650d06e4b984ae7968359dda4d187' THEN RAISE EXCEPTION 'I2C exact original function changed: private.starting_spell_requirements_v2'; END IF;
 IF md5(pg_get_functiondef('public.character_source_priority_v1(text)'::regprocedure))<>'fdcc080cd95e6ce282631191869893c1' THEN RAISE EXCEPTION 'I2C exact original function changed: public.character_source_priority_v1'; END IF;
 IF md5(pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)'::regprocedure))<>'e2db5802f1f51b93f5b9d374a835e4b9' THEN RAISE EXCEPTION 'I2C exact original function changed: public.create_player_character_v1'; END IF;
 IF md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))<>'0351f0a00acae023278e1b8b065b00c9' THEN RAISE EXCEPTION 'I2C exact original function changed: public.create_player_character_v2'; END IF;
 IF md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030' THEN RAISE EXCEPTION 'I2C exact original function changed: public.sync_user_profile'; END IF;
END $hashes$;

REVOKE ALL ON FUNCTION public.create_player_character_v1(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_player_character_v1(jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_player_character_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_player_character_v2(jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_user_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.starting_spell_requirements_v2(uuid) FROM PUBLIC,anon,authenticated;

-- Unique scratch trigger name; exact original trigger FUNCTION body unchanged.
CREATE TRIGGER i2c_auth_user_profile_after_insert
 AFTER INSERT ON auth.users FOR EACH ROW
 EXECUTE FUNCTION public.sync_user_profile();
NOTIFY pgrst,'reload schema';
\echo 'PASS I2C-ORIGINAL: five original live functions source-hash-verified, signup trigger and Fighter spell helper in disposable signed Forge'
