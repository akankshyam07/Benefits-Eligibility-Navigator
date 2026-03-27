import { useState } from 'react'
import Header from './components/Header'
import StepForm from './components/StepForm'
import ResultsPanel from './components/ResultsPanel'

export default function App() {
  const [agentSteps, setAgentSteps] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState(null)
  const [showResults, setShowResults] = useState(false)

  const handleSubmit = async (formData) => {
    // Reset state
    setAgentSteps([])
    setFinalAnswer('')
    setIsStreaming(true)
    setIsComplete(false)
    setError(null)
    setShowResults(true)

    try {
      const response = await fetch('/api/check-eligibility/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = 'message'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // SSE events are separated by double newline
        const parts = buffer.split('\n\n')
        buffer = parts.pop() // keep incomplete last part

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          let eventType = 'message'
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              eventData = line.slice(5).trim()
            }
          }

          switch (eventType) {
            case 'step':
              setAgentSteps(prev => [...prev, eventData])
              break
            case 'token':
              setFinalAnswer(prev => prev + eventData)
              break
            case 'done':
              setIsComplete(true)
              setIsStreaming(false)
              break
            case 'error':
              setError(eventData)
              setIsComplete(true)
              setIsStreaming(false)
              break
            case 'profile_id':
              // Could be used to bookmark the result
              console.log('Profile saved with ID:', eventData)
              break
          }
        }
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`)
      setIsComplete(true)
      setIsStreaming(false)
    }
  }

  const handleReset = () => {
    setShowResults(false)
    setAgentSteps([])
    setFinalAnswer('')
    setIsStreaming(false)
    setIsComplete(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Intro banner */}
        {!showResults && (
          <div className="bg-indigo-600 text-white rounded-2xl p-5 flex gap-4 items-start shadow-lg shadow-indigo-200">
            <span className="text-3xl flex-shrink-0">🏛️</span>
            <div>
              <p className="font-semibold text-lg leading-snug">
                You may qualify for more help than you think.
              </p>
              <p className="text-indigo-200 text-sm mt-1">
                Answer 4 quick questions and our AI will check every major federal program
                for you — no jargon, no judgment.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-red-700 text-sm">Something went wrong</p>
              <p className="text-red-600 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Form — hidden once streaming starts */}
        {!showResults && (
          <StepForm onSubmit={handleSubmit} isLoading={isStreaming} />
        )}

        {/* Results panel */}
        {showResults && (
          <ResultsPanel
            agentSteps={agentSteps}
            finalAnswer={finalAnswer}
            isStreaming={isStreaming}
            isComplete={isComplete}
            onReset={handleReset}
          />
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          This tool provides general information only and is not legal advice.
          Always verify eligibility with the relevant government agency.
        </p>
      </main>
    </div>
  )
}
