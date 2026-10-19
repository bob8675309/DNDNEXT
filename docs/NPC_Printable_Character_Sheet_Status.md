# NPC Printable Character Sheet Status

Updated: 2026-10-19  
Status: implementation branch; presentation-only NPC-page feature.

## Purpose

The /npcs page now exposes a **Print Sheet** action from the existing character-sheet header. The action prints a dedicated, paper-oriented character sheet rather than trying to print the interactive NPC page itself.

The printable sheet is intended to be usable at the table and to include the currently authorized and loaded character information:

- name, portrait, Species, lineage, size, alignment, class, subclass, level, Background, role, affiliation, status, and location;
- Armor Class, Hit Points, temporary Hit Points, Speed, Initiative, Proficiency Bonus, Passive Perception, Hit Dice, and XP;
- all six ability scores/modifiers and saving throws;
- all skills, including proficiency, Expertise, and current Advantage/Disadvantage presentation;
- resolved attacks, weapon modes, spell actions, and feature actions;
- resolved Features & Traits with descriptions/source/origin when available;
- Spellbook entries with preparation state, range, duration, damage/healing, save metadata, and limited-use state when loaded;
- authorized inventory rows, equip state, item descriptions, and equipment-effect breakdown;
- languages, tool/weapon/armor proficiencies, professions, legacy equipment/treasure fields;
- Description, Appearance, Background, Motivation, personality fields, Quirk, Mannerism, Voice, Secret, and Tags when the NPC page already has access to them;
- authorized character notes currently loaded by the NPC page.

The browser print dialog can print to paper or save the sheet as PDF.

## Ownership boundary

pages/npcs.js remains the owner of selected-character identity, sheet state, narrative/profile data, equipped rows, notes, and permission-filtered supplemental action data.

hooks/useNpcSheetActionData.js remains the owner of authorized full inventory rows, spell assignments, and resolved feature rows.

components/CharacterSheetPanel.js only exposes the print action and passes already-loaded data to the print surface.

components/PrintableCharacterSheet.js performs no Supabase reads and no writes.

utils/printableCharacterSheet.js is a pure presentation model. It reuses the canonical browser-side Character Sheet formula helpers for Armor Class, Initiative, Passive Perception, and the shared action builder rather than inventing a separate rules engine.

## Printing behavior

The print view is rendered through a React portal directly under document.body.

While printing:

- the ordinary Next.js app root is hidden;
- only the printable character sheet is shown;
- Letter portrait paper is the default;
- important cards/rows use print break guards;
- Features & Traits begin on a fresh page;
- colors are deliberately restrained so the form remains readable in grayscale.

The print portal is removed after the browser's afterprint event. Printing does not alter or persist character data.

## Security and permission behavior

The print feature never performs a new data fetch.

It can only print values that the /npcs page and its existing guarded supplemental-data hook already loaded for the current user. Private notes or Secrets are therefore not a new disclosure path; if the current page does not possess them, the printable model cannot retrieve them.

## Regression gate

scripts/validate_printable_character_sheet.mjs verifies:

- canonical AC, Initiative, and Passive Perception math;
- saving-throw and skill calculations;
- Features, Spellbook, inventory, notes, narrative, and portrait-data handoffs;
- browser print portal and window.print() behavior;
- Letter print CSS and page breaks;
- absence of Supabase access inside the print component/model;
- no world-map/travel code introduced by the feature;
- registration in the production Vercel build runner.

## Protected boundaries

This feature must not:

- change sheet or inventory write authority;
- alter encounter/tactical authority;
- mutate merchant stock/economy/crafting state;
- change NPC selection ownership;
- introduce new authentication/data-loading paths;
- touch world-map routes, movement, travel, weather, camps, or town/city-map behavior.
