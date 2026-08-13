import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_82_hunter_prey_runtime.sql", "utf8");
const panel = fs.readFileSync("components/CharacterHunterPreyPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const parser = fs.readFileSync("utils/classFeatureChoiceParsing.js", "utf8");
const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const need=(source,token,label=token)=>{if(!source.includes(token))throw new Error(`Missing Hunter's Prey contract (${label}): ${token}`)};
const forbid=(source,token,label=token)=>{if(source.includes(token))throw new Error(`Forbidden Hunter's Prey crossover (${label}): ${token}`)};

for (const token of [
  "hunter_prey_options_v1","class_feature_catalog","jsonb_path_query","upper(coalesce(f.class_source,''))='XPHB'","lower(coalesce(f.subclass_name,''))='hunter'","lower(f.name)='hunter''s prey'",
  "hunter_prey_context_v1","upper(coalesce(v_class.source,''))<>'XPHB'","upper(coalesce(v_progression.subclass_source,''))<>'XPHB'","sync_hunter_prey_projection_v1","runtimeFeatures,huntersPrey",
  "get_character_hunter_prey_v1","configure_character_hunter_prey_v1","private.can_manage_character_progression_v1","private.character_active_encounter_v1","rest_type in ('short_rest','long_rest')",
  "ranger-hunter-hunters-prey","short_or_long_rest","configuredBy','initial_selection'","configuredBy','rest_replacement'","Finish a newer Short Rest or Long Rest before changing Hunter''s Prey.",
  "The PHB Hunter''s Prey choice remains permanent Forge/progression authority","revoke all on function public.get_character_hunter_prey_v1(uuid) from public,anon","revoke all on function public.configure_character_hunter_prey_v1(uuid,text) from public,anon"
]) need(migration,token);

for (const token of ["get_character_hunter_prey_v1","configure_character_hunter_prey_v1","p_prey_key","XPHB Hunter runtime","Hunter&apos;s Prey","Current option","Short Rest or Long Rest","Change Prey","selectedKey","selectedOption","PHB Hunter&apos;s Prey choice stays permanent Forge/progression authority"]) need(panel,token);
for (const token of ['import CharacterHunterPreyPanel from "./CharacterHunterPreyPanel";','<CharacterHunterPreyPanel characterId={characterId} />']) need(host,token);

need(parser,"restReconfigurableText","edition-sensitive source-text rest classification");
need(parser,"changesAtRest","Short/Long Rest replacement detection");
need(parser,'if (classFeatureChoiceCadence(row) !== "creation") return false;',"runtime rows excluded from option-node creation");
need(parser,'if (!description || runtimeOnlyChoice(row)) return false;',"runtime prose excluded from permanent choice text");
need(choices,'.filter((group) => group.cadence === "creation"',"permanent Forge choice output remains creation-only");
forbid(parser,'"hunter\'s prey"',"Hunter's Prey must remain edition-sensitive instead of hard-coded runtime cadence");

for (const source of [migration,panel,host]) for (const token of ["MapPageClient","map_routes","advance_all_characters","player_wallets"]) forbid(source,token);
for (const token of ["update public.character_progression","update public.inventory_items","insert into public.inventory_items","delete from public.inventory_items","extraAttack","colossusSlayerDamage","resolve_attack","combat_action"]) forbid(migration,token);
forbid(migration,"expiresAtNextQualifyingRest","Hunter's Prey persists across rests until changed");
console.log("Hunter's Prey edition split validated: PHB remains permanent Forge authority; XPHB gets source-derived immediate selection plus persistent Short/Long-Rest replacement, encounter lock, ACLs, host wiring, and protected boundaries.");
