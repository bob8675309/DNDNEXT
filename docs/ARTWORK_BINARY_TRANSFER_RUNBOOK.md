# DNDNext Artwork Binary Transfer Runbook

Status date: 2026-09-13

Use this runbook whenever approved/generated binary artwork must be installed into a DNDNext GitHub branch and ordinary GitHub text/file actions are not the appropriate byte-preserving transport.

## Connected tools used by this route

- **GitHub connector** — target branch/head authority, scratch/preview branch creation, temporary workflow creation, run/commit verification.
- **Dropbox connector** — upload the reviewed ZIP to `/DNDNext-Transfer/` and issue a temporary download link.
- **Vercel connector** — verify the deployment created from the final target-branch commit and inspect build logs.
- **Supabase connector** — normally read-only for artwork tasks; use it only to verify catalogue authority when artwork names depend on live preferred-source data. Pure artwork transport must not mutate Supabase.

## Preferred route

`approved local bytes -> normalize/export final files -> manifest + SHA-256 -> ZIP -> Dropbox /DNDNext-Transfer -> one-shot GitHub Actions scratch/preview branch -> checkout exact intended PR branch -> exact-head guard -> download once -> checksum/MIME/dimension/count verification -> exact changed-path guard -> commit -> push intended PR branch -> GitHub/CI -> Vercel exact-head preview`

This route is established DNDNext operating procedure. It successfully installed Species artwork on 2026-09-05 and the normalized subclass tarot batch on 2026-09-13. Do not spend another session rediscovering giant base64 Git-blob transport while this bridge is available.

## 1. Freeze the intended target

Before transfer:

1. Use GitHub to fetch the active PR/working branch.
2. Record the exact current target head SHA.
3. Confirm the expected destination paths/count.
4. Confirm the payload represents artwork Paul actually approved.
5. Never use `main` as the transfer scratchpad.

The one-shot runner must abort if the intended target branch no longer has the expected head.

## 2. Prepare the final binary payload

- Export the exact approved artwork into the repository's final format.
- Never regenerate approved art merely for transport.
- Never reduce quality merely to make a connector upload easier.
- Record expected dimensions, format, MIME, and destination path for every asset.
- Compute SHA-256 for every file.
- Create a machine-readable manifest where practical.
- Create one ZIP containing only the intended payload and manifest/checksum files.
- Compute SHA-256 for the ZIP itself.

The 2026-09-13 tarot batch used 840 × 1440 WebP files and an exact 34-concept manifest/count guard.

## 3. Upload the ZIP to Dropbox

Use the Dropbox connector and save the bundle under:

`/DNDNext-Transfer/`

Use a unique descriptive filename and wait until Dropbox reports `completed`.

Then request a temporary download URL for the uploaded file. Treat temporary Dropbox download URLs as potentially **single-use**:

- do not preview the URL;
- do not send HEAD requests;
- do not preflight it with another fetch;
- do not paste it into a surface that may automatically unfurl/fetch it.

The first real GET should be the GitHub Actions runner downloading `/tmp/<payload>.zip`.

## 4. Create a bounded scratch/preview branch

Create a new branch from the exact current target-branch head. Example:

`agent/<task>-materialize-YYYYMMDD`

This branch is a temporary runner surface. Put only the one-shot workflow there.

**Do not merge the scratch/preview branch into the real PR just to deliver the binary result.** The workflow should check out the real target branch and push the verified resulting commit directly back to that target branch.

## 5. One-shot workflow contract

The workflow must:

1. trigger only from the bounded scratch/preview branch;
2. use `permissions: contents: write`;
3. check out the **real intended PR/working branch**, not the scratch branch;
4. guard the exact expected target SHA:

```bash
test "$(git rev-parse HEAD)" = "<EXPECTED_TARGET_HEAD_SHA>"
```

5. download the Dropbox bundle once;
6. verify the ZIP SHA-256 before extraction;
7. verify per-file SHA-256 values;
8. verify required MIME/format/dimensions;
9. verify the expected binary file count;
10. copy only manifest-listed paths;
11. compare changed/staged paths against the manifest and abort on any extra/missing path;
12. run focused validators when applicable;
13. re-fetch/guard target movement before push when practical;
14. commit under a clear Actions/materializer identity;
15. push `HEAD:<intended-real-target-branch>` without force.

## 6. Verification examples

ZIP checksum:

```bash
echo '<ZIP_SHA256>  /tmp/artwork.zip' | sha256sum -c -
```

Manifest checksums:

```bash
cd /tmp/artwork
sha256sum -c SHA256SUMS
```

WebP MIME example:

```bash
while IFS= read -r f; do
  test "$(file -b --mime-type "$f")" = "image/webp"
done < /tmp/webp-files.txt
```

Exact changed-path guard:

```bash
git status --porcelain=v1 --untracked-files=all | sed -E 's/^.. //' | sort > /tmp/actual.txt
sort /tmp/expected.txt -o /tmp/expected.txt
diff -u /tmp/expected.txt /tmp/actual.txt
```

## 7. Wiring is a separate explicit step when needed

Materializing binaries does not automatically authorize code mappings.

For systems such as subclass artwork:

1. first materialize/verify approved binary files;
2. then use a second exact-head guarded code/docs runner or bounded GitHub commit to wire only approved asset mappings;
3. preserve fallbacks for unfinished content;
4. update validators/checklists/handoff docs;
5. run semantic validators before pushing the wiring commit.

This two-stage pattern was used on 2026-09-13 for the normalized subclass tarot deck.

## 8. Publication and Vercel verification

After the target branch is pushed:

1. re-fetch the real target branch/PR through GitHub;
2. confirm the new head parent is the expected prior target head;
3. inspect the exact file boundary;
4. inspect relevant GitHub Actions checks;
5. use the **Vercel connector** to list DNDNext deployments;
6. find the deployment whose metadata exactly matches the new Git SHA and target branch;
7. wait for `READY`;
8. inspect Vercel build logs if it fails;
9. fetch the protected preview through Vercel tooling when an HTTP/browser smoke check is required.

Only then call the binary install complete.

## 9. Supabase and protected boundaries

A binary artwork transfer must not become a reason to alter unrelated systems.

- No Supabase writes for presentation-only artwork transport.
- Read Supabase only when verifying catalogue naming/authority.
- No world-map changes unless Paul explicitly requests them.
- Never mix world-map and town/city-map behavior.
- No crafting, inventory, merchant, encounter, tactical, travel, economy, or character-rule changes during pure artwork transport.

## 10. Failure policy

If any exact-head, checksum, manifest, MIME, dimension, count, changed-path, validator, CI, or deployment check fails:

- stop;
- do not force the target branch forward;
- diagnose on a bounded scratch/preview branch;
- obtain a fresh Dropbox URL if a single-use link was consumed/expired;
- never substitute a different image to make the pipeline pass;
- never report success based solely on local/scratch state.

## Standing reminder

Before saying repository/binary write access is unavailable, read:

- `docs/DNDNext_Current_Handoff_Prompt.md`
- `docs/REPO_ACCESS_STANDING_RULE.md`
- `docs/CHATGPT_REPO_WRITE_PROCEDURE.md`
- this runbook

Then check GitHub + Dropbox + GitHub Actions + Vercel. This route is already proven.
