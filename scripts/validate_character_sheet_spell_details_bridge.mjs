import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanImportedText(value) {
  return String(value ?? "")
    .replace(/\|[A-Z][A-Z0-9]{1,15}\b/g, "")
    .replace(/\[[A-Z][A-Z0-9]{1,15}\]/g, "")
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

const bridge = fs.readFileSync("components/CharacterSheetSpellDetailsBridge.js", "utf8");
const app = fs.readFileSync("pages/_app.js", "utf8");

assert(
  cleanImportedText("Hit Points|XPHB and Bonus Action[XPHB].") === "Hit Points and Bonus Action.",
  "source payload sanitizer must remove inline and bracketed book markers"
);
assert(
  normalizeActionCostText("Resolve effect • 90 feet • 1 bonus • 2 pact slots").includes("Bonus Action"),
  "spell summaries must normalize bonus-action costs"
);
assert(
  normalizeActionCostText("Resolve effect • Self • 1 reaction, which you take when hit • long rest").includes("Reaction • long rest"),
  "spell summaries must reduce reaction trigger prose to the Reaction cost"
);
assert(
  normalizeActionCostText("Resolve effect • 30 feet • 1 action").endsWith("Action"),
  "spell summaries must normalize action costs"
);

for (const token of [
  'new Set(["cantrips", "prepared spells"])',
  'data-sheet-spell-action',
  'Cost: ${cost}',
  'Full spell description pinned in Description.',
  '.csheet-pinned-description',
  'MutationObserver',
  'cleanTextNodes(sheet)',
]) {
  assert(bridge.includes(token), `spell details bridge is missing required contract: ${token}`);
}

assert(
  app.includes('import CharacterSheetSpellDetailsBridge from "../components/CharacterSheetSpellDetailsBridge";'),
  "app shell must import the spell details bridge"
);
assert(
  app.includes("<CharacterSheetSpellDetailsBridge />"),
  "app shell must mount the spell details bridge"
);
assert(!bridge.includes("MapPageClient"), "spell details bridge must not introduce world-map behavior");

console.log("Character sheet spell details bridge validation passed.");
