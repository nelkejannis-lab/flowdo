/** Map technical / English API errors to short German (or EN) user copy. */

function isGermanUi(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.language.toLowerCase().startsWith('de')
}

function rawText(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

type Pair = { de: string; en: string; test: RegExp }

const MAP: Pair[] = [
  {
    test: /failed to fetch|networkerror|load failed|network request failed|fetch failed|ECONNREFUSED|ENOTFOUND/i,
    de: 'Verbindung fehlgeschlagen. Prüfe Internet und ob du angemeldet bist.',
    en: 'Connection failed. Check your internet and that you are signed in.',
  },
  {
    test: /Invalid login credentials|invalid.*(email|password)|wrong password/i,
    de: 'E-Mail oder Passwort ist falsch.',
    en: 'Email or password is incorrect.',
  },
  {
    test: /Email not confirmed|email.*not.*confirm/i,
    de: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
    en: 'Please confirm your email address first.',
  },
  {
    test: /User already registered|already been registered|already exists/i,
    de: 'Diese E-Mail ist bereits registriert.',
    en: 'This email is already registered.',
  },
  {
    test: /JWT expired|session.*expired|refresh_token|Invalid Refresh Token|not authenticated|Auth session missing/i,
    de: 'Sitzung abgelaufen. Bitte erneut anmelden.',
    en: 'Session expired. Please sign in again.',
  },
  {
    test: /Failed to join sandbox|failed to join|try again later by sending join/i,
    de: 'Join fehlgeschlagen — falsches Schlüsselwort. Sende genau den Befehl aus den Einstellungen an +1 415 523 8886 (nicht nur „join“).',
    en: 'Join failed — wrong keyword. Send exactly the command from Settings to +1 415 523 8886 (not just “join”).',
  },
  {
    test: /63015|63016|not connected to a Sandbox|Channel Sandbox/i,
    de: 'WhatsApp ist noch nicht freigeschaltet. Sende zuerst den join-Befehl an +1 415 523 8886 und warte auf die Bestätigung.',
    en: 'WhatsApp is not unlocked yet. First send the join command to +1 415 523 8886 and wait for confirmation.',
  },
  {
    test: /sandboxJoinCode|Join-Code fehlt|join-Befehl fehlt|join command is not set/i,
    de: 'Der Join-Befehl fehlt noch. Admin: in den Einstellungen hinterlegen oder auf dem Server setzen.',
    en: 'The join command is missing. Admin: save it in Settings or on the server.',
  },
  {
    test: /token.*(expired|invalid|revoked)|invalid_grant|consent_required|unauthorized.*calendar|401.*calendar/i,
    de: 'Kalender-Verbindung abgelaufen. Bitte unter Einstellungen neu verbinden.',
    en: 'Calendar connection expired. Please reconnect in Settings.',
  },
  {
    test: /rate.?limit|too many requests|429/i,
    de: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
    en: 'Too many requests. Please wait a moment and try again.',
  },
  {
    test: /calendar.*(sync|fetch).*fail|ICS.*(fail|invalid)|webcal/i,
    de: 'Kalender konnte nicht synchronisiert werden. Prüfe den Link und die Internetverbindung.',
    en: 'Calendar could not be synced. Check the link and your internet connection.',
  },
  {
    test: /Supabase.*(nicht|not).*konfigur|not configured/i,
    de: 'Dienst ist nicht konfiguriert. Bitte später erneut versuchen.',
    en: 'Service is not configured. Please try again later.',
  },
  {
    test: /Twilio nicht konfiguriert|Server nicht konfiguriert \(Twilio\)/i,
    de: 'WhatsApp-Dienst ist gerade nicht verfügbar. Bitte später erneut versuchen.',
    en: 'WhatsApp service is temporarily unavailable. Please try again later.',
  },
]

/**
 * Prefer a short, friendly message. Known German server copy is kept as-is
 * when it already looks user-facing (no English Twilio walls / error codes).
 */
export function friendlyUserError(
  err: unknown,
  fallbackDe = 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
  fallbackEn = 'Something went wrong. Please try again.',
): string {
  const raw = rawText(err).trim()
  const de = isGermanUi()

  for (const row of MAP) {
    if (row.test.test(raw)) return de ? row.de : row.en
  }

  // Already short German / user-facing (e.g. from nova-server)
  if (raw && !/sandbox|6301[56]|Channel|Twilio Error|Error Code/i.test(raw) && raw.length < 220) {
    return raw
  }

  return de ? fallbackDe : fallbackEn
}

/** Map a list of calendar sync error strings. */
export function friendlyCalendarErrors(errors: string[]): string[] {
  return errors.map((e) => friendlyUserError(e, 'Kalender-Synchronisation fehlgeschlagen.', 'Calendar sync failed.'))
}
