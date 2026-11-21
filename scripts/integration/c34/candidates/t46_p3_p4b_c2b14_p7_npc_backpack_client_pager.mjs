// C34 P7 RESEARCH ONLY: no React/NpcPanel import; not wired to gameplay.
// Profile selection does NOT fetch private inventory. The Inventory tab
// explicitly invokes loadNext() and uses a versioned, authenticated SQL
// projection rather than the legacy full-row get_character_inventory_v1.
// Server decides identity, visibility, grants, row owner and cursor validity.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(v){if(typeof v!=="string"||!UUID.test(v))throw new TypeError("Valid NPC UUID required");return v.toLowerCase();}
const empty=()=>Object.freeze({items:[],hasMore:true,nextCursor:null,loaded:false});
const safeItem=x=>Object.freeze({
 id:x.id,name:x.name,type:x.type,rarity:x.rarity,
 is_equipped:x.is_equipped===true,equip_slot:x.equip_slot??null
});
export function createNpcBackpackPager(client,{pageSize=20}={}){
 if(!client||typeof client.rpc!=="function")
  throw new TypeError("Authenticated Supabase RPC client required");
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>40)
  throw new RangeError("Page size must be 1–40");
 let selected=null,epoch=0,loaded=false,hasMore=true,nextCursor=null,inFlight=false;
 function selectNpc(npcId){
  selected=id(npcId);
  epoch++;
  loaded=false;hasMore=true;nextCursor=null;inFlight=false;
  return {npcId:selected,loaded:false};
 }
 function state(){
  return Object.freeze({npcId:selected,loaded,hasMore,nextCursor});
 }
 async function loadNext(){
  if(!selected)throw new TypeError("Select NPC before opening Inventory tab");
  if(inFlight)throw new Error("Backpack request already running");
  if(loaded&&!hasMore)return Object.freeze({items:[],hasMore:false,nextCursor:null,exhausted:true});
  const requestedNpc=selected,requestedEpoch=epoch,requestedCursor=nextCursor;
  inFlight=true;
  let response;
  try {
    response=await client.rpc("c34_b14_p7_npc_backpack_page_v1",{
      p_npc_id:requestedNpc,p_page_size:pageSize,
      p_after_created_at:requestedCursor?.created_at??null,
      p_after_item_id:requestedCursor?.item_id??null
    });
  } finally {
    if(epoch===requestedEpoch)inFlight=false;
  }
  // Switching NPCs while the request is in flight must NEVER display the
  // previous NPC's backpack or adopt its cursor as the new owner's cursor.
  if(epoch!==requestedEpoch||selected!==requestedNpc)
    return Object.freeze({discarded:true,items:[],hasMore:true,nextCursor:null});
  if(response?.error)throw new Error(response.error.message||"NPC backpack unavailable");
  const payload=response?.data;
  if(!payload||payload.npc_id!==requestedNpc||!Array.isArray(payload.items)
    ||typeof payload.has_more!=="boolean")
    throw new Error("Invalid NPC backpack response");
  const items=payload.items.map(safeItem);
  loaded=true;hasMore=payload.has_more;
  nextCursor=hasMore?payload.next_cursor:null;
  if(hasMore&&(!nextCursor||!nextCursor.created_at||!nextCursor.item_id))
    throw new Error("Missing keyset cursor");
  return Object.freeze({items,hasMore,nextCursor,discarded:false});
 }
 return Object.freeze({selectNpc,loadNext,state});
}
