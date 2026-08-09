import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_79_bestial_soul_runtime.sql", "utf8");
const resolverFix = fs.readFileSync("sql/20260809_80_bestial_soul_option_resolver_fix.sql", "utf8");
const panel = fs.readFileSync("components/CharacterBestialSoulPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const parser = fs.readFileSync("utils/classFeatureChoiceParsing.js", "utf8");
const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const need = (source, token, label = token) => { if (!source.includes(token)) throw new Error(`Missing Bestial Soul contract (${label}): ${token}`); };
const forbid = (source, token, label = token) => { if (source.includes(token)) throw new Error(`Forbidden Bestial Soul crossover (${label}): ${token}`); };

for (const token of ["bestial_soul_context_v1","upper(coalesce(f.class_source,''))='PHB'","lower(coalesce(f.subclass_name,''))='beast'","upper(coalesce(f.source,''))='TCE'","lower(f.name)='bestial soul'","v_progression.subclass_source","character_class_feature_acquired_at_v1","'barbarian','PHB'","sync_bestial_soul_projection_v1","runtimeFeatures,bestialSoul","get_character_bestial_soul_v1","configure_character_bestial_soul_v1","private.can_manage_character_progression_v1","private.character_active_encounter_v1","rest_type in ('short_rest','long_rest')","v_latest_rest>v_acquired_at","v_latest_rest<=v_runtime.replacement_anchor_at","barbarian-beast-bestial-soul","short_or_long_rest","expiresAtNextQualifyingRest","configuredBy','rest_selection'","The always-on magical natural-weapon clause is not stored as a choice.","revoke all on function public.get_character_bestial_soul_v1(uuid) from public,anon","revoke all on function public.configure_character_bestial_soul_v1(uuid,text) from public,anon"]) need(migration, token);

for (const token of ["bestial_soul_options_v1","class_feature_catalog","jsonb_path_query",'@.type == "list"',"items[*]","swimming speed","climbing speed","when you jump","regexp_replace","'swimming'","'climbing'","'jumping'","revoke all on function private.bestial_soul_options_v1() from public,anon,authenticated"]) need(resolverFix, token, `resolver fix ${token}`);

for (const token of ["get_character_bestial_soul_v1","configure_character_bestial_soul_v1","p_benefit_key","Bestial Soul","Rest adaptation","Expired at latest rest","Short Rest or Long Rest","Choose Benefit","selectedKey","selectedOption","does not rewrite base movement values"]) need(panel, token);
for (const token of ['import CharacterBestialSoulPanel from "./CharacterBestialSoulPanel";','<CharacterBestialSoulPanel characterId={characterId} />']) need(host, token);
need(parser, "REST_RECONFIGURABLE_FEATURES", "rest-configurable feature set");
need(parser, "restReconfigurableText", "source-text rest classification");
need(parser, "changesAtRest", "rest choice text detection");
need(parser, 'description.toLowerCase().includes("short rest") ? "short-rest" : "long-rest"', "Short/Long Rest cadence classification");
need(choices, '.filter((group) => group.cadence === "creation"', "creation-only permanent class-choice output");
for (const source of [migration,resolverFix,panel,host]) for (const token of ["MapPageClient","map_routes","advance_all_characters","player_wallets"]) forbid(source,token);
for (const token of ["update public.character_progression","update public.inventory_items","insert into public.inventory_items","delete from public.inventory_items","swimSpeed","climbSpeed","walking_speed"]) { forbid(migration,token); forbid(resolverFix,token); }
console.log("Bestial Soul PHB/TCE source gating, list-item option resolution, post-acquisition Short/Long-Rest selection, next-rest expiry semantics, encounter lock, ACLs, text-derived Forge suppression, host wiring, and protected boundaries validated.");
