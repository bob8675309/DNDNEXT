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

function isMerchantCharacter(character) {
  return String(character?.kind || character?.type || "").toLowerCase() === "merchant";
}

export function buildCharacterInteractionTabs({ hasCraftCapability = false, hasShopCapability = false } = {}) {
  return CHARACTER_INTERACTION_VIEWS.filter((view) => {
    if (view === "craft") return !!hasCraftCapability;
    if (view === "shop") return !!hasShopCapability;
    return true;
  });
}

function CharacterCraftShell({ craftProfession = "" }) {
  return React.createElement(
    "div",
    { className: "npc-card character-craft-shell", "data-craft-profession": craftProfession || "" },
    React.createElement("div", { className: "npc-card-title" }, "Craft"),
    React.createElement(
      "div",
      { className: "text-muted" },
      craftProfession ? `Crafting workspace reserved for ${craftProfession}.` : "Crafting workspace reserved."
    )
  );
}

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", onInteractionViewChange = null, ...props }) {
  const panelCharacter = character || npc;
  const panelCharacterId = panelCharacter?.id || null;
  const craftProfession = resolveCraftProfession(panelCharacter || {}, sheetForCraftResolution(panelCharacter));
  const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";
  const hasShopCapability = isMerchantCharacter(panelCharacter);
  const interactionTabs = React.useMemo(
    () => buildCharacterInteractionTabs({ hasCraftCapability, hasShopCapability }),
    [hasCraftCapability, hasShopCapability]
  );
  const requestedView = normalizeCharacterInteractionView(initialView);
  const safeInitialView = interactionTabs.includes(requestedView) ? requestedView : "profile";
  const [interactionView, setInteractionView] = React.useState(() => safeInitialView);

  React.useEffect(() => {
    setInteractionView(safeInitialView);
  }, [safeInitialView, panelCharacterId]);

  const setSafeInteractionView = React.useCallback((nextView) => {
    const normalized = normalizeCharacterInteractionView(nextView);
    const safeView = interactionTabs.includes(normalized) ? normalized : "profile";
    setInteractionView(safeView);
    if (typeof onInteractionViewChange === "function") onInteractionViewChange(safeView);
  }, [interactionTabs, onInteractionViewChange]);

  const renderCraftView = React.useCallback(() => {
    if (!hasCraftCapability) return null;
    return React.createElement(CharacterCraftShell, { craftProfession });
  }, [craftProfession, hasCraftCapability]);

  return React.createElement(NpcPanel, {
    ...props,
    npc: panelCharacter,
    initialView: interactionView,
    interactionView,
    interactionTabs,
    setInteractionView: setSafeInteractionView,
    craftProfession,
    hasCraftCapability,
    renderCraftView,
  });
}
