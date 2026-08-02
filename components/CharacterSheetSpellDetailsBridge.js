import { useEffect } from "react";

const SPELL_GROUPS = new Set(["cantrips", "prepared spells"]);
const SOURCE_SUFFIX_RE = /\|[A-Z][A-Z0-9]{1,15}\b/g;
const BRACKET_SOURCE_RE = /\[[A-Z][A-Z0-9]{1,15}\]/g;

function cleanImportedText(value) {
  return String(value ?? "")
    .replace(SOURCE_SUFFIX_RE, "")
    .replace(BRACKET_SOURCE_RE, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeActionCostText(value) {
  return cleanImportedText(value)
    .replace(/\b1 bonus(?: action)?\b/gi, "Bonus Action")
    .replace(/\b1 action\b/gi, "Action")
    .replace(/\b1 reaction(?:,[^•]*)?/gi, "Reaction");
}

function actionCostFromText(value) {
  const text = normalizeActionCostText(value);
  if (/\bBonus Action\b/i.test(text)) return "Bonus Action";
  if (/\bReaction\b/i.test(text)) return "Reaction";
  if (/\bAction\b/i.test(text)) return "Action";
  return "";
}

function cleanTextNodes(root) {
  if (!root || typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, textarea, input")) continue;
    const next = cleanImportedText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

function groupLabel(group) {
  return String(group?.querySelector(".csheet-action-group__label span")?.textContent || "")
    .trim()
    .toLowerCase();
}

function markSpellActions(sheet) {
  for (const group of sheet.querySelectorAll(".csheet-action-group")) {
    if (!SPELL_GROUPS.has(groupLabel(group))) continue;
    for (const item of group.querySelectorAll(".csheet-action-item")) {
      item.dataset.sheetSpellAction = "true";
      const summary = item.querySelector(".csheet-action-button__detail");
      if (summary) {
        const normalized = normalizeActionCostText(summary.textContent);
        if (normalized !== summary.textContent) summary.textContent = normalized;
        const cost = actionCostFromText(normalized);
        if (cost) item.dataset.sheetSpellActionCost = cost;
      }
    }
  }
}

function refreshSheet(sheet) {
  if (!sheet) return;
  cleanTextNodes(sheet);
  markSpellActions(sheet);
}

function directChildParagraph(container) {
  return [...(container?.children || [])].find((node) => node.tagName === "P") || null;
}

function resetPinnedDescription(panel) {
  const head = panel?.querySelector(".csheet-pinned-description__head");
  const type = head?.querySelector("span");
  const title = head?.querySelector("strong");
  const body = directChildParagraph(panel);
  if (type) type.textContent = "Reference";
  if (title) title.textContent = "Pinned Description";
  if (body) body.textContent = "Click an ability, feat, trait, or spell Details button to keep its description visible here.";
  head?.querySelector("[data-spell-detail-clear]")?.remove();
}

function pinSpellDescription(sheet, item, title, description) {
  const panel = sheet.querySelector(".csheet-pinned-description");
  if (!panel) return;
  const head = panel.querySelector(".csheet-pinned-description__head");
  const type = head?.querySelector("span");
  const heading = head?.querySelector("strong");
  const body = directChildParagraph(panel);
  if (type) type.textContent = "Spell";
  if (heading) heading.textContent = title || "Spell";
  if (body) body.textContent = description || "No imported description is available for this spell.";

  if (head && !head.querySelector("[data-spell-detail-clear]")) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.dataset.spellDetailClear = "true";
    clear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetPinnedDescription(panel);
    });
    head.appendChild(clear);
  }

  item.dataset.spellDescriptionPinned = "true";
}

function addCostLine(details, cost) {
  if (!details || !cost || details.querySelector("[data-spell-action-cost-line]")) return;
  let list = details.querySelector("ul");
  if (!list) {
    list = document.createElement("ul");
    details.appendChild(list);
  }
  const line = document.createElement("li");
  line.dataset.spellActionCostLine = "true";
  line.textContent = `Cost: ${cost}`;
  list.prepend(line);
}

function pinExpandedSpell(button) {
  const item = button.closest('[data-sheet-spell-action="true"]');
  const sheet = item?.closest(".csheet");
  const details = item?.querySelector(".csheet-action-details");
  if (!item || !sheet || !details) return;

  cleanTextNodes(details);
  const fullDescription = [...details.querySelectorAll("p")].find(
    (node) => !node.matches("[data-spell-detail-note]")
  );
  const title = cleanImportedText(item.querySelector(".csheet-action-button__name")?.textContent || "Spell");
  const description = cleanImportedText(fullDescription?.textContent || "");
  const cost = item.dataset.sheetSpellActionCost || actionCostFromText(item.querySelector(".csheet-action-button__detail")?.textContent);

  addCostLine(details, cost);
  pinSpellDescription(sheet, item, title, description);

  if (fullDescription) fullDescription.hidden = true;
  if (!details.querySelector("[data-spell-detail-note]")) {
    const note = document.createElement("p");
    note.dataset.spellDetailNote = "true";
    note.textContent = "Full spell description pinned in Description.";
    details.prepend(note);
  }
}

export default function CharacterSheetSpellDetailsBridge() {
  useEffect(() => {
    let frame = 0;

    const refreshAll = () => {
      frame = 0;
      document.querySelectorAll(".csheet").forEach(refreshSheet);
    };

    const scheduleRefresh = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(refreshAll);
    };

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    refreshAll();

    const handleClick = (event) => {
      const button = event.target?.closest?.(".csheet-action-details-button");
      if (!button || !button.closest('[data-sheet-spell-action="true"]')) return;
      window.setTimeout(() => pinExpandedSpell(button), 0);
    };

    document.addEventListener("click", handleClick);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

export { actionCostFromText, cleanImportedText, normalizeActionCostText };
