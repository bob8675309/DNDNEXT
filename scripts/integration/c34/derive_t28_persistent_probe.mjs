#!/usr/bin/env node
// T28-P1 temporary Next route authoring, ORIGINAL source pinned and read-only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
export const T28_P1_TEMP_ROUTE="pages/__c34_t28_persistent_probe.jsx";
export const T28_ORIGINAL_BLOBS=Object.freeze({
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
});
const valid=id=>{assert.match(id,/^[a-f0-9-]{36}$/i,"T28 synthetic merchant UUID");return id;};
export function deriveT28PersistentRoute(firstMerchantId,secondMerchantId) {
 for(const [p,sha] of Object.entries(T28_ORIGINAL_BLOBS))
  assert.equal(hash(src(p)),sha,"T28 original mounted source drift: "+p);
 const probe=src("components/c34/T28NonMapPersistentResearchProbe.jsx");
 assert.match(probe,/from "\.\.\/MerchantPanel"/);
 assert.match(probe,/from "\.\.\/\.\.\/utils\/useWallet"/);
 assert.match(probe,/createNonMapActorEpochCandidate/);
 assert.match(probe,/onAuthStateChange/);
 assert.doesNotMatch(probe,/service_role|from ["']\.\.\/\.\.\/pages\/map|loadCharacterSecrets/);
 assert.ok(!existsSync(path.join(root,T28_P1_TEMP_ROUTE)),"T28 refuses replacing tracked or preexisting probe route");
 const id1=valid(firstMerchantId),id2=valid(secondMerchantId);
 assert.notEqual(id1,id2);
 return `// AUTO-DERIVED T28-P1 disposable non-map route. NEVER COMMIT THIS FILE.
import T28NonMapPersistentResearchProbe from "../components/c34/T28NonMapPersistentResearchProbe";
export default function T28ResearchRoute() {
  const merchant={id:${JSON.stringify(id1)},name:"T26 Probe Merchant",kind:"merchant",storefront_enabled:true};
  const alternateMerchant={id:${JSON.stringify(id2)},name:"T28 Other Merchant",kind:"merchant",storefront_enabled:true};
  return <T28NonMapPersistentResearchProbe merchant={merchant} alternateMerchant={alternateMerchant} />;
}
`;
}
export function writeT28PersistentRoute(firstMerchantId,secondMerchantId) {
 const output=deriveT28PersistentRoute(firstMerchantId,secondMerchantId);
 writeFileSync(path.join(root,T28_P1_TEMP_ROUTE),output,{flag:"wx"});
 return output;
}
