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
  "startingMarketBudgetCopper",
  "startingMarketSpentCopper",
  "startingMarketRemainingCopper",
  "startingMarketPurchases",
  "Equipment & currency",
  "Starting market",
  "Source budget",
  "Market purchases",
  "Merchants used",
  "Higher-level roll",
  "Magic-item guide",
  "staged until character creation",
  "character-scoped currency",
]) need(review, token);

for (const source of [modal, review]) {
  for (const token of ["MapPageClient", "map_routes", "weather", "player_wallets"]) forbid(source, token);
}

console.log("Player Forge Review shows the exact source-funded starting-market/cart/currency summary without crossing protected boundaries.");
