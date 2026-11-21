import test from "node:test";
import assert from "node:assert/strict";
import {
 NPC_INTERACTION_PRESETS, NPC_INTERACTION_CAPABILITIES,
 planNpcPresetAssignment,projectNpcPanelPermissions
} from "./candidates/t46_p3_p4b_c2b14_p6_npc_tier_ui_presets.mjs";

const npc="00000000-0000-4000-8000-000000000011";
const user="00000000-0000-4000-8000-000000000012";
const context=(p={})=>({
 can_view_public_profile:true,can_view_worn_gear:true,
 worn_gear:[{name:"Steel breastplate"}],
 can_view_backpack:false,backpack:[{id:"secret",name:"hidden NPC pouch"}],
 can_manage_equipment:false,can_withdraw_items:false,
 can_auto_accept_items:false,can_issue_encounter_commands:false,
 ...p
});
test("four descriptive tiers are authoring presets, not privilege levels",()=>{
 assert.deepEqual(Object.keys(NPC_INTERACTION_PRESETS),
  ["public","hired","trusted","delegated"]);
 for(const preset of Object.keys(NPC_INTERACTION_PRESETS)){
  const p=planNpcPresetAssignment({npcId:npc,userId:user,preset});
  assert.equal(p.willMutate,false);
  assert.equal(p.reviewRequired,true);
  assert.deepEqual(p.capabilityChanges.map(x=>x.capability),NPC_INTERACTION_CAPABILITIES);
  assert.ok(Object.isFrozen(p));
  assert.equal("isAdmin" in p,false);
  assert.equal("canViewGmSecrets" in p,false);
 }
});
test("public NPC is public profile/worn gear; personal backpack hidden",()=>{
 const p=planNpcPresetAssignment({npcId:npc,userId:user,preset:"public"});
 assert.equal(p.combatControlChange.enabled,false);
 assert.ok(p.capabilityChanges.every(x=>x.enabled===false));
 const ui=projectNpcPanelPermissions(context());
 assert.equal(ui.showPublicProfile,true);
 assert.equal(ui.showWornGear,true);
 assert.deepEqual(ui.visibleWornGear,[{name:"Steel breastplate"}]);
 assert.equal(ui.showBackpack,false);
 assert.deepEqual(ui.visibleBackpack,[]);
 assert.equal(ui.showEquipAndUnequip,false);
 assert.equal(ui.showWithdrawAndTransfer,false);
});
test("hired henchman sees backpack read-only, commands combat, cannot equip/take",()=>{
 const p=planNpcPresetAssignment({npcId:npc,userId:user,preset:"hired"});
 assert.equal(p.combatControlChange.enabled,true);
 assert.deepEqual(p.capabilityChanges.map(x=>x.enabled),[true,false,false,false]);
 const ui=projectNpcPanelPermissions(context({
  can_view_backpack:true,can_issue_encounter_commands:true
 }));
 assert.equal(ui.showBackpack,true);
 assert.equal(ui.visibleBackpack.length,1);
 assert.equal(ui.allowTacticalCommands,true);
 assert.equal(ui.showEquipAndUnequip,false);
 assert.equal(ui.showWithdrawAndTransfer,false);
 assert.equal(ui.canAutomaticallyReceiveItem,false);
});
test("trusted companion may change outfit without withdrawing or auto-accepting",()=>{
 const p=planNpcPresetAssignment({npcId:npc,userId:user,preset:"trusted"});
 assert.deepEqual(p.capabilityChanges.map(x=>x.enabled),[true,true,false,false]);
 const ui=projectNpcPanelPermissions(context({
  can_view_backpack:true,can_manage_equipment:true,
  can_issue_encounter_commands:true
 }));
 assert.equal(ui.showEquipAndUnequip,true);
 assert.equal(ui.showWithdrawAndTransfer,false);
 assert.equal(ui.canAutomaticallyReceiveItem,false);
});
test("fully delegated flags explicitly include withdrawal and auto accept, not secrets",()=>{
 const p=planNpcPresetAssignment({npcId:npc,userId:user,preset:"delegated"});
 assert.deepEqual(p.capabilityChanges.map(x=>x.enabled),[true,true,true,true]);
 const ui=projectNpcPanelPermissions(context({
  can_view_backpack:true,can_manage_equipment:true,
  can_withdraw_items:true,can_auto_accept_items:true,
  can_issue_encounter_commands:true
 }));
 assert.equal(ui.showEquipAndUnequip,true);
 assert.equal(ui.showWithdrawAndTransfer,true);
 assert.equal(ui.canAutomaticallyReceiveItem,true);
 assert.equal(ui.canViewGmSecrets,false);
 assert.equal(p.reviewRequired,true);
});
test("spell dominated effect can command only, never grant items or persistent tier",()=>{
 assert.throws(()=>planNpcPresetAssignment({npcId:npc,userId:user,preset:"dominated"}),/Unknown preset/);
 const ui=projectNpcPanelPermissions(context(),{temporaryEncounterControl:true});
 assert.equal(ui.allowTacticalCommands,true);
 assert.equal(ui.effectControlOnly,true);
 assert.equal(ui.showBackpack,false);
 assert.deepEqual(ui.visibleBackpack,[]);
 assert.equal(ui.showEquipAndUnequip,false);
 assert.equal(ui.showWithdrawAndTransfer,false);
 assert.equal(ui.canAutomaticallyReceiveItem,false);
 assert.equal(ui.canViewGmSecrets,false);
});
test("client context flags cannot derive grants from unrelated role/sheet data",()=>{
 const ui=projectNpcPanelPermissions(context({
  role:"gm",can_take:true,can_edit:true,character_relationship:"loyal",
  can_auto_accept_items:true,can_issue_encounter_commands:false
 }));
 assert.equal(ui.canAutomaticallyReceiveItem,false);
 assert.equal(ui.showWithdrawAndTransfer,false);
 assert.equal(ui.showEquipAndUnequip,false);
 assert.equal(ui.showBackpack,false);
});
test("invalid UUID/preset and nonboolean temporary effects rejected",()=>{
 assert.throws(()=>planNpcPresetAssignment({npcId:"NPC",userId:user,preset:"hired"}),/Valid NPC/);
 assert.throws(()=>planNpcPresetAssignment({npcId:npc,userId:"USER",preset:"hired"}),/Valid NPC/);
 assert.throws(()=>planNpcPresetAssignment({npcId:npc,userId:user,preset:"__proto__"}),/Unknown preset/);
 assert.throws(()=>projectNpcPanelPermissions(null),/Missing server/);
 assert.throws(()=>projectNpcPanelPermissions(context(),{temporaryEncounterControl:"dominated"}),/server-issued boolean/);
});
