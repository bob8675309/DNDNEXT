# NPC Printable Character Sheet Status

Updated: 2026-10-19  
Status: implementation branch; presentation-only NPC-page feature.

## Purpose

The `/npcs` page exposes a **Print Sheet** action from the existing Character Sheet header.

The print action no longer renders a custom DNDNext paper layout. It now takes the currently loaded NPC/merchant Character Sheet data and writes that data into the official three-page D&D 5e character-sheet artwork stored at:

`public/forms/5E_CharacterSheet_Fillable.pdf`

The generated PDF opens in the browser's PDF viewer so the user can inspect it, print it, or save it as a PDF.

## Page mapping

### Official page 1

The generator fills the normal play sheet with:

- Character Name;
- Class & Level, Background, Player Name/NPC marker, Race/Species, Alignment, and XP;
- all six ability scores and modifiers;
- Proficiency Bonus and Inspiration;
- saving-throw modifiers and proficiency marks;
- all skill modifiers, proficiency marks, and an Expertise `x2` marker;
- Armor Class, Initiative, Speed, maximum/current/temporary HP, Hit Dice, and Passive Perception;
- Personality Traits, Ideals, Bonds, and Flaws;
- attack/action rows and additional combat-action text;
- Other Proficiencies & Languages;
- coin values when they exist in the sheet payload;
- inventory/equipment;
- as many resolved Features & Traits as fit without splitting a feature block.

### Official page 2

The generator uses the official character-details page for:

- Character Name;
- Age, Height, Weight, Eyes, Skin, and Hair when present;
- portrait in Character Appearance when the current portrait can be fetched and converted to a PDF-compatible image;
- Appearance text as a fallback or supplement;
- role, affiliation, location, tags, and authorized loaded notes in Allies & Organizations;
- overflow Features & Traits from page 1 in Additional Features & Traits;
- Description, narrative Background, Motivation, Quirk, Mannerism, Voice, and Secret in Character Backstory;
- treasure, coin summary, and inventory recap in Treasure.

### Official page 3

The official spellcasting page receives:

- Spellcasting Class;
- Spellcasting Ability;
- Spell Save DC;
- Spell Attack Bonus;
- known spell-slot totals from `sheet.spellSlots`;
- known/assigned spells grouped into the official Cantrip and level 1-9 sections;
- prepared-spell dots and always-available markers.

The persistent resource ledger remains authoritative for actual spent/remaining spell slots. Until that ledger is explicitly handed into the print path, the official sheet prints known maximum slot totals and does not invent expended-slot counts.

## Data ownership boundary

`pages/npcs.js` remains the owner of selected-character identity, controlled sheet state, narrative/profile data, equipped rows, notes, and permissions.

`hooks/useNpcSheetActionData.js` remains the owner of authorized full inventory rows, spell assignments, and resolved feature rows.

`components/CharacterSheetPanel.js` owns only the **Print Sheet** command. It builds the print model from already-loaded data and opens a blank browser tab synchronously before PDF generation so Firefox/Chrome pop-up blocking does not discard the result.

`utils/printableCharacterSheet.js` is the pure normalized presentation model. It continues to reuse canonical Character Sheet formulas for Armor Class, Initiative, Passive Perception, saves, skills, and shared action construction.

`utils/officialCharacterSheetPdf.js` owns PDF placement only. It:

- loads the official three-page PDF template;
- flattens any existing AcroForm fields when present;
- overlays DNDNext values using `pdf-lib`;
- attempts portrait embedding without failing the sheet when portrait conversion is unavailable;
- performs no Supabase reads and no writes.

## Template and dependency

The branch includes:

- `public/forms/5E_CharacterSheet_Fillable.pdf` — official D&D 5e three-page character-sheet template;
- `pdf-lib@1.17.1` — client-side PDF stamping dependency.

The template asset was downloaded from Wizards' public D&D media host by a one-time GitHub Actions transfer rather than being reconstructed in application code.

## Security and permission behavior

Printing does not create a new data-disclosure path.

The generator can only print information the NPC page already possesses for the current user. It does not query Supabase, bypass RLS, inspect another character, or request protected data on its own. Secrets and private notes appear only when the existing NPC-page permission path already supplied them.

Generating the PDF does not modify character state, equipment, spell resources, notes, encounters, or database rows.

## Regression gate

`scripts/validate_printable_character_sheet.mjs` is registered in the production build runner and verifies:

- canonical AC, Initiative, Passive Perception, save, and skill math;
- normalized demographics and spellcasting metadata;
- official template presence and nontrivial file size;
- actual generation of a valid three-page PDF against the template;
- NPC-page profile/note/portrait handoff;
- official PDF generator wiring in `CharacterSheetPanel`;
- `pdf-lib` dependency presence;
- absence of Supabase access in the print model/generator;
- protected world-map/travel boundaries.

## Protected boundaries

This feature must not:

- change sheet or inventory write authority;
- alter persistent spell-resource or encounter/tactical authority;
- mutate merchant stock/economy/crafting state;
- change NPC selection ownership;
- introduce new authentication/data-loading paths;
- touch world-map routes, movement, travel, weather, camps, or town/city-map behavior.
