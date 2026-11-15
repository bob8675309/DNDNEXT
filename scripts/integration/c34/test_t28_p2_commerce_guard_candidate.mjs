#!/usr/bin/env node
// T28-P2 candidate is NOT imported by production; offline behavior regression only.
import assert from "node:assert/strict";
import { createT28P2CommerceGuardCandidate } from "../../../utils/c34/t28P2CommerceGuardCandidate.mjs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file=p=>readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
assert.equal(blob(file("components/MerchantPanel.js")),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
assert.equal(blob(file("utils/useWallet.js")),"f34b99f1d6eee66420d57bdcefdc6d3427092e25");
for (const p of ["pages/map.js","components/MapPageClient.js","pages/npcs.js","pages/town/[id].js","pages/inventory.js","components/NpcPanel.js","components/MerchantPanel.js","utils/useWallet.js"]) {
  assert.ok(!file(p).includes("t28P2CommerceGuardCandidate"),"P2 candidate must not enter product route: "+p);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes,no)=>{resolve=yes; reject=no});
  return {promise,resolve,reject};
};
const rows=[], balances=[], errors=[], pendingStocks=[], pendingWallets=[];
const guard=createT28P2CommerceGuardCandidate({
  readStock:merchantId=>{const d=deferred();pendingStocks.push({merchantId,...d});return d.promise},
  readWallet:userId=>{const d=deferred();pendingWallets.push({userId,...d});return d.promise},
  onStock:value=>rows.push(value), onWallet:value=>balances.push(value), onError:error=>errors.push(error)
});
const latest=a=>a[a.length-1];

// (1) Production T28-P1 reproduction class: old signed stock and wallet delivered post logout.
guard.observeActor("gm");
guard.selectMerchant("m1");
let oldStock=guard.loadStock(), oldWallet=guard.loadWallet();
assert.equal(pendingWallets[0].userId,null);
guard.revoke();
pendingStocks[0].resolve(["STALE-GM"]);pendingWallets[0].resolve(79);
assert.equal((await oldStock).committed,false);
assert.equal((await oldWallet).committed,false);
assert.deepEqual(latest(rows),[]);
assert.equal(latest(balances),null);

// (2) Sign out and in as same account still invalidates prior generation.
guard.observeActor("gm");guard.selectMerchant("m1");
oldStock=guard.loadStock();oldWallet=guard.loadWallet();
guard.revoke();guard.observeActor("gm");guard.selectMerchant("m1");
pendingStocks[1].resolve(["SAME-ID-OLD"]);pendingWallets[1].resolve(80);
assert.equal((await oldStock).committed,false);
assert.equal((await oldWallet).committed,false);

// (3) Merchant switch invalidates stock but NOT same-actor wallet.
oldStock=guard.loadStock();oldWallet=guard.loadWallet();
guard.selectMerchant("m2");
pendingStocks[2].resolve(["M1-LATE"]);pendingWallets[2].resolve(71);
assert.equal((await oldStock).committed,false);
assert.equal((await oldWallet).committed,true);
assert.equal(latest(balances),71);
const fresh=guard.loadStock();
assert.equal(latest(pendingStocks).merchantId,"m2");
latest(pendingStocks).resolve(["M2"]);
assert.equal((await fresh).committed,true);
assert.deepEqual(latest(rows),["M2"]);

// (4) The NEW T28-P2 edge: same signed Admin changes the selected wallet owner.
guard.selectWalletTarget("player-A");
oldWallet=guard.loadWallet();
assert.equal(latest(pendingWallets).userId,"player-A");
guard.selectWalletTarget("player-B");
latest(pendingWallets).resolve(999);
assert.equal((await oldWallet).committed,false);
assert.equal(latest(balances),null);
const freshWallet=guard.loadWallet();
assert.equal(latest(pendingWallets).userId,"player-B");
latest(pendingWallets).resolve(12);
assert.equal((await freshWallet).committed,true);
assert.equal(latest(balances),12);

// (5) Same-merchant concurrent refresh: latest response wins even if first arrives last.
const first=guard.loadStock(),second=guard.loadStock();
pendingStocks.at(-1).resolve(["NEW"]);
assert.equal((await second).committed,true);
pendingStocks.at(-2).resolve(["OLD"]);
assert.equal((await first).committed,false);
assert.deepEqual(latest(rows),["NEW"]);

// (6) Account switch and error from old actor cannot update another actor.
guard.selectWalletTarget(null);
oldWallet=guard.loadWallet();
guard.observeActor("outsider");
latest(pendingWallets).reject(new Error("old actor denied"));
assert.equal((await oldWallet).committed,false);
assert.equal(errors.length,0);
const outsiderWallet=guard.loadWallet();
latest(pendingWallets).resolve(0);
assert.equal((await outsiderWallet).committed,true);
assert.equal(latest(balances),0);

// (7) Current-actor denied read is surfaced and reported as current, not left loading.
guard.selectMerchant("m2");
const denied=guard.loadStock();
latest(pendingStocks).reject(new Error("current RLS denied"));
const deniedResult=await denied;
assert.equal(deniedResult.committed,false);
assert.equal(deniedResult.current,true);
assert.match(String(errors.at(-1)?.message),/current RLS denied/);

// (8) Disposal silences old requests without issuing React state setters.
guard.selectMerchant("m2");
const pending=guard.loadStock();
const previous=rows.length;
guard.dispose();
latest(pendingStocks).resolve(["AFTER-UNMOUNT"]);
assert.equal((await pending).committed,false);
assert.equal(rows.length,previous);
assert.equal((await guard.loadWallet()).committed,false);
assert.equal(guard.snapshot().stopped,true);

console.log("PASS T28-P2-UNIT: 8 scoped cases; logout, same-user relogin, merchant switch, selected wallet target, latest wins, actor errors, current denial, dispose");
