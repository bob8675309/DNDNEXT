import React from "react";
import dynamic from "next/dynamic";
import NpcPanel from "../NpcPanel";
import { resolveCraftProfession } from "../../utils/craftProfession";

const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });

function characterCraftPortraitUrl(character) {
  const direct = character?.portrait_shop_url || character?.portrait_thumb_url || character?.portrait_url || character?.image_url || "";
  if (direct) return direct;
  const storagePath = character?.portrait_storage_path || "";
  if (!storagePath) return "";
  const cleanPath = String(storagePath).replace(/^\/+/, "");
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ucggczovhmauhshvhusx.supabase.co";
  return `${baseUrl}/storage/v1/object/public/npc-portraits/${cleanPath}`;
}

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

function characterInteractionLabel(view) {
  switch (view) {
    case "sheet": return "Sheet & Rolls";
    case "inventory": return "Inventory";
    case "shop": return "Shop";
    case "craft": return "Craft";
    case "profile":
    default:
      return "Profile";
  }
}

export function buildCharacterInteractionTabs({ hasCraftCapability = false, hasShopCapability = false } = {}) {
  return CHARACTER_INTERACTION_VIEWS.filter((view) => {
    if (view === "craft") return !!hasCraftCapability;
    if (view === "shop") return !!hasShopCapability;
    return true;
  });
}

function CharacterInteractionTabs({ tabs = [], activeView = "profile", onSelectView = null }) {
  return React.createElement(
    "div",
    { className: "btn-group btn-group-sm character-interaction-tabs", role: "tablist", "aria-label": "Character interaction views" },
    tabs.map((view) => React.createElement(
      "button",
      {
        key: view,
        type: "button",
        className: `btn ${activeView === view ? "btn-primary" : "btn-outline-light"}`,
        onClick: () => typeof onSelectView === "function" ? onSelectView(view) : null,
      },
      characterInteractionLabel(view)
    ))
  );
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

function CharacterInteractionShell({ character = null, activeView = "profile", renderTabs = null, renderCraftView = null }) {
  let body = React.createElement(
    "div",
    { className: "npc-card character-interaction-shell-placeholder" },
    React.createElement("div", { className: "npc-card-title" }, character?.name || "Character"),
    React.createElement("div", { className: "text-muted" }, "Profile shell reserved for shared character interactions.")
  );

  if (activeView === "craft" && typeof renderCraftView === "function") {
    body = renderCraftView() || body;
  }

  return React.createElement(
    "div",
    { className: "character-interaction-shell" },
    typeof renderTabs === "function" ? renderTabs() : null,
    body
  );
}

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", onInteractionViewChange = null, useCharacterInteractionShell = false, ...props }) {
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

  const renderInteractionTabs = React.useCallback(() => React.createElement(CharacterInteractionTabs, {
    tabs: interactionTabs,
    activeView: interactionView,
    onSelectView: setSafeInteractionView,
  }), [interactionTabs, interactionView, setSafeInteractionView]);

  const renderCraftView = React.useCallback(() => {
    if (!hasCraftCapability) return null;
    const portraitUrl = characterCraftPortraitUrl(panelCharacter);
    return React.createElement(
      "div",
      { className: "character-craft-workspace-shell", "data-craft-profession": craftProfession || "" },
      React.createElement(
        "div",
        { className: "character-craft-workspace-frame", "data-has-portrait": portraitUrl ? "true" : "false" },
        portraitUrl ? React.createElement(
          "aside",
          { className: "character-craft-crafter-card" },
          React.createElement("img", { className: "character-craft-crafter-card__image", src: portraitUrl, alt: "" }),
          React.createElement("div", { className: "character-craft-crafter-card__name" }, panelCharacter?.name || "Crafter"),
          React.createElement("div", { className: "character-craft-crafter-card__discipline" }, craftProfession || "Craft")
        ) : null,
        React.createElement(
          "div",
          { className: "character-craft-workspace-main" },
          React.createElement(CraftingWorkspace, {
            mode: "panel",
            disciplineLock: craftProfession,
            crafterId: panelCharacterId,
            crafter: panelCharacter,
            isAdmin: !!props?.isAdmin,
            startView: "recipes",
            showDisciplineSwitcher: false,
          })
        )
      )
    );
  }, [craftProfession, hasCraftCapability, panelCharacter, panelCharacterId, props?.isAdmin]);

  if (useCharacterInteractionShell) {
    return React.createElement(CharacterInteractionShell, {
      character: panelCharacter,
      activeView: interactionView,
      renderTabs: renderInteractionTabs,
      renderCraftView,
    });
  }

  return React.createElement(NpcPanel, {
    ...props,
    npc: panelCharacter,
    initialView: interactionView,
    interactionView,
    interactionTabs,
    setInteractionView: setSafeInteractionView,
    renderInteractionTabs,
    craftProfession,
    hasCraftCapability,
    renderCraftView,
  });
}
