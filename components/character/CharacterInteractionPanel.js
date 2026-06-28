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

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", ...props }) {
  const panelCharacter = character || npc;
  const craftProfession = resolveCraftProfession(panelCharacter || {}, sheetForCraftResolution(panelCharacter));
  const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";

  return React.createElement(NpcPanel, {
    ...props,
    npc: panelCharacter,
    initialView: normalizeCharacterInteractionView(initialView),
    craftProfession,
    hasCraftCapability,
  });
}
