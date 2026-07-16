# NOVAT

Work organizer: tasks, calendar, Kanban boards, work time, team chat, AI scheduling, meetings, Instagram metrics, Second Brain — as PWA and Electron desktop app.

**Production:** [novat.app](https://novat.app) *(domain unchanged; product display name is NOVAT)*

## Tech Stack

- React 18 + TypeScript + Vite + Tailwind
- Zustand (state), Supabase (auth, DB, realtime, storage, edge functions)
- i18n (de/en), PWA, Electron desktop

## Setup

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

Without Supabase env vars the app runs in **local-only mode** (localStorage).

## Supabase

1. Create a Supabase project
2. Run SQL from `supabase/schema.sql` and subsequent files (or `supabase/migrations/`)
3. Deploy edge functions: `npx supabase functions deploy`
4. Set secrets: `ANTHROPIC_API_KEY`, `OAUTH_STATE_SECRET`, OAuth provider keys, Instagram keys

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run electron:dev` | Desktop dev |
| `npm run electron:build` | Desktop installer |
| `.\scripts\deploy-all.ps1` | Push + Vercel + Electron |

## Deploy

- **Web:** Vercel — prefer `npx vercel deploy --prebuilt --prod` after `npm run build`, or `.\scripts\deploy-all.ps1`
- **Desktop:** GitHub Releases via electron-builder (`npm run electron:build`)
- **CI:** Workflow template is `scripts/github-deploy-workflow.yml`. Enabling `.github/workflows/deploy.yml` requires a token with **workflow** scope — see [docs/DEPLOY-SECRETS.md](docs/DEPLOY-SECRETS.md).

### Cache / fresh builds after deploy

- **PWA:** `vite-plugin-pwa` with update toast (`src/pwa.ts`); SW checks on focus / hourly; outdated caches cleaned
- **Vercel:** `index.html` + `sw.js` are `no-cache`; hashed `/assets/*` are immutable
- **Electron:** no PWA SW in desktop builds; startup clears service worker + HTTP cache; `loadURL` includes `?v=<appVersion>`

## Security notes

- AI calls go through authenticated Supabase Edge Functions
- OAuth state is HMAC-signed
- Storage files are scoped per user (`{userId}/…`)
- Social/calendar tokens are not readable from the client
