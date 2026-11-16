#!/usr/bin/env node
// T27 source-only negative matrix: the real protected map/shared panel and
// original shop/wallet remain unchanged; the *signed browser* does the stock race.
// This does not fetch held #345, install SQL, or claim a live UI release.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const sha1=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
const originals=Object.freeze({
 "pages/npcs.js":"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
 "pages/_app.js":"e5f68c0abb293089d6ad09d4e3e4035612eac598",
 "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "components/character/CharacterInteractionPanel.js":"28a2dde5696376ee39c01a498b76a146f30aaffa",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "pages/town/[id].js":"a4e790e5941afb16660a112ee9189e4a84d4afb7",
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25"
});
// The ONLY authorized difference from T27's exact original source is the
// opt-in TOWN route selection of a separately derived Profile shell. Rebuild
// the exact old town-page blob before comparing; every other original remains
// byte-identical. No shared map, NpcPanel or CharacterInteractionPanel cutover.
const exactOriginalTownImport='const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });';
const exactGatedTownImport=exactOriginalTownImport+
 '\n// Only this town route opts its Profile→Shop tab into the guarded candidate.'+
 '\nconst T28_P2_TOWN_SHOP_ENABLED = process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";'+
 '\nconst GuardedTownCharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanelTownT28P2Research"), { ssr: false });'+
 '\nconst TownProfilePanel = T28_P2_TOWN_SHOP_ENABLED ? GuardedTownCharacterInteractionPanel : CharacterInteractionPanel;';
const exactOriginalTownView="  setActiveTownProfileView(initialView || \"profile\");";
const exactGuardedTownView="  const requestedView = initialView || \"profile\";\n  // T28-P2 opt-in: the Bazaar still requests \"shop\", but enter Profile\n  // first. Default OFF preserves the pre-research town navigation.\n  setActiveTownProfileView(\n    T28_P2_TOWN_SHOP_ENABLED && requestedView === \"shop\" ? \"profile\" : requestedView\n  );";
const exactTownActorImportOld="import { useEffect, useMemo, useState } from \"react\";";
const exactTownActorImportNew="import { useEffect, useMemo, useRef, useState } from \"react\";";
const exactTownActorBoundary="\n  // C34 T28-P2 ACTOR-TOWN-BOUNDARY BEGIN (disabled unless research flag is 1).\n  // Child stock/wallet guards do not protect TownSheet's parent inventory and Profile cache.\n  const actorBoundaryEpochRef = useRef(0);\n  const [actorBoundaryEpoch, setActorBoundaryEpoch] = useState(0);\n  useEffect(() => {\n    if (!T28_P2_TOWN_SHOP_ENABLED) return undefined;\n    let subscribed = true;\n    const { data } = supabase.auth.onAuthStateChange((event) => {\n      if (!subscribed || ![\"SIGNED_OUT\", \"SIGNED_IN\", \"USER_UPDATED\"].includes(event)) return;\n      // Increment synchronously before any old async response can commit.\n      actorBoundaryEpochRef.current += 1;\n      setActiveTownProfileCharacter(null);\n      setActiveTownProfileView(\"profile\");\n      setPlayerInventory([]);\n      setPlayerPlants([]);\n      setPlayerUserId(null);\n      setMarketData({ presentMerchants: [], residentMerchants: [] });\n      setRosterChars([]);\n      setQuests([]);\n      setStoredLabels([]);\n      setIsAdmin(false);\n      setLocation(null);\n      setLoading(true);\n      setActorBoundaryEpoch(actorBoundaryEpochRef.current);\n    });\n    return () => {\n      subscribed = false;\n      data?.subscription?.unsubscribe();\n    };\n  }, []);\n  // C34 T28-P2 ACTOR-TOWN-BOUNDARY END.\n";
const exactTownActorLoaderOld="  useEffect(() => {\n    let alive = true;\n    const load = async () => {";
const exactTownActorLoaderNew="  useEffect(() => {\n    let alive = true;\n    const loadedActorEpoch = actorBoundaryEpochRef.current;\n    const isCurrentActor = () => alive && (!T28_P2_TOWN_SHOP_ENABLED ||\n      loadedActorEpoch === actorBoundaryEpochRef.current);\n    const load = async () => {";
const exactTownActorDepsOld="  }, [router.isReady, id]);";
const exactTownActorDepsNew="  }, [router.isReady, id, actorBoundaryEpoch]);";
function stripExactTownActorBoundary(source) {
  for(const [key,token] of [["hook",exactTownActorBoundary],["loader",exactTownActorLoaderNew],
    ["deps",exactTownActorDepsNew],["import",exactTownActorImportNew]])
    assert.equal(source.split(token).length-1,1,"T27 exact opt-in actor boundary "+key);
  assert.equal(source.split("if (isCurrentActor())").length-1,3);
  assert.equal(source.split("if (!isCurrentActor())").length-1,6);
  return source.replace(exactTownActorImportNew,exactTownActorImportOld)
    .replace(exactTownActorBoundary,"")
    .replace(exactTownActorLoaderNew,exactTownActorLoaderOld)
    .replaceAll("if (isCurrentActor())","if (alive)")
    .replaceAll("if (!isCurrentActor())","if (!alive)")
    .replace(exactTownActorDepsNew,exactTownActorDepsOld);
}
function t27UnderlyingOriginalTownSource(source) {
 assert.equal(source.split(exactGatedTownImport).length-1,1,
  "T27 town must have precisely one disabled-by-default Profile override");
 assert.equal(source.split('<TownProfilePanel\n                  key=').length-1,1,
  "T27 town Profile must have exactly one selected shell");
 assert.equal(source.split('                  useGuardedTownMerchant={T28_P2_TOWN_SHOP_ENABLED}\n').length-1,1,
  "T27 town must pass the opt-in only into the Profile shell");
 assert.equal(source.split(exactGuardedTownView).length-1,1,
  "T27 flagged Bazaar must enter Profile before Shop");
 return stripExactTownActorBoundary(source).replace(exactGatedTownImport,exactOriginalTownImport)
  .replace('<TownProfilePanel\n                  key=','<CharacterInteractionPanel\n                  key=')
  .replace('                  useGuardedTownMerchant={T28_P2_TOWN_SHOP_ENABLED}\n',"")
  .replace(exactGuardedTownView,exactOriginalTownView);
}
test("T27-S01 source-lock all original consumers; exact reversible T28-P2 TOWN ONLY Profile selection",()=>{
 for(const [p,expected] of Object.entries(originals)) {
  const current=src(p);
  const source=p==="pages/town/[id].js" ? t27UnderlyingOriginalTownSource(current) : current;
  assert.equal(sha1(source),expected,"T27 incompatible original source drift: "+p);
 }
});
test("T27-S02 map/town/manager share original NpcPanel; no silent privacy cutover",()=>{
 const interaction=src("components/character/CharacterInteractionPanel.js");
 assert.match(interaction,/import NpcPanel from "\.\.\/NpcPanel"/);
 for(const p of ["pages/npcs.js","pages/town/[id].js","components/MapPageClient.js"])
  assert.match(src(p),/CharacterInteractionPanel/,p);
 for(const p of ["pages/npcs.js","pages/_app.js","pages/town/[id].js",
                    "components/MapPageClient.js","components/NpcPanel.js",
                    "components/character/CharacterInteractionPanel.js"]){
  assert.doesNotMatch(src(p),/NonMapMerchantShopResearchPanel|__c34_t26_probe/,
   "T27 research Profile must NOT mount in active original consumer: "+p);
 }
 assert.match(src("pages/npcs.js"),/loadCharacterSecrets/);
 assert.match(src("components/NpcPanel.js"),/loadCharacterSecrets/);
});
test("T27-S03 real original stock/wallet authority and currently unguarded asynchronous readers recorded",()=>{
 const panel=src("components/MerchantPanel.js");
 const wallet=src("utils/useWallet.js");
 assert.match(panel,/\.from\("character_stock"\)[\s\S]*?\.select\("\*"\)/);
 assert.match(panel,/setStock\(data \|\| \[\]\)/);
 assert.match(panel,/supabase\.rpc\("buy_from_merchant"/);
 assert.match(panel,/await Promise\.all\(\[fetchStock\(\), refreshWallet\(\)\]\)/);
 assert.match(wallet,/supabase\.rpc\("wallet_get"/);
 assert.match(wallet,/supabase\.rpc\("wallet_set"/);
 assert.match(wallet,/async function refresh\(\)[\s\S]*?setGp\(/);
 assert.doesNotMatch(wallet,/onAuthStateChange|actorEpochRef/,
  "Original wallet refresh must be reviewed if actor lifecycle is changed");
});
test("T27-S04 signed race holds real response bytes across logout, no mocked stock",()=>{
 const browser=src("scripts/integration/c34/test_t26_current_merchant_shop_browser.mjs");
 const start=browser.indexOf("// T27-R01");
 const end=browser.indexOf('await login("OUTSIDER");',start);
 assert.ok(start>0 && end>start,"T27 signed race not inside original T26 current Next browser");
 const race=browser.slice(start,end);
 for(const token of [
  'page.route("**/rest/v1/character_stock*"',
  'rt.request().method()!=="GET"',
  'url?.searchParams.get("character_id")==="eq."+merchant',
  'const upstream=await rt.fetch()',
  'stockFetch={status:upstream.status(),rows:upstreamRows}',
  'await stockGate',
  'await rt.fulfill({response:upstream})',
  'await logout()',
  'releaseHeldStock()',
  'stockDelivered',
  't26-real-merchant-shop',
  'PASS T27-R01'
 ])assert.ok(race.includes(token),"T27 missing genuine signed stock race guard: "+token);
 const logout=race.indexOf("await logout()");
 const release=race.indexOf("releaseHeldStock()",logout);
 assert.ok(logout>=0 && release>logout,
  "T27 must deliver signed stock bytes AFTER real logout, not before");
 assert.doesNotMatch(race,/rt\.fulfill\(\{\s*(?:body|json)\s*:/,
  "T27 must not simulate merchant stock with a fake response");
 assert.equal(existsSync(path.join(root,"pages/__c34_t26_probe.jsx")),false,
  "T27 must not introduce any checked-in Next probe route");
});
console.log("T27 exact-source consumer + original signed delayed-stock-negative contract PASS; production/map unchanged.");
