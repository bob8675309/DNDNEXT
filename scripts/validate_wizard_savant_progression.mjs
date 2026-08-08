import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = fs.readFileSync(path.join(root, "sql/20260808_40_wizard_savant_spellbook_progression.sql"), "utf8");
const correction = fs.readFileSync(path.join(root, "sql/20260808_41_wizard_savant_forge_chronology.sql"), "utf8");
const source = `${base}\n${correction}`;
const need = (input, token, label = token) => {
  if (!input.includes(token)) throw new Error(`Wizard Savant progression is missing ${label}.`);
};
const forbid = (input, token, label = token) => {
  if (input.includes(token)) throw new Error(`Wizard Savant progression must not contain ${label}.`);
};

for (const token of [
  "wizard_savant_school_v1",
  "when 'abjurer' then 'Abjuration'",
  "when 'diviner' then 'Divination'",
  "when 'evoker' then 'Evocation'",
  "when 'illusionist' then 'Illusion'",
  "wizard_spellbook_has_spell_v1",
  "cs.source_type='class'",
  "cs.source_type='class-feature'",
  "wizardSpellbook",
  "validate_wizard_spellbook_uniqueness_v1",
  "deferrable initially deferred",
  "level_up_wizard_savant_group_v1",
  "v_next_max<=v_current_max",
  "s.level between 1 and v_next_max",
  "Savant spellbook additions — applies to Abjurer, Diviner, Evoker, or Illusionist",
  "apply_level_up_wizard_savant_v1",
  "v_expected:=2",
  "v_expected:=1",
  "v_spell.school<>v_school",
  "private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id)",
  "'class-feature',v_group_key,v_feature_name,true,false,false,'int'",
  "'wizardSpellbook',true",
  "'wizard_savant_delta'",
  "v_wizard_savant:=private.level_up_wizard_savant_group_v1",
  "v_wizard_summary:=private.apply_level_up_wizard_savant_v1",
  "-'wizard-savant-spellbook-addition'",
  "v_result:=public.complete_character_level_up_v4",
  "grant execute on function public.complete_character_level_up_v5",
]) need(source, token);

for (const token of [
  "Wizard spellbook entries must be level 1+ spells",
  "s.level between 1 and 2",
  "p_to_level=3 and not(v_spell.level between 1 and 2)",
  "(cs.source_type='class' and s.level>=1)",
]) need(correction, token);
forbid(correction, "between 0 and 2", "level-0 Savant spellbook legality");
forbid(source, "'class',v_group_key,v_feature_name", "Savant stored as ordinary base-Wizard class rows");
forbid(source, "grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated", "authenticated v4 completion bypass");

const applyIndex = base.indexOf("v_wizard_summary:=private.apply_level_up_wizard_savant_v1");
const v4Index = base.indexOf("v_result:=public.complete_character_level_up_v4");
if (applyIndex < 0 || v4Index < 0 || applyIndex >= v4Index) {
  throw new Error("Wizard Savant spellbook additions must materialize before delegated v4 completes the level transition.");
}

console.log("Wizard Savant level-1+ spellbook provenance, school legality, slot-level cadence, duplicate protection, and v5 transaction contracts validated.");
