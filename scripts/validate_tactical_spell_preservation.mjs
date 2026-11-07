// Read-only preservation gate: never imports the Supabase client or executes SQL.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.resolve(root, rel), "utf8");
const manifest = JSON.parse(read("scripts/data/tactical_spell_preservation_20261107.json"));
const ui = read("pages/encounters/combat.js");
const suite = read("scripts/validate_tactical_spell_suite.mjs");
const recovery = read("docs/Deployed_Tactical_Spell_Effects_Smoke_Recovery_2026-11-07.md");
const phases = [...Array(18)].map((_, i) => "1" + String.fromCharCode(73 + i));
const slugs = manifest.spells.map((s) => s.key);
const quotedWhitelist = ui.match(/const SUPPORTED_SPELL_KEYS = new Set\(\[([\s\S]*?)\]\);/);
assert(quotedWhitelist, "Missing exact combat UI whitelist");
const whitelist = [...quotedWhitelist[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.spells.length, 19);
assert.deepEqual([...new Set(slugs)].sort(), [...slugs].sort(), "Duplicate canonical key");
assert.deepEqual([...slugs].sort(), [...whitelist].sort(), "19-adapter UI whitelist changed (add/remove/source drift)");
assert(ui.includes('row?.source === "XPHB" && row?.sourceType === "class"'), "XPHB class-owned filter changed");
assert(ui.includes("function castSpell()"), "Guarded UI cast entry changed");
assert(ui.includes('return runRpc(rpcName,'), "Single-target dispatch missing");
assert.equal((suite.match(/"scripts\/validate_[^"]+\.mjs"/g) || []).length, 48, "Tactical regression suite size changed");
assert.deepEqual([...new Set(manifest.spells.map((s) => s.phase))].sort(), phases.map((p) => "Phase " + p).sort(), "Historical phases missing");
const declaredNames = new Set(manifest.spells.filter((s) => s.persistedSmokeEvidence === "named-persisted").map((s) => s.key));
const claimedNames = new Set(manifest.historical.persisted.namedSpellKeys);
assert.deepEqual([...declaredNames].sort(), [...claimedNames].sort(), "Named smoke evidence inconsistent");
assert.equal(manifest.historical.persisted.spellCastEvents, 8, "Persisted event-count receipt drift");
assert.equal(manifest.historical.persisted.version, 64, "Historic resolved smoke version drift");
assert.equal(manifest.historical.persisted.status, "resolved", "Historic smoke-state receipt drift");
assert.equal(manifest.historical.archivedSourceChecks.find((x) => x.pr === 299)?.result, "failure", "Negative #299 result must be retained");
assert(manifest.historical.archivedSourceChecks.find((x) => x.pr === 299)?.errorSignature.includes("controller_user_id"), "Original failure signature lost");
assert(recovery.includes("48 individual validators"), "Recovery document/source suite disagreement");
assert(recovery.includes("Version **64**"), "Historical live smoke snapshot changed; reconcile deliberately");
assert(recovery.includes("40801549016") && recovery.includes("40801549033"), "Archived failed CI receipts missing");

assert(manifest.architectureBoundary?.approvedPivotDate === "2026-10-31", "Approved mechanics-family pivot record missing");
assert(manifest.architectureBoundary?.futureDirection?.includes("recipe engine"), "Future composable engine direction lost");
const acidConflict = manifest.reviewConflicts?.find(x => x.id === "xphb-acid-splash-held-classifier");
assert(acidConflict?.status === "open-review-required", "Held Acid Splash taxonomy conflict must remain explicit pending review");
assert(acidConflict.heldResearch.includes("limited-number-of-targets"), "Original held-classifier discrepancy evidence missing");
const levelConflict = manifest.reviewConflicts?.find(x => x.id === "cantrip-total-level-parity");
assert(levelConflict?.status === "source-review-required-not-a-confirmed-runtime-defect", "Cantrip scaling audit gap must stay visible");


const branch = ui.slice(ui.indexOf("function castSpell()"), ui.indexOf("return runRpc(rpcName,"));
assert(branch.length > 500, "Cast route block not found");
const rpcSelection = ui.slice(ui.indexOf("const rpcName = key === "), ui.indexOf("return runRpc(rpcName,"));
assert(rpcSelection.includes('"encounter_cast_spell_v1"'), "Foundation fallback changed");

for (const spell of manifest.spells) {
  const {key, phase, rpc, sql, serverValidator, uiValidator, ledger, mechanicsFamily, exception, sourceReviewGap} = spell;
  assert.match(key, /^[a-z]+(?:-[a-z]+)*\|xphb$/, key);
  assert.equal(spell.source, "XPHB", key);
  assert(mechanicsFamily && exception && sourceReviewGap, key + " lacks mechanics/exception/gap");
  for (const rel of [sql, serverValidator, uiValidator, ledger]) {
    assert(!rel.includes("..") && !path.isAbsolute(rel) && fs.existsSync(path.resolve(root, rel)), key + " missing " + rel);
  }
  const sqlText = read(sql).toLowerCase();
  assert(sqlText.includes("create or replace function " + rpc.toLowerCase() + "("), key + " original RPC definition missing");
  assert(sqlText.includes(key), key + " source-qualified SQL branch missing");
  assert(sqlText.includes("p_request_id") && sqlText.includes("p_assignment_id"), key + " guarded RPC signature drift");
  const serverText = read(serverValidator).toLowerCase();
  const uiText = read(uiValidator).toLowerCase();
  assert(serverText.includes(key), key + " server validator no longer checks identity");
  assert(uiText.includes(key), key + " UI validator no longer checks identity");
  for (const validator of [serverValidator, uiValidator]) {
    assert(suite.includes('"' + validator + '"'), key + " validator removed from suite: " + validator);
  }
  const ledgerText = read(ledger).toLowerCase();
  assert(/rollback|transaction/.test(ledgerText), key + " phase ledger lacks transactional test provenance");
  assert(ledger.includes("Phase" + phase.replace("Phase ", "")), key + " mismatched phase ledger");
  const rpcName = rpc.replace(/^public\./, "");
  if (rpcName.startsWith("encounter_cast_spell_")) {
    if (rpcName === "encounter_cast_spell_v1") {
      assert(rpcSelection.includes('"encounter_cast_spell_v1"'), "Foundation fallback absent");
    } else {
      const matcher = new RegExp('key === "' + key.replace("|", "\\|") + '"\\s*\\?\\s*"' + rpcName + '"');
      assert(matcher.test(rpcSelection), key + " single-target UI route drift: " + rpcName);
    }
  } else {
    const keyPosition = branch.indexOf('if (key === "' + key + '")');
    assert(keyPosition >= 0, key + " missing special UI route");
    const route = branch.slice(keyPosition, keyPosition + 240);
    assert(route.includes('runRpc("' + rpcName + '"'), key + " special UI RPC drift");
  }
  if (key === "acid-splash|xphb") {
    // Preserve the reviewed XPHB geometry instead of a held research label implying a limited creature count.
    assert(spell.mechanicsFamily === "point-origin-sphere-save", "Acid Splash must use deployed point-origin Sphere mechanics");
    assert(sqlText.includes("'arearadiusft',5") && sqlText.includes("'serverderivedmembership',true"),
      "XPHB Acid Splash must retain a 5-ft sphere with server-derived creature membership");
    assert(sqlText.includes("p_origin_q") && sqlText.includes("for v_t in") &&
      sqlText.includes("public.encounter_saving_throw_profile_internal_v1(v_t.id,'dex')"),
      "XPHB Acid Splash point/creature/save authority changed");
    assert(ledgerText.includes("every creature in the sphere"), "Original XPHB area-target requirement lost");
  }
  if (key === "lightning-bolt|xphb") {
    assert(spell.transactionEvidence.includes("rollback-only") && spell.sourceReviewGap.includes("No persistent eligible caster"), "Lightning Bolt evidence must remain rollback-only");
    assert.equal(spell.persistedSmokeEvidence, "unconfirmed", "Lightning Bolt persistent smoke overclaim");
  }
  if (key === "magic-missile|xphb" || key === "vicious-mockery|xphb") {
    assert(spell.exception.includes("GM-assisted") || spell.sourceReviewGap.includes("GM-assisted"), key + " unresolved exception lost");
  }
  console.log("PASS", phase, key, rpcName, "source/route/SQL/validator/ledger/evidence");
}
assert.equal(declaredNames.size, 6, "Historical documented smoke names are a subset, not 19");
console.log("PASS historical: 8 recorded casts, 6 explicitly named spells, #294 pass, #299 failures retained");
console.log("PASS preservation: 19 XPHB source-qualified adapters, 48 regression registrations; NO RPC/SQL/cast executed");
