import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";

const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function unique(values = []) {
  const seen = new Set();
  return array(values).flatMap((value) => {
    const label = text(value);
    const key = norm(label);
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [label];
  });
}

function titleCase(value = "") {
  return text(value).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function rawTraitFor(option = {}, entry = {}) {
  const traitName = norm(entry.name);
  return array(option.metadata?.traits).find((trait) => trait && typeof trait === "object" && norm(trait.name || trait.title) === traitName) || null;
}

function flattenRuleStrings(node, { omitChoiceCollections = false } = {}) {
  const output = [];
  const walk = (value) => {
    if (value == null) return;
    if (typeof value === "string") {
      const cleaned = formatPlayerFacingText(value);
      if (cleaned) output.push(cleaned);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object") return;
    if (omitChoiceCollections && (value.type === "list" || value.type === "table")) return;
    if (value.entry) walk(value.entry);
    if (value.entries) walk(value.entries);
    if (value.items) walk(value.items);
    if (value.rows) walk(value.rows);
  };
  walk(node);
  return unique(output).join("\n\n");
}

function collectNamedListItems(node) {
  const cards = [];
  const walk = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object") return;
    if (value.type === "item" && value.name) {
      const name = formatPlayerFacingInline(value.name).replace(/[.:]+$/, "");
      const description = flattenRuleStrings(value.entries || value.entry || value.items || []);
      if (name && description) cards.push({ name, description });
      return;
    }
    if (value.entries) walk(value.entries);
    if (value.items) walk(value.items);
  };
  walk(node);
  return cards.filter((card, index) => cards.findIndex((candidate) => norm(candidate.name) === norm(card.name)) === index);
}

export function speciesStructuredFeatureOptions(option = {}, entry = {}) {
  const rawTrait = rawTraitFor(option, entry);
  if (!rawTrait) return null;
  const optionCards = collectNamedListItems(rawTrait);
  if (optionCards.length < 2) return null;
  const preamble = flattenRuleStrings(rawTrait, { omitChoiceCollections: true });
  const choiceLanguage = `${entry.name || ""} ${preamble}`;
  if (!/(?:choose|one of (?:the )?(?:following )?options|options described below|forms?|transform)/i.test(choiceLanguage)) return null;
  return {
    description: preamble || text(entry.description),
    optionCards,
    optionCardsLabel: /revelation/i.test(text(entry.name)) ? "Revelation forms" : "Available options",
  };
}

export function speciesPromotedFactTrait(name = "") {
  const key = norm(name);
  return new Set(["creature type", "languages", "language", "size"]).has(key) || /(?:^| )darkvision(?: |$)/.test(key);
}

export function speciesCreatureTypeLabel(option = {}) {
  const types = unique(option.creatureTypes || option.metadata?.creatureTypes).map(titleCase);
  const creatureType = array(option.traitDetails).find((entry) => norm(entry?.name) === "creature type");
  const description = text(creatureType?.description);
  for (const match of description.matchAll(/\bconsidered\s+(?:an?\s+)?([a-z][a-z -]*?)(?=\s+for\b|\s+when\b|[.;]|$)/gi)) {
    const ancestry = titleCase(match[1]);
    if (ancestry && !types.some((value) => norm(value) === norm(ancestry))) types.push(ancestry);
  }
  return unique(types.length ? types : ["Humanoid"]).join(", ");
}

export function speciesFixedLanguageFact(fixedLanguages = []) {
  const languages = unique(fixedLanguages);
  if (!languages.length) return "";
  const knowsCommon = languages.some((language) => norm(language) === "common");
  const notable = languages.filter((language) => norm(language) !== "common");
  if (!notable.length) return knowsCommon ? "" : "Does not know Common";
  return `${notable.join(", ")}${knowsCommon ? "" : " · Does not know Common"}`;
}

export function speciesVisionExplanation(option = {}) {
  const distance = Number(option.darkvision || option.metadata?.darkvision || 0);
  if (!distance) return "";
  return `Within ${distance} feet, dim light appears bright and darkness appears dim. In darkness, colors are seen only as shades of gray.`;
}

function selectedDragonbornMetadata(option = {}) {
  return option.metadata?.selectedCatalogSpeciesFamily || option.metadata?.selectedVariantPresentation || {};
}

export function dragonbornDamageType(option = {}) {
  const selected = selectedDragonbornMetadata(option);
  const direct = text(selected.damageType || option.metadata?.damageType);
  if (direct) return titleCase(direct);
  const ancestry = array(option.traitDetails).find((entry) => /ancestry/i.test(text(entry?.name)));
  const affinity = text(ancestry?.description).match(/\bdamage affinity\s*:\s*([a-z -]+)/i)?.[1];
  if (affinity) return titleCase(affinity.replace(/[.].*$/, ""));
  const name = norm(selected.label || selected.variantName || option.name).replace(/\bgem\b|\bdragonborn\b/g, "").trim();
  const byAncestry = {
    black: "Acid", blue: "Lightning", brass: "Fire", bronze: "Lightning", copper: "Acid",
    gold: "Fire", green: "Poison", red: "Fire", silver: "Cold", white: "Cold",
    amethyst: "Force", crystal: "Radiant", emerald: "Psychic", sapphire: "Thunder", topaz: "Necrotic",
  };
  return byAncestry[name] || "";
}

function dragonbornAncestryLabel(option = {}) {
  const selected = selectedDragonbornMetadata(option);
  return text(selected.label || selected.variantName || option.name)
    .replace(/\s*\(Gem\)\s*/i, " ")
    .replace(/\s+Dragonborn\s*$/i, "")
    .trim();
}

function dragonbornEnergyPhrase(damageType = "") {
  return ({
    acid: "corrosive acid", cold: "freezing cold", fire: "searing fire", force: "violet force",
    lightning: "crackling lightning", necrotic: "life-draining necrotic energy", poison: "venomous poison",
    psychic: "mind-rending psychic energy", radiant: "crystalline radiance", thunder: "concussive thunder",
  })[norm(damageType)] || `${text(damageType).toLowerCase()} energy`;
}

export function speciesTraitDescriptionForDisplay(option = {}, entry = {}) {
  const description = text(entry.description);
  const trait = norm(entry.name);
  const damageType = dragonbornDamageType(option);
  if (!damageType || !/dragonborn/.test(norm(option.name)) || (!/breath weapon/.test(trait) && !/damage resistance|draconic resistance/.test(trait))) return description;

  const ancestry = dragonbornAncestryLabel(option);
  const lineage = ancestry ? `${ancestry.toLowerCase()} draconic ancestry` : "draconic ancestry";
  const energy = dragonbornEnergyPhrase(damageType);
  const resolved = description
    .replace(/damage of the type determined by your (?:Draconic|Chromatic|Metallic|Gem) Ancestry trait/gi, `${damageType} damage`)
    .replace(/resistance to the damage type (?:determined by|associated with) your (?:Draconic|Chromatic|Metallic|Gem) Ancestry(?: trait)?/gi, `Resistance to ${damageType} damage`);

  if (/breath weapon/.test(trait)) return `Your ${lineage} gathers as ${energy} before you exhale it as a weapon. ${resolved}`;
  return `Your ${lineage} carries ${energy} through scale and blood. ${resolved}`;
}

function isEladrin(option = {}) {
  return norm(option.name) === "eladrin" && text(option.source).toUpperCase() === "MPMM";
}

function isCustomLineage(option = {}) {
  return norm(option.name) === "custom lineage" && text(option.source).toUpperCase() === "TCE";
}

function seasonalFeyStepDescription() {
  return "As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use Fey Step a number of times equal to your Proficiency Bonus, regaining all uses when you finish a Long Rest. Choose an initial season when you create the character, and after each Long Rest you may change to a different season. Starting at character level 3, your current season adds an effect to Fey Step: Autumn can Charm up to two creatures you can see within 10 feet after you teleport; Winter can Frighten one creature you can see within 5 feet before you teleport; Spring can teleport one willing creature you touch within 5 feet instead of you; and Summer deals Fire damage equal to your Proficiency Bonus to each creature of your choice you can see within 5 feet after you teleport. The season selector below sets your starting season and remains changeable after a Long Rest.";
}

function customLineageHeritageDetail() {
  return {
    name: "Heritage Traits",
    description: "Custom Lineage is built entirely from Heritage Traits. Choose exactly eight Heritage Trait picks below. Combat, Exploration, and Roleplaying are catalogue categories rather than required quotas. Some traits may be taken again when their rules allow it; doing so spends another pick and grants the trait's improved or repeated benefit. Any damage type, environment, language, weapon, tool, spell, or similar choice required by a selected trait is completed with that trait before you continue.",
  };
}

export function speciesFeaturePresentation(option = {}) {
  const promoted = (name) => speciesPromotedFactTrait(name);
  let details = array(option.traitDetails)
    .filter((entry) => entry?.name && !promoted(entry.name))
    .map((entry) => {
      const structured = speciesStructuredFeatureOptions(option, entry);
      const presented = structured ? { ...entry, ...structured } : entry;
      return { ...presented, description: speciesTraitDescriptionForDisplay(option, presented) };
    });
  let traits = array(option.traits).filter((trait) => trait && !promoted(trait));

  if (isEladrin(option)) {
    const seasonLike = (value) => /(?:^| )choose your eladrins? season\b|^eladrin seasons?$/.test(norm(value));
    details = details.filter((entry) => !seasonLike(entry.name)).map((entry) => {
      if (norm(entry.name) !== "fey step") return entry;
      const { optionCards, optionCardsLabel, runtimeChoice, ...rest } = entry;
      return { ...rest, name: "Seasonal Fey Step", description: seasonalFeyStepDescription(), runtimeChoice: true };
    });
    traits = traits.filter((trait) => !seasonLike(trait)).map((trait) => norm(trait) === "fey step" ? "Seasonal Fey Step" : trait);
  }

  if (isCustomLineage(option)) {
    const legacy = new Set(["feat", "variable trait"]);
    details = details.filter((entry) => !legacy.has(norm(entry.name)) && norm(entry.name) !== "heritage traits");
    traits = traits.filter((trait) => !legacy.has(norm(trait)) && norm(trait) !== "heritage traits");
    const heritage = customLineageHeritageDetail();
    details.unshift(heritage);
    traits = traits.filter((trait) => norm(trait) !== norm(heritage.name));
  }

  return { details, traits };
}
