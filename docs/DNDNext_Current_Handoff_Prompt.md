# DNDNext Current Handoff Prompt

Updated: 2026-08-09

Use this prompt when a new thread takes over PR #170.

---

You are taking over the DNDNext repository as a senior developer and technical advisor.

Repository: `bob8675309/DNDNEXT`

Active PR: **#170 — Refine Character Forge resilience, source choices, spells, and player authority**

Active branch: `agent/character-forge-resilience-presentation`

Stack: Next.js Pages Router + Supabase/Postgres.

## Mandatory first actions

Before changing anything:

1. inspect current `main`, PR #170 head, changed files, and exact-head CI/Vercel;
2. inspect live Supabase migrations/schema/data/grants relevant to the requested slice;
3. read `docs/README.md`, `docs/Documentation_Refresh_Manifest.md`, and the dedicated feature ledger;
4. reconcile source, live DB, and docs before proposing a patch;
5. verify every new helper, hook, state variable, prop, and RPC argument is defined and passed.

GitHub/Supabase are the source of truth if prior-chat prose conflicts.

## Protected boundaries

- Do **not** mix world-map behavior with town/city-map behavior.
- Do **not** touch the world map unless explicitly asked.
- `components/MapPageClient.js` is outside current Forge/progression/runtime work.
- Do not modify route/travel/weather systems as part of this work.
- Do not alter unrelated crafting/inventory or tactical action execution.
- Prefer additive migrations over editing deployed migration history.
- Prove risky DB behavior in rollback and verify zero residue.

## Current production checkpoint

Live Supabase includes this work through **migration 80**.

Recent migrations:

- 74-75 — Wizard Memorize Spell;
- 76 — shared Wizard runtime helper repair;
- 77 — PHB Wizard Cantrip Formulas;
- 78 — Armorer Armor Model + shared `short_or_long_rest` cadence repair;
- 79 — Bestial Soul runtime;
- 80 — Bestial Soul source option resolver fix.

Latest migration: `bestial_soul_option_resolver_fix` (`20260809231912`).

## Armor Model is CLOSED / ACCEPTED

Read `docs/Armorer_Armor_Model_Runtime_Status.md`.

Accepted behavior:

- EFA Armorer 3+: Dreadnaught / Guardian / Infiltrator;
- TCE Armorer 3+: Guardian / Infiltrator;
- initial model may be selected immediately;
- Smith's Tools must be present in effective inventory;
- possession is the explicit proxy for “tools in hand” because no dedicated hand slot exists;
- later replacement requires a newer Short or Long Rest;
- active encounter blocks configuration;
- runtime key `artificer-armorer-armor-model`;
- projection `runtimeFeatures.armorerArmorModel`;
- no armor inventory/AC/combat/crafting mutation in this slice.

Migration 78 also repaired the cadence check to allow `short_or_long_rest`; deployed rollback proved existing Fiendish Resilience can now store that cadence.

## Bestial Soul is CLOSED / ACCEPTED

Read `docs/Bestial_Soul_Runtime_Status.md`.

Source:

- TCE Bestial Soul;
- PHB Barbarian;
- TCE Path of the Beast;
- level 6.

Accepted behavior:

- PHB/TCE Beast only; XPHB Barbarian is ineligible;
- the always-on magical natural-weapon clause is not a configurable choice;
- adaptations are exactly Swimming, Climbing, Jumping from the source list items;
- first choice requires a qualifying Short/Long Rest newer than feature acquisition;
- one qualifying rest authorizes one selection;
- the selection is active only until the next Short/Long Rest;
- a newer rest makes the old stored state inactive/expired and authorizes the next selection;
- invalid/encounter-blocked attempts do not consume the rest opportunity;
- runtime key `barbarian-beast-bestial-soul`;
- projection `runtimeFeatures.bestialSoul`;
- no movement/species/world travel/tactical movement fields are mutated.

Migration 79 created public runtime authority. Deployed QA then discovered the imported source stores adaptations as plain `list.items`, not named child entries. Migration 80 additively corrects `private.bestial_soul_options_v1()` without rewriting migration 79.

Final deployed rollback proof used dynamically resolved PHB/XPHB Barbarian class IDs and proved Swimming → expiry → Climbing → Jumping, source/edition gating, same-rest guards, encounter lock, ACLs, projection, and unchanged base movement.

Final production integrity after rollback:

- 7 characters;
- 7 sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 Bestial runtime rows;
- 0 Bestial QA characters;
- 20 locations;
- 4 routes;
- 9 route points.

The migration-80 source head `d40371c2f2bf66d8dcf40141ada9cd62f8686517` passed all 27 PR workflows and Vercel before deployment.

## Runtime modeling rule

Do not treat every source feature as a creator choice.

- permanent acquisition → Forge/progression;
- rest-configurable → runtime;
- next-rest-expiring → getter/state anchored to rest chronology;
- per-use/per-cast → action resolver;
- informational/always-on → display/consumer logic.

Do not hard-code a feature into the parser if its source text is already correctly classified by `restReconfigurableText`.

## Immediate next slice

Audit **Wild Heart — Aspect of the Wilds** next.

Before writing:

1. inspect exact `class_feature_catalog` source record(s), class/subclass source, level, option structure, and cadence text;
2. inspect current Forge parser/presentation/runtime state;
3. determine initial-selection and next-rest expiry/replacement semantics from source, not analogy;
4. state a bounded patch plan before writes;
5. compile candidate DDL against live schema in rollback;
6. run a synthetic lifecycle before pushing;
7. patch migration/client/validator/workflow together;
8. verify helpers/hooks/state/props/RPC arguments;
9. require exact-head CI/build/Vercel;
10. deploy only after green gates;
11. rerun against deployed functions;
12. prove ACLs and zero residue;
13. update docs/PR only after acceptance.

Known remaining source-family queue after that: Hunter's Prey, Defensive Tactics, Phantom Whispers of the Dead.

## Broader PR #170 closure work

Still open after the runtime-family sweep:

- obsolete/authenticated progression RPC and ACL cleanup where live grants still prove a gap;
- final authenticated browser acceptance;
- action-layer-only integrations explicitly deferred from runtime storage;
- final ledger reconciliation;
- merge only after exact-head closure gates pass.

## Delivery discipline

Never call a runtime family accepted merely because DDL applied. Acceptance requires source verification, exact-head gates, deployed behavior proof, ACL checks, and zero-residue integrity.

---

End handoff prompt.
