// P20C-P0 historical original RED and strict transport contract: source only.
// Never report these assertions as signed SQL, actual economic debit, or rollout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {normalizeP20CUntrustedTownCraftIntentResearch as parse} from "./candidates/t46_p3_p4b_c2b14_p20c_town_craft_intent_research.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{const b=fs.readFileSync(path.join(root,p));return createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const ids=["4ba24fcc-835f-4890-aab0-0dc10d55379a","7f30a7c1-91a7-43a2-a4b8-b2d6fc4cf1e3","55a5e20c-a579-4215-8fa0-86a04521f85b","6961b3ba-bfb3-4741-b2a6-dd1809b38b02","9d93b44c-85bc-4a0a-8549-d0f372988ce8"];
const baseline={request_id:ids[0],service_id:"brew",town_id:81247,crafter_id:ids[1],recipe_key:"alchemy:healing-draught",primary_item_id:null,ingredients:[{source:"player_plants",id:ids[2],lane:"secondary",quantity:2},{source:"inventory_items",id:ids[3],lane:"material",quantity:1}]};
const cloned=()=>structuredClone(baseline);
test("P20C-P0 exact original Town, canonical v6, and P20B source pins",()=>{
 const original={
  "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
  "components/TownSheet.js":"5399097e48f548956807cd93476fefe03e4dee28",
  "components/CraftingWorkspace.js":"e584b7eb1a39e9f6525cbeb3e8e1a477f34ba",
  "sql/20260612_90_patch0_crafting_authorization_hardening.sql":"d60b0ded3f94cd9f7db9aa687e72ee0fc589c416",
  "sql/20260613_99_crafting_workflow_v6.sql":"570b2733d3aad5ed02bbe12d288ea52a7e6e352e",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20b_disposable_atomic_town_inscribe_pg17.sql":"300db43749faa6910aa058c9f32daf42d825abf8"
 };
 for(const [file,sha] of Object.entries(original))assert.equal(blob(file),sha,"Original changed; re-audit "+file);
 console.log("PASS P20C-P0-SOURCE-PINS: original client, v6 craft and signed P20B code unchanged");
});
test("P20C-P0 original Town direct item creation and plant/cost leak are source RED",()=>{
 const route=read("pages/town/[id].js");
 const start=route.indexOf("async function handleCraftWorkshop(");
 const end=route.indexOf("function townCrafterDisciplineFor(",start);
 assert.ok(start>0&&end>start);
 const old=route.slice(start,end);
 for(const token of ["plantMaterialInputs = []","const plantById = new Map(","const inventoryConsumedIds = chosenIds.filter((itemId) => byId.has(itemId));",'.from("inventory_items").delete().eq("user_id", playerUserId).in("id", consumedIds)',".insert(craftedInsert)",".insert(rollbackRows)"])assert.ok(old.includes(token),token);
 assert.equal((old.match(/plantMaterialInputs/g)||[]).length,1,"Plant source quantity is not processed");
 for(const no of ['.from("player_plants")',"submit_craft_plan","submit_crafting_attempt_report","complete_craft_plan_v1","wallet_get","wallet_set"])assert.ok(!old.includes(no),"Original Town unexpectedly changed "+no);
 console.log("PASS P20C-P0-TOWN-RED: three independent browser mutations, plant quantity not consumed, no wallet debit or plan RPC");
});
test("P20C-P0 original recipe UI and older canonical server wrapper are different authorities",()=>{
 const town=read("components/TownSheet.js"),hub=read("components/CraftingWorkspace.js");
 for(const t of ['"id": "alchemy:healing-draught"','const canAttempt = materials.length >= 2 && (primaryMatch || secondaryMatch);','id: "forge_mundane"','id: "brew"','id: "inscribe"','id: "socket"'])assert.ok(town.includes(t),t);
 for(const t of ["function craftPlanInsertPayload(","function craftPlanRpcPayload(",'supabase.rpc("submit_craft_plan"','supabase.rpc("submit_crafting_attempt_report"','supabase.rpc("complete_craft_plan_v1"','Material cost determined by the DM'])assert.ok(hub.includes(t),t);
 const sql=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 for(const t of ["private.submit_craft_plan_impl(jsonb)","private.complete_craft_plan_v1_impl(uuid,uuid)","created_by', caller","Only an administrator can complete a craft plan"])assert.ok(sql.includes(t),t);
 assert.ok(!sql.includes("gm_override_reason"));
 console.log("PASS P20C-P0-CANONICAL-RED: client preview, v6 plan/attempt/completion and Admin-only wrapper coexist; full private validation unverified");
});
test("P20C-P0 structural transport accepts only IDs and requested quantities",()=>{
 const parsed=parse(baseline);
 assert.equal(parsed.ingredients.length,2);
 assert.deepEqual(Object.keys(parsed).sort(),["request_id","crafter_id","service_id","town_id","recipe_key","primary_item_id","ingredients"].sort());
 assert.ok(Object.isFrozen(parsed)&&Object.isFrozen(parsed.ingredients)&&Object.isFrozen(parsed.ingredients[0]));
 console.log("PASS P20C-P0-SHAPE: source identifiers only, no item, actor or cost payload");
});
test("P20C-P0 player cannot submit output, price, role, override or untrusted catalogue",()=>{
 for(const key of ["result_item_payload","result_item_name","item_name","item_id","card_payload","price_gp","cost_gp","wallet_amount","user_id","recipient_user_id","isAdmin","role","gm_override","created_by","alchemy_tags","status","target_character_id","quantity_created"]){
  assert.throws(()=>parse({...baseline,[key]:"spoof"}),/untrusted key/);
 }
 for(const invalid of [{...baseline,service_id:"wish"},{...baseline,recipe_key:"CUSTOM POTION!"},{...baseline,primary_item_id:ids[4]}])assert.throws(()=>parse(invalid));
 console.log("PASS P20C-P0-PLAYER-DENY: untrusted item/currency/GM/recipient/fake-service metadata rejected at research transport boundary");
});
test("P20C-P0 plant ownership must be checked later; invalid lanes and quantities fail shape",()=>{
 const modifications=[
  x=>{x.ingredients[0].quantity=0;},
  x=>{x.ingredients[0].quantity=-1;},
  x=>{x.ingredients[0].quantity=1.5;},
  x=>{delete x.ingredients[0].quantity;},
  x=>{x.ingredients[0].quantity=65536;},
  x=>{x.ingredients[0].source="client_payload";},
  x=>{x.ingredients[0].lane="gm_grant";},
  x=>{x.ingredients[1].lane="secondary";},
  x=>{x.ingredients[1].id=ids[2];x.ingredients[1].source="player_plants";},
  x=>{x.ingredients[0].card_payload={alchemy_tags:["vital"]};},
  x=>{x.ingredients[0].id="plant:fake";}
 ];
 for(const fn of modifications){const x=cloned();fn(x);assert.throws(()=>parse(x));}
 assert.throws(()=>parse({...baseline,ingredients:[baseline.ingredients[0]]}));
 console.log("PASS P20C-P0-PLANT-DENY: invalid/duplicate quantities and forged source/recipe tags rejected structurally");
});
test("P20C-P0 original one-base inscribe and free-pattern forge boundaries",()=>{
 const inscribe={...baseline,service_id:"inscribe",recipe_key:"town:inscribe-plain",primary_item_id:ids[4],ingredients:[]};
 assert.equal(parse(inscribe).primary_item_id,ids[4]);
 assert.throws(()=>parse({...inscribe,primary_item_id:null}));
 assert.throws(()=>parse({...inscribe,ingredients:[baseline.ingredients[0]]}));
 const forge={...baseline,service_id:"forge_mundane",recipe_key:"town:forge",ingredients:[],primary_item_id:null};
 assert.throws(()=>parse(forge));
 assert.equal(parse({...forge,ingredients:[baseline.ingredients[0]]}).service_id,"forge_mundane");
 console.log("PASS P20C-P0-FORGE-DENY: no-input forge cannot pass research shape; P20B source inscribe is retained");
});
