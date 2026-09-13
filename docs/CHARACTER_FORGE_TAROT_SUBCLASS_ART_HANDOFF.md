# DNDNext Subclass Tarot Artwork — New Chat Handoff

Use this document as the starting brief for a new chat whose primary job is to rebuild the Character Forge subclass tarot-card artwork from zero.

## Project / repo context

Repository: `bob8675309/DNDNEXT`

Active working branch for the subclass carousel/art reset:

`agent/subclass-carousel-selector-20260911`

PR: #187 — `Redesign subclass selector as cinematic looping gallery`

The subclass selector behavior is already implemented as a presentation-only looping modal/carousel. Existing class-guide model logic remains authoritative for subclass eligibility, level requirements, persistence, and progression.

### Important project rules

- Before any repo mutation, check the current GitHub branch/head and Supabase project health.
- Current Supabase project: `DnDWeb`, ref `ucggczovhmauhshvhusx`.
- Do not touch the world map unless explicitly discussed first.
- Do not mix world-map behavior with town/city-map behavior.
- Do not alter crafting, inventory, merchants, travel, encounter, tactical, or character rules authority for artwork work.
- Before returning a patch, verify new helpers/hooks/state/props are defined and passed correctly.
- Use the connected GitHub, Supabase, Vercel, Dropbox, and other available project connectors before claiming access is unavailable.

## What was intentionally reset

On 2026-09-12 the previous subclass artwork tree was intentionally deleted from the working branch because the cards had drifted in:

- aspect ratio;
- lower-third formatting;
- opaque footer usage;
- title/emblem placement;
- rendering sharpness;
- excessive gold/glitter/light motes;
- species/gender/composition variety.

This reset is deliberate. Do **not** restore the deleted card files from prior commits unless Paul explicitly asks for a specific old image as a reference.

During the reset, `utils/classes/subclassArtwork.js` was changed to fall back to existing class-menu artwork until newly approved tarot cards are explicitly installed.

## Canonical art standard

Read this first:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

That document is authoritative. The most important requirements are summarized below.

### Canonical dimensions

- Aspect ratio: **7:12**
- Final export: **840 × 1440 WebP**
- Preferred working master: **1680 × 2880** or larger at the same ratio
- Never stretch to fit.
- **Completed 2026-09-13:** the Forge carousel now has a final loaded override at `styles/character-forge-subclass-tarot-layout.css` that forces the effective card ratio to **7:12**, enlarges the modal safely for the taller cards, keeps the browser-owned subclass/status label away from the artwork lower third, and removes the old near-opaque lower shade. Do not revert the effective carousel presentation to 5:7.

### Absolute lower-third rule

**NO FOOTER.**

The artwork must continue all the way behind the title and emblem to the bottom border. A restrained transparent black gradient may be used for readability, but there must be:

- no opaque black rectangle;
- no separate title band;
- no darker footer stacked over another dark layer;
- no hard horizontal boundary between art and title area.

The older Grave-style card treatment is the conceptual reference: art continues through the title area, title/emblem remain readable, lower environment still shows through.

### Preferred visual character

- High-detail cinematic **photorealism** when possible.
- Crisp subject, realistic materials, strong facial detail.
- Drier/more matte rendering.
- Minimal random sparkles, glitter, dust motes, floating light specks, excessive candles/torches, and unnecessary reflective gold.
- Gold should be strongest in the fixed frame/title/emblem, not sprayed across the illustration.
- Background should be detailed and colorful but should not drown out the character.
- Use shine/glow only for intentional subclass effects.

### Variety

- Vary pose, gaze, camera angle, framing, mood, and action.
- Do not have a whole batch facing the same direction.
- Use more than humans and elves: deliberately rotate through Dragonborn, Dwarf, Gnome, Halfling, Goliath, Tiefling, Aasimar, Genasi, Fairy, Autognome, Firbolg, Bugbear, Orc/Half-Orc where appropriate, and other Forge-supported species.
- Vary gender presentation. Do not accidentally make an entire batch all women or all men.
- Some cards may be sexy/glamorous, but keep anatomy believable and do not exaggerate body proportions or overuse exposed skin.
- Some cards should be serious, fierce, gritty, scholarly, old, scarred, stoic, or strange.
- Occasionally one card may intentionally push one quality to an extreme as a standout, but the deck template still remains fixed.

### Mandatory anatomy QA

Before accepting every card at full resolution, inspect:

- both hands and visible finger count;
- wrists/elbows/shoulders;
- knees/feet;
- face/eyes;
- horns/ears/tails/wings;
- weapons and grips;
- bows/strings/arrows;
- books/staffs/instruments/tools;
- companions;
- overlapping limbs and duplicated objects.

If a major hand/arm/weapon/prop is wrong, regenerate the card.

## Recommended production workflow

For each card or small batch:

1. Read the current checklist before generating anything.
2. Verify the subclass still exists in the current preferred Supabase catalogue.
3. Confirm the card is not already approved in the new normalized deck.
4. Pick species/gender/pose/gaze with recent cards in mind.
5. Define one clear subclass fantasy and one primary visual effect.
6. Generate the full-bleed illustration at the highest practical portrait resolution.
7. Normalize/crop to 7:12.
8. Apply one reusable gold frame/title/emblem template rather than asking the generator to reinvent layout every time.
9. Run anatomy/prop QA.
10. Check matte/shine/background clutter.
11. Check carousel-size readability.
12. Show Paul the individual card(s) for approval.
13. Only after approval: export 840 × 1440 WebP, place in the repo, wire the resolver, update the checklist, run CI, then check the Vercel preview.

Prefer **individual cards**, not collages, for approval and production. A collage may be used only as a planning sheet if Paul specifically asks for one.

## Repository wiring contract

Final asset path pattern:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Resolver:

`utils/classes/subclassArtwork.js`

At the reset checkpoint, the resolver intentionally uses class-menu fallback artwork. Reintroduce subclass-specific mappings only for approved cards.

The subclass carousel implementation lives in:

`components/ClassSubclassSection.js`

The normalized tarot presentation layer now lives in:

`styles/character-forge-subclass-tarot-layout.css`

It is imported last in `pages/_app.js` so the effective carousel ratio is 7:12 without destabilizing the working looping selector while the approved art is installed in batches.

Relevant validators:

- `scripts/validate_class_browser_polish.mjs` — now validates the loaded 7:12 tarot presentation and restrained no-footer shading.
- `scripts/validate_class_subclass_browser.mjs` — protects canonical subclass authority, persistence, looping selector behavior, approved-card mappings, and fallback behavior for unfinished cards.

## Binary artwork materialization route

A working binary-transfer path already exists in repository history and should be reused as a **pattern**, not by restoring its old deleted art.

Reference commit:

`30d05db301638d998d7ebbd053750330547ab7d5` — `Materialize reviewed tarot subclass artwork batch`

That commit created a one-time GitHub Actions materializer on `agent/tarot-subclass-transfer-20260911`. The workflow:

1. checked out the exact target artwork branch;
2. guarded the exact expected target head SHA;
3. downloaded a reviewed ZIP payload from Dropbox;
4. verified the ZIP SHA-256 and per-file `SHA256SUMS`;
5. verified the expected WebP count;
6. copied only manifest-listed files under `public/media/subclasses/`;
7. compared the exact changed/staged paths against `MANIFEST.json`;
8. committed as `DNDNext Artwork Materializer`;
9. pushed the exact materialized artwork commit back to the target subclass branch.

A later historical materializer commit was `1772154b6f588f238ca0b12810494bffb976d0ce` (`Install reviewed tarot subclass artwork batch`). Those historical assets were subsequently intentionally purged during the normalized reset, so **do not restore the old payload, old Dropbox URL, or old files**. Reuse only the guarded transfer technique with a newly prepared ZIP containing the currently approved normalized cards.

## Current subclass production queue

Use:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`

The checklist was reset to zero installed normalized tarot cards after the art purge. It is based on the current preferred Supabase class catalogue and groups only explicitly equivalent alias names where one art concept is intentionally shared.

## Approval philosophy

Do not rush large batches into the repo. A smaller set of excellent, anatomically sound, compositionally varied cards is preferable to a large batch that contains drift.

Before generating each set, and again after the set is generated, explicitly check it against the canonical standard. If the batch is drifting toward glitter, footer blocks, humans/elves only, repeated poses, soft/grainy rendering, or broken hands, correct it before moving on.

## Completion target

The normalized preferred-source deck currently requires **109 distinct art concepts** across the active preferred subclass catalogue.

Mystic currently has no active preferred-source subclass art queue in the preferred-source join used for this rebuild. Do not invent a Mystic production queue unless the catalogue changes or Paul explicitly asks for it.
