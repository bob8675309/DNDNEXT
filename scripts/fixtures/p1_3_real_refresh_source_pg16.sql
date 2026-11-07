-- SELECT-only deployed source 2026-11-02: refresh_encounter_spell_slots_from_characters_v1 md5=d16af751b63fc3214b2b5d6cc9621160
CREATE OR REPLACE FUNCTION private.refresh_encounter_spell_slots_from_characters_v1(p_encounter_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_participant record;
  v_changed integer:=0;
  v_total integer:=0;
begin
  if p_encounter_id is null then return 0; end if;
  perform set_config('dndnext.resource_bridge_sync','on',true);
  for v_participant in
    select id,character_id from public.encounter_participants
    where encounter_id=p_encounter_id and character_id is not null order by id
  loop
    perform private.sync_character_spell_slots_v1(v_participant.character_id);
    delete from public.encounter_spell_slots s
    where s.participant_id=v_participant.id
      and not exists (
        select 1 from public.character_spell_slots cs
        where cs.character_id=v_participant.character_id and cs.pool_key=s.pool_key and cs.slot_level=s.slot_level
      );
    get diagnostics v_changed=row_count;
    v_total:=v_total+v_changed;
    insert into public.encounter_spell_slots(
      participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
      source_class_id,source_class_key,source_book,source_ruleset,source_class_level
    )
    select v_participant.id,cs.pool_key,cs.slot_level,cs.slots_max,cs.slots_remaining,cs.recharge_key,
      cs.source_class_id,cs.source_class_key,cs.source_book,cs.source_ruleset,cs.source_class_level
    from public.character_spell_slots cs where cs.character_id=v_participant.character_id
    on conflict(participant_id,pool_key,slot_level) do update
    set slots_max=excluded.slots_max,
        slots_remaining=excluded.slots_remaining,
        recharge_key=excluded.recharge_key,
        source_class_id=excluded.source_class_id,
        source_class_key=excluded.source_class_key,
        source_book=excluded.source_book,
        source_ruleset=excluded.source_ruleset,
        source_class_level=excluded.source_class_level,
        updated_at=timezone('utc',now());
    get diagnostics v_changed=row_count;
    v_total:=v_total+v_changed;
  end loop;
  perform set_config('dndnext.resource_bridge_sync','off',true);
  return v_total;
end;
$function$;

-- SELECT-only deployed source 2026-11-02: refresh_encounter_spell_slots_on_activation_v1 md5=2c167384bbd138656a28c342eec8710b
CREATE OR REPLACE FUNCTION private.refresh_encounter_spell_slots_on_activation_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  perform private.refresh_encounter_spell_slots_from_characters_v1(new.id);
  return new;
end;
$function$;

-- Live activation trigger statements (reference only, not installed in scratch)
-- CREATE TRIGGER encounter_spell_slots_refresh_after_active_insert AFTER INSERT ON public.encounters FOR EACH ROW WHEN ((new.status = 'active'::text)) EXECUTE FUNCTION private.refresh_encounter_spell_slots_on_activation_v1()
-- CREATE TRIGGER encounter_spell_slots_refresh_on_activation AFTER UPDATE OF status ON public.encounters FOR EACH ROW WHEN (((new.status = 'active'::text) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION private.refresh_encounter_spell_slots_on_activation_v1()
