# Release Candidate — Unified Encounters and Rest Dialog (2026-10-28)

**State: DRAFT / NOT DEPLOYED OR MERGED.** Branch is assembled directly from `main` commit `863eb7d9809257d525af5c76be4b8d2289603052`.

## Exact included sources

- [PR #300](https://github.com/bob8675309/DNDNEXT/pull/300), head `8f743b3f8f734f4b46bbf699f65943ee6972d133`: new `/encounters/workspace` navigation shell, shared selected encounter through existing staging/movement/combat page components, responsive scoped CSS, dedicated source validation. All original encounter routes remain.
- [PR #266](https://github.com/bob8675309/DNDNEXT/pull/266), head `cf40e453872af39e352e65baf3f2adb84c0570fc`: keyboard-accessible Camp & Downtime dialog from existing Short/Long Rest buttons, guarded `complete_character_rest_v1` recovery, optional attunement disabled, crafting unavailable, separate source validation.
- These upstream changes touch **14 distinct files without overlaps**; combined source paths are incorporated from the exact PR heads, not from later experimental stacked branches.

## Excluded deliberately

- No SQL, auth grants, Supabase migrations, deployed combat RPC changes, physical specimen, effects, attunement settings or attack-sequencing drafts (#267–#299).
- No world map or town map updates.
- No Vercel deployment requested by this release-candidate commit. GitHub/Vercel integrations may auto-trigger previews; verify before promoting. Preview retention should be 24 hours per owner's account setting (not independently verified).

## Validation sequence

1. Validate source-contract suites: `node scripts/validate_unified_encounter_workspace.mjs` and `node scripts/validate_player_rest_buttons.mjs`.
2. Validate combined Next.js production compilation with `npm ci` and `npm run build` **on GitHub Actions**, not by consuming a manual Vercel deployment.
3. Review workflows and exact merged-file scope.
4. Single milestone preview and signed-in admin/player browser acceptance when build checks pass; run test on an explicitly disposable encounter.
5. Confirm encounter selection stays stable when changing sections and on new-session creation; check mobile layout and original routes.
6. Confirm Short/Long Rest dialog focus, Escape/Cancel, disabled when encounter is active, no double completion, recover resource changes but not HP/Hit Dice.
7. Verify no auth boundary regressions and no legacy map changes; no production promotion without explicit owner approval.

## Known product limitations (not hidden)

The workspace is a **single-navigation-shell checkpoint**, not yet a persistent single shared tactical canvas with dockable action panels. Existing page components are reused and remount across sections. The new session selector and embedded selectors need browser QA for state drift especially immediately following session creation. Until browser validation, this remains draft.

The rest dialog does not implement attunement, crafting or HP/Hit Dice recovery.

## Follow-on development

After this release checkpoint, build the persistent shared battlefield and contextual combat controls as a separate feature branch. Do not add unfinished atomic Attack executor work to this release to compensate for the present UI limitations.

## CI build environment note (2026-10-28)

The first GitHub Actions `next build` reached **Compiled successfully** but failed while collecting `/admin` page data because the standalone GitHub worker had no `NEXT_PUBLIC_SUPABASE_URL` or anon key. Vercel deploys use their configured environment. The candidate's CI-only production-build job supplies **deliberately fake**, non-secret Supabase URL and anon key values to permit static module initialization. This is a compilation check only; it never authenticates, connects to production or proves any Supabase-backed interaction. Do not substitute real keys into the workflow or ship the placeholders as runtime configuration.

## Browser acceptance bug: tactical resource-link flicker (2026-10-28)

The owner recorded a ~5-second clip at `/encounters/workspace` showing the Character Resource Link card repeatedly alternating between `Checking linked Sheet & Rolls resources…` and synchronized Pact slot counts while no spell was cast. The card changes height during refresh and destabilizes the surrounding scroll layout.

**Verified via live read-only SQL function-definition review:** `public.encounter_spellcasting_profile_v2` calls `private.sync_character_spell_slots_v1`, whose existing `ON CONFLICT DO UPDATE` emits `character_spell_slots` change events even if the slot counts are unchanged. The global `TacticalCharacterResourceBridge` subscribes to that table and previously called `load` for every event, causing a self-triggered refresh loop. This is not proof of game-state modification by the user.

**Scoped release-candidate remediation:** Only filter an `UPDATE` notification when same-character, same pool/level, remaining/max and recharge key match the latest fetched profile snapshot. Genuine resource changes, INSERT and DELETE still reload. Keep already-valid resource details visible while refreshing rather than collapsing them into a spinner. Add a focused static regression validator. Does not modify Supabase functions, resource amounts, attack logic, or other encounter components.

**Backend follow-up:** The profile-reading RPC currently performs a write-through sync and generates no-op UPSERT updates. Consider a separately reviewed migration to add `WHERE ... IS DISTINCT FROM ...` to the UPSERT, after checking affected consumers, triggers and concurrency. Not included in this release. Verify zero repeated profile requests on an idle encounter in browser DevTools after one consolidated preview, plus real changes from character sheet, cast and turn transition.

## Acceptance follow-up: hidden known spells and team-based Opportunity Attacks (2026-10-29)

User screenshot and ~100-second recording show Macros the Black and Varges both on `players`, weapon/melee and movement operational, no Opportunity Attack, and the 'no tactical spell adapters' message despite Macros having six assigned spells. Read-only Supabase query confirms both participants' `team=players` in active test encounter and no reaction windows for that encounter. `public.encounter_are_hostile_internal_v1` defines only `enemies` against `players`/`allies` as hostile; an Opportunity Attack also requires leaving reach, an available reaction, LOS and no Disengage. Thus missing reaction is expected, not evidence of a broken reaction engine. The GM stage editor had no Team field and cannot edit participants once the encounter is active.

This candidate updates existing **staging-only** GM participant edit to expose a Team dropdown using the existing, already-authorized `admin_update_encounter_participant_staging_v1` argument; displays warnings on Setup and Movement when no hostile pair exists; and lists assigned but non-automated spells without claiming they can be cast. **No unsupported spell adapter is enabled**. Eldritch Blast/Agonizing Blast remains tracked in issue #302; no game state was changed. Test a NEW disposable encounter (stage Varges as `enemies` while still draft), position opposing tokens adjacent, move out of reach without Disengage while the reactor has Reaction available, and confirm server pause/attack/pass/log. Then test staging-time team edits and refresh, and known-spell text for Macros.

## Release hardening: newly created session stays selected across tabs (2026-10-29)

Release review found that GM Staging called `setSessionId(createdId)` locally after `admin_create_encounter_v1` but did **not** call the workspace session-selection callback. Switching to Movement or Combat could therefore display the workspace's previously selected encounter. The stage page now calls `onWorkspaceSessionChange?.(createdId)` after a successful creation, preserving standalone old-route behavior. A source-contract assertion covers the propagation. No database function, user permission, or character state is changed by this fix. Regression: create a disposable encounter and immediately switch among all workspace sections; the selector, status and active session must remain the newly created encounter.
