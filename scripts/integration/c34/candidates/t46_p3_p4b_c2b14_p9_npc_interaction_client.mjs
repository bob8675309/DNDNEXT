// C34 B14-P9 RESEARCH-ONLY. Not imported by gameplay pages or NpcPanel.
// Slim context on profile open; P7 redacted keyset on explicit backpack tab.
// Source of authority remains signed, CURRENT server permissions on every RPC.
import {createNpcBackpackPager} from "./t46_p3_p4b_c2b14_p7_npc_backpack_client_pager.mjs";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=value=>{
 const v=String(value||"").toLowerCase();
 if(!UUID.test(v))throw new TypeError("Valid NPC or item UUID required");
 return v;
};
const flags=["can_view_public_profile","can_view_worn_gear",
 "can_view_backpack","can_manage_equipment","can_withdraw_items",
 "can_auto_accept_items","can_issue_encounter_commands"];
function sanitizeContext(raw,npcId){
 if(!raw||typeof raw!=="object"||raw.npc_id!==npcId
 ||Object.hasOwn(raw,"backpack")||!Array.isArray(raw.worn_gear)
 ||raw.worn_gear.length>12||flags.some(flag=>typeof raw[flag]!=="boolean"))
  throw new Error("Invalid slim NPC context: fail closed");
 const worn=raw.worn_gear.map(entry=>{
  if(!entry||typeof entry.name!=="string")throw new Error("Invalid worn gear");
  return Object.freeze({name:entry.name});
 });
 return Object.freeze({npc_id:npcId,
  ...Object.fromEntries(flags.map(flag=>[flag,raw[flag]])),
  worn_gear:Object.freeze(worn)
 });
}
export function createNpcInteractionResearchAdapter(client,{pageSize=20}={}){
 if(!client||typeof client.rpc!=="function")
  throw new TypeError("Authenticated RPC client required");
 let pager=createNpcBackpackPager(client,{pageSize});
 let npcId=null,epoch=0,context=null,items=[],loaded=false,hasMore=true;
 const snapshot=()=>Object.freeze({
  npcId,context,items:Object.freeze(items.map(item=>Object.freeze({...item}))),
  loaded,hasMore
 });
 function clear(){
  ++epoch;npcId=null;context=null;items=[];loaded=false;hasMore=true;
  pager=createNpcBackpackPager(client,{pageSize});
  return snapshot();
 }
 function selectNpc(next){
  const requested=id(next);
  clear();npcId=requested;pager.selectNpc(requested);
  return snapshot();
 }
 async function refreshContext(){
  if(!npcId)throw new Error("Select an NPC first");
  const expected=npcId,version=++epoch;
  context=null;items=[];loaded=false;hasMore=true;
  pager.selectNpc(expected); // Invalidates old pages, including slow replies.
  const reply=await client.rpc("c34_b14_p9_npc_slim_context_v1",{p_npc_id:expected});
  if(version!==epoch||npcId!==expected)return Object.freeze({discarded:true});
  if(reply?.error)throw new Error(reply.error.message||"NPC context unavailable");
  context=sanitizeContext(reply?.data,expected);
  return snapshot();
 }
 async function loadNext(){
  if(!context?.can_view_backpack)throw new Error("Backpack not authorized");
  const version=epoch,expected=npcId;
  let result;
  try{result=await pager.loadNext();}
  catch(error){
   if(version!==epoch||npcId!==expected)return Object.freeze({discarded:true});
   // Permission revocation must immediately discard displayed private items.
   context=null;items=[];loaded=false;hasMore=true;
   throw error;
  }
  if(version!==epoch||npcId!==expected||result.discarded)
   return Object.freeze({discarded:true});
  items=[...items,...result.items];
  loaded=true;hasMore=result.hasMore;
  return snapshot();
 }
 async function setEquipment({itemId,isEquipped,slot=null,expectedEquipped}){
  if(!context?.can_manage_equipment)throw new Error("Equipment management not authorized");
  if(typeof isEquipped!=="boolean"||typeof expectedEquipped!=="boolean")
   throw new TypeError("Expected and requested equipment states required");
  const item=id(itemId);
  if(!items.some(x=>x.id===item))
   throw new Error("Load the NPC item before editing equipment");
  const version=epoch,expected=npcId;
  const reply=await client.rpc("c34_b14_p7_set_npc_equipment_v1",{
   p_npc_id:expected,p_item_id:item,p_is_equipped:isEquipped,
   p_equip_slot:isEquipped?slot:null,p_expected_equipped:expectedEquipped
  });
  if(version!==epoch||npcId!==expected)return Object.freeze({discarded:true});
  if(reply?.error){
   context=null;items=[];loaded=false;hasMore=true;
   throw new Error(reply.error.message||"NPC equipment action denied");
  }
  if(reply?.data?.id!==item||reply.data.npc_id!==expected
   ||reply.data.is_equipped!==isEquipped)
   throw new Error("Invalid NPC equipment receipt");
  items=items.map(row=>row.id===item?
   {...row,is_equipped:isEquipped,equip_slot:reply.data.equip_slot??null}:row);
  return snapshot();
 }
 // Auth logout/account switch MUST call clear() before any new RPC;
 // an isolated UI can connect this to onAuthStateChange and discard in-flight
 // requests via epoch, without a stale previous-account cache.
 return Object.freeze({selectNpc,refreshContext,loadNext,setEquipment,clear,snapshot});
}
