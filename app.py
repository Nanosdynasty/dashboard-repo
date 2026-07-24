"""
Global Energy Transition Dashboard
GEM-style multi-tracker platform — deployable on Render.com
"""
from __future__ import annotations

import os
import json
import io
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

import pandas as pd
import duckdb
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

TRACKERS = {
    "coal_plants": {"label": "Coal Plants", "file": "coal_plants.csv.gz", "icon": "🔥"},
    "solar": {"label": "Solar", "file": "solar.csv.gz", "icon": "☀️"},
    "wind": {"label": "Wind", "file": "wind.csv.gz", "icon": "💨"},
    "hydro": {"label": "Hydropower", "file": "hydro.csv.gz", "icon": "💧"},
    "nuclear": {"label": "Nuclear", "file": "nuclear.csv.gz", "icon": "⚛️"},
}

# In-memory uploaded datasets (name -> path)
user_datasets: Dict[str, Path] = {}

# DuckDB connection (in-memory + files)
con = duckdb.connect(database=":memory:")

def load_tracker(name: str) -> pd.DataFrame:
    meta = TRACKERS.get(name)
    if not meta:
        raise HTTPException(404, f"Unknown tracker: {name}")
    path = DATA_DIR / meta["file"]
    if not path.exists():
        raise HTTPException(404, f"Data file missing for {name}")
    return pd.read_csv(path)

def register_all():
    """Register official + user tables in DuckDB."""
    for name, meta in TRACKERS.items():
        path = DATA_DIR / meta["file"]
        if path.exists():
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM read_csv_auto('{path}')")
    for uname, upath in user_datasets.items():
        safe = uname.replace("-", "_").replace(" ", "_")
        con.execute(f"CREATE OR REPLACE TABLE user_{safe} AS SELECT * FROM read_csv_auto('{upath}')")

register_all()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="HRP Dashboard",
    description="Multi-tracker dashboard with upload, NL analysis & Excel export",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

# ---------------------------------------------------------------------------
# API models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    use_local_llm: bool = False
    local_llm_url: Optional[str] = "http://host.docker.internal:1234/v1"  # LM Studio / Ollama default
    local_model: Optional[str] = "local-model"

class FilterParams(BaseModel):
    status: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    min_capacity: Optional[float] = None
    max_capacity: Optional[float] = None
    region: Optional[str] = None

# ---------------------------------------------------------------------------
# Core data endpoints
# ---------------------------------------------------------------------------
@app.get("/api/trackers")
async def list_trackers():
    summaries_path = DATA_DIR / "summaries.json"
    summaries = {}
    if summaries_path.exists():
        summaries = json.loads(summaries_path.read_text())
    result = []
    for key, meta in TRACKERS.items():
        s = summaries.get(key, {})
        result.append({
            "id": key,
            "label": meta["label"],
            "icon": meta["icon"],
            "rows": s.get("rows", 0),
            "operating_capacity_mw": s.get("operating_capacity_mw", 0),
            "operating_units": s.get("operating_units", 0),
            "countries": s.get("countries", 0),
            "status_counts": s.get("status_counts", {}),
        })
    # user datasets
    for uname in user_datasets:
        result.append({
            "id": f"user_{uname}",
            "label": f"📤 {uname}",
            "icon": "📁",
            "rows": 0,
            "is_user": True,
        })
    return result

@app.get("/api/data/{tracker_id}")
async def get_data(
    tracker_id: str,
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    min_mw: Optional[float] = Query(None),
    max_mw: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    is_user = tracker_id.startswith("user_")
    table = tracker_id if is_user else tracker_id
    if not is_user and tracker_id not in TRACKERS:
        raise HTTPException(404, "Unknown tracker")

    # Build WHERE
    clauses = []
    params = []
    if status:
        statuses = [s.strip() for s in status.split(",")]
        placeholders = ",".join(["?"] * len(statuses))
        clauses.append(f"LOWER(CAST(Status AS VARCHAR)) IN ({placeholders})")
        params.extend([s.lower() for s in statuses])
    if country:
        clauses.append("\"Country/Area\" ILIKE ?")
        params.append(f"%{country}%")
    if region:
        clauses.append("Region ILIKE ?")
        params.append(f"%{region}%")
    if min_mw is not None:
        clauses.append("TRY_CAST(\"Capacity (MW)\" AS DOUBLE) >= ?")
        params.append(min_mw)
    if max_mw is not None:
        clauses.append("TRY_CAST(\"Capacity (MW)\" AS DOUBLE) <= ?")
        params.append(max_mw)
    if search:
        clauses.append("( \"Plant name\" ILIKE ? OR \"Unit name\" ILIKE ? OR Owner ILIKE ? )")
        params.extend([f"%{search}%"] * 3)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f'SELECT * FROM {table}{where} LIMIT {limit} OFFSET {offset}'
    try:
        df = con.execute(sql, params).fetchdf()
        # also total count
        count_sql = f"SELECT COUNT(*) FROM {table}{where}"
        total = con.execute(count_sql, params).fetchone()[0]
    except Exception as e:
        raise HTTPException(400, f"Query error: {e}")

    # Convert to records, handle NaN
    records = json.loads(df.to_json(orient="records", date_format="iso"))
    return {"data": records, "total": total, "limit": limit, "offset": offset}

@app.get("/api/map/{tracker_id}")
async def get_map_points(
    tracker_id: str,
    status: Optional[str] = None,
    limit: int = Query(3000, le=10000),
):
    """Lightweight lat/lon + status + capacity for map markers."""
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404)
    clauses = ['"Latitude" IS NOT NULL', '"Longitude" IS NOT NULL']
    params = []
    if status:
        statuses = [s.strip().lower() for s in status.split(",")]
        placeholders = ",".join(["?"] * len(statuses))
        clauses.append(f"LOWER(CAST(Status AS VARCHAR)) IN ({placeholders})")
        params.extend(statuses)
    where = " WHERE " + " AND ".join(clauses)
    sql = f'''
        SELECT "Plant name" as name, "Unit name" as unit, Status as status,
               TRY_CAST("Capacity (MW)" AS DOUBLE) as capacity,
               TRY_CAST(Latitude AS DOUBLE) as lat,
               TRY_CAST(Longitude AS DOUBLE) as lon,
               "Country/Area" as country
        FROM {tracker_id}
        {where}
        LIMIT {limit}
    '''
    try:
        df = con.execute(sql, params).fetchdf()
        return json.loads(df.to_json(orient="records"))
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/api/kpis/{tracker_id}")
async def get_kpis(tracker_id: str):
    if tracker_id not in TRACKERS:
        raise HTTPException(404)
    try:
        df = con.execute(f'''
            SELECT
                COUNT(*) as total_units,
                SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = 'operating' THEN 1 ELSE 0 END) as operating_units,
                SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = 'operating' THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END) as operating_mw,
                SUM(TRY_CAST("Capacity (MW)" AS DOUBLE)) as total_mw,
                COUNT(DISTINCT "Country/Area") as countries
            FROM {tracker_id}
        ''').fetchdf()
        row = df.iloc[0].to_dict()
        # status breakdown
        status_df = con.execute(f'''
            SELECT Status, COUNT(*) as cnt,
                   SUM(TRY_CAST("Capacity (MW)" AS DOUBLE)) as mw
            FROM {tracker_id}
            GROUP BY Status
            ORDER BY cnt DESC
        ''').fetchdf()
        row["by_status"] = json.loads(status_df.to_json(orient="records"))
        return row
    except Exception as e:
        raise HTTPException(400, str(e))

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".xlsx", ".xls", ".csv", ".json", ".pdf"}:
        raise HTTPException(400, "Supported: Excel, CSV, JSON, PDF")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(400, "File too large (max 50 MB)")

    uid = uuid.uuid4().hex[:8]
    safe_name = f"{Path(file.filename).stem}_{uid}"
    out_path = UPLOAD_DIR / f"{safe_name}.csv"

    try:
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl", dtype=str)
        elif ext == ".csv":
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        elif ext == ".json":
            df = pd.read_json(io.BytesIO(content))
        elif ext == ".pdf":
            # Minimal PDF table extraction note — full OCR would need more deps
            raise HTTPException(400, "PDF support requires table extraction libraries. Convert to Excel/CSV first for best results.")
        else:
            raise HTTPException(400, "Unsupported")

        # Clean
        df.columns = [str(c).strip() for c in df.columns]
        for c in df.columns:
            if any(x in c.lower() for x in ["capacity", "mw", "year", "lat", "lon"]):
                df[c] = pd.to_numeric(df[c], errors="coerce")

        df.to_csv(out_path, index=False)
        user_datasets[safe_name] = out_path
        # register in duckdb
        con.execute(f"CREATE OR REPLACE TABLE user_{safe_name.replace('-','_')} AS SELECT * FROM read_csv_auto('{out_path}')")
        return {
            "id": f"user_{safe_name}",
            "name": safe_name,
            "rows": len(df),
            "columns": list(df.columns),
            "message": f"Uploaded and registered as user_{safe_name}",
        }
    except Exception as e:
        raise HTTPException(400, f"Parse error: {e}")

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@app.get("/api/export/{tracker_id}")
async def export_excel(
    tracker_id: str,
    status: Optional[str] = None,
    country: Optional[str] = None,
):
    clauses = []
    params = []
    if status:
        statuses = [s.strip().lower() for s in status.split(",")]
        placeholders = ",".join(["?"] * len(statuses))
        clauses.append(f"LOWER(CAST(Status AS VARCHAR)) IN ({placeholders})")
        params.extend(statuses)
    if country:
        clauses.append("\"Country/Area\" ILIKE ?")
        params.append(f"%{country}%")
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"SELECT * FROM {tracker_id}{where}"
    try:
        df = con.execute(sql, params).fetchdf()
    except Exception as e:
        raise HTTPException(400, str(e))

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Data")
        # summary sheet
        if "Status" in df.columns and "Capacity (MW)" in df.columns:
            summary = df.groupby("Status", dropna=False).agg(
                units=("Status", "count"),
                capacity_mw=("Capacity (MW)", "sum"),
            ).reset_index()
            summary.to_excel(writer, index=False, sheet_name="Summary")
    buf.seek(0)
    filename = f"{tracker_id}_export_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

# ---------------------------------------------------------------------------
# Natural language / Chat (Grok + local LLM)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert energy data analyst for the HRP Dashboard.
You have access to these DuckDB tables: coal_plants, solar, wind, hydro, nuclear, and any user_* tables.
Key columns typically include: "Plant name", "Unit name", "Country/Area", Status, "Capacity (MW)", Latitude, Longitude, Owner, Parent, Region, Start year, etc.

When the user asks a question:
1. If it can be answered with SQL, reply with a JSON block like:
   ```json
   {"sql": "SELECT ... FROM coal_plants WHERE ... LIMIT 100", "explanation": "brief"}
   ```
2. Otherwise give a clear natural language answer using the data context.
3. Be precise with units (MW, GW, Mt CO2). Prefer operating capacity when relevant.
4. Never invent numbers — only use results from queries or known summaries.
"""

@app.post("/api/chat")
async def chat(req: ChatRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Empty message")

    # Try to use Grok / xAI if key present, else local, else heuristic
    xai_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")
    reply = None
    sql_result = None

    if req.use_local_llm and req.local_llm_url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    f"{req.local_llm_url.rstrip('/')}/chat/completions",
                    json={
                        "model": req.local_model or "local-model",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": message},
                        ],
                        "temperature": 0.2,
                    },
                    headers={"Authorization": "Bearer lm-studio"},
                )
                if r.status_code == 200:
                    data = r.json()
                    reply = data["choices"][0]["message"]["content"]
        except Exception as e:
            reply = f"(Local LLM unreachable: {e})\n\nFalling back to built-in analysis."

    if not reply and xai_key:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    json={
                        "model": "grok-3",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": message},
                        ],
                        "temperature": 0.2,
                    },
                    headers={"Authorization": f"Bearer {xai_key}"},
                )
                if r.status_code == 200:
                    data = r.json()
                    reply = data["choices"][0]["message"]["content"]
        except Exception as e:
            reply = f"(Grok API error: {e})"

    # Heuristic / DuckDB powered fallback when no LLM
    if not reply or "Falling back" in (reply or ""):
        reply = await heuristic_answer(message)

    # If reply contains a SQL json block, execute it
    if "```json" in (reply or ""):
        try:
            start = reply.find("```json") + 7
            end = reply.find("```", start)
            block = json.loads(reply[start:end].strip())
            if "sql" in block:
                df = con.execute(block["sql"]).fetchdf()
                sql_result = {
                    "columns": list(df.columns),
                    "rows": json.loads(df.head(200).to_json(orient="records")),
                    "row_count": len(df),
                    "explanation": block.get("explanation", ""),
                }
        except Exception:
            pass

    return {
        "reply": reply,
        "sql_result": sql_result,
        "engine": "local" if req.use_local_llm else ("grok" if xai_key else "heuristic"),
    }

async def heuristic_answer(message: str) -> str:
    """Simple keyword-driven answers using DuckDB when no LLM is available."""
    msg = message.lower()
    lines = []

    # Detect tracker
    tracker = "coal_plants"
    if "solar" in msg:
        tracker = "solar"
    elif "wind" in msg:
        tracker = "wind"
    elif "hydro" in msg or "hydropower" in msg:
        tracker = "hydro"
    elif "nuclear" in msg:
        tracker = "nuclear"

    try:
        kpis = con.execute(f'''
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = 'operating' THEN 1 ELSE 0 END) as op_units,
                ROUND(SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = 'operating' THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END)/1000, 1) as op_gw
            FROM {tracker}
        ''').fetchone()
        lines.append(f"**{TRACKERS.get(tracker, {}).get('label', tracker)}** overview: {kpis[0]:,} units, {kpis[1]:,} operating ({kpis[2]} GW).")
    except Exception:
        pass

    # Country specific
    for country in ["china", "india", "united states", "usa", "germany", "japan", "australia", "brazil", "indonesia"]:
        if country in msg:
            cname = "United States" if country in ("usa", "united states") else country.title()
            try:
                r = con.execute(f'''
                    SELECT COUNT(*) as n,
                           ROUND(SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR))='operating' THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END)/1000, 1) as gw
                    FROM {tracker}
                    WHERE "Country/Area" ILIKE ?
                ''', [f"%{cname}%"]).fetchone()
                lines.append(f"In **{cname}**: {r[0]:,} units, ~{r[1]} GW operating.")
            except Exception:
                pass
            break

    if "top" in msg or "largest" in msg:
        try:
            df = con.execute(f'''
                SELECT "Plant name", "Country/Area", Status, TRY_CAST("Capacity (MW)" AS DOUBLE) as mw
                FROM {tracker}
                WHERE LOWER(CAST(Status AS VARCHAR)) = 'operating'
                ORDER BY mw DESC NULLS LAST
                LIMIT 10
            ''').fetchdf()
            lines.append("\n**Top 10 operating plants by capacity:**")
            for _, row in df.iterrows():
                lines.append(f"- {row['Plant name']} ({row['Country/Area']}): {row['mw']:,.0f} MW")
        except Exception:
            pass

    if not lines:
        lines.append(
            "I can answer questions about coal plants, solar, wind, hydro and nuclear capacity, status, countries and top plants. "
            "Example: “How much operating solar capacity is in China?” or “Top 10 coal plants by capacity”. "
            "For full natural language + SQL generation, connect Grok (set XAI_API_KEY) or a local LLM via LM Studio / Ollama."
        )
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "trackers": list(TRACKERS.keys()),
        "user_datasets": list(user_datasets.keys()),
        "time": datetime.utcnow().isoformat(),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
