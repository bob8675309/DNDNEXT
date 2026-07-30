import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260730_03_tactical_healing_word.sql";
const statusPath = "docs/Tactical_Encounter_Phase1V_Healing_Word_Status.md";
for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) {
    throw new Error(`Tactical Healing Word validation failed: missing/empty ${rel}`);
  }
}

const sql = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
for (const token of [
  "private.encounter_enforce_spell_slot_cast_turn_v1",
  "A spell slot has already been expended to cast a spell on this turn",
  "l.round=v_e.round",
  "l.turn_index=v_e.turn_index",
  "l.actor_participant_id=v_p.id",
  "l.event_type='spell_cast'",
  "l.detail->>'slotLevel'",
  "coalesce(l.detail->>'requestId','')<>v_request_text",
  "encounter_cast_spell_v1_pre_1v",
  "encounter_cast_spell_v5_pre_1v",
  "encounter_cast_spell_v6_pre_1v",
  "encounter_cast_spell_v11_pre_1v",
  "perform private.encounter_enforce_spell_slot_cast_turn_v1(p_caster_id,p_assignment_id,p_request_id)",
  "public.encounter_cast_spell_v13",
  "if v_key<>'healing-word|xphb' then",
  "return public.encounter_cast_spell_v12",
  "Bonus Action already spent",
  "Healing Word automation requires a class spell assignment",
  "Healing Word must resolve from its reviewed XPHB level-1 definition",
  "Healing Word assignment source does not match the canonical casting class",
  "Healing Word is not on this canonical class spell list",
  "Healing Word casting ability does not match the canonical class",
  "Target is beyond Healing Word range",
  "v_dice_count:=2*p_slot_level",
  "public.encounter_apply_healing_internal_v1(v_t.id,v_heal_total)",
  "'actionType','bonus_action'",
  "'oneSpellSlotPerTurn',true",
  "update public.encounter_participants set bonus_action_available=false",
  "grant execute on function public.encounter_cast_spell_v13(uuid,uuid,uuid,integer,uuid) to authenticated, service_role",
]) {
  if (!sql.includes(token)) throw new Error(`Tactical Healing Word validation failed: missing contract ${token}`);
}

for (const version of [1, 5, 6, 11]) {
  if (!new RegExp(`create or replace function public\\.encounter_cast_spell_v${version}\\(`).test(sql)) {
    throw new Error(`Tactical Healing Word validation failed: missing guarded v${version} compatibility wrapper.`);
  }
  if (!new RegExp(`return public\\.encounter_cast_spell_v${version}_pre_1v\\(`).test(sql)) {
    throw new Error(`Tactical Healing Word validation failed: v${version} wrapper must call preserved implementation.`);
  }
  if (!new RegExp(`revoke all on function public\\.encounter_cast_spell_v${version}_pre_1v\\([^;]+from public, anon, authenticated`).test(sql)) {
    throw new Error(`Tactical Healing Word validation failed: preserved v${version} implementation must not remain client executable.`);
  }
}

if (/update public\.encounter_participants set action_available=false[\s\S]{0,500}Healing Word/.test(sql)) {
  throw new Error("Tactical Healing Word validation failed: Healing Word must spend Bonus Action, not Action.");
}
if (/grant\s+execute\s+on\s+function\s+private\.encounter_enforce_spell_slot_cast_turn_v1\([^)]*\)\s+to\s+[^;]*(authenticated|anon)/i.test(sql)) {
  throw new Error("Tactical Healing Word validation failed: slot-turn guard must remain private/service-only.");
}
if (/grant\s+execute\s+on\s+function\s+public\.encounter_cast_spell_v13\([^)]*\)\s+to\s+[^;]*anon/i.test(sql)) {
  throw new Error("Tactical Healing Word validation failed: anonymous v13 casting must remain unavailable.");
}
for (const forbidden of [
  "map_routes",
  "map_route_points",
  "world_state",
  "world_events",
  "town_map_flags",
  "town_map_labels",
  "advance_all_characters",
  "weather",
  "healing-word|PHB",
]) {
  if (sql.includes(forbidden)) throw new Error(`Tactical Healing Word validation failed: unexpected contract ${forbidden}`);
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1V",
  "Healing Word",
  "Bonus Action",
  "one spell slot",
  "encounter_cast_spell_v13",
  "Cure Wounds",
  "False Life",
  "Inflict Wounds",
  "Guiding Bolt",
  "6a63f29be27d0a9435ba6f9ccfa726e9ee6462fc",
]) {
  if (!status.includes(token)) throw new Error(`Tactical Healing Word validation failed: status document missing ${token}`);
}

console.log("Tactical Healing Word server validation passed.");
