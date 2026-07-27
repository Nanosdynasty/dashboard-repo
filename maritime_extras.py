"""
Maritime helpers: WPI depth/harbor enrichment, ECA/piracy zone analysis,
Open-Meteo marine weather, EuroOilWatch bunker prices, fuel-cost estimator.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

BASE_DIR = Path(__file__).parent
ZONES_PATH = BASE_DIR / "data" / "zones.json"

# ---------------------------------------------------------------------------
# WPI letter-code maps (Pub 150)
# ---------------------------------------------------------------------------
DEPTH_CODE: Dict[str, str] = {
    "A": "≥ 23.2 m (76 ft+)",
    "B": "21.6 – 22.9 m",
    "C": "20.1 – 21.3 m",
    "D": "18.6 – 19.8 m",
    "E": "17.1 – 18.2 m",
    "F": "15.5 – 16.8 m",
    "G": "14.0 – 15.2 m",
    "H": "12.5 – 13.7 m",
    "I": "11.0 – 12.2 m",
    "J": "11.0 – 12.2 m",
    "K": "9.4 – 10.7 m",
    "L": "7.9 – 9.1 m",
    "M": "6.4 – 7.6 m",
    "N": "4.9 – 6.1 m",
    "O": "3.4 – 4.6 m",
    "P": "1.8 – 3.0 m",
    "Q": "0 – 1.5 m",
}

HARBOR_SIZE: Dict[str, str] = {
    "V": "Very small",
    "S": "Small",
    "M": "Medium",
    "L": "Large",
}

HARBOR_TYPE: Dict[str, str] = {
    "CN": "Coastal natural",
    "CB": "Coastal breakwater",
    "CT": "Coastal tide gate",
    "RN": "River natural",
    "RB": "River basin",
    "RT": "River tide gate",
    "OR": "Open roadstead / offshore terminal",
    "LC": "Lake or canal",
    "TH": "Typhoon harbor",
}

MAX_VESSEL: Dict[str, str] = {
    "L": "Large (deep-draft capable)",
    "M": "Medium",
    "S": "Small",
    "V": "Very small / restricted",
}


def enrich_port_fields(row: Dict[str, Any]) -> Dict[str, Any]:
    """Turn raw WPI letter codes into human-readable port details for popups."""
    chan = str(row.get("CHAN_DEPTH") or row.get("chan_depth") or "").strip().upper()
    cargo = str(row.get("CARGODEPTH") or row.get("cargo_depth") or "").strip().upper()
    hsize = str(row.get("HARBORSIZE") or row.get("harbor_size") or "").strip().upper()
    htype = str(row.get("HARBORTYPE") or row.get("harbor_type") or "").strip().upper()
    maxv = str(row.get("MAX_VESSEL") or row.get("max_vessel") or "").strip().upper()

    details = {
        "channel_depth": DEPTH_CODE.get(chan, chan or "Unknown"),
        "channel_depth_code": chan or None,
        "cargo_depth": DEPTH_CODE.get(cargo, cargo or "Unknown / n/a"),
        "cargo_depth_code": cargo or None,
        "harbor_size": HARBOR_SIZE.get(hsize, hsize or "Unknown"),
        "harbor_type": HARBOR_TYPE.get(htype, htype or "Unknown"),
        "max_vessel": MAX_VESSEL.get(maxv, maxv or "Unknown"),
        "anchorage_note": (
            "Open roadstead / offshore – vessels typically anchor or use SPM / SBM"
            if htype == "OR"
            else "Check local sailing directions for designated anchorage depths"
        ),
    }
    return details


# ---------------------------------------------------------------------------
# Zones (ECA + piracy)
# ---------------------------------------------------------------------------
_zones_cache: Optional[Dict] = None


def load_zones() -> Dict:
    global _zones_cache
    if _zones_cache is not None:
        return _zones_cache
    if ZONES_PATH.exists():
        with open(ZONES_PATH, encoding="utf-8") as f:
            _zones_cache = json.load(f)
    else:
        _zones_cache = {"type": "FeatureCollection", "features": []}
    return _zones_cache


def _point_in_poly(lon: float, lat: float, poly: List[List[float]]) -> bool:
    """Ray-casting point-in-polygon (lon, lat order)."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i][0], poly[i][1]
        xj, yj = poly[j][0], poly[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi
        ):
            inside = not inside
        j = i
    return inside


def analyze_route_zones(coords: List[List[float]]) -> Dict[str, Any]:
    """
    coords: list of [lon, lat] from searoute.
    Returns which ECA / piracy polygons the route intersects and rough % of
    track inside ECA (for fuel-switch estimate).
    """
    zones = load_zones()
    features = zones.get("features", [])
    crossed_eca: List[Dict] = []
    crossed_piracy: List[Dict] = []
    eca_points = 0
    total = max(len(coords), 1)

    for lon, lat in coords:
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            if geom.get("type") != "Polygon":
                continue
            ring = geom["coordinates"][0]
            if _point_in_poly(lon, lat, ring):
                entry = {
                    "name": props.get("name"),
                    "zone_type": props.get("zone_type"),
                    "fuel": props.get("fuel"),
                    "description": props.get("description"),
                }
                if props.get("zone_type") == "ECA":
                    if entry not in crossed_eca:
                        crossed_eca.append(entry)
                    eca_points += 1
                elif props.get("zone_type") == "piracy":
                    if entry not in crossed_piracy:
                        crossed_piracy.append(entry)

    eca_fraction = eca_points / total
    return {
        "eca_zones": crossed_eca,
        "piracy_zones": crossed_piracy,
        "eca_fraction": round(eca_fraction, 3),
        "requires_mgo": eca_fraction > 0.01,
    }


# ---------------------------------------------------------------------------
# Weather (Open-Meteo Marine — free, no key)
# ---------------------------------------------------------------------------
async def fetch_weather(lat: float, lon: float) -> Dict[str, Any]:
    """Current marine conditions + wind at a point."""
    url = "https://marine-api.open-meteo.com/v1/marine"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join([
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "ocean_current_velocity",
            "ocean_current_direction",
            "sea_surface_temperature",
        ]),
        "timezone": "UTC",
    }
    wind_url = "https://api.open-meteo.com/v1/forecast"
    wind_params = {
        "latitude": lat,
        "longitude": lon,
        "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "wind_speed_unit": "kn",
        "timezone": "UTC",
    }
    out: Dict[str, Any] = {"lat": lat, "lon": lon, "source": "Open-Meteo"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, params=params)
            if r.status_code == 200:
                data = r.json()
                cur = data.get("current", {})
                out.update({
                    "wave_height_m": cur.get("wave_height"),
                    "wave_direction_deg": cur.get("wave_direction"),
                    "wave_period_s": cur.get("wave_period"),
                    "wind_wave_height_m": cur.get("wind_wave_height"),
                    "current_velocity_ms": cur.get("ocean_current_velocity"),
                    "current_direction_deg": cur.get("ocean_current_direction"),
                    "sst_c": cur.get("sea_surface_temperature"),
                    "time": cur.get("time"),
                })
            rw = await client.get(wind_url, params=wind_params)
            if rw.status_code == 200:
                wcur = rw.json().get("current", {})
                out["wind_speed_kn"] = wcur.get("wind_speed_10m")
                out["wind_direction_deg"] = wcur.get("wind_direction_10m")
                out["wind_gusts_kn"] = wcur.get("wind_gusts_10m")
    except Exception as e:
        out["error"] = str(e)
    return out


# ---------------------------------------------------------------------------
# Bunker prices (EuroOilWatch free derived estimates)
# ---------------------------------------------------------------------------
_DEFAULT_BUNKER = {
    "vlsfo_usd_mt": 580.0,
    "mgo_usd_mt": 820.0,
    "hsfo_usd_mt": 480.0,
    "source": "fallback illustrative (update live)",
    "note": "Approximate global average — not a live quote",
}


async def fetch_bunker_prices() -> Dict[str, Any]:
    """Try EuroOilWatch free bunker endpoint; fall back to defaults."""
    url = "https://eurooilwatch.com/api/v1/bunker"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                vlsfo = (
                    data.get("vlsfo")
                    or data.get("VLSFO")
                    or data.get("vlsfo_usd")
                    or data.get("prices", {}).get("vlsfo")
                )
                mgo = (
                    data.get("mgo")
                    or data.get("MGO")
                    or data.get("mgo_usd")
                    or data.get("prices", {}).get("mgo")
                )
                if isinstance(vlsfo, dict):
                    vlsfo = vlsfo.get("price") or vlsfo.get("usd")
                if isinstance(mgo, dict):
                    mgo = mgo.get("price") or mgo.get("usd")
                out = {
                    "vlsfo_usd_mt": float(vlsfo) if vlsfo is not None else _DEFAULT_BUNKER["vlsfo_usd_mt"],
                    "mgo_usd_mt": float(mgo) if mgo is not None else _DEFAULT_BUNKER["mgo_usd_mt"],
                    "hsfo_usd_mt": float(
                        data.get("hsfo") or data.get("HSFO") or _DEFAULT_BUNKER["hsfo_usd_mt"]
                    ),
                    "source": "EuroOilWatch (derived from Brent)",
                    "raw": data,
                    "note": "Illustrative estimate — verify with broker for fixture",
                }
                return out
    except Exception:
        pass
    return dict(_DEFAULT_BUNKER)


def estimate_fuel_cost(
    distance_nm: float,
    speed_knots: float,
    consumption_tpd: float,
    eca_fraction: float,
    bunker: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Simple voyage fuel model:
    - Days = distance / (speed * 24)
    - Total tons = days * consumption_tpd
    - Split by eca_fraction → MGO inside ECA, VLSFO outside
    - Cost = tons_mgo * mgo_price + tons_vlsfo * vlsfo_price
    """
    if speed_knots <= 0:
        speed_knots = 12.0
    days = distance_nm / (speed_knots * 24.0)
    total_tons = days * consumption_tpd
    mgo_tons = total_tons * eca_fraction
    vlsfo_tons = total_tons * (1.0 - eca_fraction)
    mgo_price = float(bunker.get("mgo_usd_mt", 820))
    vlsfo_price = float(bunker.get("vlsfo_usd_mt", 580))
    cost_mgo = mgo_tons * mgo_price
    cost_vlsfo = vlsfo_tons * vlsfo_price
    return {
        "distance_nm": round(distance_nm, 1),
        "steaming_days": round(days, 2),
        "consumption_tpd": consumption_tpd,
        "total_fuel_mt": round(total_tons, 1),
        "mgo_mt": round(mgo_tons, 1),
        "vlsfo_mt": round(vlsfo_tons, 1),
        "mgo_price_usd_mt": mgo_price,
        "vlsfo_price_usd_mt": vlsfo_price,
        "cost_mgo_usd": round(cost_mgo, 0),
        "cost_vlsfo_usd": round(cost_vlsfo, 0),
        "total_fuel_cost_usd": round(cost_mgo + cost_vlsfo, 0),
        "eca_fraction": eca_fraction,
        "fuel_note": (
            "Inside ECA only MGO (≤0.10% S) may be used. "
            "Outside ECA VLSFO (0.50% S) is assumed. "
            "HSFO only with scrubber (not modelled here)."
        ),
        "bunker_source": bunker.get("source"),
    }
