const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];

const BOON_ENERGY_RESISTANCE_OPTIONS = Object.freeze([
  "Acid",
  "Cold",
  "Fire",
  "Lightning",
  "Necrotic",
  "Poison",
  "Psychic",
  "Radiant",
  "Thunder",
].map((label) => ({
  key: label.toLowerCase(),
  value: label.toLowerCase(),
  label,
  source: "XPHB",
  kind: "energy-resistance",
})));

// Echoing Soul grants one additional language chosen from the Player's Handbook
// language tables. Common is omitted because player characters already know it,
// so it cannot satisfy an "additional language" grant.
const PHB_ADDITIONAL_LANGUAGE_OPTIONS = Object.freeze([
  "Common Sign Language",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Deep Speech",
  "Druidic",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Thieves' Cant",
  "Undercommon",
].map((label) => ({
  key: norm(label).replace(/\s+/g, "-"),
  value: label,
  label,
  source: "XPHB",
  kind: "language",
})));

export function normalizeFeatSourceChoiceGroups(groups = []) {
  return array(groups).map((group) => {
    if (group?.ownerType !== "feat") return group;
    const featName = norm(group?.metadata?.featName || group?.label);
    const fields = array(group?.fields);

    if (featName === "skilled" && fields.some((field) => field?.id === "skills-or-tools")) {
      return {
        ...group,
        fields: fields.filter((field) => !(String(field?.id || "").startsWith("skill-") && field?.kind === "skill")),
        metadata: {
          ...(group.metadata || {}),
          normalizedChoiceShape: "skilled-mixed-three",
        },
      };
    }

    if (featName === "resilient" && fields.some((field) => field?.id === "resilient-ability")) {
      return {
        ...group,
        fields: fields.filter((field) => !(String(field?.id || "").startsWith("ability-") && field?.kind === "ability")),
        metadata: {
          ...(group.metadata || {}),
          normalizedChoiceShape: "resilient-single-ability",
        },
      };
    }

    if (featName === "boon of energy resistance") {
      const withoutLegacyResistanceFields = fields.filter((field) => field?.id !== "energy-resistances");
      return {
        ...group,
        fields: [
          ...withoutLegacyResistanceFields,
          {
            id: "energy-resistances",
            label: "Choose two Energy Resistances",
            kind: "energy-resistance",
            count: 2,
            required: true,
            options: BOON_ENERGY_RESISTANCE_OPTIONS,
            placement: group.placement || "advancement",
            cadence: "acquisition",
            replacementCadence: "long_rest",
            helper: "Choose two damage types for the Boon's initial resistances. After a Long Rest, both choices may be changed through the character sheet.",
            metadata: {
              runtimeFeature: "boon-energy-resistance",
              runtimeInitial: true,
              distinct: true,
            },
          },
        ],
        metadata: {
          ...(group.metadata || {}),
          normalizedChoiceShape: "boon-energy-resistance-runtime-pair",
        },
      };
    }

    if (featName === "echoing soul") {
      const sourceSkillField = fields.find((field) => field?.kind === "skill" && array(field?.options).length);
      const skillOptions = array(sourceSkillField?.options);
      const retained = fields.filter((field) => !(
        field?.kind === "skill"
        || field?.id === "echoing-language"
        || field?.id === "echoing-expertise"
      ));
      if (!skillOptions.length) return group;
      return {
        ...group,
        fields: [
          ...retained,
          {
            ...sourceSkillField,
            id: "echoing-skills",
            label: "Choose two skill proficiencies",
            kind: "skill",
            count: 2,
            required: true,
            cadence: "acquisition",
            helper: "Echoing Soul permanently grants proficiency in two skills of your choice.",
            metadata: {
              ...(sourceSkillField?.metadata || {}),
              sourceFeature: "Channeled Prowess",
              permanent: true,
            },
          },
          {
            id: "echoing-language",
            label: "Choose one additional PHB language",
            kind: "language",
            count: 1,
            required: true,
            options: PHB_ADDITIONAL_LANGUAGE_OPTIONS,
            placement: group.placement || "advancement",
            cadence: "acquisition",
            helper: "Inherent Tongues permanently grants one additional language from the Player's Handbook language tables.",
            metadata: {
              sourceFeature: "Inherent Tongues",
              permanent: true,
            },
          },
          {
            id: "echoing-expertise",
            label: "Choose a proficient skill for Expertise",
            kind: "runtime-expertise",
            count: 1,
            required: true,
            options: skillOptions.map((option) => ({ ...option, kind: "runtime-expertise" })),
            placement: group.placement || "advancement",
            cadence: "acquisition",
            replacementCadence: "long_rest",
            helper: "Choose a skill you are proficient in, including either skill granted above. After a Long Rest, this Expertise choice may be changed.",
            metadata: {
              runtimeFeature: "echoing-soul-expertise",
              runtimeInitial: true,
              requiresExistingOrGrantedProficiency: true,
            },
          },
        ],
        metadata: {
          ...(group.metadata || {}),
          normalizedChoiceShape: "echoing-soul-two-skills-language-runtime-expertise",
        },
      };
    }

    return group;
  });
}
