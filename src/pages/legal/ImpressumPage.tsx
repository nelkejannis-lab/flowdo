import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Impressum</h1>

      <h2 className="mb-2 mt-6 text-base font-semibold">Angaben gemäß § 5 TMG</h2>
      <p className="mb-4">
        Janis Nelke<br />
        Milsper Straße 14<br />
        58256 Ennepetal<br />
        Deutschland
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Kontakt</h2>
      <p className="mb-4">
        Telefon: 0160 93865193<br />
        E-Mail: jannisnelke1@gmail.com
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Umsatzsteuer-ID</h2>
      <p className="mb-4">
        Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p className="mb-4">
        Janis Nelke<br />
        Milsper Straße 14<br />
        58256 Ennepetal
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
