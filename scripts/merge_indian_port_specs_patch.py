#!/usr/bin/env python3
"""Validate and merge a researched India coal-port patch into the dashboard master."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


PORT_UPDATE_FIELDS = (
    "official_port_name",
    "official_website",
    "max_documented_draft_m",
    "documented_berth_count",
    "documented_dry_bulk_berth_count",
    "port_capacity_mtpa",
    "latest_traffic_mt",
    "latest_traffic_period",
    "latest_traffic_scope",
    "terminal_operating_capacity_mtpa",
    "terminal_expansion_capacity_mtpa",
    "expansion_status",
    "expansion_expected_commissioning_date",
    "specification_note",
    "data_caveat",
)

IDENTITY_FIELDS = ("asset_name", "state_ut", "coast", "port_class")
ALLOWED_STATUS = {"operating", "under_construction", "proposed", "unknown"}
ALLOWED_FACILITY_TYPES = {
    "berth",
    "jetty",
    "mooring",
    "anchorage",
    "barge_jetty",
    "SBM",
    "other",
}
ALLOWED_DRAFT_TYPES = {
    "permissible",
    "declared",
    "charted",
    "design",
    "unknown",
}
ALLOWED_FLOW_DIRECTIONS = {
    "import",
    "export",
    "coastal_in",
    "coastal_out",
    "loaded",
    "discharged",
    "total",
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def normalized(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def is_http_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def unique_count(values: list[Any]) -> tuple[int, list[str]]:
    strings = [str(value) for value in values if value not in (None, "")]
    duplicates = sorted(
        value for value, count in Counter(strings).items() if count > 1
    )
    return len(set(strings)), duplicates


def merge_source_rows(
    current_rows: list[dict[str, Any]],
    patch_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for source in [*current_rows, *patch_rows]:
        key = str(
            source.get("url")
            or source.get("source_id")
            or f"{source.get('title')}|{source.get('as_of')}"
        )
        if key not in merged:
            order.append(key)
        merged[key] = deepcopy(source)
    return [merged[key] for key in order]


def merge_facility_rows(
    current_rows: list[dict[str, Any]],
    patch_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged = [deepcopy(row) for row in current_rows]
    indexes: dict[str, int] = {}
    for index, row in enumerate(merged):
        key = str(row.get("facility_id") or normalized(row.get("name")))
        if key:
            indexes[key] = index
    for row in patch_rows:
        facility = deepcopy(row)
        key = str(
            facility.get("facility_id") or normalized(facility.get("name"))
        )
        name_key = normalized(facility.get("name"))
        existing_index = indexes.get(key)
        if existing_index is None and name_key:
            existing_index = indexes.get(name_key)
        if existing_index is None:
            indexes[key] = len(merged)
            if name_key:
                indexes[name_key] = len(merged)
            merged.append(facility)
        else:
            merged[existing_index] = facility
            indexes[key] = existing_index
            if name_key:
                indexes[name_key] = existing_index
    return merged


def validate_patch(
    master: dict[str, Any], patch: dict[str, Any]
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    current_ports = master.get("ports", [])
    patch_ports = patch.get("ports", [])
    facilities = patch.get("berth_facilities", [])
    flows = patch.get("commodity_flows", [])
    sources = patch.get("sources", [])
    conflicts = patch.get("conflicts_and_gaps", [])

    current_ids = {str(row.get("asset_id")) for row in current_ports}
    patch_ids = [row.get("asset_id") for row in patch_ports]
    patch_id_set = {str(value) for value in patch_ids if value}

    _, duplicate_port_ids = unique_count(patch_ids)
    if duplicate_port_ids:
        errors.append(f"Duplicate patch asset IDs: {duplicate_port_ids}")
    missing_ports = sorted(current_ids - patch_id_set)
    unknown_ports = sorted(patch_id_set - current_ids)
    if missing_ports:
        errors.append(f"Patch omits master asset IDs: {missing_ports}")
    if unknown_ports:
        errors.append(f"Patch contains unknown asset IDs: {unknown_ports}")

    current_by_id = {
        str(row.get("asset_id")): row for row in current_ports
    }
    for row in patch_ports:
        asset_id = str(row.get("asset_id"))
        current = current_by_id.get(asset_id)
        if not current:
            continue
        for field in IDENTITY_FIELDS:
            if normalized(row.get(field)) != normalized(current.get(field)):
                errors.append(
                    f"{asset_id}: identity mismatch for {field}: "
                    f"{current.get(field)!r} vs {row.get(field)!r}"
                )
        if not is_http_url(row.get("official_website")):
            errors.append(f"{asset_id}: invalid official_website")
        draft = row.get("max_documented_draft_m")
        if draft is not None and not (0 < float(draft) <= 30):
            errors.append(f"{asset_id}: invalid port draft {draft}")
        berths = row.get("documented_berth_count")
        dry_berths = row.get("documented_dry_bulk_berth_count")
        if berths is not None and int(berths) < 1:
            errors.append(f"{asset_id}: invalid berth count {berths}")
        if dry_berths is not None and int(dry_berths) < 1:
            errors.append(
                f"{asset_id}: invalid dry-bulk berth count {dry_berths}"
            )
        if (
            berths is not None
            and dry_berths is not None
            and int(dry_berths) > int(berths)
        ):
            errors.append(
                f"{asset_id}: dry-bulk berth count exceeds total berths"
            )
        for field in (
            "port_capacity_mtpa",
            "latest_traffic_mt",
            "terminal_operating_capacity_mtpa",
            "terminal_expansion_capacity_mtpa",
        ):
            value = row.get(field)
            if value is not None and float(value) < 0:
                errors.append(f"{asset_id}: negative {field}={value}")

    facility_ids = [row.get("facility_id") for row in facilities]
    _, duplicate_facility_ids = unique_count(facility_ids)
    if duplicate_facility_ids:
        errors.append(
            f"Duplicate facility IDs: {duplicate_facility_ids}"
        )
    source_ids = [row.get("source_id") for row in sources]
    _, duplicate_source_ids = unique_count(source_ids)
    if duplicate_source_ids:
        errors.append(f"Duplicate source IDs: {duplicate_source_ids}")
    source_id_set = {str(value) for value in source_ids if value}

    for row in facilities:
        facility_id = str(row.get("facility_id"))
        asset_id = str(row.get("asset_id"))
        if asset_id not in current_ids:
            errors.append(
                f"{facility_id}: facility references unknown asset {asset_id}"
            )
        if row.get("operating_status") not in ALLOWED_STATUS:
            errors.append(
                f"{facility_id}: invalid operating_status "
                f"{row.get('operating_status')!r}"
            )
        if row.get("facility_type") not in ALLOWED_FACILITY_TYPES:
            errors.append(
                f"{facility_id}: invalid facility_type "
                f"{row.get('facility_type')!r}"
            )
        if row.get("draft_type") not in ALLOWED_DRAFT_TYPES:
            errors.append(
                f"{facility_id}: invalid draft_type "
                f"{row.get('draft_type')!r}"
            )
        draft = row.get("draft_m")
        if draft is not None and not (0 < float(draft) <= 35):
            errors.append(f"{facility_id}: invalid draft {draft}")
        if (
            row.get("facility_type") == "anchorage"
            and draft is not None
            and row.get("draft_type") == "permissible"
        ):
            warnings.append(
                f"{facility_id}: anchorage has permissible draft label"
            )
        if str(row.get("source_id")) not in source_id_set:
            errors.append(
                f"{facility_id}: missing source {row.get('source_id')}"
            )

    flow_keys: list[str] = []
    for row in flows:
        asset_id = str(row.get("asset_id"))
        key = "|".join(
            str(row.get(field))
            for field in (
                "asset_id",
                "period",
                "commodity",
                "trade_direction",
            )
        )
        flow_keys.append(key)
        if asset_id not in current_ids:
            errors.append(f"{key}: flow references unknown asset")
        if row.get("trade_direction") not in ALLOWED_FLOW_DIRECTIONS:
            errors.append(
                f"{key}: invalid trade_direction "
                f"{row.get('trade_direction')!r}"
            )
        quantity = row.get("quantity_mt")
        if quantity is None or float(quantity) < 0:
            errors.append(f"{key}: invalid quantity_mt {quantity}")
        if str(row.get("source_id")) not in source_id_set:
            errors.append(f"{key}: missing source {row.get('source_id')}")
    _, duplicate_flow_keys = unique_count(flow_keys)
    if duplicate_flow_keys:
        errors.append(f"Duplicate commodity flow grain: {duplicate_flow_keys}")

    for source in sources:
        source_id = str(source.get("source_id"))
        if not is_http_url(source.get("url")):
            errors.append(f"{source_id}: invalid source URL")
        asset_id = source.get("asset_id")
        if asset_id is not None and str(asset_id) not in current_ids:
            errors.append(
                f"{source_id}: source references unknown asset {asset_id}"
            )

    conflict_status = Counter(str(row.get("status")) for row in conflicts)
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": {
            "master_ports": len(current_ports),
            "patch_ports": len(patch_ports),
            "facilities": len(facilities),
            "commodity_flows": len(flows),
            "sources": len(sources),
            "conflicts_and_gaps": len(conflicts),
            "resolved_conflicts": conflict_status.get("resolved", 0),
            "unresolved_conflicts": conflict_status.get("unresolved", 0),
        },
    }


def merge_patch(
    master: dict[str, Any], patch: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    output = deepcopy(master)
    patch_ports = {
        str(row.get("asset_id")): row for row in patch.get("ports", [])
    }
    facilities_by_port: dict[str, list[dict[str, Any]]] = defaultdict(list)
    flows_by_port: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in patch.get("berth_facilities", []):
        facilities_by_port[str(row.get("asset_id"))].append(row)
    for row in patch.get("commodity_flows", []):
        flows_by_port[str(row.get("asset_id"))].append(row)
    sources_by_id = {
        str(row.get("source_id")): row for row in patch.get("sources", [])
    }
    sources_by_port: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in patch.get("sources", []):
        if row.get("asset_id"):
            sources_by_port[str(row.get("asset_id"))].append(row)

    changed_fields: dict[str, list[str]] = defaultdict(list)
    for port in output.get("ports", []):
        asset_id = str(port.get("asset_id"))
        update = patch_ports[asset_id]
        for field in PORT_UPDATE_FIELDS:
            value = update.get(field)
            if value is not None and port.get(field) != value:
                port[field] = deepcopy(value)
                changed_fields[asset_id].append(field)
        current_as_of = str(port.get("source_as_of") or "")
        patch_as_of = str(update.get("source_as_of") or "")
        if patch_as_of > current_as_of:
            port["source_as_of"] = patch_as_of
            changed_fields[asset_id].append("source_as_of")

        patch_facilities = facilities_by_port.get(asset_id, [])
        if patch_facilities:
            port["berth_facilities"] = merge_facility_rows(
                port.get("berth_facilities", []),
                patch_facilities,
            )
            port["dry_bulk_facilities"] = [
                row
                for row in port["berth_facilities"]
                if row.get("dry_bulk_relevant") is True
            ]
            changed_fields[asset_id].extend(
                ["berth_facilities", "dry_bulk_facilities"]
            )

        port_flows = deepcopy(flows_by_port.get(asset_id, []))
        if port_flows:
            port["commodity_flows"] = port_flows
            changed_fields[asset_id].append("commodity_flows")

        referenced_source_ids = {
            str(row.get("source_id"))
            for row in [*patch_facilities, *port_flows]
            if row.get("source_id")
        }
        relevant_sources = list(sources_by_port.get(asset_id, []))
        relevant_sources.extend(
            sources_by_id[source_id]
            for source_id in sorted(referenced_source_ids)
            if source_id in sources_by_id
        )
        if relevant_sources:
            port["sources"] = merge_source_rows(
                port.get("sources", []),
                relevant_sources,
            )
            changed_fields[asset_id].append("sources")

    output["generated_on"] = patch.get("generated_on") or date.today().isoformat()
    output["version"] = output["generated_on"]
    output["latest_research_update"] = {
        "dataset": patch.get("dataset"),
        "generated_on": patch.get("generated_on"),
        "facility_records": len(patch.get("berth_facilities", [])),
        "commodity_flow_records": len(patch.get("commodity_flows", [])),
        "source_records": len(patch.get("sources", [])),
    }
    output["berth_facilities"] = deepcopy(
        patch.get("berth_facilities", [])
    )
    output["commodity_flows"] = deepcopy(patch.get("commodity_flows", []))
    output["research_sources"] = deepcopy(patch.get("sources", []))
    output["conflicts_and_gaps"] = deepcopy(
        patch.get("conflicts_and_gaps", [])
    )

    ports = output.get("ports", [])
    quality = {
        "asset_rows": len(ports),
        "unique_asset_ids": len(
            {str(row.get("asset_id")) for row in ports}
        ),
        "matched_to_port_master": sum(
            bool(row.get("official_port_id")) for row in ports
        ),
        "with_official_website": sum(
            bool(row.get("official_website")) for row in ports
        ),
        "with_documented_draft": sum(
            row.get("max_documented_draft_m") is not None for row in ports
        ),
        "with_documented_berths": sum(
            row.get("documented_berth_count") is not None for row in ports
        ),
        "with_documented_dry_bulk_berths": sum(
            row.get("documented_dry_bulk_berth_count") is not None
            for row in ports
        ),
        "with_port_capacity": sum(
            row.get("port_capacity_mtpa") is not None for row in ports
        ),
        "with_latest_traffic": sum(
            row.get("latest_traffic_mt") is not None for row in ports
        ),
        "with_facility_records": sum(
            bool(row.get("berth_facilities")) for row in ports
        ),
        "with_commodity_flow_records": sum(
            bool(row.get("commodity_flows")) for row in ports
        ),
    }
    output["quality_summary"] = quality
    change_summary = {
        "ports_changed": len(changed_fields),
        "changed_fields_by_asset": dict(sorted(changed_fields.items())),
        "quality_after_merge": quality,
    }
    return output, change_summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("master", type=Path)
    parser.add_argument("patch", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    master = load_json(args.master)
    patch = load_json(args.patch)
    validation = validate_patch(master, patch)
    if not validation["valid"]:
        print(json.dumps(validation, indent=2))
        raise SystemExit(1)

    merged, change_summary = merge_patch(master, patch)
    report = {
        "validation": validation,
        "merge": change_summary,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
