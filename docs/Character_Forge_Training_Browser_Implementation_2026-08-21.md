# Character Forge Training Browser-Review Implementation Checkpoint

Updated/reclassified: 2026-09-15

Classification: **historical exact-head implementation/CI/Preview evidence from 2026-08-21**.

PR #176 (`agent/training-tab-redesign`) is now merged. The original “ready for browser review / do not merge” gate in this file has been satisfied historically and is no longer a current merge instruction.

For present-tense Training architecture/status, use `Character_Forge_Training_Redesign_Status.md` and current source/validators.

## Historical exact validated runtime checkpoint

At the 2026-08-21 checkpoint:

- PR: #176 — `agent/training-tab-redesign`;
- validated runtime/validator head: `f660fe899722e34e1a72cb9333c623642633d84e`;
- GitHub Actions: **15/15 triggered workflows passed**;
- exact Vercel deployment: `dpl_VZztopxT1b2W6ZqvjzT78ZgLtJt7`;
- deployment state: `READY`.

Those values are historical evidence, not current deployment identifiers.

## Implemented browser-review changes

### Player Training isolation

`NpcForgeTrainingStep` routes player and NPC Training through intentionally separate presentation paths where needed. The player redesign must not silently alter NPC creation/service behavior.

### Training presentation

The implemented player direction included:

- compact `Skill & Training Selections` overall tally;
- inline Skills;
- inline Trade Skills;
- `Other Training Choices` only for genuine unresolved source/feature choices;
- compact Feat & Class Choices;
- sticky/useful Current Selection detail surface;
- no redundant visible `Training Picks` heading;
- local subsection completion/provenance counts.

### Inline grants and provenance

Background/Class/source-granted Skills and Trade Skills are represented inline with selectable entries and visibly retain their source/granted status. A source grant does not silently consume a paid Training pick.

### Trade Skills

The browser-review period expanded the intended player-facing Trade Skill set and preserved the rule that a mapped tool proficiency and matching Trade Skill are one campaign proficiency for Training accounting.

Current source mapping is authoritative; consult `utils/craftingToolProfessions.js` and current profession definitions before changing the list.

### Feat selection

Training uses the compact searchable feat picker rather than a large native select. Feat rules/source/prerequisites/nested choices remain source-owned and contextual.

### Background/source choices

Variable Background/source Training choices may resolve in Training while retaining their original ownership/provenance. The UI should not create a second Background/Class/Feat persistence path merely because the control is rendered here.

### Completion/Continue

Training completion includes unresolved required source/feat/class choices and must prevent Continue until the existing authoritative required-choice contract is satisfied.

## Historical validation coverage

The 2026-08-21 green workflow set included the focused Training redesign validator plus Forge/Species/Background/source-magic/starting-equipment/portrait/source-presentation regression gates.

Future Training changes must run the **current** validator set rather than trying to reproduce the old workflow count literally.

## Current interpretation

This file answers: “What was implemented and proven at the August 21 Training browser-review checkpoint?”

It does **not** answer:

- what branch is active now;
- whether PR #176 should be merged (it already was);
- what the current Vercel Preview URL is;
- what the current migration ceiling is;
- what the current project priority is.

Use the current handoff/index for those questions.

## Protected boundaries

The historical Training implementation did not authorize world-map/town-map/travel behavior, tactical combat, inventory/equipment authority changes, crafting recipe/material/economy redesign, merchants, or unrelated runtime systems. Those scope boundaries remain valid.
