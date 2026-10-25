import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261024_08_attunement_gm_review_and_transfer_invalidation.sql","utf8");
const fixture=fs.readFileSync("scripts/fixtures/attunement_gm_review_and_transfer_behavior.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/validate-campaign-attunement-policy.yml","utf8");
for(const x of [
"private.attunement_focus_gm_reviews_v1","private.attunement_focus_rest_links_v1",
"private.invalidate_attunement_focus_on_transfer_v1","'invalidated'","rest_logged_unverified",
"reviewed_by uuid not null","gm_reason text not null","security invoker",
"private.current_user_is_admin()","private.can_manage_character_progression_v1",
"for update","private.assert_character_resource_not_active_v1",
"'attunementReady',false","'canCreateBond',false",
"revoke all on function private.review_attunement_focused_rest_v1",
"grant execute on function private.review_attunement_focused_rest_v1",
"to service_role"
]) assert.ok(sql.includes(x),"GM review missing contract "+x);
for(const x of [
"Player forged GM approval","Service without admin principal",
"GM approved interrupted attempt","GM approved same-rest identification",
"Review succeeded during active encounter","GM review failed closed-state contract",
"Review replay was not idempotent","Approved GM decision was overwritten",
"Transfer failed to invalidate both completed attempts",
"Transfer out and back resurrected focus",
"GM adjudication wrote an attunement bond",
"Private review function/table grants unsafe"
]) assert.ok(fixture.includes(x),"Missing GM review behavioral regression "+x);
for(const x of [
"20261024_08_attunement_gm_review_and_transfer_invalidation.sql",
"attunement_gm_review_and_transfer_behavior.sql",
"validate_attunement_gm_review.mjs"
]) assert.ok(workflow.includes(x),"Missing CI "+x);
assert.ok(!sql.includes("insert into public.character_item_attunements"));
console.log("GM review, custody history, audit and hard-stop contract passes.");
