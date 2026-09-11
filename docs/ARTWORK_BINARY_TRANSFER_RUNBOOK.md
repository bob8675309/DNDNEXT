# DNDNext Artwork Binary Transfer Runbook

Status date: 2026-09-05

Use this runbook whenever approved/generated binary artwork must be installed into a DNDNext GitHub branch and the connector does not provide a byte-preserving direct file upload.

## Preferred route

`approved local bytes -> ZIP -> Dropbox /DNDNext-Transfer -> one-shot GitHub Actions scratch branch -> exact-head checkout/guard -> checksum/MIME/dimension verification -> exact diff guard -> bot commit -> push intended PR branch -> GitHub/CI/Vercel verification`

This path successfully installed the approved Character Forge Species artwork on 2026-09-05. It is the default artwork-transfer path. Do not spend another session rediscovering giant base64 Git-blob transport while this bridge is available.

## 1. Freeze the intended repository baseline

Before transfer:

1. Read the active PR and exact remote head from GitHub.
2. Confirm the target branch name.
3. Confirm the expected changed-file list.
4. Do not start from an older screenshot SHA or a remembered local SHA.
5. Never use `main` as a transfer scratchpad.

The one-shot workflow must later abort if the target branch is no longer at this exact head.

## 2. Prepare final binary assets locally

- Convert/export the exact user-approved artwork into the repository's intended final format.
- Do not reduce quality merely to make transfer easier.
- Do not regenerate already-approved artwork during transport.
- Record the expected dimensions and MIME type.
- Compute SHA-256 for every file.

Create one ZIP containing only the intended transfer payload. Compute SHA-256 for the ZIP as well.

Keep a manifest similar to:

```text
<sha256>  cinematic-example-a.webp
<sha256>  cinematic-example-b.webp
```

## 3. Upload the ZIP to Dropbox

Use the connected Dropbox tool and save the ZIP under:

`/DNDNext-Transfer/`

Use a unique descriptive filename. Verify Dropbox reports the upload completed before proceeding.

When the workflow is ready to run, obtain a Dropbox download URL. If the connector supplies a single-use temporary URL, do not preflight, preview, HEAD, or otherwise consume it before GitHub Actions does the real GET.

## 4. Create a bounded scratch branch

Create a new scratch branch from the current accepted target-branch head. Example naming:

`agent/species-corrections-transfer-YYYYMMDD`

Only the transfer workflow belongs on this scratch branch. The workflow itself should not be copied into the working PR branch.

## 5. One-shot workflow contract

The workflow should:

1. Trigger only on the scratch branch/workflow path.
2. Use `permissions: contents: write`.
3. Check out the **real intended target branch**, not the scratch branch, with full enough history to push.
4. Guard the exact expected target SHA:

```bash
test "$(git rev-parse HEAD)" = "<EXPECTED_TARGET_HEAD_SHA>"
```

5. Download the ZIP once.
6. Verify the ZIP SHA-256 before unzipping.
7. Verify every asset SHA-256.
8. Verify MIME type, e.g. `image/webp`.
9. Verify dimensions/format with Pillow or another deterministic validator when relevant.
10. Copy only the explicitly approved repository paths.
11. Compare `git diff --name-only` against an explicit expected-file list and abort on any mismatch.
12. Run any focused validator that can execute safely before publication.
13. Commit as `github-actions[bot]`.
14. Push `HEAD:<intended-working-branch>`.

## 6. Example verification fragments

ZIP:

```bash
echo '<ZIP_SHA256>  /tmp/artwork.zip' | sha256sum -c -
```

Files:

```bash
cd /tmp/artwork
sha256sum -c /tmp/artwork.sha256
for f in *.webp; do
  test "$(file -b --mime-type "$f")" = "image/webp"
done
```

Dimensions with Pillow:

```bash
python -m pip install --disable-pip-version-check pillow==11.3.0
python - <<'PY'
from PIL import Image
from pathlib import Path
for path in Path('/tmp/artwork').glob('*.webp'):
    with Image.open(path) as image:
        assert image.format == 'WEBP', (path, image.format)
        assert image.size == (720, 960), (path, image.size)
PY
```

Exact diff guard:

```bash
git diff --name-only | sort > /tmp/actual.txt
sort /tmp/expected.txt -o /tmp/expected.txt
diff -u /tmp/expected.txt /tmp/actual.txt
```

## 7. Publication verification

After the workflow pushes:

1. Re-read the PR head from GitHub.
2. Fetch the generated commit and confirm its parent is the expected baseline.
3. Confirm the commit's file list is exactly the expected boundary.
4. Confirm no protected-system file changed.
5. Wait for the relevant GitHub Actions validation gates.
6. Find the Vercel deployment for the exact new head and confirm it reaches READY.
7. Inspect build logs if Vercel or CI fails.
8. Only then report the artwork as pushed/accepted.

## 8. Protected DNDNext boundaries

Artwork transport must not become an excuse to touch unrelated runtime systems.

- No world-map code unless Paul explicitly requests it.
- Keep world-map and town/city-map behavior separate.
- No Supabase writes unless the task actually requires a data change and it has been separately reviewed.
- No Character Forge mechanics, hooks, state variables, persistence fields, or props should change for a pure artwork transfer.
- Preserve existing profile portraits unless the task explicitly targets them.

## 9. Failure policy

If any checksum, MIME, dimension, exact-head guard, expected-diff guard, validator, CI job, or deployment fails:

- stop;
- do not advance/force-move the accepted branch;
- diagnose on the scratch branch;
- never substitute a different image simply because it is easier to transfer;
- never claim success from the local/staging state alone.

## Standing reminder

Before saying repository/binary write access is unavailable, read:

- `docs/REPO_ACCESS_STANDING_RULE.md`
- this runbook

Then check GitHub + Dropbox + GitHub Actions. This route is established DNDNext operating procedure.
