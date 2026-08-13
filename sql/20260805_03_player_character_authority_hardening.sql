-- Harden player-character feat and spell authority.
-- Player-facing profile/Forge surfaces may select only choices explicitly granted by creation rules.
-- Direct authenticated table writes cannot mutate authoritative feat/spell fields.

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
    'featsTraits'
  ];
  v_protected_meta_keys constant text[] := array[
    'originFeat',
    'backgroundFeatChoice',
    'speciesBonusFeat'
  ];
begin
  -- Trusted SECURITY DEFINER RPCs run as their owner. Direct PostgREST writes run as anon/authenticated.
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
          raise exception 'Authoritative character feature and spell fields must be written through a guarded creation or progression RPC.' using errcode = '42501';
        end if;
      end loop;
      foreach v_key in array v_protected_meta_keys loop
        if coalesce(new.sheet #>> array['meta', v_key], '') <> '' then
          raise exception 'Authoritative character feature metadata must be written through a guarded creation or progression RPC.' using errcode = '42501';
        end if;
      end loop;
      return new;
    end if;

    if tg_op = 'UPDATE' then
      foreach v_key in array v_protected_sheet_keys loop
        if old.sheet -> v_key is distinct from new.sheet -> v_key then
          raise exception 'Players cannot directly change authoritative feats, boons, or spells on a character sheet.' using errcode = '42501';
        end if;
      end loop;
      foreach v_key in array v_protected_meta_keys loop
        if old.sheet #> array['meta', v_key] is distinct from new.sheet #> array['meta', v_key] then
          raise exception 'Players cannot directly change authoritative feat metadata on a character sheet.' using errcode = '42501';
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

drop trigger if exists character_spells_direct_authority_guard_v1 on public.character_spells;
create trigger character_spells_direct_authority_guard_v1
before insert or update or delete on public.character_spells
for each row execute function private.guard_direct_character_authority_mutation_v1();

drop trigger if exists character_option_grants_direct_authority_guard_v1 on public.character_option_grants;
create trigger character_option_grants_direct_authority_guard_v1
before insert or update or delete on public.character_option_grants
for each row execute function private.guard_direct_character_authority_mutation_v1();

drop trigger if exists character_sheets_authority_fields_guard_v1 on public.character_sheets;
create trigger character_sheets_authority_fields_guard_v1
before insert or update of sheet on public.character_sheets
for each row execute function private.guard_direct_character_authority_mutation_v1();

create or replace function private.validate_player_forge_authority_payload_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
  v_creator text;
  v_allowed_feats text[];
  v_sheet_feat_count integer := 0;
  v_invalid_feat_count integer := 0;
  v_sheet_spell_count integer := 0;
  v_actual_spell_count integer := 0;
  v_invalid_sheet_spell_count integer := 0;
  v_missing_sheet_spell_count integer := 0;
begin
  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  v_creator := coalesce(v_sheet #>> '{meta,creator}', '');
  if v_creator <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  if v_sheet ? 'feats' and jsonb_typeof(v_sheet -> 'feats') <> 'array' then
    raise exception 'Player Forge feats must be stored as an array.';
  end if;

  select coalesce(array_agg(distinct lower(btrim(value))) filter (where btrim(value) <> ''), array[]::text[])
    into v_allowed_feats
  from unnest(array[
    coalesce(v_sheet #>> '{meta,originFeat}', ''),
    coalesce(v_sheet #>> '{meta,backgroundFeatChoice}', ''),
    coalesce(v_sheet #>> '{meta,speciesBonusFeat}', '')
  ]) value;

  select count(*), count(*) filter (where lower(btrim(value)) <> all(v_allowed_feats))
    into v_sheet_feat_count, v_invalid_feat_count
  from jsonb_array_elements_text(coalesce(v_sheet -> 'feats', '[]'::jsonb)) value;

  if v_sheet_feat_count > 2 or v_invalid_feat_count > 0 then
    raise exception 'Player Forge creation may include only its recorded background and Species Bonus feat choices.';
  end if;

  if v_sheet ? 'spells' and jsonb_typeof(v_sheet -> 'spells') <> 'array' then
    raise exception 'Player Forge spells must be stored as an array.';
  end if;

  select count(*) into v_sheet_spell_count
  from (select distinct lower(btrim(value)) as spell_name
        from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
        where btrim(value) <> '') names;

  select count(*) into v_actual_spell_count
  from public.character_spells cs
  where cs.character_id = new.character_id and cs.source_type = 'class';

  select count(*) into v_invalid_sheet_spell_count
  from (select distinct lower(btrim(value)) as spell_name
        from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
        where btrim(value) <> '') listed
  where not exists (
    select 1
    from public.character_spells cs
    join public.spells_catalog s on s.id = cs.spell_id
    where cs.character_id = new.character_id
      and cs.source_type = 'class'
      and lower(s.name) = listed.spell_name
  );

  select count(*) into v_missing_sheet_spell_count
  from public.character_spells cs
  join public.spells_catalog s on s.id = cs.spell_id
  where cs.character_id = new.character_id
    and cs.source_type = 'class'
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
      where lower(btrim(value)) = lower(s.name)
    );

  if v_sheet_spell_count <> v_actual_spell_count or v_invalid_sheet_spell_count > 0 or v_missing_sheet_spell_count > 0 then
    raise exception 'The player sheet spell summary must exactly match its validated starting spell assignments.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_player_forge_authority_payload_v1() from public, anon, authenticated;
grant execute on function private.validate_player_forge_authority_payload_v1() to service_role;

drop trigger if exists character_progression_validate_player_forge_authority_v1 on public.character_progression;
create constraint trigger character_progression_validate_player_forge_authority_v1
after insert or update of class_id, class_level
on public.character_progression
deferrable initially deferred
for each row
execute function private.validate_player_forge_authority_payload_v1();
