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

Live Supabase now includes Character Forge/progression/runtime work **through migration 77**.

Most recent normalized runtime sequence:

- 68 — Eladrin seasonal Trance runtime;
- 69-70 — Boon of Energy Resistance;
- 71 — feat runtime Expertise / Echoing Soul / Zhentarim lifecycle;
- 72-73 — Cartomancer runtime + deterministic state correction;
- 74 — Wizard Memorize Spell runtime;
- 75 — Wizard Memorize Spell deterministic getter-state correction;
- 76 — shared Wizard runtime helper repair;
- 77 — TCE Cantrip Formulas Long-Rest runtime for PHB Wizard.

Latest live migration: `wizard_cantrip_formulas_runtime` (`20260809213738`).

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
- runtime receipt is `wizard-memorize-spell`;
- sheet projection is `runtimeFeatures.wizardMemorizeSpell`.

Migration 76 supplies the shared helper contracts required by Memorize Spell and Spell Mastery:

- `private.can_manage_character_spell_resources_v1(uuid)`;
- `private.character_class_feature_acquired_at_v1(uuid,text,text,integer)`.

The acquisition fallback is `character_progression.created_at`; do **not** change it to `characters.created_at`, which does not exist live.

## Cantrip Formulas is CLOSED / ACCEPTED

Read `docs/Wizard_Cantrip_Formulas_Runtime_Status.md` before touching this area.

Source authority:

- feature source `TCE`;
- class `Wizard`;
- class source `PHB`;
- level 3;
- imported `isClassFeatureVariant=true`;
- Long-Rest replacement cadence.

Accepted behavior:

- PHB Wizard 3+ only;
- XPHB Wizard is ineligible;
- first replacement requires a Long Rest strictly newer than feature acquisition;
- one successful replacement per qualifying Long Rest;
- outgoing choice must be an actual known class-owned Wizard cantrip;
- replacement must be a preferred level-0 Wizard-list spell not already known by the character from any source;
- the selected `character_spells` row is updated **in place**;
- assignment ID, `source_type='class'`, `source_key='wizard'`, casting stat, and row count remain unchanged;
- no `character_spells` insert/delete occurs;
- active encounters block configuration;
- runtime receipt is `wizard-cantrip-formulas`;
- sheet projection is `runtimeFeatures.wizardCantripFormulas`;
- UI panel is mounted after Memorize Spell in the always-reachable runtime chain.

Accepted source commit:

`1e9a9b59306a1e38c8a04bb484aa602f01a817d3` — `Model PHB Wizard Cantrip Formulas runtime`.

At that head:

- all 25 relevant GitHub Actions workflows passed;
- the dedicated Cantrip Formulas semantic validator passed;
- its production build gate passed;
- Vercel passed.

After migration 77 was applied, a rolled-back synthetic PHB Wizard 3 + XPHB Wizard 3 control proved:

- PHB eligible / XPHB ineligible;
- pre-rest rejection;
- actual public Long Rest unlock;
- Acid Splash → Fire Bolt replacement;
- exact assignment ID/source/casting-stat preservation;
- stable cantrip row count;
- same-rest rejection;
- already-known replacement rejection;
- active-encounter rejection;
- newer-rest Fire Bolt → Booming Blade replacement;
- second same-rest rejection;
- runtime receipt and sheet projection;
- public/private ACL expectations.

Post-rollback integrity remained:

- 7 characters;
- 7 sheets;
- 30 character spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Cantrip Formulas runtime rows;
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
- Cantrip Formulas → one class-owned cantrip assignment replacement per qualifying Long Rest;
- Spell Mastery → persistent at-will overlay with Long-Rest replacement;
- Steps of the Fey → per-cast and still deferred to action-layer integration.

## Immediate next slice

Continue the remaining class/subclass family audit one bounded feature at a time.

Known queue candidates include:

- Armorer Armor Model;
- Beast Bestial Soul;
- Wild Heart Aspect of the Wilds;
- Hunter's Prey / Defensive Tactics;
- Phantom Whispers of the Dead.

Do **not** assume those are all rest-runtime choices. For the next family:

1. inspect the imported source record(s), source/class/subclass edition, level, choice text, and cadence;
2. inspect current Forge/progression/runtime presentation and any existing stored state;
3. classify it as permanent creation/progression, rest runtime, per-use action state, or informational display;
4. state a safe bounded patch plan before writing;
5. compile candidate DDL against live schema in rollback;
6. run a synthetic rollback lifecycle against candidate authority;
7. patch migration/client/validator/workflow together;
8. verify every helper/state/prop/RPC argument;
9. require exact-head CI + production build + Vercel;
10. apply only after gates pass;
11. rerun the lifecycle against deployed functions;
12. prove zero residue and ACLs;
13. update docs and PR body before moving on.

## Remaining broader PR #170 closure work

Still open after the runtime-family sweep:

- obsolete/authenticated progression RPC and ACL cleanup where live grants still prove a gap;
- authenticated browser acceptance for final Forge/progression flows;
- action-layer-only integrations explicitly deferred from runtime storage;
- final PR ledger/document reconciliation;
- merge only after exact-head closure gates pass.

## Delivery discipline

Never claim a migration/runtime family is accepted merely because DDL applied. Acceptance requires source verification, exact-head gates, deployed behavior proof, ACL checks, and zero-residue integrity.

---

End handoff prompt.
