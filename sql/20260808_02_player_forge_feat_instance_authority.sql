-- Materialize validated feat instances after the guarded player-creation RPC
-- inserts character_progression. This avoids widening create_player_character_v2
-- while still keeping repeatable/nested feat authority server-owned.

create or replace function private.materialize_player_forge_feat_instances_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_sheet jsonb;
  v_instance jsonb;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
begin
  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  perform private.validate_player_forge_feat_instances_v1(v_sheet);

  for v_instance in
    select value from jsonb_array_elements(coalesce(v_sheet -> 'featGrantInstances', '[]'::jsonb))
  loop
    v_option_id := (v_instance ->> 'optionId')::uuid;
    select * into v_catalog
    from public.character_option_catalog
    where id = v_option_id and option_type = 'feat';

    insert into public.character_option_grant_instances(
      character_id,
      option_id,
      option_key,
      option_type,
      option_name,
      option_source,
      instance_key,
      acquisition_owner_type,
      acquisition_owner_key,
      acquisition_label,
      acquisition_level,
      choices,
      effects,
      fixed_spell_tokens,
      repeatable,
      granted_by,
      updated_at
    ) values (
      new.character_id,
      v_catalog.id,
      v_catalog.option_key,
      'feat',
      v_catalog.name,
      v_catalog.source,
      v_instance ->> 'instanceId',
      nullif(v_instance ->> 'acquisitionOwnerType', ''),
      nullif(v_instance ->> 'acquisitionOwnerKey', ''),
      nullif(v_instance ->> 'acquisitionLabel', ''),
      coalesce((v_instance ->> 'acquisitionLevel')::integer, 1),
      coalesce(v_instance -> 'choices', '{}'::jsonb),
      coalesce(v_instance -> 'fixedEffects', '[]'::jsonb),
      coalesce(v_instance -> 'fixedSpellTokens', '[]'::jsonb),
      coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false),
      new.created_by,
      now()
    )
    on conflict (character_id, instance_key) do update
      set choices = excluded.choices,
          effects = excluded.effects,
          fixed_spell_tokens = excluded.fixed_spell_tokens,
          acquisition_owner_type = excluded.acquisition_owner_type,
          acquisition_owner_key = excluded.acquisition_owner_key,
          acquisition_label = excluded.acquisition_label,
          acquisition_level = excluded.acquisition_level,
          updated_at = now();

    insert into public.character_option_grants(character_id, option_id, notes, granted_by, updated_at)
    values (
      new.character_id,
      v_catalog.id,
      'Character Forge feat grant; see character_option_grant_instances for source-owned instance choices.',
      new.created_by,
      now()
    )
    on conflict (character_id, option_id) do nothing;
  end loop;

  return new;
end;
$function$;

drop trigger if exists character_progression_materialize_player_forge_feat_instances_v1 on public.character_progression;
create trigger character_progression_materialize_player_forge_feat_instances_v1
after insert on public.character_progression
for each row execute function private.materialize_player_forge_feat_instances_v1();

create or replace function private.guard_direct_character_authority_mutation_v1()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
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
    'sourceChoices',
    'sourceChoiceSummary',
    'featGrantInstances',
    'featSpellChoices',
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
    'sourceChoices',
    'sourceChoiceSummary',
    'featGrantInstances',
    'featSpellChoices',
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

  if tg_table_name in ('character_option_grants', 'character_option_grant_instances') then
    raise exception 'Players cannot directly grant, instance, change, or remove feats and boons.' using errcode = '42501';
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
$function$;

-- Keep the same direct-mutation guard contract on the new instance table.
drop trigger if exists character_option_grant_instances_direct_authority_guard_v1 on public.character_option_grant_instances;
create trigger character_option_grant_instances_direct_authority_guard_v1
before insert or update or delete on public.character_option_grant_instances
for each row execute function private.guard_direct_character_authority_mutation_v1();
