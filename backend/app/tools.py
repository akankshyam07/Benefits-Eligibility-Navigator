"""
Three LangChain tools for the ReAct agent:

1. search_benefits_gov   – calls Benefits.gov public API
2. check_eligibility_rules – RAG over Pinecone (falls back to hardcoded rules)
3. calculate_eligibility – deterministic FPL math
"""
import os
import logging
from functools import lru_cache

import requests
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# ─── Federal Poverty Level 2024 ──────────────────────────────────────────────

_FPL = {
    "default": {"base": 15060, "step": 5380},
    "AK":      {"base": 18810, "step": 6730},
    "HI":      {"base": 17310, "step": 6190},
}


def _annual_fpl(household_size: int, state: str) -> float:
    cfg = _FPL.get(state.upper(), _FPL["default"])
    size = max(1, household_size)
    return cfg["base"] + max(0, size - 1) * cfg["step"]


# ─── Lazy-load embedding model ───────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_embedding_model():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading sentence-transformer model (first call only)…")
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


# ─── Tool 1 – Benefits.gov search ────────────────────────────────────────────

@tool
def search_benefits_gov(query: str) -> str:
    """
    Search Benefits.gov for government assistance programs.
    Use this to discover programs matching a person's situation.
    Input: a plain-English search query describing the person's needs.
    """
    try:
        # Benefits.gov public search endpoint
        url = "https://api.findABenefit.gov/benefits/benefit"
        resp = requests.get(
            url,
            params={"query": query, "language": "en"},
            timeout=8,
            headers={"User-Agent": "BenefitsNavigator/1.0"},
        )
        if resp.ok:
            data = resp.json()
            items = data.get("data", data.get("benefits", []))[:5]
            if items:
                lines = []
                for b in items:
                    title = b.get("benefit_name") or b.get("title", "N/A")
                    summary = b.get("one_liner") or b.get("summary", "")
                    lines.append(f"• {title}: {summary[:200]}")
                return "\n".join(lines)
        return (
            "Benefits.gov returned no results for that query. "
            "Using built-in program knowledge instead."
        )
    except Exception as exc:
        return (
            f"Benefits.gov unreachable ({exc.__class__.__name__}). "
            "Proceeding with built-in knowledge."
        )


# ─── Tool 2 – Pinecone RAG ────────────────────────────────────────────────────

@tool
def check_eligibility_rules(query: str) -> str:
    """
    Look up detailed eligibility rules and requirements from official documents.
    Use this to find specific income limits, documentation needed, or program details.
    Input: a plain-English question about program requirements.
    """
    pinecone_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME", "benefits-eligibility")

    if pinecone_key:
        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=pinecone_key)
            index = pc.Index(index_name)
            embedding = _get_embedding_model().encode(query).tolist()
            results = index.query(vector=embedding, top_k=3, include_metadata=True)
            chunks = [
                m.metadata.get("text", "")
                for m in results.matches
                if m.metadata.get("text")
            ]
            if chunks:
                return "\n\n---\n\n".join(c[:600] for c in chunks)
        except Exception as exc:
            logger.warning("Pinecone query failed: %s", exc)

    return _fallback_rules(query)


def _fallback_rules(query: str) -> str:
    """Return hardcoded 2024 eligibility rules when Pinecone is unavailable."""
    db = {
        "snap": """\
SNAP (Supplemental Nutrition Assistance Program) – 2024 Rules
• Gross income limit: 130% of Federal Poverty Level (FPL)
• Net income limit: 100% FPL after deductions
• Asset limit: $2,750 (or $4,250 if elderly/disabled member)
• Must be a U.S. citizen or qualified non-citizen
• Able-bodied adults 18–49 without dependents: must work/train ≥20 hrs/week
• Apply: your state SNAP office or benefits.gov/snap""",

        "medicaid": """\
Medicaid – 2024 Rules
• ACA expansion states: income ≤ 138% FPL (covers most adults)
• Automatic eligibility: pregnant women, children <19, elderly 65+, disabled
• No asset test under ACA expansion for most adults
• Covers: doctor visits, hospital care, prescriptions, mental health, dental (varies)
• Apply: healthcare.gov or your state Medicaid office""",

        "eitc": """\
Earned Income Tax Credit (EITC) – 2024 Rules
• Must have earned income from work (wages, salary, self-employment)
• Investment income limit: $11,600/year
• No qualifying children: income < $18,591 | max credit $632
• 1 qualifying child:  income < $49,084 | max credit $3,995
• 2 qualifying children: income < $55,768 | max credit $6,604
• 3+ qualifying children: income < $59,899 | max credit $7,430
• Claim on federal tax return Form 1040 (Schedule EIC)""",

        "section8": """\
Section 8 / Housing Choice Voucher (HCV) – 2024 Rules
• Income limit: 50% of Area Median Income (AMI) for your county
• Priority placement: households below 30% AMI
• Must be a U.S. citizen or eligible non-citizen
• Background check and no outstanding debt to another housing authority
• Apply: your local Public Housing Authority (PHA) via hud.gov
• ⚠️ Waiting lists are often 1–3+ years – apply as soon as possible""",
    }
    q = query.lower()
    hits = []
    if any(w in q for w in ("snap", "food", "stamp", "nutrition", "grocery")):
        hits.append(db["snap"])
    if any(w in q for w in ("medicaid", "health", "medical", "insurance", "doctor")):
        hits.append(db["medicaid"])
    if any(w in q for w in ("eitc", "tax credit", "earned income", "tax return")):
        hits.append(db["eitc"])
    if any(w in q for w in ("section 8", "housing", "voucher", "rent", "apartment")):
        hits.append(db["section8"])
    return "\n\n---\n\n".join(hits) if hits else "\n\n---\n\n".join(db.values())


# ─── Tool 3 – FPL calculator ─────────────────────────────────────────────────

@tool
def calculate_eligibility(params: str) -> str:
    """
    Calculate eligibility for a specific benefit program using 2024 FPL math.
    Input format (pipe-separated): program|household_size|monthly_income|state|has_disability|has_children
    - program: SNAP, Medicaid, EITC, or Section8
    - household_size: integer (1–8+)
    - monthly_income: gross monthly income in dollars (use 0 for no income)
    - state: two-letter state code, e.g. TX
    - has_disability: true or false
    - has_children: true or false

    Example: SNAP|4|1800|TX|false|true
    """
    try:
        parts = [p.strip() for p in params.split("|")]
        program       = parts[0] if len(parts) > 0 else "SNAP"
        household_size = int(parts[1]) if len(parts) > 1 else 1
        monthly_income = float(parts[2]) if len(parts) > 2 else 0.0
        state         = parts[3].upper() if len(parts) > 3 else "TX"
        has_disability = (parts[4].lower() == "true") if len(parts) > 4 else False
        has_children  = (parts[5].lower() == "true") if len(parts) > 5 else False
    except (ValueError, IndexError) as exc:
        return (
            f"Could not parse parameters: {exc}. "
            "Expected: program|household_size|monthly_income|state|has_disability|has_children"
        )

    annual_income  = monthly_income * 12
    fpl_annual     = _annual_fpl(household_size, state)
    fpl_monthly    = fpl_annual / 12
    pct_fpl        = (monthly_income / fpl_monthly * 100) if fpl_monthly else 0

    p = program.upper().replace(" ", "").replace("-", "").replace("_", "")

    # ── SNAP ──────────────────────────────────────────────────────────────────
    if "SNAP" in p or "FOOD" in p or "STAMP" in p:
        gross_limit = fpl_monthly * 1.30
        net_limit   = fpl_monthly * 1.00
        eligible    = monthly_income <= gross_limit
        est_benefit = int(200 + household_size * 45) if eligible else 0
        return f"""\
SNAP Eligibility – {state}
  Status           : {"✅ LIKELY ELIGIBLE" if eligible else "❌ LIKELY NOT ELIGIBLE"}
  Your income      : ${monthly_income:,.2f}/mo  ({pct_fpl:.0f}% FPL)
  130% FPL limit   : ${gross_limit:,.2f}/mo  (gross)
  100% FPL limit   : ${net_limit:,.2f}/mo  (net after deductions)
  Household size   : {household_size}
  {"Est. monthly benefit: $" + str(est_benefit) if eligible else "Income exceeds gross limit."}
  {"Disability deduction may help lower net income further." if has_disability else ""}"""

    # ── Medicaid ───────────────────────────────────────────────────────────────
    if "MEDICAID" in p or "MEDICAL" in p:
        limit_138 = fpl_monthly * 1.38
        eligible  = monthly_income <= limit_138
        expanded  = state not in ("TX", "FL", "GA", "SC", "NC", "TN", "AL", "MS",
                                   "KS", "WI", "WY", "SD", "ID")
        return f"""\
Medicaid Eligibility – {state}
  Status           : {"✅ LIKELY ELIGIBLE" if eligible else "❌ LIKELY NOT ELIGIBLE"}
  Your income      : ${monthly_income:,.2f}/mo  ({pct_fpl:.0f}% FPL)
  138% FPL limit   : ${limit_138:,.2f}/mo
  {"✅ Your state has expanded Medicaid under the ACA." if expanded else "⚠️ Your state has NOT expanded Medicaid – check state-specific rules."}
  {"Pregnancy, disability, or children under 19 may expand your eligibility." if (has_children or has_disability) else ""}"""

    # ── EITC ───────────────────────────────────────────────────────────────────
    if "EITC" in p or "TAX" in p or "EARNED" in p:
        if not has_children:
            income_limit, max_credit, label = 18591, 632, "no qualifying children"
        elif household_size <= 2:
            income_limit, max_credit, label = 49084, 3995, "1 qualifying child"
        elif household_size <= 3:
            income_limit, max_credit, label = 55768, 6604, "2 qualifying children"
        else:
            income_limit, max_credit, label = 59899, 7430, "3+ qualifying children"
        eligible = 0 < annual_income <= income_limit
        return f"""\
EITC Eligibility
  Status           : {"✅ LIKELY ELIGIBLE" if eligible else "❌ LIKELY NOT ELIGIBLE"}
  Your annual income: ${annual_income:,.2f}
  Income limit ({label}): ${income_limit:,.2f}
  Maximum credit   : ${max_credit:,.2f}  (claimed on next tax return)
  {"Must have earned income > $0 from wages or self-employment." if annual_income == 0 else ""}"""

    # ── Section 8 ──────────────────────────────────────────────────────────────
    if "SECTION" in p or "HOUSING" in p or "VOUCHER" in p or "HCV" in p:
        # Approximate 50% AMI as 200% of FPL (very rough national average)
        ami_50_monthly = fpl_monthly * 2.0 * 0.50
        eligible = monthly_income <= ami_50_monthly
        priority = monthly_income <= ami_50_monthly * 0.60
        return f"""\
Section 8 / HCV Eligibility – {state}
  Status           : {"✅ LIKELY ELIGIBLE" if eligible else "❌ LIKELY NOT ELIGIBLE (income may exceed 50% AMI)"}
  Your income      : ${monthly_income:,.2f}/mo
  Est. 50% AMI limit: ${ami_50_monthly:,.2f}/mo  (approximate – verify with local PHA)
  {"⭐ Priority status: income is below 30% AMI – you may receive priority placement." if priority else ""}
  ⚠️ Waiting lists average 1–3 years. Apply immediately even if not currently homeless."""

    return (
        f"Unknown program '{program}'. "
        "Please use: SNAP, Medicaid, EITC, or Section8."
    )
