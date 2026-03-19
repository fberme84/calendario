#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path
import requests

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
TIMEOUT = 20

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

def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    races = data.get("races", [])
    data["races"] = [update_race_links(race) for race in races]
    data["lastUpdatedUtc"] = datetime.now(timezone.utc).isoformat()
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Actualizado {DATA_PATH.name} con {len(races)} carreras.")

if __name__ == "__main__":
    main()
