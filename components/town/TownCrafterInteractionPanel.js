import React from "react";
import dynamic from "next/dynamic";
import styles from "../TownSheet.module.scss";

const CharacterInteractionPanel = dynamic(() => import("../character/CharacterInteractionPanel"), { ssr: false });

function normalizeCrafterText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectCrafterTokens(crafter) {
  const values = [];
  const push = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(push);
      return;
    }
    values.push(value);
  };

  push(crafter?.craft_profession);
  push(crafter?.crafting_profession);
  push(crafter?.profession);
  push(crafter?.professions);
  push(crafter?.crafterTypes);
  push(crafter?.craft_roles);
  push(crafter?.craftRoles);
  push(crafter?.crafter_roles);
  push(crafter?.crafterRoles);
  push(crafter?.workshop_roles);
  push(crafter?.workshopRoles);
  push(crafter?.services);
  push(crafter?.tags);
  push(crafter?.role);
  push(crafter?.name);

  return values.map(normalizeCrafterText).filter(Boolean);
}

export function townCrafterProfessionFor(crafter) {
  const blob = collectCrafterTokens(crafter).join(" | ");
  if (!blob) return "";
  if (/smith|blacksmith|weapon smith|weaponsmith|armor smith|armorsmith|armourer|armorer|forge|forgemaster|temper/.test(blob)) return "Smithing";
  if (/alchemy|alchemist|apothecary|herbalist|potion|poison|elixir|oil|bomb/.test(blob)) return "Alchemy";
  if (/enchant|enchanter|enchantress|imbue|arcane artisan|runecrafter|rune crafter|runesmith|rune smith/.test(blob)) return "Enchanting";
  if (/scribe|scroll|spellbook|inkwright|scrivener/.test(blob)) return "Scribe";
  return "";
}

export function townCrafterInteractionCharacter(crafter) {
  const craftProfession = townCrafterProfessionFor(crafter);
  return {
    ...(crafter || {}),
    craft_profession: craftProfession,
    profession: craftProfession || crafter?.profession || "",
    role: crafter?.role || craftProfession || "Crafter",
  };
}

export default function TownCrafterInteractionPanel({ crafter = null, isAdmin = false, onClose = null }) {
  if (!crafter) return null;

  return React.createElement(
    "div",
    { className: styles.modalBackdrop, onClick: onClose },
    React.createElement(
      "div",
      { className: styles.crafterModal, onClick: (event) => event.stopPropagation() },
      React.createElement(CharacterInteractionPanel, {
        npc: townCrafterInteractionCharacter(crafter),
        isAdmin,
        initialView: "craft",
        onClose,
      })
    )
  );
}
