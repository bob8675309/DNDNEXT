#!/usr/bin/env bash
# Compose the exact owner Story components in an empty disposable checkout.
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
sha=$(git rev-parse HEAD)
destination=$(realpath "$1")
[[ -d "$destination" && -z "$(ls -A "$destination")" ]]
[[ "$destination" != "$repo" && "$destination" != "$repo/"* ]]
patch=scripts/integration/i2j/clean-main/forge-story-components.patch

git -C "$repo" archive "$sha" | tar -x -C "$destination"
cd "$destination"

check_components() {
  local modal=$1 refined=$2 step=$3
  [[ "$(git hash-object components/NewNpcModalV3.js)" == "$modal" ]]
  [[ "$(git hash-object components/NewNpcModalV3Refined.js)" == "$refined" ]]
  [[ "$(git hash-object components/NpcForgeStepContent.js)" == "$step" ]]
}

check_components 5b4f3cc4e56a0055b57d7ae792ed77c7d3fdcead 1772c63392532cfde5661d5d7c5a95352bff25e6 c4899549592e898ebbf5f07a9627c9378afec446
git apply --unidiff-zero --check "$patch"
git apply --unidiff-zero "$patch"
check_components 27c8aa95bf95c88adeb80274e7139dbe17270098 3ddcbb6672d9a1655de1bca626317b1bb857bd34 a7b17e898c4634aacb98d33ca1db399039866295

printf '%s\n' "Mounted Forge uses three exact owner I2J component blobs in the disposable tree."
