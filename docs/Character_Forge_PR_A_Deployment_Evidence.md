# Character Forge PR A — Deployment Evidence

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Acceptance state

PR #170 remains **open and unmerged**. CI/build success plus rollback-only production proofs are regression/authority evidence, not final authenticated browser acceptance.

The active design rule is creation/progression parity for persistent source-owned decisions, with rest/per-use/informational choices modeled separately as runtime state.

## Live migration checkpoint through 54

- 38-39 — Battle Master maneuver normalization/progression;
- 40-41 — Wizard Savant progression + higher-level Forge chronology;
- 42 — Wizard Signature Spells authority;
- 43 — Signature free-cast resource labels;
- 44 — Wizard Spell Mastery runtime;
- 45 — class Weapon Mastery runtime;
- 46 — Weapon Master feat runtime and combined projection;
- 47 — Player Forge v3 multi-source starting-magic completion;
- 48 — Player Forge v3 authenticated-only ACL cleanup;
- 49 — source-backed Player Forge starting equipment + character currency;
- 50 — starting-equipment Background/d10 tamper guard + currency RLS;
- 51 — character-scoped starter-equipment projection correction;
- 52 — Astral Trance Long-Rest runtime authority;
- 53 — Astral Trance multiword skill-key correction;
- 54 — Astral Elf normalized eligibility correction.

## Player Forge starting magic

The shared Player Forge calls `create_player_character_v3`. Exact Spell-step authority covers native class-list, Background-expanded, Eldritch Knight, and Arcane Trickster starting magic.

Rollback proofs established native Wizard, Background-expanded Entangle, Eldritch Knight, Arcane Trickster fixed Mage Hand, and fail-closed invalid submissions with no residue.

## Starting equipment / character currency

Player mode includes an Equipment step between Spells and Identity. NPC step order is unchanged.

Structured source packages cover the 12 XPHB core classes plus EFA Artificer and the existing XPHB Background equipment metadata.

Concrete starter items become canonical character-owned inventory rows and begin unequipped. Character money is stored as copper in `character_currency`, not `player_wallets`.

Rollback proofs cover concrete gear, cash-only packages, generic tool/instrument selectors, Wizard Spellbook resolution, higher-level d10 cash, DM-only magic-item allowance, and fail-closed tampering.

See `Player_Forge_Starting_Equipment_Status.md`.

## Astral Trance runtime — migrations 52-54

AAG Astral Elf Astral Trance is implemented as runtime cadence state and is excluded from Character Forge persistent choices.

After a completed Long Rest, the character chooses one skill and one source-legal PHB-equivalent weapon/tool proficiency. The current pair is stored in `character_runtime_feature_choices` and projected under `sheet.runtimeProficiencies.astralTrance`.

The pair expires automatically when the **next Long Rest finishes**. Short Rest leaves it active. Same-rest second configuration is rejected.

Permanent skill/tool/weapon proficiency fields are not rewritten. Normal sheet view receives a cloned skill overlay; edit mode uses the permanent draft. Weapon actions check the exact runtime weapon before normal class/explicit fallback rules.

Preferred XPHB catalogue rows represent the PHB equipment list. Musket and Pistol remain excluded by campaign policy.

### Correction evidence

Migration 52 originally exposed only 16 skills because the shared name normalizer strips spaces. Migration 53 corrects Animal Handling and Sleight of Hand, restoring all 18 skills.

The first behavior fixture then exposed that `Astral Elf` normalizes to `astralelf`. Migration 54 corrects eligibility.

Both defects failed closed and were corrected before the slice was accepted.

### CI / compile gate

The dedicated Astral workflow validates source identity, cadence/expiry, full skill mappings, compact species eligibility, firearm exclusion, sheet UI, non-destructive skill/weapon overlays, explicit Forge exclusion, and protected world boundaries.

Before the final correction deployment, the exact candidate head was green across all eleven relevant workflows, including Astral Trance, starting magic/equipment, Spell Mastery, NPC Forge, progression, portrait, and nested-choice validators.

Migration 52 compiled against live production schema in rollback. Migrations 53 and 54 were each compiled/tested in rollback before application.

### Final deployed rollback proof

Using real public `complete_character_rest_v1`, `get_character_astral_trance_v1`, and `configure_character_astral_trance_v1`, the deployed migrations proved:

- no configure before first Long Rest;
- configure Arcana + Longsword after Long Rest;
- no permanent Arcana/tool/weapon mutation;
- same-rest second configure rejected;
- Short Rest preserves the active pair;
- next Long Rest automatically removes the pair and reopens configuration;
- direct Pistol id rejected;
- second-rest Animal Handling + a legal tool succeeds;
- Human/XPHB reports unavailable and configure is rejected;
- zero synthetic/runtime residue after rollback.

The final live catalogue exposes 18 skills and 74 legal training options with firearms absent.

## Final production integrity checkpoint

After migrations 52-54 and rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 0 QA Astral runtime rows;
- 0 synthetic Astral proof characters;
- 20 locations;
- 4 map routes;
- 9 map route points.

Astral public getter/configure ACLs are authenticated + service_role. Private Astral helpers/trigger functions are service-role-only.

## Remaining acceptance blockers

1. Remaining runtime cadence families: Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey.
2. Compact post-create character-currency display.
3. Artificer wildcard Magic Item Plan concrete-item instances.
4. Remaining persistent source-choice / conditional-choice UI audit.
5. Audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused.
6. Final authenticated browser acceptance.
7. Merge PR #170 only after those gates close.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.
