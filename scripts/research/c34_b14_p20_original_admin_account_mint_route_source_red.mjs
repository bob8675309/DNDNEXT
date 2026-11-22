// C34 B14-P20 held original /admin self-account mint reachability source RED.
// No hosted query, gameplay /admin edit, original RLS change, map or deploy.
// This witness establishes only source-level UI and historical SQL callpaths;
// full live deployment/access/GRANT and an actual Chromium exploit are unverified.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const blob=f=>{
 const b=fs.readFileSync(path.join(root,f));
 return createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
};
const paths={
 "pages/admin.js":"1ba76a20bfa87934d7e504c056c4770ad1b3a92a",
 "pages/_app.js":"e5f68c0abb293089d6ad09d4e3e4035612eac598",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "sql/20260614_02_phase_a_non_map_security_hardening.sql":"25d106dfc18f469948edf705e7997fa961a16cd0",
 "pages/admin/character-options.js":"6f5de547295c2bb75f23be0e9df1b7adcb4c8039",
 "components/AdminBuildBadge.js":"947ff8c2a3d9c680e8df92d754de7e066d079599",
 "components/AppRouteReloadGuard.js":"f545fc59969fcad4e0b2355c4399ac08b3c2a2d0"
};
test("P20 deployed-main-identical source components and original inventory policy are immutable",()=>{
 for(const [file,sha] of Object.entries(paths))
  assert.equal(blob(file),sha,"Original main-equivalent source has changed; review authorization path before removing this RED: "+file);
 console.log("PASS P20-ORIGINAL-ROUTE-BLOBS: pinned unchanged main-equivalent /admin, _app, direct AssignItemButton, historical RLS and adjacent admin controls");
});
test("P20 /admin exact selected-item to default current signed account INSERT path exists",()=>{
 const page=read("pages/admin.js"),button=read("components/AssignItemButton.js");
 for(const x of [
  'import AssignItemButton from "../components/AssignItemButton"',
  'const [assignOwnerType, setAssignOwnerType] = useState("player")',
  'const [assignOwnerId, setAssignOwnerId] = useState("")',
  'ownerType={assignOwnerId ? assignOwnerType : null}',
  'ownerId={assignOwnerId || null}',
  '<AssignItemButton',
  'setSelected(filtered[0])'
 ])assert.ok(page.includes(x),"Original /admin selected-item fallback caller missing: "+x);
 for(const x of [
  "if (!finalType || !finalId)",
  "await supabase.auth.getUser()",
  'finalType = "player";',
  "finalId = user.id;",
  'if (finalType === "player") insertData.user_id = finalId;',
  'await supabase.from("inventory_items").insert(insertData)'
 ])assert.ok(button.includes(x),"Original direct player-owner minted item fallback missing: "+x);
 assert.ok(!button.includes("create_earned_inventory_item_v1"));
 console.log("PASS P20-ADMIN-FALLBACK-SOURCE-RED: original /admin no-target selection passes null; button defaults to signed self and performs raw item INSERT");
});
test("P20 page and _app source have no route role check; adjacent admin page does (source only)",()=>{
 const admin=read("pages/admin.js"),app=read("pages/_app.js");
 assert.ok(app.includes("<Component {...pageProps} />"));
 assert.ok(app.includes("<AdminBuildBadge />"));
 assert.ok(read("components/AdminBuildBadge.js").includes("if (!isAdmin) return null;"),
  "AdminBuildBadge is only a decorative, independently hidden widget, not a route gate");
 assert.ok(!admin.includes('supabase.rpc("is_admin"'));
 assert.ok(!admin.includes('supabase.auth.getSession()'));
 assert.ok(!admin.includes("getServerSideProps"));
 assert.ok(!admin.includes("router.replace("));
 for(const m of ["middleware.js","middleware.ts","src/middleware.js","src/middleware.ts"])
  assert.equal(fs.existsSync(path.join(root,m)),false,
   "Root route middleware source added; re-review actual /admin access immediately");
 const adjacent=read("pages/admin/character-options.js");
 assert.ok(adjacent.includes('supabase.rpc("is_admin")'));
 assert.ok(adjacent.includes("if (!isAdmin) return"));
 console.log("PASS P20-ADMIN-PAGE-ROUTE-RED: unchecked original /admin render, adjacent route has explicit signed admin gate; hosted network reachability untested");
});
test("P20 historical INSERT RLS allows authenticated user_id=self without catalog entitlement; no P19 shortcut fixes it",()=>{
 const rls=read("sql/20260614_02_phase_a_non_map_security_hardening.sql");
 const p19=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p19_disposable_game_manager_assignment_policy_pg17.sql");
 const signed=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p19_original_assign_item_source_red_signed.mjs");
 assert.ok(rls.includes("CREATE POLICY inventory_items_insert_owner_or_admin"));
 assert.ok(rls.includes("user_id = (SELECT auth.uid())"));
 assert.ok(rls.includes("private.current_user_is_admin()"));
 assert.ok(p19.includes("CREATE POLICY c34_b14_p19_temporary_game_manager_insert"));
 assert.ok(!p19.includes("ALTER POLICY inventory_items_insert_owner_or_admin"));
 assert.ok(signed.includes("PASS P19-ACCOUNT-MINT-RED"));
 assert.ok(signed.includes("PASS P19-ACCOUNT-MINT-HOLD"));
 assert.ok(signed.includes("PASS P19-ASSIGN-RESTORE"));
 console.log("PASS P20-ACCOUNT-MINT-RLS-SOURCE-RED: historical self-owned row authoring lacks earned-item provenance; P19 only authorizes signed game managers and does not fix it");
 console.log("P20-HOSTED-STATUS: no live Postgres policies/GRANTs or Vercel /admin access checked; no production exploit or production patch established");
});
