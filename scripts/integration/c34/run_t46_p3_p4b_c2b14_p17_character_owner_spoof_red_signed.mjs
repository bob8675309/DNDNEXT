// P17 local-only expected RED: current P16 policy allows an authenticated account
// to mint a "character"-owned item against an unrelated player's character,
// while retaining its own user_id. This is a witnessed flaw, NOT a mitigation.
// Executed inside P16's already authenticated/guarded disposable PG17 phase.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

export async function runC34B14P17CharacterOwnerSpoofRedSigned({sql,q,roles}){
 const attacker=roles.OWNER,other=roles.OUTSIDER;
 assert.ok(attacker?.id && other?.id && attacker.id!==other.id,
  "P17 needs two independent genuine signed users");
 const target=randomUUID(),itemId=randomUUID();
 let characterCreated=false,itemCreated=false;
 try{
  sql("INSERT INTO public.characters(id,name,kind,state,is_hidden,tags) VALUES("+
   q(target)+",'P17 foreign character','npc','resting',false,ARRAY['player-character']::text[])");
  characterCreated=true;
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert,can_control) VALUES("+
   q(target)+","+q(other.id)+",true,true,false,false)");
  assert.equal(sql("SELECT count(*) FROM public.character_permissions WHERE character_id="+
   q(target)+" AND user_id="+q(attacker.id)),"0",
   "Attacker must not hold an independent character grant");
  const response=await attacker.who.from("inventory_items").insert({
   id:itemId,owner_type:"character",owner_id:target,user_id:attacker.id,
   item_name:"P17 unapproved character item mint expected RED",
   item_type:"Misc",item_rarity:"Common",is_equipped:false
  }).select("id,owner_type,owner_id,user_id");
  // This asserts the EXISTING UNSAFE behavior, rather than shipping a fix:
  // if a new protection denies it, this negative witness will fail and must
  // be reclassified alongside source/auth and legitimate Forge regression.
  assert.ifError(response.error);
  assert.equal(response.data?.length,1,"Signed direct INSERT unexpectedly denied");
  const received=response.data[0];
  itemCreated=true;
  assert.equal(received.owner_type,"character");
  assert.equal(received.owner_id,target);
  assert.equal(received.user_id,attacker.id);
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(itemId)+
   " AND owner_type='character' AND owner_id="+q(target)+
   " AND user_id="+q(attacker.id)),"1");
  console.log("PASS P17-CHARACTER-INSERT-SPOOF-RED: genuine attacker JWT minted a row against a different account's player-character without character rights; P16 guard checks only npc/merchant and account user_id RLS");
 } finally {
  // Test fixture scoped cleanup, performed through the disposable local
  // postgres connection, never through hosted or client authority.
  if(itemCreated)sql("DELETE FROM public.inventory_items WHERE id="+q(itemId));
  if(characterCreated){
   sql("DELETE FROM public.character_permissions WHERE character_id="+q(target));
   sql("DELETE FROM public.characters WHERE id="+q(target));
  }
 }
}
