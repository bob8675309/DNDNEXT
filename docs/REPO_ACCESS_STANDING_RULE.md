# DNDNext Repository Access — Standing Rule

This is a persistent operational rule for all future DNDNext work.

## Never claim repository access is unavailable before checking the established path

The normal DNDNext write/validation path is:

1. Use the connected GitHub API/tools to inspect repositories, branches, PRs, commits, diffs, files, and workflow state.
2. Use GitHub file/branch/ref actions for ordinary source and documentation changes.
3. When work needs a real checkout, filesystem operations, binary materialization, builds, validators, image reconstruction, or other shell tooling, use a GitHub Actions workflow on a bounded scratch/staging branch.
4. The Actions runner may check out the repository, run normal `git`, Node, Python, build/validation commands, create binary assets, commit them, and `git push` the resulting commit back to the intended branch.
5. Re-read the resulting branch/commit/workflow state through GitHub before treating the change as accepted.
6. Only advance the real working/PR branch after the scratch/staging result is verified.

Conceptually:

`ChatGPT -> GitHub API -> branch/commit/files`

and when a full working tree is required:

`ChatGPT -> GitHub API -> GitHub Actions runner -> checkout -> modify/test/build -> git commit/push -> GitHub API verification`

## Binary asset rule

Binary artwork is not evidence that repo access is unavailable. If a direct connector write is unsuitable for raw bytes, use the established scratch-branch + GitHub Actions materialization path. Verify exact bytes/Git blob SHA before attaching new artwork to the production PR branch.

Do not silently substitute older reachable blobs, regenerate already-approved art, or claim a binary install succeeded without checksum/blob verification.

## Safety boundaries

- Do not touch `main` or an active PR branch merely to experiment.
- Use a scratch/staging branch for risky transfer/materialization work.
- Prefer fast-forward branch movement after verification; never force-move an accepted branch unless explicitly authorized.
- Re-check the exact remote head before writing or validating.
- Preserve the standing DNDNext rule that world-map and town/city-map behavior are separate, and do not touch the world map unless Paul explicitly requests it.

## Why this file exists

This path has been used repeatedly on DNDNext. Future sessions must not fall back to saying "I cannot push/pull the repo" without first checking the GitHub connector/API and GitHub Actions route described above.
