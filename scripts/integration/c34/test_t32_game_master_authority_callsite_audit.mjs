// C34 T32 read-only/current-source role access crosswalk. The T31 signed
// database is separately tested; this file does not claim release acceptance.
// Source observations below are explicit release blockers, NOT fixes.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{const out=spawnSync("git",["hash-object",p],{
 cwd:root,encoding:"utf8",timeout:8000
});assert.equal(out.status,0,out.stderr);return out.stdout.trim();};
const active=[
 "pages/login.js","pages/npcs.js","pages/inventory.js","pages/town/[id].js",
 "pages/encounters.js","pages/encounters/live.js","pages/admin/spells.js",
 "components/PlayerAccountPanel.js",
 "components/NpcPanelTownT28P2Research.jsx",
 "components/character/CharacterInteractionPanelTownT28P2Research.js",
 "components/c34/MerchantPanelT28P2Research.jsx",
];
const find=(p,regex)=>{const text=read(p);const match=regex.exec(text);
 assert.ok(match, "Missing original source gate: "+p+" "+regex);
 return text.slice(0,match.index).split("\n").length;
};
function marker(p,re,meaning,releaseBlocker=true){
 return {path:p,line:find(p,re),meaning,releaseBlocker};
}
test("T32-A01 original role helper overload permits ANY non-player, unlike canonical 3-role game-master model",()=>{
 const sql=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 assert.match(sql,/up\.role = 'admin'/);
 assert.match(sql,/RETURN COALESCE\(target_role, 'player'\) <> 'player'/);
 const c=read("utils/c34/t31GameManagerRoleProfileCandidate.mjs");
 assert.match(c,/GAME_MANAGER_ROLES = Object\.freeze\(\["admin","gm","dm"\]\)/);
 assert.doesNotMatch(c,/role\s*!==?\s*["']player/);
});
test("T32-A02 active player/NPC/town/encounter consumers disagree on game-manager eligibility",()=>{
 const rows=[
  marker("pages/login.js",/return \(profileResult\?\.data\?\.role \|\| "player"\) !== "player"/,
   "Login redirect fallback elevates unknown non-player roles"),
  marker("pages/npcs.js",/supabase\.rpc\("is_admin", \{ uid: user\.id \}\)/,
   "NPC manager uses broad overloaded RPC; its strict admin fallback differs"),
  marker("pages/npcs.js",/setIsAdmin\(prof\?\.role === "admin"\)/,
   "NPC manager fallback allows only exact admin, denies GM/DM"),
  marker("pages/inventory.js",/admin = \(prof\?\.role \|\| "player"\) !== "player"/,
   "Inventory fallback elevates unknown non-player roles"),
  marker("pages/town/[id].js",/supabase\.rpc\("is_admin", \{ uid: user\.id \}\)/,
   "Town owner uses broad overloaded RPC rather than T31 role capability"),
  marker("pages/encounters.js",/supabase\.rpc\("is_admin", \{ uid \}\)/,
   "Tactical map workshop relies on broad overloaded RPC"),
  marker("pages/encounters/live.js",/supabase\.rpc\("is_admin", \{ uid \}\)/,
   "Encounter session GM control relies on broad overloaded RPC"),
  marker("pages/admin/spells.js",/supabase\.rpc\("is_admin"\)/,
   "Spell catalog uses no-arg strict helper, unlike town/encounters"),
  marker("components/character/CharacterInteractionPanelTownT28P2Research.js",
   /const effectiveIsAdmin = requestedIsAdmin \|\| resolvedAdmin/,
   "Town panel can retain privileged requestedIsAdmin before trusted read"),
 ];
 assert.equal(rows.length,9);
 for(const row of rows)assert.ok(row.line>0);
 console.log("T32-ACTIVE-UI-SOURCE-CROSSWALK "+JSON.stringify(rows));
});
test("T32-A03 Stage2 narrative column ACL and derived town raw reader cannot be released separately",()=>{
 const sql=read("sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql");
 assert.match(sql,/REVOKE SELECT \(\s*background,motivation,quirk,mannerism,voice\s*\)/);
 const panel=read("components/NpcPanelTownT28P2Research.jsx");
 assert.match(panel,/\.from\("characters"\)[\s\S]{0,250}\.select\(/);
 for(const field of ["background","motivation","quirk","mannerism","voice"])
  assert.ok(panel.includes('"'+field+'"'),"Legacy town still reads private narrative column "+field);
 assert.match(panel,/supabase\.from\("character_sheets"\)\.select\("sheet"\)/);
 assert.match(read("utils/c34/t31GameManagerRoleProfileCandidate.mjs"),/readNonMapNpcProfileCandidate/);
 assert.match(sql,/private\.current_user_is_admin\(\)/);
});
test("T32-A04 original latest merchant and campaign-pool SQL contain independent admin-only guards",()=>{
 const sql=read("sql/20261016_01_campaign_item_pool_final_constraints.sql");
 const checks=(sql.match(/coalesce\(up\.role='admin',false\)/g)||[]).length;
 assert.equal(checks,2,"Original latest campaign pool and full reroll guard count changed");
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.reroll_merchant_inventory_v2\(/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.set_campaign_future_tech_enabled_v1\(/);
 const held=read("scripts/integration/c34/t29_disposable_commerce_role_gate_pg17.sql");
 assert.match(held,/SOURCE ORIGINAL reroll_merchant_inventory_v2/);
 assert.doesNotMatch(held,/CREATE OR REPLACE FUNCTION public\.set_campaign_future_tech_enabled_v1/);
 const current=read("scripts/integration/c34/t31_disposable_game_manager_role_unification_pg17.sql");
 assert.doesNotMatch(current,/CREATE OR REPLACE FUNCTION public\.set_campaign_future_tech_enabled_v1/);
 console.log("T32-ACTIVE-SQL-BLOCKER: campaign item pool independent role guard needs exact source preflight and signed parity; T31 shared helper alone does NOT authorize it.");
});
test("T32-A05 site activity is not automatically a campaign control; prevent unintended role expansion on release",()=>{
 const sql=read("sql/20260921_01_admin_site_activity_v1.sql");
 assert.match(sql,/private\.current_user_is_admin\(\)/);
 assert.match(read("components/PlayerAccountPanel.js"),/role === "admin"/);
 console.log("T32-TECHNICAL-PRIVACY-BLOCKER: expanding private.current_user_is_admin affects site activity; separate technical audit before production game roles.");
});
test("T32-A06 direct NPC inventory DML delegation remains separate from GM role equivalence",()=>{
 const held=read("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
 assert.match(held,/NOT IN THIS CANDIDATE/);
 assert.match(held,/direct NPC\/merchant/);
 const ui=read("pages/inventory.js");
 assert.match(ui,/\.from\("character_permissions"\)/);
 assert.match(ui,/can_inventory,can_edit/);
 const rls=read("docs/research/C34_T28_P2_TOWN_ROLE_INVENTORY_ROLLBACK_REVIEW_2026-11-15.md");
 assert.match(rls,/Delegated inventory mismatch/);
});
test("T32-A07 protected source and all owner-authorization experiments remain held/unmounted",()=>{
 for(const [p,h] of Object.entries({
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 }))assert.equal(hash(p),h,p);
 for(const p of active)
  assert.doesNotMatch(read(p),/c34_game_manager_capabilities_research_v1|t31GameManagerRoleProfileCandidate/,
   "T31 not approved for product mount "+p);
 assert.match(read("pages/town/[id].js"),/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
});
console.log("PASS T32-CALLSITE-AUDIT: observed hardcoded role, Stage2 reader, world, inventory and site-activity release blockers; no runtime patches");
