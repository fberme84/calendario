
#!/usr/bin/env python3
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
TIMEOUT = 30
USER_AGENT = "CC-Mejorada-Updater/1.1"
CATEGORY_MAP = {
    "PROMESAS": "promesa_masculino",
    "PROMESAS FEM.": "promesa_femenino",
    "PRICIPIANTES": "principiante_masculino",
    "PRICIPIANTES FEM": "principiante_femenino",
    "ALEVIN": "alevin_masculino",
    "ALEVIN FEM.": "alevin_femenino",
    "INFANTIL": "infantil_masculino",
    "INFANTIL FEM.": "infantil_femenino",
}
DEFAULT_CATEGORY_KEYS = [
    "promesa_masculino", "promesa_femenino", "principiante_masculino", "principiante_femenino",
    "alevin_masculino", "alevin_femenino", "infantil_masculino", "infantil_femenino"
]


def normalize_text(value: str) -> str:
    value = (value or "").replace(" ", " ").strip().upper()
    value = "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value)


def title_case_name(value: str) -> str:
    return " ".join(part.capitalize() if part.isupper() else part for part in value.split())


def is_http_ok(url: str) -> bool:
    if not url:
        return False
    try:
        response = requests.get(url, timeout=TIMEOUT, allow_redirects=True, headers={"User-Agent": USER_AGENT})
        return 200 <= response.status_code < 400
    except requests.RequestException:
        return False


def fetch_text(url: str) -> str:
    response = requests.get(url, timeout=TIMEOUT, allow_redirects=True, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    return response.text


def build_documents_url(registration_url: str) -> str | None:
    if registration_url and "inscripciones/prueba" in registration_url:
        return registration_url.replace("inscripciones/prueba", "inscripciones/documentos")
    return None


def build_results_url(registration_url: str) -> str | None:
    if registration_url and "inscripciones/prueba" in registration_url:
        return registration_url.replace("inscripciones/prueba", "inscripciones/clasificacion")
    return None


def update_race_links(race: dict) -> dict:
    registration = race.get("registrationUrl", "").strip()
    if registration:
        docs_candidate = race.get("technicalGuideUrl", "").strip() or build_documents_url(registration) or ""
        if docs_candidate and is_http_ok(docs_candidate):
            race["technicalGuideUrl"] = docs_candidate
            race["documentsUrl"] = docs_candidate
        results_candidate = race.get("resultUrl", "").strip() or build_results_url(registration) or ""
        if results_candidate and is_http_ok(results_candidate):
            race["resultUrl"] = results_candidate
    return race


def derive_clax_url(g_live_url: str) -> str | None:
    if not g_live_url:
        return None
    parsed = urlparse(g_live_url)
    f = parse_qs(parsed.query).get("f", [None])[0]
    if not f:
        return None
    return urljoin(g_live_url, unquote(f))


def parse_clax_standings(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    riders = {e.attrib["d"]: e.attrib for e in root.findall(".//Engages/E")}
    results = {r.attrib["d"]: r.attrib for r in root.findall(".//Resultats/R")}
    standings = {key: [] for key in DEFAULT_CATEGORY_KEYS}

    for rider_id, rider in riders.items():
        category_key = CATEGORY_MAP.get((rider.get("p") or "").strip())
        if not category_key:
            continue
        points = int((results.get(rider_id, {}).get("t") or "0").strip() or 0)
        if points <= 0:
            continue
        normalized_name = normalize_text(rider.get("n", ""))
        standings[category_key].append({
            "name": title_case_name(normalized_name),
            "club": (rider.get("c") or "").strip(),
            "points": points,
            "normalizedName": normalized_name,
        })

    for category_key, rows in standings.items():
        rows.sort(key=lambda item: (-item["points"], item["normalizedName"]))
        standings[category_key] = [
            {
                "position": idx,
                "name": row["name"],
                "club": row["club"],
                "points": row["points"],
            }
            for idx, row in enumerate(rows, start=1)
        ]
    return standings


def update_championship_general_standings(champ: dict) -> dict:
    champ.setdefault("generalStandingsByCategory", {})
    for key in DEFAULT_CATEGORY_KEYS:
        champ["generalStandingsByCategory"].setdefault(key, [])

    general_url = (champ.get("generalClassificationUrl") or "").strip()
    if not general_url:
        return champ

    if "cronosportradio.es/g-live/g-live.html" in general_url:
        clax_url = derive_clax_url(general_url)
        if not clax_url:
            return champ
        try:
            xml_text = fetch_text(clax_url)
            champ["generalStandingsByCategory"] = parse_clax_standings(xml_text)
            champ["generalClassificationDataUrl"] = clax_url
            champ["generalClassificationSourceType"] = "clax"
            print(f"General X-Sauce actualizada: {champ.get('name')}")
        except Exception as exc:
            print(f"No se pudo actualizar la general de {champ.get('name')}: {exc}")
    return champ


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    data["races"] = [update_race_links(race) for race in data.get("races", [])]
    data["championships"] = [update_championship_general_standings(champ) for champ in data.get("championships", [])]
    data["lastUpdatedUtc"] = datetime.now(timezone.utc).isoformat()
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Actualizado {DATA_PATH.name} con {len(data.get('races', []))} carreras y {len(data.get('championships', []))} campeonatos.")


if __name__ == "__main__":
    main()
