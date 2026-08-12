import { Fragment } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, CLASS_DEFINITIONS, FEAT_OPTIONS, SIZE_OPTIONS, SKILL_DEFINITIONS, SPECIES_DEFINITIONS, standardAbilityScores } from "../utils/characterCreation";
import { safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { speciesVariantChoiceBinding, speciesVariantUsesCatalogSubmenu } from "../utils/speciesCatalogFamilyMenu";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

export const NPC_STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"]);
export const PLAYER_STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Spells", "Equipment", "Identity", "Story", "Review"]);
// Legacy NPC step-order source markers: step === 5 Identity; step === 6 Story
// const STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"]);
// Historical contract retained for handoff readers: "Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"
export const EMPTY_PROFESSIONS = Object.freeze(Object.fromEntries(PROFESSION_KEYS.map((key) => [key, {
  rank: 0,
  ability: PROFESSION_DEFINITIONS[key].abilities[0],
  offersService: false,
}])));

export function createRequestId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(-4);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${s4().slice(1)}-${s4()}${s4()}${s4()}`;
}

export function initialDraft() {
  return {
    creationRequestId: createRequestId(),
    name: "", gender: "neutral", kind: "npc", role: "", affiliation: "",
    speciesOptionId: "", backgroundOptionId: "", classOptionId: "", speciesKey: "",
    customSpecies: "", lineage: "", size: "", alignment: "N", languagesText: "Common",
    appearance: "", backgroundKey: "custom", customBackground: "", backgroundFeatId: "",
    backgroundSkillChoices: {}, classKey: "civilian", level: 1, abilityMethod: "4d6",
    baseAbilities: standardAbilityScores("civilian"),
    speciesBonus: { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], featId: "" },
    selectedClassSkills: [], expertiseSkills: [], professions: JSON.parse(JSON.stringify(EMPTY_PROFESSIONS)),
    spellSelections: {}, startingEquipment: {}, additionalFeats: [], extraTraits: [], preparedSpellsText: "", attacks: "", equipment: "",
    treasure: "", description: "", backgroundNarrative: "", motivation: "", personalityTraits: "",
    ideals: "", bonds: "", flaws: "", quirk: "", mannerism: "", voice: "", secret: "",
    tags: [], locationId: "", storefrontEnabled: true, storefrontTitle: "", storefrontTagline: "",
    portraitLibraryId: "", portraitName: "", portraitUrl: "", portraitStoragePath: "", portraitThumbUrl: "", portraitShopUrl: "", portraitSource: "",
    visualAssetId: "", spriteKey: "", spritePath: "", spriteScale: 0.7, spriteAsset: null,
  };
}

export function titleForSkill(key) { return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key; }
export function abilityModifier(score) { return Math.floor((Number(score || 10) - 10) / 2); }
export function proficiencyBonus(level) { return 2 + Math.floor((Math.max(1, Number(level || 1)) - 1) / 4); }
export function maximumHitPoints(hitDie, level, constitutionScore) {
  const die = Math.max(4, Number(hitDie || 8));
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const conModifier = abilityModifier(constitutionScore);
  return Math.max(1, die + conModifier) + Math.max(0, resolvedLevel - 1) * Math.max(1, Math.floor(die / 2) + 1 + conModifier);
}
export function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Unknown";
}
export function standardScoresForClass(classRow) {
  if (CLASS_DEFINITIONS[classRow?.class_key]) return standardAbilityScores(classRow.class_key);
  const priorities = uniqueText([...(classRow?.primary_abilities || []), "con", "dex", "wis", "int", "cha", "str"]).filter((key) => ABILITY_KEYS.includes(key));
  const values = [15, 14, 13, 12, 10, 8];
  const scores = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 10]));
  priorities.slice(0, 6).forEach((key, index) => { scores[key] = values[index]; });
  return scores;
}
export function speciesTraits(option) {
  if (option?.traits?.length) return option.traits;
  return SPECIES_DEFINITIONS[slug(option?.name)]?.traits || [];
}
export function optionId(row) { return safeText(row?.id); }
export function assetSummary(asset) {
  if (!asset) return "No linked map sprite yet";
  const dirs = Array.isArray(asset.direction_order) ? asset.direction_order.length : 0;
  const walk = Array.isArray(asset.walk_frames) ? asset.walk_frames.length : 0;
  return `${dirs || 4}-direction • idle + ${walk || 3} walking frames`;
}
export function toolProficiencyDescription(toolName = "") {
  const name = safeText(toolName);
  return `${name} represents specialized practical training. Add the character's proficiency bonus when that training is relevant to the check.`;
}

function catalogFamilyOptionMeta(option = {}) {
  const bits = [sourceLabel(option?.source)];
  const damageType = safeText(option?.metadata?.damageType);
  if (damageType) bits.push(damageType);
  return bits.filter(Boolean).join(" • ");
}

function SpeciesCatalogFamilySubmenu({ species }) {
  const { state, setChoice } = useNpcForgeSourceChoices();
  if (!speciesVariantUsesCatalogSubmenu(species)) return null;
  const binding = speciesVariantChoiceBinding(species, state?.groups || [], state?.selections || {});
  if (!binding) return null;
  const { choice, group, field, selectedKey } = binding;
  return <div className="npc-forge-catalog-family-submenu" role="group" aria-label={`${choice.label} for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">{choice.label}</span><div className="npc-forge-catalog-family-submenu__rows">{(field.options || []).map((option) => {
    const canonical = (choice.options || []).find((entry) => entry.key === option.key) || option;
    return <button key={option.key} type="button" className={`npc-forge-catalog-family-option${selectedKey === option.key ? " is-active" : ""}`} onClick={() => setChoice(group.id, field.id, [option.key])}><span><strong>{canonical.metadata?.catalogLabel || option.metadata?.catalogLabel || option.label}</strong><small>{catalogFamilyOptionMeta(canonical)}</small></span><b>›</b></button>;
  })}</div><style jsx global>{`
    .npc-forge-catalog-family-submenu{display:grid;gap:4px;margin:-4px 0 7px 13px;padding:7px 0 3px 10px;border-left:1px solid rgba(168,108,255,.42)}.npc-forge-catalog-family-submenu__label{padding:0 6px 2px;color:#cdb7ef;font-size:.57rem;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.npc-forge-catalog-family-submenu__rows{display:grid;gap:3px}.npc-forge-catalog-family-option{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;min-height:39px!important;padding:7px 9px!important;border:1px solid rgba(168,108,255,.2)!important;border-radius:7px!important;background:rgba(13,16,27,.76)!important;text-align:left!important}.npc-forge-catalog-family-option:hover{border-color:rgba(168,108,255,.5)!important;background:rgba(126,72,199,.1)!important}.npc-forge-catalog-family-option.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(126,72,199,.2),rgba(88,214,199,.05))!important;box-shadow:inset 2px 0 0 #a86cff}.npc-forge-catalog-family-option>span{display:grid;gap:2px;min-width:0}.npc-forge-catalog-family-option strong{color:#fff;font-size:.64rem;line-height:1.2}.npc-forge-catalog-family-option small{color:rgba(255,255,255,.5);font-size:.52rem;line-height:1.2}.npc-forge-catalog-family-option>b{color:rgba(255,255,255,.45);font-size:.82rem}
  `}</style></div>;
}

function SpeciesCatalogSourceVariants({ species, selectedId, onSelect }) {
  const variants = Array.isArray(species?.catalogSourceVariants) ? species.catalogSourceVariants : [];
  if (!variants.length) return null;
  return <div className="npc-forge-catalog-family-submenu npc-forge-catalog-source-variants" role="group" aria-label={`Source variants for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">Setting / source variants</span><div className="npc-forge-catalog-family-submenu__rows">{variants.map((variant) => <button key={variant.id} type="button" className={`npc-forge-catalog-family-option${String(selectedId) === String(variant.id) ? " is-active" : ""}`} onClick={() => onSelect?.(variant)}><span><strong>{variant.name}</strong><small>{sourceLabel(variant.source)}</small></span><b>›</b></button>)}</div></div>;
}

export function CatalogList({ label, query, onQuery, rows, selectedId, onSelect, emptyText }) {
  const { state: sourceChoiceState, setChoice } = useNpcForgeSourceChoices();
  const visibleRows = (rows || []).filter((row) => !row?.catalogHidden);
  const selectCatalogRow = (row) => {
    const binding = speciesVariantChoiceBinding(row, sourceChoiceState?.groups || [], sourceChoiceState?.selections || {});
    if (binding) setChoice(binding.group.id, binding.field.id, []);
    onSelect(row);
  };
  return <div className="npc-forge-catalog"><div className="npc-forge-catalog-head"><span>{label}</span><strong>{visibleRows.length}</strong></div><input className="npc-forge-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} /><div className="npc-forge-catalog-list">{visibleRows.map((row) => {
    const sourceVariants = Array.isArray(row.catalogSourceVariants) ? row.catalogSourceVariants : [];
    const selectedSourceVariant = sourceVariants.some((variant) => String(variant.id) === String(selectedId));
    const active = String(selectedId) === String(row.id) || selectedSourceVariant;
    const parentSelected = String(selectedId) === String(row.id);
    const family = speciesVariantUsesCatalogSubmenu(row);
    return <Fragment key={row.id}><button type="button" className={active ? "is-active" : ""} onClick={() => selectCatalogRow(row)}><span><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></span><b>{active && (family || sourceVariants.length) ? "⌄" : "›"}</b></button>{active && parentSelected && family ? <SpeciesCatalogFamilySubmenu species={row} /> : null}{active && sourceVariants.length ? <SpeciesCatalogSourceVariants species={row} selectedId={selectedId} onSelect={onSelect} /> : null}</Fragment>;
  })}{!visibleRows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}</div></div>;
}
export async function recoverCreatedCharacter(requestId) {
  if (!requestId) return null;
  const { data, error } = await supabase.from("characters").select("id,kind,name").eq("creation_request_id", requestId).maybeSingle();
  return error ? null : data || null;
}
