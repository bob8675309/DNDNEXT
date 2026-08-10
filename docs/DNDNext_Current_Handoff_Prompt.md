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
3. read `docs/README.md`, `docs/Documentation_Refresh_Manifest.md`, `docs/PR170_Final_Acceptance_Status.md`, and the relevant dedicated ledger;
4. reconcile source, live DB, and docs before writing;
5. state a bounded safe patch plan before implementation;
6. verify every helper, hook, state variable, prop, and RPC argument is defined and passed;
7. use rollback fixtures for risky database behavior and prove zero residue.

GitHub/Supabase outrank prior-chat prose.

## Protected boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map unless explicitly requested.
- `components/MapPageClient.js` is outside current Forge/progression/runtime scope.
- Do not alter route/travel/weather, unrelated crafting/inventory, or tactical action execution.
- Prefer additive migrations over rewriting deployed history.
- Do not merge PR #170 without explicit user approval.

## Current live checkpoint

Supabase is accepted through **migration 89**.

Latest migrations:

- 83 `defensive_tactics_runtime` — `20260809235754`;
- 84 `whispers_of_the_dead_runtime` — `20260810001351`;
- 85 `progression_rpc_acl_cleanup` — `20260810002421`;
- 86 `player_forge_source_magic_materialization` — `20260810075628`;
- 87 `source_magic_level_parser_fix` — `20260810075645`;
- 88 `source_magic_feat_name_normalization_fix` — `20260810075724`;
- 89 `pending_rest_runtime_choices` — `20260810181530`.

During migration-89 startup, production was found ahead of source control for migrations 83-85. Their exact behavioral source plus Defensive Tactics/Whispers reachable panels were restored to the PR branch. Do **not** re-apply 83-85 to production.

## Current Forge architecture

The shared NPC/player Character Forge is the creation surface. The player-facing resolution model is:

- **Species** — identity, lore, feature explanation; fixed source languages remain source authority;
- **Background** — background identity and fixed source grants;
- **Class** — class/subclass explanation and progression preview, not a dumping ground for persistent selectors;
- **Abilities** — score generation/allocation;
- **Training → Skills & Proficiencies** — skills, tools, Expertise/training decisions;
- **Training → Feats & Class Abilities** — higher-level feats, Invocations, Artificer plans, and other persistent feature catalogues;
- **Spells** — class spells plus spell-centric Species/Feat/Background/Class-feature choices, including noncasters with source-owned magic;
- **Review** — manual choices plus automatic source-policy resolutions.

Read `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.

### Source magic — migrations 86-88

Server authority now materializes validated routed Species/Feat magic into `character_spells` with provenance.

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

Rollback acceptance directly proved:

- Astral Trance after Long Rest → `hasAttention=true`, one temporary `needsSelection`;
- Wild Heart Owl after newer Long Rest → Owl remains active, `hasAttention=false`, one optional persistent replacement.

The notice respects reduced-motion and refreshes through focus/visibility/runtime-choice events plus a short polling fallback.

## Progression ACL checkpoint

Migration 85 retained `get_character_level_class_choice_options_v2` because current client compatibility code still references v1/v2/v3. It revoked anonymous execute from v2 while retaining authenticated/service-role compatibility. Authenticated rollback acceptance invoked the live v2 signature successfully.

Do not use this bounded cleanup as justification to alter unrelated SECURITY DEFINER surfaces. Current Supabase advisor findings elsewhere remain separate audit backlog.

## Exact-head and production evidence

Before migration 89 deployment, exact head `a05c4b03f9a36cbf9021108aa07856cfab474fd1` passed **31/31 PR-triggered workflows** and Vercel.

After migration 89 rollback QA, production remains:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 runtime rows;
- 0 rest-log rows;
- 0 migration-89 QA residue;
- 20 locations;
- 4 map routes;
- 9 map route points.

Documentation-only commits after this checkpoint must be exact-head gated again.

## Immediate next step

Do **not** start another rules-family implementation by default. PR #170 is at closure state.

Next actions:

1. reconcile final docs/PR body;
2. require exact-head CI/Vercel after that docs commit;
3. perform a real signed-in browser smoke if the user wants that final external presentation proof;
4. immediately before an explicitly approved merge, re-check PR head/status, live migration list, ACLs, and zero residue;
5. merge only with explicit user approval.

### Browser smoke targets

- Aven fixed languages;
- Deep Gnome levels 3/5 source magic;
- Astral Fire routing to Spells;
- Witherbloom-only Strixhaven choices;
- Warlock Invocation selection in Training;
- higher-level feat catalogue in Training;
- noncaster source-owned Spells;
- responsive Continue/Back and scrolling;
- Review / Known Spellbook persistence;
- Astral-Trance-style post-rest attention;
- Wild-Heart-style persistent optional replacement staying quiet;
- resolving a runtime choice clears/reclassifies the notice.

The connected toolset cannot claim this real interactive signed-in browser smoke on its own.

## Delivery discipline

Never call a slice accepted merely because DDL applied. Acceptance requires source verification, exact-head gates, deployed behavior proof, ACL checks, and zero-residue integrity. Do not weaken working mechanics to satisfy stale validators; update a validator only when source/live authority proves its contract is obsolete.
