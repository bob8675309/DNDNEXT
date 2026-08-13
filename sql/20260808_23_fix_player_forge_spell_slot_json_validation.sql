-- The canonical class_level_progression.spell_slots column is jsonb.
-- The deferred shared-Forge validator previously attempted to coalesce it with integer[],
-- which only surfaced when the first shared-Forge spellcaster reached deferred validation.

create or replace function private.validate_player_forge_starting_spells_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
  v_creator text;
  v_class_key text;
  v_class_name text;
  v_class_source text;
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
  v_spell_slots jsonb;
begin
  select cs.sheet
    into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  v_creator := coalesce(v_sheet #>> '{meta,creator}', '');
  if v_creator <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  v_class_key := lower(coalesce(v_sheet #>> '{meta,classKey}', v_sheet ->> 'classKey', ''));
  v_class_name := coalesce(v_sheet #>> '{meta,className}', v_sheet ->> 'className', v_sheet ->> 'class', '');
  v_class_source := coalesce(v_sheet #>> '{meta,classSource}', '');
  v_class_level := greatest(1, least(20, coalesce(new.class_level, (v_sheet ->> 'level')::integer, 1)));

  select c.id, c.class_key, c.class_name, c.source, c.spellcasting_ability
    into v_class_id, v_class_key, v_class_name, v_class_source, v_spellcasting_ability
  from public.class_catalog_preferred c
  where c.id = new.class_id
  limit 1;

  if v_class_id is null then
    raise exception 'The selected class progression could not be validated for starting spells.';
  end if;

  if nullif(v_spellcasting_ability, '') is null then
    select count(*) into v_invalid_count
    from public.character_spells cs
    where cs.character_id = new.character_id and cs.source_type = 'class';
    if v_invalid_count <> 0 then
      raise exception 'This class does not grant base-class starting spell choices at level %.', v_class_level;
    end if;
    return new;
  end if;

  select coalesce(p.cantrips_known, 0), coalesce(p.spells_known, 0), coalesce(p.spell_slots, '[]'::jsonb)
    into v_cantrips_required, v_leveled_required, v_spell_slots
  from public.class_level_progression p
  where p.class_id = v_class_id and p.class_level = v_class_level;

  if not found then
    raise exception 'The selected class level has no canonical spell progression row.';
  end if;

  if jsonb_typeof(v_spell_slots) = 'array' then
    select coalesce(max((entry.ordinality)::integer) filter (where (entry.value #>> '{}')::integer > 0), 0)
      into v_maximum_spell_level
    from jsonb_array_elements(v_spell_slots) with ordinality as entry(value, ordinality);
  elsif jsonb_typeof(v_spell_slots) = 'object' then
    v_maximum_spell_level := greatest(0, coalesce((v_spell_slots ->> 'pactSlotLevel')::integer, 0));
  else
    v_maximum_spell_level := 0;
  end if;

  if v_class_key = 'wizard' then
    v_leveled_required := 6 + greatest(0, v_class_level - 1) * 2;
    v_prepared_required := least(v_leveled_required, coalesce((select p.spells_known from public.class_level_progression p where p.class_id = v_class_id and p.class_level = v_class_level), 0));
  else
    v_prepared_required := v_leveled_required;
  end if;

  select
    count(*) filter (where s.level = 0),
    count(*) filter (where s.level > 0),
    count(*) filter (where s.level > 0 and cs.prepared),
    count(*) filter (
      where s.level < 0
         or (s.level > 0 and s.level > v_maximum_spell_level)
         or not exists (
           select 1
           from unnest(coalesce(s.classes, array[]::text[])) class_name
           where lower(class_name) in (lower(v_class_name), v_class_key)
         )
    )
  into v_cantrips_selected, v_leveled_selected, v_prepared_selected, v_invalid_count
  from public.character_spells cs
  join public.spells_catalog s on s.id = cs.spell_id
  where cs.character_id = new.character_id and cs.source_type = 'class';

  if v_invalid_count > 0 then
    raise exception 'One or more starting spells are not legal for % level %.', v_class_name, v_class_level;
  end if;
  if v_cantrips_selected <> v_cantrips_required then
    raise exception 'Choose exactly % starting cantrip(s); received %.', v_cantrips_required, v_cantrips_selected;
  end if;
  if v_leveled_selected <> v_leveled_required then
    raise exception 'Choose exactly % starting leveled spell(s); received %.', v_leveled_required, v_leveled_selected;
  end if;
  if v_prepared_selected <> v_prepared_required then
    raise exception 'Mark exactly % starting leveled spell(s) as prepared; received %.', v_prepared_required, v_prepared_selected;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_player_forge_starting_spells_v1() from public, anon, authenticated;
grant execute on function private.validate_player_forge_starting_spells_v1() to service_role;
