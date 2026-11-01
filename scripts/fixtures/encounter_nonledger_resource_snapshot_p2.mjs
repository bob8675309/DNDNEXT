// Frozen, read-only live database contract snapshot (2026-11-01).
// Source: public/private pg_proc, pg_trigger and unique indexes.
// This is NOT an executable change, live polling, or a security sign-off.
export const P2_NON_LEDGER_PUBLIC_MUTATORS = Object.freeze([
  ["admin_add_encounter_participant_v1","e51d48fdb0546111b1eaa418d8057584","encounter-first; participant INSERT triggers slot snapshot"],
  ["admin_create_encounter_v1","e9e5058615e6c2dbaacdb03db0255dd0","encounter INSERT; activation trigger if active"],
  ["admin_remove_encounter_participant_v1","78e1d2c3af230eed2246a50b22e6a485","participant lock then encounter UPDATE; pre-active only"],
  ["admin_set_encounter_damage_affinities_v1","6ab11467cbda6e4d206cf4e061356a5e","participant resistance/immunity changes"],
  ["admin_set_encounter_status_v1","ab4592dc22632d646886f0d808cfb95f","encounter row lock; active status refreshes slots"],
  ["admin_set_encounter_turn_marker_v1","0acff6b768a33fdb9a53904c5f25774f","encounter UPDATE with turn-start trigger; no explicit FOR UPDATE"],
  ["admin_start_encounter_v1","ce7bb040cb09d9dac85517ea8206b44e","encounter lock then bulk participant UPDATE, activation triggers"],
  ["admin_update_encounter_participant_staging_v1","190bbed26d2067905b00000686c17176","staging participant lock then encounter UPDATE"],
  ["complete_character_rest_v1","fffbf0705d640a7d2bfb08aa78ad521a","sync/restores persistent slots, spell uses and sheet action state; rest-log trigger blocks active"],
  ["update_character_spell_slot_v1","d9f38e785a82d14b00658f3c3464c2ba","sync then persistent slot FOR UPDATE; trigger denies active except bridge context"]
].map(([name,md5,impact])=>Object.freeze({name,md5,impact})));

export const P2_NON_LEDGER_HELPERS = Object.freeze([
  ["private.character_active_encounter_v1","471838b1a30158586afce9b56cbe8a1c"],
  ["private.assert_character_resource_not_active_v1","e5d73f1d0ec428b14f70070e17b3909d"],
  ["private.guard_character_rest_insert_v1","e7679b57650552c711d41f38beece2b8"],
  ["private.guard_character_spell_slot_update_v1","130473e9d8035c038a080362c6b4a2fd"],
  ["private.mirror_encounter_spell_slot_spend_v1","b30565d75b05b042c1ad8f9803284486"],
  ["private.sync_character_spell_slots_v1","6c276ab2135fb90894fd8684e39ce1c3"],
  ["private.refresh_encounter_spell_slots_from_characters_v1","d16af751b63fc3214b2b5d6cc9621160"]
].map(([name,md5])=>Object.freeze({name,md5})));
