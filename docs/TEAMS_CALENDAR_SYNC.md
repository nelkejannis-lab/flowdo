# Microsoft / Outlook calendar (Teams Sync)

## What works

- **Import:** Outlook/Microsoft 365 events → NOVAT (`[Outlook] …`), with stable `external_id` from Graph
- **Push create:** Local `Termin` → Graph event when Outlook is connected; stores returned Graph `id` as `external_id`
- **Push update:** Editing / rescheduling a linked Termin PATCHes the Graph event
- **Push delete:** Deleting a local (non-imported) linked Termin also deletes the Graph event
- **iCal / Google import:** Still import-only; also persist `external_id` (Google event id / iCal UID) so re-sync stays stable
- Auth/token failures surface **German** messages (reconnect / Calendars.ReadWrite)

## Azure app permissions (required)

In Azure Portal → App registrations → your NOVAT Microsoft app → **API permissions**:

| Permission | Type | Notes |
|------------|------|--------|
| `Calendars.ReadWrite` | **Delegated** (Microsoft Graph) | Read + create/update/delete events |
| `offline_access` | Delegated | Refresh tokens for sync/push |
| `User.Read` | Delegated | Optional; used to show connected email |

Grant **admin consent** if your tenant requires it. Users must re-connect Outlook in NOVAT after permission changes (Settings → Verbindungen).

Redirect URI:

`https://<SUPABASE_PROJECT>.supabase.co/functions/v1/calendar-oauth-callback`

Supabase secrets: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.

## Remaining gaps (MVP)

- No Google Calendar **push** (import only)
- No conflict resolution if the same event is edited in both apps between syncs
- Imported `[Outlook]` rows are not deleted in Graph when removed in NOVAT (local push-linked Termine are)
- Recurring series: each occurrence is pushed as its own Graph event
- Teams meeting auto-join URL only when the user provides a meeting link
