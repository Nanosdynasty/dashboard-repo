"""Generate water-only maritime-risk polygons from the maintained source file.

The source geometries retain the published longitude/latitude control points.
For display and route-exposure checks, those polygons are subtracted from the
Natural Earth 1:50m land mask so polygon closure edges never shade land.
"""
from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen

from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "data" / "zones_source.json"
OUTPUT_PATH = ROOT / "data" / "zones.json"
LAND_PATH = ROOT / "tmp" / "ne_50m_land.geojson"
LAND_URL = (
    "https://raw.githubusercontent.com/nvkelso/"
    "natural-earth-vector/master/geojson/ne_50m_land.geojson"
)
COASTAL_CLEARANCE_DEGREES = 0.015


def polygonal_only(geometry):
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    if isinstance(geometry, GeometryCollection):
        parts = [
            part
            for part in geometry.geoms
            if isinstance(part, (Polygon, MultiPolygon)) and not part.is_empty
        ]
        return unary_union(parts) if parts else Polygon()
    return Polygon()


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    if not LAND_PATH.exists():
        LAND_PATH.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(LAND_URL, timeout=30) as response:
            LAND_PATH.write_bytes(response.read())
    land_payload = json.loads(LAND_PATH.read_text(encoding="utf-8"))
    land = unary_union([
        shape(feature["geometry"])
        for feature in land_payload.get("features", [])
        if feature.get("geometry")
    ]).buffer(COASTAL_CLEARANCE_DEGREES)

    output = {**source, "features": []}
    output.setdefault("metadata", {})["display_geometry"] = (
        "water-only polygons clipped against Natural Earth 1:50m land"
    )
    output["metadata"]["land_mask_source"] = (
        "https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/"
    )
    output["metadata"]["coastal_clearance_degrees"] = COASTAL_CLEARANCE_DEGREES

    for feature in source.get("features", []):
        water_only = polygonal_only(shape(feature["geometry"]).difference(land))
        output["features"].append({
            **feature,
            "properties": {
                **(feature.get("properties") or {}),
                "display_scope": "water_only",
                "land_mask": "Natural Earth 1:50m",
            },
            "geometry": mapping(water_only),
        })

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
