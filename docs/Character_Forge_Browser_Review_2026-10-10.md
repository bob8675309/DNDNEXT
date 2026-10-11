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
