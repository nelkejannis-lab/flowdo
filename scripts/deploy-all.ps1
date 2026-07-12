# Deploy Mooncrew everywhere: GitHub push, Vercel web, Electron desktop release.
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

Write-Host "=== 3/4 Vercel (Web) ===" -ForegroundColor Cyan
npx vercel deploy --prebuilt --prod

Write-Host "=== 4/4 Electron (Desktop) ===" -ForegroundColor Cyan
npm run electron:build

Write-Host "=== Fertig ===" -ForegroundColor Green
