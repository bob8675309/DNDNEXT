import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_72_cartomancer_runtime.sql", "utf8");
const stateFix = fs.readFileSync("sql/20260809_73_cartomancer_runtime_state_fix.sql", "utf8");
const normalization = fs.readFileSync("utils/featSourceChoiceNormalization.js", "utf8");
const panel = fs.readFileSync("components/CharacterCartomancerPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing Cartomancer contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden Cartomancer crossover: ${token}`); };

for (const token of [
  'featName === "cartomancer"',
  '"Prestidigitation|XPHB"',
  'normalizedChoiceShape: "cartomancer-fixed-prestidigitation-runtime-hidden-ace"',
  'runtimeFeature: "cartomancer-hidden-ace"',
]) need(normalization, token);

for (const token of [
  "'{cartomancerFixedSpells}'",
  "'{additionalSpells}'",
  "cartomancer_family_v1",
  "cartomancer_feature_key_v1",
  "cartomancer_character_context_v1",
  "cartomancer_hidden_ace_spell_options_v1",
  "character_spell_slots",
  "s.slot_level=s.level",
  "css.slots_max>0",
  "lower(coalesce(entry.value->>'unit',''))='action'",
  "coalesce((entry.value->>'number')::integer,0)=1",
  "character_option_grant_instance_cartomancer_v1",
  "Cartomancer • Card Tricks",
  "source_type='feat'",
  "Prestidigitation",
  "character_rest_log_expire_cartomancer_hidden_ace_v1",
  "new.rest_type<>'long_rest'",
  "interval '8 hours'",
  "get_character_cartomancer_v1",
  "configure_character_cartomancer_hidden_ace_v1",
  "character_active_encounter_v1",
  "actionIntegration','deferred'",
  "runtimeFeatures,cartomancerHiddenAce",
  "revoke all on function public.get_character_cartomancer_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_cartomancer_hidden_ace_v1(uuid,text,uuid) from public,anon",
]) need(migration, token);

for (const token of [
  "v_had_runtime boolean:=false",
  "v_had_runtime:=found",
  "'hiddenAceConfigured',v_had_runtime",
  "case when v_had_runtime then v_runtime.state else '{}'::jsonb end",
]) need(stateFix, token);

for (const token of [
  "get_character_cartomancer_v1",
  "configure_character_cartomancer_hidden_ace_v1",
  "Prestidigitation learned",
  "Imbue Hidden Ace",
  "Selection authority only.",
  "Bonus Action casting and card consumption are intentionally deferred",
]) need(panel, token);

for (const token of [
  'import CharacterCartomancerPanel from "./CharacterCartomancerPanel";',
  '<CharacterCartomancerPanel characterId={characterId} />',
]) need(host, token);

for (const source of [migration, stateFix, normalization, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const source of [migration, stateFix]) {
  for (const token of [
    "update public.encounter_participants",
    "insert into public.encounter_participants",
    "insert into public.inventory_items",
  ]) forbid(source, token);
}
for (const token of [
  "cast_character_cartomancer",
  "consume_cartomancer",
  "Bonus Action to cast",
]) forbid(migration, token);

console.log("Cartomancer fixed Prestidigitation, class-list/slot-gated Hidden Ace selection, 8-hour runtime state, deterministic getter state, ACLs, and protected action boundary validated.");
