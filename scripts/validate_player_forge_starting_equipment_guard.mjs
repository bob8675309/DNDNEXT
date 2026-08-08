import fs from "node:fs";

const source = fs.readFileSync("sql/20260808_50_player_forge_starting_equipment_guard.sql", "utf8");
const need = (token) => { if (!source.includes(token)) throw new Error(`Missing starting-equipment guard contract: ${token}`); };
const forbid = (token) => { if (source.includes(token)) throw new Error(`Forbidden starting-equipment guard crossover: ${token}`); };

for (const token of [
  "alter table public.character_currency enable row level security",
  "validate_player_forge_starting_equipment_sheet_v1",
  "startingEquipmentSelections must be a JSON object",
  "Starting equipment must reference the selected Background.",
  "Starting equipment Background does not match the character Background.",
  "Starting equipment Background source does not match the character Background source.",
  "Higher-level starting wealth requires a d10 result from 1 to 10.",
  "A higher-level starting wealth roll is not used below level 5.",
  "character_sheets_validate_player_forge_starting_equipment_v1",
  "deferrable initially deferred",
  "get_character_currency_v1",
  "'hasBalance',false",
  "'hasBalance',true",
]) need(token);

for (const token of ["player_wallets", "MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(token);

console.log("Player Forge starting-equipment Background binding, wealth-roll guard, RLS, currency existence, and protected boundaries validated.");
