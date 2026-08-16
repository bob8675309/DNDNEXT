# Documentation Refresh Manifest

Updated: 2026-08-14

## Trust order

For current work, trust sources in this order:

1. live Supabase schema, migrations, grants, and relevant data;
2. current GitHub PR source, remote head, exact-head CI, and deployment state;
3. `DNDNext_Current_Handoff_Prompt.md` and the active dedicated subsystem ledger;
4. broader roadmap/history prose;
5. raw SQL/text exports as historical snapshots only.

If prose conflicts with live source/database state, live authority wins until the documentation is corrected.

## Current GitHub checkpoint

### Historical base — PR #170

PR #170 is merged. Merge commit:

`599c4de7397ba6e4bbbb0a061d551d80c3570be7`

The merge happened through an accidental connector action while branch-integration tooling was being searched for. Do not describe PR #170 as open, do not blindly revert it, and do not use a merge operation merely to move branch content.

Older ledgers may retain “PR #170 open” or “before merge” language because they are contemporaneous evidence. Treat those statements as historical, not current instructions.

### Active continuation — PR #171

Branch: `agent/species-art-post170`

PR #171 is **open and unmerged**. Merge only after Paul explicitly approves it.

Latest validated code head:

`39a263e034db4023ed7d1a4950a185a832c08867` — `Polish Eladrin season selection`

Exact-head evidence:

- all 14 triggered GitHub workflows succeeded;
- Vercel succeeded;
- focused Species facts, family expansion, artwork, source presentation, nested choices, unified Forge, and Eladrin runtime validators passed;
- syntax, symbol/prop, diff, and protected-boundary checks passed.

The earlier full PR #170 source/runtime checkpoint remains useful historical evidence, but current changes and merge control belong to PR #171.

## Live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Status: `ACTIVE_HEALTHY`, PostgreSQL 17.4.1.

Database authority remains migration 93:

`20260812042950 aven_subrace_catalog`

Recent catalogue/source migrations:

- 91 — `20260811062025 genasi_subrace_catalog`;
- 92 — `20260812033649 genasi_source_detail_restore`;
- 93 — `20260812042950 aven_subrace_catalog`.

Current verified Species counts:

- raw Species catalogue: 166;
- preferred Species view: 102;
- Eladrin runtime-choice rows: 0.

The PR #171 artwork, layout, facts, semantic icons, search reveal, guided validation, and Eladrin presentation passes made no Supabase write or migration.

## Controlling current documents

Read before modifying these areas:

- `DNDNext_Current_Handoff_Prompt.md` — copy-ready next-chat brief and site architecture;
- `Forge_Post170_Species_Artwork_Status.md` — active PR #171 Species continuation;
- `Forge_Species_Family_Submenu_Status.md` — Species identity/family/persistence rules;
- `Forge_Source_Presentation_and_Species_Variants_Status.md` — structured source-rendering foundation/history;
- `Unified_Character_Forge_Status.md` — shared creation/progression/runtime architecture;
- `Eladrin_Runtime_Status.md` — Eladrin creation/runtime lifecycle;
- `PR170_Final_Acceptance_Status.md` — historical PR #170 acceptance evidence;
- `PR170_Browser_Smoke_Corrections_Status.md` — historical signed-in findings/corrections;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — placement and source-magic authority;
- `Pending_Rest_Runtime_Choices_Status.md` and matching `*_Runtime_Status.md` ledgers — runtime cadence;
- `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` — item/equipment/crafting boundaries;
- `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus the latest tactical phase ledger — tactical authority;
- `CHATGPT_REPO_WRITE_PROCEDURE.md` — coherent GitHub/Supabase write procedure.

## Core modeling rule

- permanent source-owned acquisition → Forge/progression authority;
- proficiency-dependent permanent choice → Training;
- spell-centric permanent choice → Spells;
- rest-configurable persistent choice → runtime authority whose current selection remains active until changed;
- next-rest-expiring choice → rest-cycle runtime state;
- first choice unlocked only by a rest → attention only while no benefit is active;
- per-use/per-cast choice → action/spell resolver;
- informational/always-on feature → presentation/consumer logic.

Do not use visual similarity as permission to merge different lifecycles or persistence identities.

## Current Species presentation model

The Species browser has three presentation classes:

1. **parent-persisted family choices** — Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy, and Kithkin;
2. **real setting/source Species rows nested visually** — Human setting variants, Dwarf (Kaladesh), Elf (Kaladesh), Orc (Ixalan), Minotaur (Amonkhet), and Goblin (Dankwood); Elf (Zendikar) remains canonical data but is Forge-presentation-excluded;
3. **inline trait choices** — Goliath Giant Ancestry, Tiefling Fiendish Legacy, and other non-child lifecycle decisions.

Setting children keep their real catalogue ID/source/rules/save identity. Distinct Species such as Sea Elf, Astral Elf, Eladrin, Shadar-kai, Duergar, and Deep Gnome remain independent.

Species skill choices route to Training. Species magic routes to Spells. Runtime-only rest choices remain outside permanent Forge authority.

The current UI also promotes concise portrait facts, semantic icons, canonical Size/Languages choices, Gender & Alignment, guided incomplete-choice focus, search-driven parent reveal, full-height desktop catalog behavior, and the single descriptive-button `Eladrin Seasons` card.

Paul considers the Species tab nearly perfect. Preserve it as the current baseline unless a specific regression is reproduced.

## Protected boundaries

Current Forge work does not authorize world-map, town/city-map, route/travel/weather, tactical action execution, crafting/inventory execution, merchants, or unrelated runtime changes. `components/MapPageClient.js` remains outside scope unless Paul explicitly requests world-map work.

## Remaining active work

- final user visual confirmation of the near-finished Species tab;
- move to Background, Class, or another Forge tab as a separate bounded review when Paul chooses;
- continue exact-head CI/Vercel and protected-path checks for every PR #171 commit;
- immediately before any explicitly approved merge, recheck remote head, PR state, live migration authority, relevant ACL/residue, and deployment state;
- merge only after explicit user approval.
