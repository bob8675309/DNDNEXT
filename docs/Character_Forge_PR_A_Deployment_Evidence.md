# Character Forge PR A Deployment Evidence

Status date: 2026-08-05

This document records the current implementation and acceptance evidence for PR #170, **Refine Character Forge resilience, presentation, spells, and player authority**. Read it with `Unified_Character_Forge_Status.md`.

## Implemented boundary

PR #170 consolidates player creation into the shared Forge and adds draft resilience, responsive layouts, raster-only portraits, class/subclass guidance, ability generation, Training choices, starting spells, Review dossier presentation, profile scrolling, and player feat/spell authority.

The final class-readability pass:

- preserves imported paragraph breaks and source headings;
- removes redundant `1st-level ... feature` boilerplate already represented by the level header;
- removes isolated internal ability-code artifacts such as `int`;
- deduplicates repeated adjacent text blocks;
- presents long item/plan lists as multi-column lists;
- folds exceptionally long lists behind an explicit **View N listed options** control while retaining every listed rule entry;
- applies the same structured rendering to the detailed guide and left feature-description dock;
- removes the Primary Abilities tile from the Forge class hero.

## Database evidence

Production migrations for controlled tags, subclass choice, starting-spell validation, and player feat/spell authority are active. The most recent authority migration was rollback-tested before production application. An authenticated-player mutation test against an owned character was blocked as intended, and authoritative row counts remained unchanged.

This readability pass requires no database migration and does not rewrite imported class text.

## Validation requirements

The exact final PR head must pass:

- `Validate NPC Forge foundation`;
- `Validate character portrait authority`;
- Character Forge resilience and player-authority validators;
- source/model/security regression suites;
- exact `npm run build:vercel`;
- Next.js production compilation and static generation;
- Vercel preview deployment.

The regression contract now requires the structured class-feature render and forbids reintroducing the Primary Abilities hero tile.

## Protected boundaries

No world-map, town/city-map, route, movement, weather, combat, encounter, or unrelated crafting runtime files belong to this pass.

## Remaining acceptance gate

Do not merge until authenticated browser testing confirms:

- Artificer Spellcasting, Tinker's Magic, Replicate Magic Item, and similarly dense entries are materially easier to scan;
- no mechanics or option entries are missing;
- long lists expand and collapse correctly;
- hover/focus/click still updates the left feature card;
- the class hero contains Hit Die, level, saving throws, and spellcasting but no Primary Abilities tile;
- existing Forge persistence, spell selection, player authority, profile scrolling, and NPC creation remain intact.
