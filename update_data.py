#!/usr/bin/env python3
import os
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
TIMEOUT = 30
USER_AGENT = "CC-Mejorada-Updater/1.3"
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
        "alevin_masculino": [
            {"name": "Garcia Gonzalez Marcos", "club": "MEJORADA C.C.", "points": 54, "position": 41}
        ],
        "infantil_masculino": [
            {"name": "Garcia Amaya Pablo", "club": "MEJORADA C.C.", "points": 12, "position": 30}
        ]
    },
    "x-sauce-series-2026": {
        "alevin_masculino": [
            {"name": "Sanchez Sanchez Guillermo", "club": "MEJORADA C.C.", "points": 20, "position": 51}
        ],
        "infantil_masculino": [
            {"name": "Garcia Amaya Pablo", "club": "MEJORADA C.C.", "points": 12, "position": 71}
        ]
    }
}
CATEGORY_HINT_TOKENS = ("PROMESA", "PRINCIP", "ALEVIN", "INFANTIL", "CADETE")


def normalize_text(value: str) -> str:
    value = (value or "").replace("\xa0", " ").strip().upper()
    value = "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value)


def safe_int(value, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def extract_ints(text: str) -> list[int]:
    return [int(match) for match in re.findall(r"\d+", text or "")]


def clean_rider_name(raw_name: str) -> str:
    normalized = normalize_text((raw_name or "").replace(",", " "))
    normalized = re.sub(r"\s+\([A-Z]{2,4}\)\s*$", "", normalized).strip()
    return title_case_name(normalized)


def split_name_and_club(raw_lines: list[str]) -> tuple[str, str]:
    if not raw_lines:
        return "", ""

    first_line = normalize_text(raw_lines[0].replace(",", " "))
    if len(raw_lines) > 1:
        return clean_rider_name(first_line), raw_lines[1].strip()

    inline_match = re.match(r"^(.*?)\s+\(([A-Z]{2,4})\)\s+(.+)$", first_line)
    if inline_match:
        return clean_rider_name(inline_match.group(1)), inline_match.group(3).strip()

    return clean_rider_name(first_line), ""


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



def fetch_rendered_html_with_selenium(url: str, wait_selector: str = "table") -> str:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,1200")
    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    driver = webdriver.Chrome(options=options)
    try:
        driver.get(url)
        WebDriverWait(driver, TIMEOUT).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector))
        )
        return driver.page_source
    finally:
        driver.quit()


def parse_yosoyciclista_table_html(html_text: str) -> list[dict]:
    soup = BeautifulSoup(html_text, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    header_cells = [normalize_text(th.get_text(" ", strip=True)) for th in table.find_all("th")]
    total_idx = None
    for idx, header in enumerate(header_cells):
        if "TOTAL" in header:
            total_idx = idx
            break

    rows = []
    body_rows = table.find_all("tr")
    for tr in body_rows:
        cells = tr.find_all(["td", "th"])
        if len(cells) < 4:
            continue

        pos_text = normalize_text(cells[0].get_text(" ", strip=True))
        if not pos_text.isdigit():
            continue

        name_club_cell = cells[1]
        raw_lines = [line.strip() for line in name_club_cell.get_text("\n", strip=True).splitlines() if line.strip()]
        if not raw_lines:
            continue

        name, club = split_name_and_club(raw_lines)
        points_candidates = []
        if total_idx is not None and total_idx < len(cells):
            points_candidates.extend(extract_ints(cells[total_idx].get_text(" ", strip=True)))
        for cell in cells[2:]:
            points_candidates.extend(extract_ints(cell.get_text(" ", strip=True)))
        total_points = max(points_candidates) if points_candidates else 0

        rows.append({
            "position": int(pos_text),
            "name": name,
            "club": club,
            "points": total_points,
        })

    return dedupe_rows_by_name(rows)


def parse_yosoyciclista_standings_with_selenium(url: str) -> list[dict]:
    try:
        html_text = fetch_rendered_html_with_selenium(url, "table")
    except Exception:
        return []
    rows = parse_yosoyciclista_table_html(html_text)
    if rows:
        return rows
    return parse_yosoyciclista_standings(html_text)


def should_use_selenium_for_clm(html_text: str, parsed_rows: list[dict]) -> bool:
    text = normalize_text(BeautifulSoup(html_text, "html.parser").get_text(" ", strip=True))
    if len(parsed_rows) >= 5:
        return False

    # Si hay señales de carga incompleta o no hay filas detectadas, intentamos renderizado real.
    if "CARGANDO" in text or "LOADING" in text:
        return True
    if not parsed_rows and ("POS." not in text or "NOMBRE Y CLUB" not in text):
        return True
    return len(parsed_rows) < 3 and "POS." in text and "NOMBRE Y CLUB" in text


def parse_best_yosoyciclista_standings(html_text: str) -> list[dict]:
    table_rows = parse_yosoyciclista_table_html(html_text)
    text_rows = dedupe_rows_by_name(parse_yosoyciclista_standings(html_text))
    if len(table_rows) >= len(text_rows):
        return table_rows
    return text_rows


def looks_like_category_label(text: str) -> bool:
    normalized = normalize_text(text)
    return any(token in normalized for token in CATEGORY_HINT_TOKENS)


def infer_race_category_key(label: str) -> str | None:
    normalized = normalize_text(label)
    if not normalized:
        return None

    is_female = " FEM" in normalized or "FEMEN" in normalized

    if "MINI PROMESA" in normalized or "MI PROMESA" in normalized:
        base = "mi_promesa"
    elif "PROMESA" in normalized:
        # En resultados de escuelas, "Promesa" suele mapear a mini promesa.
        base = "mi_promesa"
    elif "PRINCIP" in normalized:
        base = "principiante"
    elif "ALEVIN" in normalized:
        base = "alevin"
    elif "INFANTIL" in normalized:
        base = "infantil"
    elif "CADETE" in normalized:
        base = "cadete"
    else:
        return None

    suffix = "femenino" if is_female else "masculino"
    return f"{base}_{suffix}"


def find_table_category_label(table) -> str:
    caption = table.find("caption")
    if caption:
        text = caption.get_text(" ", strip=True)
        if looks_like_category_label(text):
            return text

    previous_blocks = table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "strong", "b", "p", "div"], limit=12)
    for block in previous_blocks:
        text = block.get_text(" ", strip=True)
        if not text or len(text) > 120:
            continue
        if looks_like_category_label(text):
            return text
    return ""


def parse_race_table_rows(table) -> list[dict]:
    rows = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue

        pos_text = normalize_text(cells[0].get_text(" ", strip=True))
        if not pos_text.isdigit():
            continue

        # Formato A: nombre+club en misma celda (circuitos por puntos).
        # Formato B: columnas separadas Nombre/Apellidos/Club (cronofec).
        if len(cells) >= 5:
            first_name = cells[2].get_text(" ", strip=True)
            last_name = cells[3].get_text(" ", strip=True)
            name = clean_rider_name(f"{first_name} {last_name}")
            club = cells[4].get_text(" ", strip=True)
        else:
            raw_name_lines = [line.strip() for line in cells[1].get_text("\n", strip=True).splitlines() if line.strip()]
            if not raw_name_lines:
                continue
            name, club = split_name_and_club(raw_name_lines)
            if not club and len(cells) >= 3:
                club = cells[2].get_text(" ", strip=True)

        points = ""
        for cell in reversed(cells[2:]):
            candidate = normalize_text(cell.get_text(" ", strip=True))
            if candidate.isdigit():
                points = int(candidate)
                break

        rows.append({
            "position": int(pos_text),
            "name": name,
            "club": club,
            "points": points,
        })

    return rows


def parse_yosoyciclista_race_results(html_text: str) -> dict:
    soup = BeautifulSoup(html_text, "html.parser")
    merged = {}

    for table in soup.find_all("table"):
        table_rows = parse_race_table_rows(table)
        if not table_rows:
            continue

        label = find_table_category_label(table)
        category_key = infer_race_category_key(label)
        if not category_key:
            continue

        merged.setdefault(category_key, [])
        merged[category_key].extend(table_rows)

    return {key: dedupe_rows_by_name(rows) for key, rows in merged.items() if rows}


def infer_category_endpoint_from_select_id(select_id: str) -> str:
    normalized = normalize_text(select_id)
    if "CRONO" in normalized:
        return "mostrar_categorias_cronofec_clasificacion"
    if "FICHERO" in normalized:
        return "mostrar_categorias_clasificacion_fichero"
    return "mostrar_categorias_clasificacion"


def parse_race_results_from_category_selector(base_url: str, html_text: str) -> dict:
    soup = BeautifulSoup(html_text, "html.parser")
    select = None
    for candidate in soup.find_all("select"):
        options = candidate.find_all("option")
        if len(options) > 1:
            select = candidate
            break
    if not select:
        return {}

    endpoint = infer_category_endpoint_from_select_id(select.get("id") or select.get("name") or "")
    base_prefix = "https://yosoyciclista.com/index.php/smartweb/inscripciones"
    prueba = base_url.rstrip("/").split("/")[-1]

    merged = {}
    for option in select.find_all("option"):
        raw_value = (option.get("value") or "").strip()
        if not raw_value.isdigit() or raw_value == "0":
            continue
        label = option.get_text(" ", strip=True)
        category_key = infer_race_category_key(label)
        if not category_key:
            continue

        category_url = f"{base_prefix}/{endpoint}/{raw_value}/{prueba}"
        try:
            rendered = fetch_rendered_html_with_selenium(category_url, "table tbody tr")
        except Exception as exc:
            print(f"No se pudo abrir clasificación por categoría ({label}) en {prueba}: {exc}")
            continue

        category_soup = BeautifulSoup(rendered, "html.parser")
        table = category_soup.find("table")
        if not table:
            continue

        rows = dedupe_rows_by_name(parse_race_table_rows(table))
        if rows:
            merged.setdefault(category_key, [])
            merged[category_key].extend(rows)

    return {key: dedupe_rows_by_name(rows) for key, rows in merged.items() if rows}


def is_past_or_today(date_string: str) -> bool:
    try:
        race_date = datetime.strptime((date_string or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        return False
    return race_date <= datetime.now(timezone.utc).date()


def update_race_results_by_category(race: dict) -> dict:
    if race.get("raceResultsByCategory"):
        return race

    result_url = (race.get("resultUrl") or "").strip()
    if not result_url:
        return race
    if not is_past_or_today(race.get("date", "")):
        return race
    if "inscripciones/clasificacion" not in result_url:
        return race

    try:
        html_text = fetch_text(result_url)
        parsed = parse_yosoyciclista_race_results(html_text)
        if not parsed and "yosoyciclista.com" in result_url:
            parsed = parse_race_results_from_category_selector(result_url, html_text)
    except Exception as exc:
        print(f"No se pudo extraer clasificación por categoría para {race.get('name')}: {exc}")
        return race

    if parsed:
        race["raceResultsByCategory"] = parsed
        race["raceResultsSourceType"] = "yosoyciclista-clasificacion"
        race["raceResultsDataUrl"] = result_url
        print(f"Clasificación por carrera actualizada: {race.get('name')} ({len(parsed)} categorías)")

    return race


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
        found_numbers = []
        while j < len(lines):
            nxt = lines[j]
            if (nxt.startswith("POS.") and "NOMBRE Y CLUB" in nxt) or pos_re.match(nxt):
                break
            if re.fullmatch(r'\d+', nxt):
                found_numbers.append(int(nxt))
            j += 1
        points = max(found_numbers) if found_numbers else 0
        rows.append({
            "position": position,
            "name": clean_rider_name(name),
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






def upsert_patch_rows(rows: list[dict], patches: list[dict]) -> list[dict]:
    by_name = {}
    for row in rows or []:
        key = normalize_text(row.get("name", ""))
        if key:
            by_name[key] = dict(row)
    for patch in patches or []:
        key = normalize_text(patch.get("name", ""))
        if key:
            by_name[key] = dict(patch)
    merged = list(by_name.values())
    return sorted(merged, key=lambda item: (safe_int(item.get("position", 9999), 9999), -safe_int(item.get("points", 0), 0), normalize_text(item.get("name", ""))))

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
        current_score = (-safe_int(current.get("points", 0), 0), safe_int(current.get("position", 9999), 9999))
        candidate_score = (-safe_int(candidate.get("points", 0), 0), safe_int(candidate.get("position", 9999), 9999))
        if candidate_score < current_score:
            best_by_name[key] = candidate
    return sorted(best_by_name.values(), key=lambda item: (safe_int(item.get("position", 9999), 9999), -safe_int(item.get("points", 0), 0), normalize_text(item.get("name", ""))))

def apply_manual_standings_patches(champ_id: str, standings: dict) -> dict:
    patches_by_category = MANUAL_STANDINGS_PATCHES.get(champ_id) or {}
    if not patches_by_category:
        return standings

    for category_key, patches in patches_by_category.items():
        rows = list(standings.get(category_key) or [])
        standings[category_key] = upsert_patch_rows(rows, patches)
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
                base_rows = parse_best_yosoyciclista_standings(html_text)
                if should_use_selenium_for_clm(html_text, base_rows):
                    print(f"HTML base incompleto para CLM · {category_key}. Probando con Selenium…")
                    selenium_rows = parse_yosoyciclista_standings_with_selenium(url)
                    if len(selenium_rows) > len(base_rows):
                        base_rows = selenium_rows
                updated[category_key] = dedupe_rows_by_name(base_rows)
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
    updated_races = []
    for race in data.get("races", []):
        race = update_race_links(race)
        race = update_race_results_by_category(race)
        updated_races.append(race)
    data["races"] = updated_races
    data["championships"] = [update_championship_general_standings(champ) for champ in data.get("championships", [])]
    data["lastUpdatedUtc"] = datetime.now(timezone.utc).isoformat()
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Actualizado {DATA_PATH.name} con {len(data.get('races', []))} carreras y {len(data.get('championships', []))} campeonatos.")


if __name__ == "__main__":
    main()
