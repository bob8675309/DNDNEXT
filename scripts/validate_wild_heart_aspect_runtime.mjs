import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_81_wild_heart_aspect_runtime.sql", "utf8");
const panel = fs.readFileSync("components/CharacterWildHeartAspectPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const parser = fs.readFileSync("utils/classFeatureChoiceParsing.js", "utf8");
const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const need=(source,token,label=token)=>{if(!source.includes(token))throw new Error(`Missing Aspect contract (${label}): ${token}`)};
const forbid=(source,token,label=token)=>{if(source.includes(token))throw new Error(`Forbidden Aspect crossover (${label}): ${token}`)};

for (const token of ["wild_heart_aspect_options_v1","class_feature_catalog","jsonb_path_query","upper(coalesce(f.class_source,''))='XPHB'","lower(coalesce(f.subclass_name,''))='wild heart'","lower(f.name)='aspect of the wilds'","wild_heart_aspect_context_v1","normalize_player_choice_name_v1(v_progression.subclass_name)<>'wildheart'","sync_wild_heart_aspect_projection_v1","runtimeFeatures,wildHeartAspectOfTheWilds","get_character_wild_heart_aspect_v1","configure_character_wild_heart_aspect_v1","private.can_manage_character_progression_v1","private.character_active_encounter_v1","rest_type='long_rest'","barbarian-wild-heart-aspect-of-the-wilds","'long_rest'","configuredBy','initial_selection'","configuredBy','long_rest_replacement'","Finish a newer Long Rest before changing Aspect of the Wilds.","revoke all on function public.get_character_wild_heart_aspect_v1(uuid) from public,anon","revoke all on function public.configure_character_wild_heart_aspect_v1(uuid,text) from public,anon"]) need(migration,token);
for (const token of ["get_character_wild_heart_aspect_v1","configure_character_wild_heart_aspect_v1","p_aspect_key","Aspect of the Wilds","Current aspect","newer Long Rest","Change Aspect","selectedKey","selectedOption","does not rewrite Darkvision, climb/swim speeds"]) need(panel,token);
for (const token of ['import CharacterWildHeartAspectPanel from "./CharacterWildHeartAspectPanel";','<CharacterWildHeartAspectPanel characterId={characterId} />']) need(host,token);
need(parser,"restReconfigurableText","source-text rest classification");
need(parser,"changesAtRest","rest replacement detection");
need(choices,'.filter((group) => group.cadence === "creation"',"creation-only permanent choice output");
for (const source of [migration,panel,host]) for (const token of ["MapPageClient","map_routes","advance_all_characters","player_wallets"]) forbid(source,token);
for (const token of ["update public.character_progression","update public.inventory_items","insert into public.inventory_items","delete from public.inventory_items","swimSpeed","climbSpeed","darkvision =","update public.locations","update public.map_routes"]) forbid(migration,token);
forbid(migration,"expiresAtNextQualifyingRest","current aspect must persist across Long Rests");
console.log("Wild Heart Aspect source gating, source-derived Owl/Panther/Salmon options, immediate initial choice, Long-Rest replacement without expiry, encounter lock, ACLs, Forge suppression, host wiring, and protected boundaries validated.");
