#!/usr/bin/env node
// T28-P0: direct original mounted-source risk locks and deterministic async
// actor/merchant stock/wallet RED→candidate GREEN. No hosted calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNonMapActorEpochCandidate } from "../../../utils/c34/actorRequestEpochCandidate.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
const pending=()=>{let release;const promise=new Promise(resolve=>release=resolve);return {promise,release};};

test("T28-P00 original MerchantPanel/useWallet and non-map consumers source-locked, no runtime candidate imports",()=>{
 const merchant=src("components/MerchantPanel.js"),wallet=src("utils/useWallet.js");
 assert.equal(hash(merchant),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
 assert.equal(hash(wallet),"f34b99f1d6eee66420d57bdcefdc6d3427092e25");
 assert.match(merchant,/\.from\("character_stock"\)/);
 assert.match(merchant,/setStock\(data \|\| \[\]\)/);
 assert.match(merchant,/supabase\.rpc\("buy_from_merchant"/);
 assert.match(wallet,/async function refresh\(\)[\s\S]*?setGp\(/);
 for(const p of ["pages/npcs.js","pages/town/[id].js","pages/inventory.js",
                "components/NpcPanel.js","components/MapPageClient.js",
                "components/character/CharacterInteractionPanel.js",
                "components/MerchantPanel.js","utils/useWallet.js"])
  assert.doesNotMatch(src(p),/actorRequestEpochCandidate|createNonMapActorEpochCandidate/,
    "T28 must remain unmounted research: "+p);
});

test("T28-P01 actual race ordering model: old signed shop response after logout RED; candidate GREEN",async()=>{
 const old= pending(),guard=createNonMapActorEpochCandidate(),display={stock:null};
 guard.observeActor("gm");guard.selectMerchant("merchant-a");
 const ticket=guard.capture("stock");
 const unsafe=old.promise.then(rows=>{display.stock=rows;});
 const safe=old.promise.then(rows=>guard.settle(ticket,()=>{display.stock=rows;}));
 guard.observeActor(null);
 old.release([{id:"old-private-stock"}]);
 await unsafe;
 assert.deepEqual(display.stock,[{id:"old-private-stock"}],
  "T28 original without epoch allows a stale state update in this controlled model");
 display.stock=null;
 assert.equal(await safe,false,"Stale signed stock must not be applied by candidate");
 assert.equal(display.stock,null);
});

test("T28-P02 merchant switch invalidates stock but not same-actor wallet",()=>{
 const g=createNonMapActorEpochCandidate();g.observeActor("user-a");
 g.selectMerchant("shop-1");const oldStock=g.capture("stock"),wallet=g.capture("wallet");
 g.selectMerchant("shop-2");
 assert.equal(g.isCurrent(oldStock),false);
 assert.equal(g.isCurrent(wallet),true);
 const newStock=g.capture("stock");assert.equal(g.isCurrent(newStock),true);
});

test("T28-P03 logout then login same actor cannot revive old wallet/stock generations",()=>{
 const g=createNonMapActorEpochCandidate();g.observeActor("gm");g.selectMerchant("m");
 const w=g.capture("wallet"),s=g.capture("stock");
 g.observeActor(null);g.observeActor("gm");g.selectMerchant("m");
 assert.equal(g.isCurrent(w),false);assert.equal(g.isCurrent(s),false);
 assert.equal(g.isCurrent(g.capture("wallet")),true);
 assert.equal(g.isCurrent(g.capture("stock")),true);
});

test("T28-P04 actor switch invalidates both wallet refresh and merchant stock",async()=>{
 const d=pending(),g=createNonMapActorEpochCandidate(),state={gp:0,stock:[]};
 g.observeActor("account-a");g.selectMerchant("merchant-a");
 const walletTicket=g.capture("wallet"),shopTicket=g.capture("stock");
 const walletPending=d.promise.then(v=>g.settle(walletTicket,()=>{state.gp=v.gp;}));
 const stockPending=d.promise.then(v=>g.settle(shopTicket,()=>{state.stock=v.stock;}));
 g.observeActor("account-b");g.selectMerchant("merchant-a");
 d.release({gp:73,stock:[{name:"old-account-item"}]});
 assert.deepEqual(await Promise.all([walletPending,stockPending]),[false,false]);
 assert.deepEqual(state,{gp:0,stock:[]});
});

test("T28-P05 explicit permission revocation invalidates; no anon tickets",()=>{
 const g=createNonMapActorEpochCandidate();
 assert.equal(g.capture("wallet"),null);assert.equal(g.capture("stock"),null);
 g.observeActor("editor");g.selectMerchant("merchant-a");
 const ticket=g.capture("stock");g.revoke();
 assert.equal(g.isCurrent(ticket),false);assert.equal(g.capture("wallet"),null);
});

test("T28-P06 dispose, forged token and invalid scope fail closed",()=>{
 const g=createNonMapActorEpochCandidate();g.observeActor("gm");g.selectMerchant("m");
 const t=g.capture("stock");assert.equal(g.isCurrent({...t,owner:Symbol("fake")}),false);
 assert.throws(()=>g.capture("unknown"),/unknown request scope/);
 let wrote=0;assert.equal(g.settle(t,()=>{wrote++;}),true);
 g.dispose();assert.equal(g.settle(t,()=>{wrote++;}),false);assert.equal(wrote,1);
 assert.equal(g.observeActor("new"),false);assert.equal(g.selectMerchant("m"),false);
 assert.equal(g.capture("stock"),null);
});
