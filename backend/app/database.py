"""
MySQL persistence layer.
Tables are auto-created on startup.  All operations fail gracefully so the
app still works even when MySQL is not configured.
"""
import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def _get_connection():
    import mysql.connector
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "benefits_navigator"),
    )


def init_db() -> None:
    """Create tables if they don't exist."""
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                household_size  INT NOT NULL,
                state           VARCHAR(5) NOT NULL,
                monthly_income  DECIMAL(12,2) NOT NULL,
                employment_status VARCHAR(50),
                has_children    TINYINT(1) DEFAULT 0,
                has_disability  TINYINT(1) DEFAULT 0,
                language        VARCHAR(5) DEFAULT 'en',
                caseworker_mode TINYINT(1) DEFAULT 0,
                case_label      VARCHAR(120),
                uploaded_documents_json LONGTEXT,
                additional_context TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eligibility_results (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                profile_id   INT NOT NULL,
                raw_response LONGTEXT,
                analysis_json LONGTEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES profiles(id)
            )
        """)

        # Lightweight schema migration for existing installs.
        for sql in (
            "ALTER TABLE profiles ADD COLUMN language VARCHAR(5) DEFAULT 'en'",
            "ALTER TABLE profiles ADD COLUMN caseworker_mode TINYINT(1) DEFAULT 0",
            "ALTER TABLE profiles ADD COLUMN case_label VARCHAR(120)",
            "ALTER TABLE profiles ADD COLUMN uploaded_documents_json LONGTEXT",
            "ALTER TABLE eligibility_results ADD COLUMN analysis_json LONGTEXT",
        ):
            try:
                cursor.execute(sql)
            except Exception:
                pass

        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.warning("MySQL not available – running without persistence. (%s)", exc)


def save_profile(
    household_size: int,
    state: str,
    monthly_income: float,
    employment_status: str,
    has_children: bool,
    has_disability: bool,
    language: str,
    caseworker_mode: bool,
    case_label: str,
    uploaded_documents: list[dict],
    additional_context: str,
) -> Optional[int]:
    """Insert a profile row and return its id (or None on failure)."""
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO profiles
               (household_size, state, monthly_income, employment_status,
                has_children, has_disability, language, caseworker_mode, case_label,
                uploaded_documents_json, additional_context)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                household_size, state, monthly_income, employment_status,
                int(has_children), int(has_disability), language, int(caseworker_mode),
                case_label, json.dumps(uploaded_documents or []), additional_context,
            ),
        )
        profile_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        return profile_id
    except Exception as exc:
        logger.warning("Could not save profile: %s", exc)
        return None


def save_result(profile_id: int, raw_response: str) -> None:
    """Persist the agent's final answer for a profile."""
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO eligibility_results
               (profile_id, raw_response, analysis_json)
               VALUES (%s, %s, %s)""",
            (profile_id, raw_response, None),
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as exc:
        logger.warning("Could not save result: %s", exc)


def save_result_with_analysis(profile_id: int, raw_response: str, analysis: dict) -> None:
    """Persist the agent final answer and structured analysis."""
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO eligibility_results
               (profile_id, raw_response, analysis_json)
               VALUES (%s, %s, %s)""",
            (profile_id, raw_response, json.dumps(analysis or {})),
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as exc:
        logger.warning("Could not save result: %s", exc)


def get_profile(profile_id: int) -> Optional[dict]:
    """Return the profile + latest result as a dict, or None."""
    try:
        conn = _get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM profiles WHERE id = %s", (profile_id,))
        profile = cursor.fetchone()
        if not profile:
            cursor.close()
            conn.close()
            return None
        if profile.get("uploaded_documents_json"):
            try:
                profile["uploaded_documents"] = json.loads(profile["uploaded_documents_json"])
            except Exception:
                profile["uploaded_documents"] = []
        cursor.execute(
            """SELECT raw_response, analysis_json, created_at FROM eligibility_results
               WHERE profile_id = %s ORDER BY created_at DESC LIMIT 1""",
            (profile_id,),
        )
        result = cursor.fetchone()
        if result and result.get("analysis_json"):
            try:
                result["analysis"] = json.loads(result["analysis_json"])
            except Exception:
                result["analysis"] = None
        cursor.close()
        conn.close()
        return {"profile": profile, "latest_result": result}
    except Exception as exc:
        logger.warning("Could not fetch profile: %s", exc)
        return None
