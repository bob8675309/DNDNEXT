# DNDNext Next-Chat Handoff Brief

Updated: 2026-09-13

Repository: `bob8675309/DNDNEXT`

Stack: Next.js **Pages Router** 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## START HERE — connected project tools are part of the normal workflow

A new DNDNext conversation should **check and use the connected project tools before claiming access is unavailable, asking Paul to manually move files, or inventing a workaround**.

The expected connected services are:

- **GitHub connector** — inspect `main`, branches, PRs, commits, files, diffs, workflow runs, checks, and create/update branches/files/commits/PR metadata. Use it as the source-code and branch authority.
- **Supabase connector** — inspect the live `DnDWeb` project, query live tables/functions/policies, verify production state, and apply reviewed migrations when a task actually requires database changes. Use live read-only inspection before any write.
- **Vercel connector** — list deployments for the DNDNext project, match deployments to the exact Git commit/branch, inspect build logs, and fetch protected preview URLs when necessary. A GitHub push normally triggers the Vercel preview through the existing Git integration; a separate manual deploy is usually unnecessary.
- **Dropbox connector** — move approved/generated binary payloads that the GitHub text/file connector cannot safely preserve byte-for-byte. The established transfer folder is `/DNDNext-Transfer/`.

These connectors are complementary. Do not treat them as interchangeable:

`GitHub = source/branches/CI authority`

`Supabase = live database authority`

`Vercel = deployed preview/build authority`

`Dropbox = binary transport bridge`

If a connector is not immediately visible in a new session, discover/check the available project connectors first. Only report an access limitation after an actual connector/tool attempt or confirmed absence.

Read these operational docs at startup:

- `docs/REPO_ACCESS_STANDING_RULE.md`
- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`
- `docs/ARTWORK_BINARY_TRANSFER_RUNBOOK.md` when binary assets are involved
- the dedicated subsystem handoff/status document for the work being continued

## Current authoritative checkpoint

Production/default branch:

- `main` — current checked checkpoint `02854698298f357d2dfde21dd292ba7caf73e1c1` (`Merge PR #177: Realistic Dice and current Character Forge work`).

Active subclass-art/selector work:

- PR **#187** — `Redesign subclass selector as cinematic looping gallery`
- branch: `agent/subclass-carousel-selector-20260911`
- latest verified artwork materialization checkpoint before this documentation update: `2180841f21e7352d4f6fbf0881e345b8d95b643d`

**Never assume those SHAs remain current. Re-fetch `main`, PR #187, and the exact remote branch head at the start of the next conversation and immediately before every write/push/merge.**

The current PR #187 branch contains the normalized 7:12 subclass tarot presentation and two installed approved tarot batches. The authoritative artwork checklist records:

- target concepts: 109;
- installed/wired/validated: 54;
- approved but not installed: 0;
- remaining: 55;
- next normal production batch: Fighter — Psi Warrior, then Paladin — Ancients, Devotion, Glory.

Read:

- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`

## The preview/scratch-branch push pattern — do not forget this

DNDNext has a proven way to perform work that needs a real checkout, shell commands, binary materialization, grouped multi-file edits, or validators even when the direct GitHub connector is not the right byte-level tool.

The pattern is:

`current target PR head -> bounded scratch/preview branch -> one-shot GitHub Actions workflow -> checkout the real target branch -> hard guard exact target SHA -> modify/test -> commit -> push HEAD back to the real target branch -> GitHub verification -> Vercel exact-head verification`

Important details:

1. The scratch/preview branch is created **from the exact current target head**.
2. The temporary workflow lives on the scratch/preview branch, not on the real PR branch.
3. The workflow checks out the **real intended PR/working branch**.
4. Before changing anything it verifies `git rev-parse HEAD` equals the expected target SHA.
5. It performs only the bounded requested work, runs focused checks, commits, and pushes `HEAD:<real-target-branch>`.
6. The scratch/preview branch itself is not merged into the PR merely to move the result. It is a controlled runner/transport surface.
7. After the push, re-read the actual PR branch head and changed-file boundary through GitHub.
8. Then use the Vercel connector to find the deployment whose metadata matches that exact new Git SHA and confirm it reaches `READY`; inspect build logs if it does not.

This is not an emergency workaround. It is established DNDNext operating procedure and was used successfully for the 2026-09-13 normalized subclass tarot installation and wiring.

## Binary artwork transfer path

For approved/generated binary artwork, use:

`approved local bytes -> final repository-format files -> manifest + SHA-256 -> ZIP -> Dropbox /DNDNext-Transfer -> temporary Dropbox download URL -> one-shot GitHub Actions scratch/preview branch -> exact target checkout/head guard -> checksum/format/dimension/count verification -> exact path/diff guard -> bot commit -> push intended PR branch -> GitHub/CI verification -> Vercel exact-head preview verification`

Rules:

- Do not regenerate an already approved image merely because transport is inconvenient.
- Do not downgrade quality to make upload easier.
- Do not return to giant inline base64 Git-blob transport while the Dropbox bridge is available.
- Dropbox temporary download links may be single-use; do not preview/HEAD/preflight them before the Actions runner performs the real GET.
- Keep a payload manifest and file checksums.
- For artwork, verify expected dimensions/MIME/format and exact destination file count.
- Compare changed/staged paths to the manifest and abort on any extra or missing path.
- Do not leave the temporary workflow or transfer ZIP in the real PR diff unless intentionally making permanent tooling.

The 2026-09-13 tarot transfers used this exact model twice: the first reviewed ZIP installed 34 normalized WebP concepts, and batch 2 installed 20 more. Each used `/DNDNext-Transfer/`, an exact-head guarded scratch/preview Actions runner, checksum/dimension/count/path verification, a direct push back to PR #187's branch, a separate guarded wiring/docs step, and exact-head Vercel verification.

## Mandatory startup sequence for every new DNDNext conversation

1. Read this file first.
2. Check/discover the **GitHub, Supabase, Vercel, and Dropbox** connectors before discussing access limitations.
3. GitHub: fetch `main`, the active PR(s), exact head SHA, changed-file scope, relevant files, and workflow/check status.
4. Supabase: inspect project `ucggczovhmauhshvhusx` (`DnDWeb`) for only the tables/functions/policies relevant to the requested task. Diagnosis should be read-only first.
5. Vercel: identify the active preview deployment by exact Git SHA/branch and check state/build logs when browser/deployment behavior matters.
6. Dropbox: when binary transfer is required, use `/DNDNext-Transfer/` rather than asking Paul to manually shuttle generated art.
7. Read `docs/README.md`, this handoff, the repo-write/access runbooks, and the active subsystem ledger.
8. Inspect the real code/data path end to end before changing it. Documentation is guidance; current source/live database/deployed behavior outrank stale prose.
9. Propose/confirm a bounded patch plan when making runtime changes. Do not widen scope because a connector makes unrelated files easy to reach.
10. Before returning a patch, verify every new helper, hook, state variable, prop, callback, RPC argument, and data-contract field is defined and passed correctly.
11. Run focused validators and protected-boundary checks.
12. Re-fetch the branch head after mutation and verify the exact diff.
13. Verify the Vercel deployment for that exact head when the branch is deployed.
14. Never merge an open PR without Paul's explicit approval.

## Live Supabase authority

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

Use the Supabase connector directly. Before any DB mutation:

- inspect the current live object/data first;
- do not assume a repository SQL filename means production has or has not received the effect;
- use `execute_sql` for diagnosis/read-only checks where appropriate;
- use the migration action for reviewed DDL/schema changes;
- verify live state afterward;
- do not expose service-role credentials in browser code.

Artwork-only work requires **no Supabase write**. Supabase is used during subclass artwork production only to verify the current preferred-source subclass catalogue/authority.

## Current subclass tarot state

The subclass selector is presentation-only. Existing class-guide/model logic remains authoritative for subclass availability, level gating, selection, persistence, and progression injection.

Installed normalized tarot concepts currently cover the approved Artificer, Barbarian, Bard, Cleric, Druid, Fighter except Psi Warrior, Monk, and Monster Hunter preferred-source queue. `utils/classes/subclassArtwork.js` maps only approved installed concepts; unfinished subclasses deliberately retain class-menu artwork fallbacks.

The current deck contract is:

- 7:12 ratio;
- final export 840 × 1440 WebP;
- full-bleed artwork through the lower third;
- no opaque footer/title band;
- fixed frame/title/emblem geometry;
- explicit mapping only after Paul approves the card and it is installed/validated.

Do not restore reset-era tarot artwork from old commits unless Paul explicitly asks for a particular old asset as reference.

## Non-negotiable project boundaries

- World-map and town/city-map behavior are separate systems.
- Do **not** touch `components/MapPageClient.js`, world travel/routes/weather/camps/world clock unless Paul explicitly requests world-map work.
- Character Forge/artwork work does not authorize crafting, inventory, merchant, encounter, tactical, travel, or economy changes.
- Tactical encounter rules remain server/RPC authoritative.
- Preserve existing source-choice/runtime/persistence authority; do not create parallel React/database authority for presentation convenience.
- Prefer additive database migrations; never rewrite deployed migration history.
- Never weaken validators merely to make a change pass.
- Never force-push over unexpected concurrent branch movement.

## Copy-ready takeover instruction

You are taking over DNDNext as a senior developer and technical advisor. Start by reading `docs/DNDNext_Current_Handoff_Prompt.md`. Before changing anything, use the connected **GitHub, Supabase, Vercel, and Dropbox** tools: re-fetch `main`, the active PR and exact head; inspect live Supabase only for the relevant subsystem; identify the Vercel preview for the exact Git head; and use Dropbox `/DNDNext-Transfer/` plus a guarded GitHub Actions scratch/preview branch when binary bytes or a real checkout are required. Do not say repository/database/deployment/binary transfer access is unavailable until those connector paths have actually been checked. Preserve working systems, keep world-map and town/city-map behavior separate, do not touch the world map unless Paul explicitly asks, keep changes bounded, verify every new helper/hook/state/prop/callback/RPC/data field is defined and passed correctly, run focused validators, re-check the exact branch diff, and verify the exact-head Vercel deployment before reporting completion. Never merge without Paul's explicit approval.
