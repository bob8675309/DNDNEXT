# Character Forge Training asset inventory

These assets belong to the player Character Forge Training step and are intentionally small UI illustrations rather than character portraits.

## Summary strip
- `summary-background.svg` — Background grants
- `summary-skills.svg` — selected/class skills
- `summary-training.svg` — Training/source choices
- `summary-feat.svg` — feat/class choices

## Source-choice families
- `choice-tool.svg` — tool proficiency/source choices
- `choice-instrument.svg` — instrument proficiency/source choices
- `choice-language.svg` — language proficiency/source choices

## Crafting professions
- `profession-alchemy.svg`
- `profession-smithing.svg`
- `profession-scribe.svg`
- `profession-enchanting.svg`

## Integration contract
- All Training decisions render in the left **Training Picks** pane.
- The right pane is reserved for the focused **Current Selection** explanation and must not receive Training resolver forms through a portal.
- The Training modal targets the approved mockup proportions: approximately 43% selection workspace / 57% contextual information at desktop sizes.
- NPC Forge continues to use the preserved legacy Training implementation.
- These SVGs can be replaced one-for-one with richer art later without changing choice authority or component behavior.
