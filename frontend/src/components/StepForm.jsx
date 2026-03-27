import { useState } from 'react'

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],
  ['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],
  ['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],
  ['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],
  ['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],
  ['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],
  ['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],
  ['WI','Wisconsin'],['WY','Wyoming'],['DC','Washington D.C.'],
]

const STEPS = ['Household', 'Income', 'Situation', 'Review']

const EMPLOYMENT_OPTIONS = [
  { value: 'employed',         label: 'Employed' },
  { value: 'unemployed',       label: 'Unemployed' },
  { value: 'self_employed',    label: 'Self-Employed' },
  { value: 'recently_lost_job',label: 'Recently Lost Job' },
]

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all
              ${i < current  ? 'bg-indigo-600 text-white' : ''}
              ${i === current ? 'bg-indigo-600 text-white ring-4 ring-indigo-200' : ''}
              ${i > current  ? 'bg-gray-200 text-gray-500' : ''}`}>
              {i < current ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium hidden sm:block
              ${i <= current ? 'text-indigo-700' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-14 mb-4 transition-all
              ${i < current ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function StepForm({ onSubmit, isLoading }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    household_size:     1,
    state:              'TX',
    monthly_income:     0,
    employment_status:  'unemployed',
    has_children:       false,
    has_disability:     false,
    additional_context: '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Step 0 — Household ────────────────────────────────────────────────────
  const Step0 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">Tell us about your household</h2>
        <p className="text-gray-500 text-sm">This helps us calculate your income relative to the poverty line.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How many people live in your household?
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => set('household_size', Math.max(1, form.household_size - 1))}
            className="w-10 h-10 rounded-full border-2 border-indigo-300 text-indigo-600 font-bold text-xl hover:bg-indigo-50 transition">−</button>
          <span className="text-3xl font-bold text-indigo-700 w-8 text-center">{form.household_size}</span>
          <button
            onClick={() => set('household_size', Math.min(20, form.household_size + 1))}
            className="w-10 h-10 rounded-full border-2 border-indigo-300 text-indigo-600 font-bold text-xl hover:bg-indigo-50 transition">+</button>
          <span className="text-gray-500 text-sm ml-1">person{form.household_size !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What state do you live in?
        </label>
        <select
          value={form.state}
          onChange={e => set('state', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          {US_STATES.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>
    </div>
  )

  // ── Step 1 — Income ───────────────────────────────────────────────────────
  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">Income & employment</h2>
        <p className="text-gray-500 text-sm">Enter your total gross (before-tax) monthly household income.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Monthly gross income</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
          <input
            type="number"
            min="0"
            step="100"
            value={form.monthly_income}
            onChange={e => set('monthly_income', parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Enter 0 if you have no current income.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Employment status</label>
        <div className="grid grid-cols-2 gap-2">
          {EMPLOYMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('employment_status', opt.value)}
              className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all
                ${form.employment_status === opt.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Step 2 — Situation ────────────────────────────────────────────────────
  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">Your situation</h2>
        <p className="text-gray-500 text-sm">Check all that apply — these can expand your eligibility.</p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'has_children',   label: 'Household has dependent children under 19',
            icon: '👨‍👧' },
          { key: 'has_disability', label: 'Someone in the household has a disability',
            icon: '♿' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => set(key, !form[key])}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
              ${form[key]
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300 bg-white'}`}>
            <span className="text-2xl">{icon}</span>
            <span className={`text-sm font-medium ${form[key] ? 'text-indigo-700' : 'text-gray-700'}`}>
              {label}
            </span>
            {form[key] && (
              <svg className="ml-auto w-5 h-5 text-indigo-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Anything else we should know? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={form.additional_context}
          onChange={e => set('additional_context', e.target.value)}
          placeholder="e.g. recently evicted, pregnant, veteran, facing medical bills…"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
    </div>
  )

  // ── Step 3 — Review ───────────────────────────────────────────────────────
  const Step3 = () => {
    const employLabel = EMPLOYMENT_OPTIONS.find(o => o.value === form.employment_status)?.label ?? form.employment_status
    const stateName = US_STATES.find(([c]) => c === form.state)?.[1] ?? form.state
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Review your information</h2>
          <p className="text-gray-500 text-sm">Make sure everything looks right before we run the check.</p>
        </div>

        <div className="bg-indigo-50 rounded-xl p-5 space-y-3 border border-indigo-100">
          {[
            ['Household size', `${form.household_size} person${form.household_size !== 1 ? 's' : ''}`],
            ['State', stateName],
            ['Monthly income', `$${form.monthly_income.toLocaleString()}`],
            ['Employment', employLabel],
            ['Has children', form.has_children ? 'Yes' : 'No'],
            ['Has disability', form.has_disability ? 'Yes' : 'No'],
            ...(form.additional_context ? [['Additional context', form.additional_context]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Our AI navigator will check all 4 programs and give you a personalized action plan.
        </p>
      </div>
    )
  }

  const STEP_COMPONENTS = [Step0, Step1, Step2, Step3]
  const CurrentStep = STEP_COMPONENTS[step]

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
      <StepIndicator current={step} />
      <CurrentStep />

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={isLoading}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-md shadow-indigo-200">
            Continue
          </button>
        ) : (
          <button
            onClick={() => onSubmit(form)}
            disabled={isLoading}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition shadow-md shadow-indigo-200 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Checking eligibility…
              </>
            ) : 'Check My Eligibility'}
          </button>
        )}
      </div>
    </div>
  )
}
