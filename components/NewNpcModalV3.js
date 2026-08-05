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
import {
  classChoiceStateComplete,
  classChoiceStateRequiresSelection,
  EMPTY_CLASS_CHOICE_STATE,
  NpcForgeClassChoiceContext,
  selectedSubclassOption,
} from "./NpcForgeClassChoiceContext";

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

function normalizeClassChoiceState(classRow, options = [], level = 1, catalogReady = false, previous = EMPTY_CLASS_CHOICE_STATE) {
  if (!classRow) return { ...EMPTY_CLASS_CHOICE_STATE, options: [] };
  const classId = String(classRow.id || classRow.class_key || classRow.class_name || "");
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const validOptions = Array.isArray(options) ? options : [];
  const sameClass = classId && classId === previous.classId;
  const selected = sameClass ? validOptions.find((option) => option.key === previous.selectedKey) : null;
  const selectedKey = selected && Number(selected.firstLevel || 1) <= resolvedLevel ? selected.key : "";
  return {
    classId,
    classKey: classRow.class_key || "",
    className: classRow.class_name || "",
    classSource: classRow.source || "",
    level: resolvedLevel,
    options: validOptions,
    catalogReady: Boolean(catalogReady),
    selectedKey,
  };
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

function payloadWithSubclass(payload = {}, classChoiceState = EMPTY_CLASS_CHOICE_STATE) {
  const selected = selectedSubclassOption(classChoiceState);
  if (!selected) return payload;
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  return {
    ...payload,
    sheet: {
      ...sheet,
      subclassName: selected.name,
      subclassSource: selected.source,
      meta: {
        ...(sheet.meta || {}),
        subclassKey: selected.key,
        subclassName: selected.name,
        subclassSource: selected.source,
        subclassEntryLevel: Number(selected.firstLevel || 1),
      },
    },
  };
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
  const [classChoiceState, setClassChoiceState] = useState(() => ({ ...EMPTY_CLASS_CHOICE_STATE, options: [] }));
  const choiceStateRef = useRef(speciesChoiceState);
  const classChoiceStateRef = useRef(classChoiceState);
  useEffect(() => { choiceStateRef.current = speciesChoiceState; }, [speciesChoiceState]);
  useEffect(() => { classChoiceStateRef.current = classChoiceState; }, [classChoiceState]);
  useEffect(() => {
    if (show) return;
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    setClassChoiceState({ ...EMPTY_CLASS_CHOICE_STATE, options: [] });
  }, [show]);

  const registerSpecies = useCallback((species, rules = []) => {
    setSpeciesChoiceState((current) => normalizeSpeciesChoiceState(species, rules, current));
  }, []);
  const selectChoice = useCallback((ruleId, fieldId, value) => {
    setSpeciesChoiceState((current) => ({
      ...current,
      selections: { ...(current.selections || {}), [ruleId]: { ...(current.selections?.[ruleId] || {}), [fieldId]: value } },
    }));
  }, []);
  const registerClass = useCallback((classRow, options = [], level = 1, catalogReady = false) => {
    setClassChoiceState((current) => normalizeClassChoiceState(classRow, options, level, catalogReady, current));
  }, []);
  const selectSubclass = useCallback((option) => {
    setClassChoiceState((current) => {
      if (!option) return { ...current, selectedKey: "" };
      const eligible = (current.options || []).find((candidate) => candidate.key === option.key && Number(candidate.firstLevel || 1) <= Number(current.level || 1));
      return eligible ? { ...current, selectedKey: eligible.key } : current;
    });
  }, []);
  const speciesContextValue = useMemo(() => ({ state: speciesChoiceState, registerSpecies, selectChoice }), [registerSpecies, selectChoice, speciesChoiceState]);
  const classContextValue = useMemo(() => ({ state: classChoiceState, registerClass, selectSubclass }), [classChoiceState, registerClass, selectSubclass]);

  const createCharacter = useCallback((payload) => {
    const enrichedPayload = payloadWithSubclass(payload, classChoiceStateRef.current);
    if (!playerMode) return supabase.rpc("create_character_v1", { p_payload: enrichedPayload });
    return supabase.rpc("create_player_character_v2", {
      p_payload: playerPayload(enrichedPayload),
      p_spell_choices: [],
    });
  }, [playerMode]);

  useEffect(() => {
    if (!show || typeof document === "undefined") return undefined;
    function blockIncompleteRequiredChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const modal = button.closest(".npc-forge-modal-v2");
      const currentStep = modal?.querySelector(".npc-forge-steps button.is-current")?.textContent || "";
      const speciesState = choiceStateRef.current;
      if (/Species/i.test(currentStep) && (speciesState.rules || []).length && !speciesChoiceStateComplete(speciesState)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        modal?.querySelector(".npc-forge-species-choice.is-required")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        return;
      }
      const classState = classChoiceStateRef.current;
      if (playerMode && /Class/i.test(currentStep) && classState.classId && !classChoiceStateComplete(classState)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const target = classChoiceStateRequiresSelection(classState)
          ? modal?.querySelector(".npc-forge-class-guide__subclasses.is-required")
          : modal?.querySelector(".npc-forge-class-guide");
        target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }
    }
    document.addEventListener("click", blockIncompleteRequiredChoice, true);
    return () => document.removeEventListener("click", blockIncompleteRequiredChoice, true);
  }, [playerMode, show]);

  async function handleCreated(created) {
    const snapshot = choiceStateRef.current;
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    setClassChoiceState({ ...EMPTY_CLASS_CHOICE_STATE, options: [] });
    await props.onCreated?.(created);
    Promise.race([
      persistSpeciesChoices(created, snapshot),
      new Promise((_, reject) => setTimeout(() => reject(new Error("species choice persistence timeout")), 5000)),
    ]).catch((error) => console.error("Could not persist species choices after character creation", error));
  }

  function resetChoiceState() {
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    setClassChoiceState({ ...EMPTY_CLASS_CHOICE_STATE, options: [] });
  }

  return (
    <NpcForgeSpeciesChoiceContext.Provider value={speciesContextValue}>
      <NpcForgeClassChoiceContext.Provider value={classContextValue}>
        <div className={playerMode ? "unified-player-character-forge" : undefined}>
          <NewNpcModalV3Refined
            {...props}
            mode={playerMode ? "player" : "npc"}
            createCharacter={createCharacter}
            onReset={resetChoiceState}
            onCreated={handleCreated}
          />
        </div>
      </NpcForgeClassChoiceContext.Provider>
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
