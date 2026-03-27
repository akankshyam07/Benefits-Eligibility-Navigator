import { useEffect, useRef } from 'react'

function StepBadge({ index, text }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
        {index}
      </span>
      <p className="text-gray-600 leading-relaxed">{text}</p>
    </div>
  )
}

export default function ResultsPanel({ agentSteps, finalAnswer, isStreaming, isComplete, onReset }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [agentSteps, finalAnswer])

  const hasContent = agentSteps.length > 0 || finalAnswer

  if (!hasContent && !isStreaming) return null

  // Render markdown-ish: bold **text**, headers ## text, bullets •
  const renderAnswer = (text) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      if (/^##\s/.test(line)) {
        return (
          <h3 key={i} className="text-indigo-700 font-bold text-base mt-4 mb-1">
            {line.replace(/^##\s/, '')}
          </h3>
        )
      }
      if (/^###\s/.test(line)) {
        return (
          <h4 key={i} className="text-gray-700 font-semibold text-sm mt-3 mb-0.5">
            {line.replace(/^###\s/, '')}
          </h4>
        )
      }
      if (/^[•\-\*]\s/.test(line) || /^\d+\.\s/.test(line)) {
        const content = line.replace(/^[•\-\*\d.]\s*/, '')
        const parts = content.split(/(\*\*.*?\*\*)/)
        return (
          <li key={i} className="ml-4 text-gray-700 text-sm leading-relaxed list-none flex gap-2 mt-1">
            <span className="text-indigo-400 mt-0.5">›</span>
            <span>
              {parts.map((p, j) =>
                p.startsWith('**') && p.endsWith('**')
                  ? <strong key={j}>{p.slice(2, -2)}</strong>
                  : p
              )}
            </span>
          </li>
        )
      }
      if (!line.trim()) return <div key={i} className="h-2" />

      const parts = line.split(/(\*\*.*?\*\*)/)
      return (
        <p key={i} className="text-gray-700 text-sm leading-relaxed">
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="text-gray-800">{p.slice(2, -2)}</strong>
              : p
          )}
        </p>
      )
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Agent reasoning steps */}
      {agentSteps.length > 0 && (
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${isStreaming && !finalAnswer ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Agent Reasoning
            </h2>
          </div>
          <div className="space-y-2">
            {agentSteps.map((s, i) => (
              <StepBadge key={i} index={i + 1} text={s} />
            ))}
          </div>
        </div>
      )}

      {/* Final answer streaming area */}
      {(finalAnswer || (isStreaming && agentSteps.length > 0)) && (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-base font-semibold text-gray-800">Your Eligibility Results</h2>
          </div>

          <div className="prose-sm max-w-none space-y-1">
            {renderAnswer(finalAnswer)}
            {isStreaming && !isComplete && (
              <span className="inline-block w-2 h-4 bg-indigo-500 animate-blink ml-0.5 rounded-sm" />
            )}
          </div>
        </div>
      )}

      {/* Thinking spinner before first step */}
      {isStreaming && agentSteps.length === 0 && (
        <div className="p-8 flex items-center gap-3 text-indigo-600">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium">Checking all benefit programs for you…</span>
        </div>
      )}

      {/* Reset button */}
      {isComplete && (
        <div className="px-6 pb-6">
          <button
            onClick={onReset}
            className="w-full py-3 border-2 border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition">
            Check Again / Start Over
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
