const MERCHANT_PROFESSIONS = new Set([
  "merchant",
  "smith",
  "apothecary",
  "herbalist",
  "alchemist",
  "jeweler",
  "scribe",
  "hospitality",
  "artisan",
]);

const THEME_NOISE = new Set([
  "human","elf","drow","dwarf","orc","goblin","gnome","halfling","tiefling","dragonborn","genasi",
  "aasimar","aarakocra","bugbear","goliath","grung","kenku","kobold","lizardfolk","monster","tabaxi",
  "undead","fey","touched","unknown","review","red","blue","green","gray","grey","white","black","pale",
  "dark","haired","hair","skinned","skin","hooded","robed","armored","coated","plainclothes",
]);

export function portraitText(value = "") {
  return String(value ?? "").trim();
}

export function normalizePortraitFacet(value = "") {
  return portraitText(value).toLowerCase();
}

export function titlePortraitFacet(value = "") {
  return portraitText(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function arrayValues(value) {
  return Array.isArray(value) ? value.map(normalizePortraitFacet).filter(Boolean) : [];
}

export function portraitSearchText(row = {}) {
  return [
    row?.name,
    row?.category,
    row?.recommended_use,
    ...(Array.isArray(row?.tags) ? row.tags : []),
    ...(Array.isArray(row?.species_tags) ? row.species_tags : []),
    ...(Array.isArray(row?.profession_tags) ? row.profession_tags : []),
    ...(Array.isArray(row?.theme_tags) ? row.theme_tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isMerchantFriendlyPortrait(row = {}) {
  const professions = new Set(arrayValues(row?.profession_tags));
  if ([...professions].some((tag) => MERCHANT_PROFESSIONS.has(tag))) return true;
  if (professions.has("merchant-friendly")) return true;
  const hay = portraitSearchText(row);
  return /\b(merchant|shopkeeper|trader|broker|smith|apothecary|herbalist|alchemist|jeweler|tavernkeeper|innkeeper|potter|candlemaker)\b/i.test(hay);
}

export function portraitFacetOptions(rows = []) {
  const species = new Set();
  const professions = new Set();
  const themes = new Set();

  for (const row of rows || []) {
    const rowSpecies = arrayValues(row?.species_tags);
    const rowProfessions = arrayValues(row?.profession_tags);
    const rowThemes = arrayValues(row?.theme_tags);

    if (!rowSpecies.length && row?.category) rowSpecies.push(normalizePortraitFacet(row.category));
    rowSpecies.forEach((value) => value && species.add(value));
    rowProfessions
      .filter((value) => value && value !== "merchant-friendly")
      .forEach((value) => professions.add(value));

    const suppress = new Set([...rowSpecies, ...rowProfessions, "merchant-friendly"]);
    rowThemes
      .filter((value) => {
        if (!value || suppress.has(value) || THEME_NOISE.has(value)) return false;
        if (/^\d+(?:\.png|\.jpg|\.jpeg|\.webp)?$/i.test(value)) return false;
        if (/\.(png|jpg|jpeg|webp)$/i.test(value)) return false;
        return value.length >= 3;
      })
      .forEach((value) => themes.add(value));
  }

  const sort = (set) => [...set].sort((a, b) => titlePortraitFacet(a).localeCompare(titlePortraitFacet(b)));
  return {
    species: sort(species),
    professions: sort(professions),
    themes: sort(themes),
  };
}

export function portraitMatchesFilters(row = {}, filters = {}, { assignedCount = 0, isCurrent = false } = {}) {
  const query = normalizePortraitFacet(filters.query);
  if (query && !portraitSearchText(row).includes(query)) return false;

  const species = normalizePortraitFacet(filters.species);
  if (species) {
    const speciesValues = arrayValues(row?.species_tags);
    const category = normalizePortraitFacet(row?.category);
    if (!speciesValues.includes(species) && category !== species) return false;
  }

  const profession = normalizePortraitFacet(filters.profession);
  if (profession && !arrayValues(row?.profession_tags).includes(profession)) return false;

  const theme = normalizePortraitFacet(filters.theme);
  if (theme && !arrayValues(row?.theme_tags).includes(theme)) return false;

  if (filters.merchantOnly && !isMerchantFriendlyPortrait(row)) return false;

  if (filters.assignment === "unassigned" && assignedCount > 0 && !isCurrent) return false;
  if (filters.assignment === "assigned" && assignedCount === 0 && !isCurrent) return false;
  if (filters.assignment === "current" && !isCurrent) return false;

  return true;
}

export function sortPortraitRows(rows = [], sort = "library", contextForRow = () => ({})) {
  const copy = [...(rows || [])];
  return copy.sort((a, b) => {
    const aContext = contextForRow(a) || {};
    const bContext = contextForRow(b) || {};

    if (sort === "name") {
      return portraitText(a?.name).localeCompare(portraitText(b?.name));
    }

    if (sort === "merchant") {
      const aMerchant = isMerchantFriendlyPortrait(a);
      const bMerchant = isMerchantFriendlyPortrait(b);
      if (aMerchant !== bMerchant) return aMerchant ? -1 : 1;
    }

    if (sort === "unassigned") {
      const aAssigned = Number(aContext.assignedCount || 0);
      const bAssigned = Number(bContext.assignedCount || 0);
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    }

    if (Boolean(aContext.isCurrent) !== Boolean(bContext.isCurrent)) return aContext.isCurrent ? -1 : 1;

    const aOrder = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 999999;
    const bOrder = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return portraitText(a?.name).localeCompare(portraitText(b?.name));
  });
}

export function portraitCardTags(row = {}, limit = 3) {
  const profession = arrayValues(row?.profession_tags).filter((value) => value !== "merchant-friendly");
  const theme = arrayValues(row?.theme_tags).filter((value) => !THEME_NOISE.has(value));
  return [...new Set([...profession, ...theme])].slice(0, limit);
}
