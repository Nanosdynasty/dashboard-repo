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

Status: filtered map workspaces implemented; full detail modeling remains next.

- Create a manifest for all 23 uploaded workbooks and their reporting grains.
- Map-ready layers are implemented for coal mines, iron ore mines, steel,
  cement, bioenergy, and geothermal alongside the existing power trackers.
- Energy, Ports, and Commodities are isolated map modes, with optional port
  overlays in the two asset modes.
- Energy and commodity layers support shared country and operating-status
  filters. Coal terminals additionally support import/export/domestic roles.
- Renewable energy groups solar, wind, hydro, geothermal, and bioenergy;
  nuclear remains a separate group.
- Coal trade-terminal detail includes terminal role, parent port, product type,
  capacity, and coal source where available in the GEM workbook.
- Normalize the remaining workbook fields into full detail models rather than
  map-only extracts.
- Preserve original row/source identifiers for audit and drill-through.
- Add tracker-specific schemas, validation reports, filters, legends, and detail
  cards rather than forcing unlike datasets into one generic model.
- Add bauxite and limestone only after a reviewed source distinguishes active
  mines from deposits, prospects, occurrences, and historical sites.

## Phase 3 — Production map architecture

Status: planned.

- Migrate the map shell to React + TypeScript + MapLibre.
- Add vector/clustered layers, URL-backed filter state, saved views, legends,
  layer ordering, and large-dataset performance budgets.
- Introduce a documented port taxonomy covering dry bulk, liquid bulk, oil,
  LNG, container, breakbulk, Ro-Ro, anchorage, and unclassified records.

## India Coal intelligence workspace

Status: operational map and NPP power foundation implemented; coal trade and
production analytics await user uploads.

- Add a dedicated, collapsible Coal workspace with map, table, and card views.
- Use India-only GEM coal mines and coal trade terminals plus WPI-classified
  dry-bulk ports as the verified geographic context.
- Default every mine, plant and terminal layer to operating assets. Allow
  under-construction and proposed views explicitly; never expose retired,
  cancelled, shelved or mothballed records in the application.
- Add optional coal-consuming industry overlays for operating coal power,
  steel and cement plants. Other industrial consumers remain unavailable until
  a reviewed location/status source is supplied.
- Treat a coal terminal with existing operating capacity and a pipeline
  project as an operating terminal with separately reported construction and
  proposed expansion capacity. Do not relabel the whole port as proposed.
- Do not show placeholder operational numbers. Production, imports, power use,
  stocks, renewables, monsoon, and heat series remain visibly unavailable until
  a source dataset is uploaded.
- Accept separate Excel, CSV, or JSON uploads for each analytical dataset type,
  profile likely period and numeric columns, and retain quality warnings.
- Export uploaded raw datasets to Excel with a methodology sheet; never insert
  inferred values into the workbook.
- Next analytical increment: normalize compatible period/unit schemas, then add
  monthly production-versus-import charts, YoY comparisons, configurable
  weekly/monthly/quarterly/yearly power-use views, and lagged driver analysis.
- Use an Oceanbolt-style analytical hierarchy: overview, supply, trade flows,
  power, stock cover, and external drivers, with commodity, frequency, period,
  geography, port, and vessel-segment filters when those fields exist.
- Define coal stock as **stock cover in days**. Prefer an authoritative reported
  days-left value; otherwise calculate usable inventory tonnes divided by
  aligned average daily consumption tonnes at the same plant/state/national
  scope. Retain inventory tonnes as a supporting measure.
- Correlation outputs must report overlap, missingness, lag assumptions, and
  confidence, and must never be described as causal evidence.
- Mirror the requested National Power Portal views in the Howe Robinson theme:
  installed capacity, all-India capacity status, category and sector splits,
  daily demand, and historical growth of installed capacity. Explicitly exclude
  historical electricity-consumption growth.
- Refresh the official NPP JSON feeds every 12 hours or on manual request, reconcile
  category and sector totals before publishing, retain the last validated
  snapshot for source outages, and label stale data rather than silently
  substituting values.
- Add NPP daily generation, cumulative generation, coal-stock availability
  bands (station counts by days of cover), and sector-wise thermal/nuclear PLF.
- Show installed-capacity history with labelled year and GW axes plus accessible
  point-level hover and keyboard-focus values.

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
