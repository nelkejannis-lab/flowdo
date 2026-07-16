# Automatic deploy / release (pending GitHub `workflow` scope)

The production workflow lives at `.github/workflows/deploy.yml.local`.
Rename to `deploy.yml` and push once the GitHub token has **workflow** scope
(Settings → Developer settings → Personal access tokens → enable `workflow`).

## Required GitHub Actions secrets (repo `nelkejannis-lab/flowdo`)

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | `team_zzTrbHJgnYxR6pKuZbEZPHXL` (from `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | `prj_Ezx1GLcLAdmgx5j6NN6wNa1A5uRz` |

Project: **workorganizer** → https://novat.app

## What it does on push to `master`

1. `npm ci` → lint → test → build
2. Deploy to Vercel production (skips with warning if secrets missing)
3. If no GitHub release exists for `package.json` version → Windows Electron build + `gh release create` with `NOVAT-Setup-x.x.x.exe`

Manual: Actions → Deploy → Run workflow.
