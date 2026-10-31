import assert from "node:assert/strict";
import fs from "node:fs";
import {
 classifyTacticalSpellForReview, XPHB_ATTACK_EXCEPTIONS,
 XPHB_NON_ATTACK_EXCEPTIONS
} from "../utils/tacticalSpellMechanicsReview.mjs";

// Audited XPHB catalog spell-attack entries as of 2026-10-31.
// Only title/source/attack metadata is retained, not copyrighted spell text.
const spellAttacks = [
 ["chill-touch","Melee Spell Attack"],["eldritch-blast","Ranged Spell Attack"],
 ["fire-bolt","Ranged Spell Attack"],["poison-spray","Ranged Spell Attack"],
 ["produce-flame","Ranged Spell Attack"],["ray-of-frost","Ranged Spell Attack"],
 ["shocking-grasp","Melee Spell Attack"],["sorcerous-burst","Ranged Spell Attack"],
 ["starry-wisp","Ranged Spell Attack"],["thorn-whip","Melee Spell Attack"],
 ["chromatic-orb","Ranged Spell Attack"],["guiding-bolt","Ranged Spell Attack"],
 ["ice-knife","Ranged Spell Attack"],["ray-of-sickness","Ranged Spell Attack"],
 ["witch-bolt","Ranged Spell Attack"],["flame-blade","Melee Spell Attack"],
 ["melfs-acid-arrow","Ranged Spell Attack"],["scorching-ray","Ranged Spell Attack"],
 ["spiritual-weapon","Melee Spell Attack"],["vampiric-touch","Melee Spell Attack"],
 ["grasping-vine","Melee Spell Attack"],["bigbys-hand","Melee Spell Attack"],
 ["steel-wind-strike","Melee Spell Attack"],["mordenkainens-sword","Melee Spell Attack"],
];
assert.equal(spellAttacks.length,24);
assert.equal(new Set(spellAttacks.map(x=>x[0])).size,24);
const listed=new Set(spellAttacks.map(x=>x[0]+"|XPHB"));
const special=new Set(Object.keys(XPHB_ATTACK_EXCEPTIONS));
assert.equal(special.size,22,"Exactly two ordinary ranged attack candidates expected");
for(const key of special)assert.ok(listed.has(key),"Special attack not in audited catalog "+key);
for(const [name,attack_type] of spellAttacks){
 const key=name+"|XPHB";
 const classification=classifyTacticalSpellForReview({
  spell_key:key,source:"XPHB",attack_type,damage_dice:"1d8"
 });
 assert.equal(classification.key,key);
 assert.equal(classification.approved,false,"Metadata must never grant casting privileges");
 assert.equal(classification.status,"manual-review");
 assert.ok(classification.family.includes("attack")||classification.family.includes("persistent")||
  classification.family.includes("light")||classification.family.includes("summoned"),
  "Missing attack family for "+key);
}
const sample=(name,props={})=>({
 spell_key:name+"|XPHB",source:"XPHB",...props
});
assert.equal(classifyTacticalSpellForReview(sample("eldritch-blast",{attack_type:"Ranged Spell Attack"})).family,
 "multi-ranged-spell-attacks");
assert.equal(classifyTacticalSpellForReview(sample("scorching-ray",{attack_type:"Ranged Spell Attack"})).family,
 "multi-ranged-spell-attacks");
assert.equal(classifyTacticalSpellForReview(sample("steel-wind-strike",{attack_type:"Melee Spell Attack"})).family,
 "multi-melee-spell-attacks");
assert.equal(classifyTacticalSpellForReview(sample("chromatic-orb",{attack_type:"Ranged Spell Attack"})).family,
 "ranged-spell-attack-with-chain");
assert.equal(classifyTacticalSpellForReview(sample("ice-knife",{
 attack_type:"Ranged Spell Attack",saving_throw_abilities:["Dexterity"]
})).family,"attack-plus-area-save");
assert.equal(classifyTacticalSpellForReview(sample("fire-bolt",{attack_type:"Ranged Spell Attack"})).family,
 "single-ranged-spell-attack-review");
assert.equal(classifyTacticalSpellForReview(sample("magic-missile",{damage_dice:"1d4 + 1"})).family,
 "auto-hit-allocated-projectiles");
assert.equal(classifyTacticalSpellForReview(sample("fireball",{
 saving_throw_abilities:["Dexterity"],damage_dice:"8d6",area_type:null
})).family,"point-origin-area-save");
assert.equal(classifyTacticalSpellForReview(sample("healing-word",{healing_dice:"2d4"})).family,
 "single-target-healing");
assert.equal(classifyTacticalSpellForReview(sample("acid-splash",{saving_throw_abilities:["Dexterity"]})).family,
 "selected-target-area-save");
assert.equal(classifyTacticalSpellForReview(sample("unknown-save",{
 saving_throw_abilities:["Dexterity"],area_type:null
})).family,"save-or-area-shape-review");
assert.equal(classifyTacticalSpellForReview(sample("unknown-attack",{
 attack_type:"Ranged Spell Attack"
})).status,"manual-review");
assert.equal(classifyTacticalSpellForReview(sample("fire-bolt",{attack_type:"Ranged Spell Attack"}),
 ["fire-bolt|xphb"]).status,"existing-reviewed-adapter");
assert.equal(classifyTacticalSpellForReview(sample("fire-bolt",{attack_type:"Ranged Spell Attack"}),
 ["fire-bolt|xphb"]).approved,true);
assert.equal(classifyTacticalSpellForReview({spell_key:"fire-bolt|PHB",source:"PHB",
 attack_type:"Ranged Spell Attack"},["fire-bolt|xphb"]).status,"manual-review");
assert.equal(classifyTacticalSpellForReview({spell_key:"fire-bolt|PHB",source:"PHB"}).family,
 "alternate-source-edition-review");
assert.equal(classifyTacticalSpellForReview({spell_key:"fire-bolt|PHB",source:"XPHB"}).family,
 "invalid-catalog-identity");
assert.equal(classifyTacticalSpellForReview({spell_key:"missing|XPHB"}).family,
 "invalid-catalog-identity");

const combat=fs.readFileSync("pages/encounters/combat.js","utf8");
const matches=combat.match(/const SUPPORTED_SPELL_KEYS = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(matches,"No exact reviewed adapter whitelist");
const approvedKeys=[...matches[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
assert.equal(approvedKeys.length,19,"Current audited tactical adapter count changed; review the matrix");
assert.equal(new Set(approvedKeys).size,19,"Duplicate adapter key");
assert.ok(!approvedKeys.includes("eldritch-blast|xphb"));
assert.ok(!approvedKeys.includes("scorching-ray|xphb"));
assert.ok(combat.includes("Beam target preview available; automated casting remains disabled"));
for(const key of approvedKeys){
 const descriptor=classifyTacticalSpellForReview({
  spell_key:key.slice(0,-5)+"|XPHB",source:"XPHB"
 },approvedKeys);
 assert.equal(descriptor.approved,true,"Existing reviewed adapter changed: "+key);
}
assert.equal(Object.keys(XPHB_NON_ATTACK_EXCEPTIONS).length,8);
console.log("Spell mechanics audit: 391 XPHB spells, 24 attack entries (22 special), 19 reviewed adapters; no implicit casting enablement PASS");
