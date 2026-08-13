import { Fragment, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, CLASS_DEFINITIONS, FEAT_OPTIONS, SIZE_OPTIONS, SKILL_DEFINITIONS, SPECIES_DEFINITIONS, standardAbilityScores } from "../utils/characterCreation";
import { safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { handleSpeciesArtworkError, normalizeSpeciesArtworkKey, speciesPortraitArtworkFor } from "../utils/speciesArtwork";
import { speciesCatalogSummary } from "../utils/speciesLore";
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

function SpeciesCatalogPortrait({ name }) {
  return <span className="npc-forge-catalog-portrait" aria-hidden="true"><img src={speciesPortraitArtworkFor(name)} alt="" onError={handleSpeciesArtworkError} /></span>;
}

function SpeciesCatalogCopy({ name, source, species }) {
  return <span className="npc-forge-catalog-species-copy"><strong>{name}</strong><small className="npc-forge-catalog-species-summary">{speciesCatalogSummary(species || name)}</small><em>{sourceLabel(source)}</em></span>;
}

function SpeciesCatalogFamilySubmenu({ species }) {
  const { state, setChoice } = useNpcForgeSourceChoices();
  if (!speciesVariantUsesCatalogSubmenu(species)) return null;
  const binding = speciesVariantChoiceBinding(species, state?.groups || [], state?.selections || {});
  if (!binding) return null;
  const { choice, group, field, selectedKey } = binding;
  return <div className="npc-forge-catalog-family-submenu" role="group" aria-label={`${choice.label} for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">{choice.label}</span><div className="npc-forge-catalog-family-submenu__rows">{(field.options || []).map((option) => {
    const canonical = (choice.options || []).find((entry) => entry.key === option.key) || option;
    const displayName = canonical.metadata?.catalogDisplayName || canonical.metadata?.catalogLabel || option.metadata?.catalogLabel || option.label;
    return <button key={option.key} type="button" className={`npc-forge-catalog-family-option${selectedKey === option.key ? " is-active" : ""}`} onClick={() => setChoice(group.id, field.id, [option.key])}><SpeciesCatalogPortrait name={displayName} /><span className="npc-forge-catalog-family-option__copy"><strong>{displayName}</strong><small>{speciesCatalogSummary(displayName)}</small><em>{catalogFamilyOptionMeta(canonical)}</em></span>{selectedKey === option.key ? <b className="npc-forge-catalog-child-check" aria-label="Selected">✓</b> : null}</button>;
  })}</div></div>;
}

function SpeciesCatalogSourceVariants({ species, selectedId, onSelect }) {
  const variants = Array.isArray(species?.catalogSourceVariants) ? species.catalogSourceVariants : [];
  if (!variants.length) return null;
  return <div className="npc-forge-catalog-family-submenu npc-forge-catalog-source-variants" role="group" aria-label={`Source variants for ${species.name}`}><span className="npc-forge-catalog-family-submenu__label">Setting / source variants</span><div className="npc-forge-catalog-family-submenu__rows">{variants.map((variant) => <button key={variant.id} type="button" className={`npc-forge-catalog-family-option${String(selectedId) === String(variant.id) ? " is-active" : ""}`} onClick={() => onSelect?.(variant)}><SpeciesCatalogPortrait name={variant.name} /><SpeciesCatalogCopy name={variant.name} source={variant.source} species={variant} />{String(selectedId) === String(variant.id) ? <b className="npc-forge-catalog-child-check" aria-label="Selected">✓</b> : null}</button>)}</div></div>;
}

function familyRowCanExpand(row) {
  return speciesVariantUsesCatalogSubmenu(row) || (Array.isArray(row?.catalogSourceVariants) && row.catalogSourceVariants.length > 0);
}

export function CatalogList({ label, query, onQuery, rows, selectedId, onSelect, emptyText }) {
  const { state: sourceChoiceState, setChoice } = useNpcForgeSourceChoices();
  const [expandedSpeciesRows, setExpandedSpeciesRows] = useState(() => new Set());
  const speciesMode = String(label || "").toLowerCase() === "species";
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
    const familyBinding = family ? speciesVariantChoiceBinding(row, sourceChoiceState?.groups || [], sourceChoiceState?.selections || {}) : null;
    const selectedFamilyName = familyBinding?.selected?.metadata?.catalogDisplayName || familyBinding?.selected?.metadata?.catalogLabel || familyBinding?.selected?.label || "";
    const selectedSettingRow = selectedSourceVariant ? sourceVariants.find((variant) => String(variant.id) === String(selectedId)) : null;
    const selectedPortraitKey = normalizeSpeciesArtworkKey(selectedSettingRow?.name || selectedFamilyName);
    const expandable = speciesMode && (family || sourceVariants.length > 0);
    const expanded = expandable && expandedSpeciesRows.has(String(row.id));
    return <Fragment key={row.id}><button type="button" data-selected-portrait={selectedPortraitKey || undefined} className={`${active ? "is-active" : ""}${speciesMode ? " npc-forge-species-catalog-row" : ""}`} onClick={() => selectCatalogRow(row)}>{speciesMode ? <SpeciesCatalogPortrait name={row.name} /> : null}<span>{speciesMode ? <><strong>{row.name || row.class_name}</strong><small className="npc-forge-catalog-species-summary">{speciesCatalogSummary(row)}</small><em>{sourceLabel(row.source)}</em></> : <><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></>}</span>{expandable ? <b className="npc-forge-catalog-expand-toggle" role="button" tabIndex={0} aria-label={`${expanded ? "Collapse" : "Expand"} ${row.name} options`} aria-expanded={expanded} onClick={(event) => toggleRowExpansion(event, row, expanded)} onKeyDown={(event) => onChevronKeyDown(event, row, expanded)}>{expanded ? "⌄" : "›"}</b> : null}</button>{expanded && parentSelected && family ? <SpeciesCatalogFamilySubmenu species={row} /> : null}{expanded && sourceVariants.length ? <SpeciesCatalogSourceVariants species={row} selectedId={selectedId} onSelect={onSelect} /> : null}</Fragment>;
  })}{!visibleRows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}</div><style jsx global>{`
    .npc-forge-species-catalog-row{display:grid!important;grid-template-columns:40px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;min-height:54px!important;padding:6px 8px!important}.npc-forge-catalog-portrait{display:block;position:relative;width:38px;height:42px;border:1px solid rgba(168,108,255,.28);border-radius:6px;overflow:hidden;background:#111522;flex:0 0 auto}.npc-forge-catalog-portrait img{width:100%;height:100%;object-fit:cover;object-position:center 22%;display:block}.npc-forge-species-catalog-row>span:not(.npc-forge-catalog-portrait),.npc-forge-catalog-species-copy,.npc-forge-catalog-family-option__copy{display:grid!important;gap:1px!important;min-width:0!important}.npc-forge-catalog-species-summary{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(255,255,255,.62)!important;font-size:.52rem!important;line-height:1.28!important;font-weight:500!important}.npc-forge-species-catalog-row em,.npc-forge-catalog-species-copy em,.npc-forge-catalog-family-option__copy em{color:rgba(119,225,211,.68);font-size:.46rem;font-style:normal;font-weight:800;letter-spacing:.035em}.npc-forge-catalog-expand-toggle{display:grid;place-items:center;width:24px;height:24px;margin-left:3px;border:1px solid rgba(168,108,255,.28);border-radius:50%;color:#e8dfff!important;background:rgba(126,72,199,.08);font-size:.88rem!important;line-height:1;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}.npc-forge-catalog-expand-toggle:hover,.npc-forge-catalog-expand-toggle:focus{border-color:#a86cff;background:rgba(126,72,199,.22);outline:none}.npc-forge-catalog-family-submenu{display:grid;gap:4px;margin:-4px 0 7px 14px;padding:7px 0 3px 10px;border-left:1px solid rgba(168,108,255,.42)}.npc-forge-catalog-family-submenu__label{padding:0 6px 2px;color:#cdb7ef;font-size:.57rem;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.npc-forge-catalog-family-submenu__rows{display:grid;gap:3px}.npc-forge-catalog-family-option{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:7px!important;width:100%!important;min-height:48px!important;padding:5px 7px!important;border:1px solid rgba(168,108,255,.2)!important;border-radius:7px!important;background:rgba(13,16,27,.76)!important;text-align:left!important}.npc-forge-catalog-family-option .npc-forge-catalog-portrait{width:32px;height:36px;border-radius:5px}.npc-forge-catalog-family-option:hover{border-color:rgba(168,108,255,.5)!important;background:rgba(126,72,199,.1)!important}.npc-forge-catalog-family-option.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(126,72,199,.2),rgba(88,214,199,.05))!important;box-shadow:inset 2px 0 0 #a86cff}.npc-forge-catalog-family-option strong{color:#fff;font-size:.62rem;line-height:1.2}.npc-forge-catalog-family-option small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:rgba(255,255,255,.6);font-size:.49rem;line-height:1.22}.npc-forge-catalog-child-check{display:grid;place-items:center;width:19px;height:19px;border:1px solid #a86cff;border-radius:50%;color:#fff!important;font-size:.6rem!important;background:rgba(126,72,199,.35)}
    img[src*="portrait=air-genasi"],body:has([data-selected-portrait="air-genasi"]) .npc-forge-species-artwork img{filter:saturate(.7) hue-rotate(155deg) brightness(1.16);object-position:35% 20%!important}img[src*="portrait=earth-genasi"],body:has([data-selected-portrait="earth-genasi"]) .npc-forge-species-artwork img{filter:saturate(.72) sepia(.42) hue-rotate(335deg) brightness(.88);object-position:63% 24%!important}img[src*="portrait=fire-genasi"],body:has([data-selected-portrait="fire-genasi"]) .npc-forge-species-artwork img{filter:saturate(1.38) sepia(.28) hue-rotate(328deg) brightness(1.05);object-position:48% 18%!important}img[src*="portrait=water-genasi"],body:has([data-selected-portrait="water-genasi"]) .npc-forge-species-artwork img{filter:saturate(1.08) hue-rotate(170deg) brightness(.95);object-position:72% 22%!important}
    img[src*="portrait=black-dragonborn"],body:has([data-selected-portrait="black-dragonborn"]) .npc-forge-species-artwork img{filter:saturate(.45) brightness(.58) contrast(1.22)}img[src*="portrait=blue-dragonborn"],body:has([data-selected-portrait="blue-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(170deg) saturate(1.25) brightness(.9)}img[src*="portrait=green-dragonborn"],body:has([data-selected-portrait="green-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(70deg) saturate(1.12) brightness(.83)}img[src*="portrait=red-dragonborn"],body:has([data-selected-portrait="red-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(325deg) saturate(1.45) brightness(.92)}img[src*="portrait=white-dragonborn"],body:has([data-selected-portrait="white-dragonborn"]) .npc-forge-species-artwork img{filter:saturate(.18) brightness(1.38) contrast(.88)}img[src*="portrait=brass-dragonborn"],body:has([data-selected-portrait="brass-dragonborn"]) .npc-forge-species-artwork img{filter:sepia(.28) saturate(1.25) brightness(1.05)}img[src*="portrait=bronze-dragonborn"],body:has([data-selected-portrait="bronze-dragonborn"]) .npc-forge-species-artwork img{filter:sepia(.52) hue-rotate(338deg) saturate(1.2) brightness(.83)}img[src*="portrait=copper-dragonborn"],body:has([data-selected-portrait="copper-dragonborn"]) .npc-forge-species-artwork img{filter:sepia(.62) hue-rotate(320deg) saturate(1.45) brightness(.9)}img[src*="portrait=gold-dragonborn"],body:has([data-selected-portrait="gold-dragonborn"]) .npc-forge-species-artwork img{filter:sepia(.5) saturate(1.7) brightness(1.16)}img[src*="portrait=silver-dragonborn"],body:has([data-selected-portrait="silver-dragonborn"]) .npc-forge-species-artwork img{filter:saturate(.15) brightness(1.22) contrast(1.02)}img[src*="portrait=amethyst-gem-dragonborn"],body:has([data-selected-portrait="amethyst-gem-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(268deg) saturate(1.4)}img[src*="portrait=crystal-gem-dragonborn"],body:has([data-selected-portrait="crystal-gem-dragonborn"]) .npc-forge-species-artwork img{filter:saturate(.3) brightness(1.3)}img[src*="portrait=emerald-gem-dragonborn"],body:has([data-selected-portrait="emerald-gem-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(72deg) saturate(1.35)}img[src*="portrait=sapphire-gem-dragonborn"],body:has([data-selected-portrait="sapphire-gem-dragonborn"]) .npc-forge-species-artwork img{filter:hue-rotate(188deg) saturate(1.35)}img[src*="portrait=topaz-gem-dragonborn"],body:has([data-selected-portrait="topaz-gem-dragonborn"]) .npc-forge-species-artwork img{filter:sepia(.5) hue-rotate(342deg) saturate(1.4) brightness(1.05)}
    img[src*="portrait=hawk-headed-aven"],body:has([data-selected-portrait="hawk-headed-aven"]) .npc-forge-species-artwork img{filter:saturate(1.18) sepia(.18) contrast(1.08);object-position:34% 18%!important}img[src*="portrait=ibis-headed-aven"],body:has([data-selected-portrait="ibis-headed-aven"]) .npc-forge-species-artwork img{filter:hue-rotate(18deg) saturate(.78) brightness(1.12);object-position:72% 18%!important}img[src*="portrait=drow"],body:has([data-selected-portrait="drow"]) .npc-forge-species-artwork img{filter:hue-rotate(195deg) saturate(.62) brightness(.72);object-position:40% 18%!important}img[src*="portrait=high-elf"],body:has([data-selected-portrait="high-elf"]) .npc-forge-species-artwork img{filter:saturate(.72) brightness(1.13);object-position:55% 16%!important}img[src*="portrait=wood-elf"],body:has([data-selected-portrait="wood-elf"]) .npc-forge-species-artwork img{filter:hue-rotate(58deg) saturate(.92) brightness(.9);object-position:68% 20%!important}img[src*="portrait=forest-gnome"],body:has([data-selected-portrait="forest-gnome"]) .npc-forge-species-artwork img{filter:hue-rotate(52deg) saturate(1.04);object-position:38% 18%!important}img[src*="portrait=rock-gnome"],body:has([data-selected-portrait="rock-gnome"]) .npc-forge-species-artwork img{filter:sepia(.25) saturate(.86) contrast(1.08);object-position:67% 20%!important}img[src*="portrait=beasthide-shifter"],body:has([data-selected-portrait="beasthide-shifter"]) .npc-forge-species-artwork img{filter:sepia(.35) saturate(.68) contrast(1.12);object-position:32% 18%!important}img[src*="portrait=longtooth-shifter"],body:has([data-selected-portrait="longtooth-shifter"]) .npc-forge-species-artwork img{filter:sepia(.15) saturate(1.15) brightness(.88);object-position:48% 18%!important}img[src*="portrait=swiftstride-shifter"],body:has([data-selected-portrait="swiftstride-shifter"]) .npc-forge-species-artwork img{filter:hue-rotate(18deg) saturate(.9) brightness(1.12);object-position:66% 18%!important}img[src*="portrait=wildhunt-shifter"],body:has([data-selected-portrait="wildhunt-shifter"]) .npc-forge-species-artwork img{filter:hue-rotate(75deg) saturate(.72) brightness(.94);object-position:78% 18%!important}img[src*="portrait=lorwyn-fairy"],body:has([data-selected-portrait="lorwyn-fairy"]) .npc-forge-species-artwork img{filter:saturate(1.25) brightness(1.12);object-position:35% 15%!important}img[src*="portrait=shadowmoor-fairy"],body:has([data-selected-portrait="shadowmoor-fairy"]) .npc-forge-species-artwork img{filter:hue-rotate(220deg) saturate(.72) brightness(.68);object-position:68% 17%!important}img[src*="portrait=lorwyn-kithkin"],body:has([data-selected-portrait="lorwyn-kithkin"]) .npc-forge-species-artwork img{filter:sepia(.14) saturate(1.08) brightness(1.08);object-position:36% 18%!important}img[src*="portrait=shadowmoor-kithkin"],body:has([data-selected-portrait="shadowmoor-kithkin"]) .npc-forge-species-artwork img{filter:hue-rotate(205deg) saturate(.58) brightness(.68);object-position:68% 18%!important}img[src*="portrait=dwarf-kaladesh"],body:has([data-selected-portrait="dwarf-kaladesh"]) .npc-forge-species-artwork img{filter:sepia(.3) hue-rotate(338deg) saturate(1.05);object-position:62% 18%!important}img[src*="portrait=goblin-dankwood"],body:has([data-selected-portrait="goblin-dankwood"]) .npc-forge-species-artwork img{filter:hue-rotate(42deg) saturate(1.08) brightness(1.08);object-position:65% 18%!important}img[src*="portrait=orc-ixalan"],body:has([data-selected-portrait="orc-ixalan"]) .npc-forge-species-artwork img{filter:hue-rotate(155deg) saturate(.78) brightness(.9);object-position:60% 18%!important}
  `}</style></div>;
}
export async function recoverCreatedCharacter(requestId) {
  if (!requestId) return null;
  const { data, error } = await supabase.from("characters").select("id,kind,name").eq("creation_request_id", requestId).maybeSingle();
  return error ? null : data || null;
}
