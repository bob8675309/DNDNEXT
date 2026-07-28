import fs from "node:fs";
import path from "node:path";

const migrationPath = "sql/20260727_12_tactical_spell_foundation.sql";
const statusPath = "docs/Tactical_Encounter_Phase1I_Spell_Foundation_Status.md";

for (const rel of [migrationPath, statusPath]) {
  const absolute = path.join(process.cwd(), rel);
  if (!fs.existsSync(absolute)) throw new Error(`Tactical spell foundation validation failed: missing ${rel}`);
  if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) throw new Error(`Tactical spell foundation validation failed: empty ${rel}`);
}

const migration = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
const requiredMigrationTokens = [
  "encounter_spell_slots",
  "private.encounter_ability_score_v1",
  "private.initialize_encounter_spell_slots_v1",
  "encounter_participant_spell_slot_snapshot",
  "public.encounter_spellcasting_profile_v1",
  "public.character_progression",
  "public.class_catalog",
  "public.class_level_progression",
  "public.character_spells",
  "public.spells_catalog",
  "lp.class_id=cp.class_id",
  "lp.class_level=cp.class_level",
  "on conflict(participant_id,pool_key,slot_level) do nothing",
  "preparedSpellsFormula",
  "canonicalSlotProgression",
  "slotSnapshot",
  "knownSpells",
  "revoke all on public.encounter_spell_slots from public, anon, authenticated",
  "grant select on public.encounter_spell_slots to authenticated",
  "authenticated must not directly mutate encounter spell slots",
];
for (const token of requiredMigrationTokens) {
  if (!migration.includes(token)) throw new Error(`Tactical spell foundation validation failed: missing migration contract ${token}`);
}

for (const forbidden of [
  "map_routes",
  "map_route_points",
  "map_route_edges",
  "world_state",
  "world_events",
  "town_map_flags",
  "town_map_labels",
  "advance_all_characters",
]) {
  if (migration.includes(forbidden)) throw new Error(`Tactical spell foundation validation failed: tactical migration must not reference ${forbidden}`);
}

if (/grant\s+(insert|update|delete|all)\s+on\s+public\.encounter_spell_slots\s+to\s+authenticated/i.test(migration)) {
  throw new Error("Tactical spell foundation validation failed: authenticated clients must not directly mutate encounter spell slots.");
}
if (/update\s+public\.character_spells/i.test(migration) || /delete\s+from\s+public\.character_spells/i.test(migration)) {
  throw new Error("Tactical spell foundation validation failed: the foundation must not mutate the canonical character spellbook.");
}
if (/update\s+public\.class_level_progression/i.test(migration) || /update\s+public\.class_catalog/i.test(migration)) {
  throw new Error("Tactical spell foundation validation failed: the foundation must not mutate canonical class progression.");
}

const status = fs.readFileSync(path.join(process.cwd(), statusPath), "utf8");
for (const token of [
  "Phase 1I-A/B",
  "canonical caster profile",
  "encounter-local spell-slot snapshot",
  "world-map",
  "FOUNDATION + FIRST CASTING SLICE + COMBAT UI DEPLOYED / VALIDATED",
]) {
  if (!status.includes(token)) throw new Error(`Tactical spell foundation validation failed: status document missing ${token}`);
}

console.log("Tactical spell foundation validation passed.");
