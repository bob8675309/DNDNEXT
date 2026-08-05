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
const portraitUtils = read("utils/characterPortraits.js");
const css = read("styles/character-forge-responsive.css");
const migration = read("sql/20260804_03_character_forge_resilience_and_tags.sql");
const subclassMigration = read("sql/20260805_01_character_forge_subclass_choice.sql");
const classContext = read("components/NpcForgeClassChoiceContext.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const contextPanel = read("components/NpcForgeContextPanel.js");

requireToken(forge, 'mode = "npc"', "canonical Forge");
requireToken(forge, "createCharacter ? createCharacter(createPayload)", "canonical Forge");
requireToken(forge, "function handleReset()", "canonical Forge");
requireToken(forge, "function handleClose() { if (creating) return; onClose?.(); }", "canonical Forge");
forbidToken(forge, "function handleClose() { if (creating) return; resetForm();", "canonical Forge");
requireToken(forge, "Create Player Character", "canonical Forge");

requireToken(adapter, "useRef", "shared player adapter");
requireToken(adapter, 'supabase.rpc("create_player_character_v2"', "shared player adapter");
requireToken(adapter, "payloadWithSubclass", "shared player adapter");
requireToken(adapter, "NpcForgeClassChoiceContext.Provider", "shared player adapter");
requireToken(adapter, "classChoiceStateRequiresSelection", "shared player adapter");
requireToken(adapter, "profession:", "shared player adapter");
forbidToken(adapter, "supabase.rpc =", "shared player adapter");
forbidToken(adapter, "MutationObserver", "shared player adapter");

requireToken(profile, "persistent-player-character-forge", "profile host");
requireToken(profile, "persistent-player-character-profile", "profile host");
requireToken(profile, "key={sessionUser.id}", "profile host account isolation");
requireToken(profile, "is-forge-suspended", "profile host");
forbidToken(profile, "if (!isLoggedIn || (!open && !keepCreatorMounted))", "profile host");

requireToken(classContext, "classChoiceStateComplete", "class choice context");
requireToken(classContext, "eligibleSubclassOptions", "class choice context");
requireToken(classGuide, 'from("class_level_progression")', "class guide");
requireToken(classGuide, 'from("class_feature_catalog")', "class guide");
requireToken(classGuide, "Compare all", "class guide");
requireToken(classGuide, "Detailed Guide", "class guide");
requireToken(classGuide, "Choose subclass", "class guide");
requireToken(contextPanel, "NpcForgeClassGuide", "context panel");
requireToken(contextPanel, "npc-forge-context-card.is-species", "species reference composition");

requireToken(portraits, "/\\.svg(?:$|[?#])/i", "portrait picker");
requireToken(portraitUtils, "defaultPortraitUrlForCharacter", "portrait fallback utility");
forbidToken(portraitUtils, ".svg", "portrait fallback utility");
requireToken(css, "Character Forge PR A: content-driven player layouts", "responsive stylesheet");
requireToken(css, "npc-forge-step-0", "responsive stylesheet");
requireToken(css, "npc-forge-step-3", "responsive stylesheet");
requireToken(css, "npc-forge-step-7", "responsive stylesheet");
requireToken(migration, "npc_portrait_library_no_svg_v1", "migration");
requireToken(migration, "derive_player_character_tags_v1", "migration");
requireToken(migration, "guard_player_character_tag_update_v1", "migration");
requireToken(subclassMigration, "apply_character_forge_subclass_choice_v1", "subclass migration");
requireToken(subclassMigration, "character_progression_apply_forge_subclass_v1", "subclass migration");
requireToken(subclassMigration, "subclass_name", "subclass migration");
requireToken(subclassMigration, "subclass_source", "subclass migration");

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
if (fs.existsSync(path.join(root, "scripts/generate_npc_portrait_pack.mjs"))) {
  throw new Error("Character Forge resilience: obsolete SVG portrait generator still exists");
}

console.log("Character Forge persistence, class guidance, subclass authority, layout, and raster-only portrait markers validated.");
