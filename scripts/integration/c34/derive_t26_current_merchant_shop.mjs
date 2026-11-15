#!/usr/bin/env node
// T26: source-locked T25 CURRENT manager, with *only its scratch overlay*
// changed to a safe public Profile + the ORIGINAL current MerchantPanel.
// The production NpcPanel.js is used by the world map and is not patched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveT25CurrentManager } from "./derive_t25_current_npc_manager.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
export const T26_TEMP_ROUTE="pages/__c34_t26_probe.jsx";
export const T26_SOURCE_BLOBS=Object.freeze({
 "pages/npcs.js":"7fc00b9b3ace6233d1648a3d017f8a05e072d722",
 "pages/_app.js":"e5f68c0abb293089d6ad09d4e3e4035612eac598",
 "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a",
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c"
});
const source=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
export function deriveT26CurrentMerchantShop() {
 for(const [p,expected] of Object.entries(T26_SOURCE_BLOBS))
  assert.equal(hash(source(p)),expected,"T26 original protected source drift: "+p);
 const {output:manager,edits}=deriveT25CurrentManager(source("pages/npcs.js"));
 const before='import NpcPanel from "../components/character/CharacterInteractionPanel";';
 const after='import NpcPanel from "../components/c34/NonMapMerchantShopResearchPanel";';
 assert.equal(manager.split(before).length-1,1,"T26 exact overlay import source drift");
 const sourceOnlyProfileButton = '<div className="h5 mb-1">{selected.name}</div>';
 assert.equal(manager.split(sourceOnlyProfileButton).length-1,1,
  "T26 selected merchant header source drift");
 const allowlistedProfileButton = sourceOnlyProfileButton + `
                  {userId && selectedPrivateResult?.profile ? (
                    <button type="button" className="btn btn-sm btn-outline-info"
                      data-testid="t26-open-public-profile"
                      onClick={() => { setProfilePanelInitialView("profile"); setProfilePanelOpen(true); }}>
                      Open Profile
                    </button>
                  ) : null}`;
 const originalAuthClear='selectedKeyRef.current = ""; setSelectedKey(null);';
 assert.equal(manager.split(originalAuthClear).length-1,1,"T26 auth overlay reset drift");
 const isolatedAuthClear=originalAuthClear+' setProfilePanelOpen(false);';
 const output=manager.replace(before,after)
  .replace(originalAuthClear,isolatedAuthClear)
  .replace(sourceOnlyProfileButton,allowlistedProfileButton).replace(
  "// C34 T25 generated from current",
  "// C34 T26 SCRATCH SHOP WRAPPER (real original MerchantPanel): derived from current"
 );
 const research=source("components/c34/NonMapMerchantShopResearchPanel.jsx");
 assert.match(research,/from "\.\.\/MerchantPanel"/);
 assert.match(research,/readNonMapNpcProfileCandidate/);
 assert.match(research,/onAuthStateChange/);
 assert.match(research,/Return to Profile/);
 assert.doesNotMatch(research,/loadCharacterSecrets|get_character_secrets_v1|service_role|\.select\(["']\*/);
 assert.doesNotMatch(output,/loadCharacterSecrets|get_character_secrets_v1|\.select\("character_id,sheet"\)/);
 assert.ok(!existsSync(path.join(root,T26_TEMP_ROUTE)),"T26 refuses checked-in/preexisting scratch route");
 return {output,edits};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const mode=process.argv[2];
 assert.ok(mode==="--verify"||mode==="--write","T26 --verify or --write only");
 const {output,edits}=deriveT26CurrentMerchantShop();
 if(mode==="--write")writeFileSync(path.join(root,T26_TEMP_ROUTE),output,{flag:"wx"});
 console.log("PASS T26 source-locked current manager + original merchant storefront; edits="+edits.length+" route="+(mode==="--verify"?"unmounted":"disposable"));
}
