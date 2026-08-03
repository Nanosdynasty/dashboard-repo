"""Build chart-ready India coal series from the extracted official workbooks.

The source workbooks remain the source of truth. This mapper reads only the
normalized CSV rows produced by fetch_coal_india.py and writes compact JSON/CSV
files used by the Coal India workspace.
"""

from __future__ import annotations

import csv
import json
import math
import re
from pathlib import Path
from statistics import correlation


ROOT = Path(__file__).resolve().parents[1]
NORMALIZED = ROOT / "data" / "india_coal_master" / "normalized"
CANONICAL = ROOT / "data" / "india_coal_master" / "canonical"
UI = ROOT / "data" / "india_coal_master" / "ui"

PRODUCTION_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-3-production-productivity-and-"
    "overburden-4__dt28.csv"
)
IMPORT_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-7-import-and-export-8__tb8-1.csv"
)
MONTHLY_PRODUCTION_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-2-coal-and-lignite-resources-3__pt6.csv"
)
MONTHLY_IMPORT_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-7-import-and-export-8__tb8-7.csv"
)
IMPORT_ORIGIN_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-7-import-and-export-8__tb8-3.csv"
)
IMPORT_PORT_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-7-import-and-export-8__tb8-5.csv"
)
SECTOR_OFFTAKE_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-3-production-productivity-and-overburden-4__dt22.csv"
)
STEEL_COKING_FILE = NORMALIZED / (
    "coal-statistics-coal-directory-chapter-8-coal-prices-and-royalties-9__t8-2.csv"
)

PRODUCTION_SOURCE = (
    "Coal Directory 2024-25, Table 4.28: Availability and Off-take of Indian "
    "Raw Coal from Public & Private Sector during last Ten Years"
)
IMPORT_SOURCE = (
    "Coal Directory 2024-25, Table 8.1: Year Wise Import of Coal, Coke & "
    "Other Coal Products to India during last Ten Years"
)


def rows(path: Path) -> list[dict]:
    output = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            values = json.loads(row["row_json"])
            output.append({str(key): value for key, value in values.items()})
    return output


def number(value):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def yoy(current, prior):
    if current is None or prior in (None, 0):
        return None
    return (current / prior - 1) * 100


def valid_period(value: object) -> bool:
    text = str(value or "").strip()
    return len(text) == 7 and text[4] == "-" and text[:4].isdigit()


def write_csv(name: str, records: list[dict], columns: list[str]) -> None:
    path = CANONICAL / name
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows([{key: item.get(key) for key in columns} for item in records])


def build() -> dict:
    production_rows = {}
    for row in rows(PRODUCTION_FILE):
        period = str(row.get("0") or "").strip()
        if len(period) == 7 and period[4] == "-":
            production_rows[period] = {
                "production_mt": number(row.get("16")),
                "offtake_mt": number(row.get("20")),
                "closing_stock_mt": number(row.get("21")),
            }

    import_rows = {}
    for row in rows(IMPORT_FILE):
        period = str(row.get("0") or "").strip()
        if len(period) == 7 and period[4] == "-":
            import_rows[period] = {
                "coking_imports_mt": number(row.get("1")),
                "non_coking_imports_mt": number(row.get("4")),
                "total_imports_mt": number(row.get("7")),
            }

    periods = sorted(set(production_rows) | set(import_rows))
    annual = []
    previous = {}
    for period in periods:
        item = {
            "period": period,
            **production_rows.get(period, {}),
            **import_rows.get(period, {}),
        }
        item["production_yoy_pct"] = yoy(
            item.get("production_mt"), previous.get("production_mt")
        )
        item["imports_yoy_pct"] = yoy(
            item.get("total_imports_mt"), previous.get("total_imports_mt")
        )
        item["import_dependency_pct"] = (
            item["total_imports_mt"]
            / (item["production_mt"] + item["total_imports_mt"])
            * 100
            if item.get("production_mt") is not None
            and item.get("total_imports_mt") is not None
            and item["production_mt"] + item["total_imports_mt"] > 0
            else None
        )
        annual.append(item)
        previous = item

    aligned = [
        item
        for item in annual
        if item.get("production_mt") is not None
        and item.get("total_imports_mt") is not None
    ]
    production_values = [item["production_mt"] for item in aligned]
    import_values = [item["total_imports_mt"] for item in aligned]
    corr = (
        correlation(production_values, import_values)
        if len(aligned) >= 3
        and len(set(production_values)) > 1
        and len(set(import_values)) > 1
        else None
    )
    latest = aligned[-1] if aligned else {}
    earliest = aligned[0] if aligned else {}
    production_cagr = (
        ((latest["production_mt"] / earliest["production_mt"]) ** (1 / (len(aligned) - 1)) - 1)
        * 100
        if len(aligned) > 1 and earliest.get("production_mt")
        else None
    )
    import_cagr = (
        ((latest["total_imports_mt"] / earliest["total_imports_mt"]) ** (1 / (len(aligned) - 1)) - 1)
        * 100
        if len(aligned) > 1 and earliest.get("total_imports_mt")
        else None
    )

    # The official directory contains one complete month-level year.  Keep it
    # separate from the annual trend so an annual value is never presented as
    # a monthly/weekly answer.
    monthly_production = []
    for row in rows(MONTHLY_PRODUCTION_FILE):
        raw_period = str(row.get("0") or "").strip()
        if re_match := re.match(r"^(2024)-(\d{2})-01", raw_period):
            monthly_production.append({
                "period": f"{re_match.group(1)}-{re_match.group(2)}",
                "financial_year": "2024-25",
                "coking_coal_mt": number(row.get("1")),
                "non_coking_coal_mt": number(row.get("4")),
                "total_raw_coal_mt": number(row.get("7")),
                "lignite_mt": number(row.get("10")),
                "status": "final",
            })

    month_names = {
        name: index for index, name in enumerate(
            ["April", "May", "June", "July", "August", "September", "October",
             "November", "December", "January", "February", "March"], start=4
        )
    }
    monthly_imports = []
    for row in rows(MONTHLY_IMPORT_FILE):
        name = str(row.get("0") or "").strip()
        if name not in month_names or str(row.get("1") or "").strip() != "Quantity":
            continue
        month = month_names[name]
        year = 2024 if month <= 12 else 2025
        month = month if month <= 12 else month - 12
        monthly_imports.append({
            "period": f"{year:04d}-{month:02d}",
            "financial_year": "2024-25",
            "coking_coal_mt": number(row.get("2")),
            "non_coking_coal_mt": number(row.get("5")),
            "total_coal_mt": number(row.get("8")),
            "coke_products_mt": number(row.get("11")),
            "status": "final",
        })

    def import_dimension(path: Path, field: str) -> list[dict]:
        output = []
        for row in rows(path):
            label = str(row.get("0") or "").strip()
            total = number(row.get("7"))
            if not label or total is None or label.lower().startswith(("table", "total")):
                continue
            output.append({
                field: label,
                "period": "2024-25",
                "coking_coal_mt": number(row.get("1")) or 0,
                "non_coking_coal_mt": number(row.get("4")) or 0,
                "total_coal_mt": total,
                "coke_products_mt": number(row.get("10")) or 0,
                "status": "final",
            })
        return sorted(output, key=lambda item: item["total_coal_mt"], reverse=True)

    imports_by_origin = import_dimension(IMPORT_ORIGIN_FILE, "origin_country")
    imports_by_port = import_dimension(IMPORT_PORT_FILE, "import_port")

    sector_columns = {
        "power_utility_mt": "1", "power_captive_mt": "2",
        "steel_direct_mt": "3", "steel_coke_ovens_mt": "4",
        "steel_boilers_mt": "5", "cement_mt": "6", "fertiliser_mt": "7",
        "sponge_iron_mt": "8", "other_metals_mt": "9", "chemicals_mt": "10",
        "pulp_paper_mt": "11", "textiles_mt": "12", "bricks_mt": "13",
        "other_mt": "14", "total_offtake_mt": "18",
    }
    sector_offtake = []
    for row in rows(SECTOR_OFFTAKE_FILE):
        period = str(row.get("0") or "").strip()
        if valid_period(period):
            sector_offtake.append({
                "period": period,
                **{name: number(row.get(column)) for name, column in sector_columns.items()},
                "status": "final",
            })

    steel_coking = []
    current_plant = ""
    for row in rows(STEEL_COKING_FILE):
        plant = str(row.get("0") or "").strip()
        if plant:
            current_plant = plant
        period = str(row.get("1") or "").strip()
        if not current_plant or not valid_period(period):
            continue
        steel_coking.append({
            "steel_plant": current_plant,
            "period": period,
            "prime_coking_kt": number(row.get("2")),
            "medium_coking_kt": number(row.get("4")),
            "blendable_kt": number(row.get("6")),
            "imported_coking_kt": number(row.get("8")),
            "total_coking_kt": number(row.get("10")),
            "hot_metal_kt": number(row.get("12")),
            "status": "final",
        })

    analysis = {
        "status": "ready",
        "grain": "India financial year",
        "unit": "million tonnes",
        "annual": annual,
        "monthly_production": monthly_production,
        "monthly_imports": monthly_imports,
        "imports_by_origin": imports_by_origin,
        "imports_by_port": imports_by_port,
        "sector_offtake": sector_offtake,
        "steel_coking_consumption": steel_coking,
        "latest": latest,
        "analysis": {
            "aligned_periods": len(aligned),
            "production_import_correlation": corr,
            "production_cagr_pct": production_cagr,
            "imports_cagr_pct": import_cagr,
            "production_change_mt": (
                latest.get("production_mt", 0) - earliest.get("production_mt", 0)
                if aligned else None
            ),
            "imports_change_mt": (
                latest.get("total_imports_mt", 0) - earliest.get("total_imports_mt", 0)
                if aligned else None
            ),
        },
        "sources": [
            {
                "series": ["production_mt", "offtake_mt", "closing_stock_mt"],
                "title": PRODUCTION_SOURCE,
                "url": "https://coal.gov.in/sites/default/files/2024-03/cdchap3.xlsx",
            },
            {
                "series": [
                    "coking_imports_mt",
                    "non_coking_imports_mt",
                    "total_imports_mt",
                ],
                "title": IMPORT_SOURCE,
                "url": "https://coal.gov.in/sites/default/files/2024-03/cdchap7.xlsx",
            },
        ],
        "methodology": [
            "Production, off-take and closing stock use All India fields in Table 4.28.",
            "Imports use quantity fields in Table 8.1; monetary value fields are excluded.",
            "Correlation is Pearson correlation across matched financial years and is association, not causation.",
            "Stock is pit-head closing stock, not power-station stock-cover days.",
            "Monthly production and imports currently cover the complete official 2024-25 Coal Directory year.",
            "Country and port tables report customs origin/clearance location; they do not prove the mine origin or physical loading port.",
            "Provisional and tentative official observations are retained only when explicitly labelled by the source.",
        ],
    }

    CANONICAL.mkdir(parents=True, exist_ok=True)
    UI.mkdir(parents=True, exist_ok=True)
    csv_path = CANONICAL / "coal_india_annual.csv"
    columns = [
        "period",
        "production_mt",
        "total_imports_mt",
        "coking_imports_mt",
        "non_coking_imports_mt",
        "offtake_mt",
        "closing_stock_mt",
        "production_yoy_pct",
        "imports_yoy_pct",
        "import_dependency_pct",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows([{key: item.get(key) for key in columns} for item in annual])
    write_csv("coal_production_monthly.csv", monthly_production, [
        "period", "financial_year", "coking_coal_mt", "non_coking_coal_mt",
        "total_raw_coal_mt", "lignite_mt", "status",
    ])
    write_csv("coal_imports_monthly.csv", monthly_imports, [
        "period", "financial_year", "coking_coal_mt", "non_coking_coal_mt",
        "total_coal_mt", "coke_products_mt", "status",
    ])
    write_csv("coal_imports_by_origin.csv", imports_by_origin, [
        "origin_country", "period", "coking_coal_mt", "non_coking_coal_mt",
        "total_coal_mt", "coke_products_mt", "status",
    ])
    write_csv("coal_imports_by_port.csv", imports_by_port, [
        "import_port", "period", "coking_coal_mt", "non_coking_coal_mt",
        "total_coal_mt", "coke_products_mt", "status",
    ])
    write_csv("coal_offtake_by_sector.csv", sector_offtake, [
        "period", *sector_columns.keys(), "status",
    ])
    write_csv("steel_plant_coking_coal.csv", steel_coking, [
        "steel_plant", "period", "prime_coking_kt", "medium_coking_kt",
        "blendable_kt", "imported_coking_kt", "total_coking_kt", "hot_metal_kt", "status",
    ])
    (UI / "coal_analysis.json").write_text(
        json.dumps(analysis, indent=2), encoding="utf-8"
    )
    return analysis


if __name__ == "__main__":
    result = build()
    print(
        json.dumps(
            {
                "status": result["status"],
                "periods": len(result["annual"]),
                "latest": result["latest"].get("period"),
            }
        )
    )
