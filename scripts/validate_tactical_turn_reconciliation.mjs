import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const playPath = path.join(root, "pages/encounters/play.js");
if (!fs.existsSync(playPath)) {
  console.error("Missing pages/encounters/play.js");
  process.exit(1);
}

const source = fs.readFileSync(playPath, "utf8");
const failures = [];
const requireToken = (token, label = token) => {
  if (!source.includes(token)) failures.push(`Missing ${label}`);
};

requireToken('useRef, useState', "useRef import for snapshot ordering");
requireToken('encounterSnapshotRef = useRef({ id: "", version: -1 })', "encounter snapshot version ref");
requireToken('incomingVersion < Number(tracked.version || 0)', "stale snapshot rejection");
requireToken('const reconcileEncounter = useCallback', "bounded authoritative reconciliation helper");
requireToken('for (let attempt = 0; attempt < 4; attempt += 1)', "bounded reconciliation retries");
requireToken('function applyOptimisticEncounter(expectedVersion, patch)', "optimistic authoritative result application");
requireToken('const commandBaseVersion = Math.max', "command base-version capture");
requireToken('expectedVersion = commandBaseVersion + 1', "expected encounter-version calculation");
requireToken('active_participant_id: nextParticipantId', "immediate End Turn authority adoption");
requireToken('action_available: true, bonus_action_available: true, reaction_available: true', "next-turn resource reset");
requireToken('movement_spent_ft: Number(data?.movementSpentFt', "immediate movement result adoption");
requireToken('setReactionWindows((current) => current.filter', "immediate resolved reaction removal");

for (const fn of ["submitMove", "resolveReaction", "endTurn"]) {
  const start = source.indexOf(`async function ${fn}`);
  const end = source.indexOf("\n  async function ", start + 1);
  const body = source.slice(start, end > start ? end : source.indexOf("\n\n  return (", start));
  if (start < 0 || !body.includes("reconcileAfterCommand(expectedVersion, successMessage)")) {
    failures.push(`${fn} does not schedule authoritative post-command reconciliation`);
  }
}

for (const forbidden of ["map_routes", "map_route_points", "advance_all_characters", "travel_minutes", "town_map"]) {
  if (source.includes(forbidden)) failures.push(`Turn Play must remain isolated from ${forbidden}`);
}

if (failures.length) {
  console.error("Tactical turn reconciliation validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tactical turn reconciliation validation passed.");
