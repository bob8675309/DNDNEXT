-- DNDNext HELD / UNAPPLIED candidate, 2026-11-05.
-- Stacked research on PR #321. DO NOT run on production without owner-approved
-- coordinated release, P1.3 lock review, creator-trigger + source-truth parity,
-- private/GM secret routing, real signed-in browser acceptance and rollback.
-- This candidate applies ONLY to public player v2/v3; original player v1
-- (historical one-character constraint) and Admin NPC create v1 remain unchanged.
-- Source bodies are copied from live pg_get_functiondef, with only private
-- function names and v3's internal v2 call changed. No class/spell rules rewritten.
DO $source_gate$
BEGIN
 IF md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))
      <> '0351f0a00acae023278e1b8b065b00c9'
    OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))
      <> '6ba73e6f12fcf826cc0a739cce45ff40' THEN
    RAISE EXCEPTION 'Original Forge source drift: stop immutable replay candidate';
 END IF;
 IF to_regclass('private.player_creation_intent_reservations_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'Replay candidate already installed: review before reapplying';
 END IF;
END $source_gate$;

CREATE TABLE private.player_creation_intent_reservations_v1 (
 request_id uuid PRIMARY KEY,
 owner_user_id uuid NOT NULL,
 creation_api text NOT NULL CHECK (creation_api IN ('player-v2','player-v3')),
 intent_sha256 bytea NOT NULL CHECK (octet_length(intent_sha256)=32),
 character_id uuid UNIQUE REFERENCES public.characters(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CONSTRAINT completed_intent_consistent CHECK (character_id IS NULL OR completed_at IS NOT NULL)
);
REVOKE ALL ON private.player_creation_intent_reservations_v1 FROM PUBLIC,anon,authenticated;
ALTER TABLE private.player_creation_intent_reservations_v1 ENABLE ROW LEVEL SECURITY;
-- No authenticated/anon RLS policies; only SECURITY DEFINER function owner.

CREATE OR REPLACE FUNCTION private.reserve_player_creation_intent_v1(
 p_request_id uuid,p_creation_api text,p_payload jsonb,
 p_spell_choices jsonb,p_magic_selections jsonb)
RETURNS TABLE(existing_character_id uuid, must_create boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $body$
DECLARE
 v_caller uuid := auth.uid();
 v_digest bytea;
 v_new uuid;
 v_owner uuid;
 v_api text;
 v_existing_digest bytea;
 v_character uuid;
BEGIN
 IF v_caller IS NULL THEN
   RAISE EXCEPTION 'Sign in is required to create a player character' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL THEN
   RETURN QUERY SELECT NULL::uuid, true;
   RETURN;
 END IF;
 IF p_creation_api NOT IN ('player-v2','player-v3') THEN
   RAISE EXCEPTION 'Unsupported player creation interface' USING ERRCODE='22023';
 END IF;
 -- Canonical JSONB serialization compares the original submitted intent;
 -- no spell/character secret or full sheet is copied into this table.
 v_digest := sha256(convert_to(jsonb_build_array(
    1,p_creation_api,coalesce(p_payload,'{}'::jsonb),
    coalesce(p_spell_choices,'[]'::jsonb),
    coalesce(p_magic_selections,'[]'::jsonb)
 )::text,'UTF8'));
 INSERT INTO private.player_creation_intent_reservations_v1
   (request_id,owner_user_id,creation_api,intent_sha256)
 VALUES(p_request_id,v_caller,p_creation_api,v_digest)
 ON CONFLICT(request_id) DO NOTHING
 RETURNING request_id INTO v_new;
 -- INSERT's unique conflict resolution serializes competing requests.
 SELECT owner_user_id,creation_api,intent_sha256,character_id
 INTO v_owner,v_api,v_existing_digest,v_character
 FROM private.player_creation_intent_reservations_v1
 WHERE request_id=p_request_id FOR UPDATE;
 IF v_owner IS DISTINCT FROM v_caller THEN
   RAISE EXCEPTION 'This creation request belongs to another account' USING ERRCODE='42501';
 END IF;
 IF v_api IS DISTINCT FROM p_creation_api OR v_existing_digest IS DISTINCT FROM v_digest THEN
   RAISE EXCEPTION 'Creation request ID already used for different character or spell selections. Start a new creation request.' USING ERRCODE='22023';
 END IF;
 IF v_new IS NULL THEN
   IF v_character IS NULL THEN
     RAISE EXCEPTION 'Creation request cannot be replayed without a completed original result' USING ERRCODE='55000';
   END IF;
   IF NOT EXISTS (
     SELECT 1 FROM public.characters c
     JOIN public.character_permissions cp ON cp.character_id=c.id
     WHERE c.id=v_character AND c.creation_request_id=p_request_id
       AND cp.user_id=v_caller AND cp.can_edit
   ) THEN
     RAISE EXCEPTION 'Character creation replay is no longer authorized' USING ERRCODE='42501';
   END IF;
   RETURN QUERY SELECT v_character,false;
   RETURN;
 END IF;
 -- Pre-existing creation requests do not carry verifiable original intent.
 -- Fail closed instead of silently authorizing edits to historical records.
 IF EXISTS(SELECT 1 FROM public.characters WHERE creation_request_id=p_request_id) THEN
   RAISE EXCEPTION 'Historical creation request intent is not verifiable; use a new request ID' USING ERRCODE='55000';
 END IF;
 RETURN QUERY SELECT NULL::uuid,true;
END;
$body$;
REVOKE ALL ON FUNCTION private.reserve_player_creation_intent_v1(uuid,text,jsonb,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.complete_player_creation_intent_v1(p_request_id uuid,p_character_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $body$
BEGIN
 IF p_request_id IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.characters
    WHERE id=p_character_id AND creation_request_id=p_request_id) THEN
    RAISE EXCEPTION 'Creation transaction returned a mismatched character' USING ERRCODE='23514';
 END IF;
 UPDATE private.player_creation_intent_reservations_v1
 SET character_id=p_character_id,completed_at=now()
 WHERE request_id=p_request_id AND owner_user_id=auth.uid()
   AND character_id IS NULL;
 IF NOT FOUND THEN
    RAISE EXCEPTION 'Creation intent was not reserved by this authenticated user' USING ERRCODE='42501';
 END IF;
END;
$body$;
REVOKE ALL ON FUNCTION private.complete_player_creation_intent_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

-- Source-pinned internal functions deliberately keep original calculation,
-- table mutations, exception handlers, validation and trigger behavior intact.

CREATE OR REPLACE FUNCTION private.create_player_character_v2_source_20261105(p_payload jsonb, p_spell_choices jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$ declare v_user uuid := auth.uid(); v_payload jsonb := coalesce(p_payload, '{}'::jsonb); v_sheet jsonb; v_name text; v_class_key text; v_level integer; v_class public.class_catalog%rowtype; v_level_row public.class_level_progression%rowtype; v_character_id uuid; v_tags text[] := array['player-character']::text[]; v_creation_request_id uuid; v_portrait_library_id uuid; v_visual_asset_id uuid; v_portrait public.npc_portrait_library%rowtype; v_asset public.npc_visual_assets%rowtype; v_portrait_url text; v_portrait_storage_path text; v_portrait_thumb_url text; v_portrait_shop_url text; v_portrait_source text; v_image_url text; v_sprite_path text; v_sprite_key text; v_sprite_scale double precision; v_choice jsonb; v_spell_id uuid; v_spell public.spells_catalog%rowtype; v_seen uuid[] := '{}'::uuid[]; v_prepared boolean; v_has_spell_choices boolean := false; v_spell_selection_pending boolean := false; begin if v_user is null then raise exception 'Sign in is required to create a player character.' using errcode = '42501'; end if; if jsonb_typeof(v_payload) <> 'object' then raise exception 'Character payload must be a JSON object.'; end if; if jsonb_typeof(coalesce(p_spell_choices, '[]'::jsonb)) <> 'array' then raise exception 'Spell choices must be an array.'; end if; if jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 100 then raise exception 'Too many starting spell choices.'; end if; if nullif(btrim(v_payload->>'creation_request_id'), '') is not null then begin v_creation_request_id := (v_payload->>'creation_request_id')::uuid; exception when invalid_text_representation then raise exception 'creation_request_id must be a valid UUID.'; end; select c.id into v_character_id from public.characters c join public.character_permissions cp on cp.character_id = c.id where c.creation_request_id = v_creation_request_id and cp.user_id = v_user and cp.can_edit limit 1; if found then return v_character_id; end if; if exists (select 1 from public.characters where creation_request_id = v_creation_request_id) then raise exception 'This creation request belongs to another account.' using errcode = '42501'; end if; end if; v_name := btrim(coalesce(v_payload->>'name', '')); if char_length(v_name) < 2 then raise exception 'Character name must be at least 2 characters.'; end if; if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer.'; end if; if exists (select 1 from public.characters where lower(name) = lower(v_name)) then raise exception 'A character named % already exists.', v_name using errcode = '23505'; end if; v_sheet := coalesce(v_payload->'sheet', '{}'::jsonb); if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object.'; end if; v_class_key := lower(btrim(coalesce(v_sheet->>'classKey', v_sheet->'meta'->>'classKey', ''))); if v_class_key = '' or v_class_key = 'civilian' then raise exception 'Choose an adventuring class.'; end if; begin v_level := coalesce(nullif(v_sheet->>'level', '')::integer, 1); exception when invalid_text_representation then raise exception 'Starting level must be a whole number from 1 to 20.'; end; if v_level < 1 or v_level > 20 then raise exception 'Starting level must be between 1 and 20.'; end if; select * into v_class from public.class_catalog where class_key = v_class_key order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end, updated_at desc limit 1; if v_class.id is null then raise exception 'The class % is not available.', v_class_key using errcode = 'P0002'; end if; select * into v_level_row from public.class_level_progression where class_id = v_class.id and class_level = v_level; if v_level_row.class_id is null then raise exception 'Progression metadata for % level % is unavailable.', v_class.class_name, v_level using errcode = 'P0002'; end if; if jsonb_typeof(v_payload->'tags') = 'array' then select array_agg(distinct tag order by tag) into v_tags from (select lower(btrim(value)) as tag from jsonb_array_elements_text(v_payload->'tags') where btrim(value) <> '' union all select 'player-character') normalized; end if; if nullif(btrim(v_payload->>'portrait_library_id'), '') is not null then begin v_portrait_library_id := (v_payload->>'portrait_library_id')::uuid; exception when invalid_text_representation then raise exception 'portrait_library_id must be a valid UUID.'; end; select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active; if not found then raise exception 'Selected portrait is not active or was not found.'; end if; end if; if nullif(btrim(v_payload->>'visual_asset_id'), '') is not null then begin v_visual_asset_id := (v_payload->>'visual_asset_id')::uuid; exception when invalid_text_representation then raise exception 'visual_asset_id must be a valid UUID.'; end; select * into v_asset from public.npc_visual_assets where id = v_visual_asset_id and is_active; if not found then raise exception 'Selected visual asset is not active or was not found.'; end if; if v_portrait_library_id is not null and v_asset.portrait_library_id <> v_portrait_library_id then raise exception 'Selected sprite asset does not belong to the selected portrait.'; end if; if v_portrait_library_id is null then v_portrait_library_id := v_asset.portrait_library_id; select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active; if not found then raise exception 'Sprite asset portrait is not active or was not found.'; end if; end if; end if; v_portrait_storage_path := coalesce(nullif(btrim(v_portrait.storage_path), ''), nullif(btrim(v_payload->>'portrait_storage_path'), '')); v_portrait_url := coalesce(nullif(btrim(v_portrait.public_url), ''), nullif(btrim(v_payload->>'portrait_url'), '')); v_portrait_thumb_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_thumb_url'), '')); v_portrait_shop_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_shop_url'), '')); v_portrait_source := case when v_portrait_library_id is not null then 'library' else coalesce(nullif(btrim(v_payload->>'portrait_source'), ''), 'default') end; v_image_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'image_url'), '')); v_sprite_path := coalesce(nullif(btrim(v_asset.sprite_path), ''), nullif(btrim(v_payload->>'sprite_path'), '')); v_sprite_key := coalesce(case when v_visual_asset_id is not null then v_visual_asset_id::text end, nullif(btrim(v_payload->>'sprite_key'), '')); v_sprite_scale := coalesce(v_asset.default_scale::double precision, nullif(v_payload->>'sprite_scale', '')::double precision); v_has_spell_choices := jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 0; v_spell_selection_pending := v_class.spellcasting_ability is not null and not v_has_spell_choices; v_sheet := v_sheet || jsonb_build_object('classKey', v_class.class_key, 'className', v_class.class_name, 'class', v_class.class_name, 'level', v_level, 'rulesetSource', v_class.source, 'ruleset', v_class.ruleset, 'proficiencyBonus', v_level_row.proficiency_bonus, 'hitDice', v_level::text || 'd' || coalesce(v_class.hit_die, 8)::text, 'spellSlots', v_level_row.spell_slots, 'startingSpellSelectionPending', v_spell_selection_pending); v_sheet := v_sheet || jsonb_build_object('meta', coalesce(v_sheet->'meta', '{}'::jsonb) || jsonb_build_object('classKey', v_class.class_key, 'className', v_class.class_name, 'level', v_level, 'rulesetSource', v_class.source, 'ruleset', v_class.ruleset, 'creator', 'shared_character_forge_player_v2', 'creationRequestId', v_creation_request_id, 'startingSpellSelectionPending', v_spell_selection_pending)); insert into public.characters(name, race, role, description, motivation, quirk, mannerism, voice, secret, affiliation, status, background, tags, kind, storefront_enabled, portrait_library_id, visual_asset_id, creation_request_id, portrait_url, portrait_storage_path, portrait_thumb_url, portrait_shop_url, portrait_source, image_url, sprite_key, sprite_path, sprite_scale, location_id, last_known_location_id, home_location_id, is_hidden, state, updated_at) values (v_name, nullif(btrim(v_payload->>'race'), ''), coalesce(nullif(btrim(v_payload->>'role'), ''), v_class.class_name), nullif(btrim(v_payload->>'description'), ''), nullif(btrim(v_payload->>'motivation'), ''), nullif(btrim(v_payload->>'quirk'), ''), nullif(btrim(v_payload->>'mannerism'), ''), nullif(btrim(v_payload->>'voice'), ''), nullif(btrim(v_payload->>'secret'), ''), nullif(btrim(v_payload->>'affiliation'), ''), 'alive', nullif(btrim(v_payload->>'background'), ''), coalesce(v_tags, array['player-character']::text[]), 'npc', false, v_portrait_library_id, v_visual_asset_id, v_creation_request_id, v_portrait_url, v_portrait_storage_path, v_portrait_thumb_url, v_portrait_shop_url, v_portrait_source, v_image_url, v_sprite_key, v_sprite_path, v_sprite_scale, null, null, null, true, 'resting', now()) returning id into v_character_id; insert into public.character_sheets(character_id, sheet, updated_at) values(v_character_id, v_sheet, now()); insert into public.character_permissions(character_id, user_id, can_inventory, can_edit, can_convert) values(v_character_id, v_user, true, true, false); insert into public.character_progression(character_id, class_id, class_level, experience_points, pending_level_up, created_by, updated_at) values(v_character_id, v_class.id, v_level, v_level_row.xp_threshold, false, v_user, now()) on conflict (character_id) do update set class_id = excluded.class_id, class_level = excluded.class_level, experience_points = excluded.experience_points, pending_level_up = false, created_by = coalesce(public.character_progression.created_by, excluded.created_by), updated_at = now(); insert into public.character_level_events(character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by) values(v_character_id, 'player_character_created', null, v_level, null, v_level_row.xp_threshold, jsonb_build_object('classKey', v_class.class_key, 'source', v_class.source, 'ruleset', v_class.ruleset, 'startingLevel', v_level, 'startingSpellSelectionPending', v_spell_selection_pending), v_user); for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices, '[]'::jsonb)) loop begin v_spell_id := (v_choice->>'spell_id')::uuid; exception when others then raise exception 'Every spell choice must include a valid spell_id.'; end; if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if; v_seen := array_append(v_seen, v_spell_id); select * into v_spell from public.spells_catalog where id = v_spell_id; if v_spell.id is null then raise exception 'A selected spell was not found.' using errcode = 'P0002'; end if; if not exists (select 1 from unnest(coalesce(v_spell.classes, '{}'::text[])) class_name where lower(class_name) = lower(v_class.class_name)) then raise exception '% is not on the % class spell list.', v_spell.name, v_class.class_name; end if; begin v_prepared := coalesce((v_choice->>'prepared')::boolean, false); exception when others then v_prepared := false; end; insert into public.character_spells(character_id, spell_id, source_type, source_label, prepared, always_available, casting_stat, raw_payload) values(v_character_id, v_spell_id, 'class', v_class.class_name, case when v_spell.level = 0 then true else v_prepared end, v_spell.level = 0, v_class.spellcasting_ability, jsonb_build_object('grantedAtCreationLevel', v_level, 'creator', 'shared_character_forge_player_v2')); end loop; insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now(); return v_character_id; exception when unique_violation then if v_creation_request_id is not null then select c.id into v_character_id from public.characters c join public.character_permissions cp on cp.character_id = c.id where c.creation_request_id = v_creation_request_id and cp.user_id = v_user and cp.can_edit limit 1; if found then return v_character_id; end if; end if; raise; end; $function$;
REVOKE ALL ON FUNCTION private.create_player_character_v2_source_20261105(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.create_player_character_v3_source_20261105(p_payload jsonb, p_spell_choices jsonb DEFAULT '[]'::jsonb, p_magic_selections jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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

  v_character_id := private.create_player_character_v2_source_20261105(p_payload, v_proxy);

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
REVOKE ALL ON FUNCTION private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_player_character_v2(
 p_payload jsonb,p_spell_choices jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $body$
DECLARE
 v_req uuid;
 v_existing uuid;
 v_create boolean;
 v_character uuid;
 v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
BEGIN
 IF nullif(btrim(v_payload->>'creation_request_id'),'') IS NOT NULL THEN
   BEGIN v_req := (v_payload->>'creation_request_id')::uuid;
   EXCEPTION WHEN invalid_text_representation THEN
     RAISE EXCEPTION 'creation_request_id must be a valid UUID' USING ERRCODE='22023';
   END;
 END IF;
 SELECT g.existing_character_id,g.must_create INTO v_existing,v_create
 FROM private.reserve_player_creation_intent_v1(
    v_req,'player-v2',p_payload,p_spell_choices,'[]'::jsonb) g;
 IF NOT v_create THEN RETURN v_existing; END IF;
 v_character := private.create_player_character_v2_source_20261105(p_payload,p_spell_choices);
 PERFORM private.complete_player_creation_intent_v1(v_req,v_character);
 RETURN v_character;
END;
$body$;

CREATE OR REPLACE FUNCTION public.create_player_character_v3(
 p_payload jsonb,p_spell_choices jsonb DEFAULT '[]'::jsonb,
 p_magic_selections jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $body$
DECLARE
 v_req uuid;
 v_existing uuid;
 v_create boolean;
 v_character uuid;
 v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
BEGIN
 IF nullif(btrim(v_payload->>'creation_request_id'),'') IS NOT NULL THEN
   BEGIN v_req := (v_payload->>'creation_request_id')::uuid;
   EXCEPTION WHEN invalid_text_representation THEN
     RAISE EXCEPTION 'creation_request_id must be a valid UUID' USING ERRCODE='22023';
   END;
 END IF;
 SELECT g.existing_character_id,g.must_create INTO v_existing,v_create
 FROM private.reserve_player_creation_intent_v1(
   v_req,'player-v3',p_payload,p_spell_choices,p_magic_selections) g;
 IF NOT v_create THEN RETURN v_existing; END IF;
 -- Original source v3 runs original v2 through an internal private copy.
 -- Do not call the public v2 wrapper: the external v3 intent is authoritative.
 v_character := private.create_player_character_v3_source_20261105(
   p_payload,p_spell_choices,p_magic_selections);
 PERFORM private.complete_player_creation_intent_v1(v_req,v_character);
 RETURN v_character;
END;
$body$;

-- CREATE OR REPLACE retains the original public RPC ACL; original private
-- source helpers have no browser EXECUTE grants.
