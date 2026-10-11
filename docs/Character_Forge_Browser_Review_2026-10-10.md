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

The Training feat catalogue treats Fighting Style rows as children rather than ordinary top-level Bonus Feats. **Fighting Initiate** has an independent chevron and expands in place, using the same visual hierarchy as expandable Species families. Its child rows are the canonical generic `FS` Fighting Style feats. Clicking a child selects Fighting Initiate plus that style as one parent/child decision; the chosen style remains persisted as its own authoritative grant owned by the Fighting Initiate instance.

The parent source specifically points to the Fighter Fighting Style pool, so class-specific `FS:R` and `FS:P` rows are deliberately not folded into the branch. **Druidic Warrior** remains a Ranger Fighting Style choice and **Blessed Warrior** remains a Paladin Fighting Style choice. Those styles still appear when their corresponding class Fighting Style feature is being resolved.

If the class already granted a generic Fighting Style, Fighting Initiate removes that same style from its child pool so the source rule's “must be different” requirement is enforced before creation. Existing saved drafts that directly selected a Fighting Style remain visible long enough to be replaced instead of being silently invalidated.
