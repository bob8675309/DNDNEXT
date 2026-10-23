import assert from "node:assert/strict";
import fs from "node:fs";
import { spellRuleReferenceDetail } from "../utils/spellRuleReferences.js";
import { itemRuleReferenceForLabel } from "../utils/itemRuleReferences.js";

const spell = { name: "Tasha's Hideous Laughter", source: "XPHB" };
const conditions = ["Blinded","Charmed","Deafened","Exhaustion","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious","Bleeding","Dazed"];
for (const condition of conditions) {
  const actual = spellRuleReferenceDetail({ kind:"condition", name:condition, source:"XPHB" },spell);
  const expected = itemRuleReferenceForLabel(condition)?.reference;
  assert.ok(expected, `Missing condition: ${condition}`);
  assert.equal(actual.reference.kindLabel,"Condition");
  assert.equal(actual.reference.title,expected.title);
  assert.equal(actual.reference.description,expected.description);
  assert.ok(!actual.reference.description.includes("referenced by"));
}
const prone = spellRuleReferenceDetail({kind:"condition",name:"Prone"},spell).reference;
for (const term of ["half your Speed","Speed is 0","within 5 feet","Disadvantage","Advantage"]) assert.ok(prone.description.includes(term),`Prone omitted ${term}`);
const inc = spellRuleReferenceDetail({name:"Incapacitated"},spell).reference;
for (const term of ["Bonus Actions","Concentration","speak","Initiative"]) assert.ok(inc.description.includes(term));
const stunned=spellRuleReferenceDetail({name:"Stunned"},spell).reference;
assert.ok(stunned.description.includes("does not reduce Speed to 0"),"2024 Stunned must not incorrectly impose Speed 0.");
for (const action of ["Attack","Dash","Disengage","Dodge","Help","Hide","Influence","Magic","Ready","Search","Study","Utilize"]) {
  const rule = spellRuleReferenceDetail({kind:"action",name:action},spell).reference;
  assert.equal(rule.kindLabel,"Action",action);
  assert.ok(rule.description.length>20);
}
for(const name of ["Cleave","Graze","Nick","Push","Sap","Slow","Topple","Vex"]) assert.equal(spellRuleReferenceDetail({name},spell).reference.kindLabel,"Weapon Mastery");
assert.equal(spellRuleReferenceDetail({name:"Difficult Terrain"},spell).reference.kindLabel,"Movement Rule");
assert.equal(spellRuleReferenceDetail({name:"Concentration"},spell).reference.kindLabel,"Spell Rule");
const unknown = spellRuleReferenceDetail({name:"Unindexed Rule",kind:"quickref"},spell).reference;
assert.match(unknown.description,/No standalone definition/);
assert.ok(!unknown.description.includes(spell.name));
const beast=spellRuleReferenceDetail({kind:"creature",name:"Bestial Spirit"},{name:"Summon Beast",source:"XPHB"}).reference;
assert.equal(beast.statBlock.abilities.length,6);
assert.match(spellRuleReferenceDetail({name:"Hindered"},{name:"Rime's Binding Ice"}).reference.description,/Speed to 0/);
const dock=fs.readFileSync("components/NpcForgeClassFeatureDock.js","utf8");
assert.ok(dock.includes('className="npc-forge-rules-reference__definition"'));
assert.ok(!dock.includes("Select another highlighted rule term on the spell card to inspect it here."));
assert.ok(!dock.includes("From {rulesReference.spellName}"));
console.log("Compact rule references verified for conditions, actions, movement, masteries and spell-specific entries.");
