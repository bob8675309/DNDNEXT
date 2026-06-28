import fs from "node:fs";
import path from "node:path";

const rel = path.join("components", "town", "TownCrafterInteractionPanel.js");
const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const required = [
  'import dynamic from "next/dynamic";',
  'import styles from "../TownSheet.module.scss";',
  'const CharacterInteractionPanel = dynamic(() => import("../character/CharacterInteractionPanel"), { ssr: false });',
  'export function townCrafterProfessionFor(crafter) {',
  'export function townCrafterInteractionCharacter(crafter) {',
  'craft_profession: craftProfession,',
  'profession: craftProfession || crafter?.profession || "",',
  'export default function TownCrafterInteractionPanel',
  'initialView: "craft"',
  'onClose,',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Town crafter interaction component validation failed: ${token}`);
}

const forbidden = [
  '<iframe',
  'CrafterWorkshopModal',
  'from "../NpcPanel"',
  'from "./NpcPanel"',
];

for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Town crafter interaction component should not include token: ${token}`);
}

console.log("Town crafter interaction component validated.");
