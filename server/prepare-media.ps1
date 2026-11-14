# REDVUE starter library preparation for Windows.
# Safe to re-run: creates folders only and doesn't modify or download media.
$root = "C:\REDVUE\Media"
$folders = @(
  "Shows\The Simpsons\Season 01",
  "Shows\Family Guy\Season 01",
  "Shows\South Park\Season 01",
  "Shows\Viva La Bam\Season 01",
  "Music Videos\MTV Chaos",
  "Other Videos\CKY Era",
  "Movies",
  "Test Videos"
)
foreach ($relative in $folders) {
  $path = Join-Path $root $relative
  New-Item -ItemType Directory -Force -Path $path | Out-Null
}
Write-Host ""
Write-Host "REDVUE folders created under $root" -ForegroundColor Green
Write-Host "Put your own playable videos in the correct folders."
Write-Host "Example episode: Shows\The Simpsons\Season 01\The Simpsons - S01E01.mkv"
Write-Host "You can transfer this media structure to the Beelink tomorrow."
