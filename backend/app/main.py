"""
FastAPI application entry point.

Endpoints
─────────
GET  /health                      → liveness probe
POST /check-eligibility           → run agent, return full JSON
POST /check-eligibility/stream    → run agent, stream SSE events
GET  /profile/{profile_id}        → fetch saved profile + last result
"""
import asyncio
import json
import logging
import os
import re
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── Startup / shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    from .database import init_db
    init_db()
    logger.info("Benefits Navigator API ready.")
    yield


app = FastAPI(
    title="Benefits Eligibility Navigator",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ─────────────────────────────────────────────────

class UploadedDocument(BaseModel):
    name: str
    mime_type: str = ""
    size_bytes: int = 0
    server_path: str = ""


class EligibilityRequest(BaseModel):
    household_size:    int   = Field(default=1,  ge=1, le=20)
    state:             str   = Field(default="TX", min_length=2, max_length=2)
    monthly_income:    float = Field(default=0.0, ge=0)
    employment_status: str   = Field(default="unemployed")
    has_children:      bool  = Field(default=False)
    has_disability:    bool  = Field(default=False)
    language:          str   = Field(default="en", min_length=2, max_length=2)
    caseworker_mode:   bool  = Field(default=False)
    case_label:        str   = Field(default="", max_length=120)
    uploaded_documents: list[UploadedDocument] = Field(default_factory=list)
    additional_context: str  = Field(default="")


def _normalize_language(lang: str) -> str:
    lang = (lang or "en").lower()
    return lang if lang in {"en", "es"} else "en"


def _serialize_uploaded_documents(req: EligibilityRequest) -> list[dict]:
    return [doc.model_dump() for doc in req.uploaded_documents]


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "benefits-navigator"}


# ── POST /check-eligibility  (blocking, returns full JSON) ────────────────────

@app.post("/check-eligibility")
async def check_eligibility(req: EligibilityRequest):
    from .agent import run_agent_stream
    from .analysis import build_structured_analysis
    from .database import save_profile, save_result_with_analysis

    user_data = req.model_dump()
    user_data["language"] = _normalize_language(req.language)
    queue: asyncio.Queue = asyncio.Queue()

    final_answer = await run_agent_stream(user_data, queue)
    analysis = build_structured_analysis(user_data)

    profile_id = save_profile(
        household_size=req.household_size,
        state=req.state,
        monthly_income=req.monthly_income,
        employment_status=req.employment_status,
        has_children=req.has_children,
        has_disability=req.has_disability,
        language=user_data["language"],
        caseworker_mode=req.caseworker_mode,
        case_label=req.case_label,
        uploaded_documents=_serialize_uploaded_documents(req),
        additional_context=req.additional_context,
    )
    if profile_id:
        save_result_with_analysis(profile_id, final_answer, analysis)

    return {
        "profile_id": profile_id,
        "answer": final_answer,
        "analysis": analysis,
    }


# ── POST /check-eligibility/stream  (SSE) ─────────────────────────────────────

@app.post("/check-eligibility/stream")
async def stream_eligibility(req: EligibilityRequest):
    from .agent import run_agent_stream
    from .analysis import build_structured_analysis
    from .database import save_profile, save_result_with_analysis

    user_data = req.model_dump()
    user_data["language"] = _normalize_language(req.language)
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    final_parts: list[str] = []

    async def event_generator():
        # Kick off the agent in the background
        agent_task = asyncio.create_task(run_agent_stream(user_data, queue))

        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=60.0)
            except asyncio.TimeoutError:
                yield {"event": "error", "data": "Agent timed out."}
                break

            event_type = item["type"]
            content    = item["content"]

            if event_type == "token":
                final_parts.append(content)

            yield {"event": event_type, "data": content}

            if event_type in ("done", "error"):
                break

        # Persist after streaming completes.
        task_answer = await agent_task
        full_answer = "".join(final_parts).strip() or task_answer
        analysis = build_structured_analysis(user_data)
        yield {"event": "analysis", "data": json.dumps(analysis)}

        if full_answer:
            profile_id = save_profile(
                household_size=req.household_size,
                state=req.state,
                monthly_income=req.monthly_income,
                employment_status=req.employment_status,
                has_children=req.has_children,
                has_disability=req.has_disability,
                language=user_data["language"],
                caseworker_mode=req.caseworker_mode,
                case_label=req.case_label,
                uploaded_documents=_serialize_uploaded_documents(req),
                additional_context=req.additional_context,
            )
            if profile_id:
                save_result_with_analysis(profile_id, full_answer, analysis)
                # Send profile_id so frontend can bookmark it
                yield {"event": "profile_id", "data": str(profile_id)}

    return EventSourceResponse(event_generator())


@app.post("/documents/upload")
async def upload_documents(files: list[UploadFile] = File(...)):
    uploaded = []
    rejected = []

    for file in files:
        raw = await file.read()
        size = len(raw)
        suffix = Path(file.filename or "").suffix.lower()
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename or "document")

        if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".txt"}:
            rejected.append({"name": file.filename, "reason": "unsupported_file_type"})
            continue
        if size > 5 * 1024 * 1024:
            rejected.append({"name": file.filename, "reason": "file_too_large"})
            continue

        server_name = f"{os.urandom(6).hex()}_{safe_name}"
        path = UPLOAD_DIR / server_name
        path.write_bytes(raw)

        uploaded.append(
            {
                "name": safe_name,
                "mime_type": file.content_type or "",
                "size_bytes": size,
                "server_path": str(path),
            }
        )

    return {"uploaded": uploaded, "rejected": rejected}


# ── GET /profile/{profile_id} ─────────────────────────────────────────────────

@app.get("/profile/{profile_id}")
async def get_profile(profile_id: int):
    from .analysis import build_structured_analysis
    from .database import get_profile as db_get_profile

    data = db_get_profile(profile_id)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found.")

    profile = data.get("profile") or {}
    latest = data.get("latest_result") or {}
    if not latest.get("analysis"):
        latest["analysis"] = build_structured_analysis(profile)
    data["latest_result"] = latest
    return data
