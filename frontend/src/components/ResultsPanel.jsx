import { useEffect, useMemo, useState } from 'react'

const COPY = {
  en: {
    loadingTitle: 'Reviewing your eligibility now',
    loadingText: 'Checking all four programs and building your action plan.',
    resultTitle: 'Your personalized results',
    priority: 'Priority',
    why: 'Why this may fit',
    apply: 'Apply now',
    estValue: 'Estimated value',
    actionTitle: 'Your action plan',
    copy: 'Copy plan',
    download: 'Download plan',
    checklist: 'Checklist',
    resources: 'Official resources',
    transparency: 'How this result is generated',
    summaryFallback: 'Start with the top ranked programs and submit applications this week.',
    reset: 'Start a new check',
    yes: 'Yes',
    no: 'No',
  },
  es: {
    loadingTitle: 'Estamos revisando su elegibilidad',
    loadingText: 'Revisamos los cuatro programas y armamos su plan de accion.',
    resultTitle: 'Sus resultados personalizados',
    priority: 'Prioridad',
    why: 'Por que puede aplicar',
    apply: 'Solicitar ahora',
    estValue: 'Valor estimado',
    actionTitle: 'Su plan de accion',
    copy: 'Copiar plan',
    download: 'Descargar plan',
    checklist: 'Lista de seguimiento',
    resources: 'Recursos oficiales',
    transparency: 'Como se genero este resultado',
    summaryFallback: 'Empiece con los programas de mayor prioridad y envie solicitudes esta semana.',
    reset: 'Comenzar una nueva revision',
    yes: 'Si',
    no: 'No',
  },
}

function statusClass(status) {
  if (status === 'likely_eligible') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'check_details') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function buildChecklistKey(storageKey) {
  return `ben_checklist_${storageKey || 'draft'}`
}

export default function ResultsPanel({
  finalAnswer,
  analysis,
  isStreaming,
  isComplete,
  onReset,
  storageKey,
  locale = 'en',
  onCopyPlan,
  onDownloadPlan,
}) {
  const t = COPY[locale] ?? COPY.en
  const programs = analysis?.programs ?? []
  const actionPlan = analysis?.action_plan ?? []
  const resources = analysis?.resource_links ?? []
  const checklist = analysis?.checklist_template ?? []
  const transparency = analysis?.transparency ?? []

  const [checked, setChecked] = useState({})
  const checklistKey = useMemo(() => buildChecklistKey(storageKey), [storageKey])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(checklistKey)
      setChecked(raw ? JSON.parse(raw) : {})
    } catch {
      setChecked({})
    }
  }, [checklistKey, analysis?.generated_at])

  const toggleChecklist = (id) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(checklistKey, JSON.stringify(next))
      return next
    })
  }

  const hasContent = Boolean(finalAnswer) || programs.length > 0

  if (!hasContent && !isStreaming) return null

  return (
    <section className="space-y-5">
      {isStreaming && programs.length === 0 && (
        <div className="rounded-3xl border border-brand-border bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-brand-teal" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div>
              <p className="font-semibold text-brand-ink">{t.loadingTitle}</p>
              <p className="text-sm text-brand-ink/70">{t.loadingText}</p>
            </div>
          </div>
        </div>
      )}

      {(programs.length > 0 || finalAnswer) && (
        <div className="rounded-3xl border border-brand-border bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-display text-brand-ink">{t.resultTitle}</h2>
              <p className="mt-2 text-sm text-brand-ink/70">{analysis?.summary || t.summaryFallback}</p>
            </div>
          </div>

          {programs.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {programs.map((program) => (
                <article key={program.id} className="rounded-2xl border border-brand-border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-brand-ink">{program.name}</h3>
                      <p className="text-xs text-brand-ink/60">{t.priority} #{program.priority_rank}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(program.status)}`}>
                      {program.status_label}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl bg-brand-bg px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/55">{t.estValue}</p>
                    <p className="text-sm font-semibold text-brand-ink">{program.estimated_value}</p>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/55">{t.why}</p>
                    {program.why?.slice(0, 3).map((item, idx) => (
                      <p key={`${program.id}-${idx}`} className="text-sm leading-6 text-brand-ink/80">• {item}</p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-xs text-brand-ink/60">{program.next_step}</p>
                    <a
                      href={program.apply_url}
                      target="_blank"
                      rel="noreferrer"
                      className="whitespace-nowrap rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-teal-dark"
                    >
                      {t.apply}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {actionPlan.length > 0 && (
            <div className="mt-6 rounded-2xl border border-brand-border bg-brand-bg p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-brand-ink">{t.actionTitle}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCopyPlan}
                    className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink/80 hover:bg-brand-bg"
                  >
                    {t.copy}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPlan}
                    className="rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink/80 hover:bg-brand-bg"
                  >
                    {t.download}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {actionPlan.map((step) => (
                  <div key={`${step.program}-${step.rank}`} className="rounded-xl border border-brand-border bg-white px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/55">{t.priority} #{step.rank}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">{step.title}</p>
                    <p className="mt-1 text-sm text-brand-ink/75">{step.reason}</p>
                    <a href={step.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand-teal hover:underline">
                      {step.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {checklist.length > 0 && (
            <div className="mt-6 rounded-2xl border border-brand-border bg-white p-4">
              <h3 className="text-lg font-semibold text-brand-ink">{t.checklist}</h3>
              <div className="mt-3 space-y-2">
                {checklist.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-border px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.id])}
                      onChange={() => toggleChecklist(item.id)}
                      className="h-4 w-4 rounded border-brand-border text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-sm text-brand-ink/85">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {resources.length > 0 && (
              <div className="rounded-2xl border border-brand-border bg-white p-4">
                <h3 className="text-lg font-semibold text-brand-ink">{t.resources}</h3>
                <div className="mt-3 space-y-2">
                  {resources.map((resource) => (
                    <a
                      key={`${resource.program}-${resource.url}`}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-brand-border px-3 py-2 text-sm text-brand-ink/85 hover:bg-brand-bg"
                    >
                      <p className="font-semibold">{resource.program}</p>
                      <p className="text-brand-ink/70">{resource.label}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {transparency.length > 0 && (
              <div className="rounded-2xl border border-brand-border bg-white p-4">
                <h3 className="text-lg font-semibold text-brand-ink">{t.transparency}</h3>
                <div className="mt-3 space-y-2">
                  {transparency.map((line, idx) => (
                    <p key={`${idx}-${line.slice(0, 8)}`} className="text-sm leading-6 text-brand-ink/80">• {line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isComplete && (
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-bg"
        >
          {t.reset}
        </button>
      )}
    </section>
  )
}
