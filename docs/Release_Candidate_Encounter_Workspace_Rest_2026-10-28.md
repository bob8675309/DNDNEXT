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
