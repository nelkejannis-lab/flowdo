import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

export default function SecurityPage() {
  const { t } = useTranslation('legal')
  const [copied, setCopied] = useState(false)

  const allowlist = t('security.allowlist', { returnObjects: true }) as { host: string; purpose: string }[]
  const forticlientSteps = t('security.forticlientSteps', { returnObjects: true }) as string[]
  const postureItems = t('security.postureItems', { returnObjects: true }) as string[]

  const copyAllowlist = async () => {
    const text = allowlist.map((row) => row.host).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft size={14} /> {t('back')}
      </Link>

      <h1 className="mb-2 text-2xl font-semibold">{t('security.title')}</h1>
      <p className="mb-6 text-gray-500 dark:text-racing-300">{t('security.subtitle')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.overviewHeading')}</h2>
      <p className="mb-4">{t('security.overviewBody')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.whyBlockedHeading')}</h2>
      <p className="mb-4">{t('security.whyBlockedBody')}</p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.allowlistHeading')}</h2>
      <p className="mb-3">{t('security.allowlistIntro')}</p>
      <div className="mb-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-racing-700">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-racing-800">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('security.allowlistHost')}</th>
              <th className="px-3 py-2 font-semibold">{t('security.allowlistPurpose')}</th>
            </tr>
          </thead>
          <tbody>
            {allowlist.map((row) => (
              <tr key={row.host} className="border-t border-gray-100 dark:border-racing-700">
                <td className="px-3 py-2 font-mono">{row.host}</td>
                <td className="px-3 py-2">{row.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => void copyAllowlist()}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t('security.copied') : t('security.copyAllowlist')}
      </button>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.forticlientHeading')}</h2>
      <p className="mb-3">{t('security.forticlientIntro')}</p>
      <ol className="mb-4 list-decimal space-y-2 pl-5">
        {forticlientSteps.map((step, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
        ))}
      </ol>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.fortiguardHeading')}</h2>
      <p className="mb-4">
        {(() => {
          const [before, after] = t('security.fortiguardBody', { link: '{{link}}' }).split('{{link}}')
          return (
            <>
              {before}
              <a
                href="https://www.fortiguard.com/faq/wfratingsubmit"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                FortiGuard Web Filter Rating Request
              </a>
              {after}
            </>
          )
        })()}
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.postureHeading')}</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        {postureItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h2 className="mb-2 mt-6 text-base font-semibold">{t('security.contactHeading')}</h2>
      <p className="mb-4" dangerouslySetInnerHTML={{ __html: t('security.contactBody') }} />

      <p className="text-xs text-gray-500 dark:text-racing-400">
        <Link to="/impressum" className="text-accent hover:underline">{t('security.imprintLink')}</Link>
        {' · '}
        <Link to="/datenschutz" className="text-accent hover:underline">{t('security.privacyLink')}</Link>
        {' · '}
        <a href="/.well-known/security.txt" className="text-accent hover:underline">security.txt</a>
      </p>
    </div>
  )
}
