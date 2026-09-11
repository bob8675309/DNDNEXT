# Character Forge Training Browser Review Follow-up — 2026-08-21

Status: approved implementation follow-up on PR #176 (`agent/training-tab-redesign`). This document is a handoff-safe addendum to `Character_Forge_Training_Redesign_Status.md`.

## User-approved changes from browser review

### Species presentation

- Shrink the expandable Origin Languages chooser so its normal footprint is closer to the Gender & Alignment card rather than a tall standalone panel.
- Preserve the existing two-Origin-language rule and outside-click collapse behavior.
- A double-click on desktop or double-tap on touch in the non-interactive top band of Character Forge should reset the Forge window to its normal/default size and position. This resets Forge geometry; it does not attempt to control browser zoom.

### Training layout

- Remove the redundant `Training Picks` heading/intro once the subsections carry their own labels and tallies.
- Keep all decisions on the left.
- Make the right-side `Current Selection` card sticky inside the Forge scroll surface so the active explanation remains visible while scrolling long Training content.
- Put each section's tally at the right edge of its own subheading rather than asking the top summary to explain every local count.
- Skills, Trade Skills, and Feat/Class choices must each show their own selected/granted/required state.
- Background/class/source-granted Skills and Trade Skills should appear inline in the same list as selectable entries, already selected and visibly tagged with provenance such as `Granted by Background`, `Granted by Class`, or `Granted by Source`.
- Do not keep a separate Background-grant chip row once the granted entries are represented inline.
- The top `Skill & Training Selections` summary may remain as a compact overall completion/provenance control, but local subsection tallies are authoritative for understanding each list.

## Trade Skill expansion

The player-facing Trade Skill list now targets eight craft disciplines:

1. **Alchemy** ↔ Alchemist's Supplies
2. **Smithing** ↔ Smith's Tools
3. **Scribe** ↔ Calligrapher's Supplies
4. **Enchanting** ↔ Enchanter's Tools
5. **Cooking** ↔ Cook's Utensils
6. **Tinkering** ↔ Tinker's Tools
7. **Jewelcraft** ↔ Jeweler's Tools
8. **Brewing** ↔ Brewer's Supplies

A mapped tool proficiency and its Trade Skill are one campaign proficiency. A source grant of the mapped tool grants the Trade Skill without a second paid Training choice. A paid Trade Skill selection grants/assumes the associated tool proficiency.

### Temporary unsupported-tool policy

The long-term goal remains a more granular craft catalogue where additional tools can become independent Trade Skills with recipes/progression. That larger crafting-system project is deferred.

For PR #176:

- supported artisan/crafting-tool choices should present the eight mapped Trade Skills above rather than a large generic artisan-tool dropdown;
- unsupported artisan craft options should be hidden from the generic player-facing artisan/craft picker for now, but **must not be deleted from source data**;
- non-crafting source-owned tool choices that are genuinely required by a Background/class/feat (for example gaming sets, disguise kits, vehicles, or other non-artisan proficiencies) must remain resolvable through the existing source-choice authority so character creation cannot deadlock;
- hiding unsupported artisan options is a presentation/deferred-support decision, not a source rewrite;
- future crafting work should inventory the hidden tool catalogue before adding recipes/progression.

## Feat presentation

- Keep the compact searchable Training feat catalogue introduced on PR #176.
- Put the Feat/Class choice tally on the right side of that subsection heading.
- Keep feat rules, source, prerequisites, and nested choices contextual/readable rather than returning to a giant native dropdown.

## Acceptance checklist

- [ ] Species Origin Languages card is compact at rest and still expands/collapses correctly.
- [ ] Forge top-band double-click/double-tap restores default Forge geometry without firing on buttons/inputs.
- [ ] Current Selection remains visible while vertically scrolling Training.
- [ ] `Training Picks` heading is removed.
- [ ] Granted skills are inline and visibly show provenance.
- [ ] Granted Trade Skills are inline and visibly show provenance.
- [ ] Skills tally appears at the Skills heading.
- [ ] Trade Skills tally appears at the Trade Skills heading.
- [ ] Feat/Class tally appears at the Feat/Class heading.
- [ ] Eight mapped Trade Skills appear with the correct tool association.
- [ ] Generic artisan-tool choices that can be satisfied by the mapped Trade Skills are resolved through the Trade Skill rows rather than a large dropdown.
- [ ] Required non-crafting source tool/instrument/language choices remain resolvable.
- [ ] Source-granted mapped tools do not consume the shared Class Skill / Trade Skill allowance.
- [ ] Paid Trade Skill picks still consume the shared allowance.
- [ ] No crafting recipe/material/attempt/merchant/economy behavior changes in this PR.
- [ ] NPC Forge legacy Training behavior remains protected unless explicitly changed and validated.
- [ ] No world-map/town-map/travel/tactical changes.
- [ ] All exact-head GitHub workflows green and Vercel preview READY before requesting browser acceptance.

## Protected boundaries

This follow-up does not authorize changes to world-map/town-map/travel behavior, tactical combat, inventory/equipment authority, crafting recipes/material formulas/attempt RPCs, merchants, economy, or unrelated rest/runtime systems. The future full crafting-tool/recipe expansion remains a separate post-Forge project.