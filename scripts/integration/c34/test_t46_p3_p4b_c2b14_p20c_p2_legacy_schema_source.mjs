// C34 B14-P20C-P2: historical schema provenance and current UI crosswalk.
// Pure source-only tests. Preserved export explicitly says NOT executable.
// No hosted DB, signed auth, installed production schema, or craft issuance.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const snapshot="scripts/integration/c34/preserved/legacy_schema_export_context_only_2026.txt";
const bytes=fs.readFileSync(path.join(root,snapshot));
const schema=bytes.toString("utf8");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const blob=b=>createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
function table(name){
 const tag="CREATE TABLE public."+name+" (\n";
 const start=schema.indexOf(tag);
 assert.ok(start>=0,"Historical table absent "+name);
 const end=schema.indexOf("\n);",start);
 assert.ok(end>start,"Historical table incomplete "+name);
 return schema.slice(start,end+3);
}
test("P20C-P2 exact preexisting context-only schema Git blob preserved, never a migration",()=>{
 assert.equal(blob(bytes),"655a03460cc8aed2fe4537c79f0819879d915aa2");
 assert.match(schema.slice(0,175),/WARNING: This schema is for context only and is not meant to be run/);
 assert.match(schema.slice(0,200),/Table order and constraints may not be valid for execution/);
 console.log("PASS P20C-P2-LEGACY-BLOB: historical branch schema byte-identical; context only, not live PG17 DDL");
});
test("P20C-P2 plant has composite owner+species key, real stack quantity and a separate nonkey row UUID",()=>{
 const plants=table("player_plants");
 assert.match(plants,/player_id uuid NOT NULL/);
 assert.match(plants,/plant_id uuid NOT NULL/);
 assert.match(plants,/quantity integer DEFAULT 1/);
 assert.match(plants,/id uuid NOT NULL DEFAULT gen_random_uuid\(\)/);
 assert.match(plants,/CONSTRAINT player_plants_pkey PRIMARY KEY \(player_id, plant_id\)/);
 assert.match(plants,/REFERENCES public\.players\(id\)/);
 assert.match(plants,/REFERENCES public\.plants\(id\)/);
 assert.doesNotMatch(plants,/\bPRIMARY KEY \(id\)|\bUNIQUE \(id\)/);
 assert.doesNotMatch(plants,/\bCHECK\s*\(\s*quantity\b/i);
 console.log("PASS P20C-P2-PLANT-COMPOSITE: physical owner key (player_id,plant_id), quantity integer, auxiliary id NOT historically unique; check full current schema before any debit");
});
test("P20C-P2 player-facing fallback plant ID is not server authority",()=>{
 const town=read("pages/town/[id].js");
 const sheet=read("components/TownSheet.js");
 assert.match(town,/return row\?\.id \|\| row\?\.plant_id \|\| plant\.id/);
 assert.match(sheet,/const id = row\.id \|\| row\.plant_id \|\| plant\.id/);
 assert.match(town,/id: \x60plant:\$\{id\}\x60/);
 assert.match(sheet,/source_id: id/);
 assert.match(sheet,/plantMaterialInputs: selectedService\?\.id === "brew"/);
 const begin=town.indexOf("async function handleCraftWorkshop(");
 const end=town.indexOf("function townCrafterDisciplineFor(",begin);
 assert.ok(begin>0&&end>begin);
 const handler=town.slice(begin,end);
 assert.equal((handler.match(/plantMaterialInputs/g)||[]).length,1);
 assert.doesNotMatch(handler,/\.from\(["']player_plants["']\)/);
 console.log("PASS P20C-P2-PLANT-CLIENT-RED: UI chooses row.id/fallback; server must independently resolve signed owner + plant_id, not spend by unverified source_id");
});
test("P20C-P2 learned recipe ownership is player+recipe UUID; NPC recipe-key lookup is separate",()=>{
 const owner=table("player_recipes");
 assert.match(owner,/CONSTRAINT player_recipes_pkey PRIMARY KEY \(player_id, recipe_id\)/);
 assert.match(owner,/REFERENCES public\.players\(id\)/);
 assert.match(owner,/REFERENCES public\.recipes\(id\)/);
 const recipes=table("recipes");
 assert.match(recipes,/id uuid NOT NULL DEFAULT gen_random_uuid/);
 assert.match(recipes,/ingredient_slots jsonb/);
 const npc=read("sql/20260630_02_npc_known_recipe_keys.sql");
 assert.match(npc,/recipe_key text/);
 assert.match(npc,/on public\.npc_known_recipes\(character_id, recipe_key\)/);
 console.log("PASS P20C-P2-RECIPE-KEYS: client alchemy:key alone cannot prove canonical DB recipe UUID, player learned unlock or specific NPC profession");
});
test("P20C-P2 craft plan stores selected material snapshots but no sourced numeric craft fee",()=>{
 const plans=table("craft_plans");
 const rules=table("crafting_recipe_rules");
 assert.match(plans,/selected_materials jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
 assert.match(plans,/plan_payload jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
 assert.match(plans,/result_item_payload jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
 assert.match(rules,/base_dc integer NOT NULL DEFAULT 15/);
 assert.doesNotMatch(plans,/\b(craft_price_gp|craft_fee_gp|material_price_gp) numeric\b/i);
 assert.doesNotMatch(rules,/\b(craft_price_gp|craft_fee_gp|material_price_gp) numeric\b/i);
 console.log("PASS P20C-P2-COST-HOLD: selected_materials snapshot and DC table do not establish a trusted fee; fail closed until approved source");
});
test("P20C-P2 wallet -1 unlimited sentinel is historical schema AND currently used in application",()=>{
 const wallet=table("player_wallets");
 const hook=read("utils/useWallet.js");
 const badge=read("components/WalletBadge.js");
 const hardening=read("sql/20260724_01_security_hardening_roadmap.sql");
 assert.match(wallet,/user_id uuid NOT NULL/);
 assert.match(wallet,/gp numeric NOT NULL DEFAULT 0 CHECK \(gp >= 0::numeric OR gp = '-1'::integer::numeric\)/);
 assert.match(wallet,/CONSTRAINT player_wallets_pkey PRIMARY KEY \(user_id\)/);
 assert.match(hook,/Supports -1 \(infinite\) semantics everywhere/);
 assert.match(hook,/Number\(gp\) === -1/);
 assert.match(badge,/gp === -1/);
 assert.match(hardening,/IF cur = -1 THEN\s+RETURN -1;/);
 assert.match(hardening,/REVOKE ALL ON TABLE public\.player_wallets FROM PUBLIC, anon, authenticated/);
 console.log("PASS P20C-P2-GP-SENTINEL: current wallet UI and historical schema treat -1 as infinite; cost debit must preserve it, not spend it or reject as insufficient");
});
test("P20C-P2 current checked-in plant RLS uses players.id mapping, not browser user_id",()=>{
 const drift=read("sql/20260724_02_database_drift_followup.sql");
 const start=drift.indexOf('ALTER POLICY "Players can view their own plants"');
 const end=drift.indexOf('ALTER POLICY "Players can view their own recipes"',start);
 assert.ok(start>=0&&end>start);
 const s=drift.slice(start,end);
 assert.match(s,/ON public\.player_plants/);
 assert.match(s,/player_id = \(\s*SELECT p\.id\s+FROM public\.players p/i);
 assert.match(s,/p\.user_id = \(SELECT auth\.uid\(\)\)/i);
 assert.doesNotMatch(s,/player_plants\.user_id\s*=\s*auth\.uid\(\)/i);
 console.log("PASS P20C-P2-PLANT-RLS: owner resolves signed user to public.players.id; a plant row UUID or client-supplied user_id is insufficient");
});
