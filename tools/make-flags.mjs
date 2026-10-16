// Builds src/flags.json from the flag-icons package (MIT, github.com/lipis/flag-icons).
// Run:  npm i flag-icons --prefix <tmp>  then  node tools/make-flags.mjs <tmp>/node_modules/flag-icons
import fs from 'node:fs';
const dir = process.argv[2] + '/flags/4x3/';
// 3-letter codes used by the site (FIA/IOC style plus ISO aliases) -> ISO 3166 alpha-2
const MAP = {
  ITA: 'it', FRA: 'fr', BEL: 'be', GER: 'de', DEU: 'de', NED: 'nl', NLD: 'nl', AUT: 'at', ARG: 'ar', IND: 'in', ESP: 'es', MON: 'mc', MCO: 'mc',
  POL: 'pl', FIN: 'fi', DEN: 'dk', DNK: 'dk', JPN: 'jp', CHN: 'cn', SAU: 'sa', KSA: 'sa', BHR: 'bh', CAN: 'ca', CZE: 'cz', GBR: 'gb', AUS: 'au',
  USA: 'us', BRA: 'br', MEX: 'mx', SUI: 'ch', CHE: 'ch', NZL: 'nz', THA: 'th', SWE: 'se', NOR: 'no', QAT: 'qa', SGP: 'sg', HUN: 'hu',
  AZE: 'az', UAE: 'ae', ARE: 'ae', POR: 'pt', PRT: 'pt', COL: 'co', CHI: 'cl', CHL: 'cl', IRL: 'ie', IDN: 'id', RSA: 'za', ZAF: 'za',
  RUS: 'ru', KOR: 'kr', MAS: 'my', MYS: 'my', VEN: 've', URU: 'uy', URY: 'uy', EST: 'ee', LIE: 'li', ISR: 'il',
  PAR: 'py', PRY: 'py', BGR: 'bg', PER: 'pe', ROM: 'ro', HKG: 'hk', PHI: 'ph', PHL: 'ph', CYP: 'cy', MLT: 'mt',
  TUR: 'tr', VIE: 'vn', VNM: 'vn', MAR: 'ma', ISL: 'is', LUX: 'lu', GRE: 'gr', GRC: 'gr', ROU: 'ro', BUL: 'bg', SLO: 'si', SVK: 'sk', UKR: 'ua', LAT: 'lv', LTU: 'lt',
};
const out = { codes: MAP, svg: {} };
for (const iso of new Set(Object.values(MAP))) out.svg[iso] = fs.readFileSync(dir + iso + '.svg', 'utf8').replace(/\s*\n\s*/g, ' ').trim();
fs.writeFileSync(new URL('../src/flags.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out.svg).length, 'flags,', (JSON.stringify(out).length / 1024).toFixed(0), 'KB');
