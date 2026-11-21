// C34 B9: exact repository October 16 function extraction, original RED and
// minimal seller-first/roles candidate. Never import this into runtime.
// The source SQL is pinned by GIT BLOB; no hosted function-body parity asserted.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

export const OCT16_REROLL_BLOB="c804ccd4ea3c1746ad114daa18af8f173bf02128";
const blob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const singleReplace=(source,before,after)=>{
 assert.equal(source.split(before).length,2,"B9 source anchor drift: "+before.slice(0,55));
 return source.replace(before,after);
};
export function sourceOriginalB9Reroll(fileBytes){
 assert.ok(Buffer.isBuffer(fileBytes));
 assert.equal(blob(fileBytes),OCT16_REROLL_BLOB,
  "B9 refuses replacement of original October 16 historical SQL");
 const src=fileBytes.toString("utf8");
 const from=src.indexOf("CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2(");
 const end=src.indexOf("\n$$;",from);
 assert.ok(from>0&&end>from);
 const original=src.slice(from,end+4);
 assert.match(original,/DELETE FROM public\.character_stock WHERE character_id=p_merchant_id;/);
 assert.match(original,/INSERT INTO public\.character_stock\(character_id,display_name,price_gp,qty,card_payload,item_id,note\)/);
 assert.match(original,/coalesce\(up\.role='admin',false\)/);
 assert.ok(!original.includes("FOR UPDATE"),"Original historical reroll already gained seller lock");
 const eligibleStart=src.indexOf("CREATE OR REPLACE FUNCTION private.item_is_future_tech_v1(");
 assert.ok(eligibleStart>0&&eligibleStart<from);
 const selectionHelpers=src.slice(eligibleStart,from);
 return {original,selectionHelpers};
}
export function buildB9LockedReroll(original){
 assert.match(original,/RETURNS TABLE\(inserted_count integer, theme text, merchant_id uuid\)/);
 let candidate=singleReplace(original,
  "SELECT coalesce(up.role='admin',false)",
  "SELECT coalesce(up.role IN ('admin','gm','dm'),false)");
 candidate=singleReplace(candidate,
  "  IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Only admins can reroll merchant stock'; END IF;",
  `  IF NOT coalesce(v_is_admin,false) THEN
    RAISE EXCEPTION 'Game manager required to reroll merchant stock' USING ERRCODE='42501';
  END IF;

  -- B9 only: exclusive seller lock FIRST. This serializes rerolls and blocks
  -- original guarded buyers' seller FOR SHARE until the new shelf commits.
  -- It also blocks B8 quantity managers (seller FOR SHARE) before stock locks.
  -- NO state, route, campsite, location or storefront-visibility restriction:
  -- owner permits trade while moving and camping; hidden seller buys remain
  -- denied independently by unchanged B2 buyer guard.
  PERFORM 1 FROM public.characters c
    WHERE c.id=p_merchant_id AND c.kind='merchant' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merchant required to reroll stock' USING ERRCODE='42501';
  END IF;`);
 assert.ok(candidate.indexOf("FOR UPDATE")<candidate.indexOf("DELETE FROM public.character_stock"),
  "B9 reroll lock must precede stock deletion");
 assert.ok(!/WHERE c\.(state|location_id|route_id)/.test(candidate));
 assert.equal(candidate.replace("SELECT coalesce(up.role IN ('admin','gm','dm'),false)",
  "SELECT coalesce(up.role='admin',false)").includes("CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2("),true);
 return candidate;
}
export function buildB9StockUiOverlay(src){
 // Takes already composed Return-to-Profile overlay. Never persisted into game.
 // Preserve original functions in the research branch: ONLY replace at test runtime.
 const pin=(before,after)=>{
   src=singleReplace(src,before,after);
 };
 pin(`    const qty = Math.max(0, Number(nextQty || 0));
    const { error } = await supabase
      .from("character_stock")
      .update({ qty })
      .eq("id", stockId);
    if (error) throw error;`,
 `    const current = stock.find((r) => r.id === stockId);
    if (!current) throw new Error("Stock row no longer available");
    const qty = Math.max(0, Number(nextQty || 0));
    const { error } = await supabase.rpc("c34_t46_manage_stock_qty_v1", {
      p_stock_id: stockId, p_mode: "set", p_value: qty,
      p_expected_qty: current.qty, p_expected_updated_at: current.updated_at
    });
    if (error) throw error;`);
 pin("      await changeQty(stockId, (row.qty || 0) + by);",
 `      const { error } = await supabase.rpc("c34_t46_manage_stock_qty_v1", {
        p_stock_id: stockId, p_mode: "delta", p_value: by
      });
      if (error) throw error;`);
 pin("      await changeQty(stockId, Math.max(0, (row.qty || 0) - by));",
 `      const { error } = await supabase.rpc("c34_t46_manage_stock_qty_v1", {
        p_stock_id: stockId, p_mode: "delta", p_value: -by
      });
      if (error) throw error;`);
 // An RPC denial is NEVER permission to delete shelf rows from the browser.
 pin("      if (isMissingFunctionError(e)) {",
     "      if (false && isMissingFunctionError(e)) {");
 const anchor='      <div className="merchant-admin-grid">';
 const injected=`      <div data-testid="c34-b9-stock-controls" className="merchant-admin-stock-list">
        {stock.map((entry) => (
          <div data-testid={"c34-b9-stock-" + entry.id} key={entry.id}>
            <span>{entry.display_name}: {entry.qty} in stock</span>
            <button type="button" aria-label={"Add one " + entry.display_name}
              onClick={() => incQty(entry.id)} disabled={busyId !== null}>+</button>
            <button type="button" aria-label={"Remove one " + entry.display_name}
              onClick={() => decQty(entry.id)} disabled={busyId !== null}>−</button>
            <button type="button" aria-label={"Set two " + entry.display_name}
              onClick={async () => {
                setBusyId("set:" + entry.id); setErr("");
                try { await changeQty(entry.id,2); await fetchStock(); }
                catch (error) { setErr(error.message || "Stock changed"); }
                finally { setBusyId(null); }
              }} disabled={busyId !== null}>Set 2</button>
          </div>
        ))}
      </div>
`+anchor;
 pin(anchor,injected);
 assert.match(src,/p_mode: "delta"/);
 assert.match(src,/p_expected_updated_at/);
 assert.ok(src.includes("Return to Profile"));
 return src;
}
