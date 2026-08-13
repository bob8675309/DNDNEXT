import fs from "node:fs";

const badge = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const host = fs.readFileSync("components/CharacterCircleLandPanel.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing character-currency presentation contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden character-currency presentation contract: ${token}`); };

for (const token of [
  "get_character_currency_v1",
  "p_character_id: characterId",
  "currency?.hasBalance",
  "Character Coin",
  "currency?.display || \"0 gp\"",
  "sourceBreakdown",
  "higherLevelCopper",
  "Character switches must never retain another character's balance",
]) need(badge, token);

for (const token of [
  'import CharacterCurrencyBadge from "./CharacterCurrencyBadge";',
  "<CharacterCurrencyBadge characterId={characterId} />",
]) need(host, token);

for (const source of [badge, host]) {
  for (const token of [
    "player_wallets",
    "player_wallet",
    "owner_type='player'",
    'owner_type="player"',
    "MapPageClient",
    "map_routes",
    "advance_all_characters",
    "weather",
  ]) forbid(source, token);
}

console.log("Character currency presentation uses only the character-scoped guarded RPC, distinguishes missing balances from authoritative zero, resets on character switch, and avoids account wallet/world-map boundaries.");
