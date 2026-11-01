// Pure P2 Fire Bolt shadow test: SQL source probes + deterministic reference arithmetic.
// This is NOT a cast executor and NEVER invokes a game RPC, SQL, RNG, or writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preflightSpellRecipe } from "../utils/spellRecipes/preflightSpellRecipe.mjs";
import { P1_SYNTHETIC_RECIPES } from "./fixtures/spell_recipe_p1_examples.mjs";
import { FIRE_BOLT_LEVEL_CASES, FIRE_BOLT_ATTACK_CASES } from "./fixtures/fire_bolt_p2_shadow_cases.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const attackSQL = read("sql/20260729_04_tactical_guiding_bolt.sql");
const hardenedSQL = read("sql/20260730_01_tactical_legacy_attack_spell_hardening.sql");
const combatUI = read("pages/encounters/combat.js");
const reference = P1_SYNTHETIC_RECIPES.find(x => x.spell.key === "fire-bolt|XPHB");
assert.ok(reference, "P1 Fire Bolt research shape missing");
const manifest = preflightSpellRecipe(structuredClone(reference));
assert.equal(manifest.ok, true);
assert.equal(manifest.manifest.executable, false);
assert.equal(manifest.manifest.approved, false);
assert.equal(reference.cost.action, "action");
assert.equal(reference.cost.resource.kind, "none");
assert.equal(reference.spell.level, 0);
assert.equal(reference.targeting.rangeFeet, 120);
const damage = reference.steps.find(x => x.op === "damage");
assert.equal(damage.dice.rollScope, "once-per-attack");
assert.equal(damage.dice.sides, 10);
assert.deepEqual(damage.dice.quantity.tiers.map(t => [t.minLevel, t.value]),
  [[1,1],[5,2],[11,3],[17,4]]);
// Check original migration and later wrapper. The *live* SQL was separately
// inspected read-only with pg_get_functiondef; source text is not live proof.
assert.match(hardenedSQL,
  /if v_key='fire-bolt\|xphb' then\s*return public\.encounter_cast_spell_v11\(/);
assert.match(combatUI, /"fire-bolt\|xphb"/);
assert.match(combatUI, /"encounter_cast_spell_v1"/);
assert.match(attackSQL, /if v_key='fire-bolt\|xphb' then\s*v_die_size:=10; v_damage_type:='fire';/);
const fireSQLBlock = attackSQL.match(/if v_key='fire-bolt\|xphb' then([\s\S]*?)elsif v_key='poison-spray\|xphb'/);
assert.ok(fireSQLBlock, "Fire Bolt SQL damage branch absent");
assert.match(fireSQLBlock[1], /v_profile->>'classLevel'/);
assert.doesNotMatch(fireSQLBlock[1], /v_profile->>'characterLevel'/);
for (const mark of [">=5",">=11",">=17"]) assert.ok(fireSQLBlock[1].includes(mark));
for (const re of [
  /character_id=v_c\.character_id/, /v_assignment\.source_type/, /v_spell\.source<>'XPHB'/,
  /encounter_can_control_participant_v1/, /v_e\.active_participant_id/,
  /v_t\.is_hidden/, /v_c\.action_available/,
  /encounter_targeting_context_internal_v1/, /Close-quarters ranged spell attacks remain GM-assisted/,
  /v_target_ac:=coalesce\(v_t\.armor_class,10\)\+coalesce\(\(v_targeting->>'coverAcBonus'\)::integer,0\)/,
  /v_crit:=v_roll=20/, /v_hit:=case when v_roll=1 then false when v_crit then true/,
  /if v_crit then v_dice_count:=v_dice_count\*2/,
  /encounter_apply_damage_internal_v1/, /encounter_command_requests/,
  /encounter_combat_log/, /action_available=false/
]) assert.match(attackSQL, re, "Fire Bolt source contract drift: " + re);
// Pure level projection: authoritative 2024 reference uses total character
// level; the currently inspected SQL uses classLevel. No level is loaded from
// the live database, and this DOES NOT prove that multiclassing is supported.
const diceAtLevel = level => {
  assert.ok(Number.isInteger(level) && level >= 1 && level <= 20);
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
};
let discrepancies = 0;
for (const t of FIRE_BOLT_LEVEL_CASES) {
  const rules = diceAtLevel(t.characterLevel);
  const currentSqlProjection = diceAtLevel(t.classLevel);
  assert.equal(rules, t.expected2024Dice, t.name + ": expected 2024 tier");
  assert.equal(currentSqlProjection, t.expectedCurrentSqlDice, t.name + ": current SQL projection");
  if (rules !== currentSqlProjection) discrepancies++;
}
// Attack decision projection uses scripted d20/d10 faces, never random().
function preview(s, level) {
  const [first, second] = s.rolls;
  assert.ok(s.rolls.length === 1 || s.rolls.length === 2);
  for (const face of s.rolls) assert.ok(Number.isInteger(face) && face >= 1 && face <= 20);
  const advantage = Boolean(s.advantage);
  const disadvantage = Boolean(s.disadvantage);
  const selected = advantage && !disadvantage ? Math.max(first, second)
    : disadvantage && !advantage ? Math.min(first, second) : first;
  const targetAC = s.baseAC + s.coverACBonus;
  const critical = selected === 20;
  const hit = selected !== 1 && (critical || selected + s.attackBonus >= targetAC);
  const damageDice = diceAtLevel(level) * (critical ? 2 : 1);
  if (hit) assert.ok(s.faces.length >= damageDice, s.name + ": insufficient controlled damage faces");
  for (const face of s.faces) assert.ok(Number.isInteger(face) && face >= 1 && face <= 10);
  const raw = hit ? s.faces.slice(0, damageDice).reduce((a,b) => a+b,0) : 0;
  // Deliberately no damage mitigation/HP/stat/resource simulation.
  return {selected, targetAC, hit, critical, damageDice, raw};
}
let divergentAttacks = 0;
for (const t of FIRE_BOLT_ATTACK_CASES) {
  const rules = preview(t, t.characterLevel);
  const currentSqlProjection = preview(t, t.classLevel);
  for (const [actual,expected,label] of [
    [rules.selected,t.expectedRoll,"selected roll"],
    [rules.targetAC,t.expectedAC,"cover-adjusted AC"],
    [rules.hit,t.expectedHit,"hit"],
    [rules.critical,t.expectedCritical,"critical"],
    [rules.damageDice,t.expected2024Dice,"2024 dice"],
    [currentSqlProjection.damageDice,t.expectedCurrentSqlDice,"SQL dice"],
    [rules.raw,t.expected2024Raw,"2024 raw"],
    [currentSqlProjection.raw,t.expectedCurrentSqlRaw,"SQL raw"]
  ]) assert.equal(actual,expected,t.name + ": " + label);
  if (rules.damageDice !== currentSqlProjection.damageDice) divergentAttacks++;
}
assert.equal(discrepancies,4, "expect four documented multiclass tier discrepancies");
assert.equal(divergentAttacks,3, "expect three documented attack damage discrepancies");
console.log("P2 Fire Bolt shadow reference PASS: " + FIRE_BOLT_LEVEL_CASES.length +
  " level cases, " + FIRE_BOLT_ATTACK_CASES.length + " controlled attack cases; " +
  discrepancies + " multiclass level divergences; " + divergentAttacks +
  " attack damage divergences; no live casts, RNG, resource spending or DB writes.");
