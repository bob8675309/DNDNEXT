import assert from "node:assert/strict";
import { compareAttunedPlayerSheetSpells } from "../utils/attunedPlayerSheetSpellShadow.js";
import { buildCharacterSheetActions } from "../utils/characterSheetActions.js";

const characterId="cccccccc-0000-4000-8000-000000000001";
const keys=["str","dex","con","int","wis","cha"];
const mods=(values)=>({abilities:Object.fromEntries(keys.map(k=>[k,{effectiveMod:values[k]??0}]))});
const ability=(base,next,enabled=true)=>({
  schemaVersion:1,consumerEnforced:false,attunementEnabled:enabled,
  baseline:mods(base),shadow:mods(next),
});
const gate=(enabled=true)=>({
  schemaVersion:1,consumerEnforced:false,characterId,attunementEnabled:enabled,
  items:[],
});
const spell=(id,name,level,attributes={},assignment={})=>({
  id,prepared:true,casting_stat:"cha",attack_bonus_override:null,save_dc_override:null,
  spell:{id,name,level,...attributes},...assignment,
});
const rows=[
  spell("eldritch","Eldritch Blast",0,
    {attack_type:"ranged",damage_dice:"1d10",damage_types:["force"],range_text:"120 ft."},
    {prepared:false}),
  spell("sacred","Sacred Flame",0,
    {attack_type:"other",saving_throw_abilities:["dex"],damage_dice:"1d8",damage_types:["radiant"]}),
  spell("witch","Witch Bolt",1,
    {attack_type:"ranged",damage_dice:"2d12",damage_types:["lightning"],range_text:"60 ft."}),
  spell("override-attack","Override Attack",1,
    {attack_type:"ranged",damage_dice:"1d6"},
    {attack_bonus_override:11}),
  spell("override-save","Override Save",1,
    {saving_throw_abilities:["wis"],damage_dice:"1d4"},
    {save_dc_override:19}),
  spell("zero","Zero Override",1,
    {attack_type:"ranged",saving_throw_abilities:["con"]},
    {attack_bonus_override:0,save_dc_override:"0"}),
  spell("invalid-override","Invalid Override",1,
    {attack_type:"ranged"},
    {attack_bonus_override:"not-a-number"}),
  spell("healing","Cure Wounds",1,
    {healing_dice:"2d8",range_text:"Touch"},
    {uses_max:3,uses_remaining:2,recharge:"long_rest"}),
  spell("unprepared","Hidden Level 3 Spell",3,
    {attack_type:"ranged"},
    {prepared:false,always_available:false}),
];
const sheet={
  meta:{classKey:"warlock",subclass:"Hexblade",spellcastingAbility:"cha"},
  classFeatures:["Pact of the Blade"],
  spellcasting:{pactSlots:2,pactSlotLevel:3},
};
const originalRows=structuredClone(rows);
const baseline={cha:4,dex:2,wis:1,int:3};
const selected={cha:2,dex:2,wis:1,int:3};
const run=(overrides={})=>compareAttunedPlayerSheetSpells({
  characterId,sheet,spellRows:rows,proficiencyBonus:3,
  abilityShadow:ability(baseline,selected),
  sourceGate:gate(),...overrides,
});
const byId=(result,id,source="shadowActions")=>
  result[source].find(a=>a.id==="spell:"+id);
const out=run();
assert.equal(out.attunementEnabled,true);
assert.equal(out.consumerEnforced,false);
assert.equal(out.sheetSpellParityReady,false);
assert.equal(out.tacticalSpellParityReady,false);
assert.equal(out.equipmentSpellBonusProvenanceVerified,false);
assert.equal(out.spellDamageRidersVerified,false);

const blast=byId(out,"eldritch");
assert.equal(byId(out,"eldritch","baselineActions").attackBonus,7);
assert.equal(blast.attackBonus,5);
assert.equal(blast.kind,"spell-attack");
assert.equal(blast.group,"Cantrips");
assert.equal(blast.damageFormula,"1d10");
assert.equal(blast.damageType,"force");
assert.ok(blast.summary.includes("+5 spell attack"));
assert.equal(blast.statusLabel,"Cantrip");

const save=byId(out,"sacred");
assert.equal(byId(out,"sacred","baselineActions").saveDc,15);
assert.equal(save.saveDc,13);
assert.deepEqual(save.saveAbilities,["dex"]);
assert.equal(save.damageFormula,"1d8");
assert.equal(save.kind,"spell-save");
assert.ok(save.resolutionText.includes("DC 13"));

const witch=byId(out,"witch");
assert.equal(witch.attackBonus,5);
assert.equal(witch.damageFormula,"2d12");
assert.ok(witch.detail.includes("2 level-3 pact slots"),"Pact slot display should remain untouched");
assert.equal(byId(out,"override-attack").attackBonus,11);
assert.equal(byId(out,"override-attack","baselineActions").attackBonus,11);
assert.equal(byId(out,"override-save").saveDc,19);
assert.equal(byId(out,"override-save","baselineActions").saveDc,19);
assert.equal(byId(out,"zero").attackBonus,0);
assert.equal(byId(out,"zero").saveDc,0);
assert.equal(byId(out,"invalid-override").attackBonus,5);
assert.equal(byId(out,"healing").kind,"spell-healing");
assert.equal(byId(out,"healing").healing,"2d8");
assert.equal(byId(out,"healing").damageFormula,null);
assert.ok(byId(out,"healing").summary.includes("2/3 uses"));
assert.equal(byId(out,"unprepared"),undefined);
assert.equal(out.baselineActions.length,8);
assert.ok(out.changes.some(c=>c.spellActionId==="spell:eldritch" && c.baselineAttackBonus===7 && c.shadowAttackBonus===5));
assert.ok(out.changes.some(c=>c.spellActionId==="spell:sacred" && c.baselineSaveDc===15 && c.shadowSaveDc===13));
assert.ok(!out.changes.some(c=>c.spellActionId==="spell:override-attack"));
assert.ok(!out.changes.some(c=>c.spellActionId==="spell:override-save"));
assert.equal(out.unresolvedSources.filter(s=>s.reason==="explicit_spell_override_origin_unverified").length,4);
assert.ok(out.unresolvedSources.some(s=>s.reason==="invalid_spell_override_fell_back_to_ability"));
assert.deepEqual(rows,originalRows,"Shadow cannot change prepared spells or assignment overrides");

// OFF is exact canonical action data even when no attunement choices exist;
// do not require the ON projection to be populated or numerically valid.
const off=run({
  sourceGate:gate(false),
  abilityShadow:{schemaVersion:1,consumerEnforced:false,attunementEnabled:false,
    baseline:mods(baseline),shadow:null},
});
const canonical=buildCharacterSheetActions({
  sheet,spellRows:rows,inventoryRows:[],featureRows:[],
  abilityModifiers:baseline,proficiencyBonus:3,
}).filter(a=>a.id.startsWith("spell:"));
assert.deepEqual(off.baselineActions,canonical);
assert.deepEqual(off.shadowActions,canonical);
assert.deepEqual(off.changes,[]);
assert.deepEqual(off.unresolvedSources,[]);

// Spell row's explicit casting_stat wins over a class default, and class
// defaults fall back from spellcasting.ability to meta.spellcastingAbility.
const multiAbility=run({
  sheet:{meta:{classKey:"wizard",spellcastingAbility:"int"},
    spellcasting:{ability:"int",spellAttackBonus:12,spellSaveDc:21}},
  spellRows:[
    spell("wizard","Fire Bolt",0,{attack_type:"ranged",damage_dice:"2d10"},{casting_stat:""}),
    spell("wis-save","Wisdom Save",1,{saving_throw_abilities:["str"]},{casting_stat:"wis"}),
  ],
  abilityShadow:ability({int:5,wis:4},{int:3,wis:1}),
});
assert.equal(byId(multiAbility,"wizard","baselineActions").attackBonus,8);
assert.equal(byId(multiAbility,"wizard").attackBonus,6);
assert.equal(byId(multiAbility,"wis-save","baselineActions").saveDc,15);
assert.equal(byId(multiAbility,"wis-save").saveDc,12);
assert.ok(multiAbility.unresolvedSources.some(s=>s.field==="spellAttackBonus"
  && s.reason==="stored_spellcasting_stat_not_used_by_quick_actions"));
assert.ok(multiAbility.unresolvedSources.some(s=>s.field==="spellSaveDc"
  && s.reason==="stored_spellcasting_stat_not_used_by_quick_actions"));

// A class feature toggle from the original builder must not change.
const barbarian=run({
  sheet:{meta:{classKey:"barbarian",spellcastingAbility:"wis"},
    rages:3,actionState:{rage:{active:true,usesRemaining:2,usesMax:3}}},
  spellRows:[spell("ritual","Wisdom Rite",0,{saving_throw_abilities:["dex"]},{casting_stat:"wis"})],
  abilityShadow:ability({wis:4},{wis:2}),
});
assert.equal(byId(barbarian,"ritual").saveDc,13);
assert.equal(barbarian.baselineActions.length,1);

// Missing casting stat in BOTH row and sheet uses legacy zero modifier;
// flag rather than pretending a valid spellcasting ability was identified.
const unknownStat=run({
  sheet:{meta:{classKey:"fighter"}},
  spellRows:[spell("unknown","Unknown Spell",0,{attack_type:"ranged"},{casting_stat:""})],
});
assert.equal(byId(unknownStat,"unknown").attackBonus,3);
assert.ok(unknownStat.unresolvedSources.some(s=>s.reason==="casting_ability_unverified"));

assert.throws(()=>run({characterId:"incorrect"}),/exact selected character identity/);
assert.throws(()=>run({sourceGate:{...gate(),attunementEnabled:false}}),/Incompatible source-gate/);
assert.throws(()=>run({abilityShadow:ability({cha:4},{cha:Infinity})}),/verified cha effective modifier/);
assert.throws(()=>run({spellRows:[rows[0],{...rows[0]}]}),/Duplicate visible spell-action identity/);
assert.throws(()=>run({sourceGate:{...gate(),schemaVersion:2}}),/Incompatible source-gate/);

console.log("Player spellcasting shadow: OFF exact actions, attack/DC, Pact slots, prepared cantrips, explicit/zero/invalid overrides, multi-stat and source identity checks passed.");
