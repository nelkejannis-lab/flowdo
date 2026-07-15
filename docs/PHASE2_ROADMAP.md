# Phase 2 — Implementation Reference

All Phase 2 features have MVP implementations in this codebase:

| Feature | Location | Notes |
|---------|----------|-------|
| Microsoft Teams calendar sync | `calendarConnectionsStore.pushEntryToTeams`, `supabase/functions/calendar-sync` POST | Connect Outlook in Settings → Calendar; push on save |
| Calendar cancellation sync | `supabase/functions/calendar-sync` | Removes imported entries missing from external feed |
| Calendar privacy blur | `utils/calendarPrivacy.ts`, `TeamAvailabilitySidebar`, Settings → Functions | Toggle colleague absences; blur vacation/OOO |
| Department filter | `CalendarPage` team filter dropdown | When enabled in settings |
| Video conference links | `CalendarEntryFormModal` meeting link field, `utils/meetingLink.ts` | Teams/Zoom detection |
| Company join link | `orgJoinStore`, `JoinOrgPage`, Admin → Members | `/join/:token` auto-joins org |
| Admin/external invites | `AdminPage` email invite + company link | mailto with join URL |
| Task time tracking | `taskTimeStore`, `ProjectTimeReport` | Per-task and board totals |
| Required estimates | Settings toggle + `TaskFormModal` validation | Project tasks |
| AI duration learning | `aiDurationStore` | Rolling averages + multiplier |
| Project evaluation | `ProjectEvaluationPanel` on board detail | Estimated vs actual |
| Capacity tracker | `CapacityTracker` on Admin overview | Weekly hours vs contract |
| Meeting Memory (WhatsApp) | `memoryStore`, `MemoryPage`, `MeetingMemoryPanel` | Paste/import notes |
| HR sick mail + stamped docs | `hrNotify`, `stampedDocument`, `StampLog` | Settings HR email |

## Database migrations to apply

Run in Supabase SQL editor:
- `supabase/org_invites.sql` — invite links + memory_items tables

## Future hardening (optional)

- Full Teams colleague directory sync via Graph `/users`
- Bidirectional conflict resolution for calendar sync
- Server-side sick leave email (vs mailto)
- Push notifications for org invites
