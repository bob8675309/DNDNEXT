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
    [string[]]$Arguments
  )
  Write-Host "`n== $Label ==" -ForegroundColor Cyan
  $allArguments = @($script:SafeBlenderArgs) + @($Arguments)
  & $script:Blender @allArguments
  if ($LASTEXITCODE -ne 0) {
    Copy-LatestBlenderCrash
    throw "$Label failed with exit code $LASTEXITCODE"
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
$Refinement = Join-Path $RepoRoot "tools/blender/dndnext_dawn_visual_refinement_v2.py"
$Prepare = Join-Path $RepoRoot "tools/blender/dndnext_dawn_prepare_scene.py"
$ExporterCore = Join-Path $RepoRoot "tools/blender/dndnext_sprite_export.py"
$Exporter = Join-Path $RepoRoot "tools/blender/dndnext_sprite_export_runner.py"
$ProbePrefix = Join-Path $ResolvedOutput "render-probe-"

New-Item -ItemType Directory -Path $ResolvedOutput -Force | Out-Null

Invoke-BlenderStep "Build rigged Dawn prototype" @(
  "--background",
  "--python", $Builder,
  "--",
  "--output", $BlendPath
)

Invoke-BlenderStep "Apply Dawn visual refinement v2" @(
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

  Invoke-BlenderStep "Render 32 frames and assemble atlas" @(
    "--background", $BlendPath,
    "--python", $Exporter,
    "--",
    "--manifest", $Manifest,
    "--output-dir", $ResolvedOutput,
    "--keep-frames"
  )
}

Write-Host "`nDawn Whiteflame build completed." -ForegroundColor Green
Write-Host "Blend: $BlendPath"
if (-not $SkipRender) {
  Write-Host "Atlas: $(Join-Path $ResolvedOutput 'dawn-whiteflame.png')"
  Write-Host "QA preview: $(Join-Path $ResolvedOutput 'dawn-whiteflame.qa.html')"
  Write-Host "Open the QA preview, then test the atlas at /admin/sprite-lab."
}
