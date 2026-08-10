import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const must = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
};

const requiredFiles = [
  "sql/20260809_83_defensive_tactics_runtime.sql",
  "sql/20260810_84_whispers_of_the_dead_runtime.sql",
  "sql/20260810_85_progression_rpc_acl_cleanup.sql",
  "sql/20260810_89_pending_rest_runtime_choices.sql",
  "components/CharacterDefensiveTacticsPanel.js",
  "components/CharacterWhispersOfTheDeadPanel.js",
  "components/CharacterRestChoiceNotice.js",
  "components/CharacterCurrencyBadge.js",
];
for (const file of requiredFiles) must(fs.existsSync(path.join(root, file)), `${file} must exist.`);

const m83 = read(requiredFiles[0]);
const m84 = read(requiredFiles[1]);
const m85 = read(requiredFiles[2]);
const m89 = read(requiredFiles[3]);
const currency = read("components/CharacterCurrencyBadge.js");
const notice = read("components/CharacterRestChoiceNotice.js");
const defensive = read("components/CharacterDefensiveTacticsPanel.js");
const whispers = read("components/CharacterWhispersOfTheDeadPanel.js");

must(m83.includes("ranger-hunter-defensive-tactics"), "Migration 83 must preserve Defensive Tactics runtime identity.");
must(m83.includes("short_or_long_rest"), "Migration 83 must preserve Short/Long Rest cadence.");
must(m84.includes("rogue-phantom-whispers-of-the-dead"), "Migration 84 must preserve Whispers runtime identity.");
must(m84.includes("previousBorrowedProficiency"), "Migration 84 must preserve replacement history without rewriting permanent Training.");
must(m85.includes("get_character_level_class_choice_options_v2"), "Migration 85 must preserve the v2 compatibility RPC ACL cleanup.");
must(!/\bdrop\s+function\b/i.test(m85), "Migration 85 must not delete the compatibility RPC.");

must(m89.includes("get_character_pending_rest_choices_v1"), "Migration 89 must expose the pending-rest aggregate getter.");
must(m89.includes("safe_character_runtime_profile_v1"), "Migration 89 must isolate incompatible feature getters.");
must(m89.includes("'needsSelection'"), "Migration 89 must distinguish inactive/rest-cycle choices.");
must(m89.includes("'optionalChanges'"), "Migration 89 must distinguish persistent optional replacements.");
must(m89.includes("'availableActions'"), "Migration 89 must distinguish optional post-rest actions.");
must(m89.includes("revoke all on function public.get_character_pending_rest_choices_v1(uuid) from public,anon"), "Pending-rest getter must not be anonymous.");
must(!/\b(insert\s+into|update\s+public\.|delete\s+from|truncate\s+|alter\s+table|drop\s+table)\b/i.test(m89), "Migration 89 must remain read-only character-state aggregation.");

must(notice.includes('supabase.rpc("get_character_pending_rest_choices_v1"'), "Notice must use server-authoritative pending-rest state.");
must(notice.includes("is-attention"), "Notice must visually distinguish inactive/rest-cycle choices.");
must(notice.includes("prefers-reduced-motion"), "Notice pulse must respect reduced-motion preference.");
must(notice.includes("optional persistent change"), "Persistent replacement availability must be quiet/optional.");
must(notice.includes("setInterval"), "Notice must refresh after a rest even when its parent sheet does not rerender.");

must(defensive.includes("configure_character_defensive_tactics_v1"), "Defensive Tactics panel must call the deployed configure RPC.");
must(defensive.includes("p_tactic_key"), "Defensive Tactics panel must pass p_tactic_key.");
must(whispers.includes("configure_character_whispers_of_the_dead_v1"), "Whispers panel must call the deployed configure RPC.");
must(whispers.includes("p_kind") && whispers.includes("p_name"), "Whispers panel must pass proficiency kind and name.");

for (const marker of [
  'CharacterRestChoiceNotice characterId={characterId}',
  'CharacterDefensiveTacticsPanel characterId={characterId}',
  'CharacterWhispersOfTheDeadPanel characterId={characterId}',
]) must(currency.includes(marker), `CharacterCurrencyBadge must wire ${marker}.`);

for (const text of [m83, m84, m85, m89, currency, notice, defensive, whispers]) {
  must(!text.includes("MapPageClient"), "Pending-rest/parity slice must not cross into the world-map client.");
  must(!/map_routes|map_route_points|advance_all_characters|weather/i.test(text), "Pending-rest/parity slice must not modify map/travel/weather authority.");
}

if (!process.exitCode) console.log("PASS: pending-rest runtime choice presentation and migration 83-85 source parity validated.");
