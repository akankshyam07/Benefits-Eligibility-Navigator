# Benefits Eligibility Navigator

An AI-powered web app that helps people in financial hardship discover government assistance programs they qualify for — SNAP, Medicaid, EITC, and Section 8.

A LangChain ReAct agent powered by Groq (LLaMA 3 70B) checks all four programs, explains eligibility in plain English, and ends every response with a prioritized action plan and direct application links.

![Benefits Navigator](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-6366f1?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203%2070B%20via%20Groq-orange?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **4-step form** — household size, income, employment status, disability/children
- **Live agent reasoning** — watch the AI check each program in real time via SSE streaming
- **Deterministic FPL math** — SNAP (130% FPL), Medicaid (138% FPL), EITC (2024 limits), Section 8 (50% AMI)
- **RAG over eligibility PDFs** — drop your own PDFs into `backend/data/` and ingest them into Pinecone
- **MySQL persistence** — saves every profile and result for later retrieval
- **Graceful degradation** — works without Pinecone or MySQL (falls back to hardcoded 2024 rules)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, LangChain, Groq (LLaMA 3 70B) |
| Vector store | Pinecone + sentence-transformers/all-MiniLM-L6-v2 |
| Database | MySQL |
| Frontend | React 18, Vite, TailwindCSS |
| Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app, CORS, SSE endpoint
│   │   ├── agent.py       # LangChain ReAct agent + streaming callbacks
│   │   ├── tools.py       # Benefits.gov API, Pinecone RAG, FPL calculator
│   │   └── database.py    # MySQL: profiles + results
│   ├── ingest.py          # One-time PDF → Pinecone ingestion
│   ├── data/              # Drop eligibility PDFs here
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── Header.jsx
            ├── StepForm.jsx      # 4-step form
            └── ResultsPanel.jsx  # Live agent steps + streaming answer
```

---

## Getting Started

### 1. Get free API keys

- **Groq** — [console.groq.com](https://console.groq.com) → API Keys (free, fast LLaMA 3)
- **Pinecone** — [app.pinecone.io](https://app.pinecone.io) → Starter tier is free (optional — app works without it)

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Fill in GROQ_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME, MySQL creds

uvicorn app.main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. (Optional) Ingest eligibility PDFs

Drop PDF files into `backend/data/`, then:

```bash
cd backend
source .venv/bin/activate
python ingest.py
```

This chunks the PDFs, embeds them locally, and upserts to Pinecone.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `POST` | `/check-eligibility` | Run agent, return full JSON |
| `POST` | `/check-eligibility/stream` | Run agent, stream SSE events |
| `GET` | `/profile/{id}` | Fetch saved profile + last result |

---

## Environment Variables

```env
GROQ_API_KEY=           # Required
PINECONE_API_KEY=       # Optional
PINECONE_INDEX_NAME=    # Optional (default: benefits-eligibility)
MYSQL_HOST=             # Optional (default: localhost)
MYSQL_USER=             # Optional
MYSQL_PASSWORD=         # Optional
MYSQL_DB=               # Optional (default: benefits_navigator)
```

---

## Disclaimer

This tool provides general information only and is not legal or financial advice. Always verify eligibility directly with the relevant government agency.
