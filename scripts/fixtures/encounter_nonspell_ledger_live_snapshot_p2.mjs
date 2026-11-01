// Dated DnDWeb read-only inspection of the EIGHT non-spell command ledger writers.
// Frozen evidence, NOT a live database feed or proof of exploitability.
// pg_get_functiondef MD5s verified 2026-10-31.
export const P2_NON_SPELL_LEDGER_WRITERS = Object.freeze([
  {name:"admin_apply_encounter_effect_v1",md5:"5a7da1de8fbb5764c12ed21e24aa0560",intent:"source-target-effect",order:"admin-check>ledger>effect-target-lock",replayBeforeController:false,critical:"admin permission before ledger; result replay still lacks canonical effect intent"},
  {name:"encounter_end_turn_v1",md5:"2785f688af8e200f64f18b6c421f19a6",intent:"actor",order:"ledger>actor>encounter>expiry>next-actor>turn-start-trigger",replayBeforeController:true,critical:"turn-start trigger may update a different participant row"},
  {name:"encounter_move_active_participant_v1",md5:"1f7fc81b307800f70ab412872473aa14",intent:"actor-hex-path",order:"ledger>mover>encounter>reaction-window",replayBeforeController:true,critical:"movement can produce an unresolved opportunity reaction window"},
  {name:"encounter_resolve_opportunity_reaction_v1",md5:"70cbfda404644c1000a6541ce8bf9c30",intent:"window-choice-weapon",order:"window>reactor>mover>encounter>ledger",replayBeforeController:false,critical:"resolved-window result returned BEFORE controller authorization, even before request ledger"},
  {name:"encounter_roll_save_v1",md5:"337065c8f21bc89bc0ed2ee353c2d269",intent:"actor-ability-dc-source",order:"controller-check>ledger>save-and-log",replayBeforeController:false,critical:"cached result not bound to ability/DC/source although controller checked first"},
  {name:"encounter_unarmed_strike_v1",md5:"44f0dad7e8ae9f6d8002c07e025ff0b7",intent:"attacker-target",order:"ledger>attacker>target>encounter",replayBeforeController:true,critical:"target and attacker held before encounter, potential inversion"},
  {name:"encounter_use_core_action_v1",md5:"74a43a001247f5fa491b057c97ca4014",intent:"actor-core-action",order:"ledger>actor>encounter",replayBeforeController:true,critical:"cached dash/disengage/dodge may not bind original action"},
  {name:"encounter_weapon_attack_v1",md5:"14433e4e379ae811edd9d9d8345711f8",intent:"attacker-target-weapon",order:"ledger>attacker>target>encounter>damage-target",replayBeforeController:true,critical:"must bind inventory item and equipped ownership before replay"}
].map(x=>Object.freeze(x)));

export const P2_ENCOUNTER_TRIGGER_HELPERS = Object.freeze([
 {table:"encounters",trigger:"encounter_timed_effects_turn_start_expiry",fn:"private.expire_encounter_timed_effects_on_turn_start_v1",md5:"e8e898f3a427897863f31c64b2e1a4ea",acquires:"timed-effect rows then writes speed to possibly different participant"},
 {table:"encounter_spell_slots",trigger:"encounter_spell_slot_character_spend_bridge",fn:"private.mirror_encounter_spell_slot_spend_v1",md5:"b30565d75b05b042c1ad8f9803284486",acquires:"sync persistent character slots, lock persistent spell-slot row"},
 {table:"encounter_participants",trigger:"encounter_participant_max_hp_guard",fn:"private.guard_encounter_participant_max_hp_v1",md5:"04b8be504c4b5f05e23357a6f15554cd",acquires:"character sheet SELECT, max/current HP normalization"},
 {table:"encounter_participants",trigger:"encounter_participant_spell_slot_snapshot",fn:"private.snapshot_encounter_spell_slots_after_insert_v1",md5:"0278aafc19f76ce8ecfc3925a315a1bf",acquires:"initialize encounter spell slots on participant INSERT"},
 {table:"encounters",trigger:"encounter_spell_slots_refresh_after_active_insert",fn:"private.refresh_encounter_spell_slots_on_activation_v1",md5:"2c167384bbd138656a28c342eec8710b",acquires:"refresh slot pool on active encounter INSERT"},
 {table:"encounters",trigger:"encounter_spell_slots_refresh_on_activation",fn:"private.refresh_encounter_spell_slots_on_activation_v1",md5:"2c167384bbd138656a28c342eec8710b",acquires:"refresh slot pool when an encounter becomes active"}
].map(x=>Object.freeze(x)));
