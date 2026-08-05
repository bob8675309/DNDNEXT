import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge resilience: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Character Forge resilience: ${label} still contains ${token}`); };

const forge = read("components/NewNpcModalV3Refined.js");
const adapter = read("components/NewNpcModalV3.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const portraits = read("components/NpcForgePortraitPickerModal.js");
const css = read("styles/character-forge-responsive.css");
const migration = read("sql/20260804_03_character_forge_resilience_and_tags.sql");

requireToken(forge, 'mode = "npc"', "canonical Forge");
requireToken(forge, "createCharacter ? createCharacter(createPayload)", "canonical Forge");
requireToken(forge, "function handleReset()", "canonical Forge");
requireToken(forge, "function handleClose() { if (creating) return; onClose?.(); }", "canonical Forge");
forbidToken(forge, "function handleClose() { if (creating) return; resetForm();", "canonical Forge");
requireToken(forge, "Create Player Character", "canonical Forge");
requireToken(adapter, 'supabase.rpc("create_player_character_v2"', "shared player adapter");
requireToken(adapter, "profession:", "shared player adapter");
forbidToken(adapter, "supabase.rpc =", "shared player adapter");
forbidToken(adapter, "MutationObserver", "shared player adapter");
requireToken(profile, "keepCreatorMounted", "profile host");
requireToken(profile, "is-forge-suspended", "profile host");
requireToken(portraits, "/\\.svg(?:$|[?#])/i", "portrait picker");
requireToken(css, "Character Forge PR A: content-driven player layouts", "responsive stylesheet");
requireToken(css, "npc-forge-step-0", "responsive stylesheet");
requireToken(css, "npc-forge-step-3", "responsive stylesheet");
requireToken(css, "npc-forge-step-7", "responsive stylesheet");
requireToken(migration, "npc_portrait_library_no_svg_v1", "migration");
requireToken(migration, "derive_player_character_tags_v1", "migration");
requireToken(migration, "guard_player_character_tag_update_v1", "migration");

const deletedSvgPaths = [
  "public/npc-portraits/library/enchanting/arcane-atelier-enchanter.svg",
  "public/npc-portraits/library/smithing/dwarf-forgemaster.svg",
  "public/npc-portraits/library/scribe/grayhall-archivist.svg",
  "public/npc-portraits/library/alchemy/green-apothecary.svg",
  "public/npc-portraits/library/merchants/market-factor.svg",
  "public/npc-portraits/library/monsters/orc-warlord.svg",
  "public/npc-portraits/defaults/alchemy.svg",
  "public/npc-portraits/defaults/enchanting.svg",
  "public/npc-portraits/defaults/merchant.svg",
  "public/npc-portraits/defaults/npc.svg",
  "public/npc-portraits/defaults/scribe.svg",
  "public/npc-portraits/defaults/smithing.svg",
];
for (const rel of deletedSvgPaths) {
  if (fs.existsSync(path.join(root, rel))) throw new Error(`Character Forge resilience: obsolete SVG portrait still exists: ${rel}`);
}

console.log("Character Forge resilience, player authority, layout, and SVG cleanup markers validated.");
