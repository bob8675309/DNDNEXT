#!/usr/bin/env node
// T28-P2 disposable NON-MAP probe route, generated ONLY by signed local CI.
import assert from "node:assert/strict";
import {readFileSync,existsSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file=p=>readFileSync(path.join(root,p),"utf8");
const sha=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
export const T28_P2_TEMP_ROUTE="pages/__c34_t28_p2_probe.jsx";
export const ORIGINAL_COMMERCE=Object.freeze({
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
});
const uuid=s=>{assert.match(s,/^[a-f0-9-]{36}$/i);return s};
export function deriveT28P2MountedRoute(firstMerchant,secondMerchant,alternateWalletUserId){
 for(const [p,id] of Object.entries(ORIGINAL_COMMERCE))
  assert.equal(sha(file(p)),id,"T28-P2 original production blob drift "+p);
 assert.ok(!existsSync(path.join(root,T28_P2_TEMP_ROUTE)),
  "T28-P2 refuses to overwrite existing/tracked temporary route");
 const probe=file("components/c34/T28P2MountedCommerceProbe.jsx");
 assert.match(probe,/MerchantPanelT28P2Research/);
 assert.match(probe,/useWalletT28P2Research/);
 assert.match(probe,/onAuthStateChange/);
 assert.doesNotMatch(probe,/service_role|MapPageClient|pages\/map/);
 const a=uuid(firstMerchant),b=uuid(secondMerchant),otherWallet=uuid(alternateWalletUserId);
 assert.notEqual(a,b);
 return "// AUTO-GENERATED NON-MAP T28-P2 DISPOSABLE NEXT ROUTE. NEVER COMMIT.\n"+
  'import CommerceProbe from "../components/c34/T28P2MountedCommerceProbe";\n'+
  "export default function T28P2ResearchRoute(){\n"+
  " const first={id:"+JSON.stringify(a)+',name:"T26 Probe Merchant",kind:"merchant",storefront_enabled:true};\n'+
  " const second={id:"+JSON.stringify(b)+',name:"T28 Other Merchant",kind:"merchant",storefront_enabled:true};\n'+
  " return <CommerceProbe merchant={first} alternateMerchant={second} alternateWalletUserId={"+JSON.stringify(otherWallet)+"}/>;\n}\n";
}
export function writeT28P2MountedRoute(firstMerchant,secondMerchant,alternateWalletUserId){
 const output=deriveT28P2MountedRoute(firstMerchant,secondMerchant,alternateWalletUserId);
 writeFileSync(path.join(root,T28_P2_TEMP_ROUTE),output,{flag:"wx"});
 return output;
}
