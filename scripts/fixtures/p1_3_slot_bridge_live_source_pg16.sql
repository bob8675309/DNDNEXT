-- 2026-11-01 exact live pg_get_functiondef snapshot mirror_encounter_spell_slot_spend_v1 MD5 b30565d75b05b042c1ad8f9803284486
CREATE OR REPLACE FUNCTION private.mirror_encounter_spell_slot_spend_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_character_id uuid; v_encounter_status text; v_delta integer; v_character_remaining integer;
begin
  if new.slots_remaining>=old.slots_remaining then return new; end if;
  if coalesce(current_setting('dndnext.resource_bridge_sync',true),'off')='on' then return new; end if;
  select p.character_id,e.status into v_character_id,v_encounter_status
  from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
  where p.id=new.participant_id;
  if v_character_id is null or v_encounter_status is distinct from 'active' then return new; end if;
  perform private.sync_character_spell_slots_v1(v_character_id);
  v_delta:=old.slots_remaining-new.slots_remaining;
  select slots_remaining into v_character_remaining from public.character_spell_slots
  where character_id=v_character_id and pool_key=new.pool_key and slot_level=new.slot_level for update;
  if not found then raise exception 'Persistent character spell-slot pool is missing for % level %.',new.pool_key,new.slot_level using errcode='P0002'; end if;
  if v_character_remaining<v_delta then
    raise exception 'Persistent character spell resources have only % slot(s) remaining; this cast requires %.',v_character_remaining,v_delta
      using errcode='22023',hint='Refresh the battle board. Sheet-side resources cannot be changed while this encounter is active.';
  end if;
  perform set_config('dndnext.resource_bridge_context','encounter_spend',true);
  update public.character_spell_slots set slots_remaining=slots_remaining-v_delta,updated_at=timezone('utc',now())
  where character_id=v_character_id and pool_key=new.pool_key and slot_level=new.slot_level;
  perform set_config('dndnext.resource_bridge_context','',true);
  return new;
end;
$function$;

-- 2026-11-01 exact live pg_get_functiondef snapshot sync_character_spell_slots_v1 MD5 6c276ab2135fb90894fd8684e39ce1c3
CREATE OR REPLACE FUNCTION private.sync_character_spell_slots_v1(p_character_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class_id uuid;
  v_class_level integer;
  v_class_key text;
  v_source text;
  v_ruleset text;
  v_caster_progression text;
  v_spellcasting_ability text;
  v_spell_slots jsonb;
  v_pool_key text;
  v_recharge_key text;
  v_levels integer[] := '{}'::integer[];
  v_slot record;
  v_rows integer := 0;
  v_changed integer := 0;
begin
  if p_character_id is null then return 0; end if;

  select cp.class_id,cp.class_level,c.class_key,c.source,c.ruleset,
         c.caster_progression,c.spellcasting_ability,lp.spell_slots
  into v_class_id,v_class_level,v_class_key,v_source,v_ruleset,
       v_caster_progression,v_spellcasting_ability,v_spell_slots
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp
    on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=p_character_id;

  if not found
     or nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is null
     or jsonb_typeof(coalesce(v_spell_slots,'[]'::jsonb)) <> 'array' then
    delete from public.character_spell_slots where character_id=p_character_id;
    get diagnostics v_rows=row_count;
    return v_rows;
  end if;

  v_pool_key := case when lower(coalesce(v_caster_progression,''))='pact'
    then 'pact_magic' else 'spellcasting' end;
  v_recharge_key := case when v_pool_key='pact_magic'
    then 'short_rest' else 'long_rest' end;

  for v_slot in
    select ordinality::integer as slot_level,value::integer as slots_max
    from jsonb_array_elements_text(v_spell_slots) with ordinality
  loop
    if v_slot.slot_level between 1 and 9 and v_slot.slots_max > 0 then
      v_levels := array_append(v_levels,v_slot.slot_level);
      insert into public.character_spell_slots(
        character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
        source_class_id,source_class_key,source_book,source_ruleset,source_class_level
      ) values(
        p_character_id,v_pool_key,v_slot.slot_level,v_slot.slots_max,v_slot.slots_max,v_recharge_key,
        v_class_id,v_class_key,v_source,v_ruleset,v_class_level
      )
      on conflict(character_id,pool_key,slot_level) do update
      set slots_max=excluded.slots_max,
          slots_remaining=least(public.character_spell_slots.slots_remaining,excluded.slots_max),
          recharge_key=excluded.recharge_key,
          source_class_id=excluded.source_class_id,
          source_class_key=excluded.source_class_key,
          source_book=excluded.source_book,
          source_ruleset=excluded.source_ruleset,
          source_class_level=excluded.source_class_level,
          updated_at=timezone('utc',now());
      get diagnostics v_changed=row_count;
      v_rows := v_rows + v_changed;
    end if;
  end loop;

  if coalesce(array_length(v_levels,1),0)=0 then
    delete from public.character_spell_slots where character_id=p_character_id;
  else
    delete from public.character_spell_slots
    where character_id=p_character_id
      and (pool_key<>v_pool_key or not (slot_level=any(v_levels)));
  end if;

  return v_rows;
end;
$function$;

-- Exact live encounter-slot spend trigger definition
CREATE TRIGGER encounter_spell_slot_character_spend_bridge AFTER UPDATE OF slots_remaining ON public.encounter_spell_slots FOR EACH ROW WHEN ((new.slots_remaining < old.slots_remaining)) EXECUTE FUNCTION private.mirror_encounter_spell_slot_spend_v1();
