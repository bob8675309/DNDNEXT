import { createContext, useContext } from "react";
import { speciesTraitChoiceRuleComplete } from "../utils/speciesPresentation";

export const EMPTY_SPECIES_CHOICE_STATE = Object.freeze({
  speciesId: "",
  speciesName: "",
  rules: Object.freeze([]),
  selections: Object.freeze({}),
});

export function speciesChoiceStateComplete(state = EMPTY_SPECIES_CHOICE_STATE) {
  return (state.rules || []).every((rule) => speciesTraitChoiceRuleComplete(rule, state.selections || {}));
}

export function serializeSpeciesChoiceState(state = EMPTY_SPECIES_CHOICE_STATE) {
  const output = {};
  for (const rule of state.rules || []) {
    const selected = state.selections?.[rule.id] || {};
    output[rule.id] = {
      trait: rule.traitName,
      ...Object.fromEntries((rule.fields || []).map((field) => [field.id, selected[field.id] || null])),
    };
  }
  return output;
}

function selectedValuesByKind(state, kind) {
  const values = [];
  for (const rule of state.rules || []) {
    const selected = state.selections?.[rule.id] || {};
    for (const field of rule.fields || []) {
      if (field.kind !== kind || !selected[field.id]) continue;
      const option = (field.options || []).find((candidate) => candidate.value === selected[field.id]);
      values.push({
        value: selected[field.id],
        label: option?.label || selected[field.id],
        source: option?.source || "XPHB",
        trait: rule.traitName,
      });
    }
  }
  return values;
}

export function speciesSkillChoicesFromState(state = EMPTY_SPECIES_CHOICE_STATE) {
  return selectedValuesByKind(state, "skill");
}

export function speciesFeatChoicesFromState(state = EMPTY_SPECIES_CHOICE_STATE) {
  return selectedValuesByKind(state, "origin-feat");
}

export function speciesSpellcastingFromChoiceState(state = EMPTY_SPECIES_CHOICE_STATE) {
  const spells = [];
  for (const rule of state.rules || []) {
    const selected = state.selections?.[rule.id] || {};
    const spellField = (rule.fields || []).find((field) => field.kind === "spell");
    const abilityField = (rule.fields || []).find((field) => field.kind === "ability");
    const spellName = spellField ? selected[spellField.id] : "";
    if (!spellName) continue;
    spells.push({
      name: spellName,
      level: 0,
      sourceTrait: rule.traitName,
      ability: abilityField ? selected[abilityField.id] || null : null,
      known: true,
      atWill: true,
    });
  }
  return spells;
}

export const NpcForgeSpeciesChoiceContext = createContext({
  state: EMPTY_SPECIES_CHOICE_STATE,
  registerSpecies: () => {},
  selectChoice: () => {},
});

export function useNpcForgeSpeciesChoices() {
  return useContext(NpcForgeSpeciesChoiceContext);
}
