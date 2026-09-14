# DNDNext Subclass Tarot Artwork — New Chat Handoff

Use this document as the starting brief for a new chat whose primary job is to continue the normalized Character Forge subclass tarot-card rebuild from the current installed checkpoint.

## START HERE — connector / transfer workflow

Before doing artwork or repository work in a new conversation, use the connected **GitHub, Supabase, Vercel, and Dropbox** tools. Do not rediscover access from scratch.

- **GitHub:** re-fetch PR #187, `agent/subclass-carousel-selector-20260911`, its exact current head, current files, and Actions/check state.
- **Supabase:** verify preferred-source subclass catalogue data in `DnDWeb` (`ucggczovhmauhshvhusx`) when names/queue authority matter; artwork work is read-only and requires no DB mutation.
- **Vercel:** after a push, find the preview deployment whose metadata matches the exact new target-branch Git SHA, wait for `READY`, inspect logs on failure, and use protected-preview fetch/access tools when needed.
- **Dropbox:** use `/DNDNext-Transfer/` for approved binary ZIP payloads. Temporary download links may be single-use, so the GitHub Actions runner should perform the first real GET.

When a real checkout, shell transform, or binary transfer is required, use the proven **scratch/preview branch** pattern: create the scratch branch from the exact PR head, put a one-shot workflow there, have that workflow check out the real PR branch, hard-guard the expected head SHA, modify/validate/commit, and push `HEAD:agent/subclass-carousel-selector-20260911`. The scratch branch itself is a runner surface and is **not merged into PR #187 merely to deliver the result**.

Read `docs/REPO_ACCESS_STANDING_RULE.md`, `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`, and `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` before claiming any access/transfer limitation.

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

The resolver now explicitly maps all 109 installed approved concepts across the active preferred-source deck, including all 18 Wizard concepts. The class-menu fallback remains available only for unmatched/future content. Add new subclass-specific mappings only after Paul approves and the normalized asset is installed/validated.

The subclass carousel implementation lives in:

`components/ClassSubclassSection.js`

The normalized tarot presentation layer now lives in:

`styles/character-forge-subclass-tarot-layout.css`

It is imported last in `pages/_app.js` so the effective carousel ratio is 7:12 without destabilizing the working looping selector while the approved art is installed in batches.

Relevant validators:

- `scripts/validate_class_browser_polish.mjs` — now validates the loaded 7:12 tarot presentation and restrained no-footer shading.
- `scripts/validate_class_subclass_browser.mjs` — protects canonical subclass authority, persistence, looping selector behavior, approved-card mappings, and fallback behavior for unfinished cards.

## Binary artwork materialization route

The binary-transfer path is now both historical and **currently proven**. Reuse the guarded Dropbox -> scratch/preview GitHub Actions -> real PR branch pattern; do not restore reset-era art.

Current normalized install reference:

`f95aea3d05cb7d5c4cecd1d5f4ed049b07ebd3c5` — `Install approved normalized tarot subclass artwork` (first 34 approved 840 × 1440 WebP concepts).

`2180841f21e7352d4f6fbf0881e345b8d95b643d` — `Install approved normalized tarot subclass batch 2` (20 additional approved 840 × 1440 WebP concepts).

`fdd0ee116fc24c455274d7bd682d3bba79df4277` — `Install approved normalized tarot subclass batch 3` (24 additional approved 840 × 1440 WebP concepts).

`04f394f31fda021c5830b520c43c49a76f260877` — `Install approved normalized tarot subclass batch 4` (21 additional approved 840 × 1440 WebP concepts, including Paul-supplied Evocation).

`0a24ba3b8b3e490554ad2eda682f613857b07599` — `Install approved normalized tarot final Wizard batch` (final 10 approved 840 × 1440 WebP concepts; normalized deck reaches 109 / 109).

Current wiring reference:

`40fa46f2710ffadce2962b0bd66e21acefe0bcb5` — `Wire approved normalized tarot subclass artwork` (initial normalized wiring).

`61a2f5379b49ae078f59b0bd558185f4b55212d7` — `Wire approved normalized tarot subclass batch 4` (current 99-concept wiring/checklist/validator checkpoint).

`1249824179027ab903ba0515dc80da1f3c03abdc` — `Wire final normalized Wizard tarot cards` (all 109 preferred-source concepts mapped; validator and checklist completed).

Historical materializer reference:

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

The checklist now records all 109 approved normalized tarot concepts as installed, wired, and validated, with 0 concepts remaining. The preferred-source normalized deck is complete. Evocation remains Paul-supplied/installed and must not be regenerated unless Paul explicitly asks. Future work should be limited to requested redraws/replacements or newly introduced preferred-source subclasses.

## Approval philosophy

Do not rush large batches into the repo. A smaller set of excellent, anatomically sound, compositionally varied cards is preferable to a large batch that contains drift.

Before generating each set, and again after the set is generated, explicitly check it against the canonical standard. If the batch is drifting toward glitter, footer blocks, humans/elves only, repeated poses, soft/grainy rendering, or broken hands, correct it before moving on.

## Completion target

The normalized preferred-source deck requires **109 distinct art concepts** across the active preferred subclass catalogue. **All 109 are now installed, wired, and validated; 0 remain.**

Mystic currently has no active preferred-source subclass art queue in the preferred-source join used for this rebuild. Do not invent a Mystic production queue unless the catalogue changes or Paul explicitly asks for it.

## Remaining-deck species priority

For the final Wizard cards and any redraws, preferentially use these underrepresented Forge species before repeating common silhouettes: **Aetherborn, Duergar, Githyanki, Hobgoblin, Khenra, Kor, Lizardfolk, Locathah, Lupin, RimeKin, Plasmoid, and Zombie**. Continue to preserve anatomy/hand/weapon QA and subclass readability.
