import { Fragment, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, CLASS_DEFINITIONS, FEAT_OPTIONS, SIZE_OPTIONS, SKILL_DEFINITIONS, SPECIES_DEFINITIONS, standardAbilityScores } from "../utils/characterCreation";
import { safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { handleSpeciesArtworkError, normalizeSpeciesArtworkKey, speciesPortraitArtworkFor } from "../utils/speciesArtwork";
import { speciesCatalogSummary } from "../utils/speciesLore";
import { catalogSpeciesFamilyChoice, speciesVariantChoiceBinding, speciesVariantUsesCatalogSubmenu } from "../utils/speciesCatalogFamilyMenu";
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

function SpeciesCatalogPortrait({ name }) {
  return <span className="npc-forge-catalog-portrait" aria-hidden="true"><img src={speciesPortraitArtworkFor(name)} alt="" onError={handleSpeciesArtworkError} /></span>;
}

function SpeciesCatalogCopy({ name, source, species }) {
  return <span className="npc-forge-catalog-species-copy"><strong>{name}</strong><small className="npc-forge-catalog-species-summary">{speciesCatalogSummary(species || name)}</small><em>{sourceLabel(source)}</em></span>;
}

function normalizedCatalogSearch(value = "") {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function catalogTextMatchesQuery(values = [], query = "") {
  const needle = normalizedCatalogSearch(query);
  return Boolean(needle) && values.some((value) => normalizedCatalogSearch(value).includes(needle));
}

function catalogFamilyDisplayName(choice = null, option = {}) {
  const canonical = (choice?.options || []).find((entry) => entry.key === option.key);
  return canonical?.metadata?.catalogDisplayName || canonical?.metadata?.catalogLabel || option.metadata?.catalogDisplayName || option.metadata?.catalogLabel || option.label;
}

function catalogFamilyOptionMatchesQuery(choice = null, option = {}, query = "") {
  const canonical = (choice?.options || []).find((entry) => entry.key === option.key) || option;
  const displayName = catalogFamilyDisplayName(choice, canonical);
  return catalogTextMatchesQuery([displayName, option.label, canonical.label, option.source, canonical.source, speciesCatalogSummary(displayName)], query);
}

function catalogSourceVariantMatchesQuery(variant = {}, query = "") {
  return catalogTextMatchesQuery([variant.name, variant.source, speciesCatalogSummary(variant)], query);
}

function catalogParentMatchesQuery(row = {}, query = "") {
  return catalogTextMatchesQuery([row.name, row.class_name, row.source, speciesCatalogSummary(row)], query);
}

function SpeciesCatalogFamilySubmenu({ species, query = "", onSelectParent = null }) {
  const { state, setChoice } = useNpcForgeSourceChoices();
  if (!speciesVariantUsesCatalogSubmenu(species)) return null;
  const binding = speciesVariantChoiceBinding(species, state?.groups || [], state?.selections || {});
  const choice = binding?.choice || catalogSpeciesFamilyChoice(species);
  const group = binding?.group || null;
  const field = binding?.field || choice;
  const selectedKey = binding?.selectedKey || "";
  if (!choice?.options?.length) return null;
  const options = (field?.options || choice.options).filter((option) => !query || catalogFamilyOptionMatchesQuery(choice, option, query));
  if (!options.length) return null;
  return <div className="npc-forge-catalog-family-submenu" role="group" aria-label={`${choice.label} for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">{choice.label}</span><div className="npc-forge-catalog-family-submenu__rows">{options.map((option) => {
    const canonical = (choice.options || []).find((entry) => entry.key === option.key) || option;
    const displayName = catalogFamilyDisplayName(choice, canonical);
    const selectFamilyOption = () => binding ? setChoice(group.id, field.id, [option.key]) : onSelectParent?.(species);
    return <button key={option.key} type="button" className={`npc-forge-catalog-family-option${selectedKey === option.key ? " is-active" : ""}`} onClick={selectFamilyOption}><SpeciesCatalogPortrait name={displayName} /><span className="npc-forge-catalog-family-option__copy"><strong>{displayName}</strong><small>{speciesCatalogSummary(displayName)}</small><em>{catalogFamilyOptionMeta(canonical)}</em></span>{selectedKey === option.key ? <b className="npc-forge-catalog-child-check" aria-label="Selected">✓</b> : null}</button>;
  })}</div></div>;
}

function SpeciesCatalogSourceVariants({ species, selectedId, onSelect, query = "" }) {
  const variants = Array.isArray(species?.catalogSourceVariants) ? species.catalogSourceVariants : [];
  const visibleVariants = variants.filter((variant) => !query || catalogSourceVariantMatchesQuery(variant, query));
  if (!visibleVariants.length) return null;
  return <div className="npc-forge-catalog-family-submenu npc-forge-catalog-source-variants" role="group" aria-label={`Source variants for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">Setting / source variants</span><div className="npc-forge-catalog-family-submenu__rows">{visibleVariants.map((variant) => <button key={variant.id} type="button" className={`npc-forge-catalog-family-option${String(selectedId) === String(variant.id) ? " is-active" : ""}`} onClick={() => onSelect?.(variant)}><SpeciesCatalogPortrait name={variant.name} /><SpeciesCatalogCopy name={variant.name} source={variant.source} species={variant} />{String(selectedId) === String(variant.id) ? <b className="npc-forge-catalog-child-check" aria-label="Selected">✓</b> : null}</button>)}</div></div>;
}

function familyRowCanExpand(row) {
  return speciesVariantUsesCatalogSubmenu(row) || (Array.isArray(row?.catalogSourceVariants) && row.catalogSourceVariants.length > 0);
}

export function CatalogList({ label, query, onQuery, rows, selectedId, onSelect, emptyText }) {
  const { state: sourceChoiceState, setChoice } = useNpcForgeSourceChoices();
  const [expandedSpeciesRows, setExpandedSpeciesRows] = useState(() => new Set());
  const speciesMode = String(label || "").toLowerCase() === "species";
  const catalogSearchQuery = speciesMode ? normalizedCatalogSearch(query) : "";
  const visibleRows = (rows || []).filter((row) => !row?.catalogHidden);
  const setRowExpanded = (row, expanded) => {
    const key = String(row?.id || row?.name || "");
    if (!key) return;
    setExpandedSpeciesRows((current) => {
      const next = new Set(current);
      if (expanded) next.add(key); else next.delete(key);
      return next;
    });
  };
  const selectCatalogRow = (row) => {
    const binding = speciesVariantChoiceBinding(row, sourceChoiceState?.groups || [], sourceChoiceState?.selections || {});
    if (binding) setChoice(binding.group.id, binding.field.id, []);
    onSelect(row);
    if (speciesMode && familyRowCanExpand(row)) setRowExpanded(row, true);
  };
  const toggleRowExpansion = (event, row, expanded) => {
    event.preventDefault();
    event.stopPropagation();
    setRowExpanded(row, !expanded);
  };
  const onChevronKeyDown = (event, row, expanded) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    toggleRowExpansion(event, row, expanded);
  };
  return <div className="npc-forge-catalog"><div className="npc-forge-catalog-head"><span>{label}</span><strong>{visibleRows.length}</strong></div><input className="npc-forge-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} /><div className="npc-forge-catalog-list">{visibleRows.map((row) => {
    const sourceVariants = Array.isArray(row.catalogSourceVariants) ? row.catalogSourceVariants : [];
    const selectedSourceVariant = sourceVariants.some((variant) => String(variant.id) === String(selectedId));
    const active = String(selectedId) === String(row.id) || selectedSourceVariant;
    const parentSelected = String(selectedId) === String(row.id);
    const family = speciesMode && speciesVariantUsesCatalogSubmenu(row);
    const familyChoice = family ? catalogSpeciesFamilyChoice(row) : null;
    const familyBinding = family ? speciesVariantChoiceBinding(row, sourceChoiceState?.groups || [], sourceChoiceState?.selections || {}) : null;
    const selectedFamilyName = familyBinding?.selected?.metadata?.catalogDisplayName || familyBinding?.selected?.metadata?.catalogLabel || familyBinding?.selected?.label || "";
    const selectedSettingRow = selectedSourceVariant ? sourceVariants.find((variant) => String(variant.id) === String(selectedId)) : null;
    const selectedPortraitKey = normalizeSpeciesArtworkKey(selectedSettingRow?.name || selectedFamilyName);
    const expandable = speciesMode && (family || sourceVariants.length > 0);
    const parentMatchesSearch = catalogParentMatchesQuery(row, catalogSearchQuery);
    const canRevealFromSearch = catalogSearchQuery.length >= 2;
    const familySearchMatches = family && (familyChoice?.options || []).some((option) => catalogFamilyOptionMatchesQuery(familyChoice, option, catalogSearchQuery));
    const sourceSearchMatches = sourceVariants.some((variant) => catalogSourceVariantMatchesQuery(variant, catalogSearchQuery));
    const searchRevealsFamily = canRevealFromSearch && family && (parentMatchesSearch || familySearchMatches);
    const searchRevealsSources = canRevealFromSearch && sourceVariants.length > 0 && (parentMatchesSearch || sourceSearchMatches);
    const expanded = expandable && (expandedSpeciesRows.has(String(row.id)) || searchRevealsFamily || searchRevealsSources);
    const childQuery = parentMatchesSearch ? "" : catalogSearchQuery;
    return <Fragment key={row.id}><button type="button" data-selected-portrait={selectedPortraitKey || undefined} className={`${active ? "is-active" : ""}${speciesMode ? " npc-forge-species-catalog-row" : ""}`} onClick={() => selectCatalogRow(row)}>{speciesMode ? <SpeciesCatalogPortrait name={row.name} /> : null}<span>{speciesMode ? <><strong>{row.name || row.class_name}</strong><small className="npc-forge-catalog-species-summary">{speciesCatalogSummary(row)}</small><em>{sourceLabel(row.source)}</em></> : <><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></>}</span>{expandable ? <b className="npc-forge-catalog-expand-toggle" role="button" tabIndex={0} aria-label={`${expanded ? "Collapse" : "Expand"} ${row.name} options`} aria-expanded={expanded} onClick={(event) => toggleRowExpansion(event, row, expanded)} onKeyDown={(event) => onChevronKeyDown(event, row, expanded)}>{expanded ? "⌄" : "›"}</b> : null}</button>{expanded && (parentSelected || searchRevealsFamily) && family ? <SpeciesCatalogFamilySubmenu species={row} query={childQuery} onSelectParent={selectCatalogRow} /> : null}{expanded && (parentMatchesSearch || searchRevealsSources || !catalogSearchQuery) && sourceVariants.length ? <SpeciesCatalogSourceVariants species={row} selectedId={selectedId} onSelect={onSelect} query={childQuery} /> : null}</Fragment>;
  })}{!visibleRows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}</div><style jsx global>{`
    .npc-forge-species-catalog-row{display:grid!important;grid-template-columns:40px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;min-height:54px!important;padding:6px 8px!important}.npc-forge-catalog-portrait{display:block;position:relative;width:38px;height:42px;border:1px solid rgba(168,108,255,.28);border-radius:6px;overflow:hidden;background:#111522;flex:0 0 auto}.npc-forge-catalog-portrait img{width:100%;height:100%;object-fit:cover;object-position:center 22%;display:block}.npc-forge-species-catalog-row>span:not(.npc-forge-catalog-portrait),.npc-forge-catalog-species-copy,.npc-forge-catalog-family-option__copy{display:grid!important;gap:1px!important;min-width:0!important}.npc-forge-catalog-species-summary{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(255,255,255,.62)!important;font-size:.52rem!important;line-height:1.28!important;font-weight:500!important}.npc-forge-species-catalog-row em,.npc-forge-catalog-species-copy em,.npc-forge-catalog-family-option__copy em{color:rgba(119,225,211,.68);font-size:.46rem;font-style:normal;font-weight:800;letter-spacing:.035em}.npc-forge-catalog-expand-toggle{display:grid;place-items:center;width:24px;height:24px;margin-left:3px;border:1px solid rgba(168,108,255,.28);border-radius:50%;color:#e8dfff!important;background:rgba(126,72,199,.08);font-size:.88rem!important;line-height:1;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}.npc-forge-catalog-expand-toggle:hover,.npc-forge-catalog-expand-toggle:focus{border-color:#a86cff;background:rgba(126,72,199,.22);outline:none}.npc-forge-catalog-family-submenu{display:grid;gap:4px;margin:-4px 0 7px 14px;padding:7px 0 3px 10px;border-left:1px solid rgba(168,108,255,.42)}.npc-forge-catalog-family-submenu__label{padding:0 6px 2px;color:#cdb7ef;font-size:.57rem;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.npc-forge-catalog-family-submenu__rows{display:grid;gap:3px}.npc-forge-catalog-family-option{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:7px!important;width:100%!important;min-height:48px!important;padding:5px 7px!important;border:1px solid rgba(168,108,255,.2)!important;border-radius:7px!important;background:rgba(13,16,27,.76)!important;text-align:left!important}.npc-forge-catalog-family-option .npc-forge-catalog-portrait{width:32px;height:36px;border-radius:5px}.npc-forge-catalog-family-option:hover{border-color:rgba(168,108,255,.5)!important;background:rgba(126,72,199,.1)!important}.npc-forge-catalog-family-option.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(126,72,199,.2),rgba(88,214,199,.05))!important;box-shadow:inset 2px 0 0 #a86cff}.npc-forge-catalog-family-option strong{color:#fff;font-size:.62rem;line-height:1.2}.npc-forge-catalog-family-option small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(255,255,255,.6);font-size:.49rem;line-height:1.22}.npc-forge-catalog-child-check{display:grid;place-items:center;width:19px;height:19px;border:1px solid #a86cff;border-radius:50%;color:#fff!important;font-size:.6rem!important;background:rgba(126,72,199,.35)}
  `}</style></div>;
}
export async function recoverCreatedCharacter(requestId) {
  if (!requestId) return null;
  const { data, error } = await supabase.from("characters").select("id,kind,name").eq("creation_request_id", requestId).maybeSingle();
  return error ? null : data || null;
}
