# WhatsApp Sandbox — verbindliche Schritte (+4916093865193)

NOVAT nutzt aktuell die **Twilio WhatsApp Sandbox**. Die App kann das Sandbox-Limit **nicht umgehen**. Ohne erfolgreichen Join blockiert Twilio Nachrichten (inkl. OTP).

## Live-Config (nova-server)

| Setting | Wert |
|---|---|
| Bot / From | `whatsapp:+14155238886` (= **+1 415 523 8886**) |
| Sandbox-Modus | an |
| `TWILIO_SANDBOX_JOIN_CODE` | oft noch **leer** → Admin muss den Befehl aus der Twilio Console setzen |

`GET https://nova-server-rpbi.onrender.com/api/whatsapp/connect-info` zeigt `sandboxJoinCode` und `joinConfigured`.

## Exakte Schritte (Handy)

1. **WhatsApp öffnen** und einen Chat mit genau **`+1 415 523 8886`** starten  
   (Deep Link: `https://wa.me/14155238886`).
2. Den **exakten** Join-Befehl senden, z. B. `join yellow-tiger`  
   (dein persönlicher Code steht in der Twilio Console → Messaging → Try it out → WhatsApp → Sandbox).
3. **Warten** auf die Twilio-Bestätigung im selben Chat.
4. **Prüfen:** Die gelbe Warnung  
   `Your number … is not connected to a Sandbox`  
   darf danach **nicht** mehr kommen.
5. Erst dann in NOVAT (**Einstellungen → Verbindungen**):
   - NOVAT-Code senden **oder**
   - Handynummer + OTP.

## Join-Code für alle Nutzer hinterlegen (Admin)

1. Code aus der Twilio Console kopieren.
2. In NOVAT als Admin unter Verbindungen eintragen → **Für alle speichern**, **oder**
3. Render-Env: `TWILIO_SANDBOX_JOIN_CODE=join dein-schlüsselwort`, **oder**
4. `POST /admin/setup-whatsapp-sandbox` mit Header `x-admin-secret` und Body  
   `{ "sandboxJoinCode": "join dein-schlüsselwort" }`.

Danach zeigt die App den Befehl groß zum Kopieren und einen `wa.me`-Link mit vorausgefülltem Text.

## Warum OTP vorher scheitert

Outbound von nova-server an eine Nummer, die **nicht** in **dieser** Sandbox ist, liefert Twilio Fehler / undelivered. Join muss **zuerst inbound** vom Handy kommen.
