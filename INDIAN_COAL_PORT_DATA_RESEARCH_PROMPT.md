# Indian Coal Port Asset-Card Data Research Prompt

Use this prompt with Codex, another research agent, or a human data researcher. The objective is to fill only the missing or outdated fields in the existing India coal-port dataset without inventing values or changing the app's stable asset identifiers.

## Copy-paste research prompt

You are a maritime infrastructure data researcher. Research and return verified, import-ready operating specifications for Indian ports and terminals that handle coal or other dry-bulk cargo.

The results will update an existing dashboard dataset named `india_coal_port_specs.json`. Treat the current dataset as the master list. Do not create duplicate ports, rename asset IDs, overwrite verified values with weaker sources, or convert unknown values to zero.

### Research scope

Research these existing operating port cards:

1. Bedi Port
2. Cochin Port
3. Dahej Port
4. Dhamra Port
5. Gangavaram Port
6. Hazira Port (Essar)
7. JSW Dharamtar Port
8. Jaigarh Port
9. Kakinada Port
10. Karaikal Port
11. Kattupalli Port
12. Kolkata Dock System Coal Terminal
13. Krishnapatnam Port
14. Magadalla Port
15. Mormugao Port
16. Muldwarka Port
17. Mundra Port
18. Navlakhi Port
19. New Mangalore Port
20. Okha Port
21. Paradip Port
22. Pipavav Port
23. Porbandar Port
24. Salaya Port
25. Sikka Port
26. Trombay Port
27. Tuna Tekra Port
28. Tuticorin Port
29. Visakhapatnam Port
30. Haldia Port
31. Kamarajar Port

Prioritize the following known gaps:

- Missing dry-bulk or coal-relevant documented draft: Bedi, Dahej, Dhamra, Gangavaram, Hazira, Dharamtar, Karaikal, Kattupalli, Krishnapatnam, Magadalla, Muldwarka, Mundra, Navlakhi, Okha, Pipavav, Porbandar, Salaya, Sikka, Trombay and Tuna Tekra.
- Missing documented berth count: Bedi, Dahej, Dhamra, Gangavaram, Hazira, Karaikal, Kattupalli, Krishnapatnam, Magadalla, Muldwarka, Mundra, Navlakhi, Okha, Pipavav, Porbandar, Salaya, Sikka, Trombay and Tuna Tekra.
- Missing port capacity: Bedi, Kakinada, Magadalla, Muldwarka, Navlakhi, Okha, Pipavav, Porbandar, Salaya, Sikka and Trombay.
- Missing berth/facility-level records: Bedi, Dahej, Dhamra, Gangavaram, Hazira, Dharamtar, Jaigarh, Kakinada, Karaikal, Kattupalli, Krishnapatnam, Magadalla, Muldwarka, Mundra, Navlakhi, Okha, Pipavav, Porbandar, Salaya, Sikka, Trombay and Tuna Tekra.
- Missing port-level dry-bulk commodity flows: Bedi, Dahej, Dhamra, Gangavaram, Hazira, Dharamtar, Jaigarh, Kakinada, Karaikal, Kattupalli, Magadalla, Muldwarka, Mundra, Navlakhi, Okha, Pipavav, Porbandar, Salaya, Sikka and Trombay.

An expansion value being empty does not prove that an expansion exists. Record expansion only when a current authoritative source explicitly states the incremental capacity, project status and expected commissioning date.

### Authoritative source order

Do not limit research to Indian port websites, Indian government domains or India-based publications. Search globally. Data may be used from any official or reputable domestic or international source when it clearly refers to the correct Indian port, terminal and reporting period and provides traceable evidence for the field being collected.

Use sources in this order:

1. Current official port or terminal marine documents:
   - Port Information Booklet
   - monthly or current Draft Declaration
   - berth specification page
   - berthing policy
   - Scale of Rates or Berthing Policy and Tariff Structure
   - harbour master circular
   - terminal information booklet
   - current berth or vessel schedule when it identifies active berths
2. The port authority, maritime board, terminal owner or operator website and its current annual report, investor filing or stock-exchange disclosure.
3. Ministry of Ports, Shipping and Waterways, particularly the latest *Basic Port Statistics of India* and monthly cargo publications.
4. Indian Ports Association publications or dashboards.
5. State maritime boards, especially Gujarat Maritime Board for Bedi, Magadalla, Muldwarka, Navlakhi, Okha, Porbandar, Salaya and Sikka.
6. Official international and foreign-government sources, including hydrographic offices, customs authorities, trade ministries, maritime administrations and embassy or trade-agency reports, when they directly document the Indian port or terminal.
7. Stock-exchange filings, audited annual reports, lender disclosures, bond documents and official investor presentations issued by the port owner, terminal operator, concessionaire, captive user or its listed parent company.
8. Multilateral and bilateral development institutions such as the World Bank, International Finance Corporation, Asian Development Bank, Asian Infrastructure Investment Bank, Japan International Cooperation Agency and other official export-credit or development-finance institutions. Use their appraisal, due-diligence and completion documents when the scope and date are clear.
9. International maritime organisations, recognised hydrographic publications, classification societies and protection-and-indemnity or navigation circulars when they provide attributable port particulars. Distinguish charted depth from permissible draft and verify time-sensitive operating limits with a newer port or harbour-master source whenever possible.
10. Environmental-clearance, concession, court, regulator or project documents from an official portal, but only for the field their evidence supports. A design document may support project scope or planned capacity but does not, by itself, prove current operating status or permissible navigational draft.
11. Reputable specialist maritime, engineering, commodity or financial research sources when no primary source is accessible. Prefer sources with a named publisher, methodology, publication date and direct document link. Mark these records `secondary` and retain any uncertainty.

Country of publication is not a quality criterion. Authority, relevance to the exact facility, recency, methodology and traceability determine whether the source can be used.

Do not use Wikipedia, anonymous blogs, generic port directories, AI-generated summaries, search-result snippets, unattributed social-media posts, user-edited databases, MarineTraffic or commercial aggregators as the final evidence for a specification. These may be used only to discover a lead that is then verified through a citable source. A paid reputable database may be used only when its licence permits this use, its methodology and observation date are available, and the record is labelled with the database name and access limitations.

Start with these official source collections:

- Ministry Basic Port Statistics and historical publications:  
  `https://shipmin.gov.in/en/publication/trw-publication`
- Basic Port Statistics of India 2024-25 landing page:  
  `https://shipmin.gov.in/en/content/basic-port-statistics-india-2024-25`
- Adani Ports network:  
  `https://www.adaniports.com/Home/Ports-and-Terminals`
- Adani port-specific download centres, for example Mundra:  
  `https://www.adaniports.com/ports-and-terminals/mundra-port/download`
- Dhamra official downloads:  
  `https://www.adaniports.com/Ports-and-Terminals/dhamra-port/Download`
- Gujarat Maritime Board:  
  `https://gmbports.org/gmb-owned-ports`
- Gujarat Maritime Board private jetties:  
  `https://gmbports.org/private-jetties`
- Paradip berth specifications:  
  `https://paradipport.gov.in/berth-specifications/`
- JSW Infrastructure and its official port disclosures:  
  `https://www.jsw.in/jsw-infrastructure/`
- Kakinada Sea Ports official site:  
  `https://kakinadaseaports.in/`
- APM Terminals Pipavav official site:  
  `https://www.apmterminals.com/en/pipavav`
- Mumbai Port Authority for Trombay facilities:  
  `https://www.mumbaiport.gov.in/`

Search within each official site for the port name plus: `port information booklet`, `draft declaration`, `berth`, `terminal`, `marine`, `tariff`, `BPTS`, `capacity`, `coal`, `dry bulk`, `annual report`, `cargo statistics`, `expansion`, and `environment clearance`.

Also search international sources using the official port name, common aliases, terminal operator and UN/LOCODE together with terms such as `terminal particulars`, `port limits`, `maximum permissible draft`, `berth characteristics`, `due diligence`, `project appraisal`, `lender presentation`, `bond prospectus`, `hydrographic`, `sailing directions`, `coal terminal capacity`, and `commodity throughput`. An international source must still be matched to the correct physical facility; a reference to the port group, city, anchorage or neighbouring terminal is not sufficient.

### What to collect

#### A. Port-level fields

Collect one record per existing asset:

- `asset_id`: preserve the current value exactly.
- `asset_name`: preserve the dashboard name exactly.
- `official_port_name`
- `state_ut`
- `coast`: `East` or `West`
- `port_class`: `Major` or `Non-major`
- `operating_status`
- `latitude`
- `longitude`
- `official_website`: direct official port or terminal page, not a search result.
- `source_as_of`: ISO date `YYYY-MM-DD`.
- `max_documented_draft_m`
- `documented_berth_count`
- `documented_dry_bulk_berth_count`
- `port_capacity_mtpa`
- `latest_traffic_mt`
- `latest_traffic_period`: use `YYYY-YY` for an Indian financial year.
- `latest_traffic_scope`
- `terminal_operating_capacity_mtpa`
- `terminal_expansion_capacity_mtpa`
- `expansion_status`: `under_construction`, `proposed`, or `null`.
- `expansion_expected_commissioning_date`: ISO date, year, or `null`.
- `specification_note`
- `data_caveat`

#### B. Berth and terminal facilities

Create one record per physical berth, jetty, SBM, mooring or named terminal:

- `facility_id`: stable slug based on `asset_id` and facility name.
- `asset_id`
- `name`: official berth or facility name.
- `terminal_name`
- `facility_type`: `berth`, `jetty`, `mooring`, `anchorage`, `barge_jetty`, `SBM`, or `other`.
- `operating_status`: `operating`, `under_construction`, `proposed`, or `unknown`.
- `cargo_types`: list using normalized values such as `thermal_coal`, `coking_coal`, `iron_ore`, `limestone`, `fertiliser`, `cement`, `clinker`, `other_dry_bulk`, `liquid_bulk`, `container`, and `general_cargo`.
- `coal_relevant`: Boolean.
- `dry_bulk_relevant`: Boolean.
- `import_export_role`: `loading`, `discharge`, `both`, or `unknown`.
- `draft_m`
- `draft_type`: `permissible`, `declared`, `charted`, `design`, or `unknown`.
- `draft_conditions`: tide, season, density, dredging, vessel-size or harbour-master restrictions.
- `quay_length_m`
- `max_loa_m`
- `max_beam_m`
- `max_dwt`
- `annual_capacity_mtpa`
- `loading_rate_tph`
- `unloading_rate_tph`
- `storage_capacity_tonnes`
- `handling_system`
- `rail_connectivity`
- `road_connectivity`
- `anchorage_available`
- `latitude`
- `longitude`
- `operator`
- `as_of`
- `source_id`
- `source_page_or_table`
- `source_note`

#### C. Dry-bulk commodity flows

Return separate rows rather than combining unlike flows:

- `asset_id`
- `port_name`
- `period`
- `period_type`: `month`, `quarter`, or `financial_year`.
- `commodity`: normalized commodity name.
- `trade_direction`: `import`, `export`, `coastal_in`, `coastal_out`, `loaded`, `discharged`, or `total`.
- `quantity_mt`
- `source_id`
- `source_page_or_table`
- `as_of`

Do not label total cargo as coal. Do not combine thermal coal, coking coal and other coal unless the source provides only a combined coal figure. If only combined coal is available, use `coal_total` and say so in `source_note`.

#### D. Optional image references

The app already generates three satellite-context views from coordinates. Only collect additional port images when their reuse is clearly permitted:

- `asset_id`
- `image_url`: direct stable official image URL.
- `image_type`: `terminal_photo`, `berth_plan`, `port_map`, or `aerial`.
- `caption`
- `source_url`
- `license_or_permission`
- `as_of`

Do not copy images from Google Maps, news sites or copyrighted commercial platforms. Do not embed image binaries in the data file.

### Critical interpretation rules

1. Never infer a value. Use `null` when the source does not publish it.
2. Never convert `null`, blank, `N/A`, `not reported` or `not classified` to zero.
3. `max_documented_draft_m` must be the maximum current documented draft applicable to an **operating coal or dry-bulk berth**. Do not use an oil SBM, LNG berth, container-only berth or approach-channel design depth.
4. If the source provides several berth drafts, retain every berth row. Derive the port-level maximum only from operating dry-bulk-relevant facilities.
5. Distinguish draft from depth. Do not treat channel depth, charted depth or dredged depth as permissible vessel draft unless the source explicitly does so.
6. A range such as `8.84–9.14 m` must remain a range in the facility note. Use the conservative value in `draft_m` only if the schema requires a single number, and state the transformation.
7. Record berth count from a dated source. Explain whether it includes oil berths, moorings, barge facilities and captive jetties.
8. A port handling cargo is `operating`, even if it also has an expansion. Store the expansion separately.
9. Do not mark an entire operating port `under_construction` merely because one terminal or berth is being expanded.
10. Exclude retired, abandoned, cancelled, shelved and non-operational facilities from operating totals. They may be returned only in a separate exceptions table.
11. Port capacity, terminal capacity and commodity-specific capacity are different measures. Keep their scopes separate.
12. Traffic is throughput, not capacity. Never substitute one for the other.
13. Use metric tonnes. Store traffic in million tonnes (`MT`) and capacity in million tonnes per annum (`MTPA`).
14. Use ISO dates. If only a month is given, use the final day of that month only when explicitly described as a reporting-month end; otherwise retain the published date as text in the note.
15. Preserve conflicting values in the evidence sheet. Select the preferred value using source authority and recency, and explain the decision.
16. Record the direct document URL, document title, publication date, effective date, page/table number and a short evidence excerpt for every populated specification.
17. A search-engine result or AI-generated statement is not evidence.

### Required source register

Create a source record for every document used:

- `source_id`: unique stable ID such as `mundra-draft-declaration-2026-07`.
- `asset_id`
- `title`
- `publisher`
- `url`
- `document_type`
- `publication_date`
- `effective_date`
- `accessed_date`
- `page_or_table`
- `scope`
- `source_tier`: `official_port`, `official_company`, `government`, `foreign_government`, `maritime_board`, `multilateral`, `hydrographic`, `classification_society`, `regulated_filing`, or `secondary`.
- `source_country`
- `source_scope`: `domestic`, `international`, or `multilateral`.
- `evidence_excerpt`: short exact passage or table-cell description supporting the value.
- `archived_file_name`: local file name if the PDF/XLSX was downloaded.

### Required delivery format

Deliver both an Excel workbook and a JSON patch.

#### Excel workbook

File name:

`Indian_Coal_Port_Specifications_Update_YYYY-MM-DD.xlsx`

Sheets:

1. `Port Updates` — one row per `asset_id`.
2. `Berth Facilities` — one row per facility.
3. `Commodity Flows` — one row per port, period, commodity and direction.
4. `Sources` — one row per source document.
5. `Conflicts and Gaps` — unresolved conflicts, inaccessible documents and remaining missing fields.

Formatting rules:

- Use the exact column names defined above.
- Use real numeric cells, not numbers stored as text.
- Use `YYYY-MM-DD` dates.
- Use blank cells for missing values in Excel and `null` in JSON.
- Use `TRUE`/`FALSE` for Boolean fields.
- Use one fact per column and one observation per row.
- Do not merge cells.
- Do not put units in numeric cells; units belong in the column name.
- Freeze the header row and enable filters.

#### JSON patch

Return this structure:

```json
{
  "dataset": "India coal-port specification research update",
  "generated_on": "YYYY-MM-DD",
  "ports": [
    {
      "asset_id": "india-coal-terminal-example-port",
      "asset_name": "Example Port",
      "official_port_name": "Official Example Port Name",
      "source_as_of": "YYYY-MM-DD",
      "max_documented_draft_m": 14.5,
      "documented_berth_count": 6,
      "documented_dry_bulk_berth_count": 3,
      "port_capacity_mtpa": 40.0,
      "terminal_operating_capacity_mtpa": 20.0,
      "terminal_expansion_capacity_mtpa": null,
      "specification_note": "Port-level maximum derived only from three operating dry-bulk berths."
    }
  ],
  "berth_facilities": [
    {
      "facility_id": "india-coal-terminal-example-port-coal-berth-1",
      "asset_id": "india-coal-terminal-example-port",
      "name": "Coal Berth 1",
      "facility_type": "berth",
      "operating_status": "operating",
      "cargo_types": ["thermal_coal", "coking_coal"],
      "coal_relevant": true,
      "dry_bulk_relevant": true,
      "import_export_role": "discharge",
      "draft_m": 14.5,
      "draft_type": "permissible",
      "draft_conditions": null,
      "quay_length_m": 300,
      "max_loa_m": null,
      "max_beam_m": null,
      "max_dwt": 75000,
      "annual_capacity_mtpa": 10.0,
      "loading_rate_tph": null,
      "unloading_rate_tph": 4000,
      "storage_capacity_tonnes": null,
      "handling_system": "Mechanised ship unloader and conveyor",
      "rail_connectivity": true,
      "road_connectivity": true,
      "anchorage_available": null,
      "operator": "Example Port Authority",
      "as_of": "YYYY-MM-DD",
      "source_id": "example-port-information-booklet-2026",
      "source_page_or_table": "Page 18, Berth Particulars",
      "source_note": "Current operating berth specification."
    }
  ],
  "commodity_flows": [
    {
      "asset_id": "india-coal-terminal-example-port",
      "port_name": "Example Port",
      "period": "2025-26",
      "period_type": "financial_year",
      "commodity": "thermal_coal",
      "trade_direction": "import",
      "quantity_mt": 8.25,
      "source_id": "example-port-annual-report-2025-26",
      "source_page_or_table": "Cargo table 4",
      "as_of": "2026-03-31"
    }
  ],
  "sources": [
    {
      "source_id": "example-port-information-booklet-2026",
      "asset_id": "india-coal-terminal-example-port",
      "title": "Port Information Booklet",
      "publisher": "Example Port Authority",
      "url": "https://official.example/document.pdf",
      "document_type": "port_information_booklet",
      "publication_date": "2026-01-10",
      "effective_date": "2026-01-10",
      "accessed_date": "YYYY-MM-DD",
      "page_or_table": "Page 18",
      "scope": "Operating berth and marine specifications",
      "source_tier": "official_port",
      "source_country": "India",
      "source_scope": "domestic",
      "evidence_excerpt": "Coal Berth 1: permissible draft 14.5 m.",
      "archived_file_name": "example_port_information_booklet_2026.pdf"
    }
  ],
  "conflicts_and_gaps": [
    {
      "asset_id": "india-coal-terminal-example-port",
      "field": "max_documented_draft_m",
      "status": "resolved",
      "preferred_value": 14.5,
      "alternative_value": 14.0,
      "decision": "Used the newer official draft declaration; retained the older booklet value as historical evidence."
    }
  ]
}
```

### Final quality-control report

At the end, report:

- ports researched;
- ports with a verified operating dry-bulk draft;
- ports with a verified berth count;
- ports with berth-level records;
- ports with verified port capacity;
- ports with commodity and direction-level traffic;
- remaining missing fields by port;
- conflicts resolved and unresolved;
- inaccessible or blocked official sources;
- any value sourced only from secondary evidence.

Do not claim completion merely because all ports were searched. Completion means that each populated value has traceable evidence and every unresolved field remains explicitly `null`.

## Integration note

The dashboard's current consolidated data file is:

`data/india_coal_port_specs.json`

The stable join key is `asset_id`. The update should be merged field-by-field, with current values retained unless the new record has a more authoritative or more recent source. Berth facilities and commodity flows should be appended or replaced using their compound identity (`asset_id` plus facility name, or `asset_id` plus period, commodity and trade direction).
