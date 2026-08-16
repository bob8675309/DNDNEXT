# Forge Species — Accepted Post-PR #170 Baseline

Status date: 2026-08-16

This ledger is no longer an active PR #171 work queue. It records the accepted Species baseline established through merged PRs #171–#173.

Accepted runtime/code baseline:

`8c37e30063d2523a5f488073d3ea60c5571c7182`

Historical/merged chain:

- PR #170 — foundation — `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species artwork/presentation + Profile/Forge continuation — `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — Eladrin/Hexblood/shared readability — `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — Simic Hybrid Animal Enhancement descriptions — `8c37e30063d2523a5f488073d3ea60c5571c7182`.

Do not describe #171–#173 as open. Older screenshots/checkpoints in historical ledgers do not override this accepted state.

## Status

Paul considers the Species tab complete enough to freeze as the current baseline. Do not begin another broad Species redesign without a concrete browser reproduction or an explicit new design request.

The next planned Forge audit is Background.

## Accepted catalogue behavior

- Desktop Species catalogue expands with the right-side content while maintaining its own scroll area.
- Search reveals the matching parent and matching child together rather than orphaning a child result.
- Parent/child rows use larger portrait thumbnails and compact chrome.
- Parent-persisted family presentation never replaces canonical save identity.
- Real setting/source rows remain real catalogue rows even when visually nested.
- Continue validation visibly identifies the first unresolved required choice.

### Parent-persisted/source-choice families

Current families include:

- Genasi;
- Dragonborn;
- Aven;
- Elf;
- Gnome;
- Shifter;
- Fairy/Faerie;
- Kithkin.

These families reuse canonical source-choice state. Do not create parallel subrace state merely for presentation.

### Inline trait choices

Examples include:

- Goliath Giant Ancestry;
- Tiefling Fiendish Legacy;
- Simic Hybrid Animal Enhancement;
- other source traits whose lifecycle is a trait-level permanent choice rather than a catalogue child.

## Accepted Species hero/fact presentation

The large right-side Species hero uses Forge-specific portrait artwork where available and exposes concise semantic facts:

- Speed;
- Size;
- Creature Type;
- Vision/Darkvision;
- Languages;
- Gender & Alignment.

Rules:

- Common is normally implicit for player characters and should not consume visual space unless an exception matters.
- Variable Size and Languages reuse canonical source-choice state.
- Darkvision hover/focus explains dim-light, darkness, and grayscale behavior.
- Creature Type may include source ancestry identity where rules require it, such as `Humanoid, Elf`.
- Gender & Alignment edits existing draft fields rather than introducing a separate presentation state.

## Accepted feature presentation

### Dragonborn

Selected ancestry/family metadata carries the actual damage affinity into player-facing Breath Weapon and resistance text. Flavor may clarify the selected energy type, but mechanics remain source-backed.

### Aasimar

Transformations are structured readable information. They are not treated as a one-time permanent creator lock when the source allows choosing a transformation per use.

### Goliath

Giant Ancestry is the reference pattern for a persistent source choice with multiple readable options:

- compact choice buttons;
- one selected option;
- full selected benefit displayed beneath the buttons.

### Eladrin

Seasonal Fey Step follows the same compact selected-detail pattern.

The universal Fey Step rules stay above the selector. Autumn/Winter/Spring/Summer rider descriptions live with the choice detail rather than being repeated in a long paragraph and again below.

Persistence/lifecycle remains unchanged:

- a starting season is required;
- the four stored keys remain `autumn`, `winter`, `spring`, `summer`;
- starting at character level 3 the current season modifies Fey Step;
- the current season may be replaced after Long Rest through established runtime authority.

### Hexblood

Eerie Token's source-named `Distant Message`, `Remote Viewing`, and `Hex Magic` entries are simultaneous informational benefits, not mutually exclusive creator choices. They are presented as readable benefit cards beneath the short feature introduction.

### Simic Hybrid

Animal Enhancement now retains the source descriptions for each option.

Level-1 pool remains:

- Manta Glide;
- Nimble Climber;
- Underwater Adaptation.

At level 5 the second-pick pool also includes:

- Grappling Appendages;
- Carapace;
- Acid Spit.

The level-5 selection remains distinct from the level-1 selection. PR #173 changed presentation data only: labels/keys, level gates, and persistence authority were preserved. The implementation reuses the existing source-list description parser and rich selected-detail renderer rather than hardcoding Simic text in a parallel UI.

### Aetherborn — future narrative unlock

`Gift of the Aetherborn` remains visible and unchanged for now.

Future design decision: acquiring/unlocking this dark Gift should be connected to quest/NPC dialogue progression when those systems are built. The Game Master decides the actual narrative requirement—research, NPC contact, quest, payment, item, sacrifice, or another campaign-specific condition.

Do not invent a universal unlock rule now. Do not remove the source feature, and do not add a temporary parallel Forge persistence mechanism just to anticipate the future quest system.

## Artwork authority

`speciesArtworkFor(...)` remains the canonical non-Forge resolver.

`speciesPortraitArtworkFor(...)` remains the Forge portrait resolver.

Dedicated Forge files may exist while non-Forge family aliases remain stable.

Accepted dedicated artwork families include:

### Genasi

- `air-genasi.webp`
- `earth-genasi.webp`
- `fire-genasi.webp`
- `water-genasi.webp`

### Dragonborn — all 15 ancestries

Chromatic:

- Black;
- Blue;
- Green;
- Red;
- White.

Metallic:

- Brass;
- Bronze;
- Copper;
- Gold;
- Silver.

Gem:

- Amethyst;
- Crystal;
- Emerald;
- Sapphire;
- Topaz.

### Aven

- `hawk-headed-aven.webp`
- `ibis-headed-aven.webp`

### Elf / Gnome

- `drow.webp`
- `high-elf.webp`
- `wood-elf.webp`
- `forest-gnome.webp`
- `rock-gnome.webp`

### Shifter

- `beasthide-shifter.webp`
- `longtooth-shifter.webp`
- `swiftstride-shifter.webp`
- `wildhunt-shifter.webp`

### Fairy / Kithkin

- `lorwyn-fairy.webp`
- `shadowmoor-fairy.webp`
- `lorwyn-kithkin.webp`
- `shadowmoor-kithkin.webp`

### Setting/source aliases

- `dwarf-kaladesh.webp`
- `goblin-dankwood.webp`
- `orc-ixalan.webp`

The dedicated artwork validators established complete WebP payloads, expected portrait dimensions where applicable, unique/routed files, stable canonical aliases, and protected map/travel boundaries.

## Profile portrait presentation

The shared player Profile portrait layout was browser-accepted after PR #171:

- portrait artwork can extend beneath the information stack rather than being chopped at a narrow column boundary;
- the face remains visible on the left while artwork fades into the content area;
- Description lives with the other information panels rather than overlaying the portrait;
- Letho and Varges received image-specific framing adjustments tied to their exact portrait filenames, so later portrait replacements are not globally affected.

Multiple portraits were tested and accepted.

## Database boundary

PRs #171–#173 did not require a Supabase write for the final presentation/readability slices described here.

The live migration ledger has advanced beyond the old migration-93 statement. At the 2026-08-16 documentation refresh, the latest registered migration is:

`20260814161314 grim_hollow_heritage_catalog_support`

Always inspect live catalogue rows and migration state before Species database work.

## Validation authority

Relevant Species/Forge validators include:

- `validate_forge_source_presentation.mjs`;
- `validate_forge_species_fact_choices.mjs`;
- `validate_forge_species_semantic_icons.mjs`;
- `validate_forge_species_catalog_families.mjs`;
- `validate_forge_species_family_expansion.mjs`;
- `validate_forge_species_catalog_portraits_v2.mjs`;
- `validate_forge_species_portrait_integrity.mjs`;
- dedicated family artwork validators;
- `validate_character_forge_nested_choices.mjs`;
- `validate_eladrin_runtime.mjs` when Eladrin is touched;
- `validate_simic_animal_enhancement_descriptions.mjs` when Animal Enhancement/source-list choice construction is touched.

Use the workflows that actually trigger for the changed paths, and verify production-build steps where present.

## Protected boundaries

Species work does **not** authorize changes to:

- world-map behavior;
- town/city-map behavior;
- `components/MapPageClient.js`;
- route/travel/weather/camp/clock logic;
- tactical combat execution;
- crafting;
- inventory;
- merchants;
- unrelated runtime systems.

This ledger is now a baseline/reference document, not an active invitation to keep polishing Species indefinitely.
