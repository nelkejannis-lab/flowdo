import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ImpressumPage() {
  const { t } = useTranslation('legal')

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> {t('back')}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">{t('impressum.title')}</h1>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.tmgHeading')}</h2>
      <p className="mb-4" dangerouslySetInnerHTML={{ __html: t('impressum.tmgBody') }} />

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.contactHeading')}</h2>
      <p className="mb-4" dangerouslySetInnerHTML={{ __html: t('impressum.contactBody') }} />

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.vatHeading')}</h2>
      <p className="mb-4">{t('impressum.vatBody')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.responsibleHeading')}</h2>
      <p className="mb-4" dangerouslySetInnerHTML={{ __html: t('impressum.responsibleBody') }} />

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.disputeHeading')}</h2>
      <p className="mb-4">
        {(() => {
          const [before, after] = t('impressum.disputeBody', { link: '{{link}}' }).split('{{link}}')
          return (
            <>
              {before}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              {after}
            </>
          )
        })()}
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('impressum.consumerDisputeHeading')}</h2>
      <p className="mb-4">{t('impressum.consumerDisputeBody')}</p>
    </div>
  )
}
