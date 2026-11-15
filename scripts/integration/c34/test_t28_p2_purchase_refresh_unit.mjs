#!/usr/bin/env node
// C34 T28-P2 actual derived merchant handleBuy contract.
// Executes the function extracted from the source-derived merchant component,
// without inventing a parallel implementation. No real DB or browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const original=readFileSync(path.join(root,"components/c34/MerchantPanelT28P2Research.jsx"),"utf8");
const beginning=original.indexOf("  async function handleBuy(card) {");
const ending=original.indexOf("  // Paste helper",beginning);
assert.ok(beginning>=0 && ending>beginning,"source-derived buy function moved");
const functionBody=original.slice(beginning,ending);
// Preserve an independently executed ORIGINAL RED: the unchanged merchant's
// own handleBuy reports a failed purchase after the server accepted payment
// when only its follow-up wallet read rejects. No browser/DB mutation here.
const untouchedSource=readFileSync(path.join(root,"components/MerchantPanel.js"),"utf8");
const untouchedStart=untouchedSource.indexOf("  async function handleBuy(card) {");
const untouchedEnd=untouchedSource.indexOf("  // Paste helper",untouchedStart);
assert.ok(untouchedStart>=0 && untouchedEnd>untouchedStart);
const untouchedHandler=untouchedSource.slice(untouchedStart,untouchedEnd);
assert.match(untouchedHandler,/await Promise\.all\(\[fetchStock\(\), refreshWallet\(\)\]\)/);
const originalBuy=new Function(
 "uid","setBusyId","setErr","setNotice","supabase","merchant",
 "fetchStock","refreshWallet","console",untouchedHandler+"\nreturn handleBuy;"
);

assert.match(functionBody,/supabase\.rpc\("buy_from_merchant"/);
assert.match(functionBody,/await Promise\.allSettled\(\[fetchStock\(\), refreshWallet\(\)\]\)/);
assert.doesNotMatch(functionBody,/await Promise\.all\(\[fetchStock\(\), refreshWallet\(\)\]\)/);
const build=new Function(
 "uid","stockGuardRef","purchaseInFlightRef","setBusyId","setErr","setNotice",
 "supabase","merchant","fetchStock","refreshWallet","console",
 functionBody+"\nreturn handleBuy;"
);
const card={id:"item-1",item_name:"Example Elixir",_price_gp:12};
const make=({buyer=()=>Promise.resolve({data:1,error:null}),stock=async()=>{},
 wallet=async()=>{},uid="gm",actor=null,merchantId="merchant-1",purchaseRef=null}={})=>{
 const session=actor||{actorId:"gm",actorEpoch:5,merchantId:"merchant-1",merchantEpoch:7};
 const inFlight=purchaseRef||{current:null};
 const notices=[],errors=[],busy=[],rpc=[];
 const handleBuy=build(
  uid,{current:{snapshot:()=>({...session})}},inFlight,
  v=>busy.push(v),v=>errors.push(v),v=>notices.push(v),
  {rpc:async(name,args)=>{rpc.push({name,args});return buyer(name,args)}},
  {id:merchantId},stock,wallet,{error:()=>{}}
 );
 return {handleBuy,session,purchaseRef:inFlight,notices,errors,busy,rpc};
};

// Original source RED: RPC succeeded, follow-up wallet_get fails, but original
// UI incorrectly says the purchase failed. This is an expected negative baseline.
{
 const notices=[];
 const buy=originalBuy("gm",()=>{},()=>{},v=>notices.push(v),
  {rpc:async()=>({data:1,error:null})},{id:"merchant-1"},
  async()=>{},async()=>{throw Error("temporary wallet_get failure")},{error:()=>{}});
 await buy(card);
 assert.equal(notices.at(-1)?.kind,"error","original source negative drift");
 assert.match(notices.at(-1)?.message,/temporary wallet_get failure/);
 console.log("PASS T28-P2-BUY-ORIGINAL-RED: original accepted buyer falsely reports failure after wallet refresh error");
}

// (R01) Original buyer succeeds but wallet re-read fails: NOT a failed purchase.
{
 const c=make({wallet:async()=>{throw Error("temporary wallet_get failure")}});
 await c.handleBuy(card);
 assert.equal(c.rpc.length,1);
 assert.equal(c.rpc[0].name,"buy_from_merchant");
 assert.equal(c.notices.length,1);
 assert.equal(c.notices[0].kind,"success");
 assert.match(c.notices[0].message,/Purchased Example Elixir for 12 gp/);
 assert.match(c.notices[0].message,/balance could not be refreshed/);
 assert.ok(!c.notices.some(n=>n?.kind==="error"),"RPC success cannot become purchase failed");
 assert.equal(c.busy.at(-1),null);
 console.log("PASS T28-P2-BUY-R01: committed purchase remains success if wallet display refresh fails");
}
// (R02) Original buyer itself rejects: no success and no refresh attempts.
{
 let attempts=0;
 const c=make({buyer:async()=>({data:null,error:new Error("Insufficient funds")}),
  stock:async()=>{attempts++},wallet:async()=>{attempts++}});
 await c.handleBuy(card);
 assert.equal(c.notices.at(-1)?.kind,"error");
 assert.match(c.notices.at(-1)?.message,/Insufficient funds/);
 assert.equal(attempts,0);
 assert.equal(c.busy.at(-1),null);
 console.log("PASS T28-P2-BUY-R02: rejected original buyer produces only true transaction error");
}
// (R03) Original buyer succeeded but actor logged out before HTTP response:
// never display an old buyer's purchase result or run new actor refreshes.
{
 let complete;
 let refreshes=0;
 const c=make({buyer:()=>new Promise(resolve=>{complete=resolve}),
  stock:async()=>{refreshes++},wallet:async()=>{refreshes++}});
 const pending=c.handleBuy(card);
 c.session.actorId=null;
 c.session.actorEpoch++;
 complete({data:1,error:null});
 await pending;
 assert.equal(refreshes,0);
 assert.equal(c.notices.length,0);
 console.log("PASS T28-P2-BUY-R03: accepted late buyer response cannot publish after logout");
}
// (R04) Server succeeded; async refresh resolves after switching merchant.
// No success or error notice goes to the new shop.
{
 let finishRefresh;
 const c=make({wallet:()=>new Promise(resolve=>{finishRefresh=resolve})});
 const pending=c.handleBuy(card);
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(typeof finishRefresh,"function");
 c.session.merchantId="merchant-2";c.session.merchantEpoch++;
 finishRefresh(55);
 await pending;
 assert.equal(c.notices.length,0);
 console.log("PASS T28-P2-BUY-R04: old shop success UI blocked after merchant switch");
}
// (R05) All operations work, do not display a spurious wallet refresh warning.
{
 const c=make();
 await c.handleBuy(card);
 assert.equal(c.notices.at(-1)?.kind,"success");
 assert.doesNotMatch(c.notices.at(-1)?.message,/could not be refreshed/);
 console.log("PASS T28-P2-BUY-R05: normal buyer success retains original success message");
}
// (R06) Buyer committed; CURRENT stock fetch rejected. Never claim the
// purchase failed or leave an apparently up-to-date shelf without warning.
{
 const c=make({stock:async()=>({committed:false,current:true,error:Error("stock unavailable")})});
 await c.handleBuy(card);
 assert.equal(c.rpc.length,1);
 assert.equal(c.notices.at(-1)?.kind,"success");
 assert.match(c.notices.at(-1)?.message,/Stock could not be refreshed/);
 assert.ok(!c.notices.some(n=>n?.kind==="error"));
 console.log("PASS T28-P2-BUY-R06: committed purchase survives stock read error with clear retry warning");
}
// (R07) Two clicks before React can commit busyId must issue exactly one
// original buy_from_merchant RPC in the SAME actor/merchant generation.
{
 let resolveBuy;
 const c=make({buyer:()=>new Promise(resolve=>{resolveBuy=resolve})});
 const first=c.handleBuy(card);
 const duplicate=c.handleBuy(card);
 assert.equal(c.rpc.length,1,"two rapid Buy clicks submitted two live RPCs");
 assert.ok(c.purchaseRef.current,"purchase token must be set synchronously");
 resolveBuy({data:1,error:null});
 await Promise.all([first,duplicate]);
 assert.equal(c.rpc.length,1);
 assert.equal(c.purchaseRef.current,null,"purchase lock must clear after completion");
 console.log("PASS T28-P2-BUY-R07: same-scope rapid double-click submits exactly one purchase");
}
// (R08) A delayed old merchant must not block or unlock a new merchant's
// purchase after a shop change while the original HTTP response is still held.
{
 let resolveOld,resolveNew;
 const c=make({buyer:()=>new Promise(resolve=>{resolveOld=resolve})});
 const old=c.handleBuy(card);
 assert.equal(c.rpc.length,1);
 c.session.merchantId="merchant-2";c.session.merchantEpoch++;
 const replacement=make({
  buyer:()=>new Promise(resolve=>{resolveNew=resolve}),
  actor:c.session,merchantId:"merchant-2",purchaseRef:c.purchaseRef
 });
 const newer=replacement.handleBuy({...card,id:"item-2"});
 assert.equal(replacement.rpc.length,1,"old merchant must not block fresh shop");
 const token=replacement.purchaseRef.current;
 resolveOld({data:1,error:null});
 await old;
 assert.equal(replacement.purchaseRef.current,token,
  "old merchant completion cleared new merchant's purchase lock");
 await replacement.handleBuy({...card,id:"item-2"});
 assert.equal(replacement.rpc.length,1,
  "old merchant completion allowed duplicate new merchant purchase");
 resolveNew({data:1,error:null});
 await newer;
 assert.equal(c.purchaseRef.current,null);
 console.log("PASS T28-P2-BUY-R08: old merchant pending purchase cannot block/unlock new merchant");
}
console.log("PASS T28-P2-BUY-UNIT: derived original-buyer handler distinguishes committed transactions from display refresh and rapid double-click");
