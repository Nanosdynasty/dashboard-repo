"""Maritime extras: ECA/piracy zones, weather (Open-Meteo), bunker prices."""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
import httpx

BASE = Path(__file__).parent
ZONES_PATH = BASE / "data" / "zones.json"

# NGA World Port Index depth letter codes → approximate range (metres)
WPI_DEPTH = {
    "A": ">23.2 m", "B": "21.6–22.9 m", "C": "20.1–21.3 m", "D": "18.3–19.8 m",
    "E": "16.8–18.0 m", "F": "15.2–16.5 m", "G": "13.7–14.9 m", "H": "12.2–13.4 m",
    "I": "10.7–11.9 m", "J": "9.1–10.4 m", "K": "7.6–8.8 m", "L": "6.1–7.3 m",
    "M": "4.9–5.8 m", "N": "3.7–4.6 m", "O": "2.4–3.4 m", "P": "1.5–2.1 m", "Q": "<1.5 m",
}
HARBOR_SIZE = {"L": "Large", "M": "Medium", "S": "Small", "V": "Very small"}
HARBOR_TYPE = {
    "CN": "Coastal natural", "CB": "Coastal breakwater", "CT": "Coastal tide gate",
    "RN": "River natural", "RB": "River basin", "RT": "River tide gate",
    "LC": "Lake or canal", "OR": "Open roadstead",
}
MAX_VESSEL = {"L": "Large", "M": "Medium", "S": "Small"}

_FALLBACK_BUNKER = {
    "vlsfo_usd_mt": 720.0,
    "mgo_usd_mt": 1260.0,
    "hsfo_usd_mt": 580.0,
    "source": "fallback indicative (update when USDA/Ship&Bunker available)",
    "as_of": None,
}


def load_zones() -> Dict[str, Any]:
    if ZONES_PATH.exists():
        return json.loads(ZONES_PATH.read_text())
    return {"eca": [], "piracy": []}


def depth_label(code: Any) -> Optional[str]:
    if code is None or (isinstance(code, float) and str(code) == "nan"):
        return None
    c = str(code).strip().upper()
    if not c or c in ("NAN", "NONE", ""):
        return None
    return WPI_DEPTH.get(c, c)


def enrich_port_fields(row: dict) -> dict:
    """Add human-readable draft / berth / harbour fields from WPI codes."""
    out = dict(row)
    chan = row.get("CHAN_DEPTH") or row.get("chan_depth") or row.get("channel_depth")
    cargo = row.get("CARGODEPTH") or row.get("cargodepth") or row.get("cargo_depth")
    hsize = row.get("HARBORSIZE") or row.get("harborsize")
    htype = row.get("HARBORTYPE") or row.get("harbortype")
    mves = row.get("MAX_VESSEL") or row.get("max_vessel")
    out["channel_depth"] = depth_label(chan)
    out["cargo_berth_depth"] = depth_label(cargo)
    out["anchorage_depth"] = depth_label(chan)  # WPI often uses channel as proxy when no separate anchorage
    out["harbor_size"] = HARBOR_SIZE.get(str(hsize).strip().upper(), str(hsize) if hsize else None)
    out["harbor_type"] = HARBOR_TYPE.get(str(htype).strip().upper(), str(htype) if htype else None)
    out["max_vessel"] = MAX_VESSEL.get(str(mves).strip().upper(), str(mves) if mves else None)
    return out


def _point_in_ring(lon: float, lat: float, ring: List[List[float]]) -> bool:
    """Ray-casting point-in-polygon. ring is [[lon,lat],...]."""
    n = len(ring)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def _feature_contains(feat: dict, lon: float, lat: float) -> bool:
    geom = feat.get("geometry") or {}
    if geom.get("type") == "Polygon":
        coords = geom.get("coordinates") or []
        if not coords:
            return False
        return _point_in_ring(lon, lat, coords[0])
    return False


def analyze_route_zones(coordinates: List[List[float]]) -> Dict[str, Any]:
    """coordinates: list of [lon, lat]. Returns ECA/piracy exposure along route."""
    zones = load_zones()
    eca_feats = zones.get("eca") or []
    pir_feats = zones.get("piracy") or []
    if not coordinates:
        return {"eca_nm_share": 0.0, "eca_zones": [], "piracy_zones": [], "piracy_risk": False, "fuel_plan": []}

    # Sample every point (and midpoints for denser routes)
    pts = coordinates
    eca_hits: Dict[str, int] = {}
    pir_hits: Dict[str, int] = {}
    eca_count = 0
    for lon, lat in pts:
        in_eca = False
        for f in eca_feats:
            if _feature_contains(f, lon, lat):
                props = f.get("properties") or {}
                eca_hits[props.get("name") or props.get("id") or "ECA"] = eca_hits.get(props.get("name") or "ECA", 0) + 1
                in_eca = True
        if in_eca:
            eca_count += 1
        for f in pir_feats:
            if _feature_contains(f, lon, lat):
                props = f.get("properties") or {}
                pir_hits[props.get("name") or props.get("id") or "HRA"] = pir_hits.get(props.get("name") or "HRA", 0) + 1

    n = max(len(pts), 1)
    eca_share = eca_count / n
    fuel_plan = []
    if eca_share > 0.02:
        fuel_plan.append({
            "segment": "Inside ECA",
            "share": round(eca_share, 3),
            "required_fuel": "MGO or ULSFO (≤0.10% S) — HSFO/VLSFO not permitted without scrubber exemption",
            "zones": list(eca_hits.keys()),
        })
    if eca_share < 0.98:
        fuel_plan.append({
            "segment": "Outside ECA (global 0.50% S cap)",
            "share": round(1.0 - eca_share, 3),
            "required_fuel": "VLSFO (≤0.50% S) or HSFO if scrubber-fitted",
            "zones": [],
        })

    return {
        "eca_nm_share": round(eca_share, 3),
        "eca_zones": [{"name": k, "sample_hits": v} for k, v in eca_hits.items()],
        "piracy_zones": [{"name": k, "sample_hits": v} for k, v in pir_hits.items()],
        "piracy_risk": bool(pir_hits),
        "fuel_plan": fuel_plan,
    }


async def fetch_weather(lat: float, lon: float) -> Dict[str, Any]:
    """Free Open-Meteo marine + wind (no API key)."""
    out: Dict[str, Any] = {"lat": lat, "lon": lon, "source": "Open-Meteo"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            marine = await client.get(
                "https://marine-api.open-meteo.com/v1/marine",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "wave_height,wind_wave_height,ocean_current_velocity,ocean_current_direction,sea_surface_temperature",
                },
            )
            if marine.status_code == 200:
                cur = (marine.json() or {}).get("current") or {}
                out["wave_height_m"] = cur.get("wave_height")
                out["wind_wave_height_m"] = cur.get("wind_wave_height")
                out["current_velocity"] = cur.get("ocean_current_velocity")
                out["current_direction_deg"] = cur.get("ocean_current_direction")
                out["sst_c"] = cur.get("sea_surface_temperature")
            wind = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                    "wind_speed_unit": "kn",
                },
            )
            if wind.status_code == 200:
                cur = (wind.json() or {}).get("current") or {}
                out["wind_speed_kn"] = cur.get("wind_speed_10m")
                out["wind_direction_deg"] = cur.get("wind_direction_10m")
                out["wind_gusts_kn"] = cur.get("wind_gusts_10m")
        out["ok"] = True
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)
    return out


async def fetch_bunker_prices() -> Dict[str, Any]:
    """Try USDA Socrata daily bunker averages (Ship & Bunker via USDA); else fallback."""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(
                "https://agtransport.usda.gov/resource/4v3x-mj86.json",
                params={"$order": "day DESC", "$limit": "1"},
            )
            if r.status_code == 200:
                rows = r.json()
                if rows:
                    row = rows[0]
                    return {
                        "vlsfo_usd_mt": _num(row.get("vlsfo_fuel_oil_imo_2020_grade_0_5")),
                        "mgo_usd_mt": _num(row.get("marine_gas_oil")),
                        "hsfo_usd_mt": _num(row.get("intermdiate_fuel_oil_380cst")),
                        "ifo180_usd_mt": _num(row.get("intermdiate_fuel_oil_180cst")),
                        "source": "USDA AgTransport / Ship & Bunker daily average",
                        "as_of": row.get("day"),
                        "ok": True,
                    }
    except Exception:
        pass
    fb = dict(_FALLBACK_BUNKER)
    fb["ok"] = False
    fb["as_of"] = datetime.utcnow().strftime("%Y-%m-%d")
    return fb


def _num(v) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def estimate_fuel_cost(
    distance_nm: float,
    duration_days: float,
    consumption_tpd: float,
    eca_share: float,
    bunker: Dict[str, Any],
) -> Dict[str, Any]:
    """Simple fuel cost: split consumption by ECA share (MGO inside / VLSFO outside)."""
    tons = max(duration_days, 0) * max(consumption_tpd, 0)
    eca_tons = tons * max(0.0, min(1.0, eca_share))
    open_tons = tons - eca_tons
    mgo = bunker.get("mgo_usd_mt") or _FALLBACK_BUNKER["mgo_usd_mt"]
    vlsfo = bunker.get("vlsfo_usd_mt") or _FALLBACK_BUNKER["vlsfo_usd_mt"]
    hsfo = bunker.get("hsfo_usd_mt") or _FALLBACK_BUNKER["hsfo_usd_mt"]
    cost_mgo = eca_tons * mgo
    cost_vlsfo = open_tons * vlsfo
    return {
        "consumption_tpd": consumption_tpd,
        "total_tons": round(tons, 1),
        "eca_tons_mgo": round(eca_tons, 1),
        "open_tons_vlsfo": round(open_tons, 1),
        "mgo_usd_mt": mgo,
        "vlsfo_usd_mt": vlsfo,
        "hsfo_usd_mt": hsfo,
        "cost_eca_mgo_usd": round(cost_mgo, 0),
        "cost_open_vlsfo_usd": round(cost_vlsfo, 0),
        "total_cost_usd": round(cost_mgo + cost_vlsfo, 0),
        "note": "Indicative only. ECA requires ≤0.10% S (MGO/ULSFO). Outside ECA uses VLSFO ≤0.50% S. HSFO only with scrubber.",
        "bunker_source": bunker.get("source"),
        "bunker_as_of": bunker.get("as_of"),
    }
