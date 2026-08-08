import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "sql/20260808_35_eldritch_invocation_level_replacement.sql"), "utf8");
const need = (token, label = token) => {
  if (!source.includes(token)) throw new Error(`Eldritch Invocation replacement is missing ${label}.`);
};
const forbid = (token, label = token) => {
  if (source.includes(token)) throw new Error(`Eldritch Invocation replacement must not contain ${label}.`);
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
  "if jsonb_typeof(v_sheet->'sourceChoices')<>'object' then",
  "v_sheet:=jsonb_set(v_sheet,'{sourceChoices}','{}'::jsonb,true)",
  "v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'",
  "v_result:=public.complete_character_level_up_v4",
  "v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v1",
  "v_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb)",
  "invocation_replacement_selection",
  "grant execute on function public.complete_character_level_up_v5",
]) need(token);

forbid("v_pending_key:=p_all_class_selections#>array[v_pending_group,'invocation']->>0", "unparenthesized pending Invocation JSON extraction");
forbid("set option_catalog_id=v_new.id,\n      acquired_level=", "replacement rewriting the original acquisition level");
forbid("grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated", "authenticated v4 completion bypass");

console.log("Safe Eldritch Invocation replacement, current-state validation, Lessons reversal, and v5 transaction contracts validated.");
