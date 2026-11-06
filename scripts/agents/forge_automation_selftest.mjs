#!/usr/bin/env node
// In-memory tests only; no model, network, live DB or GitHub token.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOriginalInventory, scanFixtureTriggers, compareCoverage } from "./forge_trigger_audit.mjs";
import { buildLedger } from "./forge_trigger_acceptance_ledger.mjs";
import { diagnose } from "./forge_ci_diagnostics.mjs";
const receipts=JSON.parse(readFileSync("scripts/agents/forge_trigger_acceptance_receipts.json","utf8"));
assert.equal(receipts.receipts.length,2);
const sources=[
 ["characters_guard_player_tags_v1","guard_player_character_tag_update_v1","b8b0008a718de1aa3e74d66b30f1a679"],
 ["sync_character_portrait_library_id_v1","sync_character_portrait_library_id_v1","74cb0bf9d7a614a860344f12cf787e05"]
];
const rows=[],counts={character_progression:19,character_sheets:4,characters:6,inventory_items:2};
for(const [table,n] of Object.entries(counts)){
 for(let i=0;i<n;i++){
  const s=table==="characters"&&i<2?sources[i]:[table+"_test_"+i,"handler_"+i,"a".repeat(32)];
  rows.push("| \`"+table+"\` | \`"+s[0]+"\` | \`"+s[1]+"\` | \`"+s[2]+"\` | Immediate | Not staged |");
 }
}
const original=parseOriginalInventory(rows.join("\n"));
const sql="CREATE TRIGGER characters_guard_player_tags_v1 BEFORE UPDATE OF tags ON public.characters FOR EACH ROW EXECUTE FUNCTION private.guard_player_character_tag_update_v1();\n"+
"CREATE TRIGGER sync_character_portrait_library_id_v1 BEFORE INSERT OR UPDATE OF portrait_source ON public.characters FOR EACH ROW EXECUTE FUNCTION private.sync_character_portrait_library_id_v1();";
const staged=scanFixtureTriggers(sql,"fixture.sql"),coverage=compareCoverage(original,staged);
const l=buildLedger(coverage,receipts);
assert.equal(l.original,31);assert.equal(l.staged,2);assert.equal(l.individualJWTReceipts,2);
const stale=structuredClone(receipts);stale.receipts[0].sourceMd5="f".repeat(32);
assert.throws(()=>buildLedger(coverage,stale),/fingerprint drift/);
assert.throws(()=>buildLedger(compareCoverage(original,staged.slice(0,1)),receipts),/no longer staged/);
const failure=diagnose("PASS J125 source\nPASS J126 JWT\nAssertionError [ERR_ASSERTION]\n");
assert.equal(failure.lastPassJ,126);assert.equal(failure.category,"assertion");
assert.equal(failure.terminalJ141Seen,false);
assert.equal(diagnose("PASS J141 done\nPASS LOCAL REAL GoTrue J00-J141").terminalJ141Seen,true);
assert.equal(diagnose("PASS J141 source hash verified\nPASS LOCAL REAL GoTrue J00-J141").category,"test-terminal-marker-seen");
console.log("PASS no-cost original Forge ledger and sanitized diagnostic self-tests");
