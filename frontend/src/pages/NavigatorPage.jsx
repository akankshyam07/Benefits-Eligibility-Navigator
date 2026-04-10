import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import StepForm from '../components/StepForm'
import ResultsPanel from '../components/ResultsPanel'

const STORAGE_KEYS = {
  savedRuns: 'ben_saved_runs',
}

const COPY = {
  en: {
    pageTitle: 'Eligibility navigator',
    pageSubtitle: 'Complete the steps and get a clear action plan.',
    backHome: 'Back to home',
    savedTitle: 'Saved checks',
    savedHint: 'Saved in this browser only.',
    savedEmpty: 'No saved checks yet.',
    openSaved: 'Open',
    counselorTitle: 'Counselor workspace',
    counselorEmpty: 'No counselor cases yet.',
    trustTitle: 'Trust and transparency',
    trustLine1: 'Rule based checks estimate eligibility before AI drafting.',
    trustLine2: 'Official links are included for each program.',
    trustLine3: 'This tool gives guidance only. Final decisions come from agencies.',
    noticeCopied: 'Action plan copied.',
    noticeDownloaded: 'Action plan downloaded.',
    noticeUploadRejected: 'Some files were skipped because type or size is not supported.',
    caseWord: 'Case',
    checkWord: 'Check',
    disclaimer: 'This tool shares guidance, not legal advice. Please confirm details with your local agency.',
  },
  es: {
    pageTitle: 'Navegador de elegibilidad',
    pageSubtitle: 'Complete los pasos y reciba un plan de accion claro.',
    backHome: 'Volver al inicio',
    savedTitle: 'Revisiones guardadas',
    savedHint: 'Se guardan solo en este navegador.',
    savedEmpty: 'No hay revisiones guardadas.',
    openSaved: 'Abrir',
    counselorTitle: 'Espacio de consejeria',
    counselorEmpty: 'No hay casos de consejeria.',
    trustTitle: 'Confianza y transparencia',
    trustLine1: 'Las reglas estiman elegibilidad antes del texto de IA.',
    trustLine2: 'Se incluyen enlaces oficiales para cada programa.',
    trustLine3: 'Esta herramienta ofrece orientacion. La decision final es de la agencia.',
    noticeCopied: 'Plan de accion copiado.',
    noticeDownloaded: 'Plan de accion descargado.',
    noticeUploadRejected: 'Se omitieron algunos archivos por tipo o tamano.',
    caseWord: 'Caso',
    checkWord: 'Revision',
    disclaimer: 'Esta herramienta comparte orientacion, no asesoria legal. Confirme detalles con su agencia local.',
  },
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function buildActionPlanText(analysis, finalAnswer) {
  const lines = []

  if (analysis?.summary) {
    lines.push(analysis.summary)
    lines.push('')
  }

  if (analysis?.action_plan?.length) {
    lines.push('Action plan')
    for (const step of analysis.action_plan) {
      lines.push(`${step.rank}. ${step.title}`)
      lines.push(`   ${step.reason}`)
      lines.push(`   ${step.url}`)
    }
    lines.push('')
  }

  if (analysis?.programs?.length) {
    lines.push('Program details')
    for (const p of analysis.programs) {
      lines.push(`- ${p.name}: ${p.status_label}`)
      lines.push(`  Estimated value: ${p.estimated_value}`)
      for (const reason of p.why || []) {
        lines.push(`  * ${reason}`)
      }
      lines.push(`  Apply: ${p.apply_url}`)
    }
    lines.push('')
  }

  if (finalAnswer) {
    lines.push('Agent response')
    lines.push(finalAnswer)
  }

  return lines.join('\n').trim()
}

function makeRunId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function formatDate(value, locale) {
  try {
    return new Date(value).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NavigatorPage({ locale = 'en' }) {
  const [finalAnswer, setFinalAnswer] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [notice, setNotice] = useState('')
  const [savedRuns, setSavedRuns] = useState(() => readJsonStorage(STORAGE_KEYS.savedRuns, []))
  const [currentRunKey, setCurrentRunKey] = useState('')

  const t = COPY[locale] ?? COPY.en

  const counselorRuns = useMemo(
    () => savedRuns.filter((run) => run.caseworker_mode).slice(0, 5),
    [savedRuns],
  )
  const hasResultData = Boolean(finalAnswer.trim()) || Boolean(analysis?.programs?.length)
  const showFormSection = !showResults || (!isStreaming && !hasResultData)

  const saveRunLocally = (payload, answer, analysisData) => {
    if (!answer && !analysisData) return

    const now = new Date()
    const id = makeRunId()
    const label = payload.caseworker_mode
      ? payload.case_label || `${t.caseWord} ${now.toLocaleDateString()}`
      : `${t.checkWord} ${now.toLocaleDateString()}`

    const entry = {
      id,
      label,
      state: payload.state,
      household_size: payload.household_size,
      caseworker_mode: Boolean(payload.caseworker_mode),
      created_at: now.toISOString(),
      answer: answer || '',
      analysis: analysisData || null,
    }

    const next = [entry, ...savedRuns.filter((run) => run.id !== id)].slice(0, 20)
    setSavedRuns(next)
    localStorage.setItem(STORAGE_KEYS.savedRuns, JSON.stringify(next))
    setCurrentRunKey(id)
  }

  const streamEligibility = async (payload) => {
    const response = await fetchWithTimeout(
      '/api/check-eligibility/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      20000,
    )

    if (!response.ok || !response.body) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let capturedAnswer = ''
    let capturedAnalysis = null

    const processEventBlock = (part) => {
      if (!part.trim()) return

      const lines = part.split('\n')
      let eventType = 'message'
      const dataParts = []

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataParts.push(line.startsWith('data: ') ? line.slice(6) : line.slice(5))
        }
      }

      const eventData = dataParts.join('\n')

        if (eventType === 'step') return

      if (eventType === 'token') {
        capturedAnswer += eventData
        setFinalAnswer((prev) => prev + eventData)
        return
      }

      if (eventType === 'analysis') {
        try {
          const parsed = JSON.parse(eventData)
          capturedAnalysis = parsed
          setAnalysis(parsed)
        } catch {
          // ignore malformed analysis payload
        }
        return
      }

      if (eventType === 'error') {
        throw new Error(eventData || 'Unexpected server error.')
      }

      if (eventType === 'done') {
        setIsStreaming(false)
        setIsComplete(true)
      }
    }

    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), 45000)),
      ])

      const { done, value } = chunk
      if (done) {
        // Some runtimes may end without a trailing delimiter.
        if (buffer.trim()) {
          processEventBlock(buffer.replace(/\r\n/g, '\n'))
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        processEventBlock(part)
      }
    }

    if (!capturedAnswer.trim() && !capturedAnalysis) {
      throw new Error('No response received. Please try again.')
    }

    return {
      answer: capturedAnswer.trim(),
      analysis: capturedAnalysis,
    }
  }

  const uploadDocuments = async (files) => {
    if (!files?.length) return { uploaded: [], rejected: [] }

    const body = new FormData()
    files.forEach((file) => body.append('files', file))

    const response = await fetchWithTimeout(
      '/api/documents/upload',
      { method: 'POST', body },
      20000,
    )

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    return response.json()
  }

  const handleSubmit = async (formData, files) => {
    setFinalAnswer('')
    setAnalysis(null)
    setCurrentRunKey('')
    setIsStreaming(true)
    setIsComplete(false)
    setError(null)
    setShowResults(true)
    setNotice('')

    const payload = {
      ...formData,
      language: locale,
      uploaded_documents: [],
    }

    try {
      const uploadResult = await uploadDocuments(files)
      payload.uploaded_documents = uploadResult.uploaded || []
      if (uploadResult.rejected?.length) {
        setNotice(t.noticeUploadRejected)
      }

      const { answer, analysis: analysisData } = await streamEligibility(payload)
      saveRunLocally(payload, answer, analysisData)
      setIsStreaming(false)
      setIsComplete(true)
    } catch (err) {
      setError(`Connection error: ${err.message}`)
      setShowResults(false)
      setIsComplete(true)
      setIsStreaming(false)
    }
  }

  const loadSavedRun = (runId) => {
    const run = savedRuns.find((item) => item.id === runId)
    if (!run) return

    setFinalAnswer(run.answer || '')
    setAnalysis(run.analysis || null)
    setShowResults(true)
    setIsStreaming(false)
    setIsComplete(true)
    setCurrentRunKey(run.id)
    setNotice('')
    setError(null)
  }

  const reset = () => {
    setShowResults(false)
    setFinalAnswer('')
    setAnalysis(null)
    setCurrentRunKey('')
    setIsStreaming(false)
    setIsComplete(false)
    setError(null)
    setNotice('')
  }

  const actionPlanText = useMemo(
    () => buildActionPlanText(analysis, finalAnswer),
    [analysis, finalAnswer],
  )

  const copyPlan = async () => {
    if (!actionPlanText) return

    try {
      await navigator.clipboard.writeText(actionPlanText)
      setNotice(t.noticeCopied)
    } catch {
      setNotice('')
    }
  }

  const downloadPlan = () => {
    if (!actionPlanText) return

    const blob = new Blob([actionPlanText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `benefits-action-plan-${currentRunKey || 'draft'}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(t.noticeDownloaded)
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display text-brand-ink">{t.pageTitle}</h2>
            <p className="mt-1 text-sm text-brand-ink/70">{t.pageSubtitle}</p>
          </div>

          <Link
            to="/"
            className="rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm font-semibold text-brand-ink/80 hover:bg-white"
          >
            {t.backHome}
          </Link>
        </div>
      </section>

      {error && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      )}

      {notice && (
        <section className="rounded-xl border border-brand-border bg-brand-bg px-4 py-3 text-sm text-brand-ink/80">
          {notice}
        </section>
      )}

      {showFormSection && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <StepForm onSubmit={handleSubmit} isLoading={isStreaming} locale={locale} />

          <aside className="space-y-4">
            <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/55">{t.savedTitle}</p>
              <p className="mt-2 text-xs text-brand-ink/60">{t.savedHint}</p>

              <div className="mt-3 space-y-2">
                {savedRuns.length === 0 && (
                  <p className="text-sm text-brand-ink/65">{t.savedEmpty}</p>
                )}

                {savedRuns.slice(0, 8).map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => loadSavedRun(run.id)}
                    className="block w-full rounded-lg border border-brand-border px-3 py-2 text-left text-sm hover:bg-brand-bg"
                  >
                    <p className="font-semibold text-brand-ink">{run.label}</p>
                    <p className="text-xs text-brand-ink/60">
                      {run.state} • {run.household_size} • {formatDate(run.created_at, locale)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-brand-teal">{t.openSaved}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/55">{t.counselorTitle}</p>
              <div className="mt-2 space-y-2">
                {counselorRuns.length === 0 && (
                  <p className="text-sm text-brand-ink/65">{t.counselorEmpty}</p>
                )}
                {counselorRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => loadSavedRun(run.id)}
                    className="block w-full rounded-lg border border-brand-border px-3 py-2 text-left text-sm hover:bg-brand-bg"
                  >
                    <p className="font-semibold text-brand-ink">{run.label}</p>
                    <p className="text-xs text-brand-ink/60">{run.state} • {run.household_size}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-soft">
              <h3 className="text-lg font-semibold text-brand-ink">{t.trustTitle}</h3>
              <div className="mt-3 space-y-2 text-sm text-brand-ink/80">
                <p>• {t.trustLine1}</p>
                <p>• {t.trustLine2}</p>
                <p>• {t.trustLine3}</p>
              </div>
            </section>
          </aside>
        </section>
      )}

      {showResults && (isStreaming || hasResultData) && (
        <ResultsPanel
          finalAnswer={finalAnswer}
          analysis={analysis}
          isStreaming={isStreaming}
          isComplete={isComplete}
          onReset={reset}
          storageKey={currentRunKey || analysis?.generated_at}
          locale={locale}
          onCopyPlan={copyPlan}
          onDownloadPlan={downloadPlan}
        />
      )}

      <p className="pb-4 text-center text-xs text-brand-ink/55">{t.disclaimer}</p>
    </main>
  )
}
