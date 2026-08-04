param(
  [string]$BlenderPath = "",
  [string]$OutputDir = "build/sprites/dawn-whiteflame",
  [string]$ArtifactBranch = "sprite-review/dawn-whiteflame",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$BuildScript = Join-Path $PSScriptRoot "build_dawn_whiteflame.ps1"
$ResolvedOutput = Join-Path $RepoRoot $OutputDir
$QaPath = Join-Path $ResolvedOutput "dawn-whiteflame.qa.json"
$Worktree = Join-Path $RepoRoot ".sprite-review-worktree"
$ReviewRelative = "sprite-review/dawn-whiteflame/current"
$ReviewTarget = Join-Path $Worktree $ReviewRelative

function Invoke-Git {
  param([string[]]$Arguments, [string]$WorkingDirectory = $RepoRoot, [switch]$AllowFailure)
  & git -C $WorkingDirectory @Arguments
  if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
  return $LASTEXITCODE
}

if (-not $SkipBuild) {
  & $BuildScript -BlenderPath $BlenderPath -OutputDir $OutputDir
  if ($LASTEXITCODE -ne 0) { throw "Dawn build failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path $QaPath)) { throw "QA report not found: $QaPath" }
$Qa = Get-Content $QaPath -Raw | ConvertFrom-Json
if ($Qa.passed -ne $true) { throw "Dawn automatic QA did not pass; review artifacts will not be published." }

$Required = @(
  "dawn_whiteflame_model.blend",
  "dawn-whiteflame.png",
  "dawn-whiteflame.metadata.json",
  "dawn-whiteflame.qa.json",
  "dawn-whiteflame.qa.html",
  "frames"
)
foreach ($Name in $Required) {
  $Path = Join-Path $ResolvedOutput $Name
  if (-not (Test-Path $Path)) { throw "Required review artifact is missing: $Path" }
}

if (Test-Path $Worktree) {
  Invoke-Git @("worktree", "remove", "--force", $Worktree) -AllowFailure | Out-Null
  if (Test-Path $Worktree) { Remove-Item $Worktree -Recurse -Force }
}

try {
  Invoke-Git @("fetch", "origin") | Out-Null
  & git -C $RepoRoot show-ref --verify --quiet "refs/remotes/origin/$ArtifactBranch"
  $RemoteExists = $LASTEXITCODE -eq 0
  if ($RemoteExists) {
    Invoke-Git @("worktree", "add", "--force", "-B", $ArtifactBranch, $Worktree, "origin/$ArtifactBranch") | Out-Null
  } else {
    Invoke-Git @("worktree", "add", "--force", "-b", $ArtifactBranch, $Worktree, "HEAD") | Out-Null
  }

  if (Test-Path $ReviewTarget) { Remove-Item $ReviewTarget -Recurse -Force }
  New-Item -ItemType Directory -Path $ReviewTarget -Force | Out-Null

  foreach ($Name in $Required) {
    Copy-Item (Join-Path $ResolvedOutput $Name) (Join-Path $ReviewTarget $Name) -Recurse -Force
  }

  $SourceCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
  $SourceBranch = (& git -C $RepoRoot branch --show-current).Trim()
  $PublishInfo = [ordered]@{
    schemaVersion = 1
    character = "Dawn Whiteflame"
    publishedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    sourceCommit = $SourceCommit
    sourceBranch = $SourceBranch
    artifactBranch = $ArtifactBranch
    automaticQaPassed = $true
    atlas = "dawn-whiteflame.png"
    blend = "dawn_whiteflame_model.blend"
  }
  $PublishInfo | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $ReviewTarget "publish.json") -Encoding utf8

  Invoke-Git @("add", "--all", "--", $ReviewRelative) -WorkingDirectory $Worktree | Out-Null
  & git -C $Worktree diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Dawn review artifacts are unchanged; nothing to publish." -ForegroundColor Yellow
  } else {
    Invoke-Git @("commit", "-m", "Update Dawn Whiteflame review artifacts") -WorkingDirectory $Worktree | Out-Null
    Invoke-Git @("push", "--force-with-lease", "-u", "origin", $ArtifactBranch) -WorkingDirectory $Worktree | Out-Null
    Write-Host "Published Dawn review artifacts to origin/$ArtifactBranch" -ForegroundColor Green
    Write-Host "Review path: $ReviewRelative"
    Write-Host "Source commit: $SourceCommit"
  }
} finally {
  if (Test-Path $Worktree) {
    Invoke-Git @("worktree", "remove", "--force", $Worktree) -AllowFailure | Out-Null
  }
}
