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
