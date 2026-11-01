// Research-only P2 source contract. Not a spell executor or behavioral parity proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preflightSpellRecipe } from "../utils/spellRecipes/preflightSpellRecipe.mjs";
import { P1_SYNTHETIC_RECIPES } from "./fixtures/spell_recipe_p1_examples.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ui = read("pages/encounters/combat.js");
const contracts = [
  {key:"fire-bolt", rpc:"encounter_cast_spell_v1", sql:"sql/20260730_01_tactical_legacy_attack_spell_hardening.sql",
   marker:"fire-bolt|xphb", ops:["attack","damage"],scope:"once-per-attack"},
  {key:"sacred-flame", rpc:"encounter_cast_spell_v2", sql:"sql/20260727_14_tactical_single_target_save_spell.sql",
   marker:"sacred-flame|xphb", ops:["save","damage"],scope:"once-per-target"},
  {key:"magic-missile", rpc:"encounter_cast_allocated_spell_v1", sql:"sql/20260730_05_tactical_magic_missile.sql",
   marker:"Magic Missile", ops:["repeat","auto-hit","damage"],scope:"once-per-projectile"},
  {key:"acid-splash", rpc:"encounter_cast_point_area_spell_v1", sql:"sql/20260730_04_tactical_acid_splash.sql",
   marker:"Acid Splash", ops:["area","save","damage"],scope:"once-per-cast"},
  {key:"word-of-radiance", rpc:"encounter_cast_area_spell_v1", sql:"sql/20260729_02_tactical_word_of_radiance.sql",
   marker:"Word of Radiance", ops:["area","save","damage"],scope:"once-per-cast"},
  {key:"burning-hands", rpc:"encounter_cast_directional_area_spell_v1", sql:"sql/20260730_06_tactical_burning_hands.sql",
   marker:"Burning Hands", ops:["area","save","damage"],scope:"once-per-cast"},
  {key:"lightning-bolt", rpc:"encounter_cast_directional_area_spell_v2", sql:"sql/20260730_07_tactical_lightning_bolt.sql",
   marker:"Lightning Bolt", ops:["area","save","damage"],scope:"once-per-cast"},
];
for (const c of contracts) {
  const recipe = P1_SYNTHETIC_RECIPES.find(r => r.spell.key === c.key + "|XPHB");
  assert.ok(recipe, c.key + ": synthetic sample absent");
  const result = preflightSpellRecipe(structuredClone(recipe));
  assert.equal(result.ok, true, c.key + ": malformed synthetic recipe");
  assert.equal(result.manifest.approved, false);
  assert.equal(result.manifest.executable, false);
  assert.equal(result.manifest.requiresServerAuthorization, true);
  for (const op of c.ops) assert.ok(recipe.steps.some(s => s.op === op), c.key + ": missing op " + op);
  assert.ok(recipe.steps.some(s => s.dice?.rollScope === c.scope),
    c.key + ": wrong synthetic roll scope");
  assert.ok(ui.includes('"' + c.key + '|xphb"'), c.key + ": UI spell route missing");
  assert.ok(ui.includes('"' + c.rpc + '"'), c.key + ": UI RPC dispatch missing");
  const sql = read(c.sql);
  assert.ok(sql.includes(c.marker), c.key + ": canonical SQL marker absent");
  assert.ok(sql.includes("public." + c.rpc), c.key + ": expected SQL function absent");
  assert.ok(sql.includes("encounter_command_requests"), c.key + ": command ledger absent");
  assert.ok(sql.includes("encounter_combat_log"), c.key + ": combat log absent");
}
// EB remains held, and requires opt-in staging; it is deliberately NOT treated as a live RPC.
const eb = P1_SYNTHETIC_RECIPES.find(r => r.spell.key === "eldritch-blast|XPHB");
assert.ok(eb);
assert.equal(preflightSpellRecipe(structuredClone(eb)).manifest.executable, false);
assert.ok(ui.includes("NEXT_PUBLIC_DNDNEXT_EB_STAGING_CASTS"));
assert.ok(ui.includes("encounter_cast_eldritch_blast_candidate_v1"));
assert.ok(read("sql/candidates/20261029_eldritch_blast_atomic_candidate.sql").includes(
  "private.encounter_eldritch_blast_candidate_v1"
), "held private EB candidate missing");
assert.ok(read("sql/candidates/20261030_eldritch_blast_authenticated_bridge_candidate.sql").includes(
  "public.encounter_cast_eldritch_blast_candidate_v1"
), "held public EB bridge missing");
// Explicitly guard discovery: synthetic P1 class-level tiers are not proof of live level parity.
const fixtureLevels = P1_SYNTHETIC_RECIPES.find(r => r.spell.key === "fire-bolt|XPHB")
  .steps.find(s => s.op === "damage").dice.quantity;
assert.equal(fixtureLevels.kind, "character-level-tiers");
assert.deepEqual(fixtureLevels.tiers.map(t => t.minLevel), [1,5,11,17]);
console.log("P2 source-contract inventory passed: 7 live spell dispatches + held EB; no casts or writes.");
