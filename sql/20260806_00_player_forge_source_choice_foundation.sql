-- Source-backed Species and class-feature choice authority for the shared Player Character Forge.
-- Existing player characters are grandfathered by immutable character id; all characters created
-- after this migration must carry complete source-choice data.

create table if not exists private.player_forge_source_choice_legacy_v1 (
  character_id uuid primary key references public.characters(id) on delete cascade,
  recorded_at timestamptz not null default now()
);

insert into private.player_forge_source_choice_legacy_v1(character_id)
select cs.character_id
from public.character_sheets cs
where cs.sheet #>> '{meta,creator}' = 'shared_character_forge_player_v2'
on conflict (character_id) do nothing;

revoke all on private.player_forge_source_choice_legacy_v1 from public, anon, authenticated;
grant select, insert, update, delete on private.player_forge_source_choice_legacy_v1 to service_role;

create or replace function private.normalize_player_choice_name_v1(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(lower(split_part(coalesce(btrim(p_value), ''), '|', 1)), '[^a-z0-9]+', '', 'g');
$$;

revoke all on function private.normalize_player_choice_name_v1(text) from public, anon, authenticated;
grant execute on function private.normalize_player_choice_name_v1(text) to service_role;

create or replace function private.player_forge_choice_option_is_valid_v1(
  p_class_id uuid,
  p_class_level integer,
  p_subclass_name text,
  p_group jsonb,
  p_selection jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_kind text := coalesce(p_group ->> 'kind', '');
  v_name text := coalesce(p_selection ->> 'name', '');
  v_source text := coalesce(p_selection ->> 'source', '');
  v_source_feature text := coalesce(p_group ->> 'sourceFeature', p_group ->> 'label', '');
  v_class_key text;
  v_class_source text;
begin
  if btrim(v_name) = '' then
    return false;
  end if;

  select cc.class_key, cc.source
    into v_class_key, v_class_source
  from public.class_catalog cc
  where cc.id = p_class_id;

  if v_class_key is null then
    return false;
  end if;

  if v_kind = 'fighting-style' then
    return exists (
      select 1
      from public.character_option_catalog_preferred o
      where o.option_type = 'feat'
        and o.category in ('FS', 'FS:P', 'FS:R')
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
        and (v_source = '' or o.source = v_source)
    );
  end if;

  if v_kind = 'expertise' then
    return exists (
      select 1
      from public.character_option_catalog_preferred o
      where o.option_type = 'skill'
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
    );
  end if;

  if v_kind in ('weapon-mastery', 'kensei-weapon') then
    return exists (
      select 1
      from public.items_catalog i
      where private.normalize_player_choice_name_v1(i.item_name) = private.normalize_player_choice_name_v1(v_name)
        and coalesce(i.item_rarity, '') = 'mundane'
        and coalesce(i.payload ->> 'source', 'XPHB') = coalesce(nullif(v_source, ''), coalesce(i.payload ->> 'source', 'XPHB'))
    );
  end if;

  if coalesce(p_selection ->> 'kind', '') = 'feat' then
    return exists (
      select 1
      from public.character_option_catalog_preferred o
      where o.option_type = 'feat'
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
        and (v_source = '' or o.source = v_source)
    );
  end if;

  return exists (
    select 1
    from public.class_feature_catalog f
    where f.class_key = v_class_key
      and f.class_source = v_class_source
      and f.level <= p_class_level
      and (
        f.feature_type = 'class'
        or (
          f.feature_type = 'subclass'
          and private.normalize_player_choice_name_v1(coalesce(f.subclass_name, f.subclass_short_name, ''))
              = private.normalize_player_choice_name_v1(coalesce(p_subclass_name, ''))
        )
      )
      and (
        private.normalize_player_choice_name_v1(f.name) = private.normalize_player_choice_name_v1(v_source_feature)
        or position(private.normalize_player_choice_name_v1(v_source_feature)
                    in private.normalize_player_choice_name_v1(f.name)) > 0
      )
      and position(
        private.normalize_player_choice_name_v1(v_name)
        in private.normalize_player_choice_name_v1(
          coalesce(f.description, '') || ' ' ||
          coalesce(f.entries::text, '') || ' ' ||
          coalesce(f.raw_payload::text, '')
        )
      ) > 0
  );
end;
$$;

revoke all on function private.player_forge_choice_option_is_valid_v1(uuid, integer, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function private.player_forge_choice_option_is_valid_v1(uuid, integer, text, jsonb, jsonb)
  to service_role;

create or replace function private.guard_direct_character_authority_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_key text;
  v_protected_sheet_keys constant text[] := array[
    'feats',
    'boons',
    'epicBoons',
    'spells',
    'startingSpellChoices',
    'spellbook',
    'knownSpells',
    'preparedSpells',
    'featsTraits',
    'speciesTraitChoices',
    'speciesSkillChoices',
    'speciesChoiceFeats',
    'speciesSpells',
    'speciesSpellcasting',
    'classFeatureChoices',
    'classFeatureChoiceSummary',
    'classChoiceFeats',
    'weaponMasteries',
    'expertiseSkills'
  ];
  v_protected_meta_keys constant text[] := array[
    'originFeat',
    'backgroundFeatChoice',
    'speciesBonusFeat',
    'speciesTraitChoices',
    'speciesSkillChoices',
    'speciesChoiceFeats',
    'speciesChoiceFeat',
    'classFeatureChoices',
    'classFeatureChoiceSummary',
    'classChoiceFeats',
    'weaponMasteries',
    'expertiseSkills'
  ];
begin
  if current_user not in ('anon', 'authenticated') or coalesce(private.current_user_is_admin(), false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'character_spells' then
    raise exception 'Players cannot directly add, change, or remove authoritative character spells.' using errcode = '42501';
  end if;

  if tg_table_name = 'character_option_grants' then
    raise exception 'Players cannot directly grant or remove feats and boons.' using errcode = '42501';
  end if;

  if tg_table_name = 'character_sheets' then
    if tg_op = 'INSERT' then
      foreach v_key in array v_protected_sheet_keys loop
        if new.sheet ? v_key and new.sheet -> v_key not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb, '""'::jsonb) then
          raise exception 'Authoritative character feature, source-choice, and spell fields must be written through a guarded creation or progression RPC.' using errcode = '42501';
        end if;
      end loop;
      foreach v_key in array v_protected_meta_keys loop
        if new.sheet #> array['meta', v_key] is not null
           and new.sheet #> array['meta', v_key] not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb, '""'::jsonb) then
          raise exception 'Authoritative character feature metadata must be written through a guarded creation or progression RPC.' using errcode = '42501';
        end if;
      end loop;
      return new;
    end if;

    if tg_op = 'UPDATE' then
      foreach v_key in array v_protected_sheet_keys loop
        if old.sheet -> v_key is distinct from new.sheet -> v_key then
          raise exception 'Players cannot directly change authoritative feats, source choices, boons, or spells on a character sheet.' using errcode = '42501';
        end if;
      end loop;
      foreach v_key in array v_protected_meta_keys loop
        if old.sheet #> array['meta', v_key] is distinct from new.sheet #> array['meta', v_key] then
          raise exception 'Players cannot directly change authoritative source-choice or feat metadata on a character sheet.' using errcode = '42501';
        end if;
      end loop;
      return new;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_direct_character_authority_mutation_v1() from public, anon, authenticated;
grant execute on function private.guard_direct_character_authority_mutation_v1() to service_role;
