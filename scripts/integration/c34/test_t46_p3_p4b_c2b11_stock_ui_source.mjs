// C34 B11 source-only acceptance for ephemeral stock UI cutover.
// Verifies BOTH genuine checked-in merchant variants, not production behavior.
// Signed PG17/Chromium acceptance is a separate mandatory B11 gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildB11StockUiOverlay} from "./candidates/t46_p3_p4b_c2b11_stock_ui_overlay.mjs";
import {buildB11BraceOverlay} from "./candidates/t46_p3_p4b_c2b11_brace_pending_rpc_overlay.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const cases=[
  {name:"original",file:"components/MerchantPanel.js",guarded:false},
  {name:"guarded",file:"components/c34/MerchantPanelT28P2Research.jsx",guarded:true}
];
for(const c of cases){
  const original=fs.readFileSync(path.join(root,c.file));
  const src=buildB11StockUiOverlay(original,{guarded:c.guarded});
  assert.match(src,/p_action:"add"/);
  assert.match(src,/p_action:"remove"/);
  assert.match(src,/p_action:"dump"/);
  assert.match(src,/p_expected:expected/);
  assert.match(src,/p_expected:snapshot/);
  assert.match(src,/getUser\(\)/);
  assert.match(src,/b11Current\(b11Scope\)/);
  assert.match(src,/const b11Matches =/);
  assert.match(src,/c34-b11-stock-controls/);
  assert.match(src,/c34-b9-stock-controls/);
  assert.match(src,/Return to Profile/);
  assert.match(src,/c34_t46_manage_stock_qty_v1/);
  assert.match(src,/Server reroll RPC required; shelf unchanged/);
  assert.doesNotMatch(src,/\.from\(["']character_stock["']\)\s*\.(?:insert|update|delete)\s*\(/);
  assert.doesNotMatch(src,/supabase\.rpc\("stock_merchant_item"/);
  assert.doesNotMatch(src,/await rerollThemedFallback\(\)/,
    "B11 missing reroll RPC must not attempt browser fallback");
  // B11-BRACE composes on the accepted B11, but adds epoch-scoped
  // UI lifecycle only in disposable research. The original RED stays.
  const brace=buildB11BraceOverlay(original,{guarded:c.guarded});
  assert.match(brace,/b11AuthOverrideRef/);
  assert.match(brace,/b11ScopeRef.current.epoch/);
  assert.match(brace,/b11Pending\(b11Ticket\)/);
  assert.match(brace,/b11Finish\(b11Ticket\)/);
  assert.match(brace,/__b11BraceDebug/);
  assert.match(brace,/c34_t46_manage_merchant_stock_v1/);
  assert.doesNotMatch(brace,/\.from\(["']character_stock["']\)\s*\.(?:insert|update|delete)\s*\(/);
  assert.doesNotMatch(brace,/supabase\.rpc\("stock_merchant_item"/);
  assert.throws(()=>buildB11BraceOverlay(Buffer.concat([original,Buffer.from("drift")]),{guarded:c.guarded}),/blob drift/);
  console.log("PASS T46-C2B11-BRACE-SOURCE-"+c.name.toUpperCase()+
    ": exact source+sign-in epochs+merchant/request tickets, no direct stock DML");
  assert.ok(original.toString("utf8").includes('stock_merchant_item'),
    "B11 original RED missing");
  assert.ok(original.toString("utf8").includes('.delete()'),
    "B11 original direct stock write RED missing");
  assert.throws(()=>buildB11StockUiOverlay(Buffer.concat([original,Buffer.from("\n// drift\n")]),{guarded:c.guarded}),/blob drift/,
    "B11 source pin must fail closed");
  assert.throws(()=>buildB11StockUiOverlay(original,{guarded:!c.guarded}),/blob drift/,
    "B11 mixing original and guarded modes must fail closed");
  console.log("PASS T46-C2B11-STATIC-"+c.name.toUpperCase()+": source pin and original unsafe RED preserved, ephemeral atomic add/remove/dump composed, no direct stock DML");
}
console.log("PASS T46-C2B11-STATIC-SOURCE: source-only check, NO signed browser, SQL cutover, main merge or production claim");
