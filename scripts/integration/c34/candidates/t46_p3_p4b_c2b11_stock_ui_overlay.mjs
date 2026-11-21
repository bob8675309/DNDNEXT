// C34 T46-P3-P4B-C2-B11: test-only source-locked stock UI cutover.
// Import only from local disposable tests. NEVER import into gameplay or deploy.
// B9 retains original signed quantity/reroll negatives; B10 supplies the
// separate uninstalled atomic add/remove/dump RPC in local PG17 only.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {buildMerchantReturnToProfile} from "./t46_p3_p4a_composed_overlays.mjs";
import {buildB9StockUiOverlay} from "./t46_p3_p4b_c2b9_reroll_source.mjs";

export const B11_SOURCE_BLOBS = Object.freeze({
  original:"22e4d0810603bc0322904573cb5fe0c14bad1f88",
  guarded:"32c808c78f56767a19c1fcfd4f64c961755a8cf1"
});
const gitBlob=bytes=>createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\0"),bytes
])).digest("hex");
const exactlyOne=(s,anchor,label)=>{
  assert.equal(s.split(anchor).length,2,"B11 "+label+" source drift");
  return s.indexOf(anchor);
};
function replaceRegion(src,begin,end,newText,label){
  const a=exactlyOne(src,begin,label+" begin");
  const z=src.indexOf(end,a+begin.length);
  assert.ok(z>a,"B11 "+label+" end missing");
  assert.equal(src.indexOf(end,z+end.length),-1,"B11 "+label+" end ambiguous");
  return src.slice(0,a)+newText+src.slice(z);
}
function replaceExact(src,before,after,label){
  exactlyOne(src,before,label);
  return src.replace(before,after);
}
export function buildB11StockUiOverlay(fileBytes,{guarded=false}={}){
  assert.ok(Buffer.isBuffer(fileBytes),"B11 requires exact source bytes");
  assert.equal(gitBlob(fileBytes),guarded?B11_SOURCE_BLOBS.guarded:B11_SOURCE_BLOBS.original,
    "B11 original merchant blob drift; stop before modifying any files");
  // The original nonmap Town route already used this separately sourced
  // Return-to-Profile overlay in its B2 signed fixture; no map edits.
  let src=fileBytes.toString("utf8");
  if(!guarded)src=buildMerchantReturnToProfile(src);
  src=buildB9StockUiOverlay(src,guarded);

  const scope=`  // B11 disposable UI scope. The signed RPC remains authoritative for
  // role/merchant checks; this only prevents late client state commits.
  const b11ScopeRef = useRef(null);
  b11ScopeRef.current = {actor: uid || null, merchant: merchant?.id || null};
  const b11Matches = s => Boolean(s.actor && s.merchant &&
    b11ScopeRef.current.actor === s.actor &&
    b11ScopeRef.current.merchant === s.merchant);
  async function b11Current(s){
    if(!b11Matches(s))return false;
    const {data,error}=await supabase.auth.getUser();
    return !error && data?.user?.id === s.actor && b11Matches(s);
  }
`;
  src=replaceExact(src,"  const [stock, setStock] = useState([]);\n",
    "  const [stock, setStock] = useState([]);\n"+scope,"actor/merchant ticket");

  const common=`      const b11Scope = {actor:uid,merchant:merchant?.id};
      if(!(await b11Current(b11Scope)))
        throw new Error("Merchant stock action requires the current signed actor");
`;
  const settle=`      if(!(await b11Current(b11Scope))) return;
`;
  const atomic=(action,fields)=>`      const {error:b11Error}=await supabase.rpc("c34_t46_manage_merchant_stock_v1", {
        p_merchant_id:b11Scope.merchant,p_action:"${action}",${fields}
      });
      if(b11Error)throw b11Error;
`;

  src=replaceRegion(src,
    "      const { error } = await supabase\n        .from(\"character_stock\")\n        .delete()\n        .eq(\"character_id\", merchant.id);",
    "      await fetchStock();",
    common+`      const snapshot=[...stock].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
`+atomic("dump","p_expected:snapshot")+settle,
    "atomic dump");

  src=replaceRegion(src,
    "      let rpc = await supabase.rpc(\"stock_merchant_item\", {",
    "      setRestockText(\"\");",
    common+atomic("add","p_display_name:display_name,p_price_gp:price_gp,\n        p_qty:qty,p_payload:payload")+settle,
    "atomic add");

  src=replaceRegion(src,
    "      const { error } = await supabase\n        .from(\"character_stock\")\n        .delete()\n        .eq(\"id\", stockId);",
    "      await fetchStock();",
    common+`      const expected=stock.find(row=>row.id===stockId);
      if(!expected)throw new Error("Stock row no longer exists; refresh");
`+atomic("remove","p_stock_id:stockId,p_expected:expected")+settle,
    "atomic remove");

  // Remove, rather than merely hide, the old independent HTTP DELETE/INSERT
  // reroll fallback from the ephemeral candidate. A missing RPC fails closed.
  src=replaceRegion(src,
    "  async function rerollThemedFallback() {",
    "  async function setMerchantRouteFallback(",
    "  async function rerollThemedFallback() {\n"+
    "    throw new Error(\"Server reroll RPC required; shelf unchanged\");\n"+
    "  }\n\n",
    "reroll browser fallback");

  // B9 inserted its own test-only click controls. B11 adds a remove control
  // because the original storefront has no direct per-row remove button.
  const controls=`      <div data-testid="c34-b11-stock-controls">
        {stock.map(entry => <button type="button" key={entry.id}
          data-testid={"c34-b11-remove-"+entry.id}
          disabled={busyId !== null}
          onClick={() => removeRow(entry.id)}>
          Remove B11 {entry.display_name}
        </button>)}
      </div>
`;
  src=replaceExact(src,
    "      <div data-testid=\"c34-b9-stock-controls\"",
    controls+"      <div data-testid=\"c34-b9-stock-controls\"","B11 button");

  // Fail if any direct stock mutations survive the composed research source.
  assert.ok(!/\.from\(["']character_stock["']\)\s*\.(?:insert|delete|update)\s*\(/.test(src),
    "B11 direct REST stock mutation survived");
  assert.ok(!/\.from\(["']character_stock["']\)\s*\.delete\(\)/.test(src),
    "B11 stock DELETE survived");
  assert.ok(!src.includes('supabase.rpc("stock_merchant_item"'),
    "B11 obsolete add RPC survived");
  assert.match(src,/c34_t46_manage_stock_qty_v1/);
  assert.match(src,/c34_t46_manage_merchant_stock_v1/);
  assert.match(src,/Server reroll RPC required; shelf unchanged/);
  return src;
}
