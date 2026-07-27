"""Global Energy Transition Dashboard"""
from __future__ import annotations
import os, json, io, uuid, asyncio, logging, re, zipfile
from pathlib import Path
from typing import Optional, Dict, List, Any
from datetime import datetime
import pandas as pd
import duckdb
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from maritime_extras import (
    load_zones, enrich_port_fields, analyze_route_zones,
    fetch_weather, fetch_bunker_prices, estimate_fuel_cost,
)
from port_catalog import PortCatalog

log = logging.getLogger("ais")
logging.basicConfig(level=logging.INFO)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
BUNDLED_DATA_DIR = UPLOAD_DIR / "_bundled_data"
BUNDLED_DATA_DIR.mkdir(exist_ok=True)

AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY", "").strip()

TRACKERS = {
    "coal_plants": {"label": "Coal Plants", "file": "coal_plants.csv.gz", "icon": "🔥"},
    "coal_terminals": {"label": "Coal Terminals", "file": "coal_terminals.csv", "icon": "🚢"},
    "world_ports": {"label": "World Ports", "file": "world_ports.csv.gz", "icon": "⚓"},
    "solar": {"label": "Solar", "file": "solar.csv.gz", "icon": "☀️"},
    "wind": {"label": "Wind", "file": "wind.csv.gz", "icon": "💨"},
    "hydro": {"label": "Hydropower", "file": "hydro.csv.gz", "icon": "💧"},
    "nuclear": {"label": "Nuclear", "file": "nuclear.csv.gz", "icon": "⚛️"},
}
user_datasets: Dict[str, Path] = {}
con = duckdb.connect(database=":memory:")

def _ensure_bundled_trackers() -> None:
    """Extract optional prototype datasets into the ignored runtime directory."""
    bundle = BASE_DIR / "gem-dashboard (1).zip"
    if not bundle.exists():
        return
    wanted = {
        "coal_terminals.csv",
        "coal_terminals.csv.gz",
        "world_ports.csv",
        "world_ports.csv.gz",
        "summaries.json",
    }
    try:
        with zipfile.ZipFile(bundle) as archive:
            members = {
                Path(name).name: name
                for name in archive.namelist()
                if "/data/" in name.replace("\\", "/")
                and Path(name).name in wanted
            }
            for filename, member in members.items():
                destination = BUNDLED_DATA_DIR / filename
                if destination.exists():
                    continue
                destination.write_bytes(archive.read(member))
    except (OSError, zipfile.BadZipFile) as exc:
        log.warning("Could not extract bundled tracker data: %s", exc)


def _tracker_path(name: str, meta: Dict[str, str]) -> Path:
    candidates = [meta["file"]]
    if name == "world_ports":
        candidates.extend(["world_ports.csv", "world_ports.csv.gz"])
    if name == "coal_terminals":
        candidates.extend(["coal_terminals.csv", "coal_terminals.csv.gz"])
    for directory in (DATA_DIR, BUNDLED_DATA_DIR):
        for filename in dict.fromkeys(candidates):
            path = directory / filename
            if path.exists():
                return path
    return DATA_DIR / meta["file"]


def _summary_path() -> Path:
    for directory in (DATA_DIR, BUNDLED_DATA_DIR):
        path = directory / "summaries.json"
        if path.exists():
            return path
    return DATA_DIR / "summaries.json"


def register_all():
    for name, meta in TRACKERS.items():
        path = _tracker_path(name, meta)
        if path.exists():
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM read_csv_auto('{path}')")
    for uname, upath in user_datasets.items():
        safe = uname.replace("-", "_").replace(" ", "_")
        con.execute(f"CREATE OR REPLACE TABLE user_{safe} AS SELECT * FROM read_csv_auto('{upath}')")

_ensure_bundled_trackers()
register_all()
ports = PortCatalog(con)
ports.refresh()

app = FastAPI(title="Global Energy & Maritime Intelligence", version="4.0.0")
cors_origins = [
    value.strip()
    for value in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

class ChatRequest(BaseModel):
    message: str
    use_local_llm: bool = False
    local_llm_url: Optional[str] = None
    local_model: Optional[str] = "local-model"

class VesselTrackRequest(BaseModel):
    ids: List[str] = []
    timeout_sec: float = 25.0

class RouteRequest(BaseModel):
    from_lon: float
    from_lat: float
    to_lon: float
    to_lat: float
    speed_knots: float = 12.0
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    avoid: Optional[List[str]] = None
    consumption_tpd: float = 25.0  # tonnes per day fuel burn

def _infer_passage(coords):
    if not coords:
        return None
    tags = []
    for lon, lat in coords:
        if 29 < lat < 32 and 32 < lon < 33: tags.append("Suez Canal")
        elif 8.5 < lat < 9.5 and -80 < lon < -79: tags.append("Panama Canal")
        elif 25.5 < lat < 27 and 56 < lon < 57.5: tags.append("Strait of Hormuz")
        elif 1 < lat < 4 and 100 < lon < 104: tags.append("Malacca Strait")
        elif 12 < lat < 14 and 42 < lon < 44: tags.append("Bab el-Mandeb")
        elif lat < -33 and 15 < lon < 22: tags.append("Cape of Good Hope")
        elif lat < -54 and -70 < lon < -65: tags.append("Cape Horn")
        elif 35.5 < lat < 36.5 and -6 < lon < -5: tags.append("Strait of Gibraltar")
        elif 40.5 < lat < 41.5 and 28.5 < lon < 29.5: tags.append("Bosporus")
    seen, out = set(), []
    for t in tags:
        if t not in seen:
            seen.add(t); out.append(t)
    return ", ".join(out) if out else None

def _length_to_nm(length: float, units: str) -> float:
    u = (units or "").lower().strip()
    if u in ("naut", "nm", "nmi", "nautical", "nauticals"): return float(length)
    if u in ("km", "kilometer", "kilometers"): return float(length) / 1.852
    if u in ("mi", "mile", "miles"): return float(length) / 1.150779
    if u in ("m", "meter", "meters"): return float(length) / 1852.0
    return float(length) / 1.852

def _compute_route(from_lon, from_lat, to_lon, to_lat, speed_knots, restrictions: Optional[List[str]] = None):
    import searoute as sr
    restrictions = restrictions if restrictions is not None else ["northwest"]
    feature = sr.searoute(
        [from_lon, from_lat], [to_lon, to_lat],
        units="naut", speed_knot=speed_knots, append_orig_dest=True,
        restrictions=restrictions, return_passages=True,
    )
    props = feature.get("properties", {}) if isinstance(feature, dict) else feature.properties
    geom = feature.get("geometry", {}) if isinstance(feature, dict) else feature.geometry
    coords = geom.get("coordinates", []) if isinstance(geom, dict) else getattr(geom, "coordinates", [])
    length = float(props.get("length", 0))
    units = str(props.get("units", "naut"))
    distance_nm = _length_to_nm(length, units)
    duration_hours = distance_nm / speed_knots if speed_knots > 0 else 0.0
    passages = props.get("passages") or []
    via = ", ".join(passages) if passages else _infer_passage(coords)
    return {
        "distance_nm": round(distance_nm, 1),
        "distance_miles": round(distance_nm * 1.150779, 1),
        "distance_km": round(distance_nm * 1.852, 1),
        "duration_hours": round(duration_hours, 2),
        "duration_days": round(duration_hours / 24.0, 2),
        "speed_knots": speed_knots,
        "coordinates": coords,
        "units": "nm",
        "via": via,
        "restrictions": restrictions,
    }

@app.get("/api/trackers")
async def list_trackers():
    summaries_path = _summary_path()
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
            clauses.append('"Country/Area" ILIKE ?'); params.append(f"%{countries[0]}%")
        elif countries:
            placeholders = ",".join(["?"] * len(countries))
            clauses.append(f'"Country/Area" IN ({placeholders})'); params.extend(countries)
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
async def get_map_points(
    tracker_id: str,
    status: Optional[str] = None,
    country: Optional[str] = None,
    categories: Optional[str] = None,
    countries: Optional[str] = None,
    harbor_sizes: Optional[str] = None,
    q: Optional[str] = None,
    min_channel_m: Optional[float] = None,
    min_cargo_m: Optional[float] = None,
    min_anchorage_m: Optional[float] = None,
    limit: int = Query(5000, le=10000),
):
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404)
    if tracker_id == "world_ports":
        selected_countries = _csv_values(countries or country)
        filtered = ports.filtered(
            q=q,
            categories=_csv_values(categories),
            countries=selected_countries,
            harbor_sizes=_csv_values(harbor_sizes),
            min_channel_m=min_channel_m,
            min_cargo_m=min_cargo_m,
            min_anchorage_m=min_anchorage_m,
        )
        return [ports.compact(item) for item in filtered[:limit]]
    where, params = _filters(status, country, None, None, None, None)
    extra = ['"Latitude" IS NOT NULL', '"Longitude" IS NOT NULL']
    where = (where + " AND " + " AND ".join(extra)) if where else (" WHERE " + " AND ".join(extra))
    sql = (
        'SELECT "Plant name" as name, "Unit name" as unit, Status as status, '
        'TRY_CAST("Capacity (MW)" AS DOUBLE) as capacity, '
        'TRY_CAST(Latitude AS DOUBLE) as lat, TRY_CAST(Longitude AS DOUBLE) as lon, '
        '"Country/Area" as country FROM ' + tracker_id + where + ' LIMIT ' + str(limit)
    )
    try:
        df = con.execute(sql, params).fetchdf()
        return json.loads(df.to_json(orient="records"))
    except Exception as e:
        # Fallback without depth columns if schema missing
        try:
            sql2 = (
                'SELECT "Plant name" as name, "Unit name" as unit, Status as status, '
                'TRY_CAST("Capacity (MW)" AS DOUBLE) as capacity, '
                'TRY_CAST(Latitude AS DOUBLE) as lat, TRY_CAST(Longitude AS DOUBLE) as lon, '
                '"Country/Area" as country FROM ' + tracker_id + where + ' LIMIT ' + str(limit)
            )
            df = con.execute(sql2, params).fetchdf()
            return json.loads(df.to_json(orient="records"))
        except Exception as e2:
            raise HTTPException(400, str(e2))

@app.get("/api/kpis/{tracker_id}")
async def get_kpis(tracker_id: str):
    if tracker_id not in TRACKERS:
        raise HTTPException(404)
    if tracker_id == "world_ports":
        return {
            "total_units": ports.summary.get("total", 0),
            "operating_units": ports.summary.get("total", 0),
            "operating_mw": 0,
            "total_mw": 0,
            "countries": len(ports.facets.get("countries", [])),
            "dry_bulk": ports.summary.get("dry_bulk", 0),
            "coal": ports.summary.get("coal", 0),
            "classified": ports.summary.get("classified", 0),
            "with_channel_depth": ports.summary.get("with_channel_depth", 0),
        }
    op = "operating"
    try:
        q = ("SELECT COUNT(*) as total_units, "
             "SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = ? THEN 1 ELSE 0 END) as operating_units, "
             "SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = ? THEN TRY_CAST(\"Capacity (MW)\" AS DOUBLE) ELSE 0 END) as operating_mw, "
             "SUM(TRY_CAST(\"Capacity (MW)\" AS DOUBLE)) as total_mw, "
             "COUNT(DISTINCT \"Country/Area\") as countries FROM " + tracker_id)
        df = con.execute(q, [op, op]).fetchdf()
        row = df.iloc[0].to_dict()
        status_df = con.execute(
            "SELECT Status, COUNT(*) as cnt, SUM(TRY_CAST(\"Capacity (MW)\" AS DOUBLE)) as mw FROM "
            + tracker_id + " GROUP BY Status ORDER BY cnt DESC"
        ).fetchdf()
        row["by_status"] = json.loads(status_df.to_json(orient="records"))
        return row
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/api/countries/{tracker_id}")
async def countries_by_capacity(tracker_id: str):
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404)
    if tracker_id == "world_ports":
        return [
            {
                "country": item["id"],
                "capacity": 0,
                "units": item["count"],
            }
            for item in ports.facets.get("countries", [])
        ]
    op = "operating"
    try:
        q = ("SELECT \"Country/Area\" as country, "
             "COALESCE(SUM(CASE WHEN LOWER(CAST(Status AS VARCHAR)) = ? THEN TRY_CAST(\"Capacity (MW)\" AS DOUBLE) ELSE 0 END), 0) as capacity, "
             "COUNT(*) as units FROM " + tracker_id + " "
             "WHERE \"Country/Area\" IS NOT NULL AND CAST(\"Country/Area\" AS VARCHAR) != '' "
             "GROUP BY \"Country/Area\" ORDER BY capacity DESC, units DESC")
        df = con.execute(q, [op]).fetchdf()
        return json.loads(df.to_json(orient="records"))
    except Exception as e:
        raise HTTPException(400, str(e))

def _csv_values(value: Optional[str]) -> List[str]:
    return [part.strip() for part in (value or "").split(",") if part.strip()]


@app.get("/api/ports")
async def list_ports(
    q: Optional[str] = None,
    categories: Optional[str] = None,
    countries: Optional[str] = None,
    harbor_sizes: Optional[str] = None,
    min_channel_m: Optional[float] = None,
    min_cargo_m: Optional[float] = None,
    min_anchorage_m: Optional[float] = None,
    limit: int = Query(5000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    filtered = ports.filtered(
        q=q,
        categories=_csv_values(categories),
        countries=_csv_values(countries),
        harbor_sizes=_csv_values(harbor_sizes),
        min_channel_m=min_channel_m,
        min_cargo_m=min_cargo_m,
        min_anchorage_m=min_anchorage_m,
    )
    return {
        "data": [ports.compact(item) for item in filtered[offset : offset + limit]],
        "total": len(filtered),
        "limit": limit,
        "offset": offset,
        "facets": ports.facets,
        "summary": ports.summary,
    }


@app.get("/api/ports/facets")
async def port_facets():
    return {"facets": ports.facets, "summary": ports.summary}


@app.get("/api/ports/{port_id}")
async def port_detail(port_id: str):
    port = ports.by_id.get(port_id)
    if not port:
        raise HTTPException(404, "Unknown port")
    return port

@app.get("/api/zones")
async def get_zones():
    return load_zones()

@app.get("/api/weather")
async def weather(lat: float = Query(...), lon: float = Query(...)):
    return await fetch_weather(lat, lon)

@app.get("/api/bunker")
async def bunker():
    return await fetch_bunker_prices()

@app.post("/api/route")
async def sea_route(req: RouteRequest):
    try:
        speed = req.speed_knots if req.speed_knots and req.speed_knots > 0 else 12.0
        avoid = list(req.avoid or [])
        if "northwest" not in avoid:
            avoid.append("northwest")
        primary = _compute_route(req.from_lon, req.from_lat, req.to_lon, req.to_lat, speed, avoid)
        alt = None
        via_suez = primary.get("via") and "Suez" in str(primary.get("via"))
        if via_suez and "suez" not in avoid:
            try:
                alt = _compute_route(req.from_lon, req.from_lat, req.to_lon, req.to_lat, speed, avoid + ["suez"])
            except Exception:
                alt = None

        zone_info = analyze_route_zones(primary.get("coordinates") or [])
        bunker = await fetch_bunker_prices()
        fuel = estimate_fuel_cost(
            primary["distance_nm"], primary["duration_days"],
            req.consumption_tpd or 25.0,
            zone_info.get("eca_nm_share") or 0.0,
            bunker,
        )

        # Weather at origin, midpoint sample, destination
        coords = primary.get("coordinates") or []
        mid = coords[len(coords) // 2] if coords else [req.from_lon, req.from_lat]
        weather = {
            "origin": await fetch_weather(req.from_lat, req.from_lon),
            "midpoint": await fetch_weather(mid[1], mid[0]),
            "destination": await fetch_weather(req.to_lat, req.to_lon),
        }

        result = {
            **primary,
            "from_name": req.from_name,
            "to_name": req.to_name,
            "method": "maritime network (searoute) · NM / kn / 24",
            "zones": zone_info,
            "fuel": fuel,
            "weather": weather,
        }
        if alt and alt["distance_nm"] > primary["distance_nm"]:
            result["alternate_cape_nm"] = alt["distance_nm"]
            result["alternate_cape_days"] = alt["duration_days"]
        return result
    except Exception as e:
        raise HTTPException(400, f"Route error: {e}")

async def _sample_ais_for_ships(mmsis: List[str], imos: List[str], timeout_sec: float = 25.0) -> Dict[str, Any]:
    if not AISSTREAM_API_KEY:
        return {"error": "No AISStream API key configured", "vessels": []}
    try:
        import websockets as wslib
    except ImportError:
        return {"error": "Server missing websockets package", "vessels": []}
    vessels: Dict[str, dict] = {}
    mmsi_set = set(str(m) for m in mmsis)
    imo_set = set(str(i) for i in imos)
    sub = {
        "APIKey": AISSTREAM_API_KEY,
        "BoundingBoxes": [[[-90.0, -180.0], [90.0, 180.0]]],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData", "StandardClassBPositionReport"],
    }
    if mmsi_set:
        sub["FiltersShipMMSI"] = list(mmsi_set)[:50]
    try:
        async with wslib.connect("wss://stream.aisstream.io/v0/stream", open_timeout=15, ping_interval=None, max_size=2**22, close_timeout=5) as upstream:
            await upstream.send(json.dumps(sub))
            deadline = asyncio.get_event_loop().time() + max(8.0, min(timeout_sec, 40.0))
            while asyncio.get_event_loop().time() < deadline:
                remaining = deadline - asyncio.get_event_loop().time()
                try:
                    raw = await asyncio.wait_for(upstream.recv(), timeout=max(0.5, remaining))
                except Exception:
                    break
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="ignore")
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                meta = msg.get("MetaData") or {}
                mmsi = str(meta.get("MMSI") or "")
                pr = (msg.get("Message") or {}).get("PositionReport") or (msg.get("Message") or {}).get("StandardClassBPositionReport") or {}
                sd = (msg.get("Message") or {}).get("ShipStaticData") or {}
                if sd:
                    imo = str(sd.get("ImoNumber") or sd.get("IMO") or "")
                    name = (sd.get("Name") or meta.get("ShipName") or "").strip()
                    dim = sd.get("Dimension") or {}
                    length = (dim.get("A") or 0) + (dim.get("B") or 0)
                    key = mmsi or imo
                    if not key:
                        continue
                    if mmsi_set and mmsi not in mmsi_set and (not imo or imo not in imo_set):
                        if not imo_set or imo not in imo_set:
                            continue
                    if imo_set and not mmsi_set and imo not in imo_set:
                        continue
                    rec = vessels.setdefault(key, {"mmsi": mmsi, "imo": imo})
                    if name: rec["name"] = name
                    if imo: rec["imo"] = imo
                    if length: rec["length_m"] = length
                    continue
                lat = meta.get("Latitude"); lon = meta.get("Longitude")
                if lat is None: lat = pr.get("Latitude")
                if lon is None: lon = pr.get("Longitude")
                if lat is None or lon is None or not mmsi:
                    continue
                if mmsi_set and mmsi not in mmsi_set:
                    if not imo_set or mmsi not in vessels:
                        continue
                rec = vessels.setdefault(mmsi, {"mmsi": mmsi})
                rec["lat"] = float(lat); rec["lon"] = float(lon)
                if pr.get("Sog") is not None: rec["sog_kn"] = pr.get("Sog")
                if pr.get("Cog") is not None: rec["cog"] = pr.get("Cog")
                if meta.get("ShipName"): rec["name"] = str(meta.get("ShipName")).strip()
                if mmsi_set and all(any(v.get("mmsi") == m and v.get("lat") is not None for v in vessels.values()) for m in mmsi_set):
                    break
    except Exception as e:
        return {"error": f"AIS sample failed: {e}", "vessels": list(vessels.values())}
    out = []
    for v in vessels.values():
        if mmsi_set and v.get("mmsi") in mmsi_set: out.append(v)
        elif imo_set and str(v.get("imo") or "") in imo_set: out.append(v)
    return {"vessels": out, "queried_mmsi": list(mmsi_set), "queried_imo": list(imo_set)}

@app.post("/api/vessel/track")
async def track_vessels(req: VesselTrackRequest):
    raw_ids = []
    for x in req.ids or []:
        for part in str(x).replace(";", ",").split(","):
            p = part.strip()
            if p: raw_ids.append(p)
    mmsis, imos = [], []
    for p in raw_ids:
        digits = "".join(c for c in p if c.isdigit())
        if len(digits) == 9: mmsis.append(digits)
        elif len(digits) == 7: imos.append(digits)
        elif len(digits) > 7: imos.append(digits[:7])
    if not mmsis and not imos:
        raise HTTPException(400, "Provide at least one 9-digit MMSI or 7-digit IMO")
    result = await _sample_ais_for_ships(mmsis, imos, req.timeout_sec or 25.0)
    if result.get("error") and not result.get("vessels"):
        raise HTTPException(502, result["error"])
    return {"vessels": result.get("vessels", []), "queried_mmsi": result.get("queried_mmsi", []), "queried_imo": result.get("queried_imo", []), "error": result.get("error")}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    original_name = Path(file.filename or "upload")
    ext = original_name.suffix.lower()
    if ext not in {".xlsx", ".xls", ".csv", ".json"}:
        raise HTTPException(400, "Supported: Excel, CSV, JSON")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50 MB)")
    uid = uuid.uuid4().hex[:8]
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", original_name.stem).strip("_")
    safe_name = f"{safe_stem or 'upload'}_{uid}"
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
    if tracker_id not in TRACKERS and not tracker_id.startswith("user_"):
        raise HTTPException(404, "Unknown tracker")
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
        reply = "Ask about coal plants, terminals, ports, routes, ECA, bunker or weather."
    return {"reply": reply, "sql_result": None, "engine": "heuristic"}

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "trackers": list(TRACKERS.keys()),
        "ports": ports.summary,
        "ais_configured": bool(AISSTREAM_API_KEY),
        "version": "4.0.0",
        "time": datetime.utcnow().isoformat(),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
