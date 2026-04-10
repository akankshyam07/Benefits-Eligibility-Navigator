const LABELS = {
  en: {
    brandTag: 'Benefits guide for real life',
    title: 'Benefits Eligibility Navigator',
    subtitle: 'Calm guidance for SNAP, Medicaid, EITC, and Section 8',
    language: 'Language',
    trust: 'Private by default. No signup required.',
  },
  es: {
    brandTag: 'Guia de beneficios para la vida real',
    title: 'Navegador de Elegibilidad de Beneficios',
    subtitle: 'Guia clara para SNAP, Medicaid, EITC y Section 8',
    language: 'Idioma',
    trust: 'Privado por defecto. No requiere cuenta.',
  },
}

export default function Header({ locale = 'en', onLocaleChange }) {
  const t = LABELS[locale] ?? LABELS.en

  return (
    <header className="relative overflow-hidden border-b border-brand-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-soft">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.75L12 5l9 5.75M5 9.5V19h14V9.5M9.5 19v-4.25a2.5 2.5 0 015 0V19" />
            </svg>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/60">{t.brandTag}</p>
            <h1 className="mt-0.5 text-xl font-display text-brand-ink sm:text-2xl">{t.title}</h1>
            <p className="mt-1 text-sm text-brand-ink/70">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <p className="hidden text-sm text-brand-ink/60 md:block">{t.trust}</p>

          <div className="rounded-xl border border-brand-border bg-white p-1">
            <span className="px-2 text-xs font-semibold text-brand-ink/60">{t.language}</span>
            <button
              type="button"
              onClick={() => onLocaleChange?.('en')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                locale === 'en'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'text-brand-ink/70 hover:bg-brand-bg'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onLocaleChange?.('es')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                locale === 'es'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'text-brand-ink/70 hover:bg-brand-bg'
              }`}
            >
              ES
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
