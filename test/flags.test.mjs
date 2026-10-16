// node test/flags.test.mjs — every nationality used by the starter career has a real flag and a country name.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const flags = JSON.parse(read('flags.json'));
const names = read('assets.js');
const sample = JSON.parse(read('sample-data.json'));
const codes = [...new Set(sample.drivers.map(d => d.nationality))];
codes.forEach(code => {
  assert.ok(flags.codes[code] && flags.svg[flags.codes[code]], 'no flag for ' + code);
  assert.match(names, new RegExp(`\\b${code}: '`), 'no country name for ' + code);
});
console.log(`ok - ${codes.length} nationalities have a flag and a name\n\n1 passed`);
