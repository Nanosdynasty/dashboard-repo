"""Global Energy Transition Dashboard"""
from __future__ import annotations
import os, json, io, uuid
from pathlib import Path
from typing import Optional, Dict
from datetime import datetime
import pandas as pd
import duckdb
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

TRACKERS = {
    "coal_plants": {"label": "Coal Plants", "file": "coal_plants.csv.gz", "icon": "🔥"},
    "coal_terminals": {"label": "Coal Terminals", "file": "coal_terminals.csv", "icon": "🚢"},
    "world_ports": {"label": "World Ports", "file": "world_ports.csv", "icon": "⚓"},
    "solar": {"label": "Solar", "file": "solar.csv.gz", "icon": "☀️"},
    "wind": {"label": "Wind", "file": "wind.csv.gz", "icon": "💨"},
    "hydro": {"label": "Hydropower", "file": "hydro.csv.gz", "icon": "💧"},
    "nuclear": {"label": "Nuclear", "file": "nuclear.csv.gz", "icon": "⚛️"},
}
user_datasets: Dict[str, Path] = {}
con = duckdb.connect(database=":memory:")

def register_all():
    for name, meta in TRACKERS.items():
        path = DATA_DIR / meta["file"]
        if path.exists():
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM read_csv_auto('{path}')")
    for uname, upath in user_datasets.items():
        safe = uname.replace("-", "_").replace(" ", "_")
        con.execute(f"CREATE OR REPLACE TABLE user_{safe} AS SELECT * FROM read_csv_auto('{upath}')")

register_all()
app = FastAPI(title="GEM Dashboard", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

class ChatRequest(BaseModel):
    message: str
    use_local_llm: bool = False
    local_llm_url: Optional[str] = None
    local_model: Optional[str] = "local-model"

class RouteRequest(BaseModel):
    from_lon: float
    from_lat: float
    to_lon: float
    to_lat: float
    speed_knots: float = 12.0

@app.get("/api/trackers")
async def list_trackers():
    summaries_path = DATA_DIR / "summaries.json"
    summaries = json.loads(summaries_path.read_text()) if summaries_path.exists() else {}
    result = []
    for key, meta in TRACKERS.items():
        s = summaries.get(key, {})
        result.append({
            "id": key, "label": meta["label"], "icon": meta["icon"],
            "rows": s.get("rows", 0),
            "operating_capacity_mw": s.get("operating_capacity_mw", 0),
            "operating_units": s.get("operating_units", 0),
            "countries": s.get("countries", 0),
            "status_counts": s.get("status_counts", {}),
        })
    for uname in user_datasets:
        result.append({"id": f"user_{uname}", "label": f"📤 {uname}", "icon": "📁", "rows": 0, "is_user": True})
    return result

def _filters(status, country, region, min_mw, max_mw, search):
    clauses, params = [], []
    if status:
        statuses = [s.strip() for s in status.split(",")]
        placeholders = ",".join(["?"] * len(statuses))
        clauses.append(f"LOWER(CAST(Status AS VARCHAR)) IN ({placeholders})")
        params.extend([s.lower() for s in statuses])
    if country:
        countries = [c.strip() for c in country.split(",") if c.strip()]
        if len(countries) == 1:
            clauses.append('"Country/Area" ILIKE ?')
            params.append(f"%{countries[0]}%")
        elif countries:
            placeholders = ",".join(["?"] * len(countries))
            clauses.append(f'"Country/Area" IN ({placeholders})')
            params.extend(countries)
    if region:
        clauses.append("Region ILIKE ?"); params.append(f"%{region}%")
    if min_mw is not None:
        clauses.append('TRY_CAST("Capacity (MW)" AS DOUBLE) >= ?'); params.append(min_mw)
    if max_mw is not None:
        clauses.append('TRY_CAST("Capacity (MW)" AS DOUBLE) <= ?'); params.append(max_mw)
    if search:
        clauses.append('("Plant name" ILIKE ? OR "Unit name" ILIKE ? OR Owner ILIKE ?)')
        params.extend([f"%{search}%"] * 3)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params

@app.get("/api/data/{tracker_id}")
async def get_data(tracker_id: str, status: Optional[str] = None, country: Optional[str] = None,
                   region: Optional[str] = None, min_mw: Optional[float] = None, max_mw: Optional[float] = None,
                   search: Optional[str] = None, limit: int = Query(500, ge=1, le=5000), offset: int = Query(0, ge=0)):
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404, "Unknown tracker")
    where, params = _filters(status, country, region, min_mw, max_mw, search)
    try:
        df = con.execute(f"SELECT * FROM {tracker_id}{where} LIMIT {limit} OFFSET {offset}", params).fetchdf()
        total = con.execute(f"SELECT COUNT(*) FROM {tracker_id}{where}", params).fetchone()[0]
    except Exception as e:
        raise HTTPException(400, f"Query error: {e}")
    return {"data": json.loads(df.to_json(orient="records", date_format="iso")), "total": total, "limit": limit, "offset": offset}

@app.get("/api/map/{tracker_id}")
async def get_map_points(tracker_id: str, status: Optional[str] = None, country: Optional[str] = None, limit: int = Query(5000, le=10000)):
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404)
    where, params = _filters(status, country, None, None, None, None)
    extra = ['"Latitude" IS NOT NULL', '"Longitude" IS NOT NULL']
    if where:
        where = where + " AND " + " AND ".join(extra)
    else:
        where = " WHERE " + " AND ".join(extra)
    sql = ('SELECT "Plant name" as name, "Unit name" as unit, Status as status, '
           'TRY_CAST("Capacity (MW)" AS DOUBLE) as capacity, '
           'TRY_CAST(Latitude AS DOUBLE) as lat, TRY_CAST(Longitude AS DOUBLE) as lon, '
           '"Country/Area" as country FROM ' + tracker_id + where + f' LIMIT {limit}')
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
        df = con.execute(f'''SELECT COUNT(*) as total_units,
            SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = \'operating\' THEN 1 ELSE 0 END) as operating_units,
            SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = \'operating\' THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END) as operating_mw,
            SUM(TRY_CAST("Capacity (MW)" AS DOUBLE)) as total_mw,
            COUNT(DISTINCT "Country/Area") as countries FROM {tracker_id}''').fetchdf()
        row = df.iloc[0].to_dict()
        status_df = con.execute(f'''SELECT Status, COUNT(*) as cnt, SUM(TRY_CAST("Capacity (MW)" AS DOUBLE)) as mw
            FROM {tracker_id} GROUP BY Status ORDER BY cnt DESC''').fetchdf()
        row["by_status"] = json.loads(status_df.to_json(orient="records"))
        return row
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/api/countries/{tracker_id}")
async def countries_by_capacity(tracker_id: str):
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404)
    try:
        df = con.execute(f'''
            SELECT "Country/Area" as country,
                   COALESCE(SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = \'operating\'
                        THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END), 0) as capacity,
                   COUNT(*) as units
            FROM {tracker_id}
            WHERE "Country/Area" IS NOT NULL AND CAST("Country/Area" AS VARCHAR) != \'\'\
            GROUP BY "Country/Area"
            ORDER BY capacity DESC, units DESC
        ''').fetchdf()
        return json.loads(df.to_json(orient="records"))
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/route")
async def sea_route(req: RouteRequest):
    try:
        import searoute as sr
        feature = sr.searoute([req.from_lon, req.from_lat], [req.to_lon, req.to_lat],
                              units="km", speed_knot=req.speed_knots)
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [])
        return {
            "distance_km": round(float(props.get("length", 0)), 1),
            "duration_hours": round(float(props.get("duration_hours", 0)), 2),
            "speed_knots": req.speed_knots,
            "coordinates": coords,
            "units": "km",
        }
    except Exception as e:
        raise HTTPException(400, f"Route error: {e}")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".xlsx", ".xls", ".csv", ".json"}:
        raise HTTPException(400, "Supported: Excel, CSV, JSON")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50 MB)")
    uid = uuid.uuid4().hex[:8]
    safe_name = f"{Path(file.filename).stem}_{uid}"
    out_path = UPLOAD_DIR / f"{safe_name}.csv"
    try:
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl", dtype=str)
        elif ext == ".csv":
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_json(io.BytesIO(content))
        df.columns = [str(c).strip() for c in df.columns]
        df.to_csv(out_path, index=False)
        user_datasets[safe_name] = out_path
        con.execute(f"CREATE OR REPLACE TABLE user_{safe_name.replace('-','_')} AS SELECT * FROM read_csv_auto('{out_path}')")
        return {"id": f"user_{safe_name}", "name": safe_name, "rows": len(df), "columns": list(df.columns), "message": f"Uploaded as user_{safe_name}"}
    except Exception as e:
        raise HTTPException(400, f"Parse error: {e}")

@app.get("/api/export/{tracker_id}")
async def export_excel(tracker_id: str, status: Optional[str] = None, country: Optional[str] = None):
    where, params = _filters(status, country, None, None, None, None)
    try:
        df = con.execute(f"SELECT * FROM {tracker_id}{where}", params).fetchdf()
    except Exception as e:
        raise HTTPException(400, str(e))
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Data")
    buf.seek(0)
    filename = f"{tracker_id}_export_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@app.post("/api/chat")
async def chat(req: ChatRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Empty message")
    xai_key = os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")
    reply = None
    if req.use_local_llm and req.local_llm_url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(f"{req.local_llm_url.rstrip('/')}/chat/completions",
                    json={"model": req.local_model or "local-model", "messages": [{"role": "user", "content": message}], "temperature": 0.2},
                    headers={"Authorization": "Bearer lm-studio"})
                if r.status_code == 200:
                    reply = r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            reply = f"(Local LLM unreachable: {e})"
    if not reply and xai_key:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post("https://api.x.ai/v1/chat/completions",
                    json={"model": "grok-3", "messages": [{"role": "user", "content": message}], "temperature": 0.2},
                    headers={"Authorization": f"Bearer {xai_key}"})
                if r.status_code == 200:
                    reply = r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            reply = f"(Grok API error: {e})"
    if not reply:
        tracker = "coal_plants"
        msg = message.lower()
        for key, words in [("solar", ["solar"]), ("wind", ["wind"]), ("hydro", ["hydro"]),
                           ("nuclear", ["nuclear"]), ("coal_terminals", ["terminal"]), ("world_ports", ["port"])]:
            if any(w in msg for w in words):
                tracker = key
                break
        try:
            kpis = con.execute(f'''SELECT COUNT(*) as total,
                SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = \'operating\' THEN 1 ELSE 0 END) as op_units,
                ROUND(SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = \'operating\' THEN TRY_CAST("Capacity (MW)" AS DOUBLE) ELSE 0 END)/1000, 1) as op_gw
                FROM {tracker}''').fetchone()
            reply = f"**{TRACKERS.get(tracker, {}).get('label', tracker)}**: {kpis[0]:,} units, {kpis[1]:,} operating ({kpis[2]} GW/Mt)."
        except Exception:
            reply = "Ask about coal plants, terminals, ports, solar, wind, hydro or nuclear."
    return {"reply": reply, "sql_result": None, "engine": "heuristic"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "trackers": list(TRACKERS.keys()), "user_datasets": list(user_datasets.keys()), "time": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
