# DNDNext Next-Chat Handoff Brief

Updated: 2026-09-14

Repository: `bob8675309/DNDNEXT`

Stack: Next.js Pages Router 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## Start here

Use the connected project tools before claiming access is unavailable. GitHub is source/branch authority, Supabase is live database authority, Vercel is deployment authority, and Dropbox is the approved binary-art transport bridge. Re-fetch all live branch heads before writing because the SHAs below are checkpoints, not permanent identifiers.

Production/default branch checkpoint at this handoff: `main` at `02854698298f357d2dfde21dd292ba7caf73e1c1`.

Active Character Forge subclass work:

- PR #187 — `Redesign subclass selector as cinematic looping gallery`
- branch: `agent/subclass-carousel-selector-20260911`
- pre-handoff-update head: `b1807474149e26d741383ec2a633b8306560f307`

Deployment-storage mitigation is a separate open change:

- PR #188 — `Reduce Vercel preview deployment storage churn`
- branch: `agent/vercel-storage-guard-20260914`
- it makes ordinary `agent/*` Vercel previews opt-in with `[deploy-preview]` once merged; do not assume it is active on `main` until PR #188 is actually merged.

Never merge an open PR without Paul's explicit approval.

## Critical subclass-tarot correction — 109 is NOT the runtime completion target

The older documentation/checklist used **109 preferred-source normalized concepts** as the completion number. Keep 109 as a historical preferred-source checkpoint only. It is not the correct definition of finished artwork for the actual Character Forge carousel.

The current runtime audit found **149 visible subclass choices**. Paul's completion target is therefore:

**149 visible choices / 149 dedicated tarot cards.**

Intentional aliases are allowed only where Paul explicitly decides that two visible subclass names should share the same artwork. A visible choice must not silently inherit generic class artwork merely because an older preferred-source checklist did not include it.

### Wizard compatibility/reprint identities

The repo contains normalized assets/mappings for all 18 Wizard concepts in the older checklist, but the compatibility resolver suppresses four duplicate/reprint identities from the actual visible Wizard carousel:

- Abjuration is suppressed in favor of the corresponding resolved Wizard choice.
- Divination is suppressed in favor of the corresponding resolved Wizard choice.
- Evocation is suppressed in favor of the corresponding resolved Wizard choice.
- Illusion is suppressed in favor of the corresponding resolved Wizard choice.

This is why the historical **18-Wizard concept** ledger and the actual **14-card visible Wizard runtime list** differ. Do not treat those four suppressed names as missing runtime cards.

### 43 real runtime fallback cards still needing dedicated artwork

These are the actual visible subclass choices that still resolve to class/fallback artwork and therefore remain in the production queue:

- **Barbarian (7):** Ancestral Guardian, Battlerager, Beast, Giant, Storm Herald, Totem Warrior, Wild Magic.
- **Bard (4):** Creation, Eloquence, Swords, Whispers.
- **Fighter (6):** Arcane Archer, Cavalier, Echo Knight, Purple Dragon Knight (Banneret), Rune Knight, Samurai.
- **Monk (7):** Ascendant Dragon, Astral Self, Drunken Master, Four Elements, Kensei, Long Death, Sun Soul.
- **Mystic (6):** Avatar, Awakened, Immortal, Nomad, Soul Knife, Wu Jen.
- **Paladin (5):** Conquest, Crown, Oathbreaker, Redemption, Watchers.
- **Ranger (4):** Drakewarden, Horizon Walker, Monster Slayer, Swarmkeeper.
- **Rogue (4):** Inquisitive, Mastermind, Scout, Swashbuckler.

Total: **43 real fallback cards**.

## Artwork authority and production contract

Read these before generating or wiring more subclass artwork:

- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

The art standard remains 7:12, final export 840 x 1440 WebP, full-bleed artwork through the lower third, no opaque footer/title band, fixed frame/title/emblem geometry, strong anatomy/prop QA, and explicit resolver wiring only after Paul approves the card.

Final asset path: `public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`.

Resolver: `utils/classes/subclassArtwork.js`.

Carousel: `components/ClassSubclassSection.js`.

Presentation: `styles/character-forge-subclass-tarot-layout.css`.

The selector remains presentation-only. Existing class-guide/model logic remains authoritative for subclass eligibility, level gating, selection, persistence, and progression injection.

## Validator status / next safe runtime follow-up

`scripts/validate_class_subclass_browser.mjs` currently proves the historical 109 installed/mapped preferred-source concepts and permits unmatched content to use class-art fallback. That validator is therefore not yet a complete runtime-visible 149-card audit.

The next safe runtime follow-up, separate from artwork generation, is to strengthen validation so it enumerates the actual visible Forge subclass choices and fails whenever a visible choice unexpectedly falls back to class artwork. Preserve deliberate alias decisions and the four suppressed Wizard compatibility/reprint identities.

Do not weaken the existing validator merely to make new art pass.

## Binary artwork workflow

For approved/generated binary artwork use the established route:

`approved bytes -> normalized files -> manifest/checksums -> ZIP -> Dropbox /DNDNext-Transfer/ -> guarded scratch GitHub Actions runner -> exact PR #187 branch/head guard -> verify count/dimensions/checksums/paths -> commit -> push real PR branch -> GitHub verification -> Vercel preview when intentionally requested`

Do not regenerate approved artwork just because transfer is inconvenient, and do not restore the intentionally purged pre-normalization tarot deck from old commits.

## Mandatory startup sequence for the next developer/chat

1. Read this file and the dedicated subclass-art handoff/checklist.
2. Re-fetch `main`, PR #187, PR #188, and their exact heads.
3. Inspect live source/runtime before relying on prose if anything conflicts.
4. For subclass work, distinguish the historical 109 preferred-source concept checkpoint from the authoritative 149 visible-runtime completion target.
5. Continue the 43-card fallback production queue unless Paul changes priorities.
6. Keep artwork-only work free of Supabase writes and unrelated gameplay changes.
7. Verify every new helper/hook/state/prop/callback/data field is actually defined and passed.
8. Run focused validators and re-check the exact branch diff.
9. Do not touch the world map unless Paul explicitly asks.
10. Never merge without Paul's explicit approval.

## Non-negotiable project boundaries

World-map and town/city-map behavior are separate systems. Do not touch `components/MapPageClient.js`, world travel/routes/weather/camps/world clock for Character Forge artwork work. Do not widen subclass-art tasks into crafting, inventory, merchants, encounters, tactical rules, travel, or economy systems. Preserve working runtime and persistence authority.
