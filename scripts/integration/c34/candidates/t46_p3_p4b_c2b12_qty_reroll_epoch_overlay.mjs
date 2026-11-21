// C34 C2-B12: source-locked TEMPORARY B8 quantity/B9 reroll action epoch.
// Generate only inside disposable CI; do not import into gameplay.
import assert from "node:assert/strict";
import {buildB11BraceOverlay} from "./t46_p3_p4b_c2b11_brace_pending_rpc_overlay.mjs";

function one(source,before,after,label){
 assert.equal(source.split(before).length,2,"B12 source drift: "+label);
 return source.replace(before,after);
}
function region(source,start,end,replacement,label){
 assert.equal(source.split(start).length,2,"B12 begin drift "+label);
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(b>a,"B12 end drift "+label);
 return source.slice(0,a)+replacement+source.slice(b);
}
export function buildB12CommerceEpochOverlay(originalBytes,{guarded=false}={}){
 let src=buildB11BraceOverlay(originalBytes,{guarded});
 // One manager ticket spans the RPC, error, stock read and finally.
 // An already committed signed RPC is NOT cancelled by logout.
 const qtyMethods=`  async function changeQty(stockId,nextQty,ticket) {
    if(!b11Pending(ticket)||!(await b11Current(ticket)))return;
    const current=stock.find(row=>row.id===stockId);
    if(!current)throw new Error("Stock row no longer available");
    const qty=Math.max(0,Number(nextQty||0));
    const {error}=await supabase.rpc("c34_t46_manage_stock_qty_v1",{
      p_stock_id:stockId,p_mode:"set",p_value:qty,
      p_expected_qty:current.qty,p_expected_updated_at:current.updated_at
    });
    if(!b11Pending(ticket)||!(await b11Current(ticket)))return;
    if(error)throw error;
    await fetchStock();
  }
  async function b12Delta(stockId,delta,label){
    const ticket=b11Start(label+":"+stockId);
    if(!ticket)return;
    try{
      if(!(await b11Current(ticket)))return;
      const row=stock.find(r=>r.id===stockId);
      if(!row)return;
      const {error}=await supabase.rpc("c34_t46_manage_stock_qty_v1",{
        p_stock_id:stockId,p_mode:"delta",p_value:delta
      });
      if(!b11Pending(ticket)||!(await b11Current(ticket)))return;
      if(error)throw error;
      await fetchStock();
    }catch(error){
      if(b11Pending(ticket)){console.error(error);
        setErr(error.message||"Quantity update failed");}
    }finally{b11Finish(ticket);}
  }
  async function incQty(stockId,by=1){
    return b12Delta(stockId,by,"inc");
  }
  async function decQty(stockId,by=1){
    return b12Delta(stockId,-by,"dec");
  }
  async function b12Set(stockId,qty){
    const ticket=b11Start("set:"+stockId);
    if(!ticket)return;
    try{await changeQty(stockId,qty,ticket);}
    catch(error){
      if(b11Pending(ticket)){console.error(error);
        setErr(error.message||"Stock changed");}
    }finally{b11Finish(ticket);}
  }

`;
 src=region(src,"  async function changeQty(stockId, nextQty) {",
   "  async function removeRow(stockId) {",qtyMethods,"B8 quantity methods");
 const oldSet=`onClick={async () => {
                setBusyId("set:" + entry.id); setErr("");
                try { await changeQty(entry.id,2); await fetchStock(); }
                catch (error) { setErr(error.message || "Stock changed"); }
                finally { setBusyId(null); }
              }}`;
 src=one(src,oldSet,`onClick={() => b12Set(entry.id,2)}`,
  "B8 inline CAS onClick");

 const role=guarded?"mayManageCommerce":"isAdmin";
 const reroll=`  // B12: retain server-selection/rarity; no browser fallback.
  async function rerollThemed() {
    if(!${role}){
      alert("Only game managers can reroll merchant stock.");
      return;
    }
    const ticket=b11Start("reroll");
    if(!ticket)return;
    try{
      if(!(await b11Current(ticket)))return;
      // Exact original count range and three-arg call. B10 separately
      // validates source-default two-arg DB signature compatibility.
      const desiredCount=28+Math.floor(Math.random()*5);
      const {data,error}=await supabase.rpc("reroll_merchant_inventory_v2",{
        p_merchant_id:ticket.merchant,p_theme:theme,p_count:desiredCount
      });
      if(!b11Pending(ticket)||!(await b11Current(ticket)))return;
      if(error)throw error;
      const count=Array.isArray(data)?data?.[0]?.inserted_count:data?.inserted_count;
      if(typeof count==="number"&&count===0){
        setErr("Reroll returned 0 items; check eligible catalog/theme.");
      }
      await fetchStock();
    }catch(error){
      if(b11Pending(ticket)){
        console.error(error);setErr(error.message||"Reroll failed");
      }
    }finally{b11Finish(ticket);}
  }

`;
 src=region(src,"  async function rerollThemed() {",
   "  async function setTradeRoute() {",reroll,"B9 reroll");
 assert.match(src,/p_mode:"delta"/);
 assert.match(src,/p_mode:"set"/);
 assert.match(src,/p_expected_updated_at:current.updated_at/);
 assert.match(src,/b11Start\("reroll"\)/);
 assert.match(src,/b11Pending\(ticket\)/);
 assert.match(src,/p_count:desiredCount/);
 assert.match(src,/return b12Delta\(stockId,-by,"dec"\)/);
 assert.ok(!src.includes("rerollThemedFallback();"),
   "B12 forbids browser DELETE/INSERT reroll fallback");
 assert.ok(!/\.from\(["']character_stock["']\)\s*\.(?:insert|delete|update)\(/.test(src),
   "B12 forbids direct stock DML");
 return src;
}
