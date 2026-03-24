let championships = [];
let races = [];

const APP_NAME = "Calendario Escuela CC Mejorada";
let currentCalendarMonth = "";
let lastUpdatedUtc = "";
let dataLoaded = false;
let ccMejoradaRidersByCategory = {};
const APP_VERSION = window.APP_VERSION || "20260324-1";

const monthNames = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];


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
  dataLoaded = true;
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

const CATEGORY_LABELS = {
  promesa_masculino: "Promesa masculino",
  promesa_femenino: "Promesa femenino",
  principiante_masculino: "Principiante masculino",
  principiante_femenino: "Principiante femenino",
  alevin_masculino: "Alevín masculino",
  alevin_femenino: "Alevín femenino",
  infantil_masculino: "Infantil masculino",
  infantil_femenino: "Infantil femenino"
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getCategoryLabel(key) {
  return CATEGORY_LABELS[key] || key || "Categoría";
}

function getMejoradaNormalizedSet(categoryKey) {
  return new Set((ccMejoradaRidersByCategory?.[categoryKey] || []).map(normalizeText));
}

function splitGeneralStandings(categoryResults, categoryKey) {
  const sorted = Array.isArray(categoryResults) ? [...categoryResults].sort((a, b) => (a.puesto || 9999) - (b.puesto || 9999)) : [];
  const top5 = sorted.slice(0, 5);
  const mejoradaSet = getMejoradaNormalizedSet(categoryKey);
  const mejoradaAll = sorted.filter(item => mejoradaSet.has(normalizeText(item.nombre)));
  const top5Names = new Set(top5.map(item => normalizeText(item.nombre)));
  const mejoradaOutsideTop5 = mejoradaAll.filter(item => !top5Names.has(normalizeText(item.nombre)));
  return { top5, mejoradaAll, mejoradaOutsideTop5 };
}

function isMejoradaStandingItem(item, categoryKey) {
  const mejoradaSet = getMejoradaNormalizedSet(categoryKey);
  return mejoradaSet.has(normalizeText(item?.nombre));
}

function renderMejoradaMarker(show = false) {
  return `
    <span class="mejorada-marker${show ? ' is-visible' : ''}" aria-hidden="true">
      <img src="${withAppVersion('img/escudo_cc_mejorada.png')}" alt="">
      <span class="mejorada-marker-fallback">CCM</span>
    </span>
  `;
}

function renderStandingRows(items, categoryKey, compact = false) {
  if (!items || !items.length) return `<div class="general-standings-empty">Sin datos.</div>`;
  return `<ol class="general-standings-list${compact ? ' general-standings-list-compact' : ''}">${items.map(item => {
    const isMejorada = isMejoradaStandingItem(item, categoryKey);
    return `
      <li class="standing-row${isMejorada ? ' standing-row-mejorada' : ''}">
        ${renderMejoradaMarker(isMejorada)}
        <span class="standing-position"><strong>${escapeHtml(String(item.puesto || '—'))}.</strong></span>
        <span class="standing-text">
          <span class="standing-main">${escapeHtml(item.nombre || 'Sin nombre')}</span>
          <span class="standing-club">${escapeHtml(item.club || '')}</span>
        </span>
      </li>
    `;
  }).join('')}</ol>`;
}

function renderMejoradaRows(items) {
  if (!items || !items.length) return `<div class="general-standings-empty">Sin corredores de CC Mejorada fuera del Top 5.</div>`;
  return `<ul class="general-standings-mejorada">${items.map(item => `
    <li class="standing-row standing-row-mejorada">
      ${renderMejoradaMarker(true)}
      <span class="standing-position"><strong>${escapeHtml(String(item.puesto || '—'))}.</strong></span>
      <span class="standing-text">
        <span class="standing-main">${escapeHtml(item.nombre || 'Sin nombre')}</span>
        <span class="standing-club">${escapeHtml(item.club || 'CC Mejorada')}</span>
      </span>
    </li>
  `).join('')}</ul>`;
}

function renderGeneralStandingsBlock(champ) {
  const standings = champ?.generalStandingsByCategory || {};
  const keys = Object.keys(standings).filter(key => Array.isArray(standings[key]) && standings[key].length);

  const cards = keys.map(key => {
    const summary = splitGeneralStandings(standings[key], key);
    return `
      <details class="general-standings-card general-standings-details">
        <summary class="general-standings-summary">
          <h3>${escapeHtml(getCategoryLabel(key))}</h3>
          <div class="race-summary-toggle" aria-hidden="true">+</div>
        </summary>
        <div class="general-standings-body">
          <div class="general-standings-subtitle">Top 5 general</div>
          ${renderStandingRows(summary.top5, key, true)}
          <div class="general-standings-subtitle">CC Mejorada</div>
          ${renderMejoradaRows(summary.mejoradaOutsideTop5)}
        </div>
      </details>
    `;
  }).join('');

  const empty = `
    <div class="card empty">
      Resumen de clasificación general pendiente de cargar.
      ${champ?.generalClassificationUrl ? '<div style="margin-top:12px">' + championshipGeneralButton(champ) + '</div>' : ''}
    </div>
  `;

  return `
    <section class="general-standings-section">
      <div class="section-head-inline standings-head-inline">
        <div>
          <h2 class="section-title">La marea roja en la clasificación</h2>
          <p class="small">Top 5 de cada categoría y presencia de CC Mejorada sin salir de la app.</p>
        </div>
        ${champ?.generalClassificationUrl ? `<div class="section-head-actions">${championshipGeneralButton(champ, 'secondary')}</div>` : ''}
      </div>
      ${cards ? `<div class="general-standings-grid">${cards}</div>` : empty}
    </section>
  `;
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
  return linkButton(champ.generalClassificationUrl, "Clasificación general", variant);
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
  const monthOptions = monthNames.map((m, i) => `<option value="${i === 0 ? "" : i}">${m}</option>`).join("");
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
      <div id="calendarResults" class="race-grid"></div>
    </section>
  `;
}

function applyCalendarFilters() {
  const champValue = document.getElementById("filterChampionship").value;
  const monthValue = document.getElementById("filterMonth").value;
  currentCalendarMonth = monthValue || currentCalendarMonth;
  const textValue = document.getElementById("filterText").value.trim().toLowerCase();

  const filtered = getFilteredSchoolRaces(champValue, monthValue, textValue);

  const monthly = document.getElementById("calendarMonthly");
  monthly.innerHTML = renderMonthlyGrid(filtered, monthValue);

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
      ${renderGeneralStandingsBlock(champ)}
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
