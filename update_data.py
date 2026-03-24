#!/usr/bin/env python3
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
TIMEOUT = 30
USER_AGENT = "CC-Mejorada-Updater/1.2"
CATEGORY_MAP = {
    "PROMESAS": "promesa_masculino",
    "PROMESAS FEM.": "promesa_femenino",
    "PROMESAS FEM": "promesa_femenino",
    "PRICIPIANTES": "principiante_masculino",
    "PRINCIPIANTES": "principiante_masculino",
    "PRICIPIANTES FEM": "principiante_femenino",
    "PRINCIPIANTES FEM": "principiante_femenino",
    "ALEVIN": "alevin_masculino",
    "ALEVIN FEM.": "alevin_femenino",
    "ALEVIN FEM": "alevin_femenino",
    "INFANTIL": "infantil_masculino",
    "INFANTIL FEM.": "infantil_femenino",
    "INFANTIL FEM": "infantil_femenino",
}
DEFAULT_CATEGORY_KEYS = [
    "promesa_masculino", "promesa_femenino", "principiante_masculino", "principiante_femenino",
    "alevin_masculino", "alevin_femenino", "infantil_masculino", "infantil_femenino"
]
MANUAL_STANDINGS_PATCHES = {
    "clm-xco-2026": {
        "infantil_masculino": [
            {"name": "Garcia Amaya Pablo", "club": "MEJORADA C.C.", "points": 12, "position": 30}
        ]
    }
}


def normalize_text(value: str) -> str:
    value = (value or "").replace("\xa0", " ").strip().upper()
    value = "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value)


def title_case_name(value: str) -> str:
    parts = []
    for part in value.split():
        if part.isupper() or part == normalize_text(part):
            parts.append(part.capitalize())
        else:
            parts.append(part)
    return " ".join(parts)


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


def parse_yosoyciclista_standings(html_text: str) -> list[dict]:
    soup = BeautifulSoup(html_text, "html.parser")
    text = soup.get_text("\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    start = None
    for i, line in enumerate(lines):
        if line.startswith("POS.") and "NOMBRE Y CLUB" in line and "TOTAL" in line:
            start = i + 1
            break
    if start is None:
        return []

    rows = []
    pos_re = re.compile(r'^(\d+)\s+(.+?)(?:\s+\(([A-Z]+)\))?$')
    i = start
    while i < len(lines):
        line = lines[i]
        if line.startswith("POS.") and "NOMBRE Y CLUB" in line:
            break
        m = pos_re.match(line)
        if not m:
            i += 1
            continue
        position = int(m.group(1))
        name = m.group(2).strip().strip(',')
        club = lines[i + 1].strip() if i + 1 < len(lines) else ""
        j = i + 2
        points = 0
        while j < len(lines):
            nxt = lines[j]
            if (nxt.startswith("POS.") and "NOMBRE Y CLUB" in nxt) or pos_re.match(nxt):
                break
            if re.fullmatch(r'\d+', nxt):
                points = int(nxt)
                j += 1
                break
            j += 1
        rows.append({
            "position": position,
            "name": title_case_name(normalize_text(name.replace(',', ' '))),
            "club": club,
            "points": points,
        })
        i = j
        while i < len(lines):
            nxt = lines[i]
            if (nxt.startswith("POS.") and "NOMBRE Y CLUB" in nxt) or pos_re.match(nxt):
                break
            i += 1

    dedup = []
    seen = set()
    for row in rows:
        key = (row['position'], normalize_text(row['name']), normalize_text(row['club']), row['points'])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(row)
    dedup.sort(key=lambda r: (r['position'], normalize_text(r['name'])))
    return dedup





def dedupe_rows_by_name(rows: list[dict]) -> list[dict]:
    best_by_name = {}
    for row in rows or []:
        key = normalize_text(row.get("name", ""))
        if not key:
            continue
        current = best_by_name.get(key)
        candidate = dict(row)
        if current is None:
            best_by_name[key] = candidate
            continue
        current_score = (-int(current.get("points", 0)), int(current.get("position", 9999)))
        candidate_score = (-int(candidate.get("points", 0)), int(candidate.get("position", 9999)))
        if candidate_score < current_score:
            best_by_name[key] = candidate
    return sorted(best_by_name.values(), key=lambda item: (int(item.get("position", 9999)), -int(item.get("points", 0)), normalize_text(item.get("name", ""))))

def apply_manual_standings_patches(champ_id: str, standings: dict) -> dict:
    patches_by_category = MANUAL_STANDINGS_PATCHES.get(champ_id) or {}
    if not patches_by_category:
        return standings

    for category_key, patches in patches_by_category.items():
        rows = list(standings.get(category_key) or [])
        existing = {normalize_text(item.get("name", "")) for item in rows}
        for patch in patches:
            if normalize_text(patch.get("name", "")) in existing:
                continue
            rows.append(dict(patch))
        if rows:
            standings[category_key] = dedupe_rows_by_name(rows)
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
            updated_standings = parse_clax_standings(xml_text)
            updated_standings = {k: dedupe_rows_by_name(v) for k, v in updated_standings.items()}
            champ["generalStandingsByCategory"] = apply_manual_standings_patches(champ.get("id", ""), updated_standings)
            champ["generalClassificationDataUrl"] = clax_url
            champ["generalClassificationSourceType"] = "clax"
            print(f"General X-Sauce actualizada: {champ.get('name')}")
        except Exception as exc:
            print(f"No se pudo actualizar la general de {champ.get('name')}: {exc}")
        return champ

    category_urls = champ.get("generalClassificationUrlsByCategory") or {}
    if "yosoyciclista.com" in general_url and category_urls:
        updated = {key: [] for key in DEFAULT_CATEGORY_KEYS}
        ok = False
        for category_key in DEFAULT_CATEGORY_KEYS:
            url = (category_urls.get(category_key) or "").strip()
            if not url:
                continue
            try:
                html_text = fetch_text(url)
                updated[category_key] = dedupe_rows_by_name(parse_yosoyciclista_standings(html_text))
                ok = ok or bool(updated[category_key])
                print(f"General CLM actualizada: {champ.get('name')} · {category_key} ({len(updated[category_key])})")
            except Exception as exc:
                print(f"No se pudo actualizar {champ.get('name')} · {category_key}: {exc}")
        if ok:
            champ["generalStandingsByCategory"] = apply_manual_standings_patches(champ.get("id", ""), updated)
            champ["generalClassificationSourceType"] = "yosoyciclista-circuito"
        return champ

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
