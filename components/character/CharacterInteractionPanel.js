import React from "react";
import NpcPanel from "../NpcPanel";
import { resolveCraftProfession } from "../../utils/craftProfession";

export const CHARACTER_INTERACTION_VIEWS = ["profile", "sheet", "inventory", "shop", "craft"];

export function normalizeCharacterInteractionView(value) {
  const view = String(value || "profile").trim().toLowerCase();
  return CHARACTER_INTERACTION_VIEWS.includes(view) ? view : "profile";
}

function sheetForCraftResolution(character) {
  return character?.character_sheet || character?.sheet || character?.sheet_json || {};
}

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", onInteractionViewChange = null, ...props }) {
  const panelCharacter = character || npc;
  const panelCharacterId = panelCharacter?.id || null;
  const craftProfession = resolveCraftProfession(panelCharacter || {}, sheetForCraftResolution(panelCharacter));
  const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";
  const requestedView = normalizeCharacterInteractionView(initialView);
  const safeInitialView = requestedView === "craft" && !hasCraftCapability ? "profile" : requestedView;
  const [interactionView, setInteractionView] = React.useState(() => safeInitialView);

  React.useEffect(() => {
    setInteractionView(safeInitialView);
  }, [safeInitialView, panelCharacterId]);

  const setSafeInteractionView = React.useCallback((nextView) => {
    const normalized = normalizeCharacterInteractionView(nextView);
    const safeView = normalized === "craft" && !hasCraftCapability ? "profile" : normalized;
    setInteractionView(safeView);
    if (typeof onInteractionViewChange === "function") onInteractionViewChange(safeView);
  }, [hasCraftCapability, onInteractionViewChange]);

  return React.createElement(NpcPanel, {
    ...props,
    npc: panelCharacter,
    initialView: interactionView,
    interactionView,
    setInteractionView: setSafeInteractionView,
    craftProfession,
    hasCraftCapability,
  });
}
