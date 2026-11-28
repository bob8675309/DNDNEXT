// Shared read-only receipt for the original signed Forge and advancement runners.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const sourcePins = {
  "scripts/fixtures/forge_seeded_warlock_child_completion_v1.json": "f30c9d25f39acfaab214a3135c6b7be34d21aea6",
  "scripts/agents/forge_warlock_client_wire.mjs": "a90013d3dbb590af4dfae76e87863453daa04d9b",
  "scripts/fixtures/forge_creation_original_functions_pg17.sql": "6c64683e14ee148daf5c874a7e6e3c7ff606138c",
  "scripts/fixtures/forge_warlock_child_completion_local_auth_pg17.sql": "94fa076d8e3e075aab551a5610bcff79393f3460",
  "scripts/fixtures/forge_nested_choices_original_pg17.sql": "6eb50c0d0bd63da6ffd5d20c0e2fa09b8dcbf17a",
  "scripts/fixtures/i1g_warlock_original_acquisition_pg17.sql": "7ec34da724bb22ed5d299ff27a5e07e0f0373180",
};
export function verifyEquivalenceSources() {
  for (const [path, expected] of Object.entries(sourcePins)) {
    const source = readFileSync(path);
    assert.equal(createHash("sha1").update("blob "+source.length+"\0").update(source).digest("hex"), expected, path);
  }
  return JSON.parse(readFileSync(Object.keys(sourcePins)[0], "utf8")).live;
}

export function readWarlockEquivalence(sql, characterId, source) {
  assert.match(characterId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const where = " WHERE character_id='"+characterId+"'";
  const sheet = JSON.parse(sql("SELECT sheet FROM public.character_sheets"+where));
  const classId = sql("SELECT class_id FROM public.character_progression"+where);
  assert.equal(classId, source.classId);
  const rows = JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object(
    'slot',g.instance_key,'optionId',g.option_catalog_id,'optionKey',o.option_key,
    'source',o.source,'type',g.option_type,'acquiredLevel',g.acquired_level,
    'childId',coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}'))
    ORDER BY g.instance_key) FROM public.character_class_option_grant_instances g
    JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id
    WHERE g.character_id='${characterId}'`));
  assert.equal(rows.length, source.slots);
  assert.equal(sheet.classKey, source.classKey);
  assert.equal(sheet.rulesetSource, source.classSource);
  assert.equal(sheet.level, source.level);
  const blast = source.spells.find(spell => spell.name === "Eldritch Blast");
  const comparable = rows.slice(1).map((row, index) => {
    const option = source.invocations[index+1];
    const slot = "warlock-invocation-slot-"+option.slot;
    const group = sheet.sourceChoices[slot];
    const invocation = group.fields.invocation.selections[0];
    const child = group.fields["child-agonizing-blast"]?.selections[0];
    const childId = index === 0 ? blast.id : null;
    assert.deepEqual(row, {
      slot, optionId:option.id, optionKey:option.key, source:source.classSource,
      type:"eldritch-invocation", acquiredLevel:option.acquisitionLevel, childId,
    });
    assert.equal(group.ownerType, "class-option");
    assert.equal(group.ownerKey, "warlock-invocation-"+option.slot);
    assert.equal(group.placement, "class");
    assert.equal(invocation.key, row.optionKey);
    assert.equal(invocation.source, row.source);
    assert.equal(child?.value ?? child?.key ?? null, childId);
    return {...row, ownerType:group.ownerType, ownerKey:group.ownerKey, placement:group.placement};
  });
  const spells = JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('spellId',spell_id,'type',source_type,"+
    "'key',source_key,'ability',casting_stat,'available',always_available) ORDER BY spell_id) FROM public.character_spells"+
    where+" AND source_type='class'"));
  assert.equal(spells.length, source.cantrips+source.spellsKnown);
  const sharedSpell = spells.find(spell => spell.spellId === blast.id);
  assert.deepEqual(sharedSpell, {spellId:blast.id,type:"class",key:"warlock",ability:"cha",available:true});
  return {
    common:{classId, classKey:sheet.classKey, source:sheet.rulesetSource, level:sheet.level, grants:comparable, sharedSpell},
    specimen:{firstSlot:rows[0].optionKey, classSpellIds:spells.map(spell => spell.spellId)},
  };
}

// Compare the complete starting specimen. Advancement intentionally uses a
// different slot-one option and spell list, so its existing comparator stays separate.
export function readStartingWarlock(sql, characterId, source) {
  const base=readWarlockEquivalence(sql,characterId,source);
  const where=" WHERE g.character_id='"+characterId+"'";
  const grants=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object(
    'slot',g.instance_key,'optionId',g.option_catalog_id,'optionKey',o.option_key,
    'level',g.acquired_level,'source',o.source,'type',g.option_type,
    'owner',g.metadata->>'source',
    'childId',coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}')) ORDER BY g.instance_key)
    FROM public.character_class_option_grant_instances g
    JOIN public.class_feature_option_catalog o ON o.id=g.option_catalog_id ${where}`));
  assert.deepEqual(grants,source.invocations.map(option=>({
    slot:"warlock-invocation-slot-"+option.slot,optionId:option.id,optionKey:option.key,
    level:option.acquisitionLevel,source:source.classSource,type:"eldritch-invocation",owner:"player-forge",
    childId:option.name==="Agonizing Blast" ? base.common.sharedSpell.spellId : null,
  })));
  const spells=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object(
    'spellId',s.id,'level',s.level,'source',s.source,'owner',g.source_key,
    'castingStat',g.casting_stat,'available',g.always_available) ORDER BY s.id)
    FROM public.character_spells g JOIN public.spells_catalog s ON s.id=g.spell_id
    ${where} AND g.source_type='class'`));
  return {class:base.common.classId,level:base.common.level,grants,spells};
}

export function writeEquivalenceReceipt(path, kind, evidence) {
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  writeFileSync(path, JSON.stringify({kind, sha:process.env.GITHUB_SHA, sourcePins, ...evidence}, null, 2)+"\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [creation, advancement, mounted] = process.argv.slice(2).map(path => JSON.parse(readFileSync(path, "utf8")));
  assert.equal(creation.kind, "creation");
  assert.equal(advancement.kind, "advancement");
  for (const receipt of [creation, advancement]) {
    assert.equal(receipt.sha, process.env.GITHUB_SHA);
    assert.deepEqual(receipt.sourcePins, sourcePins);
  }
  assert.deepEqual(Object.keys(creation.cases), ["J165", "J167", "J168"]);
  for (const [id, receipt] of Object.entries(creation.cases)) {
    assert.deepEqual(receipt.common, advancement.earned.common, id);
  }
  assert.deepEqual(creation.rejections, ["omitted-child", "invalid-child", "duplicate-spell"]);
  assert.deepEqual(advancement.rejections, ["omitted-child", "invalid-child", "duplicate-invocation"]);
  assert.equal(creation.replay, "same-nonce-inert");
  assert.equal(advancement.repeatSubmission, "REPLACE-04");
  assert.deepEqual(advancement.replacementStages, ["REPLACE-01", "REPLACE-02", "REPLACE-03", "REPLACE-04", "REPLACE-05", "REPLACE-06", "REPLACE-07"]);
  console.log("::notice title=Signed Forge and advancement equivalence::J165, J167 and J168 persisted the same source-qualified earned slots, child and class-owned Eldritch Blast as signed v5. Original rejections, nonce replay and replacement stages passed.");
  if(mounted){
    assert.equal(mounted.kind,"mounted-j168");
    assert.equal(mounted.sha,process.env.GITHUB_SHA);
    assert.deepEqual(mounted.sourcePins,sourcePins);
    assert.deepEqual(mounted.canonical,creation.startingJ168);
    assert.equal(mounted.replay,"same-nonce-inert");
    assert.deepEqual(mounted.rejections,["changed-story-22023","outsider-42501","missing-child-P0001","invalid-child-P0001"]);
    assert.deepEqual(mounted.fingerprints,{
      storyHash:"6e39477f971c9d40c6726c9f4dbc456e",
      optionHash:"6df5aee6f0519c9c77758d6e887ed8e4",
      validatorHash:"4f1752db655b6ba490113f604c7583ef",
    });
    console.log("::notice title=Mounted Story and signed J168 equivalence::STORY-J168-04 passed. The same-head signed starting Warlocks persisted all three identical source-owned slots and five identical class spell assignments.");
  }

}
