"""Build the reviewed major iron-ore terminal map layer.

This catalogue is intentionally conservative: it identifies major loading,
discharge and transshipment facilities supported by global institutional or
port/operator sources. It is not a live vessel-flow feed or an exhaustive list
of every berth capable of handling iron ore.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "iron_ore_terminals.csv.gz"

UNCTAD = "https://unctad.org/system/files/official-document/rmt2018ch4_en.pdf"
OECD = (
    "https://www.oecd.org/content/dam/oecd/en/publications/reports/2012/09/"
    "efficiency-of-world-ports-in-container-and-bulk-cargo-oil-coal-ores-and-"
    "grain_g17a219f/5k92vgw39zs2-en.pdf"
)


def terminal(
    asset_id: str,
    name: str,
    country: str,
    lat: float,
    lon: float,
    role: str,
    parent_port: str,
    source_text: str,
    source_url: str,
    evidence_level: str = "Institutional",
) -> dict:
    return {
        "asset_id": asset_id,
        "name": name,
        "unit": "",
        "status": "Operating",
        "capacity": None,
        "capacity_unit": "Mtpa",
        "lat": lat,
        "lon": lon,
        "country": country,
        "layer": "iron_ore_terminals",
        "asset_type": role,
        "parent_port": parent_port,
        "product_type": "Iron ore",
        "source_text": source_text,
        "source_url": source_url,
        "source_date": "Reviewed 2026-07-28",
        "evidence_level": evidence_level,
        "coverage_note": "Major-terminal catalogue; not exhaustive",
    }


ROWS = [
    # Major seaborne loading terminals.
    terminal("IOT-AU-PHE", "Port Hedland iron ore terminals", "Australia", -20.313, 118.575, "Exports", "Port Hedland", "UNCTAD Review of Maritime Transport; Pilbara Ports", "https://www.pilbaraports.com.au/ports/port-of-port-hedland"),
    terminal("IOT-AU-CLA", "Cape Lambert terminals", "Australia", -20.594, 117.195, "Exports", "Port Walcott", "UNCTAD Review of Maritime Transport; Rio Tinto", "https://www.riotinto.com/en/operations/australia/pilbara"),
    terminal("IOT-AU-DAM", "Dampier iron ore terminals", "Australia", -20.62, 116.74, "Exports", "Dampier", "UNCTAD Review of Maritime Transport; Pilbara Ports", "https://www.pilbaraports.com.au/ports/port-of-dampier"),
    terminal("IOT-AU-PLA", "Port Latta terminal", "Australia", -40.856, 145.393, "Exports", "Port Latta", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-BR-PDM", "Ponta da Madeira Maritime Terminal", "Brazil", -2.565, -44.37, "Exports", "Itaqui / São Luís", "UNCTAD Review of Maritime Transport; Vale", "https://www.vale.com/w/logistics"),
    terminal("IOT-BR-TUB", "Tubarão terminal", "Brazil", -20.288, -40.239, "Exports", "Vitória", "UNCTAD Review of Maritime Transport; Vale", "https://www.vale.com/w/logistics"),
    terminal("IOT-BR-SEP", "Itaguaí / Sepetiba iron ore terminal", "Brazil", -22.93, -43.84, "Exports", "Itaguaí", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-BR-UBU", "Ponta Ubu terminal", "Brazil", -20.78, -40.57, "Exports", "Anchieta", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-BR-ACU", "Açu iron ore terminal", "Brazil", -21.815, -41.0, "Exports", "Port of Açu", "Port of Açu", "https://portodoacu.com.br/en/port-of-acu/"),
    terminal("IOT-ZA-SAL", "Saldanha Iron Ore Terminal", "South Africa", -33.026, 17.955, "Exports", "Saldanha Bay", "Transnet Port Terminals", "https://www.transnetportterminals.net/Ports/Pages/Saldanha_Multi.aspx", "Primary"),
    terminal("IOT-MR-NOU", "Nouadhibou mineral terminal", "Mauritania", 20.91, -17.06, "Exports", "Nouadhibou", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-CA-PCQ", "Port-Cartier iron ore terminal", "Canada", 50.03, -66.79, "Exports", "Port-Cartier", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-CA-SEI", "Sept-Îles iron ore terminals", "Canada", 50.2, -66.38, "Exports", "Sept-Îles", "Port of Sept-Îles", "https://www.portsi.com/"),
    terminal("IOT-NO-NAR", "Narvik ore terminal", "Norway", 68.43, 17.42, "Exports", "Narvik", "Port of Narvik", "https://www.narvikhavn.no/en/"),
    terminal("IOT-SE-LUL", "Luleå ore terminal", "Sweden", 65.55, 22.16, "Exports", "Luleå", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-CL-HUA", "Guacolda II iron ore terminal", "Chile", -28.47, -71.25, "Exports", "Huasco", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-PE-SNI", "San Nicolás iron ore terminal", "Peru", -15.25, -75.24, "Exports", "San Nicolás", "UNCTAD Review of Maritime Transport", UNCTAD),
    terminal("IOT-IN-PAR", "Paradip iron ore berths", "India", 20.264, 86.696, "Imports / Exports", "Paradip", "UNCTAD Review of Maritime Transport; Paradip Port Authority", "https://paradipport.gov.in/"),
    terminal("IOT-IN-MOR", "Mormugao ore terminal", "India", 15.407, 73.8, "Exports", "Mormugao", "UNCTAD Review of Maritime Transport; Mormugao Port Authority", "https://mptgoa.gov.in/"),
    terminal("IOT-IN-NMP", "New Mangalore iron ore facilities", "India", 12.94, 74.81, "Imports / Exports", "New Mangalore", "UNCTAD Review of Maritime Transport; New Mangalore Port Authority", "https://newmangaloreport.gov.in/"),
    terminal("IOT-IN-VIZ", "Visakhapatnam ore handling complex", "India", 17.69, 83.29, "Imports / Exports", "Visakhapatnam", "Visakhapatnam Port Authority", "https://vpt.shipping.gov.in/"),
    # Major discharge and steel-supply gateways.
    terminal("IOT-NL-EMO", "EMO / HBTR iron ore terminal", "Netherlands", 51.95, 4.04, "Imports / Transshipment", "Rotterdam", "Port of Rotterdam", "https://www.portofrotterdam.com/en/logistics/cargo/dry-bulk/iron-ore", "Primary"),
    terminal("IOT-NL-EEC", "EECV iron ore terminal", "Netherlands", 51.94, 4.16, "Imports", "Rotterdam", "Port of Rotterdam", "https://www.portofrotterdam.com/en/logistics/cargo/dry-bulk/iron-ore", "Primary"),
    terminal("IOT-DE-HAN", "Hansaport bulk terminal", "Germany", 53.51, 9.91, "Imports", "Hamburg", "OECD bulk-terminal study", OECD),
    terminal("IOT-FR-DUN", "Dunkerque ore terminal", "France", 51.02, 2.22, "Imports", "Dunkerque", "OECD bulk-terminal study", OECD),
    terminal("IOT-IT-TAR", "Taranto iron ore terminal", "Italy", 40.48, 17.19, "Imports", "Taranto", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-DON", "Dongjiakou ore terminal", "China", 35.61, 119.78, "Imports", "Qingdao", "OECD bulk-terminal study; Qingdao Port", OECD),
    terminal("IOT-CN-RIZ", "Rizhao / Lanshan ore terminals", "China", 35.35, 119.53, "Imports", "Rizhao", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-CAO", "Caofeidian ore terminals", "China", 38.93, 118.51, "Imports", "Tangshan / Caofeidian", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-MAJ", "Majishan ore terminal", "China", 30.64, 122.45, "Imports", "Ningbo-Zhoushan", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-DAL", "Dalian ore terminal", "China", 38.94, 121.8, "Imports", "Dalian", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-TIA", "Tianjin ore terminal", "China", 38.98, 117.79, "Imports", "Tianjin", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-ZHA", "Zhanjiang ore terminal", "China", 21.16, 110.42, "Imports", "Zhanjiang", "OECD bulk-terminal study", OECD),
    terminal("IOT-CN-FAN", "Fangcheng ore terminal", "China", 21.58, 108.35, "Imports", "Fangcheng", "OECD bulk-terminal study", OECD),
    terminal("IOT-JP-KAS", "Kashima raw-material terminal", "Japan", 35.94, 140.69, "Imports", "Kashima", "OECD bulk-terminal study", OECD),
    terminal("IOT-JP-OIT", "Oita raw-material terminal", "Japan", 33.27, 131.69, "Imports", "Oita", "OECD bulk-terminal study", OECD),
    terminal("IOT-JP-FUK", "Fukuyama raw-material terminal", "Japan", 34.45, 133.43, "Imports", "Fukuyama", "OECD bulk-terminal study", OECD),
    terminal("IOT-JP-KIM", "Kimitsu raw-material terminal", "Japan", 35.35, 139.83, "Imports", "Kimitsu", "OECD bulk-terminal study", OECD),
    terminal("IOT-KR-POH", "Pohang raw-material terminal", "South Korea", 36.03, 129.4, "Imports", "Pohang", "OECD bulk-terminal study", OECD),
    terminal("IOT-KR-GWA", "Gwangyang raw-material terminal", "South Korea", 34.9, 127.73, "Imports", "Gwangyang", "OECD bulk-terminal study", OECD),
    terminal("IOT-MY-TLR", "Teluk Rubiah Maritime Terminal", "Malaysia", 4.19, 100.6, "Imports / Exports / Transshipment", "Lumut", "Vale logistics", "https://www.vale.com/w/logistics"),
    terminal("IOT-OM-SOH", "Sohar iron ore terminal", "Oman", 24.5, 56.64, "Imports", "Sohar", "SOHAR Port and Freezone", "https://soharportandfreezone.com/"),
    terminal("IOT-IN-GAN", "Gangavaram iron ore facilities", "India", 17.62, 83.23, "Imports / Exports", "Gangavaram", "Gangavaram Port", "https://gangavaram.com/"),
    terminal("IOT-IN-DHA", "Dhamra iron ore facilities", "India", 20.82, 86.96, "Imports / Exports", "Dhamra", "Dhamra Port", "https://www.adaniports.com/ports-and-terminals/dhamra-port"),
    terminal("IOT-IN-KRI", "Krishnapatnam iron ore facilities", "India", 14.25, 80.13, "Imports / Exports", "Krishnapatnam", "Krishnapatnam Port", "https://www.adaniports.com/ports-and-terminals/krishnapatnam-port"),
    terminal("IOT-TW-KAO", "Kaohsiung ore terminal", "Taiwan", 22.55, 120.29, "Imports", "Kaohsiung", "OECD bulk-terminal study", OECD),
]


def main() -> None:
    frame = pd.DataFrame(ROWS)
    frame.to_csv(OUTPUT, index=False, compression="gzip")
    print(f"Wrote {len(frame)} reviewed terminals to {OUTPUT}")


if __name__ == "__main__":
    main()
