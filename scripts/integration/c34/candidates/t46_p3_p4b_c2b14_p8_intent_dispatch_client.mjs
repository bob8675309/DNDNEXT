// C34 B14-P8 RESEARCH ONLY. This file is NOT imported by any gameplay page.
// Contract-only callers for FUTURE versioned server-authorized transfer intent.
// These RPC names now exist only as a new P8 scratch SQL candidate installed
// AFTER P10 in disposable PG17 signed research; NOT hosted or in gameplay.
// This client does not make legacy sends safe on its own.
// DO NOT use without a jointly audited P8 SQL/RLS + original page cutover.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=value=>{
 if(typeof value!=="string"||!UUID.test(value))
  throw new TypeError("Valid UUID required");
 return value.toLowerCase();
};
function route({expectedOwnerType,expectedOwnerId,targetType,targetId}){
 const source=String(expectedOwnerType||"").trim().toLowerCase();
 const target=String(targetType||"").trim().toLowerCase();
 if(!["player","character"].includes(source)||!["player","npc"].includes(target))
  throw new TypeError("P8 only authorizes an account or Forge character source to a player/NPC destination");
 if(target==="player"&&source!=="player")
  throw new TypeError("Character-to-player transfer has no accepted P8 source contract");
 // Never interpret merchant shop stock or an NPC sender bag as a player donation.
 // A genuine source Forge PC is owner_type=character, not kind=npc.
 const sourceId=uuid(expectedOwnerId),destId=uuid(targetId);
 if(source==="player"&&target==="player"&&sourceId===destId)
  throw new TypeError("Self-send is not a player transfer");
 return Object.freeze({
  p_expected_owner_type:source,p_expected_owner_id:sourceId,
  p_target_type:target,p_target_id:destId
 });
}
const safeStatuses=new Set(["pending","accepted"]);
function receipt(raw,expected,id){
 if(!raw||Array.isArray(raw)||typeof raw!=="object"||
  raw.request_id!==id||raw.item_id!==expected.p_item_id||
  raw.target_type!==expected.p_target_type||
  raw.target_id!==expected.p_target_id||
  !safeStatuses.has(raw.status)||typeof raw.auto_accepted!=="boolean"||
  // An account-to-account move has no NPC offer or auto-accept path.
  (expected.p_target_type==="player"&&(raw.status!=="accepted"||raw.auto_accepted))||
  (expected.p_target_type==="npc"&&raw.status==="pending"&&raw.auto_accepted)||
  Object.keys(raw).some(k=>![
   "request_id","item_id","target_type","target_id","status","auto_accepted"].includes(k)))
  throw new Error("Invalid redacted transfer receipt");
 return Object.freeze({request_id:id,item_id:expected.p_item_id,
  target_type:expected.p_target_type,target_id:expected.p_target_id,
  status:raw.status,auto_accepted:raw.auto_accepted});
}
export function createItemIntentDispatchResearchClient(client){
 if(!client||typeof client.rpc!=="function")throw new TypeError("Signed RPC client required");
 let generation=0;
 const pending=new Set();
 function clear(){generation++;pending.clear();}
 async function sendOne({requestId,itemId,...options}){
  const request=uuid(requestId);
  const input=Object.freeze({p_request_id:request,p_item_id:uuid(itemId),...route(options)});
  if(pending.has(request))throw new Error("One transfer intent already in flight");
  const epoch=generation;
  pending.add(request);
  let response;
  try{response=await client.rpc("c34_b14_p8_dispatch_item_intent_v1",input);}
  finally{if(generation===epoch)pending.delete(request);}
  if(epoch!==generation)return Object.freeze({discarded:true});
  if(response?.error)throw new Error(response.error.message||"Item transfer unavailable");
  return receipt(response?.data,input,request);
 }
 async function sendBatch({requestId,itemIds,...options}){
  const request=uuid(requestId);
  if(!Array.isArray(itemIds)||itemIds.length<1||itemIds.length>50)
   throw new RangeError("Atomic bulk intent requires 1–50 items");
  const ids=itemIds.map(uuid);
  if(new Set(ids).size!==ids.length)throw new TypeError("Duplicate item IDs");
  const input=Object.freeze({p_request_id:request,p_item_ids:ids,...route(options)});
  if(pending.has(request))throw new Error("One transfer intent already in flight");
  const epoch=generation;
  pending.add(request);
  let response;
  try{response=await client.rpc("c34_b14_p8_dispatch_batch_intent_v1",input);}
  finally{if(generation===epoch)pending.delete(request);}
  if(epoch!==generation)return Object.freeze({discarded:true});
  if(response?.error)throw new Error(response.error.message||"Atomic bulk transfer unavailable");
  const raw=response?.data;
  if(!raw||Array.isArray(raw)||raw.request_id!==request||
   !Array.isArray(raw.receipts)||raw.receipts.length!==ids.length||
   Object.keys(raw).some(k=>!["request_id","receipts"].includes(k)))
   throw new Error("Invalid atomic transfer receipt");
  const allowed=new Set(ids),seen=new Set();
  const result=raw.receipts.map(row=>{
   if(!row||!allowed.has(row.item_id)||seen.has(row.item_id))
    throw new Error("Bulk receipt has missing/duplicate item");
   seen.add(row.item_id);
   return receipt(row,{...input,p_item_id:row.item_id},request);
  });
  if(new Set(result.map(r=>r.status)).size!==1)
   throw new Error("Mixed immediate/pending bulk result is forbidden");
  return Object.freeze({request_id:request,receipts:Object.freeze(result)});
 }
 return Object.freeze({sendOne,sendBatch,clear});
}
