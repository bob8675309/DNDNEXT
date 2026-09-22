# Character Forge Subclass Artwork Status

Status date: 2026-09-21

This is the current focused handoff for the Character Forge subclass Tarot deck and its selector presentation. Older rollout counts such as 33 remaining cards, 109 total concepts, 456x240 selector thumbnails, or the compact two-column selector are historical checkpoints and are not current completion authority.

## Current completion authority

- Runtime-visible subclass choices: **149**
- Runtime-visible choices with dedicated approved Tarot cards: **149**
- Runtime-visible generic/class fallback cards: **0**
- Normalized installed artwork concepts in the repository ledger: **152**
- Current missing-card queue: **0**

The difference between 149 visible choices and 152 normalized installed concepts is intentional. Historical compatibility/reprint identities and explicit aliases remain represented in the resolver/art ledger while the actual Forge runtime suppresses duplicate/reprint Wizard identities.

The historical Wizard compatibility identities **Abjuration, Divination, Evocation, and Illusion** are not missing current carousel choices and must not be re-added solely to make the visible count match the normalized ledger.

The canonical detailed completion checklist is:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`

## Current card standard

The active Tarot standard is:

- 7:12 aspect ratio
- 840x1440 WebP final export
- full-bleed illustration through title/emblem area
- no opaque footer/title band
- reusable antique-gold frame/title/emblem geometry
- restrained readability gradient
- cinematic fantasy realism
- deliberate species/gender/presentation/pose/environment diversity
- mandatory anatomy, hands, weapon, prop, companion, and species QA at full resolution

Detailed authority:

`docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

## Current resolver authority

Artwork resolution remains centralized through:

`ClassSubclassSection.js -> subclassArtworkFor(classKey, option) -> utils/classes/subclassArtwork.js`

`utils/classes/subclassArtwork.js` contains the approved class/family mappings and intentional aliases. Unknown/future subclass identities retain a safe fallback through `classMenuArtworkFor(...)`.

Artwork mapping is presentation-only. It does not create subclass eligibility, source authority, level gates, persistence, or progression rules.

## Current selector presentation

PR #193 completed and merged the 149-card Tarot deck plus the runic selector baseline on 2026-09-18 as `1e5c0795010a4714250d309ecefc68ee67977e2d`.

The active presentation continuation is PR #194, `agent/subclass-carousel-drag-crisp-20260918`. Its controlling design is documented in:

`docs/Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md`

Current flexible-ring rules supersede the fixed “four prominent front cards” description from the PR #193 checkpoint:

- one physical ring contains every subclass option;
- angular spacing is `360° / N`;
- one exact front position is the hero;
- side/rear scale, opacity, face/back presentation, and yaw derive continuously from ring position;
- no fixed visible-card cap;
- clicking a face-up card rotates that card to hero and owns explicit inspection/selection intent;
- carousel motion alone must not silently change the dossier or persist a subclass.

The PR #193 runic cathedral/table assets remain presentation assets and may be replaced/reworked if necessary to match the accepted visual target without altering the Tarot deck.

## Current implementation checkpoint

Artwork/deck completion baseline:

- PR #193 merged on 2026-09-18 as `1e5c0795010a4714250d309ecefc68ee67977e2d`;
- current runtime-visible coverage remains 149/149 dedicated approved cards;
- known runtime-visible generic/class fallback count remains 0.

Active presentation continuation:

- PR #194 — `Refine subclass Tarot carousel interaction and clarity`;
- reviewed head: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`;
- exact-head Vercel preview: READY at the 2026-09-21 reconciliation;
- GitHub `Validate Class browser polish`: currently failing because the validator still asserts the superseded browsed-card dossier fallback;
- current source intentionally separates carousel motion from explicit inspection/selection intent.

PR #194 is behind current `main`; post-base file overlap is limited to the handoff document, not the carousel runtime files. Re-fetch all exact-head state before any merge.

## Validation guard

`scripts/validate_class_subclass_browser.mjs` and `scripts/validate_class_browser_polish.mjs` protect the current presentation and authority split. Together they verify the runic-orbit structure, one-card modulo navigation, stable artwork resolver path, dedicated current deck coverage, safe future fallback, selection calls, and protected boundaries.

The normal Vercel build also remains authoritative for production compilation. The 2026-09-18 exact implementation preview compiled successfully under Next.js 16.1.6.

## Future artwork rule

If a future catalogue change introduces a new runtime-visible subclass:

1. Confirm the exact visible identity from current Forge runtime/catalogue behavior.
2. Treat it as incomplete until Paul approves its dedicated card.
3. Author/export to the 7:12 840x1440 WebP standard.
4. Install under `public/media/subclasses/<class-key>/`.
5. Wire the exact identity in `utils/classes/subclassArtwork.js`, unless Paul explicitly approves an alias.
6. Shrink the fallback count back to zero.
7. Run focused CI and an intentional browser preview.

Do not assume 149 is permanent if future source imports add or expose new playable subclass identities.

## Protected boundaries

Subclass artwork and the selector are presentation work. Do not use this work as authority to change:

- Supabase schema/data
- subclass gameplay rules or progression
- world-map behavior
- town/city-map behavior
- travel/routes/weather/camps/clock
- crafting/inventory/merchants/economy
- encounter/tactical authority
- unrelated Character Sheet runtime behavior
