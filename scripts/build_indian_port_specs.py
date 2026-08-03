"""Build a consolidated, provenance-aware India coal-port specification dataset."""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_DIR))

from app import _coal_asset_rows  # noqa: E402


PORT_ALIASES = {
    "Bedi Port": "Bedi",
    "Cochin Port": "Cochin Port Authority",
    "Dahej Port": "Dahej",
    "Dhamra Port": "Dhamra",
    "Paradip Port": "Paradip Port Authority",
    "Gangavaram Port": "Gangavaram",
    "Haldia Port": "Syama Prasad Mookerjee Port, Kolkata",
    "Hazira Port (Essar)": "Hazira(Surat)- HPPL & AHPPL",
    "Jaigarh Port": "Jaigad",
    "JSW Dharamtar Port": "Dharamtar (Alibag)",
    "Kakinada Port": "Kakinada Anchorage Port / Kakinada Deepwater Port",
    "Kamarajar Port": "Kamarajar Port Limited",
    "Karaikal Port": "Karaikal",
    "Kattupalli Port": "Kattupalli",
    "Kolkata Dock System Coal Terminal": (
        "Syama Prasad Mookerjee Port, Kolkata"
    ),
    "Krishnapatnam Port": "Krishnapatnam Port",
    "Magadalla Port": "Magdalla",
    "Mormugao Port": "Mormugao Port Authority",
    "Muldwarka Port": "Mul-Dwarka",
    "Mundra Port": "Adani Ports & SEZ ltd.(GAPL)",
    "Navlakhi Port": "Navlakhi",
    "New Mangalore Port": "New Mangalore Port Authority",
    "Okha Port": "Okha",
    "Pipavav Port": "Pipavav (GPPL)",
    "Porbandar Port": "Porbandar",
    "Salaya Port": "Salaya",
    "Sikka Port": "Sikka",
    "Trombay Port": "Trombay",
    "Tuna Tekra Port": "Deendayal Port Authority",
    "Tuticorin Port": "V.O. Chidambaranar Port Authority",
    "Visakhapatnam Port": "Visakhapatnam Port Authority",
}

COMMODITY_PORT_ALIASES = {
    "Haldia Port": "SMP Haldia Dock Complex",
    "Kolkata Dock System Coal Terminal": "SMP Kolkata Dock System",
}

BERTH_SECTION_HEADERS = {
    "Deendayal Port Authority": "M01",
    "Mumbai Port Authority": "M02",
    "Jawahar Lal Nehru Port Authority": "M03",
    "Mormugao Port Authority": "M04",
    "New Mangalore Port Authority": "M05",
    "Cochin Port Authority": "M06",
    "V.O.Chidambaranar Port Authority": "M07",
    "Chennai Port Authority": "M08",
    "Kamarajar Port Limited": "M09",
    "Visakhapatnam Port Authority": "M10",
    "Paradip Port Authority": "M11",
    "A) Kolkata Dock System": "M12-KDS",
    "B)Haldia Dock Complex": "M12-HDC",
}

BERTH_SECTION_BY_ASSET = {
    "Mormugao Port": "M04",
    "New Mangalore Port": "M05",
    "Cochin Port": "M06",
    "Tuticorin Port": "M07",
    "Kamarajar Port": "M09",
    "Visakhapatnam Port": "M10",
    "Paradip Port": "M11",
    "Kolkata Dock System Coal Terminal": "M12-KDS",
    "Haldia Port": "M12-HDC",
}

NONMAJOR_TRAFFIC_ALIASES = {
    "Hazira Port (Essar)": [
        "AHPPL (Magdala Adani Hazira Port)",
        "HPPL Magdalla Hazira Port)",
    ],
    "Kakinada Port": [
        "Kakinada Anchorage Port",
        "Kakinada Deep Water Port",
    ],
    "Muldwarka Port": ["Mul-Dwarka (Veraval)"],
    "Pipavav Port": ["GPPL (Jafrabad Pipapav)"],
    "Salaya Port": ["Salaya (Bedi EBSTL)"],
    "Sikka Port": ["Sikka (Bedi Sikka)"],
    "Mundra Port": ["GAPL (Mandvi Mudra & SEZ)"],
}

APSEZ_CAPACITY_MTPA = {
    "Mundra Port": 264,
    "Dhamra Port": 50,
    "Hazira Port (Essar)": 30,
    "Gangavaram Port": 64,
    "Krishnapatnam Port": 75,
    "Kattupalli Port": 25,
    "Karaikal Port": 22,
    "Dahej Port": 16,
    "Tuna Tekra Port": 14,
    "Mormugao Port": 5,
}

APSEZ_CAPACITY_SOURCE = (
    "https://www.adaniports.com/-/media/Project/Ports/Investor/"
    "corporate-governance/Corporate-Announcement/other-intimation/"
    "Press-Release-30_AUG.pdf"
)

CURATED_SPECS: Dict[str, Dict[str, Any]] = {
    "Jaigarh Port": {
        "official_website": "https://www.jsw.in/jsw-infrastructure/",
        "max_draft_m": 17.5,
        "berth_count": 7,
        "port_capacity_mtpa": 55,
        "specification_note": (
            "JSW reports seven operational berths, 2,319 m total berth length, "
            "17.5 m draft and 55 MTPA installed capacity."
        ),
        "source_url": (
            "https://www.jsw.in/sites/default/files/assets/industry/"
            "infrastructure/Red-Herring-Prospectus_JSW-Infrastructure-Limited.pdf"
        ),
        "source_title": "JSW Infrastructure red herring prospectus",
        "source_as_of": "2023-06-30",
    },
    "JSW Dharamtar Port": {
        "official_website": "https://www.jsw.in/jsw-infrastructure/",
        "berth_count": 5,
        "port_capacity_mtpa": 34,
        "specification_note": (
            "JSW reports five berths and 34 MTPA capacity. No current maximum "
            "draft was published in the source used here."
        ),
        "source_url": "https://www.jsw.in/jsw-infrastructure/",
        "source_title": "JSW Infrastructure ports and terminals",
        "source_as_of": "2026-07-28",
    },
    "Kakinada Port": {
        "official_website": "https://kakinadaseaports.in/?page_id=169",
        "max_draft_m": 14,
        "berth_count": 8,
        "specification_note": (
            "Main jetty has seven cargo berths and one OSV berth; maximum "
            "permissible main-jetty draught is 14 m on high tide."
        ),
        "source_url": "https://kakinadaseaports.in/?page_id=169",
        "source_title": "Kakinada Seaports — Port Info",
        "source_as_of": "2026-07-24",
    },
    "Pipavav Port": {
        "official_website": (
            "https://www.apmterminals.com/en/pipavav/about/"
            "dedicated-freight-corridor"
        ),
        "specification_note": (
            "APM Terminals reports 735 m berth length. Maximum operating draft "
            "was not safely flattenable from the source used here."
        ),
        "source_url": (
            "https://www.apmterminals.com/en/pipavav/about/"
            "dedicated-freight-corridor"
        ),
        "source_title": "APM Terminals Pipavav",
        "source_as_of": "2026-07-28",
    },
    "Paradip Port": {
        "official_website": "https://paradipport.gov.in/berth-specifications/",
        "max_draft_m": 16,
        "specification_note": (
            "The current port-authority berth page supersedes the workbook "
            "snapshot for operating limits; always confirm the latest notice."
        ),
        "source_url": "https://paradipport.gov.in/berth-specifications/",
        "source_title": "Paradip Port Authority berth specifications",
        "source_as_of": "2026-02-23",
    },
    "Trombay Port": {
        "official_website": (
            "https://www.mumbaiport.gov.in/showfile.php"
            "?lang=1&level=1&lid=1028&ls_id=1287"
        ),
        "specification_note": (
            "Mumbai Port Authority publishes a Tata's Trombay facility page. "
            "No current maximum draft was safely flattenable from that page."
        ),
        "source_url": (
            "https://www.mumbaiport.gov.in/showfile.php"
            "?lang=1&level=1&lid=1028&ls_id=1287"
        ),
        "source_title": "Mumbai Port Authority — Tata's Trombay",
        "source_as_of": "2026-02-23",
    },
}

APSEZ_ASSETS = {
    "Dahej Port",
    "Dhamra Port",
    "Gangavaram Port",
    "Haldia Port",
    "Hazira Port (Essar)",
    "Karaikal Port",
    "Kattupalli Port",
    "Krishnapatnam Port",
    "Mormugao Port",
    "Mundra Port",
    "Tuna Tekra Port",
}

GMB_ASSETS = {
    "Bedi Port",
    "Dahej Port",
    "Magadalla Port",
    "Muldwarka Port",
    "Navlakhi Port",
    "Okha Port",
    "Porbandar Port",
    "Salaya Port",
    "Sikka Port",
}

DRY_BULK_TERMS = re.compile(
    r"coal|coke|iron|ore|bulk|fert|cement|food|grain|salt|limestone",
    re.I,
)


def records(matrix: List[List[Any]]) -> List[Dict[str, Any]]:
    header = matrix[0]
    return [
        dict(zip(header, row + [None] * max(0, len(header) - len(row))))
        for row in matrix[1:]
    ]


def normalize(value: Any) -> str:
    text = str(value or "").lower()
    text = re.sub(
        r"\b(port|authority|limited|ltd|coal|terminal|dock|system)\b",
        " ",
        text,
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def best_label_match(
    target: str,
    candidate_rows: Iterable[Dict[str, Any]],
    field: str,
) -> List[Dict[str, Any]]:
    rows = list(candidate_rows)
    exact = [row for row in rows if str(row.get(field)) == target]
    if exact:
        return exact
    labels = sorted({str(row.get(field) or "") for row in rows})
    if not labels:
        return []
    best = max(
        labels,
        key=lambda label: difflib.SequenceMatcher(
            None, normalize(target), normalize(label)
        ).ratio(),
    )
    score = difflib.SequenceMatcher(
        None, normalize(target), normalize(best)
    ).ratio()
    return [row for row in rows if str(row.get(field)) == best] if score >= 0.72 else []


def parse_berth_sections(
    infrastructure_rows: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    table_rows = [
        row for row in infrastructure_rows if row.get("Table_ID") == "Table 1.4"
    ]
    header_positions = []
    for index, row in enumerate(table_rows):
        text = str(row.get("Text_Line") or "").strip()
        if text in BERTH_SECTION_HEADERS:
            header_positions.append(
                (index, BERTH_SECTION_HEADERS[text], text)
            )
    sections: Dict[str, List[Dict[str, Any]]] = {}
    for position, (start, section_id, _header) in enumerate(header_positions):
        end = (
            header_positions[position + 1][0]
            if position + 1 < len(header_positions)
            else len(table_rows)
        )
        sections[section_id] = table_rows[start + 1 : end]
    return sections


def parse_berth_records(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    output = []
    excluded = re.compile(
        r"^(table|berths available|port/|type of berth|in mtrs|"
        r"percentage|note|contd|inner harbour|multipurpose berths|"
        r"captive berths|alongside berths|mooring dolphins|dolphin to dolphin)",
        re.I,
    )
    for row in rows:
        text = re.sub(r"\s+", " ", str(row.get("Text_Line") or "")).strip()
        if not text or excluded.search(text) or re.fullmatch(r"[\d.\s-]+", text):
            continue
        decimal_tokens = [
            float(value)
            for value in re.findall(r"\b(\d{1,2}\.\d{1,2})\b", text)
            if 4.5 <= float(value) <= 25
        ]
        if not decimal_tokens:
            continue
        draft = decimal_tokens[0]
        match = re.search(r"\b\d{1,2}\.\d{1,2}\b", text)
        name = text[: match.start()].strip(" .-") if match else text
        if len(name) < 2:
            continue
        output.append(
            {
                "name": name,
                "draft_m": draft,
                "dry_bulk_relevant": bool(DRY_BULK_TERMS.search(text)),
                "raw_text": text,
                "source_table": "BPS 2024-25 Table 1.4",
                "as_of": "2025-03-31",
            }
        )
    return output


def source_item(
    title: str,
    url: Optional[str],
    as_of: Optional[str],
    scope: str,
) -> Optional[Dict[str, Any]]:
    if not url:
        return None
    return {
        "title": title,
        "url": url,
        "as_of": as_of,
        "scope": scope,
    }


def dedupe_sources(items: Iterable[Optional[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    seen = set()
    output = []
    for item in items:
        if not item:
            continue
        key = (item.get("url"), item.get("scope"))
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def build(input_json: Path) -> Dict[str, Any]:
    workbook = json.loads(input_json.read_text(encoding="utf-8"))
    master_rows = records(workbook["Port Master"])
    master_by_name = {str(row["Port_Name"]): row for row in master_rows}
    history_rows = records(workbook["Major History"])
    nonmajor_rows = records(workbook["NonMajor Traffic"])
    capacity_rows = records(workbook["Major Capacity"])
    commodity_rows = records(workbook["Major Commodity"])
    infrastructure_rows = records(workbook["Infrastructure Raw"])
    berth_sections = parse_berth_sections(infrastructure_rows)

    assets = [
        row
        for row in _coal_asset_rows(status_group="operating")
        if row.get("asset_kind") == "coal_trade_terminals"
    ]
    output_ports = []
    for asset in assets:
        asset_name = str(asset["name"])
        master_name = PORT_ALIASES[asset_name]
        master = master_by_name[master_name]
        port_id = str(master["Port_ID"])
        is_major = str(master.get("Port_Class")) == "Major"

        if is_major:
            traffic_candidates = best_label_match(
                master_name, history_rows, "Port_Name"
            )
            traffic_candidates = sorted(
                traffic_candidates, key=lambda row: str(row.get("FY") or "")
            )
            latest_traffic = traffic_candidates[-1] if traffic_candidates else None
            latest_traffic_mt = (
                float(latest_traffic["Cargo_Million_Tonnes"])
                if latest_traffic and latest_traffic.get("Cargo_Million_Tonnes") is not None
                else None
            )
        else:
            aliases = NONMAJOR_TRAFFIC_ALIASES.get(asset_name)
            if aliases is None:
                traffic_candidates = best_label_match(
                    master_name, nonmajor_rows, "Port_Name"
                )
            else:
                traffic_candidates = [
                    row
                    for row in nonmajor_rows
                    if str(row.get("Port_Name") or "") in aliases
                ]
            traffic_candidates = sorted(
                traffic_candidates, key=lambda row: str(row.get("FY") or "")
            )
            latest_traffic = (
                traffic_candidates[-1] if traffic_candidates else None
            )
            latest_traffic_mt = (
                sum(
                    float(row.get("Total_000t") or 0)
                    for row in traffic_candidates
                    if str(row.get("FY") or "")
                    == str(latest_traffic.get("FY") or "")
                )
                / 1000
                if latest_traffic
                else None
            )

        capacity_match = (
            best_label_match(master_name, capacity_rows, "Port_Name")
            if is_major
            else []
        )
        workbook_capacity = (
            float(capacity_match[0]["Capacity_Million_Tonnes"])
            if capacity_match and capacity_match[0].get("Capacity_Million_Tonnes") is not None
            else None
        )

        commodity_name = COMMODITY_PORT_ALIASES.get(asset_name, master_name)
        commodity_matches = best_label_match(
            commodity_name, commodity_rows, "Port_Name"
        )
        if commodity_matches:
            latest_fy = max(str(row.get("FY") or "") for row in commodity_matches)
            commodity_matches = [
                row for row in commodity_matches if str(row.get("FY") or "") == latest_fy
            ]
        dry_bulk_commodities = []
        for row in commodity_matches:
            commodity = str(row.get("Commodity") or "")
            total = row.get("Total_000t")
            if DRY_BULK_TERMS.search(commodity) and total not in (None, 0, 0.0):
                dry_bulk_commodities.append(
                    {
                        "commodity": commodity,
                        "fy": row.get("FY"),
                        "total_mt": round(float(total) / 1000, 3),
                    }
                )
        dry_bulk_commodities.sort(
            key=lambda item: item["total_mt"], reverse=True
        )

        section_id = BERTH_SECTION_BY_ASSET.get(asset_name)
        berth_records = parse_berth_records(
            berth_sections.get(section_id, [])
        )
        dry_bulk_berths = [
            item for item in berth_records if item["dry_bulk_relevant"]
        ]
        workbook_max_draft = (
            max(item["draft_m"] for item in dry_bulk_berths)
            if dry_bulk_berths
            else max(item["draft_m"] for item in berth_records)
            if berth_records
            else None
        )
        curated = CURATED_SPECS.get(asset_name, {})
        max_draft = curated.get("max_draft_m", workbook_max_draft)
        berth_count = curated.get(
            "berth_count", len(berth_records) or None
        )
        port_capacity = curated.get(
            "port_capacity_mtpa",
            APSEZ_CAPACITY_MTPA.get(asset_name, workbook_capacity),
        )
        official_website = curated.get("official_website") or master.get(
            "Port_Website"
        )
        if not official_website and asset_name in APSEZ_ASSETS:
            official_website = "https://www.adaniports.com/"
        if not official_website and asset_name in GMB_ASSETS:
            official_website = "https://gmbports.org/gmb-owned-ports"

        sources = [
            source_item(
                "Basic Port Statistics of India 2024-25",
                master.get("Source_URL"),
                master.get("As_Of"),
                "Official port master and infrastructure snapshot",
            )
        ]
        if latest_traffic:
            sources.append(
                source_item(
                    "Workbook traffic source",
                    latest_traffic.get("Source_URL"),
                    latest_traffic.get("FY"),
                    "Latest available port traffic",
                )
            )
        if asset_name in APSEZ_CAPACITY_MTPA:
            sources.append(
                source_item(
                    "Adani Ports capacity disclosure",
                    APSEZ_CAPACITY_SOURCE,
                    "2024-08-30",
                    "Company-reported port capacity",
                )
            )
        if asset_name in GMB_ASSETS:
            sources.append(
                source_item(
                    "Gujarat Maritime Board port network",
                    "https://gmbports.org/gmb-owned-ports",
                    "2026-07-28",
                    "Port ownership and operating context",
                )
            )
        if curated:
            sources.append(
                source_item(
                    curated["source_title"],
                    curated["source_url"],
                    curated.get("source_as_of"),
                    "Port or terminal specifications",
                )
            )

        output_ports.append(
            {
                "asset_id": asset["id"],
                "asset_name": asset_name,
                "official_port_id": port_id,
                "official_port_name": master_name,
                "match_method": "controlled_alias",
                "match_confidence": 1.0,
                "state_ut": master.get("State_UT"),
                "coast": master.get("Coast"),
                "port_class": master.get("Port_Class"),
                "operating_status": master.get("Status"),
                "latitude": asset.get("lat") or master.get("Latitude"),
                "longitude": asset.get("lon") or master.get("Longitude"),
                "official_website": official_website,
                "source_as_of": master.get("As_Of"),
                "max_documented_draft_m": max_draft,
                "documented_berth_count": berth_count,
                "documented_dry_bulk_berth_count": (
                    len(dry_bulk_berths) or None
                ),
                "port_capacity_mtpa": port_capacity,
                "latest_traffic_mt": latest_traffic_mt,
                "latest_traffic_period": (
                    latest_traffic.get("FY") if latest_traffic else None
                ),
                "latest_traffic_scope": (
                    master_name if latest_traffic else None
                ),
                "terminal_operating_capacity_mtpa": asset.get(
                    "operating_capacity"
                ),
                "terminal_expansion_capacity_mtpa": asset.get(
                    "expansion_capacity"
                ),
                "dry_bulk_commodities": dry_bulk_commodities[:10],
                "berth_facilities": berth_records,
                "dry_bulk_facilities": dry_bulk_berths,
                "specification_note": curated.get("specification_note"),
                "data_caveat": (
                    "Draft and berth values are dated reference snapshots, not "
                    "navigational limits. Confirm current permissible draft, "
                    "tide restrictions and berth availability with the port or agent."
                ),
                "satellite_context": {
                    "provider": "Esri World Imagery",
                    "attribution_url": (
                        "https://www.arcgis.com/home/item.html"
                        "?id=10df2279f9684e4a9f6a7f08febac2a9"
                    ),
                    "views": [
                        {"label": "Terminal detail", "span_degrees": 0.018},
                        {"label": "Harbour context", "span_degrees": 0.055},
                        {"label": "Regional approach", "span_degrees": 0.14},
                    ],
                },
                "sources": dedupe_sources(sources),
            }
        )

    output_ports.sort(key=lambda item: item["asset_name"])
    quality = {
        "asset_rows": len(output_ports),
        "unique_asset_ids": len({item["asset_id"] for item in output_ports}),
        "matched_to_port_master": sum(
            bool(item["official_port_id"]) for item in output_ports
        ),
        "with_official_website": sum(
            bool(item["official_website"]) for item in output_ports
        ),
        "with_documented_draft": sum(
            item["max_documented_draft_m"] is not None for item in output_ports
        ),
        "with_documented_berths": sum(
            item["documented_berth_count"] is not None for item in output_ports
        ),
        "with_latest_traffic": sum(
            item["latest_traffic_mt"] is not None for item in output_ports
        ),
    }
    if quality["asset_rows"] != quality["unique_asset_ids"]:
        raise ValueError("Duplicate asset identifiers in consolidated output")
    if quality["matched_to_port_master"] != quality["asset_rows"]:
        raise ValueError("One or more coal-terminal assets did not match Port Master")
    return {
        "dataset": "India coal-port specifications",
        "version": "2026-07-28",
        "generated_on": date.today().isoformat(),
        "source_workbook": "Indian_Ports_Data_2026-07.xlsx",
        "source_workbook_as_of": "2026-07-28",
        "grain": "One record per operating India coal-terminal card",
        "quality_summary": quality,
        "ports": output_ports,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json", type=Path)
    parser.add_argument("output_json", type=Path)
    args = parser.parse_args()
    payload = build(args.input_json)
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(payload["quality_summary"], indent=2))


if __name__ == "__main__":
    main()
