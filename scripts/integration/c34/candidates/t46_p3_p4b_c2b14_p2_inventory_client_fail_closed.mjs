// B14-P2 research-only client adapter. Not imported by pages/inventory.js.
// Candidate contracts intentionally never substitute raw owner-field UPDATE on RPC errors.
const TYPES=new Set(["player","npc","merchant"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseP2TransferTarget(key) {
 const raw=String(key||"");
 const colon=raw.indexOf(":");
 if(colon<1)return null;
 const kind=raw.slice(0,colon);
 const id=raw.slice(colon+1);
 return TYPES.has(kind)&&UUID.test(id)?{kind,id}:null;
}

function request(ownerType,ownerId,targetKey) {
 const target=parseP2TransferTarget(targetKey);
 if(!target||!TYPES.has(ownerType)||!UUID.test(String(ownerId||"")))
  throw new Error("Select a valid inventory owner and destination");
 return {
  p_target_type:target.kind,p_target_id:target.id,
  p_expected_owner_type:ownerType,p_expected_owner_id:ownerId
 };
}
function checkResponse(result) {
 if(result?.error)throw result.error;
 if(!result||result.data==null)throw new Error("No inventory transfer receipt; refresh");
 return result.data;
}
export async function sendP2InventoryItem(rpc,{id,ownerType,ownerId,targetKey}) {
 if(typeof rpc!=="function"||!UUID.test(String(id||"")))throw new Error("Invalid inventory transfer request");
 const args={p_item_id:id,...request(ownerType,ownerId,targetKey)};
 return checkResponse(await rpc("c34_b14_p2_transfer_inventory_item_v1",args));
}
export async function sendP2InventoryBulk(rpc,{ids,ownerType,ownerId,targetKey}) {
 if(typeof rpc!=="function"||!Array.isArray(ids)||ids.length<1||ids.length>50||
  ids.some(id=>!UUID.test(String(id||"")))||new Set(ids).size!==ids.length)
  throw new Error("Invalid inventory bulk selection");
 const args={p_item_ids:[...ids],...request(ownerType,ownerId,targetKey)};
 const rows=checkResponse(await rpc("c34_b14_p2_transfer_inventory_items_bulk_v1",args));
 if(!Array.isArray(rows)||rows.length!==ids.length||
   new Set(rows.map(r=>r?.id)).size!==ids.length ||
   rows.some(r=>!ids.includes(r?.id)))
  throw new Error("Incomplete inventory transfer receipt; refresh");
 return rows;
}
