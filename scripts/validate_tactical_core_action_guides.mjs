import fs from "node:fs";
import path from "node:path";

const componentPath = "components/TacticalCoreActionGuide.js";
const appPath = "pages/_app.js";
const combatPath = "pages/encounters/combat.js";
const component = fs.readFileSync(path.join(process.cwd(), componentPath), "utf8");
const app = fs.readFileSync(path.join(process.cwd(), appPath), "utf8");
const combat = fs.readFileSync(path.join(process.cwd(), combatPath), "utf8");

for (const token of [
  'const STORAGE_KEY = "dndnext.tactical.core-action-guides.v1"',
  'title: "Dash"',
  'Dash does not prevent Opportunity Attacks. Use Disengage for that.',
  'title: "Disengage"',
  'Your movement does not provoke Opportunity Attacks for the rest of this turn.',
  'title: "Dodge"',
  'router.pathname !== "/encounters/combat"',
  'document.addEventListener("click", onClick, true)',
  'button?.closest?.(".action-grid")',
  'window.localStorage.getItem(STORAGE_KEY)',
  'window.localStorage.setItem(STORAGE_KEY',
  'Don&apos;t show ability tips again',
  'Ability Tips: On',
  'Reset Tips',
  'role="dialog"',
  'button.click()',
]) {
  if (!component.includes(token)) throw new Error(`Core-action guide validation failed: missing ${token}`);
}

for (const token of [
  'import TacticalCoreActionGuide from "../components/TacticalCoreActionGuide";',
  '<TacticalCoreActionGuide />',
]) {
  if (!app.includes(token)) throw new Error(`Core-action guide validation failed: _app missing ${token}`);
}

for (const token of [
  'onClick={() => coreAction("dash")}',
  'onClick={() => coreAction("disengage")}',
  'onClick={() => coreAction("dodge")}',
  'encounter_use_core_action_v1',
]) {
  if (!combat.includes(token)) throw new Error(`Core-action guide validation failed: combat contract missing ${token}`);
}

for (const forbidden of [
  'supabase.',
  'map_routes',
  'map_route_points',
  'advance_all_characters',
]) {
  if (component.includes(forbidden)) throw new Error(`Core-action guide validation failed: forbidden ${forbidden}`);
}

console.log("Tactical core-action guide validation passed.");
