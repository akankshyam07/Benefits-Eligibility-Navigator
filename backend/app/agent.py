"""
LangChain ReAct agent powered by Groq (LLaMA 3 70B).

Streaming architecture
──────────────────────
An asyncio.Queue bridges the sync LangChain callbacks and the async SSE
generator.  The callback handler:
  • emits "step" events for every tool call / result
  • emits "token" events for each word in the Final Answer
  • emits "done" when the agent finishes or errors
"""
import asyncio
import logging
import os
from typing import Any

from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.callbacks.base import BaseCallbackHandler
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq

from .tools import calculate_eligibility, check_eligibility_rules, search_benefits_gov

logger = logging.getLogger(__name__)

TOOLS = [search_benefits_gov, check_eligibility_rules, calculate_eligibility]

# ── Prompt ────────────────────────────────────────────────────────────────────

_PROMPT_TEMPLATE = """\
You are a compassionate Benefits Eligibility Navigator helping people in \
financial hardship discover government assistance programs they qualify for.

RULES YOU MUST FOLLOW:
1. Always check ALL FOUR programs: SNAP, Medicaid, EITC, and Section 8.
2. If someone mentions recent job loss, treat income as $0 even if income was entered.
3. Speak in plain English — no government jargon.
4. Be warm, encouraging, and non-judgmental.
5. End every response with a PRIORITIZED ACTION PLAN that includes direct links.

Available tools:
{tools}

Use EXACTLY this format — do not deviate:

Question: the input question you must answer
Thought: think step-by-step about what to do
Action: the action to take, must be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (repeat Thought/Action/Action Input/Observation as many times as needed)
Thought: I now know the final answer
Final Answer: [Your complete, friendly assessment — include all 4 programs,
plain-English explanations, and finish with:]

## Your Prioritized Action Plan
1. [Highest priority program] – Apply at [direct URL]
2. [Second priority] – Apply at [direct URL]
3. [Third priority] – Apply at [direct URL]
4. [Fourth priority] – Apply at [direct URL]

Application links:
• SNAP:      https://www.benefits.gov/benefit/361
• Medicaid:  https://www.healthcare.gov/medicaid-chip/
• EITC:      https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc
• Section 8: https://www.hud.gov/topics/housing_choice_voucher_program_section_8

Question: {input}
Thought:{agent_scratchpad}"""

REACT_PROMPT = PromptTemplate.from_template(_PROMPT_TEMPLATE)


# ── Streaming callback ────────────────────────────────────────────────────────

class _StreamingCallback(BaseCallbackHandler):
    """Routes agent events into an asyncio.Queue for SSE delivery."""

    def __init__(self, queue: asyncio.Queue) -> None:
        super().__init__()
        self._queue = queue
        self._llm_buf = ""
        self._in_final_answer = False

    # Tool events → "step"
    def on_tool_start(
        self, serialized: dict, input_str: str, **kwargs: Any
    ) -> None:
        name = serialized.get("name", "tool")
        friendly = {
            "search_benefits_gov": "Searching Benefits.gov…",
            "check_eligibility_rules": "Looking up eligibility rules…",
            "calculate_eligibility": "Running eligibility calculation…",
        }.get(name, f"Using {name}…")
        self._put("step", friendly)

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        preview = str(output).strip()[:180].replace("\n", " ")
        self._put("step", f"Got result: {preview}…")

    # LLM streaming → "token" (only after "Final Answer:")
    def on_llm_start(self, *args: Any, **kwargs: Any) -> None:
        self._llm_buf = ""
        self._in_final_answer = False

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self._llm_buf += token
        if self._in_final_answer:
            self._put("token", token)
        elif "Final Answer:" in self._llm_buf:
            self._in_final_answer = True
            after = self._llm_buf.split("Final Answer:", 1)[1].lstrip(" \n")
            if after:
                self._put("token", after)

    def on_agent_finish(self, finish: Any, **kwargs: Any) -> None:
        # Fallback: if streaming tokens never fired, send the full output now
        if not self._in_final_answer:
            output = finish.return_values.get("output", "")
            for word in output.split(" "):
                if word:
                    self._put("token", word + " ")
        self._put("done", "")

    def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        self._put("error", f"LLM error: {error}")
        self._put("done", "")

    def on_tool_error(self, error: Exception, **kwargs: Any) -> None:
        self._put("step", f"Tool error (skipping): {error}")

    def _put(self, event_type: str, content: str) -> None:
        try:
            self._queue.put_nowait({"type": event_type, "content": content})
        except asyncio.QueueFull:
            pass


# ── Public helpers ────────────────────────────────────────────────────────────

def build_user_prompt(data: dict) -> str:
    """Convert form data dict into a natural-language prompt for the agent."""
    income = data.get("monthly_income", 0)
    employment = data.get("employment_status", "unknown")
    ctx = data.get("additional_context", "").strip()

    # Infer zero/low income if recently unemployed
    if "recent" in employment.lower() or "loss" in employment.lower() or "unemployed" in employment.lower():
        income_str = f"${income}/month (recently lost job — income may be $0 now)"
    else:
        income_str = f"${income}/month"

    lines = [
        f"Household size: {data.get('household_size', 1)} person(s)",
        f"State: {data.get('state', 'TX')}",
        f"Monthly gross income: {income_str}",
        f"Employment status: {employment}",
        f"Has dependent children: {data.get('has_children', False)}",
        f"Has disability in household: {data.get('has_disability', False)}",
    ]
    if ctx:
        lines.append(f"Additional context: {ctx}")

    return (
        "Please check my eligibility for all government assistance programs. "
        "Here is my situation:\n" + "\n".join(lines)
    )


def _make_executor(callback: _StreamingCallback) -> AgentExecutor:
    llm = ChatGroq(
        model="llama3-70b-8192",
        temperature=0.1,
        streaming=True,
        api_key=os.getenv("GROQ_API_KEY"),
        callbacks=[callback],
    )
    agent = create_react_agent(llm=llm, tools=TOOLS, prompt=REACT_PROMPT)
    return AgentExecutor(
        agent=agent,
        tools=TOOLS,
        verbose=False,
        handle_parsing_errors=True,
        max_iterations=12,
        callbacks=[callback],
    )


async def run_agent_stream(user_data: dict, queue: asyncio.Queue) -> str:
    """
    Run the ReAct agent in a thread executor, streaming events into *queue*.
    Returns the final answer string (also available via token events).
    """
    callback = _StreamingCallback(queue)
    prompt = build_user_prompt(user_data)

    loop = asyncio.get_event_loop()
    try:
        executor = _make_executor(callback)
        result = await loop.run_in_executor(
            None,
            lambda: executor.invoke({"input": prompt}),
        )
        return result.get("output", "")
    except Exception as exc:
        logger.exception("Agent error")
        callback._put("error", f"Agent error: {exc}")
        callback._put("done", "")
        return f"Error: {exc}"
