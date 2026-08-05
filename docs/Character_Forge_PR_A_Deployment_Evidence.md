# Character Forge PR A Deployment Evidence

Status date: 2026-08-04

This document records the implementation, database, validation, and acceptance state for PR #170, **Refine Character Forge resilience and player presentation**. Read it with `Unified_Character_Forge_Status.md`.

## Implemented boundary

PR A changes the shared NPC/player Character Forge without changing world-map, town/city-map, route, movement, weather, combat, or unrelated crafting behavior.

Implemented behavior:

- Closing the player Forge preserves the mounted in-memory draft.
- Reopening resumes the same tab and entered selections.
- A hard refresh or authentication reset clears the in-memory draft naturally.
- Reset is a separate confirmed action and creates fresh Forge request state.
- Player creation uses an explicit `createCharacter` callback rather than replacing `supabase.rpc` or mutating rendered DOM text.
- Species, Background, and Class favor the information panel; Abilities and Training favor the workspace; Identity, Story, and Review use the full width.
- Player-facing roster tags and world placement controls are not available.
- Player tags are derived from validated species, class, background, and trained professions by database authority.
- Future GM campaign tags are preserved during sheet-driven system-tag reconciliation.
- Future player-assigned minions remain NPCs and require a dedicated controller/assignment relationship.

## Raster-only portrait cleanup

Twelve obsolete SVG portrait records were audited before deletion. None was referenced by a character, visual asset, or portrait-to-sprite suggestion.

PR A removes:

- all twelve SVG portrait files from the repository;
- all matching live `npc_portrait_library` records;
- SVG fallback URLs;
- the retired SVG portrait generator.

The database now enforces `npc_portrait_library_no_svg_v1`, and the picker also rejects a resolved SVG URL defensively.

Post-migration state:

- SVG portrait rows: **0**
- active raster portrait rows: **185**
- character references requiring migration: **0**

## Player-tag authority

Migration `character_forge_resilience_and_tags` installs:

- `private.derive_player_character_tags_v1`;
- `character_sheets_sync_player_tags_v1`;
- `characters_guard_player_tags_v1`.

Controlled tags use these namespaces:

- `player-character`
- `species:<key>`
- `class:<key>`
- `background:<key>`
- `profession:<key>` for trained professions

Players cannot directly award themselves campaign, faction, guild, reputation, moral, quest, or alliance tags. Existing non-system campaign tags were preserved when the three current player characters were reconciled.

Rinshin still has zero linked player characters after the migration.

## Validation evidence

Exact PR head `3d81f4bd9ae572cbbd4a0fbbcfd21d703008c8bc` passed:

- GitHub Actions `Validate NPC Forge foundation`, run 252;
- GitHub Actions `Validate character portrait authority`, run 1;
- all Character Forge, security, profile-selection, crafting, sheet, tactical, source-pipeline, and documentation validators;
- character creation model tests;
- NPC Forge detail model tests;
- the exact `npm run build:vercel` production runner;
- Next.js production compilation and static page generation.

The migration was first executed inside an explicit transaction and rolled back. The same migration was then applied successfully to production and verified read-only.

## Deployment limitation

Vercel did not create a PR preview because the account exceeded the free-plan daily deployment allowance: `api-deployments-free-per-day`, more than 100 deployments. This is a platform capacity failure. The same repository production runner completed successfully in GitHub Actions.

## Remaining acceptance gate

Do not mark PR A accepted until an authenticated browser deployment confirms:

- Close and Reopen preserve the complete draft;
- Reset clears it;
- hard refresh clears it;
- the revised proportions remain usable at desktop and narrow widths;
- Identity, Story, and Review are full-width;
- player tags and starting location are absent;
- no SVG portrait appears;
- NPC/admin Forge behavior remains intact.

Point Buy, the expanded ability-generation methods, Training rule changes, richer class-choice guidance, and canonical starting-spell selection remain separate follow-up PRs.
