import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "utils", "craftProfession.js"), "utf8");

const required = [
  "export const CRAFT_DISCIPLINES",
  "export function resolveCraftProfession",
  "export function canCraft",
  "return \"Alchemy\"",
  "return \"Smithing\"",
  "return \"Enchanting\"",
  "return \"Scribe\"",
  "character?.profession",
  "sheet?.skills?.profession",
  "sheet?.profile?.professions",
];

for (const token of required) {
  assert.ok(source.includes(token), `Missing resolver token: ${token}`);
}

const patterns = [
  /alchemy/i,
  /alchemist/i,
  /smithing/i,
  /blacksmith/i,
  /enchanting/i,
  /enchanter/i,
  /scribe/i,
];

for (const pattern of patterns) {
  assert.ok(pattern.test(source), `Missing resolver pattern: ${pattern}`);
}

console.log("Craft profession resolver source validation passed.");
