# WhatsApp Sandbox — verbindliche Schritte (+4916093865193)

NOVAT nutzt aktuell die **Twilio WhatsApp Sandbox**. Die App kann das Sandbox-Limit **nicht umgehen**. Ohne erfolgreichen Join blockiert Twilio Nachrichten (inkl. OTP).

## Live-Diagnose (2026-07-16)

| Check | Ergebnis |
|---|---|
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (= **+1 415 523 8886**) |
| Sandbox-Modus | an |
| `TWILIO_SANDBOX_JOIN_CODE` | **nicht gesetzt** (API liefert keinen Keyword) |
| Outbound an `+4916093865193` | **failed / error 63015** (Nummer nicht in der Sandbox) |
| Inbound Historie | bis ~13.07. aktiv — Sandbox-Fenster (~72 h) ist abgelaufen |

Twilio-Fehler **63015** = Channel Sandbox darf nur an Nummern senden, die dem Sandbox mit dem **Join-Befehl dieses Accounts** beigetreten sind.

## Exakte Schritte (Handy)

1. **WhatsApp** → Chat mit genau **`+1 415 523 8886`**  
   Deep Link: https://wa.me/14155238886
2. Den **exakten** Join-Befehl dieses Twilio-Accounts senden  
   (Twilio Console → Messaging → Try it out → WhatsApp → Sandbox, z. B. `join yellow-tiger`).
3. Auf die **Twilio-Bestätigung** warten.
4. **Prüfen:** Die Warnung `is not connected to a Sandbox` darf danach **nicht** mehr kommen.
5. Erst dann in NOVAT (**Einstellungen → Verbindungen**): NOVAT-Code **oder** Handynummer + OTP.

## Join-Code für alle Nutzer hinterlegen (Admin)

1. Code aus der Twilio Console kopieren.
2. In NOVAT als Admin unter Verbindungen eintragen → **Für alle speichern**, **oder**
3. Render-Env: `TWILIO_SANDBOX_JOIN_CODE=join dein-schlüsselwort`, **oder**
4. `POST /admin/setup-whatsapp-sandbox` mit Header `x-admin-secret`.

Danach zeigt die App den Befehl groß zum Kopieren und einen `wa.me`-Link mit vorausgefülltem Text.

## Warum OTP vorher scheitert

Outbound von nova-server an eine Nummer außerhalb der Sandbox endet mit **63015 / undelivered**. Join muss **zuerst inbound** vom Handy kommen. Alle ~72 Stunden erneut.
