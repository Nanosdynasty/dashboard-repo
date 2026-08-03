"""Profile freshness and basic quality of Coal India workspace CSV datasets."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "data" / "india_coal_master" / "canonical"


def main() -> None:
    results = []
    for path in sorted(CANONICAL.glob("*.csv")):
        frame = pd.read_csv(path)
        period_column = next(
            (column for column in ("period", "date", "report_date", "financial_year") if column in frame.columns),
            None,
        )
        periods = frame[period_column].dropna().astype(str) if period_column else pd.Series(dtype=str)
        numeric = frame.select_dtypes(include="number")
        source_columns = [column for column in frame.columns if "source" in column.lower() and "url" in column.lower()]
        duplicate_keys = int(frame.duplicated(subset=[period_column]).sum()) if period_column else None
        results.append({
            "dataset": path.name,
            "rows": len(frame),
            "columns": len(frame.columns),
            "period_column": period_column,
            "earliest": periods.min() if not periods.empty else None,
            "latest": periods.max() if not periods.empty else None,
            "duplicate_periods": duplicate_keys,
            "numeric_nulls": int(numeric.isna().sum().sum()),
            "source_columns": source_columns,
            "statuses": sorted(frame["status"].dropna().astype(str).unique().tolist()) if "status" in frame else [],
        })
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
