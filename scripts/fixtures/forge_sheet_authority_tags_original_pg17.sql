-- DnDNext immutable Forge PR #324 -- verified live private functions captured READ-ONLY 2026-11-05.
-- Original SQL text only, unchanged. Disposable PG17/GoTrue fixture; NOT FOR PRODUCTION.
-- md5(pg_get_functiondef) derive_player_character_tags_v1 d62bab7f326330ddbeb6ccede172d19f
CREATE OR REPLACE FUNCTION private.derive_player_character_tags_v1(p_sheet jsonb, p_existing_tags text[] DEFAULT '{}'::text[], p_preserve_campaign_tags boolean DEFAULT true)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb := coalesce(p_sheet, '{}'::jsonb);
  v_tags text[] := '{}'::text[];
  v_species text;
  v_class text;
  v_background text;
  v_profession record;
begin
  if p_preserve_campaign_tags then
    select coalesce(array_agg(distinct lower(btrim(tag)) order by lower(btrim(tag))), '{}'::text[])
      into v_tags
    from unnest(coalesce(p_existing_tags, '{}'::text[])) as tag
    where btrim(tag) <> ''
      and lower(btrim(tag)) <> 'player-character'
      and lower(btrim(tag)) !~ '^(species|class|background|profession):';
  end if;

  v_tags := array_append(v_tags, 'player-character');
  v_species := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,speciesKey}', v_sheet->>'species', v_sheet->>'race'));
  v_class := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,classKey}', v_sheet->>'classKey', v_sheet->>'className', v_sheet->>'class'));
  v_background := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,backgroundKey}', v_sheet->>'background'));

  if v_species is not null then v_tags := array_append(v_tags, 'species:' || v_species); end if;
  if v_class is not null then v_tags := array_append(v_tags, 'class:' || v_class); end if;
  if v_background is not null then v_tags := array_append(v_tags, 'background:' || v_background); end if;

  if jsonb_typeof(v_sheet->'professions') = 'object' then
    for v_profession in
      select key, value
      from jsonb_each(v_sheet->'professions')
    loop
      if coalesce(v_profession.value->>'rank', '') ~ '^[0-9]+$'
         and (v_profession.value->>'rank')::integer > 0 then
        v_tags := array_append(v_tags, 'profession:' || private.player_character_tag_slug_v1(v_profession.key));
      end if;
    end loop;
  end if;

  return (
    select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    from unnest(v_tags) as tag
    where tag is not null and btrim(tag) <> ''
  );
end;
$function$;

-- md5(pg_get_functiondef) guard_direct_character_authority_mutation_v1 04596b0a3fdfb71c1b357056e8c6023b
CREATE OR REPLACE FUNCTION private.guard_direct_character_authority_mutation_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_key text;
  v_protected_sheet_keys constant text[] := array['feats','boons','epicBoons','spells','startingSpellChoices','spellbook','knownSpells','preparedSpells','featsTraits','speciesTraitChoices','speciesSkillChoices','speciesChoiceFeats','speciesSpells','speciesSpellcasting','classFeatureChoices','classFeatureChoiceSummary','classChoiceFeats','sourceChoices','sourceChoiceSummary','featGrantInstances','featSpellChoices','weaponMasteries','expertiseSkills'];
  v_protected_meta_keys constant text[] := array['originFeat','backgroundFeatChoice','speciesBonusFeat','speciesTraitChoices','speciesSkillChoices','speciesChoiceFeats','speciesChoiceFeat','classFeatureChoices','classFeatureChoiceSummary','classChoiceFeats','sourceChoices','sourceChoiceSummary','featGrantInstances','featSpellChoices','weaponMasteries','expertiseSkills'];
begin
  if current_user not in ('anon','authenticated') or coalesce(private.current_user_is_admin(),false) then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_table_name='character_spells' then raise exception 'Players cannot directly add, change, or remove authoritative character spells.' using errcode='42501'; end if;
  if tg_table_name in ('character_option_grants','character_option_grant_instances') then raise exception 'Players cannot directly grant, instance, change, or remove feats and boons.' using errcode='42501'; end if;
  if tg_table_name='character_sheets' then
    if tg_op='INSERT' then
      foreach v_key in array v_protected_sheet_keys loop if new.sheet ? v_key and new.sheet -> v_key not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb) then raise exception 'Authoritative character feature, source-choice, and spell fields must be written through a guarded creation or progression RPC.' using errcode='42501'; end if; end loop;
      foreach v_key in array v_protected_meta_keys loop if new.sheet #> array['meta',v_key] is not null and new.sheet #> array['meta',v_key] not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb) then raise exception 'Authoritative character feature metadata must be written through a guarded creation or progression RPC.' using errcode='42501'; end if; end loop;
      return new;
    end if;
    if tg_op='UPDATE' then
      foreach v_key in array v_protected_sheet_keys loop if old.sheet -> v_key is distinct from new.sheet -> v_key then raise exception 'Players cannot directly change authoritative feats, source choices, boons, or spells on a character sheet.' using errcode='42501'; end if; end loop;
      foreach v_key in array v_protected_meta_keys loop if old.sheet #> array['meta',v_key] is distinct from new.sheet #> array['meta',v_key] then raise exception 'Players cannot directly change authoritative source-choice or feat metadata on a character sheet.' using errcode='42501'; end if; end loop;
      return new;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

-- md5(pg_get_functiondef) player_character_tag_slug_v1 aba97a1c7478159d182e38cda4ca8383
CREATE OR REPLACE FUNCTION private.player_character_tag_slug_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')), '');
$function$;

-- md5(pg_get_functiondef) sync_player_character_tags_from_sheet_v1 a135ca951f81d2a9546d783afe665c52
CREATE OR REPLACE FUNCTION private.sync_player_character_tags_from_sheet_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_existing text[];
begin
  select c.tags into v_existing
  from public.characters c
  where c.id = new.character_id
    and 'player-character' = any(coalesce(c.tags, '{}'::text[]));

  if not found then return new; end if;

  update public.characters
  set tags = private.derive_player_character_tags_v1(
    new.sheet,
    v_existing,
    tg_op = 'UPDATE'
  )
  where id = new.character_id;

  return new;
end;
$function$;
