param(
  [string]$BlenderPath = "",
  [string]$OutputDir = "build/sprites/dawn-whiteflame",
  [switch]$SkipRender
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

function Resolve-BlenderPath {
  param([string]$Explicit)
  if ($Explicit) {
    if (-not (Test-Path $Explicit)) { throw "Blender executable not found: $Explicit" }
    return (Resolve-Path $Explicit).Path
  }

  $command = Get-Command blender.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $roots = @(
    (Join-Path $env:ProgramFiles "Blender Foundation"),
    (Join-Path ${env:ProgramFiles(x86)} "Blender Foundation")
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($root in $roots) {
    $candidate = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "blender.exe" } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1
    if ($candidate) { return $candidate }
  }

  throw "Blender 4.2+ was not found. Pass -BlenderPath 'C:\Path\To\blender.exe'."
}

function Copy-LatestBlenderCrash {
  if (-not $script:ResolvedOutput) { return }
  $latest = Get-ChildItem $env:TEMP -Filter "*.crash.txt" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) { return }
  $destination = Join-Path $script:ResolvedOutput "blender-last-crash.txt"
  Copy-Item $latest.FullName $destination -Force
  Write-Host "Blender crash report copied to: $destination" -ForegroundColor Yellow
}

function Invoke-BlenderStep {
  param(
    [string]$Label,
    [string[]]$Arguments,
    [int]$MaxAttempts = 1,
    [int[]]$RetryExitCodes = @()
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    $suffix = if ($MaxAttempts -gt 1) { " (attempt $attempt of $MaxAttempts)" } else { "" }
    Write-Host "`n== $Label$suffix ==" -ForegroundColor Cyan
    $allArguments = @($script:SafeBlenderArgs) + @($Arguments)
    & $script:Blender @allArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) { return }

    if ($exitCode -eq 11) { Copy-LatestBlenderCrash }
    $canRetry = $attempt -lt $MaxAttempts -and $RetryExitCodes -contains $exitCode
    if ($canRetry) {
      Write-Host "$Label hit native Blender exit code $exitCode; retrying only this isolated cell in a fresh Blender process." -ForegroundColor Yellow
      continue
    }

    throw "$Label failed with exit code $exitCode"
  }
}

$Blender = Resolve-BlenderPath $BlenderPath
$SafeBlenderArgs = @(
  "--factory-startup",
  "--gpu-backend", "opengl",
  "--debug-gpu-force-workarounds"
)
$ResolvedOutput = Join-Path $RepoRoot $OutputDir
$BlendPath = Join-Path $ResolvedOutput "dawn_whiteflame_model.blend"
$Manifest = Join-Path $RepoRoot "tools/blender/manifests/dawn_whiteflame.sprite.json"
$Builder = Join-Path $RepoRoot "tools/blender/dndnext_dawn_model_builder.py"
$Refinement = Join-Path $RepoRoot "tools/blender/dndnext_dawn_visual_refinement_v3.py"
$Prepare = Join-Path $RepoRoot "tools/blender/dndnext_dawn_prepare_scene.py"
$Exporter = Join-Path $RepoRoot "tools/blender/dndnext_sprite_export_runner.py"
$CellPreparer = Join-Path $RepoRoot "tools/blender/dndnext_sprite_prepare_isolated_cell.py"
$FrameAssembler = Join-Path $RepoRoot "tools/blender/dndnext_sprite_assemble_isolated_frames.py"
$ProbePrefix = Join-Path $ResolvedOutput "render-probe-"
$FramesDir = Join-Path $ResolvedOutput "frames"
$CellBlendDir = Join-Path $ResolvedOutput "isolated-cell-blends"
$AtlasPath = Join-Path $ResolvedOutput "dawn-whiteflame.png"
$QaReportPath = Join-Path $ResolvedOutput "dawn-whiteflame.qa.json"
$QaPreviewPath = Join-Path $ResolvedOutput "dawn-whiteflame.qa.html"
$MetadataPath = Join-Path $ResolvedOutput "dawn-whiteflame.metadata.json"
$DirectionKeys = @("down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right")
$FrameLabels = @("idle", "walk-a", "walk-b", "walk-c")

New-Item -ItemType Directory -Path $ResolvedOutput -Force | Out-Null

Invoke-BlenderStep "Build rigged Dawn prototype" @(
  "--background",
  "--python", $Builder,
  "--",
  "--output", $BlendPath
)

Invoke-BlenderStep "Apply Dawn humanoid refinement v3" @(
  "--background", $BlendPath,
  "--python", $Refinement,
  "--",
  "--output", $BlendPath
)

Invoke-BlenderStep "Prepare Cycles CPU sprite scene" @(
  "--background", $BlendPath,
  "--python", $Prepare,
  "--",
  "--manifest", $Manifest,
  "--output", $BlendPath
)

Invoke-BlenderStep "Validate exporter hierarchy" @(
  "--background", $BlendPath,
  "--python", $Exporter,
  "--",
  "--manifest", $Manifest,
  "--output-dir", $ResolvedOutput,
  "--dry-run"
)

if (-not $SkipRender) {
  Invoke-BlenderStep "Probe first Cycles CPU frame" @(
    "--background", $BlendPath,
    "--render-output", $ProbePrefix,
    "--render-format", "PNG",
    "--render-frame", "1"
  )

  Get-ChildItem $ResolvedOutput -Filter "render-probe-*.png" -File -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

  foreach ($directory in @($FramesDir, $CellBlendDir)) {
    if (Test-Path $directory) { Remove-Item $directory -Recurse -Force }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
  foreach ($generatedArtifact in @($AtlasPath, $QaReportPath, $QaPreviewPath, $MetadataPath)) {
    Remove-Item $generatedArtifact -Force -ErrorAction SilentlyContinue
  }

  try {
    for ($rowIndex = 0; $rowIndex -lt $DirectionKeys.Count; $rowIndex += 1) {
      for ($columnIndex = 0; $columnIndex -lt $FrameLabels.Count; $columnIndex += 1) {
        $cellStem = "row-{0:D2}_{1}_col-{2:D2}_{3}" -f ($rowIndex + 1), $DirectionKeys[$rowIndex], ($columnIndex + 1), $FrameLabels[$columnIndex]
        $cellNumber = ($rowIndex * $FrameLabels.Count) + $columnIndex + 1
        $cellBlendPath = Join-Path $CellBlendDir "$cellStem.blend"
        $framePrefix = Join-Path $FramesDir "$cellStem-"
        $nativeFrame = "${framePrefix}0001.png"
        $finalFrame = Join-Path $FramesDir "$cellStem.png"

        Invoke-BlenderStep -Label "Prepare isolated cell $cellNumber of 32" -Arguments @(
          "--background", $BlendPath,
          "--python", $CellPreparer,
          "--",
          "--manifest", $Manifest,
          "--output-blend", $cellBlendPath,
          "--row-index", "$rowIndex",
          "--column-index", "$columnIndex"
        ) -MaxAttempts 2 -RetryExitCodes @(11)

        Remove-Item $nativeFrame -Force -ErrorAction SilentlyContinue
        Remove-Item $finalFrame -Force -ErrorAction SilentlyContinue
        Invoke-BlenderStep -Label "Render isolated cell $cellNumber of 32" -Arguments @(
          "--background", $cellBlendPath,
          "--render-output", $framePrefix,
          "--render-format", "PNG",
          "--render-frame", "1"
        ) -MaxAttempts 2 -RetryExitCodes @(11)

        if (-not (Test-Path $nativeFrame)) {
          throw "Blender reported success but did not create isolated frame: $nativeFrame"
        }
        Move-Item $nativeFrame $finalFrame -Force
        Remove-Item $cellBlendPath -Force -ErrorAction SilentlyContinue
        Remove-Item "${cellBlendPath}1" -Force -ErrorAction SilentlyContinue
      }
    }

    Invoke-BlenderStep "Assemble isolated frames and run QA" @(
      "--background",
      "--python", $FrameAssembler,
      "--",
      "--manifest", $Manifest,
      "--output-dir", $ResolvedOutput
    )
  }
  finally {
    if (Test-Path $CellBlendDir) { Remove-Item $CellBlendDir -Recurse -Force }
  }
}

Write-Host "`nDawn Whiteflame build completed." -ForegroundColor Green
Write-Host "Blend: $BlendPath"
if (-not $SkipRender) {
  Write-Host "Atlas: $(Join-Path $ResolvedOutput 'dawn-whiteflame.png')"
  Write-Host "QA preview: $(Join-Path $ResolvedOutput 'dawn-whiteflame.qa.html')"
  Write-Host "Open the QA preview, then test the atlas at /admin/sprite-lab."
}
