# Forge Species Art, Portraits, and Expand/Collapse — Historical PR #170 Handoff

**Status: SUPERSEDED. Do not use this file as the active Species-art checkpoint.**

PR #170 was merged into `main` on 2026-08-13 UTC at merge commit:

`599c4de7397ba6e4bbbb0a061d551d80c3570be7`

The merge occurred through an accidental GitHub connector invocation while a branch-integration action was being searched for. Do not describe PR #170 as open or unmerged, and do not attempt to use `merge_pull_request` for branch integration.

Active continuation now lives in:

- `docs/Forge_Post170_Species_Artwork_Status.md`
- branch `agent/species-art-post170`
- PR #171 — OPEN / UNMERGED

PR #171 must not be merged without explicit user approval.

## Historical scope preserved from PR #170

PR #170 established the Character Forge Species presentation model:

- expandable parent Species with independent chevrons/collapse state;
- parent/child descriptions;
- parent-persisted/source-choice family handling for Genasi, Dragonborn, Aven, Elf, Gnome, Shifter, Fairy/Faerie, and Kithkin;
- Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline trait-level choices;
- canonical `speciesArtworkFor(...)` behavior outside the Forge;
- Forge-only `speciesPortraitArtworkFor(...)` child presentation;
- dedicated Genasi, Chromatic Dragonborn, and Metallic Dragonborn artwork;
- restored Aven source rows through migration 93.

Historical validated checkpoints included:

- `086128e9617fedf8410943a4c230bc466f2f9d11` — dedicated Genasi family;
- `46306a44e698d907225d54d1e57d5df14656a9b5` — Chromatic Dragonborn family;
- `2e5031a71f05f8705b64dbbef30aa402dd42c58f` — validated Metallic Dragonborn checkpoint.

The old detailed text and commit history remain available through Git history if forensic detail is needed. Current state, current artwork queue, current validation, and current PR authority are intentionally maintained only in `Forge_Post170_Species_Artwork_Status.md` so future handoffs do not follow stale #170 instructions.

## Repo-write procedure

ChatGPT has direct GitHub/Supabase connector write authority.

Use:

`create_blob → create_tree → create_commit → race-check → update_ref(force=false) → compare → CI`

Controlling procedure:

- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`

For binary artwork, use GitHub-confirmed blob SHAs. If raw binary upload is unreliable, materialize on an isolated temporary branch, verify the bytes there, and attach only the resulting binary blobs to the real working branch.

## Protected boundaries

Species artwork work does not authorize changes to world-map, town/city-map, route/travel/weather, tactical combat, crafting, inventory, merchants, or unrelated runtime systems.
