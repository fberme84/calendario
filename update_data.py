#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
TIMEOUT = 20

CATEGORY_KEY_MAP = {
    "promesas": "promesa_masculino",
    "promesas fem": "promesa_femenino",
    "principiantes": "principiante_masculino",
    "principiantes fem": "principiante_femenino",
    "alevin": "alevin_masculino",
    "alevin fem": "alevin_femenino",
    "infantil": "infantil_masculino",
    "infantil fem": "infantil_femenino",
}


def normalize_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = (
        value.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )
    return re.sub(r"\s+", " ", value)


def category_label_to_key(label: str) -> str | None:
    return CATEGORY_KEY_MAP.get(normalize_text(label))


def fetch_html(url: str) -> str:
    response = requests.get(
        url,
        timeout=TIMEOUT,
        allow_redirects=True,
        headers={"User-Agent": "CC-Mejorada-Updater/1.0"},
    )
    response.raise_for_status()
    return response.text


def is_http_ok(url: str) -> bool:
    if not url:
        return False
    try:
        response = requests.get(
            url,
            timeout=TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": "CC-Mejorada-Updater/1.0"},
        )
        return 200 <= response.status_code < 400
    except requests.RequestException:
        return False


def build_documents_url(registration_url: str) -> str | None:
    if registration_url and "inscripciones/prueba" in registration_url:
        return registration_url.replace("inscripciones/prueba", "inscripciones/documentos")
    return None


def build_results_url(registration_url: str) -> str | None:
    if registration_url and "inscripciones/prueba" in registration_url:
        return registration_url.replace("inscripciones/prueba", "inscripciones/clasificacion")
    return None


def parse_standings_text(text: str) -> list[dict]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    results = []
    i = 0
    while i < len(lines):
        m = re.match(r"^(\d+)\s+(.+?)\s+\(([A-Z]{2,3})\)$", lines[i])
        if not m:
            i += 1
            continue
        puesto = int(m.group(1))
        nombre = m.group(2).strip()
        club = lines[i + 1].strip() if i + 1 < len(lines) else ""
        total = None
        for j in range(i + 2, min(i + 8, len(lines))):
            if re.fullmatch(r"\d+", lines[j]):
                total = int(lines[j])
                break
        results.append({"puesto": puesto, "nombre": nombre, "club": club, "puntos": total})
        i += 2

    deduped = []
    seen = set()
    for row in results:
        key = (row["puesto"], row["nombre"], row["club"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def discover_yosoyciclista_category_pages(url: str, html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    pages: dict[str, str] = {}

    for a in soup.select('a[href*="clasificacionescircuito"]'):
        href = a.get("href") or ""
        label = a.get_text(" ", strip=True)
        key = category_label_to_key(label)
        if not key:
            continue
        if href.startswith("/"):
            href = "https://yosoyciclista.com" + href
        elif href.startswith("index.php"):
            href = "https://yosoyciclista.com/" + href
        pages[key] = href

    current_text = soup.get_text("\n", strip=True)
    m = re.search(r"Categor[ií]a:\s*([A-Za-zÁÉÍÓÚÜáéíóúüñÑ ]+)", current_text)
    current_key = category_label_to_key(m.group(1)) if m else None
    if current_key and current_key not in pages:
        pages[current_key] = url
    return pages


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


def update_championship_general_standings(data: dict) -> dict:
    for champ in data.get("championships", []):
        url = (champ.get("generalClassificationUrl") or "").strip()
        champ.setdefault("generalStandingsByCategory", champ.get("generalStandingsByCategory", {}))
        if "yosoyciclista.com" not in url or "clasificacionescircuito" not in url:
            continue

        try:
            html = fetch_html(url)
            pages = discover_yosoyciclista_category_pages(url, html)
            standings = {}
            for key, page_url in pages.items():
                page_html = html if page_url == url else fetch_html(page_url)
                soup = BeautifulSoup(page_html, "html.parser")
                rows = parse_standings_text(soup.get_text("\n", strip=True))
                if rows:
                    standings[key] = rows
            if standings:
                champ["generalStandingsByCategory"] = standings
        except Exception as exc:
            print(f"Aviso: no se pudo actualizar la clasificación general de {champ.get('name', '')}: {exc}")
    return data


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    races = data.get("races", [])
    data["races"] = [update_race_links(race) for race in races]
    data = update_championship_general_standings(data)
    data["lastUpdatedUtc"] = datetime.now(timezone.utc).isoformat()
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Actualizado {DATA_PATH.name} con {len(races)} carreras.")


if __name__ == "__main__":
    main()
