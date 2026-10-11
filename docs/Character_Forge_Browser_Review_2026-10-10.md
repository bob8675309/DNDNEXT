# Character Forge Browser Review — 2026-10-10

This note records the browser-review corrections added on PR #207 after the 2026-10-10 screenshots/video.

## Subclass Codex spells

The Subclass Codex **Spells** tab now uses the same browse/read pattern as the main Forge spell catalogue:

- compact single-line rows on the left;
- sortable Spell, Level, School, Source, and Access columns;
- shared readable `SpellCard` on the right;
- structured `raw_payload` / scaling data is loaded so spells with named rule sections, such as **Detect Thoughts**, render as readable digital disclosures instead of one uninterrupted text wall.

The Codex remains read-only/reference UI; spell-selection authority is unchanged.

## Training tabs

The first Training switch is now **Skills & Trade Skills**.

Training status badges such as **Needs choice** and **No choices** occupy their own line beneath the tab title/progress instead of sharing the title row. This prevents the status badge from colliding with Skills or Class Choices labels.

The Feats fraction counts feat instances only. Required choices owned by a feat (for example Metamagic Adept's two Metamagic selections) remain completion requirements but no longer inflate the displayed feat count.

Background-granted feats such as **Magic Initiate** are pinned into the main Feat catalogue as **Granted**, ahead of the normal sorted list. Their existing source ownership is preserved.

## Trade Skill dossier copy

Trade Skill Current Selection descriptions are player-facing summaries of what each craft does. Internal compatibility explanations about Background tool grants, mundane tool ownership, or implementation-level proficiency mapping are intentionally omitted from the player-facing description.

## Compact feat-owned ability choices

Simple feat Ability Score Increase fields such as **Expanded Grip** no longer render as a large duplicate Required Feat Choices box.

They use a compact disclosure that reads:

> This feat grants a +1 to one of the following ability scores; choose between these options.

The chevron opens the available ability pills. After the player selects an ability, the disclosure collapses and leaves the chosen ability in the summary; reopening it allows the choice to be changed.

Complex conditional Ability Score Improvement structures continue to use the general source-choice resolver rather than being forced into this compact presentation.

## Boundaries

These changes are presentation/routing changes inside Character Forge and the Class/Subclass Codex. They do not change world-map, town-map, combat, crafting runtime, source-choice persistence, or class/subclass persistence authority.


## Feat ability-bonus disclosure follow-up

Feat Current Selection now reads the canonical feat ability metadata before the feat is selected. For the 141 imported feat rows that currently carry an ability-bonus rule, the Feat Rules presentation adds an **Ability Score Bonus** entry alongside the feat's other benefits. Limited choices list their actual abilities, while six-ability choices say that any ability score can be chosen. The dedicated Ability Score Improvement feat remains on its existing specialized flow.

After a simple +1 choice feat is selected, the same Ability Score Bonus row becomes the compact chevron chooser. Choosing an ability collapses the row and leaves the chosen ability/value at the right edge; reopening it allows replacement without adding a second feat-rule box.

Imported special prerequisites such as Druidic Warrior/Blessed Warrior no longer expose raw `OtherSummary` / `EntrySummary` keys. Druidic Warrior now reads as **When gaining the Level 2 Ranger Fighting Style feature**, and the Current Selection category is shown as **Ranger Fighting Style** rather than `FS:R`.


## Fighting Style feat hierarchy follow-up

The campaign is using the 2024 rules model, so the legacy **Fighting Initiate (TCE)** row is adapted instead of applying its original martial-weapon prerequisite literally.

For this campaign, Fighting Initiate is treated as a **General feat** with the prerequisite **Fighting Style class feature**. The original Tasha's prerequisite remains stored in metadata for source auditing, while the effective catalogue/server prerequisite is the 2024-compatible class-feature gate. Because the prerequisite evaluator now reads class features through the character's actual acquisition level, Fighter qualifies at level 1 and Paladin/Ranger qualify once their level-2 Fighting Style feature has been reached; classes without that feature remain ineligible.

The Training feat catalogue treats Fighting Style rows as children rather than ordinary top-level Bonus Feats. **Fighting Initiate** has an independent chevron and expands in place, using the same visual hierarchy as expandable Species families. Its child rows are the canonical generic `FS` Fighting Style feats. Clicking a child selects Fighting Initiate plus that style as one parent/child decision; the chosen style remains persisted as its own authoritative grant owned by the Fighting Initiate instance. The selected child style's full rule text is also surfaced in Current Selection while the left branch remains the authoritative place to change that choice.

The parent source specifically points to the Fighter Fighting Style pool, so class-specific `FS:R` and `FS:P` rows are deliberately not folded into the branch. **Druidic Warrior** remains a Ranger Fighting Style choice and **Blessed Warrior** remains a Paladin Fighting Style choice. Those styles still appear when their corresponding class Fighting Style feature is being resolved.

If the class already granted a generic Fighting Style, Fighting Initiate removes that same style from its child pool so the source rule's “must be different” requirement is enforced before creation. Existing saved drafts that directly selected a Fighting Style remain visible long enough to be replaced instead of being silently invalidated.


## Training ratio and Class Choice cleanup — 2026-10-11

The player Training Skills view now uses compact allocation ratios instead of prose counters.

- **Skills** shows `allocated / allowed` beside the section heading.
- **Trade Skills** uses the same compact ratio treatment.
- The top **Skills & Trade Skills** tab combines the two displayed groups into one allocation total instead of reporting Skills alone.
- The old “granted / paid / shared left” header prose is removed. Selection authority is unchanged; the ratio presentation follows the current allocation of the shared class allowance.

Source-backed Class Choice Current Selection also removes duplicate rule presentation. The badge carries the owning choice family, the hero shows a prerequisite only when one exists, and the actual option rule appears once in a compact **Rules** section. Label-only descriptions such as the Magic Item Plan common-item category are suppressed, and the “additional choice follows” helper disappears once the parent option is selected because the dependent choices are already visible in the left catalogue. This removes the duplicated Jolt to Life rule block while keeping its complete source text readable once.

The Forge Spells step keeps the same source-owned magic, class spell limits, filters, sortable catalogue, and SpellCard preview, but the top chrome is compressed: the section header, source-owned magic wrapper, selection summary counters, notices, access notes, and search toolbar use less vertical space.


## Class level placement, direct Skill controls, and feat prerequisite enforcement — 2026-10-11

The player **Starting Level** control has moved out of the Class catalogue search strip. It now sits in the Class guide's upper-right control cluster beside **Class Overview** and **Detailed Guide**, where it reads as part of class progression rather than as a search filter. Player mode no longer reserves empty search-field padding for the old floating level control; NPC Forge retains its full Level / Proficiency Bonus / Hit Dice / Expected HP strip.

Training **Skills** now use direct row actions. Clicking the main skill row still opens its Current Selection reference card, while the compact control at the right edge is the actual **Select / Deselect** action. Background/source-granted fixed skills remain visibly **Granted** and cannot be removed. Class, Background-choice, and source-choice skills still update their existing authoritative selection stores rather than creating a new parallel state.

The main **Feats** catalogue now treats every canonical source-granted feat the same way visually: Background, Species, Class, and other source-owned feat grants are pinned with the same teal selected-row accent while retaining their original ownership and follow-up routing.

Bonus Feat selection now evaluates the live structured prerequisite metadata for every preferred feat before confirmation. The Forge builds the prerequisite state from current level, final ability scores, class features, species/lineage/size, Background, previously owned feat instances and their child choices, proficiencies, spellcasting, feat categories, and campaign context. Unmet feats remain readable but are marked **Locked**; Current Selection disables confirmation and lists the unmet requirement(s). If a saved draft contains a now-invalid Bonus Feat, that Bonus Feat selection is cleared rather than allowed to persist as legal.

The live preferred feat catalogue currently contains **229 feats**. The prerequisite audit found no structured prerequisite keys outside the resolver's supported set: level, ability, spellcasting, spellcasting feature, class feature, proficiency, earlier feat/feat variant, feat category, mutually exclusive feat category, Background, species/lineage/size, campaign, and the imported special-condition forms. Unknown future prerequisite shapes fail closed rather than silently becoming selectable.

**Baleful Scion** is explicitly covered by the regression matrix: it requires level 4 and the exact **Scion of the Outer Planes (Evil Outer Plane)** variant. Owning only the parent Scion feat is insufficient. The matrix also covers alternative ability prerequisites, campaign gates, Fighting Initiate's Fighting Style feature gate, Dragonmark category/exclusivity rules, Small-race rules, spellcasting prerequisites, special Ranger/Paladin Fighting Style acquisition timing, and unsupported prerequisite shapes.


## October 11 follow-up — Class level placement, direct Feat actions, Spell collapse, and Equipment market

Paul's next browser review produced a bounded UX follow-up rather than another Forge architecture rewrite.

- **Starting Level** no longer occupies the Class hero's upper-right art/control cluster. In Class Overview it sits directly above the Subclass Browser; Detailed Guide keeps a compact non-art-overlapping level row.
- source-granted Feats such as **Magic Initiate** retain their real ownership but now use the same teal pinned-row treatment as selected Feats;
- Feat rows now expose small **Select / Deselect** controls that share the same Bonus Feat authority as the larger Current Selection action. Granted and prerequisite-locked rows remain non-removable/non-selectable;
- source-owned Spell helper text is larger and higher contrast;
- compact source-owned Spell selectors auto-collapse when their required choice becomes complete, reopen if the choice becomes incomplete, and remain manually reopenable for changes;
- browser-review deep links can open the Forge directly to a named or numbered step with `?forgeStep=equipment` (or another step). This changes navigation only and does not bypass final creation validation;
- Equipment uses a compact merchant-style budget bar and collapses vanilla/source bookkeeping into a reference disclosure;
- the new `dndnext-homebrew` market ruleset uses a **300 gp minimum starting purse**, while `vanilla` preserves the imported class/background cash alternatives. Package A/B/C data and legacy package payload support remain intact for the future campaign-level vanilla/homebrew switch;
- live merchant checkout authority remains unchanged: current storefront state, stock, quantity, and server price are revalidated transactionally when the character is created.

Production inspection during this pass found one currently enabled storefront merchant and no populated storefront portrait field. The selector is portrait-aware, but new merchant identities/portraits are intentionally deferred to an explicit content/art batch rather than adding placeholder NPCs.
