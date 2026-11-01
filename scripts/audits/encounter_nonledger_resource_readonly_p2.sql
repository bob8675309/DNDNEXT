-- P2 READ ONLY. Do not invoke any casting/admin/rest RPC or mutate live data.
-- Recheck live function definitions/permissions; dated JS fingerprints are not polling.
select n.nspname||'.'||p.proname function_name,
 pg_get_function_identity_arguments(p.oid) arguments,
 md5(pg_get_functiondef(p.oid)) definition_md5,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prokind='f' and
 ((n.nspname='public' and p.proname in (
 'admin_add_encounter_participant_v1','admin_create_encounter_v1',
 'admin_remove_encounter_participant_v1','admin_set_encounter_damage_affinities_v1',
 'admin_set_encounter_status_v1','admin_set_encounter_turn_marker_v1',
 'admin_start_encounter_v1','admin_update_encounter_participant_staging_v1',
 'complete_character_rest_v1','update_character_spell_slot_v1'))
 or (n.nspname='private' and p.proname in (
 'character_active_encounter_v1','assert_character_resource_not_active_v1',
 'guard_character_rest_insert_v1','guard_character_spell_slot_update_v1',
 'mirror_encounter_spell_slot_spend_v1','sync_character_spell_slots_v1',
 'refresh_encounter_spell_slots_from_characters_v1')))
order by function_name;

-- Structural constraints: same character may appear in two different encounters,
-- while persistent slots are unique by (character, pool, level).
select t.relname table_name,i.relname index_name,pg_get_indexdef(ix.indexrelid) index_definition
from pg_index ix join pg_class t on t.oid=ix.indrelid
 join pg_namespace n on n.oid=t.relnamespace
 join pg_class i on i.oid=ix.indexrelid
where n.nspname='public' and t.relname in (
 'encounter_participants','encounter_spell_slots','character_spell_slots')
 and ix.indisunique order by table_name,index_name;

-- No character IDs or user identifiers leave this aggregate.
with active as (
 select p.id participant_id,p.character_id
 from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
 where e.status='active' and p.character_id is not null
), overlapping as (
 select character_id,count(*) ct from active
 group by character_id having count(*)>1
), pairs as (
 select a.character_id,s.slots_remaining encounter_remaining,
 c.slots_remaining persistent_remaining
 from active a join public.encounter_spell_slots s on s.participant_id=a.participant_id
 left join public.character_spell_slots c
   on c.character_id=a.character_id
  and c.pool_key=s.pool_key and c.slot_level=s.slot_level
)
select
 (select count(*) from active) active_character_participations,
 (select count(*) from overlapping) characters_in_two_or_more_active_encounters,
 (select count(*) from pairs) active_slot_snapshot_rows,
 (select count(*) from pairs where persistent_remaining is null) orphan_slot_snapshots,
 (select count(*) from pairs where encounter_remaining is distinct from persistent_remaining) snapshot_differences
;

-- Confirm rest and slot change guards are triggers, not promises in UI text.
select t.tgname trigger_name,c.relname table_name,
 pg_get_triggerdef(t.oid,true) definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
 join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
and c.relname in ('character_rest_log','character_spell_slots','encounter_spell_slots')
order by table_name,trigger_name;
