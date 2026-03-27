export default function Header() {
  return (
    <header className="bg-indigo-700 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-4">
        <div className="bg-indigo-500 rounded-xl p-2.5 flex-shrink-0">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Benefits Eligibility Navigator
          </h1>
          <p className="text-indigo-200 text-sm mt-0.5">
            Find the government assistance you qualify for — SNAP, Medicaid, EITC, Section 8
          </p>
        </div>
      </div>
    </header>
  )
}
