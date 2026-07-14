# Mooncrew (Flowdo)

Work organizer: tasks, calendar, Kanban boards, work time, team chat, AI scheduling, meetings, Instagram metrics, Second Brain — as PWA and Electron desktop app.

**Production:** [mooncrew.app](https://mooncrew.app)

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

- **Web:** Vercel (auto on push to `master`, or `npx vercel deploy --prod`)
- **Desktop:** GitHub Releases via electron-builder (`npm run electron:build`)

## Security notes

- AI calls go through authenticated Supabase Edge Functions
- OAuth state is HMAC-signed
- Storage files are scoped per user (`{userId}/…`)
- Social/calendar tokens are not readable from the client
