import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261025_01_optional_campaign_attunement_setting.sql","utf8");
const admin=fs.readFileSync("pages/admin.js","utf8");
const ui=fs.readFileSync("components/AdminAttunementSetting.js","utf8");
const fixture=fs.readFileSync("scripts/fixtures/optional_attunement_setting_behavior.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/validate-optional-attunement-setting.yml","utf8");
for(const token of ["attunement_enabled boolean not null default false",
"attunement_max_items smallint not null default 3","attunement_max_items = 3",
"public.set_campaign_attunement_rule_v1","auth.uid() is null",
"private.current_user_is_admin()","security definer",
"from public, anon, authenticated","to authenticated",
"false::boolean,false::boolean"]){
 assert.ok(sql.toLowerCase().includes(token.toLowerCase()),"Missing policy/ACL: "+token);
}
for(const token of ['<AdminAttunementSetting />','import AdminAttunementSetting']) assert.ok(admin.includes(token));
for(const token of ['"campaign_item_pool_settings"','"attunement_enabled,attunement_max_items"',
'"set_campaign_attunement_rule_v1"','role="switch"','checked={enabled}',
'disabled={!loaded || loadFailed || saving}',
'requestInFlight.current','does not currently disable any equipped magic items or bonuses']){
 assert.ok(ui.includes(token),"Missing honest, safe admin control: "+token);
}
for(const token of ["Anonymous call toggled","Player toggled","three-item config","Null rule","future_tech_enabled"]) assert.ok(fixture.includes(token));
for(const token of ["scripts/fixtures/optional_attunement_setting_behavior.sql","scripts/validate_optional_attunement_setting.mjs","sql/20261025_01_optional_campaign_attunement_setting.sql"]){
 assert.ok(workflow.includes(token),"Missing workflow tracking: "+token);
}
assert.ok(!sql.includes("update public.inventory_items"));
assert.ok(!sql.includes("character_equipment_effects_v1"));
assert.ok(!sql.includes("unlimited_attunement_enabled"));
console.log("OFF-by-default optional attunement admin setting source contract passed.");
