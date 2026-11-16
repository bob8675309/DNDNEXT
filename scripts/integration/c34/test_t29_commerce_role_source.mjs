// T29: owner-approved Admin + GM + DM stock/gold, NO implicit world-map admin.
// Test is pure model + pinned live contract source inspection; NOT a signed DB grant.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commerceRoleCapabilities, COMMERCE_MANAGER_ROLES } from "../../../utils/c34/commerceRolePolicyCandidate.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("T29-C01 exact owner-approved canonical roles Admin, GM and DM can manage stock and gold",()=>{
 assert.deepEqual(COMMERCE_MANAGER_ROLES,["admin","gm","dm"]);
 for(const role of COMMERCE_MANAGER_ROLES) {
  const c=commerceRoleCapabilities(role);
  assert.equal(c.canEditMerchantStock,true,role);
  assert.equal(c.canSetPlayerGold,true,role);
  assert.equal(c.canViewPublicStock,true,role);
  assert.equal(Object.isFrozen(c),true);
 }
});
test("T29-C02 GM/DM do NOT inherit world-map route controls or unrelated privacy powers",()=>{
 for(const role of ["gm","dm"]) {
  const c=commerceRoleCapabilities(role);
  assert.equal(c.canEditWorldTravel,false,role);
  assert.equal(c.canEditCharacterPrivacy,false,role);
 }
 assert.equal(commerceRoleCapabilities("admin").canEditWorldTravel,true);
});
test("T29-C03 players, missing profiles and unknown non-player roles fail closed",()=>{
 for(const role of ["player","editor","moderator","coeditor","owner","GM","DM","",null,undefined,{},0,"gm "]) {
  const c=commerceRoleCapabilities(role);
  assert.equal(c.canEditMerchantStock,false,String(role));
  assert.equal(c.canSetPlayerGold,false,String(role));
  assert.equal(c.canEditWorldTravel,false,String(role));
 }
});
test("T29-C04 owner authorization does not silently alter protected app runtime, map or Supabase functions",()=>{
 const town=read("pages/town/[id].js");
 assert.match(town,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
 const candidate=read("utils/c34/commerceRolePolicyCandidate.mjs");
 assert.doesNotMatch(candidate,/supabase\.from|supabase\.rpc|createClient|service_role|user_metadata/);
 for(const p of ["components/MerchantPanel.js","utils/useWallet.js","components/MapPageClient.js"]) {
  assert.doesNotMatch(read(p),/commerceRolePolicyCandidate|COMMERCE_MANAGER_ROLES/,"Original protected source changed by T29: "+p);
 }
 assert.doesNotMatch(town,/commerceRolePolicyCandidate/,"T29 must not activate a client authorization bypass");
});
test("T29-C05 permissions approval does not imply every non-player role",()=>{
 const c=read("utils/c34/commerceRolePolicyCandidate.mjs");
 const executable=c.split("\n").filter(line=>!line.trimStart().startsWith("//")).join("\n");
 assert.doesNotMatch(executable,/role\s*!==?\s*["']player/);
 assert.match(c,/COMMERCE_MANAGER_ROLES\.includes\(role\)/);
});
test("T29-C06 research-only town stock is independent of route administration",()=>{
 const shop=read("components/c34/MerchantPanelT28P2Research.jsx");
 const parent=read("components/NpcPanelTownT28P2Research.jsx");
 assert.match(parent,/showTravelTools=\{false\}/);
 for(const token of [
  "canManageCommerce","canManageTravel","showTravelTools = true",
  "mayManageCommerce","mayManageTravel",
  "if (!mayManageTravel) return",
  "{mayManageTravel ? <div className=\"merchant-admin-grid\">",
  "const adminConsole = mayManageCommerce && showTravel"
 ])assert.ok(shop.includes(token),"Missing commerce/travel scope "+token);
 assert.doesNotMatch(shop,/if \(!isAdmin\)/,
  "No generic non-player admin role may gate travel/stock together");
 assert.doesNotMatch(read("components/MerchantPanel.js"),/mayManageCommerce|mayManageTravel/,
  "Protected original merchant still untouched");
});
console.log("PASS T29-COMMERCE-ROLE-SOURCE: Admin/GM/DM stock+gold only, unknown deny, protected original UI unchanged; hosted SQL NOT executed");
