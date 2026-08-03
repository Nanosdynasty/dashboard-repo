"""Fetch a compact official India electricity-mix research dataset.

Raw XLS/XLSX files are processed in memory and are never persisted.  The
canonical CSV and JSON outputs retain source URLs, source dates and status.
"""

from __future__ import annotations

import io
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "india_coal_master" / "canonical"
UI = ROOT / "data" / "india_coal_master" / "ui"
CEA_ARCHIVE_ENDPOINT = "https://cea.nic.in/wp-admin/admin-ajax.php"
START_PERIOD = pd.Period("2023-05", freq="M")
END_PERIOD = pd.Period("2026-06", freq="M")


def workbook(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = httpx.get(url, timeout=90, follow_redirects=True)
            response.raise_for_status()
            if len(response.content) < 1_000:
                raise RuntimeError(f"Official workbook response was unexpectedly small: {url}")
            return response.content
        except (httpx.HTTPError, RuntimeError) as exc:
            last_error = exc
            time.sleep(1 + attempt)
    raise RuntimeError(f"Official workbook could not be retrieved: {url}") from last_error


def renewable_url(period: pd.Period) -> str:
    response = httpx.post(
        CEA_ARCHIVE_ENDPOINT,
        data={
            "action": "monthly_archive_report",
            "selMonthYear": str(period),
            "reportType": "resd",
        },
        timeout=90,
        follow_redirects=True,
    )
    response.raise_for_status()
    urls = re.findall(r'https?[^\s"\'<>]+\.(?:xlsx|xls)', response.text, re.I)
    preferred = [url for url in urls if "monthly_generation" in url.lower() or "monthly_generation" in url.lower().replace("re_", "")]
    if not preferred:
        preferred = [url for url in urls if "generation" in url.lower()]
    if not preferred:
        raise RuntimeError(f"CEA monthly renewable workbook not listed for {period}")
    return preferred[-1]


def parse_renewable(period: pd.Period) -> dict:
    source_url = renewable_url(period)
    renewable = pd.read_excel(io.BytesIO(workbook(source_url)), sheet_name=0, header=None)

    renewable_values: dict[str, float] = {}
    aliases = {
        "wind": "wind", "solar": "solar", "biomass": "biomass",
        "bagasse": "bagasse", "small hydro": "small_hydro",
        "large hydro": "large_hydro", "others": "other_renewables",
        "total excluding large hydro": "renewables_ex_large_hydro",
    }
    for _, row in renewable.iterrows():
        label = str(row.iloc[1] or "").strip().lower()
        if pd.isna(row.iloc[4]):
            continue
        for token, key in aliases.items():
            if token in label and not (token == "large hydro" and "excluding" in label):
                renewable_values[key] = float(row.iloc[4])
                break

    component_keys = {"wind", "solar", "biomass", "bagasse", "small_hydro", "other_renewables"}
    required = set(component_keys)
    missing = sorted(required - renewable_values.keys())
    if missing:
        raise ValueError(f"CEA renewable fields missing for {period}: {', '.join(missing)}")
    if "renewables_ex_large_hydro" not in renewable_values:
        renewable_values["renewables_ex_large_hydro"] = sum(
            renewable_values[key] for key in component_keys
        )
    return {
        "period": str(period),
        "wind_generation_gwh": renewable_values["wind"],
        "solar_generation_gwh": renewable_values["solar"],
        "biomass_generation_gwh": renewable_values["biomass"],
        "bagasse_generation_gwh": renewable_values["bagasse"],
        "small_hydro_generation_gwh": renewable_values["small_hydro"],
        "other_renewables_generation_gwh": renewable_values["other_renewables"],
        "renewables_ex_large_hydro_gwh": renewable_values["renewables_ex_large_hydro"],
        "cea_renewable_source_url": source_url,
    }


def all_source_record(conventional: dict, renewable: dict) -> dict:
    conventional_total = float(conventional["conventional_generation_gwh"])
    re_ex_hydro = float(renewable["renewables_ex_large_hydro_gwh"])
    all_source_total = conventional_total + re_ex_hydro
    result = {
        **conventional,
        **renewable,
        "status": "official_reported",
        "renewables_ex_large_hydro_gwh": re_ex_hydro,
        "total_generation_gwh": all_source_total,
        "coal_share_pct": float(conventional["coal_generation_gwh"]) / all_source_total * 100,
        "solar_share_pct": float(renewable["solar_generation_gwh"]) / all_source_total * 100,
        "renewables_share_pct": (
            re_ex_hydro + float(conventional["large_hydro_generation_gwh"])
        ) / all_source_total * 100,
    }
    return result


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    UI.mkdir(parents=True, exist_ok=True)
    conventional = pd.read_csv(OUT / "india_power_generation_monthly.csv")
    conventional = conventional[
        (conventional["period"] >= str(START_PERIOD)) &
        (conventional["period"] <= str(END_PERIOD))
    ]
    records = []
    failures = []
    for period in pd.period_range(START_PERIOD, END_PERIOD, freq="M"):
        row = conventional[conventional["period"] == str(period)]
        if row.empty:
            failures.append({"period": str(period), "reason": "NPP conventional row missing"})
            continue
        try:
            renewable = parse_renewable(period)
            records.append(all_source_record(row.iloc[0].to_dict(), renewable))
            print(f"loaded {period}")
        except Exception as exc:
            failures.append({"period": str(period), "reason": str(exc)})
            print(f"missing {period}: {exc}")
    frame = pd.DataFrame(records)
    frame.to_csv(OUT / "india_power_mix_monthly.csv", index=False, encoding="utf-8-sig")
    frame[frame["period"].str.endswith("-06")].to_csv(
        OUT / "india_power_mix_june.csv", index=False, encoding="utf-8-sig"
    )
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "grain": "monthly actual",
        "unit": "GWh unless percentage",
        "records": records,
        "quality": {
            "status": "official_final",
            "note": (
                "All-source total adds CEA renewables excluding large hydro to the "
                "NPP conventional total; large hydro is already in the NPP total."
            ),
            "failures": failures,
        },
    }
    (UI / "india_power_mix.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    print(json.dumps({"records": len(records), "latest": records[-1]["period"] if records else None, "failures": len(failures)}))


if __name__ == "__main__":
    main()
