import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Impressum</h1>

      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        Platzhalter-Angaben gemäß § 5 TMG / § 18 MStV. Bitte mit den tatsächlichen Daten des
        Anbieters ersetzen, bevor die Anwendung produktiv (insbesondere geschäftlich) genutzt wird.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Angaben gemäß § 5 TMG</h2>
      <p className="mb-4">
        [Vor- und Nachname / Firmenname]<br />
        [Straße und Hausnummer]<br />
        [Postleitzahl und Ort]<br />
        Deutschland
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Kontakt</h2>
      <p className="mb-4">
        Telefon: [Telefonnummer]<br />
        E-Mail: [E-Mail-Adresse]
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Vertreten durch</h2>
      <p className="mb-4">[Name der verantwortlichen Person(en) / Geschäftsführung]</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Registereintrag</h2>
      <p className="mb-4">
        Eintragung im Handelsregister.<br />
        Registergericht: [Registergericht]<br />
        Registernummer: [HRB-Nummer]
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Umsatzsteuer-ID</h2>
      <p className="mb-4">
        Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: [USt-IdNr.]
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p className="mb-4">
        [Name]<br />
        [Anschrift wie oben]
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">EU-Streitschlichtung</h2>
      <p className="mb-4">
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p className="mb-4">
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen. [Anpassen, falls eine Teilnahme erfolgt.]
      </p>
    </div>
  )
}
