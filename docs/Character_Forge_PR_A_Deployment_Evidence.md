# Character Forge PR A — Deployment Evidence

## Current acceptance state

PR #170 remains **open and unmerged**. Automated checks being green is not browser acceptance.

The August 7 audit was deliberately expanded beyond screenshots and UI shape. It rechecked the live preferred Species, Background, Feat, Class, class-feature, spell, inventory, wallet, progression, and authority data against the complete player-character creation lifecycle, including higher-level starts.

## Corrections already made in this audit slice

- Rest/per-use configuration is no longer confused with permanent creation state for Weapon Mastery, Circle of the Land, Primal Companion, Fiendish Resilience, Dread Allegiance, Steps of the Fey, Armorer Armor Model, Wizard Spell Mastery, Banneret Polyglot, and Pact of the Tome Book of Shadows selections.
- Pact of the Tome remains a persistent invocation, but its Book of Shadows spells are selected when the book is conjured after a Short or Long Rest.
- Production Supabase includes `player_forge_runtime_choice_cadence`, aligning the deferred nested-choice validator with that rule.
- Legacy subclass Fighting Style choices respect the source feature rather than inheriting the entire modern Fighting Style catalogue.
- Expertise progression distinguishes preferred 2024 base-class progression from legacy progression and is routed to Training after proficiency is established.
- The Abilities workspace no longer duplicates the Species Bonus controls that already live in the contextual right panel.
- Species size source codes now have a normalized helper as groundwork for source-constrained size selection.
- Regression validation now protects the rest-time cadence corrections rather than demanding the old incorrect state model.

## Final top-to-bottom audit blockers

The remaining work is broader than six isolated controls. The Forge needs a single source-choice/grant model that can serve creation, Training, higher-level starts, and later level-up without duplicating rules.

### 1. Core Origin languages are not authoritative

The current draft starts with free-text `languagesText: "Common"`, and the Species step only checks that the text is nonempty.

For the standard 2024 origin flow, the Forge needs Common plus two source-legal Standard-language choices, with additional feature-granted languages tracked separately. Free text cannot enforce count, eligibility, duplicate prevention, or source ownership.

### 2. Species permanent choices remain incomplete

The current Species engine handles Human Skillful/Versatile and Astral Fire-style choices and correctly excludes Astral Trance-style rest configuration. It still needs general source-backed handling for persistent selections such as:

- Dragonborn Draconic Ancestry
- Elf lineage and spellcasting ability
- Gnome lineage and spellcasting ability
- Tiefling Fiendish Legacy and spellcasting ability
- Goliath Giant Ancestry
- Shifter subtype
- Simic Hybrid Animal Enhancement, including later unlocked enhancement choices
- Kobold Legacy and conditional children
- Reborn resistance/skill choices
- Custom Lineage feat/trait choices
- imported species skill, tool, language, and innate-magic ability choices

The implementation must preserve mixed cadence inside one feature: a lineage can be permanent while one spell attached to it can be replaceable after a Long Rest.

### 3. Species size is normalized but not wired

`speciesCharacterSizeOptions()` now maps imported source codes to legal character sizes. The Species UI and Continue validation still need to consume that set, auto-lock a single legal size, and require one of the allowed values when more than one size is legal.

### 4. Background tool/language choices are incomplete

Background skills and background feat selection are modeled, but source-defined gaming-set, Artisan's Tool, Musical Instrument, and language choices are not all structured, persisted, and server-validated. The live preferred Background catalogue contains explicit choice structures that cannot safely be reduced to display text.

### 5. Class starting proficiency choices are incomplete

The Training step understands class skill choices, but the preferred class catalogue also contains persistent starting tool/instrument choices, including:

- Artificer — one Artisan's Tool in addition to fixed Thieves' Tools and Tinker's Tools
- Bard — three Musical Instruments
- Monk — one Artisan's Tool or Musical Instrument

Fixed armor/weapon proficiency can continue to derive from canonical class metadata where the runtime already does so, but player-selected starting proficiencies must be serialized as character authority.

### 6. Feats need grant instances, nested choices, and effects

A selected feat is currently mostly treated as a unique string. That is insufficient for both creation and higher-level starts.

Required nested examples include:

- Magic Initiate — spell list, two cantrips, one level-1 spell from the same list, spellcasting ability
- Crafter — three Artisan's Tools
- Musician — three Musical Instruments
- Skilled — three skills/tools in any combination
- Blessed Warrior / Druidic Warrior — two class-list cantrips
- Elemental Adept — damage type
- Fey-Touched / Shadow-Touched — chosen level-1 spell
- Keen Mind / Observant — skill
- Ritual Caster — PB-scaled ritual spells
- Skill Expert — skill proficiency and Expertise

General and Epic Boon feats also carry built-in ability-score increases or other owned choices that must be applied, not merely named.

Repeatable feats make a unique-name representation fundamentally wrong. Magic Initiate, Skilled, Elemental Adept, and other repeatable feats need separate grant instances with independent child selections. The existing `character_option_grants` uniqueness on `(character_id, option_id)` cannot represent multiple instances by itself, so it must be extended or complemented by an instance table.

### 7. Prose-only class choices still need a source resolver

Not every permanent class choice arrives as a neat imported `options` node. Live examples include Primal Knowledge, Lore Bard Bonus Proficiencies, Student of War, Cavalier/Samurai proficiencies, Draconic Disciple language, Otherworldly Glamour skill, Master of Intrigue languages/gaming set, Draconic Ancestor, Bladesinging weapon choice, and compatibility-class choices.

These should resolve through declarative source descriptors for skills, languages, tools, weapons, spells, damage types, and finite enums. Do not add a long list of feature-name UI exceptions.

### 8. Choice cadence must exist at field/grant level

A feature can contain both persistent and runtime choices. The shared model needs cadence on each field or grant, not merely on the enclosing feature:

- `creation`
- `level-up`
- `training`
- `long-rest`
- `short-rest`
- `per-use`
- `informational`

A selection replaceable when a character gains a level remains persistent current state with a level-up replacement route. A selection made after a Long Rest is runtime configuration and must not be locked in the creator.

### 9. Subclass and non-class spell authority is incomplete

The current Spells step only receives the base class. A base noncaster with a spellcasting subclass therefore has no starting-spell selection flow. This affects cases such as Eldritch Knight Fighter and Arcane Trickster Rogue.

The current creation RPC also records only base-class `p_spell_choices` in `character_spells`. Starting spells can additionally originate from:

- subclass
- species
- feat
- class feature
- background-expanded class lists

Species spells are currently sheet metadata rather than canonical spell grants, and the current authority validator compares the sheet spell summary only against `character_spells` rows with `source_type = 'class'`.

The spell model must become grant/access based: source type, source label, spell id, casting ability, prepared/always-available state, free-use/recharge metadata where applicable, and list-access changes must all be explicit.

### 10. Background-expanded spell lists are displayed but not usable

The Forge carries `backgroundExpandedSpellNames`, but `NpcForgeSpellStep` filters the catalogue strictly to the selected base class. A background that adds spells to the class list can therefore explain the rule without allowing those spells to be selected. This belongs in the generalized spell-access model above.

### 11. Higher-level creation does not replay level advancement

The Forge accepts levels 1–20, but a level-8 or level-19 starting character is not simply a level-1 character with a larger feature table. Higher-level creation must replay the permanent decisions and effects gained on the path to the starting level.

Missing or incomplete examples include:

- Ability Score Improvement / General Feat advancement
- built-in feat ability increases and nested feat choices
- Epic Boon selection where applicable
- persistent class/subclass choices gained at intermediate levels
- PB-scaled grants that unlock along the way
- source-backed spell and replacement choices

The existing live level-up system already identifies several unsupported feature families. The Forge and level-up system should converge on the same source-choice engine rather than maintaining two partial implementations.

### 12. Existing level-up feat handling is too shallow to reuse unchanged

`complete_character_level_up_v1` can currently accept an ASI or a feat name, but its feat branch is a hard-coded name allowlist. It does not generically apply the feat's built-in ability increase, nested choices, source prerequisites, repeatable instances, or derived grants.

The new feat-grant engine must serve both Character Forge higher-level replay and ordinary future level-up.

### 13. Higher-level HP currently silently chooses fixed values

The shared Forge computes level-1 maximum Hit Points correctly and then silently applies fixed average gains for every later starting level. Fixed HP is legal, but the user is never told that the choice was made.

Higher-level creation should explicitly use fixed or rolled advancement. More importantly, if an intermediate ASI or feat changes Constitution, maximum HP must include the retroactive Constitution-modifier effect across attained levels. That cannot be correct until higher-level advancement choices are modeled.

### 14. Starting equipment is missing from player creation

The standard player flow currently has no Equipment step and the player creation RPC creates no starting inventory.

The Background catalogue already retains source starting-equipment A/B packages. Preferred Class data currently does not retain equivalent class starting-equipment metadata, so the class import/catalog must be extended before the Forge can be authoritative.

Required implementation:

- preserve/import class starting equipment
- background equipment A/B choice
- class equipment/package choice
- dependent choices such as a Gaming Set matching a prior tool choice
- canonical item-catalog resolution
- per-character inventory grants
- starting coin grant
- Review summary and server validation

Higher-level optional extra money/magic items remain DM policy; normal starting equipment is the required baseline.

### 15. Multi-character currency is currently account-scoped

The new player flow supports multiple characters per account, but `player_wallets` and all current wallet RPCs are keyed only by `user_id`. That means two player characters on one account necessarily share one GP balance.

Character inventory is already capable of character ownership. Starting GP cannot be made character-correct until currency has a character-scoped authority path or the campaign explicitly decides money is account-wide. The safe migration path is a character-scoped wallet authority with legacy compatibility rather than casually rewriting merchant economy calls inside this PR.

### 16. Artificer wildcard Magic Item Plans still need concrete item instances

The giant source table is no longer dumped into the Class UI, but wildcard plan rows are not complete plans by themselves. When a wildcard category can be learned more than once for different concrete items, the grant needs a concrete item child selection and an instance identity, with corresponding server validation.

### 17. Review ownership needs correction

The class-feature choice summary records `placement`. Review still lists every class-feature choice under Class Progression. `placement: training` selections such as Expertise should appear under Training & Professions.

## Scope decisions that must not be silently changed

### Campaign Species Bonus / level-1 bonus feat policy

The current campaign UI offers a Species Bonus package of +2/+1, +1/+1/+1, or a feat instead of the ability increases. Older compatibility text also references a campaign bonus feat. These are not automatically assumed to be the same policy. Preserve the current accepted Species Bonus behavior during the source-choice rewrite; any separate GM-enabled bonus-feat policy should be reconciled deliberately rather than inferred.

### Multiclassing

The rules support multiclassing, including higher-level starts. The current Forge is single-class. Multiclassing is recorded as a separate scope decision rather than being silently added to PR #170 unless the campaign owner asks to include it in this acceptance slice.

## Target architecture

The next implementation pass should establish one normalized source-choice/grant model with:

- owning source: origin / species / background / class / subclass / feat / equipment
- source option/feature identifiers
- field kinds: enum / ability / skill / tool / language / spell / feat / item / weapon / damage type / ancestry / lineage
- required count and legal source query
- placement
- field-level cadence
- dependencies (`activeWhen`)
- prerequisite descriptors
- repeatable grant-instance identity
- replacement cadence
- derived grants/effects
- serialization and completion validation

Existing Species and Class contexts should be adapted to that schema before they are retired, reducing regression risk.

## Production database state

Production currently includes the existing Forge authority stack plus `player_forge_runtime_choice_cadence`. That migration deliberately requires persistent children for Agonizing Blast, Eldritch Spear, Repelling Blast, and Lessons of the First Ones while excluding Pact of the Tome rest-time Book of Shadows children.

The audit also ran Supabase security/performance advisors. Existing project-wide advisories remain outside this Forge patch boundary and were not modified.

## Protected boundaries

- no world-map behavior
- no town/city-map behavior
- no travel/routes/weather/camps/clock simulation
- no tactical encounter behavior
- no unrelated crafting runtime behavior

Character inventory, spell grants, progression, feats, and a minimal character-scoped currency compatibility layer are in scope only where required to make a newly created character authoritative.

## Acceptance gate

Do not merge PR #170 and do not ask for final browser acceptance until the source-choice foundation, Origin choices, feat instances/effects, higher-level advancement, spell grants/access, starting equipment/currency, Artificer wildcard plans, and Review ownership are implemented and the exact PR head is green.

After that implementation, run authenticated browser acceptance across representative level-1, level-3, level-4, level-8, level-19, and level-20 characters before merge.
