# Deploy NOVAT everywhere: GitHub push, Vercel web, Electron desktop release.
# Run from repo root: .\scripts\deploy-all.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== 1/4 Lint, Test & Build ===" -ForegroundColor Cyan
npm run lint
npm test
npm run build

Write-Host "=== 2/4 Git push ===" -ForegroundColor Cyan
git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}
git push origin master

Write-Host "=== 3/4 Vercel (Web) — fresh build, never stale .vercel/output ===" -ForegroundColor Cyan
if (Test-Path .vercel/output) {
  Remove-Item -Recurse -Force .vercel/output
}
npx vercel pull --yes --environment=production
# vercel pull may write VITE_* as literal "[SENSITIVE]" — unusable for Vite builds.
$envLocal = ".vercel/.env.production.local"
if (Test-Path $envLocal) {
  $raw = Get-Content $envLocal -Raw
  if ($raw -match 'VITE_SUPABASE_URL="?\[SENSITIVE\]"?') {
    Write-Host "Repairing redacted VITE_SUPABASE_* from src/config/supabasePublic.ts" -ForegroundColor Yellow
    $pub = Get-Content "src/config/supabasePublic.ts" -Raw
    if ($pub -notmatch "url:\s*'([^']+)'") { throw "supabasePublic url missing" }
    $url = $Matches[1]
    if ($pub -notmatch "anonKey:\s*'([^']+)'") { throw "supabasePublic anonKey missing" }
    $key = $Matches[1]
    $fixed = Get-Content $envLocal | ForEach-Object {
      if ($_ -match '^VITE_SUPABASE_URL=') { "VITE_SUPABASE_URL=`"$url`"" }
      elseif ($_ -match '^VITE_SUPABASE_ANON_KEY=') { "VITE_SUPABASE_ANON_KEY=`"$key`"" }
      else { $_ }
    }
    Set-Content -Path $envLocal -Value $fixed -Encoding utf8
  }
}
npx vercel build --prod
npx vercel deploy --prebuilt --prod

Write-Host "=== 4/4 Electron (Desktop) ===" -ForegroundColor Cyan
npm run electron:build

Write-Host "=== Fertig ===" -ForegroundColor Green
