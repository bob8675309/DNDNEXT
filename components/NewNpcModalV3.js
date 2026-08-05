import { useCallback, useEffect, useMemo, useState } from "react";
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

function tagSlug(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function playerPayload(payload = {}) {
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const meta = sheet.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  const professions = sheet.professions && typeof sheet.professions === "object" ? sheet.professions : {};
  const tags = [
    "player-character",
    tagSlug(meta.speciesKey || sheet.species || sheet.race) ? `species:${tagSlug(meta.speciesKey || sheet.species || sheet.race)}` : "",
    tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class) ? `class:${tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class)}` : "",
    tagSlug(meta.backgroundKey || sheet.background) ? `background:${tagSlug(meta.backgroundKey || sheet.background)}` : "",
    ...Object.entries(professions)
      .filter(([, entry]) => Number(entry?.rank || 0) > 0)
      .map(([key]) => `profession:${tagSlug(key)}`),
  ].filter(Boolean);
  const casting = Boolean(sheet.spellcasting?.ability || sheet.spellcasting?.abilityLabel);
  return {
    ...payload,
    kind: "npc",
    tags: [...new Set(tags)],
    storefront_enabled: false,
    storefront_title: null,
    storefront_tagline: null,
    location_id: null,
    home_location_id: null,
    is_hidden: true,
    state: "resting",
    role: String(payload.role || sheet.className || sheet.class || "Adventurer").trim() || "Adventurer",
    sheet: {
      ...sheet,
      meta: {
        ...(sheet.meta || {}),
        creator: "shared_character_forge_player_v2",
        startingSpellSelectionPending: casting,
      },
    },
  };
}

export default function NewNpcModalV3(props) {
  const show = Boolean(props?.show);
  const playerMode = props?.mode === "player";
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
  const createCharacter = useCallback((payload) => {
    if (!playerMode) return supabase.rpc("create_character_v1", { p_payload: payload });
    return supabase.rpc("create_player_character_v2", {
      p_payload: playerPayload(payload),
      p_spell_choices: [],
    });
  }, [playerMode]);

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
    await props.onCreated?.(created);
    Promise.race([
      persistSpeciesChoices(created, snapshot),
      new Promise((_, reject) => setTimeout(() => reject(new Error("species choice persistence timeout")), 5000)),
    ]).catch((error) => console.error("Could not persist species choices after character creation", error));
  }

  return (
    <NpcForgeSpeciesChoiceContext.Provider value={contextValue}>
      <div className={playerMode ? "unified-player-character-forge" : undefined}>
        <NewNpcModalV3Refined
          {...props}
          mode={playerMode ? "player" : "npc"}
          createCharacter={createCharacter}
          onReset={() => setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} })}
          onCreated={handleCreated}
        />
      </div>
      <style jsx global>{`
        .npc-forge-context-row-details{width:100%!important;min-width:0!important;grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-row.is-interactive:hover>.npc-forge-context-row-details,.npc-forge-context-row.is-interactive[open]>.npc-forge-context-row-details{display:flex!important;flex-direction:column!important;align-items:stretch!important}
        .npc-forge-context-row-details>*,.npc-forge-context-row-details article,.npc-forge-context-choice-stack,.npc-forge-context-choice-stack section,.npc-forge-context-choice-grid,.npc-forge-context-choice-grid.feats{width:100%!important;min-width:0!important;max-width:none!important}
        .npc-forge-context-choice-grid.feats{display:grid!important;grid-template-columns:minmax(0,1fr)!important}
        .npc-forge-context-choice-grid.feats button{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;width:100%!important;min-width:0!important;max-width:none!important;white-space:normal!important}
        .npc-forge-context-choice-grid button strong,.npc-forge-context-choice-grid button small,.npc-forge-context-choice-grid button span,.npc-forge-context-row-details article p,.npc-forge-background-spell-body span{width:100%!important;min-width:0!important;max-width:none!important;overflow-wrap:anywhere!important;word-break:normal!important;white-space:normal!important}
        .npc-forge-context-choice-grid.feats button span{max-height:12rem!important;overflow:auto!important;padding-right:4px!important;line-height:1.55!important}
        .npc-forge-background-spell-body>div{grid-template-columns:92px minmax(0,1fr)!important}
        .unified-player-character-forge .npc-forge-backdrop{position:static!important;inset:auto!important;display:block!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;background:none!important;backdrop-filter:none!important}
        .unified-player-character-forge .npc-forge-modal-v2{width:100%!important;max-width:none!important}
        .unified-player-character-forge .npc-forge-choice-grid.two,.unified-player-character-forge .npc-forge-merchant-box{display:none!important}
        .unified-player-character-forge .npc-forge-service-toggle{display:none!important}
        @media(max-width:720px){.npc-forge-background-spell-body>div{grid-template-columns:1fr!important}}
      `}</style>
    </NpcForgeSpeciesChoiceContext.Provider>
  );
}
