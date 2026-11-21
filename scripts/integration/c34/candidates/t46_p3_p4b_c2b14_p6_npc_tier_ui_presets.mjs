// C34 B14-P6 RESEARCH-ONLY UI projection; NO Supabase imports or write calls.
// Presets are GM authoring suggestions, never authority or a persistent tier.
// Backend capability grants and the combat controller must still be written
// by their separate versioned authorized RPCs, after GM review.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const NPC_INTERACTION_CAPABILITIES=Object.freeze([
 "view_backpack","manage_equipment","withdraw_items","auto_accept_items"
]);
const make=(description,flags,control)=>Object.freeze({
 description,
 flags:Object.freeze({...flags}),
 requestCombatControl:control,
 neverGrants:Object.freeze(["gm_secrets","creator_story","shop_stock_mint","unrelated_pc_items"])
});
const NONE={view_backpack:false,manage_equipment:false,withdraw_items:false,auto_accept_items:false};
export const NPC_INTERACTION_PRESETS=Object.freeze({
 public:make("Public NPC: talk, see outward gear and browse eligible storefront only",NONE,false),
 hired:make("Hired NPC: combat control and read-only backpack, cannot equip or take",{
  ...NONE,view_backpack:true
 },true),
 trusted:make("Trusted ally: inspect and arrange gear without withdrawing NPC-owned items",{
  ...NONE,view_backpack:true,manage_equipment:true
 },true),
 delegated:make("Fully delegated companion: explicit inventory management, withdrawal and auto-receive",{
  ...NONE,view_backpack:true,manage_equipment:true,withdraw_items:true,
  auto_accept_items:true
 },true)
});

export function planNpcPresetAssignment({npcId,userId,preset}) {
 if(!UUID.test(String(npcId))||!UUID.test(String(userId)))
  throw new TypeError("Valid NPC and grantee user UUIDs required");
 if(!Object.hasOwn(NPC_INTERACTION_PRESETS,preset))
  throw new TypeError("Unknown preset; spells and relationships are not permanent access tiers");
 const selected=NPC_INTERACTION_PRESETS[preset];
 const capabilityChanges=NPC_INTERACTION_CAPABILITIES.map(capability=>
  Object.freeze({capability,enabled:selected.flags[capability]}));
 return Object.freeze({
  npcId,userId,preset,capabilityChanges:Object.freeze(capabilityChanges),
  combatControlChange:Object.freeze({
   capability:"can_control",enabled:selected.requestCombatControl,
   separateAuthority:"held PR312 admin-set-npc-control; NOT inventory grant"
  }),
  reviewRequired:true,willMutate:false
 });
}

// Display-only projection of a SERVER-ISSUED NPC context response.
// Rendering a control never authorizes a DB write; permissioned RPCs
// must recheck current grants/effects and exact row ownership.
export function projectNpcPanelPermissions(context,{temporaryEncounterControl=false}={}){
 if(typeof temporaryEncounterControl!=="boolean")
  throw new TypeError("Encounter override must be server-issued boolean");
 if(!context||typeof context!=="object"||Array.isArray(context))
  throw new TypeError("Missing server NPC capability context");
 const backpackVisible=context.can_view_backpack===true;
 const manage=context.can_manage_equipment===true;
 const withdraw=context.can_withdraw_items===true;
 const controls=context.can_issue_encounter_commands===true||temporaryEncounterControl;
 // The UI deliberately ignores self-supplied 'can_take'/'admin' keys and
 // does not expose returned backpack rows when visibility isn't granted.
 const view=Object.freeze({
  showPublicProfile:context.can_view_public_profile===true,
  showWornGear:context.can_view_worn_gear===true,
  visibleWornGear:Array.isArray(context.worn_gear)?context.worn_gear:[],
  showBackpack:backpackVisible,
  visibleBackpack:backpackVisible&&Array.isArray(context.backpack)?context.backpack:[],
  showEquipAndUnequip:manage,
  showWithdrawAndTransfer:withdraw,
  allowTacticalCommands:controls,
  canAutomaticallyReceiveItem:context.can_auto_accept_items===true &&
    context.can_issue_encounter_commands===true,
  // Spell control is only a visual overlay, never property authority.
  effectControlOnly:temporaryEncounterControl&&context.can_issue_encounter_commands!==true,
  canViewGmSecrets:false
 });
 return view;
}
