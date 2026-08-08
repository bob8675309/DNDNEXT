import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "sql/20260808_35_eldritch_invocation_level_replacement.sql"), "utf8");
const repair = fs.readFileSync(path.join(root, "sql/20260808_36_fix_invocation_replacement_source_choices_parent.sql"), "utf8");
const projection = fs.readFileSync(path.join(root, "sql/20260808_37_sync_eldritch_invocation_sheet_projection.sql"), "utf8");
const need = (haystack, token, label = token) => {
  if (!haystack.includes(token)) throw new Error(`Eldritch Invocation replacement is missing ${label}.`);
};
const forbid = (haystack, token, label = token) => {
  if (haystack.includes(token)) throw new Error(`Eldritch Invocation replacement must not contain ${label}.`);
};

for (const token of [
  "validate_existing_normalized_warlock_invocations_v2",
  "after insert on public.character_progression",
  "after update of class_id,class_level,level_choices on public.character_progression",
  "level_up_warlock_invocation_replacement_group_v1",
  "warlock-invocation-replacement",
  "'ownerType','class-option'",
  "'required',false",
  "whenever you gain a warlock level",
  "replace one of your invocations",
  "another current Invocation cannot be replaced",
  "apply_level_up_warlock_invocation_replacement_v1",
  "remove_source_owned_origin_feat_v1",
  "apply_source_owned_origin_feat_v1",
  "acquisitionOwnerKey'='warlock-invocation-replacement'",
  "v_pending_key:=(p_all_class_selections#>array[v_pending_group,'invocation'])->>0",
  "requires % to be known on the completed level",
  "dependent.instance_key<>v_target_key",
  "lastReplacementLevel",
  "previousOptionKey",
  "v_target.acquired_level",
  "v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'",
  "v_result:=public.complete_character_level_up_v4",
  "v_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb)",
  "invocation_replacement_selection",
  "grant execute on function public.complete_character_level_up_v5",
]) need(source, token);

for (const token of [
  "ensure_character_source_choices_v1",
  "jsonb_typeof(v_sheet->'sourceChoices') is distinct from 'object'",
  "v_sheet:=jsonb_set(v_sheet,'{sourceChoices}','{}'::jsonb,true)",
  "apply_level_up_warlock_invocation_replacement_v2",
  "perform private.ensure_character_source_choices_v1(p_character_id)",
  "return private.apply_level_up_warlock_invocation_replacement_v1",
  "v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2",
  "revoke all on function private.apply_level_up_warlock_invocation_replacement_v1(uuid,integer,jsonb,jsonb,jsonb) from service_role",
]) need(repair, token, `effective legacy-parent repair token ${token}`);

for (const token of [
  "sync_character_eldritch_invocations_v1",
  "join public.character_class_option_grant_instances",
  "g.option_type='eldritch-invocation'",
  "jsonb_agg(o.name order by g.instance_key)",
  "v_sheet:=jsonb_set(v_sheet,'{eldritchInvocations}',v_names,true)",
  "v_result:=public.complete_character_level_up_v4",
  "perform private.sync_character_eldritch_invocations_v1(p_character_id)",
  "grant execute on function public.complete_character_level_up_v5",
]) need(projection, token, `final normalized Invocation projection token ${token}`);

const v4Index = projection.indexOf("v_result:=public.complete_character_level_up_v4");
const projectionIndex = projection.indexOf("perform private.sync_character_eldritch_invocations_v1(p_character_id)");
if (v4Index < 0 || projectionIndex < 0 || projectionIndex <= v4Index) {
  throw new Error("Final Invocation sheet projection must run after v4 applies required new Invocation slots.");
}

forbid(source, "v_pending_key:=p_all_class_selections#>array[v_pending_group,'invocation']->>0", "unparenthesized pending Invocation JSON extraction");
forbid(source, "set option_catalog_id=v_new.id,\n      acquired_level=", "replacement rewriting the original acquisition level");
forbid(source, "grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated", "authenticated v4 completion bypass");
forbid(repair, "jsonb_typeof(v_sheet->'sourceChoices')<>'object'", "NULL-unsafe sourceChoices parent check");
forbid(projection, "p_selections#>'{class_choice_selections}'", "sheet projection from submitted choices instead of normalized Invocation authority");

console.log("Safe Eldritch Invocation replacement, current-state validation, reversible Lessons ownership, legacy sourceChoices repair, final normalized sheet projection, and v5 transaction contracts validated.");
