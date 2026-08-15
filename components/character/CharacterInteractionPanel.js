import React from "react";
import dynamic from "next/dynamic";
import NpcPanel from "../NpcPanel";
import { resolveCraftProfession } from "../../utils/craftProfession";
import { supabase } from "../../utils/supabaseClient";
import { CharacterInteractionContext } from "./CharacterInteractionContext";

const CraftingWorkspace = dynamic(() => import("../CraftingWorkspace"), { ssr: false });
const CharacterClassWorkspace = dynamic(() => import("../CharacterClassWorkspace"), { ssr: false });
const CharacterSpellbookPanel = dynamic(() => import("../CharacterSpellbookPanel"), { ssr: false });
const CharacterFeaturesPanel = dynamic(() => import("../CharacterFeaturesPanel"), { ssr: false });

function characterCraftPortraitUrl(character) {
  const direct = character?.portrait_shop_url || character?.portrait_thumb_url || character?.portrait_url || character?.image_url || "";
  if (direct) return direct;
  const storagePath = character?.portrait_storage_path || "";
  if (!storagePath) return "";
  const cleanPath = String(storagePath).replace(/^\/+/, "");
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ucggczovhmauhshvhusx.supabase.co";
  return `${baseUrl}/storage/v1/object/public/npc-portraits/${cleanPath}`;
}

export const CHARACTER_INTERACTION_VIEWS = ["profile", "class", "features", "sheet", "inventory", "spells", "account", "shop", "craft"];

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
    case "class": return "Class";
    case "features": return "Feats & Boons";
    case "sheet": return "Sheet & Rolls";
    case "inventory": return "Inventory";
    case "spells": return "Spellbook";
    case "account": return "Account";
    case "shop": return "Shop";
    case "craft": return "Craft";
    case "profile":
    default:
      return "Profile";
  }
}

export function buildCharacterInteractionTabs({ hasCraftCapability = false, hasShopCapability = false, hasAccountCapability = false } = {}) {
  return CHARACTER_INTERACTION_VIEWS.filter((view) => {
    if (view === "craft") return !!hasCraftCapability;
    if (view === "shop") return !!hasShopCapability;
    if (view === "account") return !!hasAccountCapability;
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

function CharacterWidePanelShell({ character = null, renderTabs = null, onClose = null, shellClassName = "", children = null }) {
  const status = String(character?.status || "unknown").toLowerCase();
  const subline = [character?.role, character?.affiliation, character?.race].filter(Boolean).join(" • ");

  return React.createElement(
    "div",
    { className: `npc-panel-inner ${shellClassName}`.trim() },
    React.createElement(
      "div",
      { className: "npc-panel-header" },
      React.createElement(
        "div",
        { className: "d-flex align-items-start justify-content-between gap-3" },
        React.createElement(
          "div",
          { className: "min-w-0" },
          React.createElement(
            "div",
            { className: "d-flex align-items-center gap-2 flex-wrap" },
            React.createElement("h3", { className: "npc-name m-0 text-truncate" }, character?.name || "Character"),
            React.createElement("span", { className: `badge npc-status badge-${status}` }, status)
          ),
          subline ? React.createElement("div", { className: "npc-subline text-truncate" }, subline) : null
        ),
        React.createElement(
          "div",
          { className: "d-flex align-items-center gap-2 flex-wrap justify-content-end flex-shrink-0" },
          typeof renderTabs === "function" ? renderTabs() : null,
          React.createElement(
            "button",
            { type: "button", className: "btn btn-sm btn-outline-light", onClick: () => onClose?.(), "aria-label": "Close", title: "Close" },
            "✕"
          )
        )
      )
    ),
    React.createElement(
      "div",
      { className: "npc-panel-body d-block" },
      React.createElement("div", { className: "p-2" }, children)
    )
  );
}

function CharacterClassShell({ character = null, isAdmin = false, renderTabs = null, onClose = null }) {
  return React.createElement(
    CharacterWidePanelShell,
    { character, renderTabs, onClose, shellClassName: "character-class-shell" },
    React.createElement(CharacterClassWorkspace, { character, isAdmin })
  );
}

function CharacterFeaturesShell({ character = null, isAdmin = false, renderTabs = null, onClose = null }) {
  return React.createElement(
    CharacterWidePanelShell,
    { character, renderTabs, onClose, shellClassName: "character-features-shell" },
    React.createElement(CharacterFeaturesPanel, { character, isAdmin })
  );
}

function CharacterSpellbookShell({ character = null, isAdmin = false, renderTabs = null, onClose = null }) {
  return React.createElement(
    CharacterWidePanelShell,
    { character, renderTabs, onClose, shellClassName: "character-spellbook-shell" },
    React.createElement(CharacterSpellbookPanel, { character, isAdmin })
  );
}

function CharacterAccountShell({ character = null, renderTabs = null, onClose = null, accountContent = null }) {
  return React.createElement(
    CharacterWidePanelShell,
    { character, renderTabs, onClose, shellClassName: "character-account-shell" },
    accountContent
  );
}

export default function CharacterInteractionPanel({ character = null, npc = null, initialView = "profile", onInteractionViewChange = null, useCharacterInteractionShell = false, accountContent = null, ...props }) {
  const panelCharacter = character || npc;
  const panelCharacterId = panelCharacter?.id || null;
  const requestedIsAdmin = !!props?.isAdmin;
  const [resolvedAdmin, setResolvedAdmin] = React.useState(requestedIsAdmin);
  const [canManageCharacter, setCanManageCharacter] = React.useState(requestedIsAdmin);
  const effectiveIsAdmin = requestedIsAdmin || resolvedAdmin;
  const craftProfession = resolveCraftProfession(panelCharacter || {}, sheetForCraftResolution(panelCharacter));
  const hasCraftCapability = !!craftProfession && craftProfession !== "Scribe";
  const hasShopCapability = isMerchantCharacter(panelCharacter);
  const hasAccountCapability = Boolean(accountContent);
  const interactionTabs = React.useMemo(
    () => buildCharacterInteractionTabs({ hasCraftCapability, hasShopCapability, hasAccountCapability }),
    [hasAccountCapability, hasCraftCapability, hasShopCapability]
  );
  const requestedView = normalizeCharacterInteractionView(initialView);
  const safeInitialView = interactionTabs.includes(requestedView) ? requestedView : "profile";
  const [interactionView, setInteractionView] = React.useState(() => safeInitialView);

  React.useEffect(() => {
    if (requestedIsAdmin) {
      setResolvedAdmin(true);
      return;
    }

    let active = true;
    async function resolveAdminState() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!active) return;
        if (!sessionData?.session?.user) {
          setResolvedAdmin(false);
          return;
        }

        const { data, error } = await supabase.rpc("is_admin");
        if (!active) return;
        setResolvedAdmin(!error && Boolean(data));
      } catch {
        if (active) setResolvedAdmin(false);
      }
    }

    resolveAdminState();
    return () => { active = false; };
  }, [requestedIsAdmin]);

  React.useEffect(() => {
    let active = true;
    async function resolveCharacterManagement() {
      if (!panelCharacterId) {
        setCanManageCharacter(false);
        return;
      }
      if (effectiveIsAdmin) {
        setCanManageCharacter(true);
        return;
      }
      const { data, error } = await supabase.rpc("can_manage_character_progression_v1", { p_character_id: panelCharacterId });
      if (active) setCanManageCharacter(!error && Boolean(data));
    }
    resolveCharacterManagement();
    return () => { active = false; };
  }, [effectiveIsAdmin, panelCharacterId]);

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
            // Historical validator contract for the original direct pass-through: isAdmin: !!props?.isAdmin
            isAdmin: effectiveIsAdmin,
            startView: "recipes",
            showDisciplineSwitcher: false,
          })
        )
      )
    );
  }, [craftProfession, effectiveIsAdmin, hasCraftCapability, panelCharacter, panelCharacterId]);

  const wrapWithContext = React.useCallback((node) => React.createElement(
    CharacterInteractionContext.Provider,
    { value: { characterId: panelCharacterId, canManageCharacter: effectiveIsAdmin || canManageCharacter } },
    node
  ), [canManageCharacter, effectiveIsAdmin, panelCharacterId]);

  if (interactionView === "class") {
    return wrapWithContext(React.createElement(CharacterClassShell, {
      character: panelCharacter,
      isAdmin: effectiveIsAdmin,
      renderTabs: renderInteractionTabs,
      onClose: props?.onClose,
    }));
  }

  if (interactionView === "features") {
    return wrapWithContext(React.createElement(CharacterFeaturesShell, {
      character: panelCharacter,
      isAdmin: effectiveIsAdmin,
      renderTabs: renderInteractionTabs,
      onClose: props?.onClose,
    }));
  }

  if (interactionView === "spells") {
    return wrapWithContext(React.createElement(CharacterSpellbookShell, {
      character: panelCharacter,
      isAdmin: effectiveIsAdmin,
      renderTabs: renderInteractionTabs,
      onClose: props?.onClose,
    }));
  }

  if (interactionView === "account" && hasAccountCapability) {
    return wrapWithContext(React.createElement(CharacterAccountShell, {
      character: panelCharacter,
      renderTabs: renderInteractionTabs,
      onClose: props?.onClose,
      accountContent,
    }));
  }

  if (useCharacterInteractionShell) {
    return wrapWithContext(React.createElement(CharacterInteractionShell, {
      character: panelCharacter,
      activeView: interactionView,
      renderTabs: renderInteractionTabs,
      renderCraftView,
    }));
  }

  return wrapWithContext(React.createElement(NpcPanel, {
    ...props,
    isAdmin: effectiveIsAdmin,
    npc: panelCharacter,
    initialView: interactionView,
    interactionView,
    interactionTabs,
    setInteractionView: setSafeInteractionView,
    renderInteractionTabs,
    craftProfession,
    hasCraftCapability,
    renderCraftView,
  }));
}
