// Generates src/sample-data.json — the clearly-labelled FICTIONAL sample season.
// Deterministic (seeded RNG), so re-running gives identical records and IDs.
// Run:  node tools/make-sample.mjs
import fs from 'node:fs';
import { ARTICLES } from './sample-articles.mjs';
import { realGrid, SAMPLE_ROUND_IMAGES } from './real-grid-2026.mjs';

let seed = 20300614;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const SEASON = 'sea_2030';
const RULE = 'pts_standard';

const teams = [
  // id, name, full name, colour, dark, pace(0..1), base, principal, tech, chassis, PU, firstEntry
  ['team_vantage', 'Vantage', 'Vantage Racing Team', '#2b6be0', '#0f2f73', .86, 'Brackley, United Kingdom', 'Elena Hart', 'Marcus Doyle', 'VR-30', 'Halden', 2019],
  ['team_aurora', 'Scuderia Aurora', 'Scuderia Aurora Corse', '#e0172f', '#6e0613', .92, 'Modena, Italy', 'Giulio Benedetti', 'Sara Conti', 'SA-71', 'Aurora', 1998],
  ['team_halcyon', 'Halcyon', 'Halcyon Grand Prix', '#22c7a9', '#065e4f', .95, 'Stuttgart, Germany', 'Katrin Vogel', 'Ben Ashworth', 'HG-09', 'Halden', 2010],
  ['team_kestrel', 'Kestrel', 'Kestrel Motorsport', '#ff8a1f', '#8a3d00', .88, 'Woking, United Kingdom', 'James Corrigan', 'Priya Nair', 'K-30', 'Halden', 2004],
  ['team_ironbridge', 'Ironbridge', 'Ironbridge F1 Team', '#7b8794', '#2b3139', .70, 'Silverstone, United Kingdom', 'Tom Ashby', 'Ines Duarte', 'IB-6', 'Aurora', 2016],
  ['team_solenne', 'Solenne', 'Solenne Racing', '#ec4f9a', '#6d1243', .74, 'Enstone, United Kingdom', 'Claire Moreau', 'Yusuf Kaya', 'SR-30', 'Renard', 2021],
  ['team_northlight', 'Northlight', 'Northlight Racing', '#35a853', '#11481f', .78, 'Hinwil, Switzerland', 'Anders Holm', 'Lena Fischer', 'NL-04', 'Aurora', 2012],
  ['team_cobalt', 'Cobalt', 'Cobalt Dynamics F1', '#7458ff', '#2b1a8c', .80, 'Kannapolis, United States', 'Ryan Mercer', 'Hana Ito', 'CD-3', 'Renard', 2026],
  ['team_meridian', 'Meridian', 'Meridian Racing', '#f2c200', '#6b5600', .66, 'Faenza, Italy', 'Paolo Ricci', 'Ewa Nowak', 'MR-12', 'Halden', 2007],
  ['team_talon', 'Talon', 'Talon Grand Prix', '#9a2f2f', '#3e0f0f', .72, 'Milton Keynes, United Kingdom', 'Hugo Brandt', 'Neil Patel', 'TG-2', 'Renard', 2024],
];

const drivers = [
  // id, first, last, code, number, nat, dob, birthplace, skill(-1..1)
  ['drv_marchetti', 'Theo', 'Marchetti', 'MAR', 7, 'ITA', '2004-03-12', 'Bologna, Italy', .55],
  ['drv_brandt', 'Lukas', 'Brandt', 'BRN', 21, 'GER', '2001-09-02', 'Cologne, Germany', .25],
  ['drv_ortega', 'Rafael', 'Ortega', 'ORT', 14, 'ESP', '1998-06-21', 'Valencia, Spain', .6],
  ['drv_hayes', 'Callum', 'Hayes', 'HAY', 4, 'GBR', '2002-11-30', 'Leeds, United Kingdom', .4],
  ['drv_lindqvist', 'Mika', 'Lindqvist', 'LIN', 9, 'FIN', '1999-01-17', 'Espoo, Finland', .5],
  ['drv_fontaine', 'Jules', 'Fontaine', 'FON', 31, 'FRA', '2003-05-08', 'Lyon, France', .35],
  ['drv_moriyama', 'Kenji', 'Moriyama', 'MOR', 11, 'JPN', '2000-07-14', 'Osaka, Japan', .45],
  ['drv_grant', 'Oliver', 'Grant', 'GRA', 26, 'AUS', '2001-02-03', 'Perth, Australia', .3],
  ['drv_novak', 'Tomáš', 'Novák', 'NOV', 18, 'CZE', '1997-10-25', 'Brno, Czechia', .15],
  ['drv_okafor', 'Daniel', 'Okafor', 'OKA', 45, 'GBR', '2005-04-19', 'London, United Kingdom', .35],
  ['drv_ferrer', 'Lucía', 'Ferrer', 'FER', 33, 'ARG', '2003-12-01', 'Rosario, Argentina', .2],
  ['drv_lambert', 'Pierre', 'Lambert', 'LAM', 5, 'BEL', '1996-08-11', 'Liège, Belgium', .1],
  ['drv_eriksen', 'Nils', 'Eriksen', 'ERI', 22, 'DEN', '2002-03-27', 'Aarhus, Denmark', .2],
  ['drv_rocha', 'Mateus', 'Rocha', 'ROC', 8, 'BRA', '2004-06-05', 'Curitiba, Brazil', .25],
  ['drv_mehta', 'Arjun', 'Mehta', 'MEH', 17, 'IND', '2001-12-15', 'Pune, India', .15],
  ['drv_cole', 'Ethan', 'Cole', 'COL', 2, 'USA', '2000-04-09', 'Austin, United States', .2],
  ['drv_vermeer', 'Hugo', 'Vermeer', 'VER', 19, 'NED', '2003-02-22', 'Utrecht, Netherlands', .1],
  ['drv_wagner', 'Felix', 'Wagner', 'WAG', 24, 'AUT', '2005-09-13', 'Graz, Austria', .0],
  ['drv_whitaker', 'Leo', 'Whitaker', 'WHI', 10, 'CAN', '1999-11-04', 'Calgary, Canada', .15],
  ['drv_rossi', 'Antoine', 'Rossi', 'ROS', 16, 'MON', '2002-01-28', 'Monte Carlo, Monaco', .1],
  ['drv_kowalska', 'Ana', 'Kowalska', 'KOW', 50, 'POL', '2006-05-30', 'Kraków, Poland', .2],
];

// Race seats. Transfers: Okafor ⇄ Rossi swap from round 6; Kowalska replaces Grant from round 8.
const assignments = [
  ['team_vantage', 'drv_marchetti'], ['team_vantage', 'drv_brandt'],
  ['team_aurora', 'drv_ortega'], ['team_aurora', 'drv_hayes'],
  ['team_halcyon', 'drv_lindqvist'], ['team_halcyon', 'drv_fontaine'],
  ['team_kestrel', 'drv_moriyama'], ['team_kestrel', 'drv_grant', 1, 7],
  ['team_kestrel', 'drv_kowalska', 8, null],
  ['team_ironbridge', 'drv_novak'], ['team_ironbridge', 'drv_okafor', 1, 5], ['team_ironbridge', 'drv_rossi', 6, null],
  ['team_solenne', 'drv_ferrer'], ['team_solenne', 'drv_lambert'],
  ['team_northlight', 'drv_eriksen'], ['team_northlight', 'drv_rocha'],
  ['team_cobalt', 'drv_mehta'], ['team_cobalt', 'drv_cole'],
  ['team_meridian', 'drv_vermeer'], ['team_meridian', 'drv_wagner'],
  ['team_talon', 'drv_whitaker'], ['team_talon', 'drv_rossi', 1, 5], ['team_talon', 'drv_okafor', 6, null],
].map(([teamId, driverId, from = 1, to = null], i) => ({
  id: `asg_2030_${String(i + 1).padStart(2, '0')}`, seasonId: SEASON, driverId, teamId, fromRound: from, toRound: to, role: 'race',
}));
assignments.push({ id: 'asg_2030_res1', seasonId: SEASON, driverId: 'drv_kowalska', teamId: 'team_kestrel', fromRound: 1, toRound: 7, role: 'reserve' });

const calendar = [
  // country, code, official name, circuit, city, laps, km, start, sprint
  ['Bahrain', 'BHR', 'Bahrain Grand Prix', 'Bahrain International Circuit', 'Sakhir', 57, 5.412, '2030-03-01'],
  ['Saudi Arabia', 'SAU', 'Saudi Arabian Grand Prix', 'Jeddah Corniche Circuit', 'Jeddah', 50, 6.174, '2030-03-08'],
  ['Australia', 'AUS', 'Australian Grand Prix', 'Albert Park Circuit', 'Melbourne', 58, 5.278, '2030-03-22'],
  ['Japan', 'JPN', 'Japanese Grand Prix', 'Suzuka International Racing Course', 'Suzuka', 53, 5.807, '2030-04-05'],
  ['China', 'CHN', 'Chinese Grand Prix', 'Shanghai International Circuit', 'Shanghai', 56, 5.451, '2030-04-19', true],
  ['United States', 'USA', 'Miami Grand Prix', 'Miami International Autodrome', 'Miami', 57, 5.412, '2030-05-03', true],
  ['Monaco', 'MON', 'Monaco Grand Prix', 'Circuit de Monaco', 'Monte Carlo', 78, 3.337, '2030-05-24'],
  ['Spain', 'ESP', 'Spanish Grand Prix', 'Circuit de Barcelona-Catalunya', 'Barcelona', 66, 4.657, '2030-06-07'],
  ['Canada', 'CAN', 'Canadian Grand Prix', 'Circuit Gilles Villeneuve', 'Montréal', 70, 4.361, '2030-06-14'],
  ['Austria', 'AUT', 'Austrian Grand Prix', 'Red Bull Ring', 'Spielberg', 71, 4.318, '2030-06-28', true],
  ['Great Britain', 'GBR', 'British Grand Prix', 'Silverstone Circuit', 'Silverstone', 52, 5.891, '2030-07-05'],
  ['Belgium', 'BEL', 'Belgian Grand Prix', 'Circuit de Spa-Francorchamps', 'Spa', 44, 7.004, '2030-07-26'],
];
const COMPLETED = 8;
const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };

const rounds = calendar.map(([country, cc, name, circuit, city, laps, km, sunday, sprint], i) => {
  const fri = addDays(sunday, -2), sat = addDays(sunday, -1);
  const sessions = sprint
    ? [['Practice 1', fri, '12:30'], ['Sprint Qualifying', fri, '16:30'], ['Sprint', sat, '12:00'], ['Qualifying', sat, '16:00'], ['Race', sunday, '15:00']]
    : [['Practice 1', fri, '12:30'], ['Practice 2', fri, '16:00'], ['Practice 3', sat, '12:30'], ['Qualifying', sat, '16:00'], ['Race', sunday, '15:00']];
  return {
    id: `rnd_2030_${String(i + 1).padStart(2, '0')}`, seasonId: SEASON, round: i + 1,
    name: country, country, countryCode: cc, officialName: `Career ${name} 2030`, circuit, city,
    laps, lengthKm: km, dateStart: fri, dateEnd: sunday, sprint: !!sprint,
    sessions: sessions.map(([label, date, time]) => ({ label, date, time })),
    status: i < COMPLETED ? 'completed' : 'scheduled', imageUrl: '',
  };
});

const T = Object.fromEntries(teams.map(t => [t[0], t]));
const D = Object.fromEntries(drivers.map(d => [d[0], d]));
const fmtRace = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = (s % 60).toFixed(3).padStart(6, '0'); return `${h}:${String(m).padStart(2, '0')}:${r}`; };
const fmtLap = s => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toFixed(3).padStart(6, '0')}`; };

function lineup(roundNo) {
  return assignments.filter(a => a.role === 'race' && a.fromRound <= roundNo && (a.toRound == null || a.toRound >= roundNo));
}
const perf = (a, noise) => T[a.teamId][5] * 1.6 + D[a.driverId][8] * .35 + gauss() * noise;

const results = [];
rounds.slice(0, COMPLETED).forEach(rd => {
  const grid = lineup(rd.round).map(a => ({ a, q: perf(a, .12) })).sort((x, y) => y.q - x.q);
  const lapBase = 70 + rd.lengthKm * 3.3;
  results.push({
    id: `res_${rd.id.slice(4)}_qualifying`, roundId: rd.id, session: 'qualifying',
    entries: grid.map((g, i) => ({ driverId: g.a.driverId, teamId: g.a.teamId, status: 'FIN', grid: null, laps: null, time: fmtLap(lapBase + i * .09 + rnd() * .05), fastestLap: false, points: null })),
  });
  const run = (sessionLaps, noise, dnfRate) => {
    const field = grid.map((g, i) => ({ ...g, gridPos: i + 1, r: perf(g.a, noise) - i * .012, dnf: rnd() < dnfRate }));
    const fin = field.filter(f => !f.dnf).sort((x, y) => y.r - x.r);
    const out = field.filter(f => f.dnf).map(f => ({ ...f, lapOut: Math.floor(sessionLaps * (.1 + rnd() * .8)) })).sort((x, y) => y.lapOut - x.lapOut);
    const total = sessionLaps * lapBase * 1.04;
    let gap = 0;
    const flIdx = Math.floor(rnd() * Math.min(8, fin.length));
    const entries = fin.map((f, i) => {
      if (i) gap += .6 + rnd() * (i < 5 ? 6 : 9);
      const lapped = gap > lapBase * 1.02;
      return { driverId: f.a.driverId, teamId: f.a.teamId, status: 'FIN', grid: f.gridPos, laps: lapped ? sessionLaps - 1 : sessionLaps,
        time: i === 0 ? fmtRace(total) : lapped ? '+1 Lap' : `+${gap.toFixed(3)}s`, fastestLap: i === flIdx, points: null };
    }).concat(out.map(f => ({ driverId: f.a.driverId, teamId: f.a.teamId, status: f.lapOut < 1 ? 'DNS' : 'DNF', grid: f.gridPos, laps: Math.max(0, f.lapOut),
      time: f.lapOut < 1 ? 'DNS' : ['Engine', 'Collision', 'Gearbox', 'Hydraulics', 'Accident', 'Brakes'][Math.floor(rnd() * 6)], fastestLap: false, points: null })));
    return entries;
  };
  if (rd.sprint) {
    const sprintLaps = Math.round(rd.laps / 3);
    const e = run(sprintLaps, .2, .04); e.forEach(x => { x.fastestLap = false; });
    results.push({ id: `res_${rd.id.slice(4)}_sprint`, roundId: rd.id, session: 'sprint', entries: e });
  }
  results.push({ id: `res_${rd.id.slice(4)}_race`, roundId: rd.id, session: 'race', entries: run(rd.laps, .22, .07) });
});

const REAL = realGrid(fs);
rounds.forEach(r => { const k = SAMPLE_ROUND_IMAGES[r.name]; const p = k && `assets/f1com/circuits/${k}.webp`; if (p && fs.existsSync(new URL('../' + p, import.meta.url))) r.imageUrl = p; });

const career = {
  schemaVersion: 1,
  meta: {
    careerName: 'Sample Career — Vantage Racing',
    isSample: true,
    sampleNotice: 'The 2030 season is invented: its teams, drivers, results and articles are not real. The 2026 Real Grid season uses the real line-up and calendar, with no results.',
    activeSeasonId: SEASON, playerTeamId: 'team_vantage', updatedAt: null,
  },
  seasons: [{ id: SEASON, year: 2030, name: '2030 Career Season', pointsRuleId: RULE, notes: 'Season one of the sample career.' }, REAL.season],
  pointsRules: [
    { id: RULE, name: 'Standard (25-18-15…)', race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [8, 7, 6, 5, 4, 3, 2, 1], fastestLap: { points: 1, maxPosition: 10 } },
    { id: 'pts_classic', name: 'Classic (10-8-6…)', race: [10, 8, 6, 5, 4, 3, 2, 1], sprint: [], fastestLap: { points: 0, maxPosition: 10 } },
  ],
  teams: teams.map(([id, name, fullName, color, colorDark, , base, principal, technicalChief, chassis, powerUnit, firstEntry]) => ({
    id, name, fullName, color, colorDark, base, principal, technicalChief, chassis, powerUnit, firstEntry, championships: 0, logoUrl: '', carUrl: '', bio: '',
  })).concat(REAL.teams),
  drivers: drivers.map(([id, firstName, lastName, code, number, nationality, dob, birthplace]) => ({
    id, firstName, lastName, code, number, nationality, dob, birthplace, championships: 0, portraitUrl: '', bio: '',
  })).concat(REAL.drivers),
  assignments: assignments.concat(REAL.assignments), rounds: rounds.concat(REAL.rounds), results,
  articles: ARTICLES,
};

fs.writeFileSync(new URL('../src/sample-data.json', import.meta.url), JSON.stringify(career, null, 1));

// Summary for writing articles
for (const r of results.filter(r => r.session !== 'qualifying')) {
  const rd = rounds.find(x => x.id === r.roundId);
  const top = r.entries.slice(0, 3).map(e => D[e.driverId][2] + ' (' + T[e.teamId][1] + ')').join(', ');
  const dnf = r.entries.filter(e => e.status !== 'FIN').map(e => D[e.driverId][2] + ':' + e.time).join(' ');
  const pole = results.find(x => x.roundId === r.roundId && x.session === 'qualifying').entries[0];
  console.log(`R${rd.round} ${rd.name} ${r.session} | pole ${D[pole.driverId][2]} | ${top} | out: ${dnf}`);
}
console.log('players:', results.filter(r=>r.session==='race').map(r => r.entries.findIndex(e=>e.driverId==='drv_marchetti')+1+'/'+(r.entries.findIndex(e=>e.driverId==='drv_brandt')+1)).join(' '));
