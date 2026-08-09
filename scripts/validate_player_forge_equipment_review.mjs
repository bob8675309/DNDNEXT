import fs from "node:fs";

const modal = fs.readFileSync("components/NewNpcModalV3Refined.js", "utf8");
const review = fs.readFileSync("components/NpcForgeEquipmentReviewSummary.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing equipment Review contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden equipment Review crossover: ${token}`); };

for (const token of [
  'import NpcForgeEquipmentReviewSummary from "./NpcForgeEquipmentReviewSummary";',
  'playerMode && stepKey === "review"',
  'model={equipmentModel}',
  'selection={draft.startingEquipment || {}}',
]) need(modal, token);

for (const token of [
  "startingCurrencyCopper",
  "magicAllowanceLabel",
  "Equipment & currency",
  "Class package",
  "Background package",
  "Higher-level roll",
  "Magic-item guide",
  "canonical inventory",
  "start unequipped",
  "not automatically granted",
]) need(review, token);

for (const source of [modal, review]) {
  for (const token of ["MapPageClient", "map_routes", "weather", "player_wallets"]) forbid(source, token);
}

console.log("Player Forge Review shows the exact character-scoped starter equipment/currency summary without crossing protected boundaries.");
