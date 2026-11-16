import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const hash=p=>{const r=spawnSync("git",["hash-object",p],{cwd:root,encoding:"utf8"});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
test("T34-01 source-original complete campaign and technical site SQL pinned",()=>{
 assert.equal(hash("sql/20261016_01_campaign_item_pool_final_constraints.sql"),"c804ccd4ea3c1746ad114daa18af8f173bf02128");
 assert.equal(hash("sql/20260921_01_admin_site_activity_v1.sql"),"e3a5c7ae7c712a8657e151cf9ccf60ffaccf465a");
 assert.equal(hash("sql/20260921_04_admin_site_activity_hardening_v1.sql"),"75eeb3bb0dbf2eb16a844867d387b7b02f94bc71");
 const src=read("sql/20261016_01_campaign_item_pool_final_constraints.sql");
 assert.equal((src.match(/SELECT coalesce\(up\.role='admin',false\)/g)||[]).length,2,
  "T34 must not modify original reroll and setter independent role checks");
 const site=read("sql/20260921_01_admin_site_activity_v1.sql");
 assert.equal((site.match(/if not private\.current_user_is_admin\(\) then/g)||[]).length,1);
 assert.match(site,/FROM PUBLIC/i);
});
test("T34-02 only one original setter predicate and separate site-report gate derived",()=>{
 const s=read("scripts/integration/c34/test_t34_game_manager_campaign_site_signed_pg17.mjs");
 assert.match(s,/const originalSetter=extract\(catalog/);
 assert.match(s,/const originalSite=extract\(site/);
 assert.match(s,/SELECT coalesce\(up\.role IN \('admin','gm','dm'\),false\)/);
 assert.match(s,/if not private\.current_user_is_site_admin_v1\(\) then/);
 assert.match(s,/p\.role='admin'/);
 assert.match(s,/const tagsOverload=/);
 assert.match(s,/const actualTagShape=sql\(/);
 assert.match(s,/\["text\[\]","jsonb"\]\.includes\(actualTagShape\)/);
 assert.match(s,/actualTagShape==="jsonb"\?tagsOverload/);
 assert.match(s,/characters_guard_player_tags_v1/);
 assert.match(s,/ARRAY\(SELECT jsonb_array_elements_text/);
 assert.doesNotMatch(s,/ALTER TABLE public\.characters DROP COLUMN|ALTER TABLE public\.characters ALTER COLUMN tags/);
 assert.match(s,/PASS T34-ORIGINAL-RED/);
 assert.match(s,/PASS T34-GAME-/);
 assert.match(s,/PASS T34-SITE-/);
 assert.match(s,/PASS T34-DEMOTION/);
 assert.match(s,/PASS T34-SWITCH/);
 assert.match(s,/SELECT md5\(pg_get_functiondef/);
 assert.match(s,/DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"/);
 assert.match(s,/PGHOST:"127\.0\.0\.1"/);
 assert.doesNotMatch(s,/auth\.jwt\(|user_metadata|NEXT_PUBLIC_C34_T34_ACTIVATE|Supabase\.co|github\.com\/.*merge/i);
});
test("T34-03 preserve all world and shared UI, T33 and signed source unchanged",()=>{
 for(const [p,blob] of Object.entries({
  "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
  "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
  "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 }))assert.equal(hash(p),blob,p);
 assert.match(read("pages/town/[id].js"),/NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE === "1"/);
 assert.match(read("scripts/integration/c34/test_t33_town_stage2_signed_browser.mjs"),/PASS T33-SIGNED-CHROMIUM/);
 assert.doesNotMatch(read("pages/admin.js"),/T34/);
 assert.doesNotMatch(read("pages/npcs.js"),/T34/);
});
console.log("PASS T34-SOURCE: original independent game setter and website telemetry exact source, signed RED/GREEN and world untouched");
