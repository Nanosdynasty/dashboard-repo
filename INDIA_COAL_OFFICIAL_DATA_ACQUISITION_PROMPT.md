# India Coal Workspace — Official Historical Data Acquisition Prompt

This document is both:

1. the scope for the HRP Dashboard historical India-coal ingestion work; and
2. a copy-ready prompt that can be given to Codex, Grok, Gemini, or another research/data-engineering AI.

No large-scale acquisition should begin until the decisions immediately below are approved.

## Decisions to verify

Recommended defaults are shown in **bold**.

- Historical start: **FY 2016–17**, extending further back when an official machine-readable series is readily available.
- Latest observations: **include the latest official provisional period**, while retaining its `provisional` status and replacing it only when a revised/final release is published.
- Core dashboard datasets: **production, imports, power use, power stocks, renewables, and weather**.
- Additional correlation datasets: **port coal traffic, industrial coal use, electricity demand/generation, mine dispatch/offtake, and coal prices**.
- Coal-use traceability: **collect plant/industry-level consumption and connect the receiving asset to its contractual and actual coal sources, grade/GCV, transport mode, and domestic/imported blend whenever an official record supports the link**.
- Import partner-country interpretation: **treat the country as the officially reported trade counterparty/consignment country, not necessarily the physical mine origin**.
- Storage policy: **store normalized JSON and CSV only; never retain downloaded PDFs**.
- Missing values: **use null/blank and a reason code; never convert missing or “not available” to zero**.
- Granularity: **retain the finest official grain and produce weekly, monthly, quarterly, and yearly derived views only when mathematically valid**.
- Correlations: **show association and lag relationships, never claim causation without a separate causal design**.

---

# COPY-READY PROMPT — START

You are a senior public-data researcher and data engineer working on the “Coal India Workspace” in the HRP Dashboard.

Your job is to build a traceable, analysis-ready historical master dataset for Indian coal production, imports, power-sector consumption and stocks, renewable generation, weather, ports, and other official variables that can be correlated with Indian dry-bulk coal movements.

## 1. Required outcome

Collect at least 7–10 complete years of official Indian data, beginning with FY 2016–17 and continuing through the latest officially published period. Traverse archive pages, pagination, date selectors, old-site sections, and report indexes. Extend a series further back when an official structured archive is readily available.

Populate the six dataset families already used by the application:

- `production`
- `imports`
- `power_use`
- `power_stocks`
- `renewables`
- `weather`

Also collect these extended analysis families when official data is available:

- `port_coal_traffic`
- `industrial_use`
- `power_demand`
- `mine_dispatch`
- `coal_prices`
- `coal_supply_chain`
- `events`

The application must be able to filter the resulting records by:

- dataset
- frequency: daily, weekly, monthly, quarterly, yearly
- coal type: thermal/non-coking, coking, lignite, anthracite, other, all
- period: last 12 months, 3 years, 5 years, 10 years, all available
- geography
- company, mine, plant, port, sector, and source where applicable
- supplying mine/coalfield/subsidiary, receiving plant/industry, coal grade/GCV, transport mode, and blend type where officially available
- official release status: provisional, revised, final

Do not return only a written summary. Produce the required data files, manifests, logs, and quality report.

## 2. Non-negotiable source rules

1. Use primary official sources only:
   - Government of India ministries, departments, regulators, statutory authorities, and official portals;
   - Central or state public-sector companies for their own operations;
   - official port authorities and state maritime boards for their own traffic;
   - official Indian statistical publications and APIs.
2. Do not use Wikipedia, news articles, data aggregators, commercial dashboards, blogs, Statista, social media, or search-result snippets as data sources.
3. A reputable non-government source may be used only to locate an official document. The stored record must cite the official document or official dataset.
4. Prefer source formats in this order:
   - official API or downloadable CSV;
   - official XLS/XLSX;
   - official HTML table;
   - official PDF containing a structured table;
   - OCR of an official scanned PDF, only as the last resort.
5. If the same measure appears in more than one official source, use the source-precedence rules in this prompt and retain a reconciliation result. Do not silently choose whichever number is easier to extract.
6. Do not bypass CAPTCHAs, authentication, rate limits, robots controls, or access restrictions. Log the blocked source and continue with other official sources.

## 3. Strict PDF handling

PDFs may be downloaded only to memory or an operating-system temporary location for extraction.

For every PDF:

1. record the official source URL, title, publication date, accessed time, and optional SHA-256 checksum;
2. extract only the tables, definitions, notes, and values needed by the master dataset;
3. validate table headers, units, period labels, footnotes, totals, and page/table references;
4. write the normalized records to JSON/CSV;
5. delete the temporary PDF immediately after successful or failed extraction.

The final project and delivered package must contain **no `.pdf` files**. Do not base64-encode or otherwise hide a PDF inside JSON.

## 4. Required official source registry

Start with these source families. Follow their archive links and official successor/old-site links where necessary.

| Priority | Dataset | Official source | Starting URL | Expected use |
|---:|---|---|---|---|
| 1 | Annual coal system | Coal Controller Organisation — Coal Directory of India | https://coalcontroller.gov.in/coal-directory-india | Annual production, dispatch/offtake, stocks, captive/commercial blocks, resources, consumption, prices, imports, coal/lignite classifications |
| 1 | Current/monthly coal | Ministry of Coal — Monthly Statistics at a Glance | https://coal.gov.in/public-information/monthly-statistics-at-glance | Monthly production, dispatch, captive/commercial production, stocks and other published operational series |
| 1 | Structured coal tables | Ministry of Coal — Major Statistics / Coal Statistics / Production and Supplies | https://coal.gov.in/major-statistics-page | Prefer the official Excel chapters and structured tables over PDFs |
| 1 | Plant coal receipts/use/stocks | Central Electricity Authority — Fuel Management Division | https://cea.nic.in/fuel-management-division/?lang=en | Daily coal stock, monthly coal/gas, monthly import of coal, coal requirement, shortage and stock methodologies |
| 1 | Daily/monthly power and coal | National Power Portal — Published Reports | https://npp.gov.in/publishedReports | Daily generation, monthly generation, coal reports, coal imports, outages; prefer XLS |
| 1 | Daily coal archive | National Power Portal — Daily Coal Reports | https://npp.gov.in/dailyCoalReports | Plant-level coal receipts, consumption, inventory, stock days and critical status where available |
| 1 | Plant linkage and allocated source | Ministry of Coal — Standing Linkage Committee (Long-Term) and archived meeting minutes | https://coal.gov.in/public-information/standing-linkage-committee1 | Power plant/industrial consumer, recommended linkage quantity, supplying coal company/source, transport conditions, FSA/LoA/SHAKTI status and effective dates |
| 1 | Plant blending/coal quality methodology | CEA — Thermal Engineering & Technology Development Division | https://cea.nic.in/thermal-engineering-technology-development-division/?lang=en | Official blending limits/methodology and technical definitions; not a substitute for plant-period actual blend observations |
| 1 | Generation history | CEA — Operation Performance Monitoring Division | https://cea.nic.in/operation-performance-monitoring-division/?lang=en | Actual/tentative generation by source, region, sector, utility and plant; source-wise historical generation |
| 1 | Renewable driver | CEA — Renewable Generation Report | https://cea.nic.in/renewable-generation-report/?lang=en | Monthly renewable generation by source/region/state; prefer Excel |
| 1 | Import quantity/value | Department of Commerce / DGCI&S TradeStat | https://tradestat.commerce.gov.in/ftspcc/import_commodity_wise | Monthly and annual national totals and reported partner-country trade records |
| 1 | Annual port traffic | Ministry of Ports, Shipping and Waterways — Basic Port Statistics | https://shipmin.gov.in/transport-reseach/basic-port-statistics | Port and commodity-wise coal traffic for major and non-major ports |
| 1 | Monthly major-port traffic | Indian Ports Association | https://ipa.org.in/ | Monthly port traffic and principal commodity tables |
| 1 | Weather driver | India Meteorological Department — Rainfall Information | https://mausam.imd.gov.in/imd_latest/contents/rainfallinformation.php | Daily, weekly, monthly and cumulative actual/normal rainfall and departure |
| 2 | Producer detail | Coal India Limited official reports/statistics | https://www.coalindia.in/ | CIL and subsidiary production, offtake, dispatch mode, inventory, customer/sector mix |
| 2 | Producer detail | Singareni Collieries Company Limited official reports | https://scclmines.com/ | SCCL production, dispatch, stocks and operational series |
| 2 | Lignite detail | NLC India Limited official reports | https://www.nlcindia.in/ | Lignite production, dispatch and linked generation |
| 2 | Steel/coking-coal driver | Ministry of Steel and Joint Plant Committee official publications | https://steel.gov.in/ | Crude steel, pig iron, finished steel and coking-coal use/import measures |
| 2 | Cement driver | DPIIT / Office of Economic Adviser — Eight Core Industries | https://eaindustry.nic.in/ | Official monthly cement production index/volume series where published |

Before extraction, create a `source_inventory.csv`. Add any additional official source discovered during archive traversal, including its owner, dataset family, available formats, coverage, access limitation, and precedence.

## 5. Source precedence and reconciliation

Use the following precedence unless an official methodological note explicitly requires another choice:

1. final structured release from the statutory/subject authority;
2. revised structured release from that authority;
3. provisional structured release from that authority;
4. final table in an official annual publication;
5. official monthly/press update used only to extend the latest period;
6. a public-sector company release for that company’s own operations.

Examples:

- Coal production and all-India coal statistics: Coal Controller/Ministry of Coal controls annual totals; company records provide subsidiary detail.
- Power-plant coal receipt, consumption, stock, stock days and criticality: CEA/NPP fuel reports control the plant-level power series.
- Electricity generation and demand: CEA/NPP controls the official power series.
- Merchandise imports: DGCI&S/TradeStat controls customs-reported trade quantity/value. Ministry of Coal/Coal Directory may control the coal-policy presentation or coking/non-coking reconciliation; retain both if definitions differ.
- Major/non-major port coal traffic: MoPSW Basic Port Statistics controls annual port-system history; IPA/individual port sources extend or deepen monthly major-port detail.
- Rainfall and heat: IMD controls weather observations and classifications.

When two official values disagree:

- do not average them;
- keep both raw normalized observations if their definitions, release statuses, or grains differ;
- select one `canonical_record_id` according to precedence;
- create a reconciliation row containing both values, absolute difference, percentage difference, likely definition/revision cause, and resolution;
- mark unresolved material conflicts in `quality_report.md`.

## 6. TradeStat country warning

TradeStat partner-country records do not prove that coal was mined in that country. Switzerland, Singapore, the UAE, or another trading/consignment hub may appear because of invoicing, consignment, re-export, routing, or reporting conventions.

Therefore:

- name the field `reported_partner_country`;
- name its role `reported_trade_counterparty`;
- never label it `mine_origin`, `producer_country`, or “coal exporting country” unless a separate official origin field explicitly supports that conclusion;
- retain the national total import quantity as the main analytical aggregate;
- create `partner_origin_warning = true` for likely trading hubs or values that conflict with official producer/origin tables;
- cross-check physical origin only against an explicit official origin/source-country dataset;
- include the official metadata/definition page used to interpret the country field.

Use HS codes carefully:

- `2701` — coal;
- `2702` — lignite, stored separately;
- `2704` — coke/semi-coke, optional and always separate from raw coal.

Retain the full HS code and description. Do not infer coking/non-coking from a broad code when the subheading does not support it. Check classification or unit changes across years and create a mapping-version field.

## 7. Canonical data model

### 7.1 Common fact fields

Every observation must contain these fields, even if some optional values are null:

```text
record_id
dataset_type
metric_code
metric_name
frequency
period_start
period_end
observation_date
fiscal_year
calendar_year
is_ytd
geography_level
geography_code
geography_name
entity_type
entity_id
entity_name
parent_entity_id
coal_type
value
unit
original_value
original_unit
conversion_method
release_status
revision_number
source_id
source_url
source_title
source_published_at
source_accessed_at
source_page_table
extraction_method
calculation_method
missing_reason
quality_flags
notes
```

Controlled values:

- `dataset_type`: `production`, `imports`, `power_use`, `power_stocks`, `renewables`, `weather`, `port_coal_traffic`, `industrial_use`, `power_demand`, `mine_dispatch`, `coal_prices`, `coal_supply_chain`, `events`
- `frequency`: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `event`
- `coal_type`: `thermal`, `coking`, `lignite`, `anthracite`, `other`, `all`, `not_applicable`, `unknown`
- `release_status`: `provisional`, `revised`, `final`, `unknown`
- `extraction_method`: `api`, `csv`, `xlsx`, `html`, `pdf_text`, `pdf_table`, `ocr`, `manual_verified`

Use ISO dates. Represent Indian financial years as `YYYY-YY`, for example `2016-17`. Store raw source units and normalized units. Preferred normalized units are tonnes, million tonnes, MW, MU/GWh, INR crore, USD million, millimetres, percentage, days, and counts.

### 7.2 Dataset-specific measures

#### Production and mine dispatch

Capture, when published:

- raw coal and lignite production
- coking and non-coking production
- opencast and underground production
- company and subsidiary production
- state and mine/block production
- captive/commercial mine production
- target, production, dispatch/offtake
- rail/road/MGR/other dispatch mode
- opening and closing pithead stocks
- overburden removal and output-per-man-shift when consistently available

#### Imports

Capture:

- national import quantity and value
- coking/non-coking/anthracite/lignite/coke category
- HS code and official description
- `reported_partner_country` and `reported_trade_counterparty`
- quantity unit and currency
- final/revised/provisional status
- port of import only when explicitly present in an official record

Never infer mine origin, vessel cargo, discharge port, or end user from country-level customs data.

#### Power use

Capture at the finest official plant/region/sector grain:

- coal receipt
- domestic and imported receipt, when separated
- coal consumption
- generation
- installed/monitored capacity
- PLF
- specific coal consumption, when reported
- generation loss due to coal/fuel shortage
- unit/plant outage and reason
- sector: central, state, private

Also determine where the coal is being used. For every receiving asset and period, capture the official end-use category and, when published, the exact thermal power plant, steel plant, cement plant, captive power plant, sponge-iron plant or other industrial consumer. Use the plant/entity dimension so the usage observation can be joined to plant capacity, generation, PLF, stock and location without name-based duplication.

#### Coal supply chain, grade and blending

Build a traceable coal-flow layer with the finest relationship that an official source can support:

```text
source_mine_or_block
source_coalfield
source_subsidiary_or_company
source_siding_or_loading_point
transport_mode
intermediate_port_or_terminal
destination_plant_or_industry
end_use_sector
coal_type
coal_grade
gcv_min_kcal_kg
gcv_max_kcal_kg
gcv_basis
domestic_quantity_tonnes
imported_quantity_tonnes
total_blend_quantity_tonnes
domestic_blend_pct_mass
imported_blend_pct_mass
linkage_quantity_tonnes
actual_receipt_quantity_tonnes
actual_consumption_quantity_tonnes
relationship_type
valid_from
valid_to
```

`relationship_type` must use one of:

- `contractual_linkage`
- `recommended_linkage`
- `fuel_supply_agreement`
- `captive_mine_allocation`
- `declared_primary_source`
- `actual_dispatch`
- `actual_receipt`
- `actual_consumption`
- `reported_blend`
- `design_assumption`

These relationships are not interchangeable:

- an SLC recommendation, SHAKTI award, LoA, FSA or linkage is an entitlement/contractual source, not proof of delivery;
- a named coal company or subsidiary is not automatically a named mine;
- a design coal source or environmental-clearance assumption is not actual period consumption;
- a plant’s imported-coal receipt is not automatically evidence of blending unless the same official record reports a blend or the calculation uses matching plant-period domestic and imported receipts;
- a mine-to-plant connection may be shown as actual only when an official dispatch, receipt, rail/road movement, plant report or equivalent record explicitly connects both ends.

For every relationship, store:

```text
supply_relationship_id
source_entity_id
destination_entity_id
relationship_type
period_start
period_end
quantity
unit
coal_type
coal_grade
gcv_value_or_band
gcv_basis
transport_mode
source_id
evidence_text_or_table_reference
confidence
```

Use `confidence = confirmed` only for an explicit official connection. Use `official_but_contractual` for a valid allocation/linkage that lacks delivery evidence. Do not create inferred source-mine links in the canonical table.

For blending:

- prefer an officially reported plant-period domestic/imported blend;
- otherwise calculate a mass-based receipt mix only when matching domestic and imported receipt quantities exist for the same plant and period;
- label that value `receipt_mix_pct`, not `burn_blend_pct`;
- do not assume all coal received during a period was burned during that period;
- store ash, moisture, sulphur, volatile matter and GCV only when officially reported and preserve the measurement basis, such as `ARB`, `ADB` or another stated basis;
- preserve Indian coal grade codes and their effective-period GCV bands; do not apply today’s grade mapping retrospectively without checking the applicable official notification;
- if a source states only “CIL coal”, “domestic coal” or “imported coal”, keep that level of detail and leave mine and grade null.

The preferred source trail is:

1. actual plant-period receipt/consumption records from CEA/NPP;
2. actual dispatch/offtake records from CIL subsidiaries, SCCL, NLCIL, captive/commercial mine records or an official transport record;
3. plant/company annual or operational reports for reported source, grade and blending;
4. SLC/LT minutes, SHAKTI awards, LoA/FSA/linkage records for contractual source and quantity;
5. official environmental clearance/EIA/fuel-design documents only for `design_assumption`.

Create a separate `coal_supply_chain.csv`. Never hide a contractual relationship inside the actual-consumption table.

#### Power stocks

Capture:

- actual coal stock quantity
- normative stock requirement
- daily coal requirement/consumption
- officially reported stock days
- critical/supercritical status and reason
- plant count and capacity represented
- imported and domestic stock, when separated

Use the officially reported `stock_days` when available. Derive it only when inventory and a matching daily consumption/requirement measure share the correct date, entity, and unit. Mark derived values with `calculation_method`; never mix a monthly denominator with a daily snapshot without documenting the method.

#### Renewables and power demand

Capture:

- generation by solar, wind, hydro, biomass/bagasse, small hydro and other official categories
- installed capacity where needed as a denominator or explanatory variable
- all-India and regional energy requirement, availability, demand met, peak demand and peak met
- thermal/coal generation and total generation

Keep nuclear separate from renewables.

#### Weather

Capture only official IMD values:

- actual rainfall
- normal rainfall
- departure percentage
- rainfall category
- meteorological subdivision/state/district
- daily, weekly, monthly and monsoon cumulative period
- heatwave/severe heatwave days
- maximum/minimum temperature or anomaly when an official consistent historical series is available
- southwest monsoon onset/withdrawal or phase only when officially published

Do not convert blank rainfall to zero. A reported measured zero and a missing observation are different.

#### Port coal traffic

Capture:

- canonical port name and aliases
- major/non-major classification
- state and coast
- coal, thermal coal, coking coal and combined coal exactly as defined
- traffic quantity and unit
- inward/import, outward/export, coastal or total only when explicitly specified
- monthly and annual periods

Do not describe total coal handled as imported coal unless the official table says it is import/unloaded foreign cargo.

#### Industrial use

Capture official coal/coke use or related output variables for:

- steel and sponge iron
- cement
- captive power
- fertilizer and other official coal-consuming sectors

Keep physical coal consumption separate from production indices or industrial output proxies.

## 8. Entity dimensions

Create stable dimensions for:

- coal companies and subsidiaries
- mines/blocks
- thermal power plants and units
- ports
- states, districts and IMD meteorological subdivisions
- industry sectors
- HS codes and coal categories

Preserve every official name as an alias. Never merge entities using name similarity alone. Confirm merges using official owner, location, plant capacity, mine/block identifier, port authority, or another authoritative identifier.

Create `entity_aliases.csv` with:

```text
entity_id,entity_type,canonical_name,alias_name,source_id,valid_from,valid_to,match_method,match_confidence,review_status
```

## 9. Frequency conversion

Retain the original official frequency. Derived frequency tables must follow these rules:

- daily to weekly: aggregate complete Monday–Sunday or explicitly label another week convention;
- daily to monthly: aggregate by calendar month;
- monthly to quarterly: use Indian fiscal quarters, Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar;
- monthly to yearly: distinguish calendar year from Indian fiscal year;
- flow variables such as production/imports/generation/consumption: sum;
- stock variables such as inventory and stock days: use period-end for operational snapshots and optionally also calculate the period mean as a separate metric;
- rates, PLF, shares and rainfall departures: use a valid weighted method, never a simple sum;
- never manufacture weekly data from monthly values;
- never forward-fill a missing official observation without a clearly labeled imputation table. The canonical master must remain unimputed.

## 10. Coal India Workspace visualization contract

The normalized fact tables are the source of truth, but the scraper must also build derived, display-ready objects for the existing Coal India Workspace. Do not make the browser parse PDFs, discover columns, reconcile revisions or calculate fiscal periods.

### 10.1 General display rules

- Every visible value must carry `period_label`, `period_end`, `unit`, `release_status`, `source_id` and `quality_status`.
- Prefer the latest complete period for headline cards. If only a partial/YTD period is available, show `YTD` or `provisional` visibly.
- Show `Not published` or `Not available` for null values. Never display missing data as zero, `Unknown` or an invented estimate.
- A reported numerical zero may be displayed only when `value = 0` and `missing_reason = null`.
- Keep raw precision in the master data. Supply a `display_value` with sensible rounding for the UI.
- Use consistent normalized units within a comparison chart. Do not combine tonnes, thousand tonnes and million tonnes without conversion.
- Cards, tables, charts and downloads must resolve to the same canonical records and filter state.
- Every card/detail panel must contain a source link or source identifier, source date, observation period, release status and material caveat.
- Use visible badges for `final`, `revised`, `provisional`, `derived`, `contractual only` and `coverage gap`.
- The UI must never describe a contractual linkage as actual supply or an imported receipt mix as a burn blend.

### 10.2 Required display-ready outputs

Add these derived outputs:

```text
data/india_coal_master/ui/
  coal_workspace_facets.json
  coal_workspace_kpis.json
  coal_workspace_charts.json
  coal_asset_cards.json
  coal_asset_table.csv
  coal_dataset_tables.json
  coal_source_notes.json
```

These are reproducible views generated from `india_coal_master.json`; they are not independent sources.

### 10.3 Filter facets

`coal_workspace_facets.json` must expose:

```json
{
  "datasets": [],
  "frequencies": [],
  "coal_types": [],
  "period_presets": ["12m", "3y", "5y", "10y", "all"],
  "fiscal_years": [],
  "states": [],
  "companies": [],
  "mines": [],
  "power_plants": [],
  "industries": [],
  "ports": [],
  "source_entities": [],
  "destination_entities": [],
  "relationship_types": [],
  "release_statuses": []
}
```

Only expose a facet value when at least one canonical record exists for it. Return record counts with every facet. Filters must be combinable and must update map, cards, tables, charts and downloads consistently.

### 10.4 Overview KPI cards

Populate the existing overview cards as follows:

| UI card | Primary metric | Supporting badges/details |
|---|---|---|
| Production | Latest complete-period Indian coal production | YoY change, coal type, period, final/provisional status |
| Seaborne imports | Latest complete-period coal import quantity | YoY change, coking/non-coking mix, period, source status |
| Power use | Coal consumed by monitored coal/lignite power plants | generation, PLF, domestic/imported receipt mix, monitored capacity/coverage |
| Stock cover | Official or validly derived stock days | inventory tonnes, critical/supercritical station count, plant coverage, observation date |
| Import vessels | Show only when an official or supplied voyage/port-call dataset exists | vessel count, cargo quantity, ports and coverage; otherwise use a transparent unavailable state |

Each KPI record must use:

```json
{
  "card_id": "production",
  "label": "Production",
  "metric_code": "...",
  "value": 0,
  "display_value": "0.0 MT",
  "unit": "million_tonnes",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "period_label": "Mon YYYY or FY YYYY-YY",
  "comparison_value": 0,
  "comparison_label": "YoY",
  "comparison_pct": 0,
  "coal_type": "all",
  "release_status": "final",
  "coverage_label": "...",
  "source_id": "...",
  "source_url": "...",
  "quality_status": "pass|warning|blocked",
  "caveat": null
}
```

### 10.5 Analytical chart objects

Populate the existing chart sections with tidy long-form series:

| Existing section | Required series |
|---|---|
| Supply balance — Production vs seaborne imports | period, production MT, imports MT, optional dispatch/offtake MT |
| Power system — Coal burn and stock-cover days | period, coal consumption MT, inventory MT, stock days, generation MU, PLF % |
| Trade flows — Origins, loading ports and discharge ports | only officially supported origin/counterparty, port, direction and quantity; keep reported counterparty separate from mine origin |
| Drivers — Renewables, monsoon and heat | period, renewable generation by type, rainfall actual/normal/departure, heatwave measure and selected coal metric |

Every chart row must contain:

```text
chart_id
period_start
period_end
period_label
series_id
series_label
value
unit
coal_type
geography
entity_id
release_status
source_id
quality_flags
```

Do not place incompatible frequencies in one chart. Tooltips must show exact value, unit, period, geography/entity, release status and source. Missing periods must create visible gaps rather than interpolated lines.

### 10.6 Asset table contract

The existing “India coal asset table” must receive one flattened row per asset and selected reporting period. It must preserve these base fields:

```text
asset_id
asset_name
asset_kind
asset_label
country
state
district
latitude
longitude
operating_status
status_detail
capacity
capacity_unit
expansion_capacity
latest_metric_name
latest_metric_value
latest_metric_unit
latest_metric_period
release_status
source_text
source_url
quality_status
```

Add dataset-specific columns to `coal_dataset_tables.json`:

| Dataset/table | Required visible columns |
|---|---|
| Production | period, company/subsidiary, mine/state, coal type, production, target, dispatch/offtake, closing stock, status, source |
| Imports | period, coal type, HS code, reported partner country, quantity, value, unit, partner-origin warning, release status, source |
| Power use | period, power plant, state, sector, capacity, generation, PLF, domestic receipt, imported receipt, consumption, source |
| Power stocks | observation date, power plant, state, inventory, normative requirement, stock days, criticality, daily requirement, source |
| Renewables | period, state/region, renewable type, generation, installed capacity, share where valid, source |
| Weather | period, IMD subdivision/state, actual rainfall, normal rainfall, departure, category, heatwave measure, source |
| Port coal traffic | period, port, state, major/non-major, coal type, direction, quantity, source |
| Coal supply chain | validity/period, source mine/coalfield/company, destination plant/industry, relationship type, linkage quantity, actual dispatch/receipt/consumption, grade/GCV, transport mode, blend, evidence and source |

Tables must support deterministic sorting, text search, filters, pagination and CSV/XLSX export. The export must contain canonical raw values and provenance columns, not just formatted display text.

### 10.7 Asset card contract

Coal mines remain in map and table views and do not require card-grid tiles. Power plants, coal terminals, dry-bulk ports, steel plants and cement plants may appear in card view.

#### Summary card tile

Each card-grid tile must contain:

```text
asset_id
asset_kind
asset_label
name
state
operating_status
capacity
capacity_unit
latest_metric_label
latest_metric_display_value
latest_metric_period
has_detail
quality_badge
```

#### Power-plant detail card

Structure power-plant records so the existing card can show its current fields and the new coal-use details:

```text
asset_id
name
country
state
district
location
latitude
longitude
status
plant_capacity_mw
unit_count
unit_configuration
commissioning_start_year
commissioning_end_year
owner
parent_company
sector
combustion_technology
coal_type
capacity_factor
annual_co2_mtpa
cea_verified
cea_source_as_of
```

Add a `latest_operational_metrics` object:

```json
{
  "period_label": "...",
  "generation_mu": null,
  "plf_pct": null,
  "coal_receipt_tonnes": null,
  "domestic_receipt_tonnes": null,
  "imported_receipt_tonnes": null,
  "coal_consumption_tonnes": null,
  "coal_stock_tonnes": null,
  "stock_days": null,
  "criticality": null,
  "release_status": "...",
  "source_id": "..."
}
```

Add a `coal_supply` object:

```json
{
  "actual_sources": [
    {
      "mine_id": null,
      "mine_name": null,
      "coalfield": null,
      "supplier_company": null,
      "quantity_tonnes": null,
      "period_label": null,
      "coal_grade": null,
      "gcv_min_kcal_kg": null,
      "gcv_max_kcal_kg": null,
      "gcv_basis": null,
      "transport_mode": null,
      "source_id": null
    }
  ],
  "contractual_linkages": [],
  "domestic_receipt_pct": null,
  "imported_receipt_pct": null,
  "reported_burn_blend_pct": null,
  "calculated_receipt_mix_pct": null,
  "blend_label": "reported burn blend|calculated receipt mix|not published",
  "evidence_level": "confirmed|official_but_contractual|not_available"
}
```

The detail card should present information in this order:

1. identity, location, status and capacity;
2. latest generation, PLF, consumption, stock and stock-cover days;
3. actual coal source/mine where confirmed;
4. supplier company/coalfield and transport mode;
5. grade/GCV and quality basis;
6. domestic/imported mix and clearly labelled blend type;
7. contractual linkages in a separate subsection;
8. official sources, dates, release status and caveats.

Do not show an empty grid of “Unknown” fields. Omit optional rows that are null, then show one concise coverage message explaining which details were not officially published.

#### Port/terminal detail card

Retain the existing port fields:

- official port name, state and port class
- draft, berths, dry-bulk facilities and capacity
- latest port traffic and period
- coal terminal operating and expansion capacity
- berth/facility handling rates and vessel limits
- coal flows by direction and coal type
- official sources and data caveat

Add:

- associated supplying mines/companies only when an official flow record exists;
- associated receiving plants/industries only when officially stated;
- coal grade/GCV handled when officially published;
- flow period, direction, quantity and relationship type;
- `contractual`, `reported traffic` and `actual shipment` labels as separate evidence classes.

### 10.8 Map tooltip and click-card fields

For map points, create a compact tooltip object:

```json
{
  "title": "...",
  "subtitle": "State · operating",
  "capacity_display": "...",
  "latest_metric_display": "...",
  "latest_metric_period": "...",
  "quality_badge": "final|provisional|coverage gap"
}
```

Clicking a power plant, terminal, port, steel plant or cement plant must open its detail-card object. Clicking a mine may open a compact detail panel in map view, but mines remain excluded from the card-grid view as required by the existing interface.

### 10.9 UI query behavior

The backend response must:

- apply dataset, frequency, coal type and period filters before returning KPIs/charts/tables;
- retain selected plant, mine, port, state and relationship filters;
- return a `filter_context` object describing exactly what was applied;
- return `latest_complete_period` separately from `latest_available_period`;
- return a visible `coverage_summary`;
- avoid sending the full 7–10 year master file for every card click;
- use stable `asset_id`, `entity_id`, `metric_code` and `source_id` joins;
- provide bounded result sets and total row counts for tables;
- provide complete filtered data for explicit CSV/XLSX downloads.

The AI completing the acquisition must verify that the generated UI files can fill the existing cards and tables without inventing values or requiring source-specific parsing in JavaScript.

## 11. Required output package

Write outputs relative to the project root:

```text
data/india_coal_master/
  india_coal_master.json
  source_inventory.csv
  data_dictionary.csv
  coverage_manifest.csv
  reconciliation.csv
  entity_aliases.csv
  extraction_log.jsonl
  quality_report.md
  csv/
    production.csv
    imports.csv
    power_use.csv
    power_stocks.csv
    renewables.csv
    weather.csv
    port_coal_traffic.csv
    industrial_use.csv
    power_demand.csv
    mine_dispatch.csv
    coal_prices.csv
    coal_supply_chain.csv
    events.csv
```

Do not create empty fact files merely to imply coverage. If no official records were found for an optional dataset, omit its fact file and record `not_available` with the attempted sources in `coverage_manifest.csv`.

### Master JSON shape

```json
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "coverage": {
    "requested_start": "2016-04-01",
    "latest_observation": "YYYY-MM-DD",
    "dataset_summaries": []
  },
  "dimensions": {
    "entities": [],
    "entity_aliases": [],
    "metrics": [],
    "sources": []
  },
  "datasets": {
    "production": [],
    "imports": [],
    "power_use": [],
    "power_stocks": [],
    "renewables": [],
    "weather": [],
    "port_coal_traffic": [],
    "industrial_use": [],
    "power_demand": [],
    "mine_dispatch": [],
    "coal_prices": [],
    "coal_supply_chain": [],
    "events": []
  },
  "reconciliation": [],
  "quality_summary": {},
  "ui_views": {
    "facets_path": "ui/coal_workspace_facets.json",
    "kpis_path": "ui/coal_workspace_kpis.json",
    "charts_path": "ui/coal_workspace_charts.json",
    "asset_cards_path": "ui/coal_asset_cards.json",
    "asset_table_path": "ui/coal_asset_table.csv",
    "dataset_tables_path": "ui/coal_dataset_tables.json",
    "source_notes_path": "ui/coal_source_notes.json"
  }
}
```

The master JSON is the canonical backend store. CSV files are normalized extracts for application loading, review and download. The app must reference the master/derived files; it must not parse source PDFs during a user request.

## 12. Extraction log and provenance

Write one JSON object per attempted source artifact to `extraction_log.jsonl`:

```json
{
  "run_id": "...",
  "source_id": "...",
  "url": "...",
  "title": "...",
  "published_at": "...",
  "accessed_at": "...",
  "http_status": 200,
  "source_format": "xlsx",
  "sha256": "...",
  "extraction_status": "success|partial|failed|blocked",
  "tables_found": 0,
  "records_written": 0,
  "temporary_file_deleted": true,
  "error": null
}
```

Every fact row must resolve to one `source_id`. A source citation must point to the exact official page or file, not a search-results page.

## 13. Data-quality tests

Run and report at least these checks:

### Completeness

- coverage by dataset, metric, frequency, geography and year
- missing months/days within expected publication schedules
- null rates for required dimensions and measures
- latest-period freshness versus the source’s release calendar

### Uniqueness and grain

- no duplicate `record_id`
- no duplicate canonical facts at dataset + metric + period + geography + entity + coal type + release status
- no mixing of YTD, monthly, quarterly and annual observations
- no plant-total duplication caused by joining unit-level and plant-level records

### Validity

- numeric parsing and unit conversion
- no negative physical production/import/stock values unless the source explicitly defines an adjustment
- valid date ranges and financial-year assignment
- allowed dataset, coal-type, frequency and status values
- reported zero is distinct from missing

### Consistency and reconciliation

- annual total versus sum of official months, allowing for revision/definition differences
- company/subsidiary sum versus all-India total
- actual mine/company dispatch versus plant receipts only where both sides describe the same flow, geography, coal type and period
- coking + non-coking versus total when categories are exhaustive
- domestic + imported receipt versus total receipt
- domestic + imported blend quantity versus total reported blend quantity
- plant receipts, consumption and stock movement using `opening stock + receipts - consumption = closing stock`, allowing for officially documented adjustments and timing differences
- contractual linkage quantity versus actual receipt must be shown as fulfilment/variance and never treated as equality
- plant/region/sector sum versus official all-India power total
- port sum versus official major/non-major/India total
- normalized unit versus original unit

### Temporal checks

- sudden changes in units, schema, entity name or coverage
- provisional periods later revised
- historical backfills
- unreasonable discontinuities requiring a source-note review
- TradeStat HS-code/unit/classification changes

Assign each unresolved issue a severity of `critical`, `high`, `medium`, or `low`, plus the affected period and downstream analytical risk.

## 14. Analysis-ready derived views

After the canonical data passes quality checks, create documented derived views for:

- monthly coal production versus imports
- year-on-year monthly production and imports
- rolling 3-, 6- and 12-month totals/averages
- domestic production, dispatch, imports and power consumption balance
- coal generation and PLF
- power-plant coal inventory and stock cover in days
- critical/supercritical plant count and capacity
- coal-port traffic by port, coast and coal type
- production/import relationships with renewable generation
- production/import/use relationships with IMD rainfall and heat
- plant-level source mix: mine/coalfield/company to consuming plant or industry
- plant-level domestic/imported receipt mix and officially reported coal blend
- grade/GCV mix versus coal consumption, generation, PLF and specific coal consumption where comparable
- linkage/FSA quantity versus actual receipt and consumption
- correlations at lags of 0–6 months where the source frequency and coverage support them

Rules:

- compare like-for-like periods;
- align monthly data by period end and Indian fiscal-year conventions;
- show sample count and missing-period coverage for every correlation;
- preserve both raw and seasonally comparable/YoY views;
- label correlation as association, not causation;
- do not calculate a relationship from fewer than 24 monthly paired observations without a visible insufficiency warning;
- create event flags only from an official dated source and cite it.

## 15. Minimum acceptance criteria

The acquisition is complete only when:

1. annual production and import series cover at least FY 2016–17 through the latest complete official year;
2. monthly production and import coverage is collected for every period available in the official archive, with gaps listed;
3. power generation/use and coal-stock series use the maximum historical CEA/NPP archive that can be accessed legitimately;
4. annual and monthly port coal traffic is collected for the available official period;
5. renewable and IMD variables provide enough overlapping monthly coverage for meaningful analysis, or the limitation is documented;
6. all canonical observations have an official source and a defined unit;
7. provisional, revised and final releases are distinguishable;
8. missing values were not converted to zero;
9. all material conflicts were reconciled or explicitly left unresolved;
10. no PDF exists in the delivered project or data package;
11. the master JSON validates and each non-empty CSV has consistent columns;
12. `quality_report.md` states what is safe to analyze and what is not;
13. plant-use records identify the consuming plant/industry wherever the official source provides it;
14. contractual linkage, actual dispatch, actual receipt, actual consumption and reported blending are stored as different relationship types;
15. unavailable mine, grade or blend detail remains null and is not inferred from company, geography or contract alone;
16. generated UI views populate the existing KPI cards, charts, asset cards and tables using the same filtered canonical records and show provenance/status.

## 16. Run behavior

- Work in resumable batches by source and period.
- Checkpoint normalized JSON/CSV after each successful batch.
- Use polite request rates and retry with bounded exponential backoff.
- Cache only normalized records and source metadata, not PDFs.
- If interrupted, resume from `extraction_log.jsonl` without duplicating records.
- If a source becomes temporarily unavailable, mark it `blocked` or `failed`, continue elsewhere, and retry later.
- Never guess values to finish a table.

At the end, return:

1. a concise run summary;
2. file paths;
3. record counts and date coverage by dataset;
4. official sources used;
5. unresolved gaps/conflicts;
6. confirmation that no PDFs were retained;
7. the five highest-risk quality findings;
8. recommended next ingestion/update schedule for each source.

# COPY-READY PROMPT — END

## Reviewer checklist

Before approving this prompt, confirm:

- [ ] FY 2016–17 is the correct historical start.
- [ ] Provisional latest data may be shown when visibly labeled.
- [ ] Partner country is accepted as a reported trade counterparty, not mine origin.
- [ ] The extended datasets are wanted in addition to the six current filters.
- [ ] JSON is the canonical backend master and CSV is the download/review format.
- [ ] No PDF may remain after extraction.
- [ ] Missing data must remain null/blank, never zero.
- [ ] Correlations will be described as associations unless causality is separately established.
- [ ] Contractual coal linkage will be displayed separately from actual coal delivered or consumed.
- [ ] Mine, grade/GCV and blend percentages will be shown only where official evidence supports that level of detail.
- [ ] Display-ready views must populate the existing cards, tables, charts and map tooltips without browser-side source parsing.
- [ ] A partial but fully documented official series is preferable to a fabricated complete series.
