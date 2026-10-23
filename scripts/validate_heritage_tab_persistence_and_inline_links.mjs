import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSpeciesSourceChoiceGroups } from "../utils/playerForgeSpeciesChoices.js";
import { normalizeSourceChoiceState, EMPTY_SOURCE_CHOICE_STATE } from "../components/NpcForgeSourceChoiceContext.js";
import { applyDirectSourceChoiceSelection } from "../utils/directSourceChoiceState.js";

const opt = (name) => ({ key: `heritage-trait:${name}|GRIMHOLLOWPG24`, label: name, value: name, kind: "heritage-trait" });
const names = ["Creature Cover","Magical Fortification","Artificial Form","Helping Hand","Pass Through","Magical Savvy","Other","Intuitive Acrobat"];
const catalog = [...names, "Brave", "Battlefield Control"].map((name) => ({ ...opt(name), name, repeatLimit: 2, category: "C" }));
const species = { id:"dhampir-grim-hollow", name:"Dhampir (Grim Hollow)", source:"GrimHollowPG24", metadata:{
  heritageOnly:true, heritagePickCount:8, heritageTraitCatalog:catalog,
  traditionalHeritageSelections:names.map((name)=>({ key:opt(name).key, name, category:"C" })),
}};
const heritage = buildSpeciesSourceChoiceGroups({ species }).find((g)=>g.metadata?.heritageTraitGroup);
assert.ok(heritage && heritage.fields.length===8);
let state = normalizeSourceChoiceState([heritage], true, EMPTY_SOURCE_CHOICE_STATE, "heritage-primary");
const original = heritage.fields.map((field)=>state.selections[heritage.id][field.id][0]);
assert.deepEqual(original, names.map((name)=>opt(name).key));
// Five user-edited picks must survive mounting / unmounting the Species panel.
for (let i=0;i<5;i++) {
  state=applyDirectSourceChoiceSelection(state, heritage, heritage.fields[i].id, [opt(i===0?"Brave":i===1?"Battlefield Control":names[i]).key]);
}
const before=JSON.stringify(state.selections[heritage.id]);
state=normalizeSourceChoiceState([],true,state,"heritage-subchoices-"+heritage.id);
state=normalizeSourceChoiceState([],true,state,"species-extra");
state=normalizeSourceChoiceState([],true,state,"foundation");
state=normalizeSourceChoiceState([],true,state,"feats");
assert.equal(JSON.stringify(state.selections[heritage.id]), before,"Background/Class tab registration erased Heritage");
const active=state.groups.find((g)=>g.id===heritage.id && g.metadata?.heritageTraitGroup);
assert.ok(active, "Primary Heritage group must remain registered outside Species");
state=normalizeSourceChoiceState([heritage],true,state,"species-extra");
assert.equal(JSON.stringify(state.selections[heritage.id]), before,"Returning to Species erased Heritage");
state=applyDirectSourceChoiceSelection(state,heritage,heritage.fields[4].id,[]);
const afterRemoval=JSON.stringify(state.selections[heritage.id]);
state=normalizeSourceChoiceState([heritage],true,state,"heritage-primary");
assert.equal(JSON.stringify(state.selections[heritage.id]),afterRemoval,"Explicitly cleared slot must not reseed");
const panel=fs.readFileSync("components/NpcForgeContextPanelRefined.js","utf8");
const controller=fs.readFileSync("components/useNpcForgeController.js","utf8");
const css=fs.readFileSync("styles/spell-card.css","utf8");
assert.ok(panel.includes('registerSourceGroups(selectedHeritageGroup ? [selectedHeritageGroup] : [], true, "heritage-primary")'));
assert.ok(controller.includes("buildSpeciesSourceChoiceGroups({ species: selectedSpecies })"));
assert.ok(css.includes(".spell-card .source-rule-content__inline-reference") && css.includes("font: inherit !important;") && css.includes("text-decoration: underline dotted"));
console.log("Heritage persistence across tab lifecycles and unobtrusive spell link styling validated.");
