# Unified NPC and Player Character Forge Status

Status date: 2026-08-04

This document controls the temporary user-testing interruption requested after the Dawn sprite pipeline handoff. When this slice is accepted, active development returns to `Dawn_High_Quality_Prototype_Plan.md`.

## Test evidence

A real external tester, referred to as **Rinshin**, created an account and attempted the player Character Forge. Read-only production inspection confirmed:

- the Auth account exists;
- the corresponding `players` row exists;
- no `character_permissions` row was created for the account;
- no new character was created by the attempted Forge session.

The tester also reported panels with broken formatting and controls reaching the viewport edge or becoming unreachable. This is therefore both a responsive-UI defect and a player-character creation/linking failure.

The tester's email address is intentionally not stored in repository documentation.

## Architecture decision

DNDNext now uses **one shared Forge** for NPC and player-character creation.

`NewNpcModalV3Refined` remains the canonical visual and rules-entry implementation because it contains the stronger flow:

1. Species
2. Background
3. Class
4. Abilities
5. Training
6. Identity
7. Story
8. Review

The former `PlayerCharacterCreatorV2` controller is reduced to a thin player-mode adapter around the shared Forge. It no longer renders a separate near-duplicate `PlayerCharacterForgeView`.

The shared adapter redirects only the final `create_character_v1` request while player mode is mounted. NPC/admin creation continues to use `create_character_v1`; player mode uses the guarded `create_player_character_v2` authority.

## Player-mode differences

Player mode deliberately differs from NPC mode only where ownership or NPC-only capabilities require it:

- adds the `player-character` tag;
- creates an editable/inventory permission for the signed-in user;
- disables storefront and world placement;
- hides merchant and workshop-provider controls;
- requires an adventuring class;
- permits campaign-approved starting levels 1–20;
- creates canonical progression at the selected level;
- permits more than one player character per account;
- keeps portrait/species-choice persistence and the shared review flow.

## Profile behavior

The profile panel now loads all editable player-owned characters through `get_my_player_characters_v2` and provides:

- an Active Character selector;
- immediate switching without changing ownership;
- a **Create another character** action;
- automatic selection of the newly created character;
- the existing Backspace toggle, explicit close behavior, auth-lock deferral, and stale-request guards.

The legacy `get_my_player_character_v1` function remains available for compatibility but is no longer the controlling multi-character read path.

## Responsive reachability

`styles/character-forge-responsive.css` establishes the shared viewport contract:

- the Forge never exceeds the dynamic viewport height;
- the main body owns scrolling;
- the step rail scrolls horizontally instead of forcing the modal wider;
- the footer remains sticky and reachable;
- footer actions wrap on constrained widths;
- safe-area insets are respected;
- mobile presentation uses the full dynamic viewport;
- player-character selection controls stack on narrow screens.

These rules apply to both NPC and player creation because both use the same component.

## Database authority

`sql/20260804_01_multi_player_character_forge_v2.sql` adds:

- `get_my_player_characters_v2()`;
- `create_player_character_v2(jsonb, jsonb)`.

`sql/20260804_02_player_forge_progression_upsert.sql` makes progression initialization compatible with the existing `character_sheets` progression trigger. The trigger may create the progression row before the creation command reaches its final progression step, so the v2 command uses a deterministic upsert rather than attempting a duplicate insert.

The v2 creation command is authenticated, idempotent through `creation_request_id`, validates the selected class and level, creates character/sheet/permission/progression/event rows transactionally, and preserves portrait/sprite metadata. The original v1 entry point remains unchanged.

### Rollback-only live-schema evidence

The deployed functions were tested against the live schema inside transactions that were explicitly rolled back:

1. A level-6 Fighter request was submitted twice with the same `creation_request_id`.
   - both calls returned the same character UUID;
   - progression resolved to level 6 and 14,000 XP;
   - `can_edit` and `can_inventory` were true.
2. Two distinct requests were submitted for the same account.
   - one created a level-3 Fighter;
   - one created a level-8 Wizard;
   - `get_my_player_characters_v2()` returned both characters;
   - the progression levels were `[3, 8]`.

After rollback verification:

- no validation character remained;
- Rinshin still had zero character permissions;
- the live character count remained seven.

## Deployment state

PR #168 merged into `main` as `c36555780951f9796818b8a8b33cf90f41ac9906`. Its first Vercel deployments stopped before `next build` because older exact-text validators had drifted behind the current sprite documentation and consolidated Character Forge ownership.

PR #169 is the bounded deployment-repair follow-up. Exact-head commit `d7f0c45c4baec15c9c62f2a20a7e8e7aa833c352` passed GitHub Actions run 230 and the Vercel deployment check. The production runner completed every source, Character Forge, profile-selection, sheet, crafting, security, tactical, and documentation validator before reaching `npx next build`. Next.js 16.1.6 compiled successfully and generated all 27 static pages.

The repair also makes `validate_unified_character_forge.mjs` part of the production build runner and gives the NPC Forge workflow an inspectable `npm run build:vercel` gate. Source and database readiness are therefore green. Authenticated browser acceptance remains pending and no checklist item below is complete until Rinshin performs the real production test.

## Known limitation: starting spell-selection parity

The old level-one player creator included a dedicated canonical starting-spell picker. The richer NPC Forge currently exposes spell notes rather than the same source-backed player selection workflow.

For this testing-unblock slice:

- caster characters may be created without canonical starting spell assignments;
- their sheet is marked `startingSpellSelectionPending`;
- spells can be granted through the existing Spellbook/Admin surfaces;
- the shared Forge must receive source-backed class-and-level spell selection before this consolidation is considered fully complete.

This limitation must not be hidden or described as complete parity.

## Acceptance checklist

- [ ] Rinshin can reopen the player Forge and reach every step/footer control.
- [ ] A first player-owned character can be created and linked.
- [ ] Starting level can be selected from 1 through 20.
- [ ] A player with one character can choose **Create another character**.
- [ ] The selector switches between owned characters without stale sheet state.
- [ ] NPC Forge still creates NPCs/merchants through its original guarded RPC.
- [ ] NPC-only storefront/workshop controls do not appear in player mode.
- [ ] Portrait and required species choices persist.
- [ ] No world-map, town-map, encounter, crafting, or unrelated data changes occur.
- [ ] Starting spell-selection parity remains tracked until implemented.

## Return to Dawn

After this slice passes user testing and documentation is reconciled, return to:

1. `docs/Dawn_High_Quality_Prototype_Plan.md`;
2. one high-quality South-facing Dawn idle/walk prototype;
3. no new full 32-cell Dawn atlas until the South prototype is visually approved.
