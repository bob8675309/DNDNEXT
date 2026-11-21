import test from "node:test";
import assert from "node:assert/strict";
import {parseP2TransferTarget,sendP2InventoryItem,sendP2InventoryBulk}
 from "./candidates/t46_p3_p4b_c2b14_p2_inventory_client_fail_closed.mjs";

const owner="00000000-0000-4000-8000-000000000011";
const merchant="00000000-0000-4000-8000-000000000012";
const first="00000000-0000-4000-8000-000000000013";
const second="00000000-0000-4000-8000-000000000014";
const badResponse=new Error("42501 role revoked");
badResponse.code="42501";

test("P2 target uses explicit supported type and canonical UUID",()=>{
 assert.deepEqual(parseP2TransferTarget("merchant:"+merchant),{kind:"merchant",id:merchant});
 for(const invalid of ["invalid:"+merchant,"merchant:bad","npc","merchant:"+merchant+":forged","player:"])
  assert.equal(parseP2TransferTarget(invalid),null);
});

test("P2 single sends expected-owner CAS; accepts only RPC receipt",async()=>{
 let calls=0;
 const data=await sendP2InventoryItem(async(name,args)=>{
  calls++;
  assert.equal(name,"c34_b14_p2_transfer_inventory_item_v1");
  assert.deepEqual(args,{
   p_item_id:first,p_target_type:"merchant",p_target_id:merchant,
   p_expected_owner_type:"player",p_expected_owner_id:owner
  });
  return {data:{id:first,owner_id:merchant},error:null};
 },{id:first,ownerType:"player",ownerId:owner,targetKey:"merchant:"+merchant});
 assert.equal(data.owner_id,merchant);
 assert.equal(calls,1);
});

test("P2 denied RPC cannot invoke direct-table fallback",async()=>{
 const calls=[];
 const rpc=async(name,args)=>{calls.push({name,args});return {data:null,error:badResponse};};
 await assert.rejects(()=>sendP2InventoryItem(rpc,{
  id:first,ownerType:"player",ownerId:owner,targetKey:"merchant:"+merchant
 }),e=>e.code==="42501");
 assert.deepEqual(calls.map(x=>x.name),["c34_b14_p2_transfer_inventory_item_v1"]);
 await assert.rejects(()=>sendP2InventoryItem(async()=>({data:null,error:null}),{
  id:first,ownerType:"player",ownerId:owner,targetKey:"merchant:"+merchant
 }),/No inventory transfer receipt/);
});

test("P2 bulk is one RPC, preserves order-invariant receipt and rejects partial",async()=>{
 const args={ids:[first,second],ownerType:"player",ownerId:owner,targetKey:"merchant:"+merchant};
 let count=0;
 const results=await sendP2InventoryBulk(async(name,payload)=>{
  count++;
  assert.equal(name,"c34_b14_p2_transfer_inventory_items_bulk_v1");
  assert.deepEqual(payload.p_item_ids,[first,second]);
  return {data:[{id:second},{id:first}],error:null};
 },args);
 assert.equal(count,1);
 assert.equal(results.length,2);
 await assert.rejects(()=>sendP2InventoryBulk(async()=>({data:[{id:first}],error:null}),args),
  /Incomplete inventory transfer receipt/);
 await assert.rejects(()=>sendP2InventoryBulk(async()=>({data:null,error:badResponse}),args),
  e=>e.code==="42501");
});

test("P2 rejects malformed/duplicate selection before any RPC",async()=>{
 let calls=0;
 const rpc=async()=>{calls++;return {data:[],error:null};};
 await assert.rejects(()=>sendP2InventoryBulk(rpc,{
  ids:[first,first],ownerType:"player",ownerId:owner,targetKey:"merchant:"+merchant
 }),/Invalid inventory bulk selection/);
 await assert.rejects(()=>sendP2InventoryItem(rpc,{
  id:first,ownerType:"player",ownerId:"foreign",targetKey:"merchant:"+merchant
 }),/Select a valid inventory owner/);
 assert.equal(calls,0);
});
