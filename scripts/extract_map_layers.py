"""Create compact, detail-card-ready layers from the user's GEM bundle."""

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
    source_text_value: str | None = None,
    source_date_value: str | None = None,
    extra_columns: dict[str, str] | None = None,
    numeric_extra_columns: set[str] | None = None,
) -> pd.DataFrame:
    rows = []
    extra_columns = extra_columns or {}
    numeric_extra_columns = numeric_extra_columns or set()
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
        record = {
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
                "source_text": (
                    clean(row.get(source_text_col))
                    if source_text_col
                    else source_text_value
                ),
                "source_date": source_date_value,
            }
        for output_name, input_name in extra_columns.items():
            value = row.get(input_name)
            record[output_name] = (
                number(value)
                if output_name in numeric_extra_columns
                else clean(value)
            )
        rows.append(record)
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
            "source_text_value": "Global Energy Monitor Global Iron Ore Mines Tracker",
            "source_date_value": "August 2025",
            "extra_columns": {
                "coordinate_accuracy": "Coordinate accuracy",
                "municipality": "Municipality",
                "subnational_unit": "Subnational unit",
                "region": "Region",
                "production_2024_ktpa": "Production 2024 (ttpa)",
                "production_2023_ktpa": "Production 2023 (ttpa)",
                "production_2022_ktpa": "Production 2022 (ttpa)",
                "reserves_kt": "Total reserves (proven and probable, thousand metric tonnes)",
                "resources_kt": "Total resource (inferred, indicated and measured, thousand metric tonnes)",
                "start_date": "Start date",
                "stop_date": "Stop date",
                "owner": "Owner",
                "parent_company": "Parent",
                "source_url": "GEM wiki page URL",
            },
            "numeric_extra_columns": {
                "production_2024_ktpa",
                "production_2023_ktpa",
                "production_2022_ktpa",
                "reserves_kt",
                "resources_kt",
            },
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
            "capacity_col": "Plant steel capacity (ttpa)",
            "capacity_unit": "ktpa",
            "asset_type_col": "Category steel product",
            "product_type_col": "Steel products",
            "source_text_value": "Global Energy Monitor Global Iron and Steel Plant Tracker",
            "source_date_value": "June 2026",
            "extra_columns": {
                "coordinate_accuracy": "Coordinate accuracy",
                "municipality": "Municipality",
                "subnational_unit": "Subnational unit",
                "region": "Region",
                "owner": "Owner",
                "parent_company": "Parent (English)",
                "location_address": "Location address",
                "plant_age": "Plant age",
                "start_date": "Start date",
                "pellet_capacity_ktpa": "Pelletizing plant capacity (ttpa)",
                "coking_capacity_ktpa": "Coking plant capacity (ttpa)",
                "steel_end_users": "Steel sector end users",
                "workforce_size": "Workforce size",
                "main_equipment": "Main production equipment",
                "power_source": "Power source",
                "iron_ore_source": "Iron ore source",
                "met_coal_source": "Met coal source",
                "iron_capacity_ktpa": "Plant iron capacity (ttpa)",
                "bf_capacity_ktpa": "Plant BF capacity (ttpa)",
                "dri_capacity_ktpa": "Plant DRI capacity (ttpa)",
                "source_url": "GEM wiki page",
            },
            "numeric_extra_columns": {
                "pellet_capacity_ktpa",
                "coking_capacity_ktpa",
                "iron_capacity_ktpa",
                "bf_capacity_ktpa",
                "dri_capacity_ktpa",
            },
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
    parser.add_argument(
        "--layers",
        help="Optional comma-separated subset of layer IDs to rebuild",
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    selected_layers = {
        value.strip() for value in str(args.layers or "").split(",")
        if value.strip()
    }

    with zipfile.ZipFile(args.bundle) as archive:
        for layer, spec in SPECS.items():
            if selected_layers and layer not in selected_layers:
                continue
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
                capacity_columns = {
                    "Plant steel capacity (ttpa)": "Nominal crude steel capacity (ttpa)",
                    "Plant iron capacity (ttpa)": "Nominal iron capacity (ttpa)",
                    "Plant BF capacity (ttpa)": "Nominal BF capacity (ttpa)",
                    "Plant DRI capacity (ttpa)": "Nominal DRI capacity (ttpa)",
                }
                capacity_source_columns = list(capacity_columns.values())
                status_frame[capacity_source_columns] = status_frame[
                    capacity_source_columns
                ].apply(pd.to_numeric, errors="coerce")
                capacities = status_frame.groupby("GEM plant ID")[
                    capacity_source_columns
                ].sum(min_count=1).rename(columns={
                    source: target for target, source in capacity_columns.items()
                })
                frame = frame.merge(
                    statuses, left_on="GEM plant ID", right_index=True, how="left"
                )
                frame = frame.merge(
                    capacities, left_on="GEM plant ID", right_index=True, how="left"
                )
                spec["kwargs"]["status_col"] = "Plant status"
            normalized = normalize(frame, layer=layer, **spec["kwargs"])
            output = args.output / f"{layer}.csv.gz"
            normalized.to_csv(output, index=False, compression="gzip")
            print(f"{layer}: {len(normalized):,} map-ready rows -> {output}")


if __name__ == "__main__":
    main()
