# DNDNext Consolidated Development Archive — 2026-10-30

## This branch is NOT a release candidate
The **working tree** is intentionally the validated experimental Eldritch Blast/Agonizing Blast draft PR #304, plus this documentation and a separate branch-consolidation commit. It does **not** install the SQL candidates, expose a spellcasting endpoint, merge unfinished atomic Attack or attunement code into the active application, touch the world/town maps, or change production Supabase data.

The consolidation commit is an intentional **multi-parent history-preservation commit**, not a content merge. Each additional parent makes the entire historical research chain available from this ONE retained branch even if its old preview branches are deleted. To revive code, locate and cherry-pick/review the relevant source commit; DO NOT treat an additional parent's code as present in the current working tree.

### Current tested working tree
- Main production ancestor `75c387e9276739f04b56d7fa96e4041931b3d9f4`
- Eldritch Blast + shared Warlock Agonizing Blast draft PR #304: `7736e0249c41e0e297cfbee35e26c03e25093375`
- Status: all exact-head #304 GitHub source checks, disposable PostgreSQL16 integrations and class browser checks passed before this archive, but real signed-in Supabase staging is **not** tested. The RPC has **no role EXECUTE grant**. Keep it draft/nonproduction.

### Historical parent heads retained without applying their file contents
- [#299](https://github.com/bob8675309/DNDNEXT/pull/299) — `c73075d92ca9361dc05bc901d2d6652a33ef857a`: Atomic Attack + attunement/hand-state stacked research; non-release, known failing test cases
- [#295](https://github.com/bob8675309/DNDNEXT/pull/295) — `ffa8120bd0e0b72edfac18484d80a45c9e06c542`: Separate authenticated Attack caller boundary fork; non-release
- [#265](https://github.com/bob8675309/DNDNEXT/pull/265) — `df8b311153b707ad2ee2f6a3a1d27282b9922597`: Attunement world-clock and rest research branch lineage; non-release
- [#259](https://github.com/bob8675309/DNDNEXT/pull/259) — `38e4441052c7b4e41058ca646464017fb01bb139`: Effects release-readiness and authority docs draft; non-release
- [#250](https://github.com/bob8675309/DNDNEXT/pull/250) — `132b0484ccc45bbcc87827db0eb483896ae446e1`: Physical Specimen Warlock/Grim Hollow Patron staged runtime and encounter HP reconciliation; non-release.
- [#255](https://github.com/bob8675309/DNDNEXT/pull/255) — `dda0f432d963a5b6a87b65e5f6f4bbd27a860602`: Common effects resolver & source-parity tests lineage; non-release

### Ancestry relationships checked before archiving
- #299 descends from the main 2026-10-25 through 10-28 combat/hand/attunement stacked chain beginning #267; source PR #295 forked separately and is explicitly preserved.
- #265 incorporates the draft early attunement research lineage including #257.
- #255 incorporates the generic effects source-parity lineage beginning #251.
- #259 is a separate effects-readiness documentation branch.
- #266 and #300 were previously consolidated into production PR #301 and already superseded.

### Safe branch cleanup policy
1. Keep `main` and `work/consolidated-encounter-research-20261030` protected from deletion.
2. Keep any unique head **not provably an ancestor** of `main` or this preservation branch until individually classified.
3. Close superseded draft PRs only after verifying source head reachability; never mark them as merged or production-ready.
4. Delete only exact-head-verified branch references, checking SHA immediately before deletion, because GitHub branches can receive later commits.
5. Delete preview deployments only through Vercel deployment retention or an authorized Vercel deletion interface. Branch deletion alone does NOT instantly remove preview artifacts, and deletion can remove rollback options.
6. Avoid additional pushes/preview churn. Keep no more than one new active development branch and batch meaningful changes.

### Release blockers
- Proper staging-only verified JWT/PostgREST authorization using two real accounts; no service_role spoofing.
- Permissions revocation and concurrent request tests against actual signed-in sessions.
- Spell adapter family parity (attack/save/area and extra invocations), multiclass total character level, and any effects code reviewed independently.
- Atomic Attack candidate #299 still has failing fixture tests and is **not included in the active worktree**.
- UI integration and signed-in browser acceptance before enabling the spell. Keep production unmodified.

### Restoration
Use the exact commit SHA above in `git show <sha>:<path>` or `git checkout <sha> -- <path>` in a disposable worktree after reviewing dependencies. The multi-parent graph preserves the commits, not the old branch names or Vercel preview builds.

### Audit addendum
All **46** open draft PR heads were individually compared with this consolidation ancestry. The first archive preserved **45**, but #250 was independent, so its exact head was added as an extra parent of the follow-up archive commit. Verify final ancestry before closing PRs.
