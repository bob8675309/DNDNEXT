# Unified NPC and Player Character Forge Status

Status date: 2026-08-05

This document records the current testing state of the shared NPC/player Character Forge in PR #170. Development returns to the Dawn sprite prototype after this Forge slice is accepted and merged.

## Canonical architecture

DNDNext uses one shared Forge implementation for NPCs and player-owned characters. Player mode is an explicit adapter around the shared component and submits through `create_player_character_v2`; NPC/admin creation continues through `create_character_v1`.

Player steps are:

1. Species
2. Background
3. Class
4. Abilities
5. Training
6. Spells
7. Identity
8. Story
9. Review

The player Forge remains mounted for the signed-in account so Close/Reopen and client-side Pages Router navigation preserve the in-memory draft. Reset, successful creation, sign-out, account change, or hard refresh clears it.

## Current player experience

Implemented behavior includes:

- responsive Species artwork and **In the World** lore;
- independent expandable Species features and source-backed hover help for species-granted cantrips;
- profile-style Class Overview and Detailed Guide modes;
- level 1–20 progression, subclass preview/selection, and current-level emphasis;
- a persistent class-feature description dock;
- structured class-feature text that preserves source paragraphs and headings;
- compact expandable presentation for exceptionally long option lists without removing rules text;
- no redundant Primary Abilities tile in the class hero; Hit Die, level, saving throws, and spellcasting remain;
- Standard 3d6, 4d6 drop lowest, Point Buy, Standard Class Array, and Manual Assign;
- a right-column Species Bonus chooser;
- one shared Training-choice pool for class skills and crafting professions;
- level-aware starting spell selection;
- a full Review dossier;
- scrolling throughout all profile-panel tabs.

## Player authority

Players cannot assign arbitrary tags, map placement, Expertise, extra feats, boons, or post-creation spells through player surfaces. Background/species feat choices and starting spells are validated through the Forge and database authority. Direct non-admin mutation guards protect authoritative feat, boon, spell, and sheet fields.

Future player-controlled minions remain NPCs and require a dedicated assignment/controller relationship rather than the `player-character` tag.

## Database authority

Production migrations applied for this slice:

- `character_forge_resilience_and_tags`
- `character_forge_subclass_choice`
- `player_forge_starting_spell_validation`
- `player_character_authority_hardening`

These migrations provide controlled tags, subclass persistence, deferred starting-spell validation, and server-side feat/spell mutation protection. Existing character, progression, spell, and option-grant rows were not rewritten by the authority hardening migration.

## Protected boundaries

This Forge slice does not modify world-map, town/city-map, route, movement, weather, encounter, combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside the patch.

## Acceptance checklist

- [ ] Close/Reopen preserves the exact player draft and current tab.
- [ ] Client-side navigation away and back preserves the draft.
- [ ] Hard refresh and Reset clear the draft.
- [ ] Species artwork, lore, feature cards, and cantrip hover help remain usable.
- [ ] Class Overview and Detailed Guide are readable at desktop and narrow widths.
- [ ] Long Artificer and other dense feature entries render as paragraphs, headings, and expandable lists rather than walls of text.
- [ ] Class hero omits Primary Abilities while preserving Hit Die, level, saves, and spellcasting.
- [ ] Eligible subclasses are required and persist.
- [ ] Starting spell counts and class legality are enforced.
- [ ] Selecting a crafting profession consumes one Training choice.
- [ ] A player cannot self-grant feats or spells.
- [ ] Authorized GM/admin grant management remains functional.
- [ ] NPC Forge behavior remains intact.

## Return to Dawn

After PR #170 passes authenticated browser testing and is merged, return to `docs/Dawn_High_Quality_Prototype_Plan.md` and produce one high-quality South-facing Dawn idle/walk prototype before expanding to a complete atlas.
