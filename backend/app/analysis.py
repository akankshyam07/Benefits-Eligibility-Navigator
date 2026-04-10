"""Structured, deterministic eligibility analysis used by API responses."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

_FPL = {
    "default": {"base": 15060, "step": 5380},
    "AK": {"base": 18810, "step": 6730},
    "HI": {"base": 17310, "step": 6190},
}

MEDICAID_NON_EXPANSION_STATES = {
    "TX", "FL", "GA", "SC", "NC", "TN", "AL", "MS", "KS", "WI", "WY", "SD", "ID"
}

PROGRAM_LINKS = {
    "SNAP": "https://www.benefits.gov/benefit/361",
    "Medicaid": "https://www.healthcare.gov/medicaid-chip/",
    "EITC": "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc",
    "Section 8": "https://www.hud.gov/topics/housing_choice_voucher_program_section_8",
}


def _t(lang: str, en: str, es: str) -> str:
    return es if lang == "es" else en


def _annual_fpl(household_size: int, state: str) -> float:
    cfg = _FPL.get((state or "").upper(), _FPL["default"])
    size = max(1, int(household_size or 1))
    return cfg["base"] + max(0, size - 1) * cfg["step"]


def _status_from_score(score: int, lang: str) -> tuple[str, str]:
    if score >= 75:
        return "likely_eligible", _t(lang, "Likely eligible", "Posible elegibilidad")
    if score >= 50:
        return "check_details", _t(lang, "Needs review", "Requiere revision")
    return "unlikely", _t(lang, "Less likely", "Menos probable")


def _money(amount: float) -> str:
    return f"${amount:,.0f}"


@dataclass
class Inputs:
    household_size: int
    state: str
    monthly_income: float
    annual_income: float
    has_children: bool
    has_disability: bool
    language: str


def _snap(inp: Inputs) -> dict[str, Any]:
    fpl_monthly = _annual_fpl(inp.household_size, inp.state) / 12
    gross_limit = fpl_monthly * 1.30
    pct_fpl = (inp.monthly_income / fpl_monthly * 100) if fpl_monthly else 0
    eligible = inp.monthly_income <= gross_limit

    est = 0
    if eligible:
        est = int(max(100, 291 + (inp.household_size - 1) * 211 - inp.monthly_income * 0.30))

    score = 90 if eligible else (66 if inp.monthly_income <= gross_limit * 1.15 else 36)
    if inp.has_children:
        score += 4
    if inp.has_disability:
        score += 3
    if inp.monthly_income == 0:
        score += 5
    score = max(0, min(99, score))

    status, status_label = _status_from_score(score, inp.language)
    reasons = [
        _t(
            inp.language,
            f"Income is about {pct_fpl:.0f}% of the federal poverty level.",
            f"El ingreso es aproximadamente {pct_fpl:.0f}% del nivel federal de pobreza.",
        ),
        _t(
            inp.language,
            f"Estimated SNAP gross income limit for your household is {_money(gross_limit)} per month.",
            f"El limite estimado de ingreso bruto para SNAP en su hogar es {_money(gross_limit)} por mes.",
        ),
    ]
    if inp.has_disability:
        reasons.append(
            _t(
                inp.language,
                "Disability-related deductions can improve SNAP eligibility.",
                "Las deducciones por discapacidad pueden mejorar la elegibilidad para SNAP.",
            )
        )

    return {
        "id": "snap",
        "name": "SNAP",
        "status": status,
        "status_label": status_label,
        "priority_score": score,
        "estimated_value": _t(inp.language, f"About {_money(est)}/month", f"Aproximadamente {_money(est)}/mes") if est else _t(inp.language, "Varies by deductions", "Varia segun deducciones"),
        "why": reasons,
        "apply_url": PROGRAM_LINKS["SNAP"],
        "next_step": _t(
            inp.language,
            "Start the SNAP application with your state benefits office.",
            "Inicie la solicitud de SNAP con la oficina de beneficios de su estado.",
        ),
    }


def _medicaid(inp: Inputs) -> dict[str, Any]:
    fpl_monthly = _annual_fpl(inp.household_size, inp.state) / 12
    limit_138 = fpl_monthly * 1.38
    pct_fpl = (inp.monthly_income / fpl_monthly * 100) if fpl_monthly else 0
    expansion = inp.state not in MEDICAID_NON_EXPANSION_STATES

    likely_income_eligible = inp.monthly_income <= limit_138
    qualifies_via_group = inp.has_children or inp.has_disability

    if expansion and likely_income_eligible:
        score = 88
    elif qualifies_via_group:
        score = 70
    elif likely_income_eligible:
        score = 64
    else:
        score = 35

    status, status_label = _status_from_score(score, inp.language)

    reasons = [
        _t(
            inp.language,
            f"Income is about {pct_fpl:.0f}% of the federal poverty level.",
            f"El ingreso es aproximadamente {pct_fpl:.0f}% del nivel federal de pobreza.",
        ),
        _t(
            inp.language,
            f"General Medicaid income benchmark is about {_money(limit_138)} per month for this household size.",
            f"La referencia general de ingreso para Medicaid es de aproximadamente {_money(limit_138)} por mes para este tamano de hogar.",
        ),
        _t(
            inp.language,
            "Your state expansion status can change who qualifies.",
            "La expansion de Medicaid en su estado puede cambiar quien califica.",
        ) if not expansion else _t(
            inp.language,
            "Your state expanded Medicaid, which usually improves adult eligibility.",
            "Su estado amplio Medicaid, lo que suele mejorar la elegibilidad de adultos.",
        ),
    ]
    if qualifies_via_group:
        reasons.append(
            _t(
                inp.language,
                "Children or disability in the household can open additional Medicaid paths.",
                "Tener ninos o discapacidad en el hogar puede abrir rutas adicionales de Medicaid.",
            )
        )

    return {
        "id": "medicaid",
        "name": "Medicaid",
        "status": status,
        "status_label": status_label,
        "priority_score": score,
        "estimated_value": _t(
            inp.language,
            "Health coverage can save hundreds per month",
            "La cobertura medica puede ahorrar cientos por mes",
        ),
        "why": reasons,
        "apply_url": PROGRAM_LINKS["Medicaid"],
        "next_step": _t(
            inp.language,
            "Check your state Medicaid site and submit an application or pre-screening.",
            "Revise el sitio de Medicaid de su estado y envie una solicitud o preevaluacion.",
        ),
    }


def _eitc(inp: Inputs) -> dict[str, Any]:
    if not inp.has_children:
        income_limit, max_credit, bracket = 18591, 632, _t(inp.language, "no qualifying children", "sin hijos calificados")
    elif inp.household_size <= 2:
        income_limit, max_credit, bracket = 49084, 3995, _t(inp.language, "1 qualifying child", "1 hijo calificado")
    elif inp.household_size <= 3:
        income_limit, max_credit, bracket = 55768, 6604, _t(inp.language, "2 qualifying children", "2 hijos calificados")
    else:
        income_limit, max_credit, bracket = 59899, 7430, _t(inp.language, "3 or more qualifying children", "3 o mas hijos calificados")

    has_earned_income = inp.annual_income > 0
    eligible = has_earned_income and inp.annual_income <= income_limit
    if eligible:
        phase = min(1.0, inp.annual_income / income_limit)
        estimate = int(max_credit * max(0.35, 1 - 0.65 * phase))
    else:
        estimate = 0

    score = 76 if eligible else (54 if has_earned_income else 28)
    status, status_label = _status_from_score(score, inp.language)

    reasons = [
        _t(
            inp.language,
            f"EITC income limit for {bracket} is about {_money(income_limit)} per year.",
            f"El limite de ingreso del EITC para {bracket} es de aproximadamente {_money(income_limit)} al ano.",
        ),
        _t(
            inp.language,
            f"Your current annual income is {_money(inp.annual_income)}.",
            f"Su ingreso anual actual es {_money(inp.annual_income)}.",
        ),
        _t(
            inp.language,
            "EITC requires earned income from work.",
            "El EITC requiere ingreso ganado por trabajo.",
        ),
    ]

    return {
        "id": "eitc",
        "name": "EITC",
        "status": status,
        "status_label": status_label,
        "priority_score": score,
        "estimated_value": _t(inp.language, f"About {_money(estimate)} tax credit", f"Aproximadamente {_money(estimate)} de credito") if estimate else _t(inp.language, f"Up to {_money(max_credit)}", f"Hasta {_money(max_credit)}"),
        "why": reasons,
        "apply_url": PROGRAM_LINKS["EITC"],
        "next_step": _t(
            inp.language,
            "Claim EITC on your federal tax return when you file.",
            "Reclame el EITC en su declaracion federal de impuestos al presentar.",
        ),
    }


def _section8(inp: Inputs) -> dict[str, Any]:
    fpl_monthly = _annual_fpl(inp.household_size, inp.state) / 12
    ami50 = fpl_monthly * 2.0
    ami30 = fpl_monthly * 1.2

    eligible = inp.monthly_income <= ami50
    priority_waitlist = inp.monthly_income <= ami30

    if eligible:
        score = 84 + (6 if priority_waitlist else 0)
    elif inp.monthly_income <= ami50 * 1.15:
        score = 58
    else:
        score = 34

    est_subsidy = int(max(300, min(1500, 850 + inp.household_size * 95 - inp.monthly_income * 0.10))) if eligible else 0
    status, status_label = _status_from_score(score, inp.language)

    reasons = [
        _t(
            inp.language,
            f"Estimated Section 8 screening threshold is about {_money(ami50)} monthly income for your household size.",
            f"El umbral estimado de evaluacion de Section 8 es de aproximadamente {_money(ami50)} de ingreso mensual para su hogar.",
        ),
        _t(
            inp.language,
            "Section 8 waitlists can be long, so early application matters.",
            "Las listas de espera de Section 8 pueden ser largas, por lo que aplicar temprano es importante.",
        ),
    ]
    if priority_waitlist:
        reasons.append(
            _t(
                inp.language,
                "Income appears very low relative to local thresholds, which can increase waitlist priority.",
                "El ingreso parece muy bajo frente a los umbrales locales, lo que puede aumentar la prioridad en la lista de espera.",
            )
        )

    return {
        "id": "section8",
        "name": "Section 8",
        "status": status,
        "status_label": status_label,
        "priority_score": score,
        "estimated_value": _t(inp.language, f"About {_money(est_subsidy)}/month rent support", f"Aproximadamente {_money(est_subsidy)}/mes en apoyo de renta") if est_subsidy else _t(inp.language, "Depends on local rent and PHA rules", "Depende de la renta local y las reglas de la PHA"),
        "why": reasons,
        "apply_url": PROGRAM_LINKS["Section 8"],
        "next_step": _t(
            inp.language,
            "Find your local housing authority and join open waitlists now.",
            "Busque su autoridad local de vivienda y unase a las listas de espera abiertas ahora.",
        ),
    }


def build_structured_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    lang = str(payload.get("language", "en") or "en").lower()
    if lang not in {"en", "es"}:
        lang = "en"

    household_size = int(payload.get("household_size", 1) or 1)
    state = str(payload.get("state", "TX") or "TX").upper()
    monthly_income = float(payload.get("monthly_income", 0.0) or 0.0)
    annual_income = monthly_income * 12
    has_children = bool(payload.get("has_children", False))
    has_disability = bool(payload.get("has_disability", False))

    inp = Inputs(
        household_size=max(1, household_size),
        state=state,
        monthly_income=max(0.0, monthly_income),
        annual_income=max(0.0, annual_income),
        has_children=has_children,
        has_disability=has_disability,
        language=lang,
    )

    programs = [_snap(inp), _medicaid(inp), _eitc(inp), _section8(inp)]
    programs.sort(key=lambda p: p["priority_score"], reverse=True)

    for idx, program in enumerate(programs, start=1):
        program["priority_rank"] = idx

    action_plan = [
        {
            "rank": idx,
            "program": p["name"],
            "title": _t(
                lang,
                f"Apply for {p['name']} first",
                f"Solicite {p['name']} primero",
            ),
            "reason": p["why"][0],
            "url": p["apply_url"],
        }
        for idx, p in enumerate(programs, start=1)
    ]

    resources = [
        {
            "program": "SNAP",
            "label": _t(lang, "SNAP application portal", "Portal de solicitud SNAP"),
            "url": PROGRAM_LINKS["SNAP"],
        },
        {
            "program": "Medicaid",
            "label": _t(lang, "Medicaid and CHIP portal", "Portal de Medicaid y CHIP"),
            "url": PROGRAM_LINKS["Medicaid"],
        },
        {
            "program": "EITC",
            "label": _t(lang, "IRS EITC eligibility and filing help", "Ayuda del IRS para elegibilidad y declaracion EITC"),
            "url": PROGRAM_LINKS["EITC"],
        },
        {
            "program": "Section 8",
            "label": _t(lang, "HUD housing voucher information", "Informacion de HUD sobre vales de vivienda"),
            "url": PROGRAM_LINKS["Section 8"],
        },
        {
            "program": "All",
            "label": _t(lang, "Benefits.gov screening tool", "Herramienta de evaluacion en Benefits.gov"),
            "url": "https://www.benefits.gov/",
        },
    ]

    checklist_template = [
        {
            "id": "id_docs",
            "label": _t(
                lang,
                "Gather ID and Social Security information for each household member",
                "Reuna identificacion e informacion de Seguro Social para cada miembro del hogar",
            ),
        },
        {
            "id": "income_docs",
            "label": _t(
                lang,
                "Collect recent pay stubs, unemployment letters, or tax forms",
                "Reuna talones de pago recientes, cartas de desempleo o formularios de impuestos",
            ),
        },
        {
            "id": "apply_top2",
            "label": _t(
                lang,
                "Apply to your top two programs this week",
                "Solicite sus dos programas principales esta semana",
            ),
        },
        {
            "id": "follow_up",
            "label": _t(
                lang,
                "Track confirmation numbers and follow up within 10 days",
                "Guarde numeros de confirmacion y haga seguimiento dentro de 10 dias",
            ),
        },
    ]

    transparency = [
        _t(
            lang,
            "This result combines rule-based calculations with AI text generation.",
            "Este resultado combina calculos basados en reglas con generacion de texto por IA.",
        ),
        _t(
            lang,
            "Income estimates are based on 2024 federal guidelines and may differ by county.",
            "Las estimaciones de ingreso se basan en pautas federales de 2024 y pueden variar por condado.",
        ),
        _t(
            lang,
            "Always confirm final eligibility with your local agency before making decisions.",
            "Confirme siempre la elegibilidad final con su agencia local antes de tomar decisiones.",
        ),
    ]

    summary = _t(
        lang,
        "These results are an early guide. Start with the top ranked programs and apply as soon as possible.",
        "Estos resultados son una guia inicial. Empiece con los programas de mayor prioridad y solicite cuanto antes.",
    )

    return {
        "language": lang,
        "summary": summary,
        "programs": programs,
        "action_plan": action_plan,
        "resource_links": resources,
        "checklist_template": checklist_template,
        "transparency": transparency,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
