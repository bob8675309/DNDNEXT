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

function playerPayload(payload = {}) {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const casting = Boolean(sheet.spellcasting?.ability || sheet.spellcasting?.abilityLabel);
  return {
    ...payload,
    kind: "npc",
    tags: [...new Set([...tags, "player-character"])],
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

function adaptPlayerForge(root) {
  if (!root) return;
  root.classList.add("is-player-character-forge");
  const heading = root.querySelector("#npc-forge-title");
  if (heading) {
    heading.id = "player-forge-title";
    heading.textContent = "Player Character Forge";
  }
  const headerCopy = root.querySelector(".npc-forge-header p");
  if (headerCopy) headerCopy.textContent = "Build a player-owned character with the shared canonical Forge. Starting level may be set from 1 to 20.";
  const nav = root.querySelector(".npc-forge-steps");
  if (nav) nav.setAttribute("aria-label", "Player character creation steps");
  root.querySelectorAll("button").forEach((button) => {
    const label = button.textContent?.trim() || "";
    if (label === "Create NPC" || label === "Create Merchant") button.textContent = "Create Player Character";
    if (label === "Generate NPC story & world fit") button.textContent = "Generate character story & world fit";
  });
  root.querySelectorAll(".npc-forge-section-heading p, .npc-forge-story-actions p, .npc-forge-review-grid p").forEach((node) => {
    node.textContent = node.textContent?.replace(/\bNPC\b/g, "character") || "";
  });
}

export default function NewNpcModalV3(props) {
  const show = Boolean(props?.show);
  const playerMode = props?.mode === "player";
  const rootRef = useRef(null);
  const originalRpcRef = useRef(null);
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

  useEffect(() => {
    if (!show || !playerMode) return undefined;
    const originalRpc = supabase.rpc.bind(supabase);
    originalRpcRef.current = originalRpc;
    supabase.rpc = (functionName, args, options) => {
      if (functionName !== "create_character_v1") return originalRpc(functionName, args, options);
      return originalRpc("create_player_character_v2", {
        p_payload: playerPayload(args?.p_payload || {}),
        p_spell_choices: [],
      }, options);
    };
    return () => {
      if (originalRpcRef.current) supabase.rpc = originalRpcRef.current;
      originalRpcRef.current = null;
    };
  }, [playerMode, show]);

  useEffect(() => {
    if (!show || !playerMode || typeof MutationObserver === "undefined") return undefined;
    const container = rootRef.current;
    const apply = () => adaptPlayerForge(container?.querySelector(".npc-forge-modal-v2"));
    apply();
    const observer = new MutationObserver(apply);
    if (container) observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [playerMode, show]);

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
      <div ref={rootRef} className={playerMode ? "unified-player-character-forge" : undefined}>
        <NewNpcModalV3Refined {...props} onCreated={handleCreated} />
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
        .unified-player-character-forge .npc-forge-choice-grid.two,.unified-player-character-forge .npc-forge-profession-list,.unified-player-character-forge .npc-forge-merchant-box{display:none!important}
        .unified-player-character-forge .npc-forge-service-toggle{display:none!important}
        @media(max-width:720px){.npc-forge-background-spell-body>div{grid-template-columns:1fr!important}}
      `}</style>
    </NpcForgeSpeciesChoiceContext.Provider>
  );
}
