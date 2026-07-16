# WhatsApp Sandbox — verbindliche Schritte (+4916093865193)

NOVAT nutzt die **Twilio WhatsApp Sandbox**. Ohne erfolgreichen Join blockiert Twilio Nachrichten (inkl. OTP).

## Aktueller Join-Befehl (Stand 2026-07-16)

| | |
|---|---|
| Nummer | **+1 415 523 8886** |
| Text | **`join mice-nervous`** |
| Deep Link | https://wa.me/14155238886?text=join%20mice-nervous |

Quelle: Vault (`Life OS.md`, 2026-07-11) + live in `nova_server_secrets` / `GET /api/whatsapp/connect-info`.

Wenn Twilio **„Failed to join sandbox“** antwortet, war das Schlüsselwort falsch (oft nur `join` oder ein Docs-Beispiel). Nie nur `join` senden.

## Handy-Schritte

1. WhatsApp → Chat mit **+1 415 523 8886**
2. Exakt senden: `join mice-nervous`
3. Auf Bestätigung warten (kein gelber Warnhinweis mehr)
4. In NOVAT → Einstellungen → Verbindungen: NOVAT-Code **oder** Nummer + OTP

Freischaltung gilt ~72 Stunden.

## Admin / Server

- Render-Env: `TWILIO_SANDBOX_JOIN_CODE=join mice-nervous` (optional, hat Vorrang), **oder**
- Admin in NOVAT: „Für alle speichern“, **oder**
- `POST /admin/setup-whatsapp-sandbox` mit `x-admin-secret`

Twilio API liefert das Keyword **nicht** — bei Sandbox-Reset in der Console den neuen Code prüfen und erneut speichern.
