// Bundles src/* into a single offline index.html (no npm dependencies).
// Run:  node build.mjs
import fs from 'node:fs';
const r = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const b64 = p => fs.readFileSync(new URL(p, import.meta.url)).toString('base64');

// Formula1 typeface files supplied by the user (Downloads/F1-Font-Family), embedded so the page works from file://
const face = (family, file, weight) =>
  `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64('./assets/fonts/' + file)}) format("truetype");font-weight:${weight};font-style:normal;font-display:swap}`;
const fonts = [
  face('Formula1', 'Formula1-Regular-1.ttf', 400),
  face('Formula1', 'Formula1-Bold_web.ttf', '500 700'),
  face('Formula1', 'Formula1-Black.ttf', 900),
  face('Formula1Wide', 'Formula1-Wide.ttf', '400 900'),
].join('\n');

// list of locally downloaded images (assets/f1com/**) for the Edit Career image pickers
const walk = d => fs.existsSync(new URL(d, import.meta.url)) ? fs.readdirSync(new URL(d, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]) : [];
const library = walk('./assets/f1com/').map(p => p.slice(2)).filter(p => /\.(webp|png|jpe?g|svg)$/i.test(p) && !p.includes('/masks/')).sort();
const sample = JSON.stringify(JSON.parse(r('./src/sample-data.json')));
const html = r('./src/index.template.html')
  .replace('/*FONTS*/', () => fonts)
  .replace('/*TOKENS*/', () => r('./src/tokens.css'))
  .replace('/*STYLES*/', () => r('./src/styles.css'))
  .replace('/*SHOWROOMCSS*/', () => r('./src/showroom.css'))
  .replace('/*LIBRARY*/', () => JSON.stringify(library))
  .replace('/*FLAGS*/', () => JSON.stringify(JSON.parse(r('./src/flags.json'))))
  .replace('/*FIT*/', () => fs.existsSync(new URL('./tools/portrait-fit.json', import.meta.url)) ? JSON.stringify(JSON.parse(r('./tools/portrait-fit.json'))) : '{}')
  .replace('/*SAMPLE*/', () => sample.replace(/<\/script/gi, '<\\/script'))
  .replace('/*STORE*/', () => r('./src/store.js'))
  .replace('/*SELECTORS*/', () => r('./src/selectors.js'))
  .replace('/*ASSETS*/', () => r('./src/assets.js'))
  .replace('/*ASSETSTORE*/', () => r('./src/assetstore.js'))
  .replace('/*NECKFIT*/', () => r('./src/neckfit.js'))
  .replace('/*PORTRAITS*/', () => r('./src/portraits.js'))
  .replace('/*COMPONENTS*/', () => r('./src/components.js'))
  .replace('/*PAGES*/', () => r('./src/pages.js'))
  .replace('/*MATRIX*/', () => r('./src/matrix.js'))
  .replace('/*NEWSGEN*/', () => r('./src/newsgen.js'))
  .replace('/*SHOWROOM*/', () => r('./src/showroom.js'))
  .replace('/*EDITOR*/', () => r('./src/editor.js'))
  .replace('/*STUDIO*/', () => r('./src/studio.js'))
  .replace('/*APP*/', () => r('./src/app.js'));
fs.writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('library images:', library.length);
console.log('index.html', (html.length / 1024).toFixed(0), 'KB');
