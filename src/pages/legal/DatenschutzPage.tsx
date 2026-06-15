import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Datenschutzerklärung</h1>

      <h2 className="mb-2 mt-6 text-base font-semibold">1. Verantwortlicher</h2>
      <p className="mb-4">
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br />
        Janis Nelke<br />
        Milsper Straße 14, 58256 Ennepetal<br />
        E-Mail: jannisnelke1@gmail.com
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">2. Übersicht der Verarbeitungen</h2>
      <p className="mb-4">
        Mooncrew ist eine Aufgaben- und Projektmanagement-Anwendung ("Work Organizer"). Bei der
        Nutzung werden folgende personenbezogene Daten verarbeitet:
      </p>
      <ul className="mb-4 list-disc pl-5">
        <li>Konto- und Profildaten (E-Mail-Adresse, Benutzername, Anzeigename, optionales Profilbild, optionales Geburtsdatum)</li>
        <li>Von Ihnen eingegebene Inhalte (Aufgaben, Projekte/Kampagnen, Kommentare, Tags, Termine, Notizen, Chat-Nachrichten)</li>
        <li>Arbeitszeit- und Kalenderdaten, sofern Sie diese Funktionen nutzen</li>
        <li>Bei Verbindung externer Kalender (Google, Microsoft/Outlook, iCal): Zugriffstoken bzw. Kalenderlink und die daraus importierten Termine</li>
        <li>Technische Daten zur Bereitstellung des Dienstes (z. B. Authentifizierungs-/Sitzungsdaten)</li>
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">3. Hosting und eingesetzte Dienste</h2>
      <p className="mb-2">
        Diese Anwendung wird über folgende technische Dienstleister betrieben, die als
        Auftragsverarbeiter im Sinne von Art. 28 DSGVO fungieren. Mit jedem Dienstleister besteht
        bzw. wird ein Auftragsverarbeitungsvertrag (AVV) abgeschlossen:
      </p>
      <ul className="mb-4 list-disc pl-5">
        <li>
          <strong>Vercel Inc.</strong> – Hosting der Web-Anwendung (Frontend). [Serverstandort/Region prüfen
          und ggf. auf EU-Region konfigurieren; bei Datenübermittlung in die USA: Standardvertragsklauseln (SCC)
          als Übermittlungsgrundlage angeben.]
        </li>
        <li>
          <strong>Supabase Inc.</strong> – Datenbank, Authentifizierung und Dateispeicher (Profilbilder).
          [Projektregion auf "EU" einstellen, sofern noch nicht erfolgt. AVV mit Supabase abschließen.]
        </li>
        <li>
          <strong>KI-Terminvorschläge ("KI-Termine")</strong>: Wenn Sie diese Funktion nutzen, werden die
          von Ihnen eingegebenen Texte zur Verarbeitung an einen KI-Anbieter [Anbieter benennen, z. B.
          OpenAI/Anthropic, inkl. Serverstandort] übermittelt. Nutzen Sie diese Funktion nicht, wenn Sie
          keine personenbezogenen oder vertraulichen Daten an Dritte übermitteln möchten.
        </li>
        <li>
          <strong>Externe Kalenderanbieter</strong> (Google Calendar, Microsoft/Outlook, iCloud): Werden nur
          aktiv, wenn Sie eine Verbindung in den Einstellungen herstellen. Es gelten zusätzlich die
          Datenschutzbestimmungen des jeweiligen Anbieters.
        </li>
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">4. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
      <ul className="mb-4 list-disc pl-5">
        <li>
          <strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> Bereitstellung der
          Kontofunktionen, Speicherung und Anzeige Ihrer Aufgaben, Projekte und Kalenderdaten.
        </li>
        <li>
          <strong>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):</strong> Gewährleistung der
          IT-Sicherheit, Fehleranalyse und Missbrauchsprävention.
        </li>
        <li>
          <strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</strong> Sofern Sie optionale Funktionen
          aktivieren (z. B. KI-Terminvorschläge, externe Kalenderverbindungen, Profilbild-Upload).
          Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen.
        </li>
        <li>
          <strong>Beschäftigungskontext / berechtigtes Interesse des Arbeitgebers (Art. 6 Abs. 1 lit. f
          bzw. § 26 BDSG):</strong> Sofern die Anwendung im unternehmensinternen Kontext zur
          Aufgaben- und Projektorganisation eingesetzt wird.
        </li>
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">5. Cookies und Local Storage</h2>
      <p className="mb-4">
        Diese Anwendung verwendet ausschließlich technisch notwendige Cookies bzw. Speicherung im
        Local Storage Ihres Browsers (z. B. Anmeldesitzung, Anzeigeeinstellungen wie Dark Mode).
        Diese sind gemäß § 25 Abs. 2 Nr. 2 TTDSG ohne Einwilligung zulässig, da sie zur
        Bereitstellung des von Ihnen ausdrücklich gewünschten Telemediendienstes erforderlich sind.
        Es werden keine Cookies oder Skripte zu Marketing-, Tracking- oder Analysezwecken
        eingesetzt.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">6. Speicherdauer</h2>
      <p className="mb-4">
        Ihre Daten werden gespeichert, solange Ihr Konto besteht. Nach Löschung Ihres Kontos (siehe
        Punkt 8) werden Ihre personenbezogenen Daten und die von Ihnen erstellten Inhalte
        unverzüglich gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">7. Empfänger / Weitergabe von Daten</h2>
      <p className="mb-4">
        Eine Weitergabe Ihrer Daten an Dritte erfolgt nur an die in Punkt 3 genannten
        Auftragsverarbeiter sowie an andere Nutzer der Anwendung, soweit Sie dies durch Ihre
        Nutzung selbst veranlassen (z. B. Freigabe von Aufgaben/Projekten an Kollegen, Team- oder
        Projektmitgliedschaften, Chat-Nachrichten).
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">8. Ihre Rechte</h2>
      <p className="mb-2">Sie haben gegenüber dem Verantwortlichen folgende Rechte hinsichtlich der Sie betreffenden personenbezogenen Daten:</p>
      <ul className="mb-4 list-disc pl-5">
        <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
        <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
        <li>Recht auf Löschung (Art. 17 DSGVO)</li>
        <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruchsrecht gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
      </ul>
      <p className="mb-4">
        In den Einstellungen unter "Datenschutz" können Sie Ihre Daten selbst als Datei
        exportieren (Auskunft/Übertragbarkeit) und Ihr Konto inklusive aller Daten selbst und
        unwiderruflich löschen (Recht auf Löschung). Für alle anderen Anliegen wenden Sie sich an
        die unter Punkt 1 genannte Kontaktadresse.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">9. Datensicherheit</h2>
      <p className="mb-4">
        Die Übertragung erfolgt verschlüsselt über TLS/HTTPS. Der Zugriff auf Ihre Daten in der
        Datenbank ist durch Zeilenebenen-Sicherheit (Row Level Security) so eingeschränkt, dass
        Nutzer grundsätzlich nur auf eigene bzw. ausdrücklich geteilte Daten zugreifen können.
      </p>

      <p className="mt-8 text-xs text-gray-400">Stand: [Datum einsetzen]</p>
    </div>
  )
}
