/* ==========================================================================
   app.js — hash router + shell rendering + global UI behaviour.
   Routes:
     #/                         home
     #/schedule[?season=]       calendar          #/schedule/:roundId   race weekend
     #/results[?season=]        races index       #/results/:roundId[/:session]
     #/standings/drivers|teams[?season=]
     #/drivers  #/drivers/:id   #/teams  #/teams/:id
     #/news[?category=]         #/news/:id
     #/edit[/:section][?id=&season=&round=&session=]
   ========================================================================== */

let lastRoute = '#/';

function parseHash() {
  const h = location.hash || '#/';
  const [path, qs] = h.slice(1).split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts: path.split('/').filter(Boolean), q };
}

function route() {
  const { parts, q } = parseHash();
  const mode = D().meta.mode || 'f1';
  if (parts[0] === 'f2') { parts.shift(); CUR_SERIES = 'f2'; }
  else CUR_SERIES = parts[0] === 'edit' ? 'all' : (mode === 'f2' ? 'f2' : 'f1');
  const [a, b, c] = parts;
  switch (a) {
    case undefined: return pageHome();
    case 'schedule': return b ? pageRound(b) : pageSchedule(q);
    case 'results': return b ? pageRaceResult(b, c) : pageResultsIndex(q);
    case 'standings': return pageStandings(b === 'teams' ? 'teams' : 'drivers', q);
    case 'drivers': return b ? pageDriver(b, q) : pageDrivers(q);
    case 'teams': return b ? pageTeam(b, q) : pageTeams(q);
    case 'lineup': return pageLineup(q);
    case 'showroom': return b === 'grid' ? pageShowroomGrid(q) : pageShowroom(b, q);
    case 'news': return b ? pageArticle(b) : pageNews(q);
    case 'edit': return pageEdit(b, q);
    default: return notFound();
  }
}

let renderCount = 0;
function render() {
  renderCount++;
  const app = document.getElementById('app');
  let page;
  try { page = route(); }
  catch (e) { console.error(e); page = { title: 'Error', nav: '', html: `<div class="wrap page">${emptyState('Something went wrong', e.message, { href: '#/edit', label: 'Open Edit Career' })}</div>` }; }
  app.innerHTML = header(page.nav) + sampleBanner() + `<main id="main">${page.html}</main>` + footer();
  document.body.classList.toggle('series-f2', CUR_SERIES === 'f2');
  // In the F2 section every internal link stays in F2 (Edit Career is shared).
  if (CUR_SERIES === 'f2' && (D().meta.mode || 'f1') === 'both')
    app.querySelectorAll('a[href^="#/"]').forEach(el => { const h = el.getAttribute('href'); if (!/^#\/(edit|f2)(\/|$|\?)/.test(h) && !el.hasAttribute('data-series')) el.setAttribute('href', '#/f2' + h.slice(1)); });
  document.title = `${page.title} · ${ASSET_MANIFEST.brand.siteName}`;
  if (page.after) page.after(app);
}

function onHashChange() {
  const h = location.hash || '#/';
  // in-page anchors (#stats) scroll instead of routing
  if (!h.startsWith('#/')) {
    const el = document.getElementById(decodeURIComponent(h.slice(1)));
    history.replaceState(null, '', lastRoute);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const samePage = h.split('?')[0] === lastRoute.split('?')[0] && h.startsWith('#/edit');
  lastRoute = h;
  closeMenu();
  render();
  if (!samePage) window.scrollTo(0, 0);
}

function closeMenu() {
  const m = document.getElementById('mobile-menu');
  if (m) m.hidden = true;
  document.body.classList.remove('menu-open');
}

/* Global delegated behaviour — survives re-renders. */
document.addEventListener('click', ev => {
  const t = ev.target;
  if (t.closest('[data-menu-open]')) { const m = document.getElementById('mobile-menu'); m.hidden = false; document.body.classList.add('menu-open'); return; }
  if (t.closest('[data-menu-close]')) { closeMenu(); return; }
  const tab = t.closest('[data-tabs] [data-tab]');
  if (tab) {
    const box = tab.closest('[data-tabs]');
    box.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-active', b === tab));
    box.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
  }
});
document.addEventListener('change', ev => {
  const s = ev.target.closest('select[data-nav-select]');
  if (s) location.hash = s.dataset.navSelect.replace('__ID__', encodeURIComponent(s.value));
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeMenu(); });

/* Sticky header compaction on scroll (observed: utility bar hides after scrolling). */
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => { document.body.classList.toggle('scrolled', window.scrollY > 60); ticking = false; });
}, { passive: true });

/* boot */
Store.load(SAMPLE_CAREER);
Motion.apply();
if (window.matchMedia) matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => Motion.apply());
Store.onChange(render);
window.addEventListener('hashchange', onHashChange);
lastRoute = location.hash && location.hash.startsWith('#/') ? location.hash : '#/';
render();
// uploaded images live in IndexedDB; re-render once their object URLs are ready
AssetStore.boot().then(() => { if (Object.keys(AssetStore.urls).length) render(); });
// read-only hooks for the offline QA tools (tools/qa-matrix.mjs); not used by the site itself
window.CareerHubDebug = { data: () => Store.data, draftComposite, resolvePortrait, drawComposite, drawPortrait, lineupAt, FRAME_ASPECT, renderLineupCard, renderTeamCard };
