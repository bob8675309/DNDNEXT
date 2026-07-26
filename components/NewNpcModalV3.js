import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import NewNpcModalV3Refined from "./NewNpcModalV3Refined";
import {
  EMPTY_SPECIES_CHOICE_STATE,
  NpcForgeSpeciesChoiceContext,
  serializeSpeciesChoiceState,
  speciesChoiceStateComplete,
  speciesSpellcastingFromChoiceState,
} from "./NpcForgeSpeciesChoiceContext";

function normalizeSpeciesChoiceState(species, rules = [], previous = EMPTY_SPECIES_CHOICE_STATE) {
  if (!species) return { speciesId: "", speciesName: "", rules: [], selections: {} };
  const speciesId = String(species.id || species.name || "");
  const sameSpecies = speciesId && speciesId === previous.speciesId;
  const validRules = Array.isArray(rules) ? rules : [];
  const selections = sameSpecies ? { ...(previous.selections || {}) } : {};
  for (const rule of validRules) {
    const prior = selections[rule.id] || {};
    selections[rule.id] = Object.fromEntries((rule.fields || []).flatMap((field) => {
      const selected = prior[field.id];
      if (!selected) return [];
      return (field.options || []).some((option) => option.value === selected) ? [[field.id, selected]] : [];
    }));
  }
  return { speciesId, speciesName: species.name || "", rules: validRules, selections };
}

async function persistSpeciesChoices(created, choiceState) {
  if (!created?.id || !(choiceState.rules || []).length || !speciesChoiceStateComplete(choiceState)) return;
  const serializedChoices = serializeSpeciesChoiceState(choiceState);
  const speciesSpells = speciesSpellcastingFromChoiceState(choiceState);
  const { data, error: readError } = await supabase.from("character_sheets").select("sheet").eq("character_id", created.id).single();
  if (readError) throw readError;
  const sheet = data?.sheet && typeof data.sheet === "object" ? data.sheet : {};
  if (choiceState.speciesName && sheet.species && String(sheet.species).toLowerCase() !== String(choiceState.speciesName).toLowerCase()) return;
  const nextSheet = {
    ...sheet,
    speciesTraitChoices: serializedChoices,
    speciesSpells,
    speciesSpellcasting: speciesSpells.length ? { source: "species", spells: speciesSpells } : sheet.speciesSpellcasting || null,
    meta: { ...(sheet.meta || {}), speciesTraitChoices: serializedChoices },
  };
  const { error: updateError } = await supabase.from("character_sheets").update({ sheet: nextSheet }).eq("character_id", created.id);
  if (updateError) throw updateError;
}

export default function NewNpcModalV3(props) {
  const show = Boolean(props?.show);
  const [speciesChoiceState, setSpeciesChoiceState] = useState(() => ({ speciesId: "", speciesName: "", rules: [], selections: {} }));
  const choiceStateRef = useRef(speciesChoiceState);
  useEffect(() => { choiceStateRef.current = speciesChoiceState; }, [speciesChoiceState]);
  useEffect(() => { if (!show) setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} }); }, [show]);

  const registerSpecies = useCallback((species, rules = []) => {
    setSpeciesChoiceState((current) => normalizeSpeciesChoiceState(species, rules, current));
  }, []);
  const selectChoice = useCallback((ruleId, fieldId, value) => {
    setSpeciesChoiceState((current) => ({
      ...current,
      selections: { ...(current.selections || {}), [ruleId]: { ...(current.selections?.[ruleId] || {}), [fieldId]: value } },
    }));
  }, []);
  const contextValue = useMemo(() => ({ state: speciesChoiceState, registerSpecies, selectChoice }), [registerSpecies, selectChoice, speciesChoiceState]);

  useEffect(() => {
    if (!show || typeof document === "undefined") return undefined;
    function blockIncompleteSpeciesChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const modal = button.closest(".npc-forge-modal-v2");
      const currentStep = modal?.querySelector(".npc-forge-steps button.is-current")?.textContent || "";
      const state = choiceStateRef.current;
      if (!/Species/i.test(currentStep) || !(state.rules || []).length || speciesChoiceStateComplete(state)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      modal?.querySelector(".npc-forge-species-choice.is-required")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteSpeciesChoice, true);
    return () => document.removeEventListener("click", blockIncompleteSpeciesChoice, true);
  }, [show]);

  async function handleCreated(created) {
    const snapshot = choiceStateRef.current;
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    // Close/reconcile the parent immediately; species-choice persistence is a bounded post-create overlay.
    await props.onCreated?.(created);
    Promise.race([
      persistSpeciesChoices(created, snapshot),
      new Promise((_, reject) => setTimeout(() => reject(new Error("species choice persistence timeout")), 5000)),
    ]).catch((error) => console.error("Could not persist species choices after NPC creation", error));
  }

  return (
    <NpcForgeSpeciesChoiceContext.Provider value={contextValue}>
      <NewNpcModalV3Refined {...props} onCreated={handleCreated} />
      <style jsx global>{`
        .npc-forge-context-row-details{width:100%!important;min-width:0!important;grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-row.is-interactive:hover>.npc-forge-context-row-details,.npc-forge-context-row.is-interactive[open]>.npc-forge-context-row-details{display:flex!important;flex-direction:column!important;align-items:stretch!important}
        .npc-forge-context-row-details>*,.npc-forge-context-row-details article,.npc-forge-context-choice-stack,.npc-forge-context-choice-stack section,.npc-forge-context-choice-grid,.npc-forge-context-choice-grid.feats{width:100%!important;min-width:0!important;max-width:none!important}
        .npc-forge-context-choice-grid.feats{display:grid!important;grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-choice-grid.feats button{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;width:100%!important;min-width:0!important;max-width:none!important;white-space:normal!important}
        .npc-forge-context-choice-grid button strong,.npc-forge-context-choice-grid button small,.npc-forge-context-choice-grid button span,.npc-forge-context-row-details article p,.npc-forge-background-spell-body span{width:100%!important;min-width:0!important;max-width:none!important;overflow-wrap:anywhere!important;word-break:normal!important;white-space:normal!important}
        .npc-forge-context-choice-grid.feats button span{max-height:12rem!important;overflow:auto!important;padding-right:4px!important;line-height:1.55!important}
        .npc-forge-background-spell-body>div{grid-template-columns:92px minmax(0,1fr)!important}
        @media(max-width:720px){.npc-forge-background-spell-body>div{grid-template-columns:1fr!important}}
      `}</style>
    </NpcForgeSpeciesChoiceContext.Provider>
  );
}
