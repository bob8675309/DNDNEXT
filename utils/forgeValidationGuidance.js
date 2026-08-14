const VALIDATION_TARGET_CLASS = "is-forge-validation-target";

function visibleForgeModal() {
  if (typeof document === "undefined") return null;
  const modals = [...document.querySelectorAll(".npc-forge-modal-v2")];
  return modals.reverse().find((modal) => modal.getAttribute("aria-hidden") !== "true") || null;
}

function validationContainer(node) {
  if (!node) return null;
  if (node.matches?.("details, .npc-forge-catalog, .npc-forge-form-grid, .npc-forge-identity-art, .npc-forge-ability-drop-grid, .npc-forge-species-bonus, .npc-forge-species-choice, .npc-forge-training-step, .npc-forge-spell-validation, .npc-forge-equipment-layout, .npc-forge-class-guide, .npc-forge-class-guide__subclasses")) return node;
  return node.closest?.("details, .npc-forge-species-choice, .npc-forge-source-choice-group, .npc-forge-class-choice-group, .npc-forge-class-guide__subclasses, .npc-forge-class-guide, .npc-forge-catalog, .npc-forge-form-grid, .npc-forge-workspace") || node;
}

export function clearForgeValidationGuidance(modal = null) {
  const scope = modal || visibleForgeModal();
  if (!scope) return;
  for (const target of scope.querySelectorAll(`.${VALIDATION_TARGET_CLASS}`)) {
    target.classList.remove(VALIDATION_TARGET_CLASS);
    target.removeAttribute("data-forge-validation-message");
    target.removeAttribute("aria-invalid");
    if (target.dataset.forgeValidationTabindex === "added") target.removeAttribute("tabindex");
    delete target.dataset.forgeValidationTabindex;
  }
}

export function showForgeValidationGuidance(message, selectors = [], modal = null) {
  const scope = modal || visibleForgeModal();
  if (!scope) return null;
  clearForgeValidationGuidance(scope);
  const preferred = (selectors || []).map((selector) => scope.querySelector(selector)).find(Boolean);
  const required = scope.querySelector(".is-required, [aria-invalid='true']");
  const target = validationContainer(preferred || required || scope.querySelector(".npc-forge-workspace"));
  if (!target) return null;
  if (target.tagName === "DETAILS") target.open = true;
  target.classList.add(VALIDATION_TARGET_CLASS);
  target.dataset.forgeValidationMessage = String(message || "Complete this selection before continuing.");
  target.setAttribute("aria-invalid", "true");
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.dataset.forgeValidationTabindex = "added";
  }
  target.scrollIntoView?.({ behavior: "smooth", block: "center" });
  const focusTarget = target.matches?.("input, select, button, summary") ? target : target.querySelector?.("summary, input, select, button");
  (focusTarget || target).focus?.({ preventScroll: true });
  return target;
}

export function forgeStepGuidanceSelectors(stepKey = "", message = "") {
  const key = String(stepKey || "").toLowerCase();
  const text = String(message || "").toLowerCase();
  if (key === "species") return text.includes("choose a species")
    ? [".npc-forge-catalog"]
    : [".npc-forge-species-fact-choice.is-required", ".npc-forge-species-choice.is-required", ".npc-forge-species-feature-list details"];
  if (key === "background") return text.includes("choose a background")
    ? [".npc-forge-catalog"]
    : [".npc-forge-background-info-rows details", ".npc-forge-source-choice-group.is-required", ".npc-forge-workspace"];
  if (key === "class") return text.includes("choose a class")
    ? [".npc-forge-catalog"]
    : [".npc-forge-level-row", ".npc-forge-class-guide", ".npc-forge-workspace"];
  if (key === "abilities") return [".npc-forge-species-bonus", ".npc-forge-ability-drop-grid", ".npc-forge-workspace"];
  if (key === "training") return [".npc-forge-class-choice-group.is-required", ".npc-forge-training-step", ".npc-forge-workspace"];
  if (key === "spells") return [".npc-forge-spell-validation.is-incomplete", ".npc-forge-source-choice-group.is-required", ".npc-forge-workspace"];
  if (key === "equipment") return [".npc-forge-equipment-layout", ".npc-forge-workspace"];
  if (key === "identity") return text.includes("portrait")
    ? [".npc-forge-identity-art"]
    : [".npc-forge-form-grid", ".npc-forge-identity-art"];
  return [".npc-forge-workspace"];
}
