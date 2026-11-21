// C34 C2-B14-P1. GENUINE signed local PG17/GoTrue/PostgREST role matrix.
// Runs LAST after all accepted B2–B12 suites. All original SQL function/policy
// definitions are extracted from pinned checked-in source; no hosted project.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const source=file=>fs.readFileSync(path.join(root,file),"utf8");
const gitBlob=bytes=>createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])
).digest("hex");
const pins={
 "sql/20260612_90_patch0_crafting_authorization_hardening.sql":"d60b0ded3f94cd9f7db9aa687e72ee0fc589c416",
 "sql/20260614_02_phase_a_non_map_security_hardening.sql":"25d106dfc18f469948edf705e7997fa961a16cd0",
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
const exactFunction=(s,fn,terminator)=>{
 const anchor="CREATE OR REPLACE FUNCTION "+fn+(fn.endsWith(")")?"":"(");
 const start=s.indexOf(anchor);
 assert.ok(start>=0,"Missing original function "+fn);
 assert.equal(s.indexOf(anchor,start+anchor.length),-1,
  "Ambiguous original function "+fn);
 const end=s.indexOf(terminator+";",start);
 assert.ok(end>start,"Unterminated "+fn);
 return s.slice(start,end+terminator.length+1);
};
const exactPolicy=(s,name)=>{
 const marker="CREATE POLICY "+name+"\n";
 const start=s.indexOf(marker);
 assert.ok(start>=0,"Missing original inventory policy "+name);
 assert.equal(s.indexOf(marker,start+marker.length),-1,
  "Duplicate original policy "+name);
 const end=s.indexOf(";",start);
 assert.ok(end>start,"Unterminated policy "+name);
 return s.slice(start,end+1);
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runC34C2B14InventoryRolesSigned({
 env,actors,newActor,sql,q,lit
}){
 for(const [key,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[key],value,"B14 refuses non-disposable "+key);
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 assert.equal(sql("SELECT current_database()"),"postgres");
 for(const [file,sha] of Object.entries(pins)){
  const bytes=fs.readFileSync(path.join(root,file));
  assert.equal(gitBlob(bytes),sha,"B14 original source drift "+file);
 }
 const roleSrc=source("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 const rlsSrc=source("sql/20260614_02_phase_a_non_map_security_hardening.sql");
 const transferSrc=source("sql/20260624_01_inventory_item_send_rpc.sql");
 const roleFns=[
  exactFunction(roleSrc,"private.current_user_is_admin","$function$"),
  exactFunction(roleSrc,"public.is_admin()","$function$")
 ];
 // The public.is_admin overloads share the same name. Extract the UUID
 // signature explicitly rather than taking the zero-argument first one.
 const uuidStart=roleSrc.indexOf("CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)");
 assert.ok(uuidStart>=0,"Missing original UUID-admin overload");
 const uuidEnd=roleSrc.indexOf("$function$;",uuidStart);
 assert.ok(uuidEnd>uuidStart,"Unterminated UUID overload");
 const uuidFn=roleSrc.slice(uuidStart,uuidEnd+"$function$;".length);
 const transferFn=exactFunction(transferSrc,"public.transfer_inventory_item_v1","$$");
 assert.match(transferFn,/v_admin := coalesce\(public\.is_admin\(caller\), false\);/);
 assert.match(transferFn,/FOR UPDATE;/);
 const policies=["select","insert","update","delete"].map(a=>
  exactPolicy(rlsSrc,"inventory_items_"+a+"_owner_or_admin"));
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");
 const originalQuantity=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 const originalStock=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'::regprocedure))");
 // Missing original table columns from minimal C2 buyer fixture: add ONLY in
 // disposable PG17 before installing EXACT historical transfer function.
 sql("ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS equip_slot text");
 sql("ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()");
 sql("GRANT USAGE ON SCHEMA private TO authenticated");
 sql(roleFns[0]);
 sql(roleFns[1]);
 // Earlier C33 signed privacy fixture defines is_admin(uid uuid DEFAULT NULL),
 // whereas June's exact original body omits the default. PostgreSQL refuses
 // CREATE OR REPLACE when doing so would REMOVE the existing argument default.
 // Preserve the earlier fixture's default only in scratch, keeping all of the
 // exact checked-in original body/role predicates unchanged.
 assert.equal(sql("SELECT pg_get_function_arguments('public.is_admin(uuid)'::regprocedure) ILIKE '%DEFAULT%'"),"t",
  "B14 scratch preflight expected original C33 is_admin(uid) default");
 const oldSignature="public.is_admin(uid uuid)";
 assert.equal(uuidFn.split(oldSignature).length,2,"B14 UUID source signature drift");
 const compatibleUuidFn=uuidFn.replace(oldSignature,
  "public.is_admin(uid uuid DEFAULT NULL)");
 assert.ok(compatibleUuidFn.includes("RETURN COALESCE(target_role, 'player') <> 'player'"));
 sql(compatibleUuidFn);
 // The old RLS policies are first dropped ONLY in this disposable fixture.
 // No production or original code is modified; B2–B12 has already passed.
 sql("DO $b14$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies "+
  "WHERE schemaname='public' AND tablename='inventory_items' LOOP "+
  "EXECUTE format('DROP POLICY %I ON public.inventory_items',p.policyname); "+
  "END LOOP; END $b14$;");
 sql("ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY");
 for(const p of policies)sql(p);
 sql("REVOKE ALL ON public.inventory_items FROM PUBLIC,anon,authenticated");
 sql("GRANT SELECT,INSERT,UPDATE,DELETE ON public.inventory_items TO authenticated");
 sql(transferFn);
 sql("REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1(uuid,text,text) FROM PUBLIC,anon,authenticated");
 sql("GRANT EXECUTE ON FUNCTION public.transfer_inventory_item_v1(uuid,text,text) TO authenticated");
 // Only the scratch fixture exposes the private helper through an INVOKER
 // probe to genuine JWT. It is NOT part of the production API/SQL candidate.
 sql("CREATE FUNCTION public.c34_b14_strict_admin_probe_v1() RETURNS boolean "+
  "LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO pg_catalog,public,private,auth "+
  "AS $b14$ SELECT private.current_user_is_admin() $b14$");
 sql("REVOKE ALL ON FUNCTION public.c34_b14_strict_admin_probe_v1() FROM PUBLIC,anon,authenticated");
 sql("GRANT EXECUTE ON FUNCTION public.c34_b14_strict_admin_probe_v1() TO authenticated");
 sql("REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC,anon,authenticated");
 sql("GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated");
 sql("REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon,authenticated");
 sql("GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated");
 sql("NOTIFY pgrst,'reload schema'");
 console.log("PASS T46-C2B14-P1-ORIGINAL-SOURCE: 6 original Git pins; original June helper overloads, all four owner RLS policies and transfer RPC installed on disposable PG17 only");

 const names=[
  ["ADMIN","admin"],["GM","gm"],["DM","dm"],
  ["OWNER","player"],["OUTSIDER","player"],["OBSERVER","observer"]
 ];
 const users={};
 for(const [name,role] of names)users[name]=await newActor("B14_"+name,role);
 const everyone=Object.values(users);
 const byRole={ADMIN:true,GM:true,DM:true,OWNER:false,OUTSIDER:false,OBSERVER:true};
 const strict={ADMIN:true,GM:false,DM:false,OWNER:false,OUTSIDER:false,OBSERVER:false};
 const strictCall=who=>who.rpc("c34_b14_strict_admin_probe_v1");
 const broadCall=user=>user.who.rpc("is_admin",{uid:user.id});
 for(const [name,user] of Object.entries(users)){
  let x,y;
  for(let attempt=0;attempt<25;attempt++){
   [x,y]=await Promise.all([strictCall(user.who),broadCall(user)]);
   if(x.error?.code!=="PGRST202" && y.error?.code!=="PGRST202")break;
   await pause(160);
  }
  assert.ifError(x.error);assert.ifError(y.error);
  assert.equal(x.data,strict[name],"strict admin mismatch "+name);
  assert.equal(y.data,byRole[name],"UUID helper mismatch "+name);
 }
 const anon=await actors.OUTSIDER.who.auth.getUser();
 assert.ifError(anon.error);
 console.log("PASS T46-C2B14-P1-ROLE-RED: REAL signed admin strict=true, GM/DM strict=false but UUID helper=true; unknown observer role UUID helper=true, player=false");

 // Independently seed only local test characters, player addresses and items.
 const charId=()=>randomUUID();
 const [npc,npcOther,merchant]=[charId(),charId(),charId()];
 for(const [id,kind,name] of [[npc,"npc","B14 Delegated NPC"],[npcOther,"npc","B14 Receiving NPC"],[merchant,"merchant","B14 Receiving Merchant"]]){
  sql("INSERT INTO public.characters(id,name,kind,is_hidden) VALUES("+
   q(id)+","+lit(name)+","+lit(kind)+",false)");
 }
 for(const user of everyone){
  sql("INSERT INTO public.players(user_id,name) VALUES("+
   q(user.id)+","+lit("B14 "+user.role)+" ) ON CONFLICT(user_id) DO NOTHING");
 }
 const initialItem=(label,ownerType,ownerId,userId)=>{
  const id=randomUUID();
  sql("INSERT INTO public.inventory_items(id,owner_type,owner_id,user_id,item_name,"+
   "item_type,item_rarity,is_equipped,equip_slot) VALUES("+
   q(id)+","+lit(ownerType)+","+lit(ownerId)+","+
   (userId?q(userId):"NULL")+","+lit(label)+
   ",'Misc','Common',true,'weapon_1')");
  return id;
 };
 const holder=users.OUTSIDER.id,owner=users.OWNER.id;
 const itemRole=Object.fromEntries(["ADMIN","GM","DM","OBSERVER"].map(name=>
  [name,initialItem("B14 "+name+" source owned by outsider","player",holder,holder)]));
 const ownerRaw=initialItem("B14 owner raw","player",owner,owner);
 const ownerRpc=initialItem("B14 owner rpc","player",owner,owner);
 const ownBulk=[initialItem("B14 bulk a","player",owner,owner),
  initialItem("B14 bulk b","player",owner,owner)];
 const rawInsert=()=>users.OWNER.who.from("inventory_items").insert({
  user_id:owner,owner_type:"player",owner_id:owner,
  item_name:"B14 arbitrary owner self minted",item_type:"Misc",item_rarity:"Legendary"
 }).select("id,item_name");
 const state=id=>JSON.parse(sql("SELECT row_to_json(s)::text FROM public.inventory_items s WHERE s.id="+q(id)));
 const transfer=(user,id,type,destination)=>user.who.rpc("transfer_inventory_item_v1",{
   p_item_id:id,p_target_type:type,p_target_id:destination
 });
 const deny=(r,label)=>{
  assert.ok(r.error,label+" expected signed denial, got "+JSON.stringify(r.data));
  assert.equal(r.data,null,label+" denied RPC unexpectedly returned data");
 };
 const raw=await users.OWNER.who.from("inventory_items").update({item_name:"B14 owned self edit"})
  .eq("id",ownerRaw).select("id,item_name,user_id");
 assert.ifError(raw.error);assert.equal(raw.data.length,1);
 assert.equal(raw.data[0].user_id,owner);
 const forged=await users.OWNER.who.from("inventory_items")
  .update({owner_type:"npc",owner_id:npc,user_id:null})
  .eq("id",ownerRaw).select("id");
 assert.ok(forged.error||forged.data?.length===0,
  "Owner raw transfer crossed original USING+WITH CHECK");
 assert.equal(state(ownerRaw).owner_id,owner);
 const bulk=await users.OWNER.who.from("inventory_items")
  .update({owner_type:"npc",owner_id:npc,user_id:null})
  .in("id",ownBulk).select("id");
 assert.ok(bulk.error||bulk.data?.length===0,"Owner bulk crossed strict RLS");
 for(const id of ownBulk)assert.equal(state(id).owner_id,owner);
 const insert=await rawInsert();
 assert.ifError(insert.error);
 assert.equal(insert.data.length,1,"Owner-only original INSERT RLS accepted self-owned arbitrary inventory");
 const foreign=await users.OWNER.who.from("inventory_items").insert({
  user_id:holder,owner_type:"player",owner_id:holder,
  item_name:"B14 forged other-player insert",item_type:"Misc"
 }).select("id");
 assert.ok(foreign.error||foreign.data?.length===0);
 console.log("PASS T46-C2B14-P1-RLS-RED: signed owner self-edit succeeds, direct NPC owner change and bulk transfer blocked by WITH CHECK, BUT arbitrary self-owned inventory INSERT allowed; cross-user forged INSERT denied");
 const ownerMove=await transfer(users.OWNER,ownerRpc,"npc",npc);
 assert.ifError(ownerMove.error);
 assert.equal(ownerMove.data.owner_id,npc);
 assert.equal(ownerMove.data.user_id,null);
 assert.equal(ownerMove.data.is_equipped,false);
 assert.equal(ownerMove.data.equip_slot,null);
 const outsiderDenied=await transfer(users.OUTSIDER,ownerRaw,"npc",npc);
 deny(outsiderDenied,"outsider transfer another player's item");
 assert.equal(state(ownerRaw).owner_id,owner);
 console.log("PASS T46-C2B14-P1-OWNER-RPC: signed owner uses original definer transfer to NPC with unequip, outsider denied and stock unchanged");

 for(const name of ["GM","DM","OBSERVER","ADMIN"]){
  const user=users[name],id=itemRole[name];
  const read=await user.who.from("inventory_items").select("id").eq("id",id);
  assert.ifError(read.error);
  assert.equal(read.data.length,name==="ADMIN"?1:0,
   name+" original raw outsider item visibility");
  const result=await transfer(user,id,"merchant",merchant);
  assert.ifError(result.error);
  assert.equal(result.data.owner_type,"merchant");
  assert.equal(result.data.owner_id,merchant);
  assert.equal(result.data.user_id,null);
  assert.equal(state(id).owner_id,merchant);
 }
 console.log("PASS T46-C2B14-P1-TRANSFER-ROLE-RED: GM/DM/UNEXPECTED observer lack strict original raw admin SELECT but ALL can transfer other user items directly into merchants via nonplayer UUID helper; admin does both");
 const grantItems=[
  initialItem("B14 delegated allowed","npc",npc,null),
  initialItem("B14 delegated revoked","npc",npc,null)
 ];
 sql("INSERT INTO public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert) VALUES("+
  q(npc)+","+q(owner)+",true,false,false) "+
  "ON CONFLICT(character_id,user_id) DO UPDATE SET can_inventory=true,can_edit=false");
 const delegated=await transfer(users.OWNER,grantItems[0],"npc",npcOther);
 assert.ifError(delegated.error);
 assert.equal(state(grantItems[0]).owner_id,npcOther);
 sql("UPDATE public.character_permissions SET can_inventory=false,can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(owner));
 const afterRevoke=await transfer(users.OWNER,grantItems[1],"npc",npcOther);
 deny(afterRevoke,"delegated NPC inventory after role grant revoked");
 assert.equal(state(grantItems[1]).owner_id,npc);
 console.log("PASS T46-C2B14-P1-NPC-DELEGATION: true signed can_inventory permits NPC item transfer; postcommit revocation denies new signed RPC and preserves item");
 const revokedItem=initialItem("B14 demoted GM source","player",holder,holder);
 sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(users.GM.id));
 const noLongerElevated=await broadCall(users.GM);
 assert.ifError(noLongerElevated.error);assert.equal(noLongerElevated.data,false);
 const deniedGM=await transfer(users.GM,revokedItem,"merchant",merchant);
 deny(deniedGM,"GM demoted to player");
 assert.equal(state(revokedItem).owner_id,holder);
 console.log("PASS T46-C2B14-P1-ROLE-REVOKE: same genuine GM JWT, DB role demoted to player, next transfer denied and owner unchanged");
 const unsigned=await (async()=>{
  const {createClient}=await import("@supabase/supabase-js");
  return createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 })();
 const anonymous=await transfer({who:unsigned},ownerRaw,"npc",npc);
 deny(anonymous,"anonymous transfer");
 assert.equal(state(ownerRaw).owner_id,owner);
 console.log("PASS T46-C2B14-P1-ANON: unsigned Data API transfer rejected, no item mutation");
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))"),originalQuantity);
 assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)'::regprocedure))"),originalStock);
 console.log("PASS T46-C2B14-P1-SIGNED: original-source helper/RLS/transfer with real signed 6-user role matrix, owner/NPC delegation/revocation, arbitrary self-owned inventory mint RED, unexpected-role elevated transfer RED, original buyer/stock/qty preserved; scratch only");
}
