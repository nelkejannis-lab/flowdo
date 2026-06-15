import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function DatenschutzPage() {
  const { t } = useTranslation('legal')

  const section2Items = t('datenschutz.section2.items', { returnObjects: true }) as string[]
  const section3Items = t('datenschutz.section3.items', { returnObjects: true }) as string[]
  const section4Items = t('datenschutz.section4.items', { returnObjects: true }) as string[]
  const section8Items = t('datenschutz.section8.items', { returnObjects: true }) as string[]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> {t('back')}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">{t('datenschutz.title')}</h1>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section1.heading')}</h2>
      <p className="mb-4" dangerouslySetInnerHTML={{ __html: t('datenschutz.section1.body') }} />

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section2.heading')}</h2>
      <p className="mb-4">{t('datenschutz.section2.intro')}</p>
      <ul className="mb-4 list-disc pl-5">
        {section2Items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section3.heading')}</h2>
      <p className="mb-2">{t('datenschutz.section3.intro')}</p>
      <ul className="mb-4 list-disc pl-5">
        {section3Items.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section4.heading')}</h2>
      <ul className="mb-4 list-disc pl-5">
        {section4Items.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section5.heading')}</h2>
      <p className="mb-4">{t('datenschutz.section5.body')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section6.heading')}</h2>
      <p className="mb-4">{t('datenschutz.section6.body')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section7.heading')}</h2>
      <p className="mb-4">{t('datenschutz.section7.body')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section8.heading')}</h2>
      <p className="mb-2">{t('datenschutz.section8.intro')}</p>
      <ul className="mb-4 list-disc pl-5">
        {section8Items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      <p className="mb-4">{t('datenschutz.section8.outro')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('datenschutz.section9.heading')}</h2>
      <p className="mb-4">{t('datenschutz.section9.body')}</p>

      <p className="mt-8 text-xs text-gray-400">{t('datenschutz.lastUpdated')}</p>
    </div>
  )
}
