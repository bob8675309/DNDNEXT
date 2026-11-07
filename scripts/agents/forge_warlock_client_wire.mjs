#!/usr/bin/env node
// Forge J168: execute the SAME pure source-owned Warlock choice functions
// imported by the browser, without a second rules engine or app credentials.
// The repository's extensionless client imports are mapped to in-memory ESM
// data URLs; function bodies and selection/serialization logic are unchanged.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWarlockChildPlans } from "../validate_forge_seeded_warlock_child_completion.mjs";

const read = (relative) => readFileSync(path.join(process.cwd(), relative), "utf8");
const uri = (source) => "data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64");
let sourcePromise;

async function productionSourceFunctions() {
  if (sourcePromise) return sourcePromise;
  sourcePromise = (async () => {
    const constants = uri(read("utils/classFeatureChoiceConstants.js"));
    const playerText = uri(read("utils/playerFacingText.js"));
    const original = read("utils/warlockInvocationChoices.js");
    const constantsImport = 'from "./classFeatureChoiceConstants"';
    const playerTextImport = 'from "./playerFacingText"';
    assert.ok(original.includes(constantsImport) && original.includes(playerTextImport),
      "Unexpected Warlock source imports; review loader instead of falling back to copied rules.");
    const linked = original
      .replace(constantsImport, 'from "' + constants + '"')
      .replace(playerTextImport, 'from "' + playerText + '"');
    const [warlock, source] = await Promise.all([
      import(uri(linked)),
      import(uri(read("utils/playerForgeSourceChoices.js")))
    ]);
    for (const key of ["toggleSourceChoiceSelection", "normalizeSourceChoiceSelections",
      "sourceChoiceGroupsComplete", "serializeSourceChoices", "foundationChoiceSummary"]) {
      assert.equal(typeof source[key], "function", "Missing real source-choice export: " + key);
    }
    assert.equal(typeof warlock.buildWarlockInvocationSourceGroups, "function");
    return { warlock, source };
  })();
  return sourcePromise;
}

export async function compileWarlockClientWire(live) {
  const { warlock, source } = await productionSourceFunctions();
  assert.equal(live?.classKey, "warlock");
  assert.equal(live?.classSource, "XPHB");
  assert.equal(live?.level, 2);
  assert.equal(live?.slots, 3);
  const selectedClass = { class_key: live.classKey, source: live.classSource };
  const optionRows = (live.invocations || []).map((inv) => ({
    id: inv.id,
    option_key: inv.key,
    option_type: "eldritch-invocation",
    class_key: live.classKey,
    source: live.classSource,
    name: inv.name,
    repeatable: false,
    prerequisites: inv.prerequisites || {},
    choice_schema: inv.choiceSchema || {},
  }));
  const spells = live.spells || [];
  const build = (selections) => warlock.buildWarlockInvocationSourceGroups({
    selectedClass, level: live.level, optionRows, spells, featOptions: [], selections,
  });
  let selections = {};
  for (const invocation of live.invocations) {
    const groupId = "warlock-invocation-slot-" + invocation.slot;
    let groups = build(selections);
    const group = groups.find((candidate) => candidate.id === groupId);
    const field = group?.fields.find((candidate) => candidate.id === "invocation");
    assert.ok(field?.options.some((option) => option.key === invocation.key),
      "Original frontend rejects " + invocation.name + " for level-" + live.level + " slot " + invocation.slot);
    selections = source.toggleSourceChoiceSelection(groups, selections, groupId, "invocation", invocation.key);
    assert.deepEqual(selections[groupId]?.invocation, [invocation.key],
      "Real frontend selection did not persist " + invocation.name);
    if (invocation.name === "Agonizing Blast") {
      groups = build(selections);
      const child = groups.find((candidate) => candidate.id === groupId)
        ?.fields.find((candidate) => candidate.id === "child-agonizing-blast");
      const preferred = spells.find((spell) => spell.name === "Eldritch Blast" && spell.source === "XPHB");
      assert.ok(preferred, "Source manifest lacks preferred Eldritch Blast.");
      assert.ok(child?.options.some((option) => option.key === preferred.id),
        "Actual frontend Agonizing Blast child excludes preferred Eldritch Blast.");
      selections = source.toggleSourceChoiceSelection(groups, selections, groupId,
        "child-agonizing-blast", preferred.id);
      assert.deepEqual(selections[groupId]?.["child-agonizing-blast"], [preferred.id],
        "Real frontend dependent child selection did not persist.");
    }
  }
  const groups = build(selections);
  selections = source.normalizeSourceChoiceSelections(groups, selections);
  assert.ok(source.sourceChoiceGroupsComplete(groups, selections, { ownerType: "class-option" }),
    "Actual frontend source-choice completion guard rejected the selected Warlock.");
  const sourceChoices = source.serializeSourceChoices(groups, selections);
  const sourceChoiceSummary = source.foundationChoiceSummary(groups, selections);
  assert.equal(Object.keys(sourceChoices).length, live.slots);
  assert.equal(sourceChoiceSummary.filter((entry) => entry.kind === "eldritch-invocation").length, 3);
  const slot = sourceChoices["warlock-invocation-slot-2"];
  const invocationSelection = slot?.fields?.invocation?.selections?.[0];
  const childSelection = slot?.fields?.["child-agonizing-blast"]?.selections?.[0];
  assert.equal(invocationSelection?.key, live.invocations[1].key);
  assert.equal(invocationSelection?.label, "Agonizing Blast");
  assert.ok(!Object.hasOwn(invocationSelection, "name"), "Browser serializer unexpectedly emitted historical name.");
  assert.equal(childSelection?.value, spells.find((spell) => spell.name === "Eldritch Blast")?.id);
  assert.equal(childSelection?.source, "XPHB");
  assert.equal(sourceChoiceSummary.length, 4);
  return { sourceChoices, sourceChoiceSummary };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  assert.deepEqual(process.argv.slice(2), ["--selftest"], "Only --selftest is supported; do not emit raw player payload.");
  const live = loadWarlockChildPlans().source;
  const first = await compileWarlockClientWire(live);
  assert.deepEqual(first, await compileWarlockClientWire(live),
    "Original client choices are not deterministic for an identical source seed.");
  const missingSpell = structuredClone(live);
  missingSpell.spells = missingSpell.spells.filter((entry) => entry.name !== "Eldritch Blast");
  await assert.rejects(() => compileWarlockClientWire(missingSpell), /preferred Eldritch Blast/i,
    "Source choice executor must fail closed if dependent preferred source spell is absent.");
  const illegalFirstSlot = structuredClone(live);
  illegalFirstSlot.invocations[0].prerequisites = { minClassLevel: 5 };
  await assert.rejects(() => compileWarlockClientWire(illegalFirstSlot),
    /Original frontend rejects Armor of Shadows/i,
    "Original client must reject an Invocation outside its acquisition slot.");
  console.log("PASS STATIC J168 real Warlock source builder + source-choice toggle/normalization/completion/serializer; 3 Invocation slots, Agonizing Blast preferred child, 4 summary choices, deterministic and fail-closed.");
  console.log("SOURCE EXECUTION ONLY; genuine local signed original v3 and rendered-browser capture are separate acceptance gates.");
}
