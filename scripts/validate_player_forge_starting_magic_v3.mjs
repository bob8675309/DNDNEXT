import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const sharedForge = read("components/NewNpcModalV3.js");
const derived = read("components/useNpcForgeDerivedModel.js");
const spellStep = read("components/NpcForgeSpellStep.js");
const spellSources = read("utils/playerForgeSpellSources.js");
const migration = read("sql/20260808_47_player_forge_starting_magic_v3_completion.sql");
const aclMigration = read("sql/20260808_48_player_forge_v3_acl_cleanup.sql");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "playerForgeProxySpellChoices",
  'String(entry?.source_type || "class") === "class"',
  'String(entry?.access_type || "class-list") !== "background-expanded"',
  'supabase.rpc("create_player_character_v3"',
  "p_spell_choices: proxySpellChoices",
  "p_magic_selections: magicSelections",
  "payload?.sheet?.startingMagicSelections",
]) need(sharedForge, token);
forbid(sharedForge, 'supabase.rpc("create_player_character_v2"', "frontend stopping at v2");

for (const token of [
  'import { serializeStartingMagicSelections } from "../utils/playerForgeSpellSources";',
  "const startingMagicSelections = serializeStartingMagicSelections",
  'String(entry?.source_type || "class") === "class"',
  "startingMagicSelections",
  "backgroundExpandedSpells",
]) need(derived, token);

for (const token of [
  "startingSpellSourceForRow",
  "sourceType: source.sourceType",
  "accessType: source.accessType",
  "subclassStartingSpellSelectionModel",
  "Background-expanded access",
]) need(spellStep, token);

for (const token of [
  "serializeStartingMagicSelections",
  "model?.fixedSpells",
  'source_type: choice.sourceType || model?.sourceType || "class"',
  "source_key: choice.sourceKey",
  "access_type: choice.accessType || null",
  'access_type: "fixed"',
  'name: "Mage Hand"',
]) need(spellSources, token);

for (const token of [
  "create or replace function public.create_player_character_v3",
  "public.create_player_character_v2(p_payload, v_proxy)",
  "coalesce(cs.raw_payload ->> 'creator', '') = 'shared_character_forge_player_v2'",
  "public.is_preferred_spell_version_v1",
  "Duplicate starting magic spell selections are not allowed.",
  "v_access_type = 'background-expanded'",
  "v_source_type = 'subclass'",
  "lower(v_class.class_key) = 'fighter'",
  "lower(v_class.class_key) = 'rogue'",
  "v_name='mage hand'",
  "source_label,known,prepared,always_available,casting_stat,raw_payload",
  "'creator','shared_character_forge_player_v3'",
  "'startingMagic',true",
  "create or replace function private.validate_player_forge_starting_spells_v1",
  "v_v3 := v_sheet ? 'startingMagicSelections'",
  "v_background_expanded := coalesce(v_sheet->'backgroundExpandedSpells'",
  "v_class_level>=3",
  "v_cantrips_required := case when lower(v_class_key)='fighter'",
  "when v_class_level=3 then 3",
  "when v_class_level in (19,20) then 12 + case when v_class_level=20 then 1 else 0 end",
  "Arcane Trickster starting magic requires the fixed Mage Hand cantrip exactly once.",
  "coalesce((cs.raw_payload->>'startingMagic')::boolean,false)",
]) need(migration, token);

for (const token of [
  "revoke execute on function public.create_player_character_v3(jsonb,jsonb,jsonb) from public, anon;",
  "grant execute on function public.create_player_character_v3(jsonb,jsonb,jsonb) to authenticated, service_role;",
]) need(aclMigration, token);

forbid(migration, "delete from public.character_spells where character_id = v_character_id;", "broad deletion of all spell sources");
forbid(migration, "v_source_type = 'species'", "species spells routed through v3 Spell-step authority");
forbid(migration, "v_source_type = 'feat'", "feat spells routed through v3 Spell-step authority");
forbid(`${migration}\n${aclMigration}`, "MapPageClient", "world-map crossover");
forbid(`${migration}\n${aclMigration}`, "map_routes", "world-route crossover");
forbid(`${migration}\n${aclMigration}`, "weather", "world-weather crossover");

console.log("Player Forge v3 native-class, Background-expanded, subclass, fixed-spell, proxy-compatibility, exactness, authenticated-only ACL, and protected-boundary contracts validated.");
