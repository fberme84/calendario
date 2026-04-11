
function formatDisplayName(name) {
  if (!name) return "";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return name;
  const first = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return first + " " + rest;
}

let championships = [];
let races = [];

const APP_NAME = "Calendario Escuela CC Mejorada";
let currentCalendarMonth = "";
let lastUpdatedUtc = "";
let ccMejoradaRidersByCategory = {};
let dataLoaded = false;
const APP_VERSION = window.APP_VERSION || "20260324-3";

const monthNames = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];



function getCurrentMonthValue() {
  return String(new Date().getMonth() + 1);
}

async function loadData() {
  const response = await fetch(withAppVersion("./data.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar data.json (${response.status})`);
  }
  const data = await response.json();
  championships = Array.isArray(data.championships) ? data.championships : [];
  races = Array.isArray(data.races) ? data.races : [];
  ccMejoradaRidersByCategory = data.ccMejoradaRidersByCategory || {};
  lastUpdatedUtc = data.lastUpdatedUtc || "";
  if (!currentCalendarMonth) {
    currentCalendarMonth = getCurrentMonthValue();
  }
  dataLoaded = true;
}


function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCategoryLabel(categoryKey) {
  const labels = {
    promesa_masculino: "Promesa masculino",
    promesa_femenino: "Promesa femenino",
    principiante_masculino: "Principiante masculino",
    principiante_femenino: "Principiante femenino",
    alevin_masculino: "Alevín masculino",
    alevin_femenino: "Alevín femenino",
    infantil_masculino: "Infantil masculino",
    infantil_femenino: "Infantil femenino",
    cadete_masculino: "Cadete masculino",
    cadete_femenino: "Cadete femenino",
    mi_promesa_masculino: "Mini promesa masculino",
    mi_promesa_femenino: "Mini promesa femenino"
  };
  return labels[categoryKey] || categoryKey;
}

function tokenizeName(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function hasSameNameTokens(a, b) {
  const ta = tokenizeName(a);
  const tb = tokenizeName(b);
  if (!ta.length || !tb.length) return false;
  return ta.length === tb.length && ta.every(token => tb.includes(token));
}

function isMejoradaRider(name, categoryKey, club = "") {
  const normalizedClub = normalizeText(club);
  if (normalizedClub.includes("MEJORADA")) return true;

  const list = (ccMejoradaRidersByCategory && ccMejoradaRidersByCategory[categoryKey]) || [];
  return list.some(savedName => hasSameNameTokens(savedName, name));
}


function getGuadalajaraPointsByPosition(pos) {
  const table = {
    1: 100, 2: 75, 3: 60, 4: 50, 5: 45,
    6: 40, 7: 35, 8: 30, 9: 27, 10: 25,
    11: 22, 12: 20, 13: 17, 14: 15, 15: 12,
    16: 10, 17: 9, 18: 8, 19: 7, 20: 6,
    21: 5, 22: 4, 23: 3, 24: 2, 25: 1
  };
  return table[pos] || 0;
}

function renderStandingsRow(item, categoryKey, race = null) {
  const isMejorada = isMejoradaRider(item.name, categoryKey, item.club);
  const hasRawPoints = item.points !== undefined && item.points !== null && String(item.points).trim() !== "";
  const isGuadalajara = !!race && Array.isArray(race.championshipIds) && race.championshipIds.includes("mtb-escolar-guadalajara-2026");

  let points = "";
  if (hasRawPoints) {
    points = String(item.points);
  } else if (isGuadalajara) {
    const calculated = getGuadalajaraPointsByPosition(Number(item.position || 0));
    points = calculated ? String(calculated) : "";
  }

  return `<div class="standing-row ${isMejorada ? "standing-mejorada" : ""}">
    <div class="standing-pos-wrap">
      ${isMejorada ? `<img class="standing-club-badge" src="${withAppVersion('img/escudo_cc_mejorada.png')}" alt="CC Mejorada">` : `<span class="standing-club-badge placeholder"></span>`}
      <span class="standing-position">${escapeHtml(String(item.position || "—"))}</span>
    </div>
    <div class="standing-main">
      <div class="standing-name">${escapeHtml(formatDisplayName(item.name || ""))}</div>
      <div class="standing-meta">${escapeHtml(item.club || "")}</div>
    </div>
    ${points ? `<div class="standing-points">${escapeHtml(points)} pts</div>` : ``}
  </div>`;
}

function renderGeneralCategoryBlock(categoryKey, items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    return `<details class="standings-category"><summary>${escapeHtml(getCategoryLabel(categoryKey))}</summary><div class="standings-empty">Sin clasificación disponible.</div></details>`;
  }
  const top5 = rows.slice(0, 5);
  const mejoradaExtra = rows.filter(item => isMejoradaRider(item.name, categoryKey, item.club) && !top5.some(t => normalizeText(t.name) === normalizeText(item.name)));
  return `
    <details class="standings-category">
      <summary>${escapeHtml(getCategoryLabel(categoryKey))}</summary>
      <div class="standings-subtitle">Top 5 general</div>
      <div class="standings-list">${top5.map(item => renderStandingsRow(item, categoryKey)).join("")}</div>
      ${mejoradaExtra.length ? `<div class="standings-subtitle">CC Mejorada</div><div class="standings-list">${mejoradaExtra.map(item => renderStandingsRow(item, categoryKey)).join("")}</div>` : ``}
    </details>
  `;
}

function renderGeneralStandingsSection(champ) {
  const standings = champ && champ.generalStandingsByCategory ? champ.generalStandingsByCategory : null;
  const orderedPairs = [
    ['mi_promesa_masculino','mi_promesa_femenino'],
    ['promesa_masculino','promesa_femenino'],
    ['principiante_masculino','principiante_femenino'],
    ['alevin_masculino','alevin_femenino'],
    ['infantil_masculino','infantil_femenino'],
    ['cadete_masculino','cadete_femenino']
  ];
  const hasAny = standings && orderedPairs.some(pair => pair.some(key => Array.isArray(standings[key]) && standings[key].length));
  return `
    <section class="card standings-card">
      <div class="standings-head">
        <div>
          <h3>La marea amarilla</h3>
          <p class="small">Resumen de la general del campeonato: Top 5 y puestos de CC Mejorada sin salir a la web externa.</p>
        </div>
      </div>
      ${hasAny ? `<div class="standings-grid">${orderedPairs.map(pair => `
        <div class="standings-pair">
          <div class="standings-col">${renderGeneralCategoryBlock(pair[0], standings[pair[0]] || [])}</div>
          <div class="standings-col">${renderGeneralCategoryBlock(pair[1], standings[pair[1]] || [])}</div>
        </div>
      `).join('')}</div>` : `<div class="standings-empty">Pendiente de cargar la general acumulada de este campeonato.</div>`}
    </section>
  `;
}

function renderLoading() {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<section class="page"><div class="card">Cargando datos…</div></section>`;
  }
}

function renderLoadError(error) {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<section class="page"><div class="card empty">No se pudieron cargar los datos. Revisa data.json.<br><span class="small">${escapeHtml(error?.message || "Error desconocido")}</span></div></section>`;
  }
}

function withAppVersion(path) {
  if (!path) return "";
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(APP_VERSION)}`;
}

function parseDate(dateString) {
  if (!dateString) return null;
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateString) {
  const date = parseDate(dateString);
  if (!date) return "Pendiente";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}



function formatLastUpdated(dateString) {
  if (!dateString) return "Sin actualizar aún";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function sortRaces(items) {
  return [...items].sort((a, b) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    if (!da && !db) return a.name.localeCompare(b.name, "es");
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getCountdownDisplay(dateString) {
  const date = parseDate(dateString);
  if (!date) return "—";

  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
  const nowRaw = new Date();
  const now = new Date(nowRaw.getFullYear(), nowRaw.getMonth(), nowRaw.getDate(), nowRaw.getHours(), nowRaw.getMinutes(), nowRaw.getSeconds());

  let diffMs = target - now;
  if (diffMs <= 0) {
    const today = getToday();
    if (date.getTime() === today.getTime()) return "Hoy";
    return "—";
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(diffMs / dayMs);
  diffMs -= days * dayMs;
  const hours = Math.ceil(diffMs / hourMs);

  if (days <= 0) {
    return `${hours}h`;
  }
  return `${days}d ${hours}h`;
}

function isNonFederatedRace(race) {
  return getRaceChampionshipIds(race).includes("mtb-escolar-guadalajara-2026");
}

function getRaceStatus(race) {

  const date = parseDate(race.date);
  if (!date) return { key: "pending", label: "Pendiente de información", className: "badge-pending" };
  if (date < getToday()) return { key: "past", label: "Celebrada", className: "badge-past" };
  return { key: "upcoming", label: "Próxima", className: "badge-upcoming" };
}

function getDaysUntil(dateString) {
  const date = parseDate(dateString);
  if (!date) return null;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = getToday();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}

function getRaceChampionshipIds(race) {
  if (Array.isArray(race.championshipIds)) return race.championshipIds;
  if (race.championshipId) return [race.championshipId];
  return [];
}

function raceBelongsToChampionship(race, championshipId) {
  return getRaceChampionshipIds(race).includes(championshipId);
}

// Escuela view: include explicit escuelas + mixta races (because they include escuelas)
function isSchoolRace(race) {
  return race.categoryType === "escuelas" || race.categoryType === "mixta";
}

function getSchoolRaces() {
  return races.filter(isSchoolRace);
}

function getChampionshipById(id) {
  return championships.find(c => c.id === id);
}

function getChampionshipsForRace(race) {
  return getRaceChampionshipIds(race).map(getChampionshipById).filter(Boolean);
}

function getRaceById(id) {
  return races.find(r => r.id === id);
}

function getRaceOrder(race, championshipId = null) {
  const scopeId = championshipId || getRaceChampionshipIds(race)[0];
  if (!scopeId) return null;
  const champRaces = sortRaces(getSchoolRaces().filter(r => raceBelongsToChampionship(r, scopeId)));
  const idx = champRaces.findIndex(r => r.id === race.id);
  return idx >= 0 ? idx + 1 : null;
}

function shouldShowResults(race) {
  return getRaceStatus(race).key === "past";
}

function getNextRace() {
  return sortRaces(getSchoolRaces()).find(r => {
    const d = parseDate(r.date);
    return d && d >= getToday();
  }) || null;
}

function countUpcoming() {
  return getSchoolRaces().filter(r => {
    const d = parseDate(r.date);
    return d && d >= getToday();
  }).length;
}

function countPastWithResults() {
  return getSchoolRaces().filter(r => getRaceStatus(r).key === "past" && r.resultUrl).length;
}

function getChampionshipColorClass(id) {
  if (id === "x-sauce-series-2026") return "champ-xsauce";
  if (id === "copa-madrid-escuelas-2026") return "champ-madrid";
  if (id === "clm-xco-2026") return "champ-clm";
  if (id === "mtb-escolar-guadalajara-2026") return "champ-guadalajara";
  if (id === "mtb-racing-cup-2026") return "champ-racingcup";
  return "";
}


function getChampionshipLogoPath(id) {
  if (id === "x-sauce-series-2026") return withAppVersion("img/logo_xsauce.png");
  if (id === "copa-madrid-escuelas-2026") return withAppVersion("img/logo_madrid.png");
  if (id === "clm-xco-2026") return withAppVersion("img/logo_clm.png");
  if (id === "mtb-escolar-guadalajara-2026") return withAppVersion("img/logo_guada.png");
  if (id === "mtb-racing-cup-2026") return withAppVersion("img/logo_mtb_racing_cup.png");
  return "";
}

function getChampionshipTitleColorClass(id) {
  if (id === "x-sauce-series-2026") return "title-xsauce";
  if (id === "copa-madrid-escuelas-2026") return "title-madrid";
  if (id === "clm-xco-2026") return "title-clm";
  if (id === "mtb-escolar-guadalajara-2026") return "title-guadalajara";
  if (id === "mtb-racing-cup-2026") return "title-racingcup";
  return "";
}

function championshipGeneralButton(champ, variant = "secondary") {
  if (!champ || !champ.generalClassificationUrl) return "";
  const cls = variant === "secondary" ? "btn btn-secondary" : "btn btn-primary";
  return `<a class="${cls}" href="${escapeHtml(champ.generalClassificationUrl)}" target="_blank" rel="noopener noreferrer">${externalLinkIcon()} Clasificación general oficial</a>`;
}

function renderChampionshipLogosByIds(ids, size = "sm") {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return "";
  return `<div class="champ-logos champ-logos-${size}">${uniqueIds.map(id => {
    const champ = getChampionshipById(id);
    const src = getChampionshipLogoPath(id);
    if (!src || !champ) return "";
    return `<img class="champ-logo-badge" src="${src}" alt="${escapeHtml(champ.name)}" title="${escapeHtml(champ.name)}" loading="lazy">`;
  }).join("")}</div>`;
}

function renderChampionshipLogosForRace(race, size = "sm") {
  return renderChampionshipLogosByIds(getRaceChampionshipIds(race), size);
}

function getRaceCardClass(race, contextChampionshipId = null) {
  const ids = contextChampionshipId ? [contextChampionshipId] : getRaceChampionshipIds(race);
  if (ids.length > 1) return "champ-multi";
  if (ids[0] === "x-sauce-series-2026") return "champ-single-xsauce";
  if (ids[0] === "copa-madrid-escuelas-2026") return "champ-single-madrid";
  if (ids[0] === "clm-xco-2026") return "champ-single-clm";
  if (ids[0] === "mtb-escolar-guadalajara-2026") return "champ-single-guadalajara";
  if (ids[0] === "mtb-racing-cup-2026") return "champ-single-racingcup";
  return "";
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = "#/";
}
window.goBack = goBack;

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function externalLinkIcon() {
  return `<span class="external-link-icon" aria-hidden="true">↗</span>`;
}

function linkButton(url, label, variant = "primary") {
  if (!url) return "";
  const cls = variant === "secondary" ? "btn btn-secondary" : "btn btn-primary";
  return `<a class="${cls}" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function buildTechnicalGuideUrlFromUrl(url) {
  if (url && url.includes("inscripciones/prueba")) {
    return url.replace("inscripciones/prueba", "inscripciones/documentos");
  }
  return null;
}

function buildResultUrlFromUrl(url) {
  if (url && url.includes("inscripciones/prueba")) {
    return url.replace("inscripciones/prueba", "inscripciones/clasificacion");
  }
  return null;
}

function buildTechnicalGuideUrl(race) {
  if (race.technicalGuideUrl) return race.technicalGuideUrl;

  if (race.registrationUrl && race.registrationUrl.includes("inscripciones/prueba")) {
    return race.registrationUrl.replace("inscripciones/prueba", "inscripciones/documentos");
  }

  return null;
}

function buildResultUrl(race) {
  if (race.resultUrl) return race.resultUrl;

  if (race.registrationUrl && race.registrationUrl.includes("inscripciones/prueba")) {
    return race.registrationUrl.replace("inscripciones/prueba", "inscripciones/clasificacion");
  }

  return null;
}

function resultButton(race) {
  if (!shouldShowResults(race)) return "";
  const url = buildResultUrl(race);
  if (!url) return "";
  if (!url) return "";
  return linkButton(url, "Clasificación", "secondary");
}

function renderBackBar(label = "Volver") {
  return `<div class="card-actions"><button class="btn btn-secondary" onclick="goBack()">← ${label}</button></div>`;
}

function renderBreadcrumb(items) {
  return `<div class="small" style="margin-bottom:8px;">${items.map(item =>
    item.href
      ? `<a href="${item.href}" style="color: inherit; text-decoration:none;"><strong>${escapeHtml(item.label)}</strong></a>`
      : `<strong>${escapeHtml(item.label)}</strong>`
  ).join(" &gt; ")}</div>`;
}

function renderChampionshipPills(race) {
  const raceChampionships = getChampionshipsForRace(race);
  if (!raceChampionships.length) return "";
  return `<div class="badge-row">${raceChampionships.map(ch =>
    `<a class="champ-pill ${getChampionshipColorClass(ch.id)}" href="#/campeonato/${ch.id}">${escapeHtml(ch.name)}</a>`
  ).join("")}</div>`;
}

function renderOrderPrefix(order) {
  return order ? `<span class="order-prefix">${order}<sup>º</sup></span> ` : "";
}

function renderOrderMedal(order) {
  if (!order) return "";
  return `<span class="order-medal order-medal-generic" title="${order}º del campeonato">${order}º</span>`;
}

function getChampionshipBadgeTitle(race) {
  const ids = race.championshipIds || [];
  const labels = [];
  if (ids.includes("clm-xco-2026")) labels.push("Castilla-La Mancha");
  if (ids.includes("copa-madrid-escuelas-2026")) labels.push("Madrid");
  if (ids.includes("x-sauce-series-2026")) labels.push("X-Sauce");
  if (ids.includes("mtb-escolar-guadalajara-2026")) labels.push("Mtb Escolar Guadalajara");
  return labels.join(" + ");
}

function getPrimaryChampClass(race) {
  const ids = race.championshipIds || [];
  const hasCLM = ids.includes("clm-xco-2026");
  const hasMadrid = ids.includes("copa-madrid-escuelas-2026");
  const hasXSauce = ids.includes("x-sauce-series-2026");
  const hasGuadalajara = ids.includes("mtb-escolar-guadalajara-2026");

  if (hasCLM && hasXSauce) return "champ-clm-xsauce";
  if (hasMadrid && hasXSauce) return "champ-madrid-xsauce";
  if (hasCLM) return "champ-clm";
  if (hasMadrid) return "champ-madrid";
  if (hasXSauce) return "champ-xsauce";
  if (hasGuadalajara) return "champ-guadalajara";
  return "";
}

function renderRaceCard(race, compact = false, contextChampionshipId = null) {
  const status = getRaceStatus(race);
  const days = getDaysUntil(race.date);
  const raceChampionships = getChampionshipsForRace(race);
  const displayIds = contextChampionshipId ? [contextChampionshipId] : getRaceChampionshipIds(race);
  const champText = contextChampionshipId
    ? (getChampionshipById(contextChampionshipId)?.name || "")
    : raceChampionships.map(c => c.name).join(" · ");
  const order = getRaceOrder(race, contextChampionshipId || null);

  return `
    <article class="card race-card ${getRaceCardClass(race, contextChampionshipId)} race-accordion-card">
      <details class="race-details">
        <summary class="race-summary">
          <div class="race-summary-main">
            <div class="race-summary-head">
              <h3>${renderOrderPrefix(order)}${escapeHtml(race.name)}</h3>
              ${renderChampionshipLogosByIds(displayIds, "sm")}
            </div>
            <p class="race-summary-date">${escapeHtml(formatDate(race.date))}</p>
          </div>
          <div class="race-summary-toggle" aria-hidden="true">+</div>
        </summary>

        <div class="race-details-body">
          <div class="badge-row">
            <span class="badge ${status.className}">${status.label}</span>
            ${race.categoryType === "mixta" ? `<span class="badge badge-docs">Escuelas + otras categorías</span>` : `<span class="badge badge-docs">Escuelas</span>`}
            ${isNonFederatedRace(race) ? `<span class="badge badge-nonfed">No federado</span>` : ``}
          </div>

          <p class="meta">
            ${escapeHtml(race.location)} (${escapeHtml(race.province)})<br>
            ${escapeHtml(champText)}
            ${days !== null && days >= 0 ? `<br><strong>${escapeHtml(getCountdownDisplay(race.date))} para la prueba</strong>` : ""}
          </p>

          ${compact ? "" : `<p class="small">${escapeHtml(race.notes || "")}</p>`}

          <div class="card-actions">
            <a class="btn btn-secondary" href="#/carrera/${race.id}">Detalle</a>
            ${linkButton(race.registrationUrl, "Inscripción")}
            ${linkButton(buildTechnicalGuideUrl(race), "Guía técnica", "secondary")}
            ${resultButton(race)}
          </div>
        </div>
      </details>
    </article>
  `;
}



function getFutureMonthsSummary(champValue = "", currentMonthValue = "", textValue = "") {
  const currentMonth = Number(currentMonthValue || 0);
  const monthCounts = {};
  sortRaces(getSchoolRaces()).forEach(race => {
    const date = parseDate(race.date);
    if (!date) return;
    const month = date.getMonth() + 1;
    const textBlob = `${race.name} ${race.location} ${race.province}`.toLowerCase();
    if (champValue && !raceBelongsToChampionship(race, champValue)) return;
    if (textValue && !textBlob.includes(textValue)) return;
    if (!currentMonth || month <= currentMonth) return;
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  return Object.keys(monthCounts)
    .map(Number)
    .sort((a, b) => a - b)
    .map(month => ({ month, label: monthNames[month], count: monthCounts[month] }));
}

function renderFutureMonthsHint(items) {
  if (!items || !items.length) return "";
  const next = items[0];
  return `
    <div class="card future-months-hint">
      <div class="future-months-hint-main">
        <div>
          <strong>También hay carreras en meses siguientes</strong>
          <div class="small">${items.map(item => `${escapeHtml(item.label)} (${item.count})`).join(" · ")}</div>
        </div>
        <button type="button" class="btn btn-secondary" onclick="jumpToMonth(${next.month})">Ir a ${escapeHtml(next.label)}</button>
      </div>
    </div>
  `;
}

function jumpToMonth(month) {
  const monthSelect = document.getElementById("filterMonth");
  if (!monthSelect) return;
  monthSelect.value = String(month);
  currentCalendarMonth = String(month);
  applyCalendarFilters();
}
window.jumpToMonth = jumpToMonth;

function getFilteredSchoolRaces(champValue = "", monthValue = "", textValue = "") {
  return sortRaces(getSchoolRaces()).filter(race => {
    const date = parseDate(race.date);
    const textBlob = `${race.name} ${race.location} ${race.province}`.toLowerCase();
    if (champValue && !raceBelongsToChampionship(race, champValue)) return false;
    if (monthValue) {
      if (!date || date.getMonth() + 1 !== Number(monthValue)) return false;
    }
    if (textValue && !textBlob.includes(textValue)) return false;
    return true;
  });
}


function renderMonthlyGrid(racesForView, monthValue = "") {
  const datedRaces = racesForView.filter(r => parseDate(r.date));
  if (!datedRaces.length) {
    return `<div class="card empty">No hay carreras con fecha para mostrar en el calendario.</div>`;
  }

  let focusDate;
  if (monthValue) {
    const year = parseDate(datedRaces[0].date)?.getFullYear() || 2026;
    focusDate = new Date(year, Number(monthValue) - 1, 1);
  } else if (currentCalendarMonth) {
    const year = parseDate(datedRaces[0].date)?.getFullYear() || 2026;
    focusDate = new Date(year, Number(currentCalendarMonth) - 1, 1);
  } else {
    focusDate = parseDate(datedRaces[0].date);
  }

  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  currentCalendarMonth = String(month + 1);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(firstDay);

  const racesByDay = {};
  racesForView.forEach(race => {
    const d = parseDate(race.date);
    if (!d) return;
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!racesByDay[day]) racesByDay[day] = [];
      racesByDay[day].push(race);
    }
  });

  const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  let cells = "";
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="calendar-cell empty-cell"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const items = racesByDay[day] || [];
    cells += `
      <div class="calendar-cell ${items.length ? "has-races" : ""}">
        <div class="calendar-day">${day}</div>
        <div class="calendar-events">
          ${items.map(race => `
            <a href="#/carrera/${race.id}" class="calendar-event ${getRaceCardClass(race)}">
              <span class="calendar-event-order" title="${escapeHtml(getChampionshipBadgeTitle(race))}">${getRaceOrder(race) ? `#${getRaceOrder(race)}` : ""}</span>
              <span class="calendar-event-title">${escapeHtml(race.name)}</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="card monthly-card">
      <div class="monthly-header">
        <button type="button" class="btn btn-secondary month-nav-btn" onclick="changeCalendarMonth(-1)">←</button>
        <div class="monthly-title-wrap">
          <h3 style="margin:0;">Calendario mensual</h3>
          <span class="small monthly-current" style="text-transform:capitalize;">${escapeHtml(monthLabel)}</span>
        </div>
        <button type="button" class="btn btn-secondary month-nav-btn" onclick="changeCalendarMonth(1)">→</button>
      </div>
      <div class="calendar-weekdays">
        ${weekdayLabels.map(label => `<div class="calendar-weekday">${label}</div>`).join("")}
      </div>
      <div class="calendar-grid">${cells}</div>
    </div>
  `;
}

function changeCalendarMonth(step) {
  const monthSelect = document.getElementById("filterMonth");
  if (!monthSelect) return;

  const current = Number(monthSelect.value || currentCalendarMonth || 1);
  let next = current + step;

  if (next < 1) next = 12;
  if (next > 12) next = 1;

  monthSelect.value = String(next);
  currentCalendarMonth = String(next);
  applyCalendarFilters();
}

function renderHome() {
  const nextRace = getNextRace();
  const upcomingRaces = sortRaces(getSchoolRaces()).filter(r => {
    const d = parseDate(r.date);
    return d && d >= getToday();
  }).slice(0, 4);

  return `
    <section class="page home-page">
      <div class="home-overview">
        <section class="card next-race-home-card">
          <div class="home-section-head">
            <div>
              <h2 class="section-title">Próxima carrera de la escuela</h2>
              <p class="section-subtitle">La siguiente cita del calendario escolar.</p>
            </div>
            ${nextRace ? renderChampionshipLogosByIds(getRaceChampionshipIds(nextRace), "md") : ""}
          </div>
          ${
            nextRace
              ? `
                <div class="next-race-home-main">
                  <div>
                    <h3>${renderOrderPrefix(getRaceOrder(nextRace))}${escapeHtml(nextRace.name)}</h3>
                    <p class="meta">${escapeHtml(formatDate(nextRace.date))} · ${escapeHtml(nextRace.location)} (${escapeHtml(nextRace.province)})</p>
                  </div>
                  <div class="next-race-countdown">
                    <div class="countdown">${getCountdownDisplay(nextRace.date)}</div>
                    <p class="small">hasta la próxima prueba</p>
                  </div>
                </div>
                <div class="card-actions home-actions-row">
                  <a class="btn btn-secondary" href="#/carrera/${nextRace.id}">Abrir detalle</a>
                  ${linkButton(nextRace.registrationUrl, "Inscripción")}
                  <a class="btn btn-secondary" href="#/calendario">Calendario completo</a>
                </div>
              `
              : `<div class="empty">No hay próxima carrera definida.</div>`
          }
        </section>

        <section class="card home-summary-card">
          <div class="home-section-head compact-head">
            <div>
              <h2 class="section-title">Resumen 2026</h2>
              <p class="section-subtitle">Vista rápida del calendario de escuelas.</p>
            </div>
          </div>
          <div class="stat-grid home-stat-grid">
            <div class="stat stat-compact">
              <span class="stat-label">Carreras</span>
              <span class="stat-value">${getSchoolRaces().length}</span>
            </div>
            <div class="stat stat-compact">
              <span class="stat-label">Próximas</span>
              <span class="stat-value">${countUpcoming()}</span>
            </div>
            <div class="stat stat-compact">
              <span class="stat-label">Clasificaciones</span>
              <span class="stat-value">${countPastWithResults()}</span>
            </div>
          </div>
          <div class="home-champ-links">
            ${championships.map(champ => `
              <a class="home-champ-link ${getChampionshipColorClass(champ.id)}" href="#/campeonato/${champ.id}" title="${escapeHtml(champ.name)}">
                ${renderChampionshipLogosByIds([champ.id], "sm")}
                <span>${escapeHtml(champ.name)}</span>
              </a>
            `).join("")}
          </div>
        </section>
      </div>

      <section class="card home-upcoming-card">
        <div class="home-section-head">
          <div>
            <h2 class="section-title">Siguientes pruebas</h2>
            <p class="section-subtitle">Próximas carreras del calendario escolar.</p>
          </div>
          <a class="btn btn-secondary home-inline-btn" href="#/campeonatos">Ver campeonatos</a>
        </div>
        <ul class="list-clean home-upcoming-list">
          ${upcomingRaces.map(r => `
            <li class="list-item home-upcoming-item">
              <div class="home-upcoming-main">
                ${renderChampionshipLogosByIds(getRaceChampionshipIds(r), "sm")}
                <div>
                  <strong>${getRaceOrder(r) ? `${getRaceOrder(r)}º ` : ""}${escapeHtml(r.name)}</strong><br>
                  <span class="small">${escapeHtml(r.location)} (${escapeHtml(r.province)})</span>
                </div>
              </div>
              <div class="home-upcoming-side">
                <div class="home-upcoming-date">${escapeHtml(formatDate(r.date))}</div>
                <a class="small home-upcoming-link" href="#/carrera/${r.id}">Ver detalle</a>
              </div>
            </li>
          `).join("") || `<li class="empty">No hay pruebas futuras.</li>`}
        </ul>
      </section>
    </section>
  `;
}

function renderCalendar() {
  const selectedMonth = currentCalendarMonth || getCurrentMonthValue();
  const monthOptions = monthNames.map((m, i) => {
    const value = i === 0 ? "" : String(i);
    const selected = value === selectedMonth ? " selected" : "";
    return `<option value="${value}"${selected}>${m}</option>`;
  }).join("");
  return `
    <section class="page">
      <div class="card">
        <h2 class="section-title">Calendario de la escuela</h2>
        <p class="section-subtitle">Filtra por campeonato, mes o texto.</p>
        <div class="filters school-filters" style="margin-top:16px">
          <select id="filterChampionship">
            <option value="">Todos los campeonatos</option>
            ${championships.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
          </select>
          <select id="filterMonth">${monthOptions}</select>
          <input id="filterText" type="text" placeholder="Buscar por carrera, ciudad o provincia" />
        </div>
      </div>
      <div id="calendarMonthly"></div>
      <div id="calendarFutureHint"></div>
      <div id="calendarResults" class="race-grid"></div>
    </section>
  `;
}

function applyCalendarFilters() {
  const champValue = document.getElementById("filterChampionship").value;
  const monthSelect = document.getElementById("filterMonth");
  const rawMonthValue = monthSelect ? monthSelect.value : "";
  const effectiveMonthValue = rawMonthValue || currentCalendarMonth || getCurrentMonthValue();
  currentCalendarMonth = effectiveMonthValue;
  if (monthSelect && monthSelect.value !== effectiveMonthValue) {
    monthSelect.value = effectiveMonthValue;
  }
  const textValue = document.getElementById("filterText").value.trim().toLowerCase();

  const filtered = getFilteredSchoolRaces(champValue, effectiveMonthValue, textValue);

  const monthly = document.getElementById("calendarMonthly");
  monthly.innerHTML = renderMonthlyGrid(filtered, effectiveMonthValue);

  const futureHint = document.getElementById("calendarFutureHint");
  if (futureHint) {
    futureHint.innerHTML = renderFutureMonthsHint(getFutureMonthsSummary(champValue, effectiveMonthValue, textValue));
  }

  const container = document.getElementById("calendarResults");
  container.innerHTML = filtered.length
    ? filtered.map(r => renderRaceCard(r)).join("")
    : `<div class="card empty">No hay carreras para este filtro.</div>`;
}

function renderChampionships() {
  const html = championships.map(champ => {
    const champRaces = sortRaces(getSchoolRaces().filter(r => raceBelongsToChampionship(r, champ.id)));
    const next = champRaces.find(r => {
      const d = parseDate(r.date);
      return d && d >= getToday();
    });
    return `
      <article class="card championship-card ${getChampionshipColorClass(champ.id)}">
        <div class="championship-card-head">
          ${renderChampionshipLogosByIds([champ.id], "md")}
          <div>
            <h2 class="${getChampionshipTitleColorClass(champ.id)}">${escapeHtml(champ.name)}</h2>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-box">
            <span class="info-label">Carreras de escuela</span>
            <strong>${champRaces.length}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Próxima prueba</span>
            <strong>${next ? `${escapeHtml(next.location)}` : "Pendiente"}</strong>
          </div>
        </div>
        <div class="card-actions" style="margin-top:14px">
          <a class="btn btn-primary" href="#/campeonato/${champ.id}">Ver campeonato</a>
          ${championshipGeneralButton(champ)}
        </div>
      </article>
    `;
  }).join("");

  return `<section class="page"><div class="champ-grid">${html}</div></section>`;
}

function renderChampionshipDetail(championshipId) {
  const champ = getChampionshipById(championshipId);
  if (!champ) return `<section class="page"><div class="card empty">Campeonato no encontrado.</div></section>`;

  const champRaces = sortRaces(getSchoolRaces().filter(r => raceBelongsToChampionship(r, champ.id)));
  return `
    <section class="page">
      ${renderBackBar("Volver")}
      <div class="card">
        ${renderBreadcrumb([
          { label: "Inicio", href: "#/" },
          { label: "Campeonatos", href: "#/campeonatos" },
          { label: champ.name }
        ])}
        <div class="championship-detail-head">
          ${renderChampionshipLogosByIds([champ.id], "lg")}
          <div>
            <h2 class="${getChampionshipTitleColorClass(champ.id)}">${escapeHtml(champ.name)}</h2>
            <p class="meta">Temporada ${champ.season} · ${champRaces.length} carreras de escuela</p>
          </div>
        </div>
        <p class="small">${escapeHtml(champ.description || "")}</p>
        <div class="card-actions" style="margin-top:16px">
          ${championshipGeneralButton(champ)}
        </div>
      </div>
      <div class="race-grid">
        ${champRaces.map(r => renderRaceCard(r, true, champ.id)).join("")}
      </div>
      ${renderGeneralStandingsSection(champ)}
    </section>
  `;
}



function renderRaceCategoryBlock(categoryKey, items, race) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    return `<details class="standings-category"><summary>${escapeHtml(getCategoryLabel(categoryKey))}</summary><div class="standings-empty">Sin clasificación disponible.</div></details>`;
  }
  const top5 = rows.slice(0, 5);
  const mejoradaExtra = rows.filter(item => isMejoradaRider(item.name, categoryKey, item.club) && !top5.some(t => normalizeText(t.name) === normalizeText(item.name)));
  return `
    <details class="standings-category">
      <summary>${escapeHtml(getCategoryLabel(categoryKey))}</summary>
      <div class="standings-subtitle">Top 5</div>
      <div class="standings-list">${top5.map(item => renderStandingsRow(item, categoryKey)).join("")}</div>
      ${mejoradaExtra.length ? `<div class="standings-subtitle">CC Mejorada</div><div class="standings-list">${mejoradaExtra.map(item => renderStandingsRow(item, categoryKey)).join("")}</div>` : ``}
    </details>
  `;
}

function renderRaceResultsSection(race) {
  const results = race && race.raceResultsByCategory ? race.raceResultsByCategory : null;
  const orderedPairs = [
    ['mi_promesa_masculino','mi_promesa_femenino'],
    ['principiante_masculino','principiante_femenino'],
    ['alevin_masculino','alevin_femenino'],
    ['infantil_masculino','infantil_femenino'],
    ['cadete_masculino','cadete_femenino']
  ];
  const hasAny = results && orderedPairs.some(pair => pair.some(key => Array.isArray(results[key]) && results[key].length));
  if (!hasAny) return "";
  return `
    <section class="card standings-card">
      <div class="standings-head">
        <div>
          <h3>La marea amarilla</h3>
          <p class="small">Resumen de la clasificación de la prueba: top 5 por categoría y corredores de CC Mejorada.</p>
        </div>
      </div>
      <div class="standings-grid">${orderedPairs.map(pair => `
        <div class="standings-pair">
          <div class="standings-col">${renderRaceCategoryBlock(pair[0], results[pair[0]] || [], race)}</div>
          <div class="standings-col">${renderRaceCategoryBlock(pair[1], results[pair[1]] || [], race)}</div>
        </div>
      `).join('')}</div>
    </section>
  `;
}


function renderRaceDetail(raceId) {
  const race = getRaceById(raceId);
  if (!race) return `<section class="page"><div class="card empty">Carrera no encontrada.</div></section>`;

  const status = getRaceStatus(race);
  const days = getDaysUntil(race.date);
  const raceChampionships = getChampionshipsForRace(race);

  return `
    <section class="page">
      ${renderBackBar("Volver")}
      <div class="card">
        ${renderBreadcrumb([
          { label: "Inicio", href: "#/" },
          { label: "Campeonatos", href: "#/campeonatos" },
          { label: race.name }
        ])}
        <div class="badge-row">
          <span class="badge ${status.className}">${status.label}</span>
          ${race.categoryType === "mixta" ? `<span class="badge badge-docs">Incluye escuelas</span>` : `<span class="badge badge-docs">Escuelas</span>`}
          ${isNonFederatedRace(race) ? `<span class="badge badge-nonfed">No federado</span>` : ``}
        </div>
        <div class="race-detail-head">
          <div>
            <h2>${renderOrderPrefix(getRaceOrder(race))}${escapeHtml(race.name)}</h2>
            <p class="meta">${raceChampionships.map(c => escapeHtml(c.name)).join(" · ")}</p>
          </div>
          ${renderChampionshipLogosForRace(race, "md")}
        </div>

        <div class="info-grid">
          <div class="info-box">
            <span class="info-label">Campeonatos</span>
            <strong>${raceChampionships.length ? raceChampionships.map(c => escapeHtml(c.name)).join(" · ") : "—"}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Nº de prueba</span>
            <strong>${raceChampionships.length ? raceChampionships.map(c => `${escapeHtml(c.name)}: ${getRaceOrder(race, c.id) || "—"}º`).join(" · ") : "—"}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Tipo</span>
            <strong>${race.categoryType === "mixta" ? "Escuelas + otras categorías" : "Escuelas"}${isNonFederatedRace(race) ? " · No federado" : ""}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Fecha</span>
            <strong>${escapeHtml(formatDate(race.date))}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Cuenta atrás</span>
            <strong>${escapeHtml(getCountdownDisplay(race.date))}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Localidad</span>
            <strong>${escapeHtml(race.location)}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Provincia</span>
            <strong>${escapeHtml(race.province)}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Organizador</span>
            <strong>${escapeHtml(race.organizer || "Pendiente")}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Clasificación</span>
            <strong>${shouldShowResults(race) ? (buildResultUrl(race) ? "Disponible" : "Pendiente") : "Aún no aplica"}</strong>
          </div>
          <div class="info-box">
            <span class="info-label">Notas</span>
            <strong>${escapeHtml(race.notes || "Sin notas")}</strong>
          </div>
        </div>

        <div class="card-actions" style="margin-top:16px">
          ${linkButton(race.registrationUrl, "Inscripción")}
          ${linkButton(buildTechnicalGuideUrl(race), "Guía técnica", "secondary")}
          ${linkButton(race.documentsUrl, "Documentos", "secondary")}
          ${resultButton(race)}
        </div>
        ${renderChampionshipPills(race)}
      </div>
      ${renderRaceResultsSection(race)}
    </section>
  `;
}

function updateNav(route) {
  const links = document.querySelectorAll(".nav a");
  links.forEach(link => link.classList.remove("active"));
  let target = "#/";
  if (route.startsWith("#/calendario")) target = "#/calendario";
  else if (route.startsWith("#/campeonatos") || route.startsWith("#/campeonato/") || route.startsWith("#/carrera/")) target = "#/campeonatos";
  const active = Array.from(links).find(link => link.getAttribute("href") === target);
  if (active) active.classList.add("active");
}

function render() {
  const app = document.getElementById("app");
  const hash = window.location.hash || "#/";
  updateNav(hash);

  let content = "";

  if (hash === "#/" || hash === "#") {
    content = renderHome();
  } else if (hash === "#/calendario") {
    content = renderCalendar();
  } else if (hash === "#/campeonatos") {
    content = renderChampionships();
  } else if (hash.startsWith("#/campeonato/")) {
    const id = hash.split("/")[2];
    content = renderChampionshipDetail(id);
  } else if (hash.startsWith("#/carrera/")) {
    const id = hash.split("/")[2];
    content = renderRaceDetail(id);
  } else {
    content = `<section class="page"><div class="card empty">Página no encontrada.</div></section>`;
  }

  app.innerHTML = `
    ${content}
    <footer class="app-footer">
      Última actualización: ${escapeHtml(formatLastUpdated(lastUpdatedUtc))}
    </footer>
  `;

  if (hash === "#/calendario") {
    document.getElementById("filterChampionship").addEventListener("change", applyCalendarFilters);
    document.getElementById("filterMonth").addEventListener("change", applyCalendarFilters);
    document.getElementById("filterText").addEventListener("input", applyCalendarFilters);
    applyCalendarFilters();
  }
}


window.addEventListener("hashchange", () => {
  if (dataLoaded) render();
});

window.addEventListener("DOMContentLoaded", async () => {
  renderLoading();
  try {
    await loadData();
    render();
  } catch (error) {
    console.error(error);
    renderLoadError(error);
  }
});
