import { useMemo, useState } from 'react'

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['DC', 'Washington D.C.'],
]

const COPY = {
  en: {
    steps: ['Profile', 'Household', 'Income', 'Context', 'Review'],
    introTitle: 'Tell us about this household',
    introText: 'We ask short questions so we can give clear next steps.',
    selfMode: 'I am checking for myself',
    helperMode: 'I am helping someone else',
    caseLabel: 'Case label (optional)',
    caseLabelHint: 'Example: Garcia family or intake 0412',
    householdTitle: 'Household basics',
    householdHint: 'State and household size can change eligibility limits.',
    householdSize: 'How many people are in the household?',
    state: 'State',
    incomeTitle: 'Income and work status',
    incomeHint: 'Use total monthly gross income before taxes.',
    monthlyIncome: 'Monthly gross income',
    monthlyIncomeHelp: 'Enter 0 if no current income.',
    employment: 'Employment status',
    contextTitle: 'Family context and documents',
    contextHint: 'These details can open additional pathways.',
    children: 'There are dependent children under 19',
    disability: 'Someone in the household has a disability',
    extraContext: 'Anything else we should know? (optional)',
    extraContextPh: 'Examples: recent eviction notice, pregnancy, medical bills, veteran status',
    docs: 'Upload documents (optional)',
    docsHint: 'You can add PDF, image, or text files like pay stubs and household forms.',
    reviewTitle: 'Review before checking',
    reviewHint: 'Make sure this looks right. You can go back to edit.',
    continue: 'Continue',
    back: 'Back',
    submit: 'Check eligibility now',
    loading: 'Checking programs now',
    progress: 'Progress',
    yes: 'Yes',
    no: 'No',
    addFiles: 'Add files',
    removeFile: 'Remove',
  },
  es: {
    steps: ['Perfil', 'Hogar', 'Ingresos', 'Contexto', 'Revision'],
    introTitle: 'Cuentenos sobre este hogar',
    introText: 'Hacemos preguntas breves para dar pasos claros.',
    selfMode: 'Estoy revisando para mi',
    helperMode: 'Estoy ayudando a otra persona',
    caseLabel: 'Etiqueta del caso (opcional)',
    caseLabelHint: 'Ejemplo: Familia Garcia o ingreso 0412',
    householdTitle: 'Datos basicos del hogar',
    householdHint: 'El estado y el tamano del hogar pueden cambiar los limites.',
    householdSize: 'Cuantas personas hay en el hogar?',
    state: 'Estado',
    incomeTitle: 'Ingresos y trabajo',
    incomeHint: 'Use el ingreso mensual bruto total antes de impuestos.',
    monthlyIncome: 'Ingreso mensual bruto',
    monthlyIncomeHelp: 'Ingrese 0 si no tiene ingresos actuales.',
    employment: 'Estado laboral',
    contextTitle: 'Contexto familiar y documentos',
    contextHint: 'Estos datos pueden abrir rutas adicionales.',
    children: 'Hay hijos dependientes menores de 19 anos',
    disability: 'Alguien en el hogar tiene discapacidad',
    extraContext: 'Algo mas que debamos saber? (opcional)',
    extraContextPh: 'Ejemplos: aviso reciente de desalojo, embarazo, gastos medicos, veterano',
    docs: 'Subir documentos (opcional)',
    docsHint: 'Puede agregar PDF, imagen o texto como talones de pago y formularios del hogar.',
    reviewTitle: 'Revise antes de continuar',
    reviewHint: 'Confirme la informacion. Puede volver para editar.',
    continue: 'Continuar',
    back: 'Atras',
    submit: 'Revisar elegibilidad ahora',
    loading: 'Revisando programas ahora',
    progress: 'Progreso',
    yes: 'Si',
    no: 'No',
    addFiles: 'Agregar archivos',
    removeFile: 'Quitar',
  },
}

const EMPLOYMENT_OPTIONS = {
  en: [
    { value: 'employed', label: 'Employed' },
    { value: 'unemployed', label: 'Unemployed' },
    { value: 'self_employed', label: 'Self-employed' },
    { value: 'recently_lost_job', label: 'Recently lost job' },
  ],
  es: [
    { value: 'employed', label: 'Empleado' },
    { value: 'unemployed', label: 'Desempleado' },
    { value: 'self_employed', label: 'Trabajador independiente' },
    { value: 'recently_lost_job', label: 'Perdio su trabajo recientemente' },
  ],
}

function StepProgress({ currentStep, steps, locale }) {
  const percent = Math.round(((currentStep + 1) / steps.length) * 100)

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-brand-ink/70">{COPY[locale].progress}</p>
        <p className="text-brand-ink/60">{percent}%</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-border">
        <div className="h-full rounded-full bg-brand-teal transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-ink/50">
        {steps.map((label, idx) => (
          <span key={label} className={idx <= currentStep ? 'text-brand-ink/80' : ''}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function FileTag({ file, onRemove, removeLabel }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-brand-border bg-white px-3 py-2 text-sm">
      <div>
        <p className="font-medium text-brand-ink">{file.name}</p>
        <p className="text-xs text-brand-ink/60">{Math.max(1, Math.round(file.size / 1024))} KB</p>
      </div>
      <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 text-xs font-semibold text-brand-ink/60 hover:bg-brand-bg">
        {removeLabel}
      </button>
    </div>
  )
}

export default function StepForm({ onSubmit, isLoading, locale = 'en' }) {
  const t = COPY[locale] ?? COPY.en
  const employmentOptions = EMPLOYMENT_OPTIONS[locale] ?? EMPLOYMENT_OPTIONS.en

  const [step, setStep] = useState(0)
  const [documents, setDocuments] = useState([])
  const [form, setForm] = useState({
    household_size: 1,
    state: 'TX',
    monthly_income: 0,
    employment_status: 'unemployed',
    has_children: false,
    has_disability: false,
    additional_context: '',
    caseworker_mode: false,
    case_label: '',
  })

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const stateName = useMemo(
    () => US_STATES.find(([code]) => code === form.state)?.[1] ?? form.state,
    [form.state],
  )

  const addFiles = (evt) => {
    const incoming = Array.from(evt.target.files || [])
    if (!incoming.length) return
    setDocuments(prev => [...prev, ...incoming].slice(0, 6))
    evt.target.value = ''
  }

  const submit = () => {
    onSubmit?.({ ...form, language: locale }, documents)
  }

  const steps = t.steps

  return (
    <section className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft sm:p-7">
      <StepProgress currentStep={step} steps={steps} locale={locale} />

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.introTitle}</h2>
            <p className="mt-2 text-sm text-brand-ink/70">{t.introText}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setField('caseworker_mode', false)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                !form.caseworker_mode
                  ? 'border-brand-teal bg-brand-bg text-brand-ink'
                  : 'border-brand-border text-brand-ink/70 hover:border-brand-teal/40'
              }`}
            >
              <p className="font-semibold">{t.selfMode}</p>
            </button>

            <button
              type="button"
              onClick={() => setField('caseworker_mode', true)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                form.caseworker_mode
                  ? 'border-brand-teal bg-brand-bg text-brand-ink'
                  : 'border-brand-border text-brand-ink/70 hover:border-brand-teal/40'
              }`}
            >
              <p className="font-semibold">{t.helperMode}</p>
            </button>
          </div>

          {form.caseworker_mode && (
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-brand-ink/80">{t.caseLabel}</span>
              <input
                type="text"
                value={form.case_label}
                onChange={(e) => setField('case_label', e.target.value)}
                placeholder={t.caseLabelHint}
                className="w-full rounded-xl border border-brand-border px-3 py-2.5 text-sm text-brand-ink focus:border-brand-teal focus:outline-none"
              />
            </label>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.householdTitle}</h2>
            <p className="mt-2 text-sm text-brand-ink/70">{t.householdHint}</p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-bg p-4">
            <p className="text-sm font-semibold text-brand-ink/80">{t.householdSize}</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField('household_size', Math.max(1, form.household_size - 1))}
                className="h-10 w-10 rounded-full border border-brand-border text-lg text-brand-ink hover:bg-white"
              >
                -
              </button>
              <span className="w-10 text-center text-3xl font-bold text-brand-teal">{form.household_size}</span>
              <button
                type="button"
                onClick={() => setField('household_size', Math.min(20, form.household_size + 1))}
                className="h-10 w-10 rounded-full border border-brand-border text-lg text-brand-ink hover:bg-white"
              >
                +
              </button>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-brand-ink/80">{t.state}</span>
            <select
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-teal focus:outline-none"
            >
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.incomeTitle}</h2>
            <p className="mt-2 text-sm text-brand-ink/70">{t.incomeHint}</p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-brand-ink/80">{t.monthlyIncome}</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink/55">$</span>
              <input
                type="number"
                min="0"
                step="50"
                value={form.monthly_income}
                onChange={(e) => setField('monthly_income', Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-brand-border pl-7 pr-3 py-2.5 text-sm text-brand-ink focus:border-brand-teal focus:outline-none"
              />
            </div>
            <p className="text-xs text-brand-ink/55">{t.monthlyIncomeHelp}</p>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-ink/80">{t.employment}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {employmentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField('employment_status', opt.value)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    form.employment_status === opt.value
                      ? 'border-brand-teal bg-brand-bg text-brand-ink'
                      : 'border-brand-border text-brand-ink/70 hover:border-brand-teal/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.contextTitle}</h2>
            <p className="mt-2 text-sm text-brand-ink/70">{t.contextHint}</p>
          </div>

          <div className="space-y-2">
            {[['has_children', t.children], ['has_disability', t.disability]].map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setField(key, !form[key])}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  form[key]
                    ? 'border-brand-teal bg-brand-bg text-brand-ink'
                    : 'border-brand-border text-brand-ink/75 hover:border-brand-teal/40'
                }`}
              >
                <span>{label}</span>
                <span>{form[key] ? t.yes : t.no}</span>
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-brand-ink/80">{t.extraContext}</span>
            <textarea
              rows={4}
              value={form.additional_context}
              onChange={(e) => setField('additional_context', e.target.value)}
              placeholder={t.extraContextPh}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 text-sm text-brand-ink focus:border-brand-teal focus:outline-none"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-ink/80">{t.docs}</p>
            <p className="text-xs text-brand-ink/55">{t.docsHint}</p>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-bg">
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={addFiles}
                className="hidden"
              />
              {t.addFiles}
            </label>

            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((file, idx) => (
                  <FileTag
                    key={`${file.name}-${idx}`}
                    file={file}
                    removeLabel={t.removeFile}
                    onRemove={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.reviewTitle}</h2>
            <p className="mt-2 text-sm text-brand-ink/70">{t.reviewHint}</p>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-bg p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-brand-ink/65">{t.state}</dt>
                <dd className="font-semibold text-brand-ink">{stateName}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-brand-ink/65">{t.householdSize}</dt>
                <dd className="font-semibold text-brand-ink">{form.household_size}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-brand-ink/65">{t.monthlyIncome}</dt>
                <dd className="font-semibold text-brand-ink">${form.monthly_income.toLocaleString()}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-brand-ink/65">{t.employment}</dt>
                <dd className="font-semibold text-brand-ink">
                  {employmentOptions.find(opt => opt.value === form.employment_status)?.label}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-brand-ink/65">{t.docs}</dt>
                <dd className="font-semibold text-brand-ink">{documents.length}</dd>
              </div>
              {form.caseworker_mode && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-brand-ink/65">{t.caseLabel}</dt>
                  <dd className="font-semibold text-brand-ink">{form.case_label || 'Case'}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(prev => Math.max(0, prev - 1))}
            disabled={isLoading}
            className="rounded-xl border border-brand-border bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink/75 transition hover:bg-brand-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.back}
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep(prev => Math.min(4, prev + 1))}
            className="ml-auto rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-teal-dark"
          >
            {t.continue}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={isLoading}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {isLoading ? t.loading : t.submit}
          </button>
        )}
      </div>
    </section>
  )
}
