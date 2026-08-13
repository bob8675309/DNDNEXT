import fs from "node:fs";

const source = fs.readFileSync("sql/20260808_51_player_forge_character_scoped_equipment_projection.sql", "utf8");
const need = (token) => { if (!source.includes(token)) throw new Error(`Missing character-scoped starter equipment contract: ${token}`); };
const forbid = (token) => { if (source.includes(token)) throw new Error(`Forbidden character-scoped starter equipment contract: ${token}`); };

for (const token of [
  "materialize_player_forge_starting_equipment_v1",
  "insert into public.inventory_items",
  "'character',p_character_id::text",
  "insert into public.character_currency",
  "update public.character_sheets set sheet=v_sheet",
  "startingEquipmentSummary",
  "startingCurrencyCopper",
  "higherLevelMagicItemGuide",
]) need(token);

for (const token of [
  "update public.players",
  "insert into public.players",
  "player_wallets",
  "owner_type,'player'",
  "MapPageClient",
  "map_routes",
  "weather",
]) forbid(token);

console.log("Player Forge starter equipment/currency remains character scoped and avoids legacy account-wide sheet/wallet projection.");
