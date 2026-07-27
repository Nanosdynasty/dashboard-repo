# Global Energy & Maritime Dashboard Plan

Approved direction: continue the existing dashboard as a source-aware global
energy and maritime intelligence product, with dry-bulk ports as the first
operational workflow.

## Product principles

- Preserve source provenance, confidence, and unknown values.
- Never infer berth counts, drafts, capacity, or classifications as zero.
- Make map hover useful for scanning and map click useful for investigation.
- Keep distance outputs explicitly analytical and not suitable for navigation.
- Use the official Howe Robinson Partners logo palette: blue, navy, red, and
  dark red.

## Phase 1 — Dry-bulk port foundation

Status: implemented locally on `codex/dry-bulk-foundation`.

- Normalize the bundled World Port Index extract behind a stable port API.
- Enrich likely coal-handling ports from GEM coal-terminal records with guarded
  geographic/name matching and visible match confidence.
- Add category, country, search, and minimum-depth filters.
- Add rich hover cards and a persistent port details drawer.
- Add port-to-route origin/destination actions and voyage result cards.
- Remove embedded credential fallbacks and document environment variables.
- Add API and data-quality regression tests.

## Phase 2 — Complete ZIP ingestion

Status: map-layer subset implemented; full detail modeling remains next.

- Create a manifest for all 23 uploaded workbooks and their reporting grains.
- Map-ready layers are implemented for coal mines, iron ore mines, steel,
  cement, bioenergy, and geothermal alongside the existing power trackers.
- Normalize the remaining workbook fields into full detail models rather than
  map-only extracts.
- Preserve original row/source identifiers for audit and drill-through.
- Add tracker-specific schemas, validation reports, filters, legends, and detail
  cards rather than forcing unlike datasets into one generic model.

## Phase 3 — Production map architecture

Status: planned.

- Migrate the map shell to React + TypeScript + MapLibre.
- Add vector/clustered layers, URL-backed filter state, saved views, legends,
  layer ordering, and large-dataset performance budgets.
- Introduce a documented port taxonomy covering dry bulk, liquid bulk, oil,
  LNG, container, breakbulk, Ro-Ro, anchorage, and unclassified records.

## Phase 4 — Voyage intelligence

Status: planned.

- Replace development routing with a reviewed production maritime-routing
  service and route-cache strategy.
- Add canal/strait options, alternative routes, ECA/piracy/weather overlays,
  bunker assumptions, and reproducible voyage scenarios.
- Keep all results clearly separated from navigational advice.

## Phase 5 — Verified port specifications

Status: planned, source-dependent.

- Refresh from the richer official NGA World Port Index distribution.
- Add licensed/authoritative berth, terminal, maximum-draft, anchorage, and
  cargo-handling sources where legally and technically available.
- Track per-field source date, licensing, confidence, and refresh cadence.

## Acceptance gates

- Automated schema, coordinate, uniqueness, join-distance, API, and secret tests.
- Desktop and mobile visual QA with no console errors.
- Source attribution and caveats visible in the product.
- No production deployment or GitHub push without an explicit release decision.
