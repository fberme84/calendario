let championships = [];
let races = [];

const APP_NAME = "Calendario Escuela CC Mejorada";
let currentCalendarMonth = "";
let lastUpdatedUtc = "";
let dataLoaded = false;

const monthNames = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];


async function loadData() {
  const cacheBuster = new Date().toISOString().slice(0, 13);
  const response = await fetch(`./data.json?v=${cacheBuster}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar data.json (${response.status})`);
  }
  const data = await response.json();
  championships = Array.isArray(data.championships) ? data.championships : [];
  races = Array.isArray(data.races) ? data.races : [];
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
  return new Date(2026, 2, 16);
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
  return "";
}

function getRaceCardClass(race, contextChampionshipId = null) {
  const ids = contextChampionshipId ? [contextChampionshipId] : getRaceChampionshipIds(race);
  if (ids.length > 1) return "champ-multi";
  if (ids[0] === "x-sauce-series-2026") return "champ-single-xsauce";
  if (ids[0] === "copa-madrid-escuelas-2026") return "champ-single-madrid";
  if (ids[0] === "clm-xco-2026") return "champ-single-clm";
  if (ids[0] === "mtb-escolar-guadalajara-2026") return "champ-single-guadalajara";
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
  if (order === 1) return `<span class="order-medal" title="1º del campeonato">🥇</span>`;
  if (order === 2) return `<span class="order-medal" title="2º del campeonato">🥈</span>`;
  if (order === 3) return `<span class="order-medal" title="3º del campeonato">🥉</span>`;
  return `<span class="order-medal order-medal-generic" title="${order}º del campeonato">🏅${order}º</span>`;
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
  const champText = contextChampionshipId
    ? (getChampionshipById(contextChampionshipId)?.name || "")
    : raceChampionships.map(c => c.name).join(" · ");
  const order = getRaceOrder(race, contextChampionshipId || null);

  return `
    <article class="card race-card ${getRaceCardClass(race, contextChampionshipId)} race-accordion-card">
      <details class="race-details">
        <summary class="race-summary">
          <div class="race-summary-main">
            <h3>${renderOrderMedal(order)}${escapeHtml(race.name)}</h3>
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
            ${days !== null && days >= 0 ? `<br><strong>Faltan ${days} días</strong>` : ""}
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
  const firstChamp = championships[0];
  return `
    <section class="page">
      <div class="hero">
        <section class="card hero-card">
          <p class="muted-light">Escuela del club</p>
          <h2>${escapeHtml(APP_NAME)}</h2>
          <p class="muted-light">Solo carreras de escuelas, con inscripciones, guías técnicas y clasificaciones.</p>
          <div class="card-actions">
            <a class="btn btn-secondary" href="#/calendario">Ver calendario</a>
            <a class="btn btn-secondary" href="#/campeonatos">Ver campeonatos</a>
          </div>
        </section>
        <section class="card">
          <h2>Próxima carrera de la escuela</h2>
          ${
            nextRace
              ? `
                <h3>${renderOrderPrefix(getRaceOrder(nextRace))}${escapeHtml(nextRace.name)}</h3>
                <p class="meta">${escapeHtml(formatDate(nextRace.date))} · ${escapeHtml(nextRace.location)} (${escapeHtml(nextRace.province)})</p>
                <div class="countdown">${getDaysUntil(nextRace.date)} días</div>
                <p class="small">hasta la próxima prueba</p>
                ${renderChampionshipPills(nextRace)}
                <div class="card-actions">
                  <a class="btn btn-secondary" href="#/carrera/${nextRace.id}">Abrir detalle</a>
                  ${linkButton(nextRace.registrationUrl, "Inscripción")}
                </div>
              `
              : `<div class="empty">No hay próxima carrera definida.</div>`
          }
        </section>
      </div>

      <section class="stat-grid">
        <div class="stat">
          <span class="stat-label">Total de carreras de escuela</span>
          <span class="stat-value">${getSchoolRaces().length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Próximas pruebas</span>
          <span class="stat-value">${countUpcoming()}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Clasificaciones publicadas</span>
          <span class="stat-value">${countPastWithResults()}</span>
        </div>
      </section>

      <section class="quick-grid">
        <div class="card">
          <h2 class="section-title">Accesos rápidos</h2>
          <p class="section-subtitle">Consulta en segundos la información útil para la escuela.</p>
          <div class="card-actions" style="margin-top:14px">
            <a class="btn btn-primary" href="#/calendario">Calendario</a>
            <a class="btn btn-secondary" href="#/campeonatos">Campeonatos</a>
          </div>
        </div>
        <div class="card">
          <h2 class="section-title">Siguientes pruebas</h2>
          <ul class="list-clean">
            ${sortRaces(getSchoolRaces()).filter(r => {
              const d = parseDate(r.date);
              return d && d >= getToday();
            }).slice(0,3).map(r => `
              <li class="list-item">
                <div>
                  <strong>${getRaceOrder(r) ? `${getRaceOrder(r)}º ` : ""}${escapeHtml(r.name)}</strong><br>
                  <span class="small">${escapeHtml(r.location)} (${escapeHtml(r.province)})</span>
                </div>
                <div>${escapeHtml(formatDate(r.date))}</div>
              </li>
            `).join("") || `<li class="empty">No hay pruebas futuras.</li>`}
          </ul>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">Campeonato destacado</h2>
        <p class="section-subtitle">La app está filtrada para mostrar solo carreras de escuelas.</p>
        <div class="card-actions" style="margin-top:14px">
          <a class="btn btn-primary" href="#/campeonato/${firstChamp.id}">${escapeHtml(firstChamp.name)}</a>
        </div>
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
      <article class="card">
        <h2>${escapeHtml(champ.name)}</h2>
        <p class="meta">Temporada ${champ.season}</p>
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
        <h2>${escapeHtml(champ.name)}</h2>
        <p class="meta">Temporada ${champ.season} · ${champRaces.length} carreras de escuela</p>
        <p class="small">${escapeHtml(champ.description || "")}</p>
      </div>
      <div class="race-grid">
        ${champRaces.map(r => renderRaceCard(r, true, champ.id)).join("")}
      </div>
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
        <h2>${renderOrderPrefix(getRaceOrder(race))}${escapeHtml(race.name)}</h2>
        <p class="meta">${raceChampionships.map(c => escapeHtml(c.name)).join(" · ")}</p>

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
            <strong>${days !== null && days >= 0 ? `${days} días` : "—"}</strong>
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
