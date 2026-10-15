/* ==========================================================================
   assets.js — replaceable asset manifest + procedural fallbacks.

   HOW TO REPLACE ART
   1. Put image files in /assets (or use any URL).
   2. Either set the URL on the record in Edit Career (team logo/car, driver
      portrait, article image, round image), or map the record id here in
      ASSET_MANIFEST. Record URL wins, then manifest, then the generated SVG.
   No F1 trademarks or third-party photos are bundled.
   ========================================================================== */

const ASSET_MANIFEST = {
  brand: {
    siteName: 'Career Hub',
    tagline: 'Formula Career Mode',
    logoUrl: '',          // e.g. 'assets/brand/logo.svg' — empty = built-in wordmark
  },
  teams: {
    // team_mclaren: { logo: 'assets/teams/mclaren-logo.png', car: 'assets/teams/mclaren-car.png' },
  },
  drivers: {
    // drv_lando_norris: { portrait: 'assets/drivers/norris.png' },
  },
  rounds: {
    // rnd_2026_01: { image: 'assets/circuits/australia.jpg' },
  },
  articles: {
    // art_r1_report: { image: 'assets/news/r1.jpg' },
  },
};

function assetUrl(kind, rec, field) {
  if (!rec) return '';
  const own = rec[field + 'Url'];
  if (own) return own;
  const m = ASSET_MANIFEST[kind] && ASSET_MANIFEST[kind][rec.id];
  return (m && m[field]) || '';
}

const svgUri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---- brand wordmark (original, not the F1 logo) ------------------------- */
function brandMark() {
  if (ASSET_MANIFEST.brand.logoUrl) return `<img src="${ASSET_MANIFEST.brand.logoUrl}" alt="${ASSET_MANIFEST.brand.siteName}" height="28">`;
  return `<svg class="brandmark" viewBox="0 0 150 30" role="img" aria-label="${ASSET_MANIFEST.brand.siteName}">
    <path d="M10 26 L22 4 H44 L40 11 H27 L25 15 H37 L33 22 H21 L19 26 Z" fill="var(--red)"/>
    <path d="M44 26 L56 4 H64 L55 19 H70 L66 26 Z" fill="var(--red)"/>
    <text x="74" y="21" font-family="Formula1, sans-serif" font-weight="900" font-size="15" fill="#fff" letter-spacing=".5">CAREER</text>
  </svg>`;
}

/* ---- team badge ---------------------------------------------------------- */
function teamBadgeSvg(team) {
  const initials = (team.name || '?').split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${team.color}"/><stop offset="1" stop-color="${team.colorDark || '#000'}"/></linearGradient></defs><circle cx="24" cy="24" r="23" fill="url(#g)" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/><path d="M9 31 L39 17" stroke="rgba(255,255,255,.25)" stroke-width="5"/><text x="24" y="29.5" text-anchor="middle" font-family="Formula1,Arial" font-weight="900" font-size="15" fill="#fff">${initials}</text></svg>`);
}
function teamLogo(team) { return assetUrl('teams', team, 'logo') || teamBadgeSvg(team); }

/* ---- side-profile car in livery ----------------------------------------- */
function carSvg(team, number) {
  const h = hashStr(team.id);
  const accent = ['#ffffff', '#111111', '#f5d000', '#d0d0d0'][h % 4];
  const c = team.color, d = team.colorDark || '#000';
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 130">
  <defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>
  <ellipse cx="262" cy="118" rx="235" ry="7" fill="rgba(0,0,0,.45)"/>
  <path d="M18 92 L30 70 L60 70 L66 62 L46 62 L46 54 L84 54 L92 70 L150 72 L196 60 L232 46 L262 44 L282 58 L300 60 L330 54 L372 66 L428 72 L478 78 L506 88 L508 96 L20 100 Z" fill="url(#b)" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M96 74 L196 62 L232 48" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/>
  <path d="M150 72 L196 60 L232 46 L262 44 L282 58 L250 62 L210 70 Z" fill="rgba(0,0,0,.35)"/>
  <path d="M96 86 L300 78 L470 84 L470 90 L96 94 Z" fill="${accent}" opacity=".85"/>
  <path d="M232 46 Q248 30 266 42" stroke="#1a1a1a" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="252" cy="47" r="7" fill="${accent}"/>
  <rect x="470" y="88" width="44" height="10" rx="2" fill="${d}"/><rect x="12" y="50" width="54" height="8" rx="2" fill="${d}"/>
  <text x="340" y="77" font-family="Formula1,Arial" font-weight="900" font-size="15" fill="${accent}">${number || ''}</text>
  <g fill="#0b0b0e"><circle cx="110" cy="96" r="22"/><circle cx="420" cy="96" r="22"/></g>
  <g fill="none" stroke="#3a3a42" stroke-width="5"><circle cx="110" cy="96" r="12"/><circle cx="420" cy="96" r="12"/></g>
  <g fill="${c}"><circle cx="110" cy="96" r="4"/><circle cx="420" cy="96" r="4"/></g>
</svg>`);
}
function teamCar(team, number) { return assetUrl('teams', team, 'car') || carSvg(team, number); }

/* ---- driver portrait: helmet + overalls in team colours ----------------- */
function portraitSvg(driver, team) {
  const c = (team && team.color) || '#606066', d = (team && team.colorDark) || '#26262b';
  const h = hashStr(driver.id);
  const stripe = ['#ffffff', '#f5d000', '#111111', '#e10600', '#22c7a9'][h % 5];
  const visor = ['#1d2a3a', '#3a2a12', '#0f2e2a', '#2a1238'][(h >> 3) % 4];
  const swoosh = 20 + (h % 30);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
  <defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>
  <linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${visor}"/><stop offset=".6" stop-color="#6b7b8f"/><stop offset="1" stop-color="${visor}"/></linearGradient></defs>
  <path d="M28 240 C30 186 62 170 100 168 C138 170 170 186 172 240 Z" fill="url(#h)"/>
  <path d="M76 170 L100 206 L124 170" fill="none" stroke="${stripe}" stroke-width="6"/>
  <rect x="84" y="150" width="32" height="24" rx="6" fill="#151519"/>
  <path d="M100 30 C146 30 162 66 160 104 C158 136 140 158 100 158 C62 158 42 138 40 104 C38 66 54 30 100 30 Z" fill="url(#h)"/>
  <path d="M44 ${80 + swoosh / 3} C80 ${60 + swoosh} 130 ${40 + swoosh / 2} 160 ${70 + swoosh / 4}" stroke="${stripe}" stroke-width="8" fill="none" opacity=".9"/>
  <path d="M52 94 C70 86 132 86 150 94 L146 118 C120 124 82 124 56 118 Z" fill="url(#v)"/>
  <path d="M60 100 L140 98" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
  <text x="100" y="146" text-anchor="middle" font-family="Formula1,Arial" font-weight="900" font-size="22" fill="${stripe}">${driver.number || ''}</text>
</svg>`);
}
function driverPortrait(driver, team) { return assetUrl('drivers', driver, 'portrait') || portraitSvg(driver, team); }

/* ---- circuit / article image fallbacks: abstract speed-stripe art ------- */
function stripeArt(seedStr, color, label) {
  const h = hashStr(seedStr);
  const a = color || ['#e10600', '#2b6be0', '#22c7a9', '#ff8a1f', '#7458ff'][h % 5];
  const ang = 20 + (h % 25);
  const lines = Array.from({ length: 7 }, (_, i) => `<rect x="${-200 + i * 150 + (h >> i) % 60}" y="-50" width="${18 + ((h >> (i + 2)) % 50)}" height="700" fill="${i % 3 ? 'rgba(255,255,255,.06)' : a}" opacity="${i % 3 ? 1 : .55}" transform="rotate(${ang} 400 225)"/>`).join('');
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="r" cx="${30 + h % 40}%" cy="40%" r="80%"><stop offset="0" stop-color="${a}" stop-opacity=".55"/><stop offset="1" stop-color="#15151e" stop-opacity="1"/></radialGradient></defs>
  <rect width="800" height="450" fill="#15151e"/><rect width="800" height="450" fill="url(#r)"/>${lines}
  ${label ? `<text x="40" y="410" font-family="Formula1,Arial" font-weight="900" font-size="64" fill="rgba(255,255,255,.08)">${String(label).toUpperCase().replace(/&/g, '&amp;').replace(/</g, '')}</text>` : ''}
</svg>`);
}
/* ---- <img> helpers: real images (library / URL) get .is-photo or .is-logo so CSS can crop them like F1.com */
const isRealImg = u => !!u && !String(u).startsWith('data:');
function logoImg(team, cls) {
  const u = teamLogo(team);
  return `<img class="${cls || ''}${isRealImg(u) ? ' is-logo' : ''}" src="${u}" alt="" style="--tc:${team.color}">`;
}
function numberArt(driver, cls) {
  const u = driver.numberUrl || (ASSET_MANIFEST.drivers[driver.id] || {}).number;
  return u ? `<img class="${cls} is-num" src="${u}" alt="${driver.number ?? ''}">` : `<span class="${cls}">${driver.number ?? ''}</span>`;
}
/* first real trackside photo of any driver in the list (used for article fallbacks) */
function driverPhoto(driverIds, seed) {
  const pool = (driverIds || []).flatMap(id => ((byId(Store.data.drivers, id) || {}).photoUrls || []));
  return pool.length ? pool[hashStr(seed) % pool.length] : '';
}

function roundImage(round) { return assetUrl('rounds', round, 'image') || stripeArt(round.id, null, round.name); }

/* ---- flags (simplified geometric versions) ------------------------------ */
const FLAGS = {
  ITA: ['v', '#009246', '#ffffff', '#ce2b37'], FRA: ['v', '#0055a4', '#ffffff', '#ef4135'], BEL: ['v', '#000000', '#fdda24', '#ef3340'],
  IRL: ['v', '#169b62', '#ffffff', '#ff883e'], MEX: ['v', '#006847', '#ffffff', '#ce1126'],
  GER: ['h', '#000000', '#dd0000', '#ffce00'], NED: ['h', '#ae1c28', '#ffffff', '#21468b'], AUT: ['h', '#ed2939', '#ffffff', '#ed2939'],
  ARG: ['h', '#74acdf', '#ffffff', '#74acdf'], IND: ['h', '#ff9933', '#ffffff', '#138808'], ESP: ['h3', '#aa151b', '#f1bf00', '#aa151b'],
  HUN: ['h', '#ce2939', '#ffffff', '#477050'], RUS: ['h', '#ffffff', '#0039a6', '#d52b1e'], THA: ['h', '#a51931', '#f4f5f8', '#2d2a4a'],
  MON: ['h2', '#ce1126', '#ffffff'], MCO: ['h2', '#ce1126', '#ffffff'], POL: ['h2', '#ffffff', '#dc143c'], IDN: ['h2', '#ce1126', '#ffffff'],
  FIN: ['x', '#ffffff', '#003580'], DEN: ['x', '#c8102e', '#ffffff'], SWE: ['x', '#006aa7', '#fecc00'], NOR: ['x', '#ba0c2f', '#ffffff'],
  JPN: ['d', '#ffffff', '#bc002d'], CHN: ['s', '#de2910', '#ffde00'], SAU: ['f', '#006c35'], BHR: ['f2', '#ffffff', '#ce1126'],
  QAT: ['f2', '#ffffff', '#8a1538'], CAN: ['c', '#d52b1e', '#ffffff'], SUI: ['p', '#da291c', '#ffffff'], CZE: ['cz'],
  GBR: ['uk'], AUS: ['au'], NZL: ['au'], USA: ['us'], BRA: ['br'], UAE: ['ae'], ARE: ['ae'], AZE: ['h', '#0092bc', '#e4002b', '#00af66'],
  SGP: ['h2', '#ef3340', '#ffffff'], POR: ['pt'], CHI: ['h2', '#ffffff', '#d52b1e'], COL: ['h3', '#fcd116', '#003893', '#ce1126'],
};
function flagSvg(code) {
  const f = FLAGS[code];
  const W = 30, H = 20;
  let b = '';
  if (!f) b = `<rect width="30" height="20" fill="#47464c"/><text x="15" y="13.5" font-size="8" font-family="Arial" font-weight="700" text-anchor="middle" fill="#fff">${(code || '?').slice(0, 3)}</text>`;
  else switch (f[0]) {
    case 'v': b = `<rect width="10" height="20" fill="${f[1]}"/><rect x="10" width="10" height="20" fill="${f[2]}"/><rect x="20" width="10" height="20" fill="${f[3]}"/>`; break;
    case 'h': b = `<rect width="30" height="7" fill="${f[1]}"/><rect y="6.66" width="30" height="7" fill="${f[2]}"/><rect y="13.33" width="30" height="6.7" fill="${f[3]}"/>${code === 'IND' ? '<circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" stroke-width=".8"/>' : ''}`; break;
    case 'h3': b = `<rect width="30" height="20" fill="${f[1]}"/><rect y="5" width="30" height="10" fill="${f[2]}"/>`; break;
    case 'h2': b = `<rect width="30" height="10" fill="${f[1]}"/><rect y="10" width="30" height="10" fill="${f[2]}"/>`; break;
    case 'x': b = `<rect width="30" height="20" fill="${f[1]}"/><rect x="8" width="4" height="20" fill="${f[2]}"/><rect y="8" width="30" height="4" fill="${f[2]}"/>`; break;
    case 'd': b = `<rect width="30" height="20" fill="${f[1]}"/><circle cx="15" cy="10" r="6" fill="${f[2]}"/>`; break;
    case 's': b = `<rect width="30" height="20" fill="${f[1]}"/><circle cx="6" cy="6" r="3" fill="${f[2]}"/>`; break;
    case 'f': b = `<rect width="30" height="20" fill="${f[1]}"/><rect x="7" y="11" width="16" height="1.6" fill="#fff"/>`; break;
    case 'f2': b = `<rect width="30" height="20" fill="${f[2]}"/><path d="M0 0 H9 L12 2.5 L9 5 L12 7.5 L9 10 L12 12.5 L9 15 L12 17.5 L9 20 H0Z" fill="${f[1]}"/>`; break;
    case 'c': b = `<rect width="30" height="20" fill="${f[2]}"/><rect width="7.5" height="20" fill="${f[1]}"/><rect x="22.5" width="7.5" height="20" fill="${f[1]}"/><path d="M15 4 L17 9 L19.5 8 L18 13 H12 L10.5 8 L13 9Z" fill="${f[1]}"/>`; break;
    case 'p': b = `<rect width="30" height="20" fill="${f[1]}"/><rect x="13" y="4" width="4" height="12" fill="${f[2]}"/><rect x="9" y="8" width="12" height="4" fill="${f[2]}"/>`; break;
    case 'cz': b = `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 L14 10 L0 20Z" fill="#11457e"/>`; break;
    case 'uk': b = `<rect width="30" height="20" fill="#012169"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#c8102e" stroke-width="1.5"/><path d="M15 0 V20 M0 10 H30" stroke="#fff" stroke-width="6"/><path d="M15 0 V20 M0 10 H30" stroke="#c8102e" stroke-width="3.4"/>`; break;
    case 'au': b = `<rect width="30" height="20" fill="#012169"/><g transform="scale(.5)"><path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" stroke-width="4"/><path d="M15 0 V20 M0 10 H30" stroke="#fff" stroke-width="6"/><path d="M15 0 V20 M0 10 H30" stroke="#c8102e" stroke-width="3.4"/></g><g fill="#fff"><circle cx="7.5" cy="15" r="1.8"/><circle cx="23" cy="5" r="1"/><circle cx="20" cy="10" r="1"/><circle cx="25.5" cy="9" r="1"/><circle cx="23" cy="16" r="1.1"/></g>`; break;
    case 'us': b = `<rect width="30" height="20" fill="#fff"/>${[0, 2, 4, 6, 8, 10, 12].map(i => `<rect y="${i * 1.54}" width="30" height="1.54" fill="#b22234"/>`).join('')}<rect width="13" height="10.8" fill="#3c3b6e"/>`; break;
    case 'br': b = `<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5 L27 10 L15 17.5 L3 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>`; break;
    case 'ae': b = `<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#00732f"/><rect y="13.3" width="30" height="6.7" fill="#000"/><rect width="8" height="20" fill="#ff0000"/>`; break;
    case 'pt': b = `<rect width="30" height="20" fill="#ff0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.4" fill="#ffcc00"/>`; break;
  }
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${b}</svg>`);
}

const COUNTRY_NAMES = {
  ITA: 'Italy', FRA: 'France', BEL: 'Belgium', GER: 'Germany', NED: 'Netherlands', AUT: 'Austria', ARG: 'Argentina', IND: 'India',
  ESP: 'Spain', MON: 'Monaco', POL: 'Poland', FIN: 'Finland', DEN: 'Denmark', JPN: 'Japan', CHN: 'China', SAU: 'Saudi Arabia',
  BHR: 'Bahrain', CAN: 'Canada', CZE: 'Czechia', GBR: 'United Kingdom', AUS: 'Australia', USA: 'United States', BRA: 'Brazil',
  MEX: 'Mexico', SUI: 'Switzerland', NZL: 'New Zealand', THA: 'Thailand', SWE: 'Sweden', NOR: 'Norway', QAT: 'Qatar', SGP: 'Singapore',
  HUN: 'Hungary', AZE: 'Azerbaijan', UAE: 'United Arab Emirates', POR: 'Portugal', COL: 'Colombia', CHI: 'Chile', IRL: 'Ireland', IDN: 'Indonesia',
};
