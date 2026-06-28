import React from "react";
import NpcPanel from "../NpcPanel";

export const CHARACTER_INTERACTION_VIEWS = ["profile", "sheet", "inventory", "shop", "craft"];

export function normalizeCharacterInteractionView(value) {
  const view = String(value || "profile").trim().toLowerCase();
  return CHARACTER_INTERACTION_VIEWS.includes(view) ? view : "profile";
}

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", ...props }) {
  const panelCharacter = character || npc;
  return React.createElement(NpcPanel, {
    ...props,
    npc: panelCharacter,
    initialView: normalizeCharacterInteractionView(initialView),
  });
}
