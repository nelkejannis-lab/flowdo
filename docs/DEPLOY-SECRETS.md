# Automatic deploy / release (pending GitHub `workflow` scope)

Tracked template: `scripts/github-deploy-workflow.yml`
Local copy (gitignored `*.local`): `.github/workflows/deploy.yml.local`

Enable CI by copying the template to `.github/workflows/deploy.yml` and pushing
once the GitHub token has **workflow** scope
(Settings → Developer settings → Personal access tokens → enable `workflow`).

Until then, ship web manually (Vercel still works from local/ship commits):

```powershell
npm run build
npx vercel deploy --prebuilt --prod
# or: .\scripts\deploy-all.ps1
```

## Required GitHub Actions secrets (repo `nelkejannis-lab/flowdo`)

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | `team_zzTrbHJgnYxR6pKuZbEZPHXL` (from `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | `prj_Ezx1GLcLAdmgx5j6NN6wNa1A5uRz` |

Project: **workorganizer** → https://novat.app

Optional for builds that need them at compile time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## What it does on push to `master`

1. `npm ci` → lint → test → build
2. Deploy to Vercel production (skips with warning if secrets missing)
3. If no GitHub release exists for `package.json` version → Windows Electron build + `gh release create` with `NOVAT-Setup-x.x.x.exe`

Manual: Actions → Deploy → Run workflow.

## Enable CI (when token has `workflow` scope)

```powershell
Copy-Item scripts/github-deploy-workflow.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "ci: enable Deploy workflow on push to master"
git push origin master
```
