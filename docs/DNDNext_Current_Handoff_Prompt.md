# DNDNext Current Handoff Prompt

Updated: 2026-08-09

Use this prompt when a new ChatGPT/Codex thread takes over PR #170.

---

You are taking over the DNDNext repository as a senior developer and technical advisor.

Repository: `bob8675309/DNDNEXT`

Active PR: **#170 — Refine Character Forge resilience, source choices, spells, and player authority**

Active branch: `agent/character-forge-resilience-presentation`

Stack: Next.js Pages Router + Supabase/Postgres.

## Mandatory first actions

Before changing anything:

1. inspect current `main`, PR #170 head, changed files, and exact-head CI/Vercel status;
2. inspect live Supabase migrations/schema/data relevant to the requested slice;
3. read `docs/README.md` and `docs/Documentation_Refresh_Manifest.md`;
4. read the dedicated status ledger for the feature being continued;
5. reconcile source, live DB, and docs before proposing a patch;
6. verify every new helper, hook, state variable, prop, and RPC argument is actually defined and passed.

Do not assume the previous chat's last prose is newer than GitHub/Supabase. GitHub/Supabase are the source of truth.

## Protected boundaries

These rules are mandatory:

- Do **not** mix world-map behavior with town/city-map behavior.
- Do **not** touch the world map unless the user explicitly asks.
- `components/MapPageClient.js` is outside the current Character Forge/progression/runtime work.
- Do not modify route/travel/weather systems as part of Forge/progression work.
- Do not change crafting/inventory or tactical action execution unless the current slice explicitly requires it.
- Preserve normalized Supabase authority; the browser previews/collects choices but guarded database functions enforce rules.
- Prefer additive compatibility migrations over editing already-deployed migration history.
- Test risky database behavior in rollback fixtures and prove zero residue afterward.

## Current production checkpoint

Live Supabase now includes Character Forge/progression/runtime work **through migration 76**.

Most recent normalized runtime sequence:

- 68 — Eladrin seasonal Trance runtime;
- 69-70 — Boon of Energy Resistance;
- 71 — feat runtime Expertise / Echoing Soul / Zhentarim lifecycle;
- 72-73 — Cartomancer runtime + deterministic state correction;
- 74 — Wizard Memorize Spell runtime;
- 75 — Wizard Memorize Spell deterministic getter-state correction;
- 76 — shared Wizard runtime helper repair.

Migration 76 is live as `wizard_runtime_helper_repair`.

## Memorize Spell is CLOSED / ACCEPTED

Read `docs/Wizard_Memorize_Spell_Runtime_Status.md` before touching this area.

Accepted behavior:

- XPHB Wizard Memorize Spell resolves at level 5 from source data;
- it is Short-Rest runtime state, not a permanent Forge choice;
- after a qualifying Short Rest, one currently prepared level-1+ Wizard spell may be exchanged for one unprepared level-1+ spell already in the actual Wizard spellbook;
- `always_available` spells cannot be selected as the spell being unprepared;
- spellbook membership/source identity never changes;
- only the existing `prepared` flags change;
- one qualifying Short Rest authorizes at most one completed swap;
- active encounters block configuration;
- runtime receipt is `character_runtime_feature_choices.feature_key='wizard-memorize-spell'`;
- sheet projection is `runtimeFeatures.wizardMemorizeSpell`;
- the UI panel is mounted downstream from `CharacterCurrencyBadge` and must remain reachable even when the character has no currency balance.

### Why migration 76 exists

The deployed 74-75 audit found two referenced private helpers were absent live:

- `private.can_manage_character_spell_resources_v1(uuid)`;
- `private.character_class_feature_acquired_at_v1(uuid,text,text,integer)`.

Migration 76 adds them compatibly.

`can_manage_character_spell_resources_v1` delegates to the existing canonical edit rule `can_manage_character_progression_v1` and also repairs the same missing dependency used by Wizard Spell Mastery.

`character_class_feature_acquired_at_v1` uses:

1. the first `character_level_events` crossing for earned progression;
2. `character_progression.created_at` for direct higher-level creation.

Do **not** change that fallback to `characters.created_at`; the live `characters` table has no such column.

## Acceptance evidence through migration 76

At the source head used for deployment acceptance:

- all 24 relevant GitHub Actions workflows passed;
- dedicated Memorize semantic validation passed;
- dedicated Memorize production build gate passed;
- Wizard Spell Mastery semantic/build gate passed with the repaired shared helper;
- Vercel passed.

After migration 76 was applied, a rolled-back synthetic level-5 Wizard lifecycle proved:

- direct-created acquisition anchor;
- public Short Rest unlock;
- first swap success;
- same-rest second-swap rejection;
- always-prepared rejection;
- active-encounter rejection;
- newer-rest one-swap reauthorization;
- second same-rest rejection;
- spellbook membership/source identity preservation;
- sheet projection sync;
- public/private ACLs.

A separate rolled-back level-18 Wizard fixture proved `configure_character_spell_mastery_v1` now executes through the repaired shared authorization helper and still preserves spellbook row count.

Post-rollback integrity remained:

- 7 characters;
- 7 sheets;
- 30 character spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Memorize runtime rows;
- 20 locations;
- 4 routes;
- 9 route points.

## Runtime/creation modeling rule

Do not treat every source feature as a one-time creator choice.

Classify each source choice by cadence:

- permanent acquisition choice → Forge/progression authority;
- permanent proficiency choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Short-/Long-Rest configurable choice → runtime authority;
- per-use/per-cast choice → action/spell resolver;
- informational feature → display only.

Examples already normalized:

- Astral Trance / Astral Knowledge → rest runtime;
- Weapon Master feat mastery → Long-Rest runtime;
- Fiendish Resilience → Short/Long-Rest runtime;
- Circle Spells land selection → Long-Rest package runtime;
- Eladrin season → Trance runtime;
- Boon of Energy Resistance → Long-Rest replacement runtime;
- Cartomancer Hidden Ace → temporary eight-hour runtime spell access;
- Memorize Spell → one preparation replacement per qualifying Short Rest;
- Spell Mastery → persistent at-will overlay with Long-Rest replacement;
- Steps of the Fey → per-cast and still deferred to action-layer integration.

## Immediate next slice

The next bounded item is **Cantrip Formulas**.

Before implementing it:

1. inspect the imported source record(s), current Forge/progression presentation, current runtime tables/helpers, and any existing validator/docs;
2. determine the exact source cadence and whether it belongs to creation, progression, rest runtime, or action-layer execution;
3. propose a safe patch plan before changing code or DB;
4. keep the patch narrowly scoped;
5. compile candidate DDL against live schema inside rollback;
6. run semantic/build gates and exact-head CI;
7. apply only after gates pass;
8. run public/helper rollback behavior proofs;
9. run zero-residue integrity/ACL checks;
10. update docs/PR ledger before moving to the next family.

After Cantrip Formulas, continue remaining class/subclass runtime families one bounded slice at a time.

## Remaining broader PR #170 closure work

Still open after the runtime-family sweep:

- obsolete/authenticated progression RPC and ACL cleanup where live grants still prove a gap;
- authenticated browser acceptance for final Forge/progression flows;
- action-layer-only integrations explicitly deferred from runtime storage;
- final PR ledger/document reconciliation;
- merge only after exact-head closure gates pass.

## Delivery discipline

For each slice:

1. inspect source + live DB;
2. state the bounded patch plan before writes;
3. patch source/migration/client together;
4. verify helpers/hooks/state/props/RPC args;
5. run semantic validators and production build gate;
6. compile live schema in rollback;
7. require exact-head CI/Vercel where relevant;
8. apply migration;
9. run rollback lifecycle proof;
10. prove zero residue and ACLs;
11. update docs and PR body;
12. only then advance to the next slice.

Never claim a migration/runtime family is accepted merely because DDL applied. Acceptance requires the deployed behavior proof and zero-residue check.

---

End handoff prompt.
