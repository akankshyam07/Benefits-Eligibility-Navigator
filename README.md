# Benefits Eligibility Navigator

Benefits Eligibility Navigator helps people quickly check if they might qualify for key U.S. support programs:
- SNAP
- Medicaid
- EITC
- Section 8

The app is designed to feel calm and easy to use. It gives a ranked action plan, explains why each program may fit, and links to official sites.

## What this app includes

- A clean landing page at `/`
- A separate eligibility workflow at `/navigator`
- Step by step intake form with simple language
- Program ranking with estimated value and reasons
- Action plan copy and download options
- English and Spanish UI
- Optional document upload (PDF, image, text)
- Local saved checks in browser storage (no account required)

## Tech stack

- Backend: FastAPI
- AI + tools: LangChain, Groq, rule based analysis
- Optional retrieval: Pinecone + sentence-transformers
- Optional persistence: MySQL
- Frontend: React, Vite, Tailwind CSS
- Routing: React Router
- Streaming: Server-Sent Events (SSE)

## Project structure

```text
backend/
  app/
    main.py
    agent.py
    analysis.py
    tools.py
    database.py
  ingest.py
  requirements.txt
  .env.example

frontend/
  src/
    App.jsx
    pages/
      LandingPage.jsx
      NavigatorPage.jsx
    components/
      Header.jsx
      StepForm.jsx
      ResultsPanel.jsx
```

## Local setup

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Add GROQ_API_KEY at minimum

uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:
- Landing page: http://localhost:5173/
- Navigator page: http://localhost:5173/navigator

## Optional: ingest your own PDF rules

Put PDF files in `backend/data/`, then run:

```bash
cd backend
source .venv/bin/activate
python ingest.py
```

## API endpoints

- `GET /health`
- `POST /check-eligibility`
- `POST /check-eligibility/stream`
- `POST /documents/upload`
- `GET /profile/{id}`

## Environment variables

```env
GROQ_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=benefits-eligibility
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=benefits_navigator
```

## Notes for open source use

- The frontend saves user checks in local browser storage by default.
- The current UI does not rely on numeric profile IDs.
- If you want shared multi-user history, add authentication and secure server-side ownership checks.

## Disclaimer

This tool provides general guidance only. It is not legal, tax, or financial advice. Always confirm final eligibility with official agencies.
