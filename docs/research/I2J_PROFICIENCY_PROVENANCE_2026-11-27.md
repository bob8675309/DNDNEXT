# Disposable proficiency provenance and reversal

## Contract

An owned grant instance remains the claim. A scratch baseline row keyed by character, effect type and normalized benefit key captures whether the effective benefit existed before the first managed claim. A known absent baseline allows removal after the final claim. A present or unknown baseline preserves the benefit. The baseline persists until there are no active claims and is then retired so a later acquisition captures fresh evidence. The original sheet remains the effective canonical projection. Its original Expertise check still rejects removal of the final supporting skill proficiency, while another claim permits removing one owner.

The disposable trigger observes authoritative materializer INSERT and removal DELETE. It records acquisition evidence independently of an individual grant's `introduced` flag. The sole removal change uses this persisted baseline for the original skill, tool and weapon branches. Original claim lookup, normalization, effects, checks and projection remain in use. The candidate also retains the previously characterized scratch Option A mirror omission. Baseline ownership and account mirror policy are separate decisions. No new public RPC, production DDL or feature-specific engine.

A missing ledger row or null baseline is ambiguous. If a managed claim overlaps an untracked one, historical flags do not establish absence. Preserve effective proficiency and flag it for provenance reconciliation. Do not infer whether the historical state arose from a feat, class, species, background, item or manual edit. The scratch DELETE behavior retires the ambiguous epoch after its final claim. A later acquisition treats any surviving effective proficiency as pre-managed, without assigning its source.

## Acceptance and limits

The unchanged prior stage includes REMOVE-03's introducing-first leak, reverse-order control and original mirror evidence. Initial failed attempt runs 46050267667 and 46050417465 remain part of the history. Diagnostic [run 46051384706](https://github.com/bob8675309/DNDNEXT/actions/runs/46051384706/job/140683283007) independently shows the original deferred “is missing its owned Origin feat instance” error and successful teardown. The accepted reversal stage asserts that error and uses independent-owner specimens for helper characterization. This stage runs afterward through the existing disposable workflow. It exercises both removal orders, three overlapping claims, partial overlap, reacquisition, Expertise and ambiguous historical grants. Weapon coverage uses the existing Tavern Brawler materializer. Signed ordinary advancement supplies canonical fixtures. Acquisitions and removal in the focused probes are privileged private-helper calls with existing ACLs intact.

Production prerequisites include writer inventory and concurrency tests under one character lock, authenticated-only mutation paths, canonical normalization for source aliases, durable baseline and external-source attribution, grant UPDATE/replacement/cascade semantics, backup/rollback, and explicit reconciliation of ambiguous history. The scratch trigger covers INSERT and DELETE only. Do not use it as migration SQL. External/manual changes during an active epoch need an authorized reconciliation policy. Keep every existing grant, independent slot/spell resource and account snapshot intact during staged evaluation.

## Authorized replacement and consolidation

Migration 35 (`b46f6627813d87b7976cba9cb42663e7d861c81f`)'s public v5 verifies progression edit permission and locks progression. Its private replacement v1 resolves the old normalized Invocation and its exact owned feat tuple before removing it, applies any new feat, updates the owning class option and sourceChoices, then lets the deferred graph verify the final state. Migration 36 (`e46894e68849347277980ffa41c710603c06e471`) wraps v1 to initialize the canonical source parent. Later public v5 definitions through migration 60 still call v2. The accepted captured v5 body must be matched to the chosen dependency chain before substituting any caller. The present fixture deliberately uses its historical no-replacement tail. A real signed replacement needs source-pinned group/options generation, the v1/v2 chain and selected caller, suitable level/slot chronology and catalog prerequisites, candidate provenance recorded for that specimen, canonical sheet synchronization, original deferred validators and exact owner/grant tuple. Retain the helper-only orphan rejection and demonstrate whole-transaction rollback at a downstream failure. Never expose a private helper as a test API.

Owner I2J `49065cd13e48f3c596f1d96749222fe19eab6e31` already has the prior reversal blob `0479563ebd872d34f4d8045554cefa297d5dc762`. Its signed [job 140708834269](https://github.com/bob8675309/DNDNEXT/actions/runs/46059135105/job/140708834269) and teardown now report success. After review, consolidate only this stage, scratch fixture and receipts with one invocation in the existing owner job. Preserve the existing owner workflow admission, all earlier cases, and original Forge scope. No owner write has been made. Restored parity, mounted UI, concurrency, actual signed replacement and production integration remain separate.

**Next executable deliverable:** stage the original migration-35/36 Invocation replacement chain and prove a real signed replacement transaction preserves a sibling claim and rejects invalid final Expertise removal atomically.

## Signed evidence

Exact executable `6e437e8cf69b7f0925ef5e12fc60957ae84a406c` passed [run 46061144915, job 140715438140](https://github.com/bob8675309/DNDNEXT/actions/runs/46061144915/job/140715438140#step:7:1). GitHub reports disposable startup, all 54 inherited cases plus PROV-01..06, and teardown success. [Tactical preservation 46061144812](https://github.com/bob8675309/DNDNEXT/actions/runs/46061144812) and [research docs 46061145065](https://github.com/bob8675309/DNDNEXT/actions/runs/46061145065) passed. Direct raw step access returned HTTP 404. The following were enforced assertions in the successful runner.

| Case | Result |
|---|---|
| Original REMOVE-03 RED | Removing the introducing owner first left orphaned Arcana and Perception after the final non-introducing claim. |
| PROV-01 | Both corrected orders kept the active claims and ended with identical canonical state. Only exclusively granted skills cleared. The pre-existing tool remained. |
| PROV-02 | Three Arcana claims and partial overlap on Athletics and tools reconciled independently. A later reacquisition created a new baseline and cleared on final removal. |
| PROV-03 | A surviving claim preserved Expertise. Removing the final supporting non-introducing claim returned `P0001` and left ledger, effects, sheet, grants and accounts unchanged. |
| PROV-04 | Overlapping untracked historical claims recorded null baseline and preserved ambiguous proficiency after final removal. |
| PROV-05 | Original Tavern Brawler materialization used the same baseline path for its exclusively granted weapon proficiency. |
| PROV-06 | Unrelated character, spell, slot and rest snapshots, legacy account rows, Lessons and pinned functions remained unchanged. The original removal definition was restored before teardown. |
