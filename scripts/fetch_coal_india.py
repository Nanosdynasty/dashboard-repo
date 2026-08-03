"""Fetch official India coal datasets into a UI-ready local master store.

The script is intentionally conservative:
- official/public-sector source URLs only
- no PDF files are kept in the repository
- every extracted row keeps source/provenance fields
- the output shape follows INDIA_COAL_OFFICIAL_DATA_ACQUISITION_PROMPT.md
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import httpx
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = BASE_DIR / "data" / "india_coal_master"
NORM_DIR = OUT_DIR / "normalized"
UI_DIR = OUT_DIR / "ui"
LOG_DIR = OUT_DIR / "logs"

SOURCE_PAGES = {
    "coal_statistics": "https://www.coal.gov.in/major-statistics/coal-statistics",
    "monthly_statistics": "https://coal.gov.in/public-information/monthly-statistics-at-glance",
    "coal_directory_archive": "https://www.coalcontroller.gov.in/index.php/coal-directory-india",
    "production_and_supplies": "https://coal.gov.in/index.php/major-statistics/production-and-supplies",
    "cea_fuel_management": "https://cea.nic.in/fuel-management-division/?lang=en",
    "npp_reports": "https://npp.gov.in/publishedReports",
}

DATASET_HINTS = (
    ("production", ("production", "raw coal", "lignite", "coal directory")),
    ("imports", ("import", "coking coal", "non-coking", "export")),
    ("power_use", ("despatch", "dispatch", "sector", "power", "supply")),
    ("power_stocks", ("stock", "fuel", "thermal")),
    ("port_coal_traffic", ("port", "traffic", "cargo")),
    ("coal_supply_chain", ("linkage", "auction", "rail", "washery")),
)

COAL_DIRECTORY_CHAPTERS = {
    "cdchap1": ("Coal Directory chapter 1: Indian coal economy overview", "production"),
    "cdchap2": ("Coal Directory chapter 2: Coal and lignite resources", "production"),
    "cdchap3": ("Coal Directory chapter 3: Production, productivity and overburden", "production"),
    "cdchap4": ("Coal Directory chapter 4: Dispatch and off-take", "power_use"),
    "cdchap5": ("Coal Directory chapter 5: Pit-head closing stock", "power_stocks"),
    "cdchap6": ("Coal Directory chapter 6: Coal washeries", "coal_supply_chain"),
    "cdchap7": ("Coal Directory chapter 7: Import and export", "imports"),
    "cdchap8": ("Coal Directory chapter 8: Coal prices and royalties", "coal_prices"),
    "cdchap9": ("Coal Directory chapter 9: Employment and safety", "source_reference"),
    "cdchap10": ("Coal Directory chapter 10: Captive coal blocks", "coal_supply_chain"),
    "cdchap11": ("Coal Directory chapter 11: Coal logistics and infrastructure", "coal_supply_chain"),
}


@dataclass
class SourceFile:
    source_id: str
    source_page_id: str
    title: str
    url: str
    file_type: str
    dataset_type: str
    retrieved_at: str | None = None
    content_sha256: str | None = None
    extraction_status: str = "queued"
    note: str | None = None


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str, fallback: str = "item") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or fallback


def classify_dataset_type(text: str) -> str:
    lowered = text.lower()
    for token, (_title, dataset_type) in COAL_DIRECTORY_CHAPTERS.items():
        if token in lowered:
            return dataset_type
    for dataset_type, tokens in DATASET_HINTS:
        if any(token in lowered for token in tokens):
            return dataset_type
    return "source_reference"


def friendly_title(label: str, url: str) -> str:
    lowered_url = url.lower()
    for token, (title, _dataset_type) in COAL_DIRECTORY_CHAPTERS.items():
        if token in lowered_url:
            return title
    clean_label = re.sub(r"\s+", " ", label).strip()
    if clean_label.lower() in {"download", "downloads", "download excel", "pdf", "excel"}:
        return Path(url.split("?", 1)[0]).name
    return clean_label or Path(url.split("?", 1)[0]).name


def html_links(html: str, base_url: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    pattern = re.compile(
        r"<a\b[^>]*href=[\"'](?P<href>[^\"']+)[\"'][^>]*>(?P<label>.*?)</a>",
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(html):
        href = match.group("href").strip()
        label = re.sub(r"<[^>]+>", " ", match.group("label"))
        label = re.sub(r"\s+", " ", label).strip()
        if not href:
            continue
        links.append((label or href, urljoin(base_url, href)))
    return links


def discover_sources(client: httpx.Client) -> list[SourceFile]:
    discovered: list[SourceFile] = []
    seen: set[str] = set()
    for page_id, page_url in SOURCE_PAGES.items():
        response = client.get(page_url)
        response.raise_for_status()
        for label, url in html_links(response.text, page_url):
            clean_url = url.split("#", 1)[0]
            lowered = clean_url.lower()
            if not lowered.endswith((".xlsx", ".xls", ".csv", ".pdf")):
                continue
            if clean_url in seen:
                continue
            seen.add(clean_url)
            file_type = lowered.rsplit(".", 1)[-1]
            title = friendly_title(label, clean_url)
            discovered.append(
                SourceFile(
                    source_id=slugify(f"{page_id}-{title}-{len(discovered)+1}"),
                    source_page_id=page_id,
                    title=title,
                    url=clean_url,
                    file_type=file_type,
                    dataset_type=classify_dataset_type(f"{page_id} {title} {clean_url}"),
                )
            )
    return discovered


def dataframe_to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    clean = frame.copy()
    clean = clean.dropna(axis=0, how="all").dropna(axis=1, how="all")
    clean.columns = [re.sub(r"\s+", " ", str(column)).strip() for column in clean.columns]
    records: list[dict[str, Any]] = []
    for row in clean.to_dict(orient="records"):
        item: dict[str, Any] = {}
        for key, value in row.items():
            if pd.isna(value):
                item[key] = None
            elif hasattr(value, "isoformat"):
                item[key] = value.isoformat()
            else:
                item[key] = value
        records.append(item)
    return records


def write_csv(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    rows = list(rows)
    if not rows:
        path.write_text("", encoding="utf-8")
        return 0
    fieldnames = sorted({key for row in rows for key in row})
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def extract_spreadsheet(
    client: httpx.Client,
    source: SourceFile,
    max_sheets: int | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    response = client.get(source.url)
    response.raise_for_status()
    content = response.content
    source.retrieved_at = utc_now()
    source.content_sha256 = hashlib.sha256(content).hexdigest()

    sheet_rows: list[dict[str, Any]] = []
    catalog_rows: list[dict[str, Any]] = []
    excel = pd.ExcelFile(io.BytesIO(content))
    sheet_names = excel.sheet_names[:max_sheets] if max_sheets else excel.sheet_names
    for sheet_name in sheet_names:
        frame = excel.parse(sheet_name=sheet_name, header=None)
        records = dataframe_to_records(frame)
        normalized_rows = []
        for row_number, row in enumerate(records, start=1):
            normalized_rows.append(
                {
                    "source_id": source.source_id,
                    "source_title": source.title,
                    "source_url": source.url,
                    "source_page_id": source.source_page_id,
                    "dataset_type": source.dataset_type,
                    "sheet_name": sheet_name,
                    "row_number": row_number,
                    "row_json": json.dumps(row, ensure_ascii=False, default=str),
                }
            )
        csv_name = f"{source.source_id}__{slugify(sheet_name, 'sheet')}.csv"
        row_count = write_csv(NORM_DIR / csv_name, normalized_rows)
        sheet_rows.extend(normalized_rows)
        catalog_rows.append(
            {
                "source_id": source.source_id,
                "source_title": source.title,
                "sheet_name": sheet_name,
                "csv_file": f"normalized/{csv_name}",
                "rows": row_count,
                "dataset_type": source.dataset_type,
            }
        )
    source.extraction_status = "extracted"
    return sheet_rows, catalog_rows


def build_ui_views(master: dict[str, Any], source_catalog: list[dict[str, Any]]) -> dict[str, str]:
    datasets = sorted(
        {
            item["dataset_type"]
            for item in source_catalog
            if item.get("dataset_type") and item.get("dataset_type") != "source_reference"
        }
    )
    facets = {
        "country": ["India"],
        "dataset_type": datasets,
        "frequency": ["monthly", "quarterly", "yearly"],
        "coal_type": ["all", "thermal", "coking", "lignite"],
        "period": ["12m", "3y", "5y", "10y", "all"],
        "release_status": ["provisional", "revised", "final", "unknown"],
    }
    source_notes = [
        {
            "source_id": item["source_id"],
            "title": item["source_title"],
            "dataset_type": item["dataset_type"],
            "sheet_name": item["sheet_name"],
            "rows": item["rows"],
            "source_url": next(
                (
                    source["url"]
                    for source in master["sources"]
                    if source["source_id"] == item["source_id"]
                ),
                None,
            ),
        }
        for item in source_catalog
    ]
    empty_cards = {
        "generated_at": master["generated_at"],
        "cards": [],
        "note": "Display-ready KPI cards will be populated after source tables are mapped to canonical measures.",
    }
    empty_charts = {
        "generated_at": master["generated_at"],
        "charts": [],
        "note": "Charts require mapped period, metric, and unit fields from the official source tables.",
    }
    empty_assets = {
        "generated_at": master["generated_at"],
        "assets": [],
        "note": "Asset cards use the existing GEM/CEA/port-spec layers until official coal use/linkage records are mapped.",
    }
    outputs = {
        "coal_workspace_facets.json": facets,
        "coal_workspace_kpis.json": empty_cards,
        "coal_workspace_charts.json": empty_charts,
        "coal_asset_cards.json": empty_assets,
        "coal_source_notes.json": {"generated_at": master["generated_at"], "sources": source_notes},
    }
    for filename, payload in outputs.items():
        (UI_DIR / filename).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return {key.removesuffix(".json"): f"ui/{key}" for key in outputs}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-files", type=int, default=8)
    parser.add_argument("--max-sheets", type=int, default=None)
    parser.add_argument("--timeout", type=float, default=45.0)
    args = parser.parse_args()

    for directory in (OUT_DIR, NORM_DIR, UI_DIR, LOG_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    events: list[dict[str, Any]] = []
    source_catalog: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []
    with httpx.Client(
        timeout=args.timeout,
        follow_redirects=True,
        headers={"User-Agent": "HRP-Dashboard-Coal-Data-Harvester/1.0"},
    ) as client:
        sources = discover_sources(client)
        spreadsheet_sources = [
            source for source in sources if source.file_type in {"xlsx", "xls", "csv"}
        ][: args.max_files]
        for source in spreadsheet_sources:
            try:
                if source.file_type == "csv":
                    response = client.get(source.url)
                    response.raise_for_status()
                    source.retrieved_at = utc_now()
                    source.content_sha256 = hashlib.sha256(response.content).hexdigest()
                    frame = pd.read_csv(io.BytesIO(response.content))
                    rows = dataframe_to_records(frame)
                    normalized = [
                        {
                            "source_id": source.source_id,
                            "source_title": source.title,
                            "source_url": source.url,
                            "source_page_id": source.source_page_id,
                            "dataset_type": source.dataset_type,
                            "sheet_name": "csv",
                            "row_number": index,
                            "row_json": json.dumps(row, ensure_ascii=False, default=str),
                        }
                        for index, row in enumerate(rows, start=1)
                    ]
                    csv_name = f"{source.source_id}.csv"
                    row_count = write_csv(NORM_DIR / csv_name, normalized)
                    all_rows.extend(normalized)
                    source_catalog.append(
                        {
                            "source_id": source.source_id,
                            "source_title": source.title,
                            "sheet_name": "csv",
                            "csv_file": f"normalized/{csv_name}",
                            "rows": row_count,
                            "dataset_type": source.dataset_type,
                        }
                    )
                    source.extraction_status = "extracted"
                else:
                    rows, catalog = extract_spreadsheet(client, source, args.max_sheets)
                    all_rows.extend(rows)
                    source_catalog.extend(catalog)
            except Exception as exc:  # noqa: BLE001 - captured in provenance log.
                source.extraction_status = "failed"
                source.note = str(exc)
                events.append(
                    {
                        "level": "warning",
                        "source_id": source.source_id,
                        "message": f"Extraction failed: {exc}",
                    }
                )

    master = {
        "dataset": "India coal official master",
        "generated_at": utc_now(),
        "coverage": {
            "country": "India",
            "years_requested": "FY2016-17 to latest official",
            "current_extract_mode": "official Excel/CSV first pass; PDF links catalogued, not stored",
            "source_file_count": len(sources),
            "extracted_file_count": sum(
                1 for source in sources if source.extraction_status == "extracted"
            ),
            "normalized_row_count": len(all_rows),
        },
        "sources": [asdict(source) for source in sources],
        "source_tables": source_catalog,
        "records": all_rows,
        "quality": {
            "status": "source_catalogued" if source_catalog else "blocked",
            "notes": [
                "Raw PDF documents are not retained.",
                "Spreadsheet rows are preserved as row_json until mapped to canonical measures.",
                "Use source_url, sheet_name and row_number for audit back to official source.",
            ],
        },
        "ui_views": {},
        "logs": "logs/fetch_log.json",
    }
    master["ui_views"] = build_ui_views(master, source_catalog)
    (OUT_DIR / "india_coal_master.json").write_text(
        json.dumps(master, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    write_csv(NORM_DIR / "source_table_catalog.csv", source_catalog)
    (LOG_DIR / "fetch_log.json").write_text(
        json.dumps({"generated_at": master["generated_at"], "events": events}, indent=2),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(OUT_DIR),
                "sources": len(sources),
                "extracted_files": master["coverage"]["extracted_file_count"],
                "rows": len(all_rows),
                "events": len(events),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
