import fs from "node:fs";
import assert from "node:assert/strict";
const read = path => fs.readFileSync(path, "utf8");
const sql = read("sql/20261024_02_campaign_attunement_policy.sql");
const admin = read("pages/admin.js");
const panel = read("components/CharacterAttunementPanel.js");
const sheet = read("components/CharacterSheetPanel.js");
const fixture = read("scripts/fixtures/campaign_attunement_policy_behavior.sql");
const docs = read("docs/Campaign_Attunement_Policy_Status_2026-10-24.md");

for (const target of [
  "character_item_attunements","primary key(character_id,inventory_item_id)",
  "unique(inventory_item_id)","private.item_requires_attunement_v1",
  "public.set_campaign_unlimited_attunement_v1",
  "public.get_character_attunement_items_v1",
  "public.set_character_item_attunement_v1",
  "Three attunement slots are already occupied",
  "Cannot attune to two copies of the same magic item",
  "clear_transferred_item_attunement",
  "pg_advisory_xact_lock",
  "private.can_access_character_v1",
  "private.current_user_is_admin",
  "revoke all on public.character_item_attunements",
]) assert.ok(sql.includes(target), `Missing server guard: ${target}`);

for(const forbidden of [
  "alter table public.inventory_items add column is_attuned",
  "update public.inventory_items set is_equipped",
  "update public.inventory_items set equip_slot",
  "drop table public.inventory_items",
]) assert.ok(!sql.toLowerCase().includes(forbidden), `Equipment ownership/slot drift: ${forbidden}`);

for(const [source,terms] of [
  [admin,["Future weapons &amp; armor","Attunement capacity","Unlimited attunement","set_campaign_unlimited_attunement_v1","unlimited_attunement_enabled"]],
  [panel,["get_character_attunement_items_v1","set_character_item_attunement_v1","isAttuned","canManage"]],
  [sheet,["CharacterAttunementPanel","characterId={characterId} canManage={editable}"]],
  [fixture,["Fourth bond allowed under standard rules","Over-cap downgrade silently accepted","Transfer retained old item bond","Attunement modified equipment slot"]],
  [docs,["draft","Short Rest","attunement","equip_slot"]],
]) for (const term of terms) assert.ok(source.includes(term), `Missing UI/test/docs contract: ${term}`);

console.log("Campaign attunement source contracts pass. Behavioral proof requires PostgreSQL CI.");
