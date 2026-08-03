"""Create compact, map-ready layers from the user's GEM workbook bundle.

This script intentionally extracts only fields required for the interactive map.
The original workbooks remain the source of truth for future full-detail models.
"""

from __future__ import annotations

import argparse
import io
import zipfile
from pathlib import Path

import pandas as pd


def clean(value):
    if pd.isna(value):
        return None
    text = str(value).strip()
    return None if not text or text.lower() in {"nan", "unknown", "-"} else text


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coordinates(value):
    text = clean(value)
    if not text or "," not in text:
        return None, None
    left, right = text.split(",", 1)
    return number(left), number(right)


def normalize(
    frame: pd.DataFrame,
    *,
    layer: str,
    name_col: str,
    country_col: str,
    status_col: str | None = None,
    capacity_col: str | None = None,
    capacity_unit: str | None = None,
    lat_col: str | None = None,
    lon_col: str | None = None,
    coordinates_col: str | None = None,
    id_col: str | None = None,
    asset_type_col: str | None = None,
    parent_port_col: str | None = None,
    product_type_col: str | None = None,
    source_text_col: str | None = None,
) -> pd.DataFrame:
    rows = []
    for index, row in frame.iterrows():
        if coordinates_col:
            lat, lon = coordinates(row.get(coordinates_col))
        else:
            lat, lon = number(row.get(lat_col)), number(row.get(lon_col))
        name = clean(row.get(name_col))
        if not name or lat is None or lon is None:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        rows.append(
            {
                "asset_id": clean(row.get(id_col)) if id_col else f"{layer}-{index + 1}",
                "name": name,
                "unit": None,
                "status": clean(row.get(status_col)) if status_col else None,
                "capacity": number(row.get(capacity_col)) if capacity_col else None,
                "capacity_unit": capacity_unit,
                "lat": lat,
                "lon": lon,
                "country": clean(row.get(country_col)),
                "layer": layer,
                "asset_type": clean(row.get(asset_type_col)) if asset_type_col else None,
                "parent_port": clean(row.get(parent_port_col)) if parent_port_col else None,
                "product_type": clean(row.get(product_type_col)) if product_type_col else None,
                "source_text": clean(row.get(source_text_col)) if source_text_col else None,
            }
        )
    return pd.DataFrame(rows)


SPECS = {
    "coal_mines": {
        "workbook": "Global Coal Mine Tracker, May 2026__.xlsx",
        "sheet": "Non-closed mines",
        "kwargs": {
            "name_col": "Mine Name",
            "country_col": "Country / Area",
            "status_col": "Status",
            "capacity_col": "Capacity (Mtpa)",
            "capacity_unit": "Mtpa",
            "lat_col": "Latitude",
            "lon_col": "Longitude",
            "id_col": "GEM Mine ID",
        },
    },
    "iron_ore_mines": {
        "workbook": "Global-Iron-Ore-Mines-Tracker-August-2025-V1.xlsx",
        "sheet": "Main Data",
        "kwargs": {
            "name_col": "Asset name (English)",
            "country_col": "Country/Area",
            "status_col": "Operating status",
            "capacity_col": "Design capacity (ttpa)",
            "capacity_unit": "ktpa",
            "coordinates_col": "Coordinates",
            "id_col": "GEM Asset ID",
        },
    },
    "steel_plants": {
        "workbook": "Plant-level_data_Global_Iron_and_Steel_Tracker_June_2026_V1.xlsx",
        "sheet": "Plant data",
        "kwargs": {
            "name_col": "Plant name (English)",
            "country_col": "Country/area",
            "coordinates_col": "Coordinates",
            "id_col": "GEM plant ID",
        },
    },
    "cement_plants": {
        "workbook": "Global-Cement-and-Concrete-Tracker_July-2025.xlsx",
        "sheet": "Plant Data",
        "kwargs": {
            "name_col": "GEM Asset name (English)",
            "country_col": "Country/Area",
            "status_col": "Operating status",
            "capacity_col": "Cement Capacity (millions metric tonnes per annum)",
            "capacity_unit": "Mtpa",
            "coordinates_col": "Coordinates",
            "id_col": "GEM Asset ID",
        },
    },
    "geothermal": {
        "workbook": "Geothermal-Power-Tracker-March-2026-Final.xlsx",
        "sheet": "Data",
        "kwargs": {
            "name_col": "Project Name",
            "country_col": "Country/Area",
            "status_col": "Status",
            "capacity_col": "Unit Capacity (MW)",
            "capacity_unit": "MW",
            "lat_col": "Latitude",
            "lon_col": "Longitude",
            "id_col": "GEM unit ID",
        },
    },
    "bioenergy": {
        "workbook": "Global-Bioenergy-Power-Tracker-GBPT-V3.xlsx",
        "sheet": "Data",
        "kwargs": {
            "name_col": "Project Name",
            "country_col": "Country/Area",
            "status_col": "Status",
            "capacity_col": "Capacity (MW)",
            "capacity_unit": "MW",
            "lat_col": "Latitude",
            "lon_col": "Longitude",
            "id_col": "GEM unit ID",
        },
    },
    "coal_trade_terminals": {
        "workbook": "Global-Coal-Terminals-Tracker-December-2024.xlsx",
        "sheet": "Terminals",
        "kwargs": {
            "name_col": "Coal Terminal Name",
            "country_col": "Country/Area",
            "status_col": "Status",
            "capacity_col": "Capacity (Mt)",
            "capacity_unit": "Mtpa",
            "lat_col": "Latitude",
            "lon_col": "Longitude",
            "id_col": "GEM Terminal ID",
            "asset_type_col": "Terminal Type",
            "parent_port_col": "Parent Port Name",
            "product_type_col": "Product Type",
            "source_text_col": "Coal Source",
        },
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(args.bundle) as archive:
        for layer, spec in SPECS.items():
            raw = archive.read(spec["workbook"])
            frame = pd.read_excel(io.BytesIO(raw), sheet_name=spec["sheet"])
            if layer == "steel_plants":
                status_frame = pd.read_excel(
                    io.BytesIO(raw), sheet_name="Plant capacities and status"
                )
                priority = {
                    "operating": 0,
                    "operating pre-retirement": 1,
                    "construction": 2,
                    "announced": 3,
                    "mothballed": 4,
                    "mothballed pre-retirement": 5,
                    "retired": 6,
                    "cancelled": 7,
                }

                def plant_status(values):
                    cleaned = [clean(value) for value in values]
                    cleaned = [value for value in cleaned if value]
                    return min(
                        cleaned,
                        key=lambda value: priority.get(value.lower(), 99),
                        default=None,
                    )

                statuses = (
                    status_frame.groupby("GEM plant ID")["Status"]
                    .agg(plant_status)
                    .rename("Plant status")
                )
                frame = frame.merge(
                    statuses, left_on="GEM plant ID", right_index=True, how="left"
                )
                spec["kwargs"]["status_col"] = "Plant status"
            normalized = normalize(frame, layer=layer, **spec["kwargs"])
            output = args.output / f"{layer}.csv.gz"
            normalized.to_csv(output, index=False, compression="gzip")
            print(f"{layer}: {len(normalized):,} map-ready rows -> {output}")


if __name__ == "__main__":
    main()
