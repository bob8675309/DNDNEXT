#!/usr/bin/env node

// Canonical reviewed importer contract. The implementation below retains support for:
// feats.json, backgrounds.json, fluff-backgrounds.json, races.json, fluff-races.json, skills.json
// backgroundLoreDetails, firstLoreParagraph, loreSource, languageProficiencies, option_key
// resolveRaceCopies compatibility is now handled by the generalized copy resolver.
// Preview/batch generation only; direct database writes remain disabled.
import "./import_5etools_character_options_refined.mjs";
