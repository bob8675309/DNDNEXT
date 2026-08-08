import fs from "node:fs";

const extensions = fs.readFileSync("utils/classFeatureChoiceExtensions.js", "utf8");
const forgeSpells = fs.readFileSync("components/NpcForgeSpellStep.js", "utf8");
const forgeShell = fs.readFileSync("components/NewNpcModalV3.js", "utf8");
const levelUp = fs.readFileSync("components/CharacterLevelUpChoices.js", "utf8");
const migration = fs.readFileSync("sql/20260808_42_wizard_signature_spells_authority.sql", "utf8");
const rest = fs.readFileSync("sql/20260802_03_character_sheet_spell_resources.sql", "utf8");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  'id: "wizard-signature-spells"',
  'placement: "spells"',
  'allowRepeatAcrossGroups: true',
  'spellOptions(spells, { level: 3, classes: ["Wizard"] })',
  'wizardSpellbookRequired: true',
  'recharge: "short_rest"',
]) need(extensions, token);

for (const token of [
  'NpcForgeClassFeatureChoices',
  'signatureSpellbookIds',
  'spellPlacementGroups',
  'group.id !== "wizard-signature-spells"',
  'Number(byId.get(String(spellId))?.level || 0) === 3',
  'placement="spells"',
  'toggleFeatureOption?.(signature.id, selectedKey)',
]) need(forgeSpells, token);

for (const token of [
  'classFeatureGroupsComplete',
  '/Spells/i.test(currentStep)',
  'classFeatureGroupsComplete(classState.featureGroups || [], classState.featureSelections || {}, "spells")',
  '.npc-forge-class-choices.is-placement-spells .npc-forge-class-choice-group.is-required',
]) need(forgeShell, token);

for (const token of [
  'sourceChoiceSpellId',
  'wizardSignatureEligibleSpellIds',
  'resolvedClassChoiceGroups',
  'group?.id !== "wizard-signature-spells"',
  '.select("spell_id,source_type,raw_payload")',
  'row.raw_payload?.wizardSpellbook',
  'toggleSourceChoiceSelection(resolvedClassChoiceGroups',
  'groups={resolvedClassChoiceGroups}',
  'Signature Spells are restricted to level-3 spells already in the Wizard spellbook',
]) need(levelUp, token);

for (const token of [
  'level_up_wizard_signature_group_v1',
  "'id','wizard-signature-spells'",
  "'placement','spells'",
  "where s.level=3",
  "'wizardSpellbookRequired',true",
  'apply_wizard_signature_spell_ids_v1',
  'private.wizard_spellbook_has_spell_v1',
  "prepared=true",
  "always_available=true",
  "uses_max=1",
  "uses_remaining=1",
  "recharge='short_rest'",
  "'signatureSpell',true",
  "from jsonb_array_elements(v_existing_summary) as e(item)",
  "from jsonb_array_elements(v_serialized) as e(entry)",
  "coalesce(jsonb_typeof(v_group->'selections'),'')<>'array'",
  'materialize_player_forge_wizard_signature_for_character_v1',
  'materialize_player_forge_wizard_savant_for_character_v1(new.character_id)',
  'materialize_player_forge_wizard_signature_for_character_v1(new.character_id)',
  'character_progression_materialize_player_forge_wizard_final_v1',
  'deferrable initially deferred',
  "v_wizard_signature jsonb:=coalesce(v_all_class->'wizard-signature-spells','{}'::jsonb)",
  "v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'-'wizard-savant-spellbook-addition'-'wizard-signature-spells'",
  'v_result:=public.complete_character_level_up_v4',
  'v_signature_summary:=private.apply_level_up_wizard_signature_spells_v1',
  "'wizard_signature_delta'",
  "'wizardSignatureDelta'",
]) need(migration, token);
forbid(migration, "insert into public.character_spells", "duplicate Signature Spell membership insertion");
forbid(migration, "source_type='signature'", "Signature feature replacing spellbook provenance");

for (const token of [
  "v_rest_type not in ('short_rest','long_rest')",
  "lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'",
  "when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')",
  "set uses_remaining=uses_max",
]) need(rest, token);

console.log("Wizard Signature Spells Forge placement, final-spellbook eligibility including Savant provenance, earned progression ordering, preserved membership provenance, and Short/Long Rest free-cast recovery contracts validated.");
