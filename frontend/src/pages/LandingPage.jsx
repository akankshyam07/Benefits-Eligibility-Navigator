import { Link } from 'react-router-dom'

const COPY = {
  en: {
    tag: 'Guided support for families',
    title: 'Find the benefits to apply for first',
    subtitle:
      'Get calm, step by step help for SNAP, Medicaid, EITC, and Section 8. Start with a short check and leave with a clear action plan.',
    cta: 'Start eligibility check',
    featureTitle: 'What you get',
    feature1Title: 'One simple check',
    feature1Text: 'Review four major programs in one place.',
    feature2Title: 'Clear explanations',
    feature2Text: 'See why you may qualify and what to do next.',
    feature3Title: 'Action you can take',
    feature3Text: 'Get official links, priorities, and a checklist.',
    disclaimer: 'This tool shares guidance, not legal advice. Please confirm details with your local agency.',
  },
  es: {
    tag: 'Apoyo guiado para familias',
    title: 'Encuentre los beneficios para solicitar primero',
    subtitle:
      'Reciba ayuda clara y paso a paso para SNAP, Medicaid, EITC y Section 8. Empiece con una revision corta y termine con un plan de accion.',
    cta: 'Comenzar revision',
    featureTitle: 'Lo que recibe',
    feature1Title: 'Una revision simple',
    feature1Text: 'Revise cuatro programas importantes en un solo lugar.',
    feature2Title: 'Explicaciones claras',
    feature2Text: 'Vea por que puede calificar y que hacer despues.',
    feature3Title: 'Acciones concretas',
    feature3Text: 'Obtenga enlaces oficiales, prioridades y una lista de seguimiento.',
    disclaimer: 'Esta herramienta comparte orientacion, no asesoria legal. Confirme detalles con su agencia local.',
  },
}

export default function LandingPage({ locale = 'en' }) {
  const t = COPY[locale] ?? COPY.en

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="rounded-3xl border border-brand-border bg-white px-6 py-10 shadow-soft sm:px-9 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/55">{t.tag}</p>
          <h2 className="mt-4 text-4xl font-display leading-tight text-brand-ink sm:text-5xl">
            {t.title}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-brand-ink/75">{t.subtitle}</p>

          <div className="mt-8">
            <Link
              to="/navigator"
              className="inline-flex rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-teal-dark"
            >
              {t.cta}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-brand-border bg-white px-6 py-7 shadow-soft sm:px-8">
        <h3 className="text-lg font-semibold text-brand-ink">{t.featureTitle}</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-brand-border bg-brand-bg px-4 py-4">
            <p className="text-sm font-semibold text-brand-ink">{t.feature1Title}</p>
            <p className="mt-2 text-sm leading-6 text-brand-ink/75">{t.feature1Text}</p>
          </article>

          <article className="rounded-2xl border border-brand-border bg-brand-bg px-4 py-4">
            <p className="text-sm font-semibold text-brand-ink">{t.feature2Title}</p>
            <p className="mt-2 text-sm leading-6 text-brand-ink/75">{t.feature2Text}</p>
          </article>

          <article className="rounded-2xl border border-brand-border bg-brand-bg px-4 py-4">
            <p className="text-sm font-semibold text-brand-ink">{t.feature3Title}</p>
            <p className="mt-2 text-sm leading-6 text-brand-ink/75">{t.feature3Text}</p>
          </article>
        </div>
      </section>

      <p className="mt-8 pb-4 text-center text-xs text-brand-ink/55">{t.disclaimer}</p>
    </main>
  )
}
