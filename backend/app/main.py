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
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

class EligibilityRequest(BaseModel):
    household_size:    int   = Field(default=1,  ge=1, le=20)
    state:             str   = Field(default="TX", min_length=2, max_length=2)
    monthly_income:    float = Field(default=0.0, ge=0)
    employment_status: str   = Field(default="unemployed")
    has_children:      bool  = Field(default=False)
    has_disability:    bool  = Field(default=False)
    additional_context: str  = Field(default="")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "benefits-navigator"}


# ── POST /check-eligibility  (blocking, returns full JSON) ────────────────────

@app.post("/check-eligibility")
async def check_eligibility(req: EligibilityRequest):
    from .agent import build_user_prompt, run_agent_stream
    from .database import save_profile, save_result

    user_data = req.model_dump()
    queue: asyncio.Queue = asyncio.Queue()

    final_answer = await run_agent_stream(user_data, queue)

    profile_id = save_profile(
        household_size=req.household_size,
        state=req.state,
        monthly_income=req.monthly_income,
        employment_status=req.employment_status,
        has_children=req.has_children,
        has_disability=req.has_disability,
        additional_context=req.additional_context,
    )
    if profile_id:
        save_result(profile_id, final_answer)

    return {
        "profile_id": profile_id,
        "answer": final_answer,
    }


# ── POST /check-eligibility/stream  (SSE) ─────────────────────────────────────

@app.post("/check-eligibility/stream")
async def stream_eligibility(req: EligibilityRequest):
    from .agent import run_agent_stream
    from .database import save_profile, save_result

    user_data = req.model_dump()
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

        # Persist after streaming completes
        full_answer = "".join(final_parts)
        if full_answer:
            profile_id = save_profile(
                household_size=req.household_size,
                state=req.state,
                monthly_income=req.monthly_income,
                employment_status=req.employment_status,
                has_children=req.has_children,
                has_disability=req.has_disability,
                additional_context=req.additional_context,
            )
            if profile_id:
                save_result(profile_id, full_answer)
                # Send profile_id so frontend can bookmark it
                yield {"event": "profile_id", "data": str(profile_id)}

        await agent_task  # ensure task is cleaned up

    return EventSourceResponse(event_generator())


# ── GET /profile/{profile_id} ─────────────────────────────────────────────────

@app.get("/profile/{profile_id}")
async def get_profile(profile_id: int):
    from .database import get_profile as db_get_profile
    data = db_get_profile(profile_id)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return data
