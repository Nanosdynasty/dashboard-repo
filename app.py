"""Global Energy Transition Dashboard"""
from __future__ import annotations
import os, json, io, uuid, asyncio, logging, math, re, zipfile
from pathlib import Path
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta, timezone
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
COAL_UPLOAD_DIR = UPLOAD_DIR / "coal"
COAL_UPLOAD_DIR.mkdir(exist_ok=True)
BUNDLED_DATA_DIR = UPLOAD_DIR / "_bundled_data"
BUNDLED_DATA_DIR.mkdir(exist_ok=True)
NPP_CACHE_DIR = UPLOAD_DIR / "_npp_cache"
NPP_CACHE_DIR.mkdir(exist_ok=True)
NPP_CACHE_PATH = NPP_CACHE_DIR / "power_dashboard.json"
NPP_CACHE_TTL_SECONDS = int(os.getenv("NPP_CACHE_TTL_SECONDS", "43200"))
NPP_ALL_INDIA_URL = "https://npp.gov.in/dashBoard/getAllZone"
NPP_HISTORY_URL = "https://npp.gov.in/dashBoard/get_installed_capacity_list"
NPP_GENERATION_URL = "https://npp.gov.in/dashBoard/getAllZoneGen"
INDIA_COAL_PORT_SPECS_PATH = DATA_DIR / "india_coal_port_specs.json"
PORT_APPROACHES_PATH = DATA_DIR / "port_approaches.json"

AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY", "").strip()

TRACKERS = {
    "coal_plants": {"label": "Coal Plants", "file": "coal_plants.csv.gz", "icon": "🔥"},
    "coal_terminals": {"label": "Coal Terminals", "file": "coal_terminals.csv", "icon": "🚢"},
    "world_ports": {"label": "World Ports", "file": "world_ports.csv.gz", "icon": "⚓"},
    "solar": {"label": "Solar", "file": "solar.csv.gz", "icon": "☀️"},
    "wind": {"label": "Wind", "file": "wind.csv.gz", "icon": "💨"},
    "hydro": {"label": "Hydropower", "file": "hydro.csv.gz", "icon": "💧"},
    "nuclear": {"label": "Nuclear", "file": "nuclear.csv.gz", "icon": "⚛️"},
    "geothermal": {"label": "Geothermal Power", "file": "geothermal.csv.gz", "icon": "♨"},
    "bioenergy": {"label": "Bioenergy Power", "file": "bioenergy.csv.gz", "icon": "◉"},
    "coal_mines": {"label": "Coal Mines", "file": "coal_mines.csv.gz", "icon": "◆"},
    "iron_ore_mines": {"label": "Iron Ore Mines", "file": "iron_ore_mines.csv.gz", "icon": "◆"},
    "iron_ore_terminals": {
        "label": "Iron Ore Trade Terminals",
        "file": "iron_ore_terminals.csv.gz",
        "icon": "◆",
    },
    "steel_plants": {"label": "Iron & Steel Plants", "file": "steel_plants.csv.gz", "icon": "●"},
    "cement_plants": {"label": "Cement Plants", "file": "cement_plants.csv.gz", "icon": "●"},
    "coal_trade_terminals": {
        "label": "Coal Trade Terminals",
        "file": "coal_trade_terminals.csv.gz",
        "icon": "◆",
    },
}
NORMALIZED_MAP_TRACKERS = {
    "geothermal",
    "bioenergy",
    "coal_mines",
    "iron_ore_mines",
    "iron_ore_terminals",
    "steel_plants",
    "cement_plants",
    "coal_trade_terminals",
}
user_datasets: Dict[str, Path] = {}
con = duckdb.connect(database=":memory:")

COAL_DATASET_TYPES = {
    "production": "Coal production",
    "imports": "Coal imports",
    "power_use": "Coal used in power generation",
    "power_stocks": "Power-sector coal stock cover",
    "renewables": "Renewable generation",
    "weather": "Weather, monsoon and heat",
}

STATUS_GROUPS = {
    "operating": {"operating", "operating pre-retirement"},
    "construction": {"construction", "under construction"},
    "proposed": {
        "proposed",
        "pre-construction",
        "announced",
        "permitted",
        "pre-permit",
    },
}


def _status_values(value: Optional[str]) -> List[str]:
    output: List[str] = []
    for item in _csv_values(value):
        canonical = item.strip().lower()
        output.extend(sorted(STATUS_GROUPS.get(canonical, {canonical})))
    return list(dict.fromkeys(output))


def _coal_dataset_metadata() -> List[Dict[str, Any]]:
    datasets: List[Dict[str, Any]] = []
    for path in sorted(COAL_UPLOAD_DIR.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                datasets.append(payload)
        except (OSError, json.JSONDecodeError):
            log.warning("Skipping unreadable coal dataset metadata: %s", path)
    return sorted(datasets, key=lambda item: item.get("uploaded_at", ""), reverse=True)


def _india_coal_port_specs() -> Dict[str, Any]:
    if not INDIA_COAL_PORT_SPECS_PATH.exists():
        return {
            "dataset": "India coal-port specifications",
            "quality_summary": {},
            "ports": [],
        }
    try:
        payload = json.loads(
            INDIA_COAL_PORT_SPECS_PATH.read_text(encoding="utf-8")
        )
        if not isinstance(payload, dict) or not isinstance(
            payload.get("ports"), list
        ):
            raise ValueError("Invalid port specification dataset shape")
        return payload
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not load India coal-port specifications: %s", exc)
        return {
            "dataset": "India coal-port specifications",
            "quality_summary": {},
            "ports": [],
        }


def _port_specification_summary(
    specification: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not specification:
        return None
    return {
        "official_port_name": specification.get("official_port_name"),
        "state_ut": specification.get("state_ut"),
        "port_class": specification.get("port_class"),
        "max_documented_draft_m": specification.get(
            "max_documented_draft_m"
        ),
        "documented_berth_count": specification.get(
            "documented_berth_count"
        ),
        "port_capacity_mtpa": specification.get("port_capacity_mtpa"),
        "latest_traffic_mt": specification.get("latest_traffic_mt"),
        "latest_traffic_period": specification.get(
            "latest_traffic_period"
        ),
        "official_website": specification.get("official_website"),
        "source_as_of": specification.get("source_as_of"),
    }


def _coal_asset_rows(status_group: str = "operating") -> List[Dict[str, Any]]:
    if status_group not in STATUS_GROUPS:
        raise ValueError("Status must be operating, construction or proposed")
    allowed_statuses = STATUS_GROUPS[status_group]
    table_names = {
        row[0]
        for row in con.execute(
            "SELECT table_name FROM information_schema.tables"
        ).fetchall()
    }
    rows: List[Dict[str, Any]] = []
    for tracker_id, label, asset_kind in (
        ("coal_mines", "Coal mine", "coal_mines"),
        ("steel_plants", "Steel plant", "steel_consumers"),
        ("cement_plants", "Cement plant", "cement_consumers"),
    ):
        if tracker_id not in table_names:
            continue
        placeholders = ",".join(["?"] * len(allowed_statuses))
        frame = con.execute(
            "SELECT asset_id AS id, name, status, capacity, capacity_unit, "
            "lat, lon, country, asset_type, parent_port, source_text "
            f"FROM {tracker_id} WHERE LOWER(CAST(country AS VARCHAR)) = 'india' "
            f"AND LOWER(TRIM(CAST(status AS VARCHAR))) IN ({placeholders})",
            sorted(allowed_statuses),
        ).fetchdf()
        for record in json.loads(frame.to_json(orient="records")):
            record["source_status"] = record.get("status")
            record["status"] = (
                "Operating"
                if status_group == "operating"
                else (
                    "Under construction"
                    if status_group == "construction"
                    else "Proposed"
                )
            )
            record["asset_kind"] = asset_kind
            record["asset_label"] = label
            record["project_status"] = (
                "Under construction" if status_group == "construction"
                else status_group.title()
            )
            rows.append(record)

    if "coal_plants" in table_names:
        placeholders = ",".join(["?"] * len(allowed_statuses))
        frame = con.execute(
            'SELECT "Plant name" AS name, LOWER(TRIM(CAST("Status" AS VARCHAR))) '
            'AS source_status, SUM(TRY_CAST("Capacity (MW)" AS DOUBLE)) AS capacity, '
            'AVG(TRY_CAST("Latitude" AS DOUBLE)) AS lat, '
            'AVG(TRY_CAST("Longitude" AS DOUBLE)) AS lon, '
            'MAX(CAST("Country/Area" AS VARCHAR)) AS country '
            'FROM coal_plants WHERE LOWER(CAST("Country/Area" AS VARCHAR)) = ? '
            f'AND LOWER(TRIM(CAST("Status" AS VARCHAR))) IN ({placeholders}) '
            'GROUP BY 1, 2',
            ["india", *sorted(allowed_statuses)],
        ).fetchdf()
        for index, record in enumerate(
            json.loads(frame.to_json(orient="records"))
        ):
            record.update(
                {
                    "id": f"india-coal-power-{index + 1}",
                    "status": (
                        "Under construction"
                        if status_group == "construction"
                        else status_group.title()
                    ),
                    "project_status": (
                        "Under construction"
                        if status_group == "construction"
                        else status_group.title()
                    ),
                    "capacity_unit": "MW",
                    "asset_type": "Coal-fired power",
                    "parent_port": None,
                    "source_text": "Global Energy Monitor coal plant tracker",
                    "asset_kind": "power_consumers",
                    "asset_label": "Coal-fired power plant",
                }
            )
            rows.append(record)

    if "coal_trade_terminals" in table_names:
        port_specifications = _india_coal_port_specs()
        specifications_by_id = {
            str(item.get("asset_id")): item
            for item in port_specifications.get("ports", [])
            if item.get("asset_id")
        }
        terminal_frame = con.execute(
            "SELECT asset_id AS id, name, status, capacity, capacity_unit, "
            "lat, lon, country, asset_type, parent_port, source_text "
            "FROM coal_trade_terminals "
            "WHERE LOWER(CAST(country AS VARCHAR)) = 'india' "
            "AND LOWER(TRIM(CAST(status AS VARCHAR))) IN "
            "('operating','construction','proposed')"
        ).fetchdf()
        terminals = json.loads(terminal_frame.to_json(orient="records"))
        by_parent: Dict[str, List[Dict[str, Any]]] = {}
        for terminal in terminals:
            key = str(
                terminal.get("parent_port")
                or terminal.get("name")
                or terminal.get("id")
            ).strip()
            by_parent.setdefault(key, []).append(terminal)
        for parent, group in by_parent.items():
            operating = [
                item for item in group
                if str(item.get("status") or "").lower() == "operating"
            ]
            expansion = [
                item for item in group
                if str(item.get("status") or "").lower()
                in {"construction", "proposed"}
            ]
            selected = (
                operating if status_group == "operating"
                else [
                    item for item in group
                    if str(item.get("status") or "").lower()
                    in allowed_statuses
                ]
            )
            if not selected:
                continue
            representative = selected[0]
            operating_capacity = sum(
                float(item.get("capacity") or 0) for item in operating
            )
            expansion_capacity = sum(
                float(item.get("capacity") or 0) for item in expansion
            )
            project_status = (
                "Operating" if status_group == "operating"
                else (
                    "Under construction"
                    if status_group == "construction"
                    else "Proposed"
                )
            )
            display_status = (
                "Operating"
                if operating
                else project_status
            )
            terminal_id = (
                "india-coal-terminal-"
                + re.sub(r"[^a-z0-9]+", "-", parent.lower()).strip("-")
            )
            terminal_row = {
                    **representative,
                    "id": terminal_id,
                    "name": parent,
                    "status": display_status,
                    "project_status": project_status,
                    "capacity": (
                        operating_capacity
                        if operating
                        else sum(float(item.get("capacity") or 0) for item in selected)
                    ),
                    "operating_capacity": operating_capacity or None,
                    "expansion_capacity": expansion_capacity or None,
                    "expansion_status": sorted(
                        {
                            (
                                "Under construction"
                                if str(item.get("status") or "").lower()
                                == "construction"
                                else "Proposed"
                            )
                            for item in expansion
                        }
                    ),
                    "potential_capacity": (
                        operating_capacity + expansion_capacity
                        if operating_capacity or expansion_capacity
                        else None
                    ),
                    "asset_kind": "coal_trade_terminals",
                    "asset_label": "Coal trade terminal",
                }
            port_summary = _port_specification_summary(
                specifications_by_id.get(terminal_id)
            )
            terminal_row["port_specification"] = port_summary
            terminal_row["port_specification_available"] = bool(port_summary)
            rows.append(terminal_row)

    if status_group == "operating":
        for port in ports.filtered(
            categories=["dry_bulk"], countries=["IN"]
        ):
            compact = ports.compact(port)
            rows.append(
                {
                    "id": compact["id"],
                    "name": compact["name"],
                    "status": "Operating",
                    "project_status": "Operating",
                    "capacity": None,
                    "capacity_unit": None,
                    "lat": compact["lat"],
                    "lon": compact["lon"],
                    "country": "India",
                    "asset_type": (
                        "Coal-linked"
                        if "coal" in compact["categories"]
                        else "Dry bulk"
                    ),
                    "parent_port": None,
                    "source_text": (
                        "NGA World Port Index; port role is source-classified "
                        "only and no project pipeline status is inferred"
                    ),
                    "asset_kind": "dry_bulk_ports",
                    "asset_label": "Dry-bulk port",
                }
            )
    return rows


_npp_cache_lock = asyncio.Lock()
_npp_memory_cache: Optional[Dict[str, Any]] = None


def _npp_iso_date(value: Any) -> Optional[str]:
    try:
        india_timezone = timezone(timedelta(hours=5, minutes=30))
        return datetime.fromtimestamp(
            float(value) / 1000, tz=india_timezone
        ).date().isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _transform_npp_power(
    all_india: Dict[str, Any],
    history: Dict[str, Any],
    generation: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    generation = generation or {}
    installed = all_india.get("installed_Capacity") or {}
    status = all_india.get("monthlyAllIndiaGen") or {}
    category = [
        {"id": "thermal", "label": "Thermal", "mw": installed.get("installed_capacity_thermal")},
        {"id": "hydro", "label": "Hydro", "mw": installed.get("installed_capacity_hydro")},
        {"id": "nuclear", "label": "Nuclear", "mw": installed.get("installed_capacity_nuclear")},
        {"id": "renewables", "label": "Renewable energy", "mw": installed.get("installed_capacity_res")},
    ]
    category = [
        {**item, "mw": float(item["mw"] or 0)}
        for item in category
    ]
    sector = [
        {
            "id": re.sub(
                r"[^a-z0-9]+",
                "_",
                str(item.get("sector_name") or "").lower(),
            ).strip("_"),
            "label": str(item.get("sector_name") or "").title(),
            "mw": float(item.get("installed_capacity") or 0),
        }
        for item in (all_india.get("installed_Capacity_List") or [])
        if item.get("sector_name")
    ]
    daily_demand = [
        {
            "date": item.get("reporting_date"),
            "peak_requirement_mw": float(item.get("peak_requirement") or 0),
            "demand_met_mw": float(item.get("max_demand_met") or 0),
            "deficit_mw": float(item.get("surplus_deficit") or 0),
        }
        for item in (all_india.get("dailyDemmandCp") or [])
    ]
    historical = []
    for item in history.get("linechartforCapacity") or []:
        row = {
            "date": _npp_iso_date(item.get("reporting_date")),
            "thermal_mw": float(item.get("installed_capacity_thermal") or 0),
            "hydro_mw": float(item.get("installed_capacity_hydro") or 0),
            "nuclear_mw": float(item.get("installed_capacity_nuclear") or 0),
            "renewables_mw": float(item.get("installed_capacity_res") or 0),
        }
        row["total_mw"] = sum(
            row[key]
            for key in ("thermal_mw", "hydro_mw", "nuclear_mw", "renewables_mw")
        )
        historical.append(row)
    historical = sorted(
        [row for row in historical if row["date"]],
        key=lambda row: row["date"],
    )
    installed_total = float(
        status.get("installed_capacity")
        or sum(item["mw"] for item in category)
    )
    category_total = sum(item["mw"] for item in category)
    sector_total = sum(item["mw"] for item in sector)
    tolerance = max(1.0, installed_total * 0.001)
    quality_checks = {
        "category_reconciles": abs(category_total - installed_total) <= tolerance,
        "sector_reconciles": abs(sector_total - installed_total) <= tolerance,
        "daily_demand_available": bool(daily_demand),
        "history_available": bool(historical),
    }
    daily_generation_source = generation.get("dailyPGen") or {}
    daily_generation = {
        "date": _npp_iso_date(daily_generation_source.get("generation_date")),
        "prior_year_date": _npp_iso_date(
            daily_generation_source.get("generation_date_ly")
        ),
        "actual_mu": float(
            daily_generation_source.get("actual_generation") or 0
        ),
        "prior_year_actual_mu": float(
            daily_generation_source.get("actual_generation_ly") or 0
        ),
        "program_mu": float(
            daily_generation_source.get("program_generation") or 0
        ),
        "deviation_percent": float(
            daily_generation_source.get("pdeviation") or 0
        ),
    }
    cumulative_generation = {
        "period_start": _npp_iso_date(
            daily_generation_source.get("generation_date_apr")
        ),
        "period_end": _npp_iso_date(
            daily_generation_source.get("generation_date")
        ),
        "prior_period_start": _npp_iso_date(
            daily_generation_source.get("generation_date_apr_ly")
        ),
        "prior_period_end": _npp_iso_date(
            daily_generation_source.get("generation_date_ly")
        ),
        "actual_mu": float(
            daily_generation_source.get("actual_generation_cumulative") or 0
        ),
        "prior_year_actual_mu": float(
            daily_generation_source.get(
                "actual_generation_cumulative_ly"
            ) or 0
        ),
        "program_mu": float(
            daily_generation_source.get("program_generation_cumulative") or 0
        ),
        "deviation_percent": float(
            daily_generation_source.get("pdeviation_cumulative") or 0
        ),
    }
    stock_band_fields = (
        ("0–5 days", "coal_0_5"),
        ("6–15 days", "coal_5_15"),
        ("16–25 days", "coal_15_25"),
        ("26+ days", "coal_gt_25"),
    )
    stock_mode_labels = {
        "N": "Non-pithead stations",
        "P": "Pithead stations",
    }
    coal_stock_availability = []
    coal_stock_date = None
    for item in generation.get("dailyColeStock") or []:
        mode = str(item.get("mode_transport") or "").upper()
        coal_stock_date = coal_stock_date or _npp_iso_date(
            item.get("coal_date")
        )
        for band, field in stock_band_fields:
            coal_stock_availability.append(
                {
                    "stock_cover_band": band,
                    "station_type": stock_mode_labels.get(
                        mode, f"Mode {mode or 'unclassified'}"
                    ),
                    "station_count": int(item.get(field) or 0),
                }
            )
    plf_rows = generation.get("plfMonthWise") or []

    def plf_snapshot(item: Dict[str, Any], category_name: str) -> Dict[str, Any]:
        return {
            "category": category_name,
            "financial_year": item.get("fin_year"),
            "report_type": item.get("report_type"),
            "period_end": _npp_iso_date(item.get("month_period_end")),
            "all_india_percent": float(item.get("plf_allindia") or 0),
            "central_percent": float(item.get("plf_central") or 0),
            "state_percent": float(item.get("plf_state") or 0),
            "private_percent": float(item.get("plf_private") or 0),
        }

    sector_plf = {
        "thermal_current": (
            plf_snapshot(plf_rows[0], "Thermal") if len(plf_rows) > 0 else None
        ),
        "thermal_previous": (
            plf_snapshot(plf_rows[1], "Thermal") if len(plf_rows) > 1 else None
        ),
        "nuclear_current": (
            plf_snapshot(plf_rows[2], "Nuclear") if len(plf_rows) > 2 else None
        ),
        "nuclear_previous": (
            plf_snapshot(plf_rows[3], "Nuclear") if len(plf_rows) > 3 else None
        ),
    }
    generation_quality_checks = {
        "daily_generation_available": bool(
            daily_generation_source.get("generation_date")
            and daily_generation["actual_mu"]
        ),
        "cumulative_generation_available": bool(
            cumulative_generation["actual_mu"]
        ),
        "coal_stock_availability_available": bool(coal_stock_availability),
        "sector_plf_available": bool(sector_plf["thermal_current"]),
    }
    return {
        "source": {
            "name": "National Power Portal, Government of India",
            "dashboard_url": "https://npp.gov.in/dashBoard/cp-map-dashboard",
            "generation_dashboard_url": (
                "https://npp.gov.in/dashBoard/gc-map-dashboard"
            ),
            "all_india_endpoint": NPP_ALL_INDIA_URL,
            "history_endpoint": NPP_HISTORY_URL,
            "generation_endpoint": NPP_GENERATION_URL,
        },
        "source_reported_date": _npp_iso_date(
            installed.get("reporting_date") or status.get("reporting_date")
        ),
        "installed_capacity_mw": installed_total,
        "category_capacity": category,
        "sector_capacity": sector,
        "all_india_status": {
            "monitored_capacity_mw": float(status.get("monitored_capacity") or 0),
            "online_capacity_mw": float(status.get("online_capacity") or 0),
            "under_maintenance_capacity_mw": float(
                status.get("under_maintenance_capacity") or 0
            ),
            "shutdown_capacity_mw": float(status.get("shutdown_capacity") or 0),
            "unscheduled_capacity_mw": float(
                status.get("unscheduled_capacity") or 0
            ),
            "note": (
                "Shutdown and unscheduled capacity are NPP-reported supporting "
                "status measures and are not added to the installed-capacity total."
            ),
        },
        "daily_demand": daily_demand,
        "daily_generation": daily_generation,
        "cumulative_generation": cumulative_generation,
        "coal_stock_availability": {
            "date": coal_stock_date,
            "unit": "stations",
            "rows": coal_stock_availability,
            "definition": (
                "Number of NPP-reported generating stations grouped by coal "
                "stock-cover days and pithead status."
            ),
        },
        "sector_plf": sector_plf,
        "historical_installed_capacity": historical,
        "quality_checks": quality_checks,
        "generation_quality_checks": generation_quality_checks,
        "excluded_visuals": ["Historical growth of electricity consumption"],
    }


async def _get_npp_power_dashboard(force: bool = False) -> Dict[str, Any]:
    global _npp_memory_cache
    now = datetime.now(timezone.utc)
    if _npp_memory_cache and not force:
        fetched = datetime.fromisoformat(
            str(_npp_memory_cache["fetched_at"]).replace("Z", "+00:00")
        )
        if (now - fetched).total_seconds() < NPP_CACHE_TTL_SECONDS:
            return _npp_memory_cache
    async with _npp_cache_lock:
        if _npp_memory_cache and not force:
            fetched = datetime.fromisoformat(
                str(_npp_memory_cache["fetched_at"]).replace("Z", "+00:00")
            )
            if (now - fetched).total_seconds() < NPP_CACHE_TTL_SECONDS:
                return _npp_memory_cache
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                all_response, history_response, generation_response = await asyncio.gather(
                    client.get(NPP_ALL_INDIA_URL),
                    client.get(NPP_HISTORY_URL),
                    client.get(NPP_GENERATION_URL),
                )
            all_response.raise_for_status()
            history_response.raise_for_status()
            generation_response.raise_for_status()
            all_india = all_response.json()
            if isinstance(all_india, str):
                all_india = json.loads(all_india)
            history = history_response.json()
            if isinstance(history, str):
                history = json.loads(history)
            generation = generation_response.json()
            if isinstance(generation, str):
                generation = json.loads(generation)
            payload = _transform_npp_power(all_india, history, generation)
            if not all(payload["quality_checks"].values()):
                raise ValueError(
                    "NPP response failed one or more reconciliation/freshness checks"
                )
            payload.update(
                {
                    "fetched_at": now.isoformat().replace("+00:00", "Z"),
                    "refresh_interval_seconds": NPP_CACHE_TTL_SECONDS,
                    "stale": False,
                }
            )
            NPP_CACHE_PATH.write_text(
                json.dumps(payload, indent=2), encoding="utf-8"
            )
            _npp_memory_cache = payload
            return payload
        except Exception as exc:
            log.warning("NPP refresh failed: %s", exc)
            cached = _npp_memory_cache
            if cached is None and NPP_CACHE_PATH.exists():
                try:
                    cached = json.loads(
                        NPP_CACHE_PATH.read_text(encoding="utf-8")
                    )
                except (OSError, json.JSONDecodeError):
                    cached = None
            if cached:
                fallback = dict(cached)
                fallback["stale"] = True
                fallback["refresh_error"] = str(exc)
                fallback["refresh_interval_seconds"] = NPP_CACHE_TTL_SECONDS
                _npp_memory_cache = fallback
                return fallback
            raise HTTPException(
                502,
                "Official NPP data is temporarily unavailable and no validated cache exists.",
            )

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
    from_port_id: Optional[str] = None
    to_port_id: Optional[str] = None
    speed_knots: float = 12.0
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    avoid: Optional[List[str]] = None
    sea_margin_pct: float = 5.0
    port_time_hours: float = 0.0
    canal_delay_hours: float = 0.0
    consumption_tpd: float = 25.0  # tonnes per day fuel burn


PASSAGE_LABELS = {
    "babalmandab": "Bab el-Mandeb",
    "bosporus": "Bosporus",
    "gibraltar": "Strait of Gibraltar",
    "suez": "Suez Canal",
    "panama": "Panama Canal",
    "ormuz": "Strait of Hormuz",
    "northwest": "Northwest Passage",
    "malacca": "Strait of Malacca",
    "sunda": "Sunda Strait",
    "chili": "Cape Horn / Chilean route",
    "south_africa": "Cape of Good Hope",
}
ALLOWED_ROUTE_RESTRICTIONS = set(PASSAGE_LABELS)


def _load_port_approach_data() -> Dict[str, Any]:
    try:
        payload = json.loads(PORT_APPROACHES_PATH.read_text(encoding="utf-8"))
        if not isinstance(payload.get("approaches"), dict):
            raise ValueError("approaches must be an object")
        if not isinstance(payload.get("corridors"), list):
            raise ValueError("corridors must be an array")
        return payload
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not load verified port approaches: %s", exc)
        return {"approaches": {}, "corridors": []}


PORT_APPROACH_DATA = _load_port_approach_data()


def _port_approach(port_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if port_id is None:
        return None
    return PORT_APPROACH_DATA["approaches"].get(str(port_id))


def _haversine_nm(left: List[float], right: List[float]) -> float:
    """Great-circle distance between [lon, lat] points in nautical miles."""
    lon1, lat1 = map(math.radians, left)
    lon2, lat2 = map(math.radians, right)
    delta_lon = (lon2 - lon1 + math.pi) % (2 * math.pi) - math.pi
    delta_lat = lat2 - lat1
    hav = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 3440.065 * 2 * math.asin(min(1.0, math.sqrt(hav)))


def _wrapped_lon_near(lon: float, reference: float) -> float:
    """Return the equivalent longitude closest to the previous route point."""
    return lon + 360.0 * round((reference - lon) / 360.0)


def _route_with_endpoints(
    origin: List[float],
    network_coordinates: List[List[float]],
    destination: List[float],
) -> List[List[float]]:
    """Unwrap a route continuously and attach exact selected port coordinates."""
    output: List[List[float]] = [[float(origin[0]), float(origin[1])]]
    for raw_lon, raw_lat in network_coordinates:
        output.append([
            _wrapped_lon_near(float(raw_lon), output[-1][0]),
            float(raw_lat),
        ])
    output.append([
        _wrapped_lon_near(float(destination[0]), output[-1][0]),
        float(destination[1]),
    ])
    deduplicated: List[List[float]] = []
    for point in output:
        if not deduplicated or _haversine_nm(deduplicated[-1], point) > 0.001:
            deduplicated.append(point)
    return deduplicated


def _polyline_distance_nm(coordinates: List[List[float]]) -> float:
    return sum(
        _haversine_nm(coordinates[index - 1], coordinates[index])
        for index in range(1, len(coordinates))
    )


def _geodesic_point(
    left: List[float], right: List[float], fraction: float
) -> List[float]:
    """Spherical interpolation between two [lon, lat] points."""
    lon1, lat1 = map(math.radians, left)
    lon2, lat2 = map(math.radians, right)
    vectors = [
        (
            math.cos(lat) * math.cos(lon),
            math.cos(lat) * math.sin(lon),
            math.sin(lat),
        )
        for lon, lat in ((lon1, lat1), (lon2, lat2))
    ]
    dot = max(-1.0, min(1.0, sum(a * b for a, b in zip(*vectors))))
    angle = math.acos(dot)
    if angle < 1e-12:
        return [float(left[0]), float(left[1])]
    scale = math.sin(angle)
    left_weight = math.sin((1.0 - fraction) * angle) / scale
    right_weight = math.sin(fraction * angle) / scale
    x, y, z = (
        left_weight * vectors[0][index] + right_weight * vectors[1][index]
        for index in range(3)
    )
    lon = math.degrees(math.atan2(y, x))
    lat = math.degrees(math.atan2(z, math.hypot(x, y)))
    return [lon, lat]


def _densify_geodesic_route(
    waypoints: List[List[float]], max_leg_nm: float = 25.0
) -> List[List[float]]:
    """Add graph nodes so every analytical corridor edge is short and smooth."""
    if len(waypoints) < 2:
        return [list(point) for point in waypoints]
    output = [[float(waypoints[0][0]), float(waypoints[0][1])]]
    for right in waypoints[1:]:
        left = output[-1]
        distance = _haversine_nm(left, right)
        steps = max(1, math.ceil(distance / max_leg_nm))
        for step in range(1, steps + 1):
            point = _geodesic_point(left, right, step / steps)
            point[0] = _wrapped_lon_near(point[0], output[-1][0])
            output.append(point)
    return output


def _compute_curated_corridor(
    from_port_id: Optional[str],
    to_port_id: Optional[str],
    speed_knots: float,
    restrictions: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Use a provenance-backed dense corridor when both endpoints match."""
    if from_port_id is None or to_port_id is None:
        return None
    from_id, to_id = str(from_port_id), str(to_port_id)
    origin_approach = _port_approach(from_id)
    destination_approach = _port_approach(to_id)
    if not origin_approach or not destination_approach:
        return None
    corridor = next(
        (
            item
            for item in PORT_APPROACH_DATA["corridors"]
            if set(map(str, item.get("endpoint_port_ids", [])))
            == {from_id, to_id}
        ),
        None,
    )
    if not corridor:
        return None
    configured_ids = list(map(str, corridor["endpoint_port_ids"]))
    forward = configured_ids == [from_id, to_id]
    intermediate = [
        [float(item["longitude"]), float(item["latitude"])]
        for item in corridor.get("waypoints", [])
    ]
    if not forward:
        intermediate.reverse()
    origin = [
        float(origin_approach["longitude"]),
        float(origin_approach["latitude"]),
    ]
    destination = [
        float(destination_approach["longitude"]),
        float(destination_approach["latitude"]),
    ]
    coordinates = _densify_geodesic_route(
        [origin, *intermediate, destination], max_leg_nm=25.0
    )
    distance_nm = _polyline_distance_nm(coordinates)
    direct_nm = _haversine_nm(origin, destination)
    duration_hours = distance_nm / speed_knots if speed_knots > 0 else 0.0
    return {
        "distance_nm": round(distance_nm, 1),
        "network_distance_nm": round(distance_nm, 1),
        "great_circle_nm": round(direct_nm, 1),
        "detour_factor": round(distance_nm / direct_nm, 3) if direct_nm else 1.0,
        "origin_connector_nm": 0.0,
        "destination_connector_nm": 0.0,
        "route_confidence": "high",
        "waypoint_count": len(coordinates),
        "distance_miles": round(distance_nm * 1.150779, 1),
        "distance_km": round(distance_nm * 1.852, 1),
        "duration_hours": round(duration_hours, 2),
        "duration_days": round(duration_hours / 24.0, 2),
        "speed_knots": speed_knots,
        "coordinates": coordinates,
        "units": "nm",
        "via": corridor.get("label"),
        "passages": [],
        "passage_ids": [],
        "restrictions": restrictions or [],
        "routing_profile": "verified-approach-dense-corridor",
        "corridor_id": corridor["id"],
        "approach_sources": [
            {
                "port_id": from_id,
                "port_name": origin_approach["port_name"],
                "kind": origin_approach["kind"],
                "source_title": origin_approach["source_title"],
                "source_url": origin_approach["source_url"],
            },
            {
                "port_id": to_id,
                "port_name": destination_approach["port_name"],
                "kind": destination_approach["kind"],
                "source_title": destination_approach["source_title"],
                "source_url": destination_approach["source_url"],
            },
        ],
    }


def _infer_passage(coords):
    if not coords:
        return None
    tags = []
    for lon, lat in coords:
        lon = ((float(lon) + 180.0) % 360.0) - 180.0
        if 29 < lat < 32 and 32 < lon < 33: tags.append("Suez Canal")
        elif 8.5 < lat < 9.5 and -80 < lon < -79: tags.append("Panama Canal")
        elif 25.5 < lat < 27 and 56 < lon < 57.5: tags.append("Strait of Hormuz")
        elif 1 < lat < 4 and 100 < lon < 104: tags.append("Strait of Malacca")
        elif -7 < lat < -5 and 104.5 < lon < 106.5: tags.append("Sunda Strait")
        elif 12 < lat < 14 and 42 < lon < 44: tags.append("Bab el-Mandeb")
        elif lat < -33 and 15 < lon < 22: tags.append("Cape of Good Hope")
        elif lat < -54 and -70 < lon < -65: tags.append("Cape Horn / Chilean route")
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
    restrictions = [
        value for value in (restrictions or ["northwest"])
        if value in ALLOWED_ROUTE_RESTRICTIONS
    ]
    origin = [float(from_lon), float(from_lat)]
    destination = [float(to_lon), float(to_lat)]
    feature = sr.searoute(
        origin, destination,
        units="naut", speed_knot=speed_knots, append_orig_dest=False,
        restrictions=restrictions, return_passages=True,
        algorithm="astar",
    )
    props = feature.get("properties", {}) if isinstance(feature, dict) else feature.properties
    geom = feature.get("geometry", {}) if isinstance(feature, dict) else feature.geometry
    network_coords = geom.get("coordinates", []) if isinstance(geom, dict) else getattr(geom, "coordinates", [])
    if not network_coords:
        raise ValueError("No navigable maritime-network path was found")
    coords = _route_with_endpoints(origin, network_coords, destination)
    length = float(props.get("length", 0) or 0)
    units = str(props.get("units", "naut"))
    network_distance_nm = _length_to_nm(length, units)
    origin_connector_nm = _haversine_nm(origin, network_coords[0])
    destination_connector_nm = _haversine_nm(network_coords[-1], destination)
    distance_nm = _polyline_distance_nm(coords)
    direct_nm = _haversine_nm(origin, destination)
    duration_hours = distance_nm / speed_knots if speed_knots > 0 else 0.0
    passage_ids = [
        str(value).lower()
        for value in (props.get("traversed_passages") or props.get("passages") or [])
    ]
    reported_passages = [
        PASSAGE_LABELS.get(value, value.replace("_", " ").title())
        for value in passage_ids
    ]
    inferred_via = _infer_passage(coords)
    ordered_passages = inferred_via.split(", ") if inferred_via else []
    passages = ordered_passages + [
        value for value in reported_passages if value not in ordered_passages
    ]
    via = ", ".join(passages) if passages else None
    max_connector_nm = max(origin_connector_nm, destination_connector_nm)
    confidence = "high" if max_connector_nm <= 5 else "medium" if max_connector_nm <= 20 else "low"
    return {
        "distance_nm": round(distance_nm, 1),
        "network_distance_nm": round(network_distance_nm, 1),
        "great_circle_nm": round(direct_nm, 1),
        "detour_factor": round(distance_nm / direct_nm, 3) if direct_nm else 1.0,
        "origin_connector_nm": round(origin_connector_nm, 1),
        "destination_connector_nm": round(destination_connector_nm, 1),
        "route_confidence": confidence,
        "waypoint_count": len(coords),
        "distance_miles": round(distance_nm * 1.150779, 1),
        "distance_km": round(distance_nm * 1.852, 1),
        "duration_hours": round(duration_hours, 2),
        "duration_days": round(duration_hours / 24.0, 2),
        "speed_knots": speed_knots,
        "coordinates": coords,
        "units": "nm",
        "via": via,
        "passages": passages,
        "passage_ids": passage_ids,
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


@app.get("/api/layer-facets")
async def layer_facets(trackers: str = Query(...)):
    """Return shared country/status/type filters for one or more map layers."""
    selected = [
        value for value in _csv_values(trackers)
        if value in TRACKERS and value != "world_ports"
    ]
    if not selected:
        raise HTTPException(400, "No valid map layers selected")
    country_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    type_counts: Dict[str, int] = {}
    for tracker_id in selected:
        normalized = tracker_id in NORMALIZED_MAP_TRACKERS
        columns = {row[0] for row in con.execute(f"DESCRIBE {tracker_id}").fetchall()}
        country_name = "country" if normalized else (
            "Country/Area" if "Country/Area" in columns else None
        )
        status_name = "status" if normalized else (
            "Status" if "Status" in columns else None
        )
        countries = []
        statuses = []
        if country_name:
            country_column = f'"{country_name}"'
            countries = con.execute(
                f"SELECT CAST({country_column} AS VARCHAR), COUNT(*) FROM {tracker_id} "
                f"WHERE {country_column} IS NOT NULL "
                f"AND TRIM(CAST({country_column} AS VARCHAR)) NOT IN ('', '-', 'unknown') "
                f"GROUP BY 1"
            ).fetchall()
        if status_name:
            status_column = f'"{status_name}"'
            statuses = con.execute(
                f"SELECT CAST({status_column} AS VARCHAR), COUNT(*) FROM {tracker_id} "
                f"WHERE {status_column} IS NOT NULL "
                f"AND TRIM(CAST({status_column} AS VARCHAR)) NOT IN ('', '-', 'unknown') "
                f"GROUP BY 1"
            ).fetchall()
        for label, count in countries:
            country_counts[str(label)] = country_counts.get(str(label), 0) + int(count)
        for label, count in statuses:
            canonical = str(label).strip().lower()
            status_counts[canonical] = status_counts.get(canonical, 0) + int(count)
        if normalized:
            types = con.execute(
                f"SELECT CAST(asset_type AS VARCHAR), COUNT(*) FROM {tracker_id} "
                "WHERE asset_type IS NOT NULL "
                "AND TRIM(CAST(asset_type AS VARCHAR)) NOT IN ('', '-', 'unknown') "
                "GROUP BY 1"
            ).fetchall()
            for label, count in types:
                type_counts[str(label)] = type_counts.get(str(label), 0) + int(count)
    return {
        "countries": [
            {"id": label, "label": label, "count": count}
            for label, count in sorted(country_counts.items())
        ],
        "statuses": [
            {"id": label, "label": label.replace("_", " ").title(), "count": count}
            for label, count in sorted(
                status_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "asset_types": [
            {"id": label, "label": label, "count": count}
            for label, count in sorted(type_counts.items())
        ],
    }

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
    limit: int = Query(5000, ge=1, le=150000),
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
    if tracker_id in NORMALIZED_MAP_TRACKERS:
        columns = {
            row[0] for row in con.execute(f"DESCRIBE {tracker_id}").fetchall()
        }
        clauses = ["lat IS NOT NULL", "lon IS NOT NULL"]
        params: List[Any] = []
        if status:
            values = _status_values(status)
            if values:
                clauses.append(
                    "LOWER(CAST(status AS VARCHAR)) IN ("
                    + ",".join(["?"] * len(values))
                    + ")"
                )
                params.extend(value.lower() for value in values)
        if country:
            values = _csv_values(country)
            if values:
                clauses.append(
                    "LOWER(CAST(country AS VARCHAR)) IN ("
                    + ",".join(["?"] * len(values))
                    + ")"
                )
                params.extend(value.lower() for value in values)
        optional_columns = {
            name for name in (
                "source_url",
                "source_date",
                "evidence_level",
                "coverage_note",
            )
            if name in columns
        }
        optional_select = "".join(
            f", {name}" for name in sorted(optional_columns)
        )
        sql = (
            "SELECT asset_id AS id, name, unit, status, capacity, "
            "capacity_unit, lat, lon, country, layer, asset_type, parent_port, "
            "product_type, source_text"
            + optional_select
            + " FROM "
            + tracker_id
            + " WHERE "
            + " AND ".join(clauses)
            + " LIMIT "
            + str(limit)
        )
        frame = con.execute(sql, params).fetchdf()
        return json.loads(frame.to_json(orient="records"))
    columns = {row[0] for row in con.execute(f"DESCRIBE {tracker_id}").fetchall()}
    clauses = ['"Latitude" IS NOT NULL', '"Longitude" IS NOT NULL']
    params = []
    if status and "Status" in columns:
        values = _status_values(status)
        clauses.append(
            'LOWER(CAST("Status" AS VARCHAR)) IN ('
            + ",".join(["?"] * len(values))
            + ")"
        )
        params.extend(value.lower() for value in values)
    if country:
        values = _csv_values(country)
        if "Country/Area" not in columns:
            return []
        clauses.append(
            'LOWER(CAST("Country/Area" AS VARCHAR)) IN ('
            + ",".join(["?"] * len(values))
            + ")"
        )
        params.extend(value.lower() for value in values)
    name_expr = (
        '"Plant name"' if "Plant name" in columns
        else '"Project Name"' if "Project Name" in columns
        else '"GEM location ID"'
    )
    unit_expr = '"Unit name"' if "Unit name" in columns else "NULL"
    country_expr = '"Country/Area"' if "Country/Area" in columns else "NULL"
    capacity_expr = (
        'TRY_CAST("Capacity (MW)" AS DOUBLE)'
        if "Capacity (MW)" in columns else "NULL"
    )
    sql = (
        f"SELECT {name_expr} as name, {unit_expr} as unit, "
        f'"Status" as status, {capacity_expr} as capacity, '
        'TRY_CAST("Latitude" AS DOUBLE) as lat, '
        'TRY_CAST("Longitude" AS DOUBLE) as lon, '
        f"{country_expr} as country FROM {tracker_id} WHERE "
        + " AND ".join(clauses)
        + " LIMIT "
        + str(limit)
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


@app.get("/api/coal/summary")
async def coal_summary():
    """Describe verified India map coverage and uploaded analytical datasets."""
    datasets = _coal_dataset_metadata()
    assets = _coal_asset_rows()
    counts = {
        key: sum(row["asset_kind"] == key for row in assets)
        for key in (
            "coal_mines",
            "coal_trade_terminals",
            "dry_bulk_ports",
            "power_consumers",
            "steel_consumers",
            "cement_consumers",
        )
    }
    available_types = sorted(
        {item.get("dataset_type") for item in datasets if item.get("dataset_type")}
    )
    return {
        "status": "ready" if datasets else "awaiting_data",
        "country": "India",
        "map_assets": counts,
        "datasets": datasets,
        "available_dataset_types": available_types,
        "dataset_types": [
            {"id": key, "label": label}
            for key, label in COAL_DATASET_TYPES.items()
        ],
        "supported_analysis": [
            "Monthly production versus imports",
            "Year-on-year production and imports",
            "Coal used in power generation by week, month, quarter and year",
            "Aligned-series correlation with renewables, monsoon and heat",
        ],
        "metric_definitions": {
            "stock_cover_days": {
                "label": "Coal stock cover",
                "unit": "days",
                "formula": (
                    "usable coal inventory tonnes / average daily coal "
                    "consumption tonnes"
                ),
                "supporting_fields": [
                    "usable coal inventory tonnes",
                    "average daily coal consumption tonnes",
                    "observation date",
                    "plant, state or national scope",
                ],
                "caveat": (
                    "Use a reported days-of-stock figure when authoritative. "
                    "Otherwise calculate only when inventory and consumption "
                    "refer to the same scope and observation period."
                ),
            }
        },
        "quality_note": (
            "Map assets use GEM and WPI sources. Operational production, trade, "
            "use, stocks and driver metrics are shown only after user data is uploaded."
        ),
        "status_policy": {
            "default": "operating",
            "available": ["operating", "construction", "proposed"],
            "excluded": ["retired", "cancelled", "shelved", "mothballed"],
        },
    }


@app.get("/api/coal/assets")
async def coal_assets(
    asset_kind: Optional[str] = None,
    status_group: str = Query("operating"),
    limit: int = Query(5000, ge=1, le=20_000),
):
    try:
        rows = _coal_asset_rows(status_group=status_group)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if asset_kind:
        allowed = set(_csv_values(asset_kind))
        rows = [row for row in rows if row["asset_kind"] in allowed]
    return {"data": rows[:limit], "total": len(rows)}


@app.get("/api/coal/port-specifications")
async def coal_port_specifications():
    return _india_coal_port_specs()


@app.get("/api/coal/port-specifications/export")
async def export_coal_port_specifications():
    payload = _india_coal_port_specs()
    export_rows = []
    for item in payload.get("ports", []):
        export_rows.append(
            {
                "Asset ID": item.get("asset_id"),
                "Coal terminal card": item.get("asset_name"),
                "Official port name": item.get("official_port_name"),
                "State / UT": item.get("state_ut"),
                "Coast": item.get("coast"),
                "Port class": item.get("port_class"),
                "Operating status": item.get("operating_status"),
                "Latitude": item.get("latitude"),
                "Longitude": item.get("longitude"),
                "Max documented draft (m)": item.get(
                    "max_documented_draft_m"
                ),
                "Documented berth count": item.get(
                    "documented_berth_count"
                ),
                "Documented dry-bulk berth count": item.get(
                    "documented_dry_bulk_berth_count"
                ),
                "Facility record count": len(
                    item.get("berth_facilities", [])
                ),
                "Port capacity (MTPA)": item.get("port_capacity_mtpa"),
                "Terminal operating capacity (MTPA)": item.get(
                    "terminal_operating_capacity_mtpa"
                ),
                "Terminal expansion capacity (MTPA)": item.get(
                    "terminal_expansion_capacity_mtpa"
                ),
                "Latest port traffic (MT)": item.get("latest_traffic_mt"),
                "Latest traffic period": item.get("latest_traffic_period"),
                "Coal flow record count": len(
                    item.get("commodity_flows", [])
                ),
                "Official website": item.get("official_website"),
                "Source as of": item.get("source_as_of"),
                "Specification note": item.get("specification_note"),
                "Data caveat": item.get("data_caveat"),
            }
        )
    frame = pd.DataFrame(export_rows)
    buffer = io.StringIO()
    frame.to_csv(buffer, index=False)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                "attachment; filename=india_coal_port_specifications.csv"
            )
        },
    )


@app.get("/api/coal/port-specifications/{asset_id}")
async def coal_port_specification(asset_id: str):
    payload = _india_coal_port_specs()
    specification = next(
        (
            item
            for item in payload.get("ports", [])
            if str(item.get("asset_id")) == asset_id
        ),
        None,
    )
    if not specification:
        raise HTTPException(404, "Port specification not found")
    return specification


@app.get("/api/coal/datasets")
async def coal_datasets():
    return {"data": _coal_dataset_metadata()}


@app.get("/api/npp/power-dashboard")
async def npp_power_dashboard(force: bool = Query(False)):
    return await _get_npp_power_dashboard(force=force)


@app.post("/api/coal/upload")
async def upload_coal_dataset(
    dataset_type: str = Query(...),
    file: UploadFile = File(...),
):
    if dataset_type not in COAL_DATASET_TYPES:
        raise HTTPException(400, "Unknown coal dataset type")
    original_name = Path(file.filename or "coal-data")
    ext = original_name.suffix.lower()
    if ext not in {".xlsx", ".xls", ".csv", ".json"}:
        raise HTTPException(400, "Supported: Excel, CSV, JSON")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50 MB)")
    try:
        if ext in {".xlsx", ".xls"}:
            frame = pd.read_excel(io.BytesIO(content), engine="openpyxl")
        elif ext == ".csv":
            frame = pd.read_csv(io.BytesIO(content))
        else:
            frame = pd.read_json(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(400, f"Parse error: {exc}")
    if frame.empty:
        raise HTTPException(400, "The uploaded dataset has no rows")
    frame.columns = [str(column).strip() for column in frame.columns]
    uid = uuid.uuid4().hex[:12]
    safe_stem = re.sub(
        r"[^A-Za-z0-9_-]+", "_", original_name.stem
    ).strip("_") or "coal_data"
    csv_path = COAL_UPLOAD_DIR / f"{dataset_type}_{safe_stem}_{uid}.csv"
    meta_path = csv_path.with_suffix(".json")
    frame.to_csv(csv_path, index=False)
    date_candidates = [
        column for column in frame.columns
        if any(token in column.lower() for token in ("date", "month", "week", "year", "period"))
    ]
    numeric_candidates = [
        column for column in frame.columns
        if pd.to_numeric(frame[column], errors="coerce").notna().sum()
        >= max(1, int(len(frame) * 0.5))
    ]
    stock_cover_candidates = [
        column for column in frame.columns
        if "day" in column.lower()
        and any(token in column.lower() for token in ("stock", "cover", "left"))
    ]
    inventory_candidates = [
        column for column in frame.columns
        if any(token in column.lower() for token in ("stock", "inventory"))
        and column not in stock_cover_candidates
    ]
    consumption_candidates = [
        column for column in frame.columns
        if any(token in column.lower() for token in ("consumption", "daily use", "burn"))
    ]
    stock_cover_issue = (
        dataset_type == "power_stocks"
        and not stock_cover_candidates
        and not (inventory_candidates and consumption_candidates)
    )
    metadata = {
        "id": csv_path.stem,
        "dataset_type": dataset_type,
        "dataset_label": COAL_DATASET_TYPES[dataset_type],
        "original_name": original_name.name,
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "date_candidates": date_candidates,
        "numeric_candidates": numeric_candidates,
        "stock_cover_candidates": stock_cover_candidates,
        "inventory_candidates": inventory_candidates,
        "consumption_candidates": consumption_candidates,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
        "quality_status": (
            "review_needed"
            if not date_candidates or not numeric_candidates or stock_cover_issue
            else "profiled"
        ),
        "quality_issues": [
            issue
            for condition, issue in (
                (not date_candidates, "No obvious date or period column was detected."),
                (not numeric_candidates, "No mostly numeric measure column was detected."),
                (
                    stock_cover_issue,
                    "Stock-cover data needs a reported days-left field or both "
                    "inventory tonnes and aligned daily consumption.",
                ),
            )
            if condition
        ],
        "csv_file": csv_path.name,
    }
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


@app.get("/api/coal/export")
async def export_coal_data(dataset_type: Optional[str] = None):
    datasets = _coal_dataset_metadata()
    if dataset_type:
        datasets = [
            item for item in datasets
            if item.get("dataset_type") == dataset_type
        ]
    if not datasets:
        raise HTTPException(
            409,
            "No matching coal dataset has been uploaded; no workbook was generated.",
        )
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        used_sheets: set[str] = set()
        for index, metadata in enumerate(datasets):
            csv_path = COAL_UPLOAD_DIR / str(metadata.get("csv_file", ""))
            if not csv_path.exists():
                continue
            frame = pd.read_csv(csv_path)
            base = str(metadata.get("dataset_type") or f"data_{index + 1}")[:27]
            sheet = base
            suffix = 2
            while sheet in used_sheets:
                sheet = f"{base[:27]}_{suffix}"
                suffix += 1
            used_sheets.add(sheet)
            frame.to_excel(writer, index=False, sheet_name=sheet)
        methodology = pd.DataFrame(
            [
                {
                    "note": (
                        "Raw uploaded data only. No inferred or synthetic values. "
                        "Correlation analysis must align compatible periods and "
                        "does not establish causation."
                    )
                }
            ]
        )
        methodology.to_excel(writer, index=False, sheet_name="Methodology")
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                'attachment; filename="india_coal_workspace_export.xlsx"'
            )
        },
    )

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
        from_port = (
            ports.by_id.get(str(req.from_port_id))
            if req.from_port_id is not None else None
        )
        to_port = (
            ports.by_id.get(str(req.to_port_id))
            if req.to_port_id is not None else None
        )
        from_lon = float(from_port["lon"] if from_port else req.from_lon)
        from_lat = float(from_port["lat"] if from_port else req.from_lat)
        to_lon = float(to_port["lon"] if to_port else req.to_lon)
        to_lat = float(to_port["lat"] if to_port else req.to_lat)
        if not (-180 <= from_lon <= 180 and -90 <= from_lat <= 90):
            raise ValueError("Origin coordinates are outside valid longitude/latitude bounds")
        if not (-180 <= to_lon <= 180 and -90 <= to_lat <= 90):
            raise ValueError("Destination coordinates are outside valid longitude/latitude bounds")
        if _haversine_nm([from_lon, from_lat], [to_lon, to_lat]) < 0.05:
            raise ValueError("Origin and destination must be different ports")

        speed = min(40.0, max(1.0, float(req.speed_knots or 12.0)))
        sea_margin_pct = min(50.0, max(0.0, float(req.sea_margin_pct or 0.0)))
        port_time_hours = min(720.0, max(0.0, float(req.port_time_hours or 0.0)))
        canal_delay_hours = min(240.0, max(0.0, float(req.canal_delay_hours or 0.0)))
        avoid = [
            str(value).lower()
            for value in (req.avoid or [])
            if str(value).lower() in ALLOWED_ROUTE_RESTRICTIONS
        ]
        if "northwest" not in avoid:
            avoid.append("northwest")
        from_approach = _port_approach(str(req.from_port_id)) if from_port else None
        to_approach = _port_approach(str(req.to_port_id)) if to_port else None
        route_from_lon = float(
            from_approach["longitude"] if from_approach else from_lon
        )
        route_from_lat = float(
            from_approach["latitude"] if from_approach else from_lat
        )
        route_to_lon = float(to_approach["longitude"] if to_approach else to_lon)
        route_to_lat = float(to_approach["latitude"] if to_approach else to_lat)
        primary = _compute_curated_corridor(
            req.from_port_id, req.to_port_id, speed, avoid
        ) or _compute_route(
            route_from_lon, route_from_lat, route_to_lon, route_to_lat, speed, avoid
        )
        calm_sea_hours = primary["distance_nm"] / speed
        sea_margin_hours = calm_sea_hours * sea_margin_pct / 100.0
        sailing_hours = calm_sea_hours + sea_margin_hours
        total_hours = sailing_hours + port_time_hours + canal_delay_hours
        primary.update({
            "calm_sea_hours": round(calm_sea_hours, 2),
            "sea_margin_pct": round(sea_margin_pct, 1),
            "sea_margin_hours": round(sea_margin_hours, 2),
            "sailing_hours": round(sailing_hours, 2),
            "port_time_hours": round(port_time_hours, 2),
            "canal_delay_hours": round(canal_delay_hours, 2),
            "total_duration_hours": round(total_hours, 2),
            "total_duration_days": round(total_hours / 24.0, 2),
            "effective_speed_knots": round(
                primary["distance_nm"] / sailing_hours if sailing_hours else speed,
                2,
            ),
        })
        alt = None
        via_suez = "suez" in primary.get("passage_ids", [])
        if via_suez and "suez" not in avoid:
            try:
                alt = _compute_route(
                    route_from_lon,
                    route_from_lat,
                    route_to_lon,
                    route_to_lat,
                    speed,
                    avoid + ["suez"],
                )
            except Exception:
                alt = None

        zone_coordinates = [
            [((float(lon) + 180.0) % 360.0) - 180.0, float(lat)]
            for lon, lat in (primary.get("coordinates") or [])
        ]
        zone_info = analyze_route_zones(zone_coordinates)
        coords = primary.get("coordinates") or []
        mid = coords[len(coords) // 2] if coords else [from_lon, from_lat]
        bunker, origin_weather, midpoint_weather, destination_weather = (
            await asyncio.gather(
                fetch_bunker_prices(),
                fetch_weather(route_from_lat, route_from_lon),
                fetch_weather(mid[1], mid[0]),
                fetch_weather(route_to_lat, route_to_lon),
            )
        )
        fuel = estimate_fuel_cost(
            primary["distance_nm"], primary["effective_speed_knots"],
            req.consumption_tpd or 25.0,
            zone_info.get("eca_fraction") or 0.0,
            bunker,
        )

        # Weather at origin, midpoint sample, destination
        weather = {
            "origin": origin_weather,
            "midpoint": midpoint_weather,
            "destination": destination_weather,
        }

        from_name = (from_port or {}).get("name") or req.from_name
        to_name = (to_port or {}).get("name") or req.to_name
        if primary.get("routing_profile") == "verified-approach-dense-corridor":
            warnings = [
                "Official sea-side approach references with an analytical densified open-sea corridor; not for navigation."
            ]
        else:
            warnings = [
                "Analytical shortest-path estimate on the searoute maritime network; not for navigation."
            ]
        if primary["route_confidence"] == "low":
            warnings.append(
                "A selected port is more than 20 nm from the nearest network node; review the connector leg."
            )
        result = {
            **primary,
            "from_name": from_name,
            "to_name": to_name,
            "from_port_id": str(req.from_port_id) if from_port else None,
            "to_port_id": str(req.to_port_id) if to_port else None,
            "coordinate_source": (
                "Verified sea-side port approaches"
                if from_approach and to_approach
                else "World Port Index catalogue"
                if from_port and to_port
                else "submitted map coordinates"
            ),
            "method": (
                "HRP verified-approach dense corridor"
                if primary.get("routing_profile")
                == "verified-approach-dense-corridor"
                else "searoute 1.6 maritime network + endpoint connector legs"
            ),
            "warnings": warnings,
            "zones": zone_info,
            "fuel": fuel,
            "weather": weather,
        }
        if alt and alt["distance_nm"] > primary["distance_nm"]:
            alt_calm_hours = alt["distance_nm"] / speed
            alt_total_hours = (
                alt_calm_hours * (1 + sea_margin_pct / 100.0)
                + port_time_hours
                + canal_delay_hours
            )
            result["alternate_cape_nm"] = alt["distance_nm"]
            result["alternate_cape_days"] = round(alt_total_hours / 24.0, 2)
            result["alternate_cape_via"] = alt.get("via")
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
