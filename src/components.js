/* ==========================================================================
   components.js — layout shell + reusable UI pieces (return HTML strings).
   ========================================================================== */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const D = () => Store.data;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(iso) { if (!iso) return null; const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00Z' : iso); return isNaN(d) ? null : d; }
function fmtDay(iso) { const d = parseDate(iso); return d ? `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}` : ''; }
function fmtDate(iso) { const d = parseDate(iso); return d ? `${fmtDay(iso)} ${d.getUTCFullYear()}` : ''; }
function fmtRange(a, b) {
  const x = parseDate(a), y = parseDate(b);
  if (!x || !y) return fmtDay(a || b);
  if (x.getUTCMonth() === y.getUTCMonth()) return `${String(x.getUTCDate()).padStart(2, '0')} - ${fmtDay(b)}`;
  return `${fmtDay(a)} - ${fmtDay(b)}`;
}
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
function nameOf(d) { return d ? `${d.firstName} ${d.lastName}` : 'Unknown driver'; }
function teamOf(id) { return byId(D().teams, id); }
function driverOf(id) { return byId(D().drivers, id); }
function countryName(code) { return COUNTRY_NAMES[code] || code || ''; }

/* --- atoms ---------------------------------------------------------------- */
const flag = (code, cls = '') => `<img class="flag ${cls}" src="${flagSvg(code)}" alt="${esc(countryName(code))}" title="${esc(countryName(code))}">`;
const teamDot = team => team ? logoImg(team, 'team-dot') : '';
const driverHead = (driver, team) => portraitImg(driver, team, 'driver-head');
const teamLink = team => team ? `<a class="team-cell" href="#/teams/${team.id}">${teamDot(team)}<span>${esc(team.name)}</span></a>` : '<span class="muted">—</span>';
function driverLink(driver, team, opts = {}) {
  if (!driver) return '<span class="muted">Unknown</span>';
  return `<a class="driver-cell" href="#/drivers/${driver.id}">${opts.head === false ? '' : driverHead(driver, team)}<span class="hide-sm">${esc(driver.firstName)} <b>${esc(driver.lastName)}</b></span><span class="show-sm"><b>${esc(driver.code)}</b></span></a>`;
}
const tag = (text, kind = 'red') => `<span class="tag tag-${kind}">${esc(text)}</span>`;
const pill = (label, href, active, extra = '') => `<a class="chip ${active ? 'is-active' : ''}" href="${href}" ${extra}>${esc(label)}</a>`;
const sectionHead = (title, link) => `<div class="section-head"><h2 class="h-section">${esc(title)}</h2>${link ? `<a class="view-all" href="${link.href}">${esc(link.label)} <span aria-hidden="true">›</span></a>` : ''}</div>`;

function seasonSelect(currentId, hrefFor) {
  const opts = seasonsDesc(D()).map(s => `<option value="${s.id}" ${s.id === currentId ? 'selected' : ''}>${esc(s.year)}</option>`).join('');
  return `<label class="pill-select"><span class="sr-only">Season</span><select data-nav-select="${esc(hrefFor('__ID__'))}">${opts}</select></label>`;
}

function subnav(items, active) {
  return `<nav class="subnav" aria-label="Section"><div class="wrap subnav-inner">${items.map(it => it.html ? it.html : `<a href="${it.href}" class="${it.key === active ? 'is-active' : ''}">${esc(it.label)}</a>`).join('')}</div></nav>`;
}

/* --- article cards -------------------------------------------------------- */
function articleImage(a) {
  const own = assetUrl('articles', a, 'image') || driverPhoto(a.driverIds, a.id);
  if (own) return own;
  const t = a.teamIds && a.teamIds[0] ? teamOf(a.teamIds[0]) : null;
  const rd = a.roundId ? byId(D().rounds, a.roundId) : null;
  return stripeArt(a.id, t ? t.color : null, rd ? rd.name : a.category);
}
function relTime(iso) { return fmtDate(iso); }
function articleCard(a, variant = 'grid') {
  const img = `<div class="media"><img src="${articleImage(a)}" alt="" loading="lazy"></div>`;
  const cat = a.category && a.category !== 'News' ? tag(a.category, a.category === 'Race Report' ? 'red' : 'dark') : '';
  if (variant === 'lead') return `<a class="card-lead" href="#/news/${a.id}">${img}<span class="lead-caption">${cat}<span class="lead-title">${esc(a.title)}</span></span></a>`;
  if (variant === 'list') return `<a class="card-list" href="#/news/${a.id}"><span class="body"><span class="title">${esc(a.title)}</span></span>${img}</a>`;
  if (variant === 'row') return `<a class="card-row" href="#/news/${a.id}">${img}<span class="body">${cat}<span class="title">${esc(a.title)}</span><span class="meta">${esc(relTime(a.publishedAt))}</span></span></a>`;
  return `<a class="card-grid" href="#/news/${a.id}">${img}<span class="body">${cat}<span class="title">${esc(a.title)}</span></span></a>`;
}

/* --- tables --------------------------------------------------------------- */
function dataTable(headers, rows, cls = '') {
  return `<div class="table-card ${cls}"><div class="table-scroll"><table class="f1-table">
    <thead><tr>${headers.map(h => `<th class="${h.cls || ''}">${esc(h.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="empty-row">Nothing here yet.</td></tr>`}</tbody>
  </table></div></div>`;
}

function emptyState(title, text, link) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${link ? `<a class="btn btn-red" href="${link.href}">${esc(link.label)}</a>` : ''}</div>`;
}

/* --- shell ---------------------------------------------------------------- */
const NAV = [
  { key: 'schedule', label: 'Schedule', href: '#/schedule' },
  { key: 'results', label: 'Results', href: '#/results' },
  { key: 'standings', label: 'Standings', href: '#/standings/drivers' },
  { key: 'drivers', label: 'Drivers', href: '#/drivers' },
  { key: 'teams', label: 'Teams', href: '#/teams' },
  { key: 'showroom', label: 'Showroom', href: '#/showroom' },
  { key: 'news', label: 'News', href: '#/news' },
];

function header(activeKey) {
  const c = D();
  const s = activeSeason(c);
  const nx = s ? nextRound(c, s.id) : null;
  const nav = NAV.map(n => `<a class="nav-link ${n.key === activeKey ? 'is-active' : ''}" href="${n.href}">${n.label}</a>`).join('');
  const strip = nx ? `<div class="race-strip"><div class="wrap strip-inner">
      <a class="strip-race" href="#/schedule/${nx.id}"><span class="strip-meta"><b>R${nx.round}</b><span>${esc(fmtRange(nx.dateStart, nx.dateEnd))}</span></span><span class="strip-name">${flag(nx.countryCode, 'flag-round')}${esc(nx.name)} <span aria-hidden="true">›</span></span></a>
      <span class="strip-right"><span class="strip-label">Next race</span><span class="strip-count">${esc(nx.sessions.find(x => /race/i.test(x.label))?.time || '')}</span></span>
    </div></div>` : '';
  return `<header class="site-header">
    <div class="utility"><div class="wrap utility-inner">
      <span class="career-name">${c.meta.isSample ? '<span class="sample-dot"></span>' : ''}${esc(c.meta.careerName)}${s ? ` · ${esc(s.name)}` : ''}</span>
      <span class="utility-links"><a href="#/standings/teams">Teams' Championship</a><a href="#/results">Archive</a><a class="btn-pill btn-white" href="#/edit">Edit Career</a></span>
    </div></div>
    <div class="mainbar"><div class="wrap mainbar-inner">
      <a class="brand" href="#/" aria-label="Home">${brandMark()}</a>
      <nav class="mainnav" aria-label="Main">${nav}</nav>
      <span class="mainbar-right">
        <a class="edit-link" href="#/edit">Edit</a>
        <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" data-menu-open><span></span><span></span><span></span></button>
      </span>
    </div></div>
    ${strip}
  </header>
  <div class="mobile-menu" id="mobile-menu" hidden>
    <button class="menu-close" type="button" aria-label="Close menu" data-menu-close>×</button>
    <nav aria-label="Mobile">${[{ key: 'home', label: 'Home', href: '#/' }, ...NAV, { key: 'edit', label: 'Edit Career', href: '#/edit' }].map(n => `<a class="${n.key === activeKey ? 'is-active' : ''}" href="${n.href}">${n.label}</a>`).join('')}</nav>
  </div>`;
}

function sampleBanner() {
  const c = D();
  if (!c.meta.isSample) return '';
  return `<div class="sample-banner"><div class="wrap"><b>Fictional sample season.</b> ${esc(c.meta.sampleNotice || 'All content is invented for review.').replace(/^FICTIONAL SAMPLE SEASON\.\s*/i, '')} <a href="#/edit">Edit or replace it →</a></div></div>`;
}

function footer() {
  const c = D();
  return `<footer class="site-footer"><div class="wrap">
    <div class="footer-top">${brandMark()}<p>${esc(ASSET_MANIFEST.brand.tagline)} — a personal career hub. Not affiliated with Formula 1, the FIA or any team.</p></div>
    <div class="footer-cols">
      <div><h4>Season</h4><a href="#/schedule">Schedule</a><a href="#/results">Results</a><a href="#/standings/drivers">Drivers' Standings</a><a href="#/standings/teams">Teams' Standings</a></div>
      <div><h4>Paddock</h4><a href="#/drivers">Drivers</a><a href="#/teams">Teams</a><a href="#/news">Latest news</a></div>
      <div><h4>Career</h4><a href="#/edit">Edit Career</a><a href="#/edit/data">Backup &amp; reset</a></div>
    </div>
    <p class="footer-fine">${esc(c.meta.careerName)}${c.meta.updatedAt ? ' · saved ' + esc(fmtDate(c.meta.updatedAt)) : ''}${Store.storageOk ? '' : ' · ⚠ browser storage unavailable — changes will not persist, use Export'}</p>
  </div></footer>`;
}
