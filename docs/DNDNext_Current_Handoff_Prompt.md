# DNDNext Current Handoff Prompt

Updated: 2026-08-10

Repository: `bob8675309/DNDNEXT`

Active PR: **#170 — Refine Character Forge resilience, source choices, spells, and player authority**

Active branch: `agent/character-forge-resilience-presentation`

Stack: Next.js Pages Router + Supabase/Postgres.

## Mandatory startup

Before changing anything:

1. inspect current PR head and exact-head GitHub/Vercel status;
2. inspect live Supabase migrations/schema/data/grants for the requested slice;
3. read `docs/README.md`, `docs/Documentation_Refresh_Manifest.md`, `docs/PR170_Final_Acceptance_Status.md`, `docs/PR170_Browser_Smoke_Corrections_Status.md`, and the relevant dedicated ledger;
4. reconcile source, live DB, and docs before writing;
5. state a bounded safe patch plan before implementation;
6. verify every helper, hook, state variable, prop, and RPC argument is defined and passed;
7. use rollback fixtures for risky database behavior and prove zero residue.

GitHub/Supabase outrank prior-chat prose.

## Protected boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map unless explicitly requested.
- `components/MapPageClient.js` is outside current Forge/progression/runtime scope.
- Do not alter route/travel/weather, unrelated crafting/inventory execution, or tactical action execution.
- Prefer additive migrations over rewriting deployed history.
- Do not merge PR #170 without explicit user approval.

## Current live checkpoint

Supabase is accepted through **migration 90**.

Latest migrations:

- 83 `defensive_tactics_runtime` — `20260809235754`;
- 84 `whispers_of_the_dead_runtime` — `20260810001351`;
- 85 `progression_rpc_acl_cleanup` — `20260810002421`;
- 86 `player_forge_source_magic_materialization` — `20260810075628`;
- 87 `source_magic_level_parser_fix` — `20260810075645`;
- 88 `source_magic_feat_name_normalization_fix` — `20260810075724`;
- 89 `pending_rest_runtime_choices` — `20260810181530`;
- 90 `rest_class_feature_restoration` — `20260810205646`.

During migration-89 startup, production was found ahead of source control for migrations 83-85. Their exact behavioral source plus Defensive Tactics/Whispers reachable panels were restored to the PR branch. Do **not** re-apply 83-85 to production.

## Real browser smoke checkpoint

The user performed a real signed-in browser smoke after migration 89. It exposed concrete defects and therefore replaced the previous “browser not yet tested” state with a **tested-but-corrections-required** state.

The correction pass is documented in `PR170_Browser_Smoke_Corrections_Status.md`.

The corrected build still needs the user to re-smoke the affected cases before PR #170 can claim final browser acceptance.

## Migration 90 — Rage/rest restoration

Read `PR170_Browser_Smoke_Corrections_Status.md`.

The standalone sheet Rest RPC previously restored spell slots/limited spell uses but did not restore sheet-side class action state. Migration 90 adds a narrow source-aware helper for the class action currently persisted by the sheet: Barbarian Rage.

Accepted behavior:

- XPHB Rage: +1 spent use on Short Rest, all spent uses on Long Rest;
- PHB Rage: no Short-Rest restoration, all spent uses on Long Rest;
- rest clears the sheet-side active Rage flag;
- `complete_character_rest_v1` returns the updated `sheet` plus `restResult.restoredClassFeatureUses`;
- the existing active-encounter rest guard remains transactional authority;
- no tactical/encounter state is changed.

Deployed rollback tests proved XPHB Short/Long and PHB Short/Long behavior plus an authenticated owner-facing Long Rest from 2/3 -> returned 3/3. All QA rolled back.

Important live state: Varges remains **2/3 Rage** because QA deliberately did not repair a valued character. His next normal qualifying rest should exercise the deployed behavior. There are **2 legitimate user rest-log rows** from browser smoke; do not treat them as QA residue.

Migration-90 ACL:

- public Rest RPC: anon false; authenticated/service true;
- private Rage restoration helper: anon/authenticated false; service true.

## Current Forge architecture

The shared NPC/player Character Forge is the creation surface. The player-facing resolution model is:

- **Species** — identity, lore, feature explanation; fixed source languages remain source authority;
- **Background** — background identity and fixed source grants;
- **Class** — class/subclass explanation and progression preview;
- **Abilities** — score generation/allocation plus Species Bonus package selection only;
- **Training → Skills & Proficiencies** — skills, tools, Expertise/training decisions;
- **Training → Feats & Class Abilities** — higher-level feats, Invocations, Artificer plans, Species-Bonus-feat owned non-spell choices, and other persistent feature catalogues;
- **Spells** — class spells plus spell-centric Species/Feat/Background/Class-feature choices, including noncasters with source-owned magic;
- **Review** — manual choices plus automatic source-policy resolutions.

### Browser-smoke presentation corrections

- Deep Gnome Gift of the Svirfneblin no longer leaves a standalone INT/WIS/CHA prompt before an actual level-gated spell grant.
- SCC/Witherbloom display removes trailing non-mechanical spell-customization flavor without rewriting imported source data.
- Background expanded spell names load descriptions/casting/range/duration from `spells_catalog` for hover/focus help.
- Player Forge secondary copy has higher contrast.
- Nested long Class lists stop propagation so native disclosures open and close independently.
- The desktop Class feature dock stays sticky through tall guide content; responsive layout returns it to static flow.
- Species Bonus feat selection is acknowledged on Abilities; owned follow-up choices resolve later in the appropriate Training/Spells category.
- Same-name subclass reprints collapse to one option: complete definitions beat placeholders; among complete definitions, newest known publication wins.
- Artificer plan selectors now disclose current catalogue availability and later unlocks while keeping future plans non-selectable. Wildcard items use canonical item detail.

## Source magic — migrations 86-88

Server authority materializes validated routed Species/Feat magic into `character_spells` with provenance.

Rollback acceptance covers:

- Astral Elf Astral Fire;
- Deep Gnome Gift of the Svirfneblin at levels 3 and 5;
- Witherbloom Student / fixed Strixhaven college;
- Magic Initiate;
- deterministic best eligible casting ability;
- Long-Rest free-use metadata where source rules require it.

## Runtime-family sweep

The bounded class/subclass runtime queue is closed through Whispers of the Dead.

Key contrasts:

- **Astral Trance** — Long-Rest-cycle proficiencies expire at next Long Rest; a new current-cycle choice is needed.
- **Bestial Soul** — current adaptation expires at next Short/Long Rest.
- **Aspect of the Wilds** — current aspect persists; Long Rest only unlocks optional replacement.
- **Hunter's Prey** — PHB permanent Forge choice; XPHB persistent runtime choice with Short/Long-Rest replacement.
- **Defensive Tactics** — PHB permanent Forge choice; XPHB persistent runtime choice with Short/Long-Rest replacement.
- **Whispers of the Dead** — first selection requires a qualifying rest; borrowed proficiency persists until later replacement.
- **Fiendish Resilience** — first resistance needs a qualifying rest; once selected it persists and later rests only unlock replacement.

Read the dedicated runtime ledgers before reopening an accepted family.

## Pending post-rest choice presentation — migration 89

Read `Pending_Rest_Runtime_Choices_Status.md`.

`public.get_character_pending_rest_choices_v1(uuid)` is a read-only authenticated aggregate over feature-specific runtime getters. `CharacterRestChoiceNotice` classifies:

1. `needsSelection` — attention/pulse because no current benefit is active or the first rest-backed choice is waiting;
2. `optionalChanges` — current persistent benefit remains active; quiet/collapsed;
3. `availableActions` — optional post-rest actions; quiet/collapsed.

Rollback acceptance directly proved Astral Trance as attention-required and Wild Heart as quiet optional replacement.

## Exact-head and production evidence

Immediately before migration 90 deployment, exact code head `98b55355ed92d3d3309c09b8c534095d13859089` passed **32/32 PR-triggered GitHub workflows** and Vercel.

After deployed migration-90 rollback QA, production remains:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 2 legitimate user rest-log rows;
- Varges Rage 2/3, unchanged by QA;
- 20 locations;
- 4 map routes;
- 9 map route points.

Documentation commits after that code checkpoint move the branch head and must be exact-head gated again.

## Immediate next step

Do **not** start another broad rules-family implementation by default. The immediate task is user re-smoke of the corrected cases.

### Focused re-smoke targets

1. XPHB Barbarian spent Rage + Short/Long Rest restoration; normal Long Rest from Varges's current 2/3 should return 3/3.
2. Deep Gnome level 1 has no meaningless casting-ability prompt; levels 3/5 still resolve source magic.
3. Witherbloom trailing flavor is gone, secondary text is readable, expanded spell names expose descriptions on hover/focus.
4. Long Class option lists can expand and collapse normally.
5. Class feature detail dock follows the tall guide on desktop and returns to normal placement at the top.
6. Species Bonus feat is acknowledged on Abilities; feat-owned decisions resolve later.
7. Duplicate same-name subclasses are absent while a complete definition remains available.
8. Artificer Magic Item Plans show current availability, later unlocks, and canonical wildcard item detail without allowing future plans early.

After the user reports those results, fix any remaining concrete browser defect or, if all pass, perform the final live/head/residue check and await explicit merge approval.

## Delivery discipline

Never call a slice accepted merely because DDL applied. Acceptance requires source verification, exact-head gates, deployed behavior proof, ACL checks, and zero-residue integrity. Do not weaken working mechanics to satisfy stale validators; update a validator only when source/live authority proves its contract is obsolete.
