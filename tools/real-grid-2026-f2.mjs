// Real 2026 FIA Formula 2 grid, read from fiaformula2.com on 16 Oct 2026: drivers, teams, calendar.
// Images are local copies in assets/f2/, downloaded for personal local use (see tools/f2-images.tsv).
// Academies come from the badges and liveries on each driver's 2026 suit. Edit them in Edit Career.
// No results are included.
export const F2_SEASON = 'sea_f2_2026';
const IMG = 'assets/f2/';

// slug, name, fullName, colour, dark, base, image key
const T = [
  ['invicta', 'Invicta Racing', 'Invicta Racing', '#f5d000', '#5c4e00', 'Silverstone, United Kingdom', 'invictaracing'],
  ['hitech', 'Hitech', 'Hitech TGR', '#e4e4e4', '#5a5a5a', 'Silverstone, United Kingdom', 'hitech'],
  ['campos', 'Campos Racing', 'Campos Racing', '#d6001c', '#5a000c', 'Alzira, Spain', 'camposracing'],
  ['dams', 'DAMS Lucas Oil', 'DAMS Lucas Oil', '#2fc1c9', '#0e4a4e', 'Le Mans, France', 'damslucasoil'],
  ['mp', 'MP Motorsport', 'MP Motorsport', '#ff6a13', '#6a2a00', 'Westmaas, Netherlands', 'mpmotorsport'],
  ['prema', 'Prema Racing', 'Prema Racing', '#e10600', '#5a0200', 'Grisignano di Zocco, Italy', 'premaracing'],
  ['rodin', 'Rodin Motorsport', 'Rodin Motorsport', '#3a3a3a', '#111111', 'Farnham, United Kingdom', 'rodinmotorsport'],
  ['art', 'ART Grand Prix', 'ART Grand Prix', '#9a9a9a', '#3a3a3a', 'Villeneuve-la-Guyonnière, France', 'artgrandprix'],
  ['aix', 'AIX Racing', 'AIX Racing', '#5fd35f', '#1d5a1d', 'Prague, Czechia', 'aixracing'],
  ['trident', 'Trident', 'Trident Motorsport', '#1f4fc0', '#0b1e4a', 'Pozzolo Formigaro, Italy', 'trident'],
  ['var', 'Van Amersfoort Racing', 'Van Amersfoort Racing', '#ff7a1a', '#5a2600', 'Zeddam, Netherlands', 'vanamersfoortracing'],
];

// slug, team, first, last, code, number, nationality, dob(dd/mm/yyyy), academy (F1 team slug or '')
const DR = [
  ['rafael-camara', 'invicta', 'Rafael', 'Câmara', 'CAM', 1, 'BRA', '05/05/2005', 'ferrari'],
  ['joshua-durksen', 'invicta', 'Joshua', 'Dürksen', 'DUR', 2, 'PAR', '27/10/2003', ''],
  ['ritomo-miyata', 'hitech', 'Ritomo', 'Miyata', 'MIY', 3, 'JPN', '10/08/1999', 'haas'],
  ['colton-herta', 'hitech', 'Colton', 'Herta', 'HER', 4, 'USA', '30/03/2000', 'cadillac'],
  ['noel-leon', 'campos', 'Noel', 'León', 'LEO', 5, 'MEX', '21/12/2004', ''],
  ['nikola-tsolov', 'campos', 'Nikola', 'Tsolov', 'TSO', 6, 'BUL', '21/12/2006', 'red_bull_racing'],
  ['dino-beganovic', 'dams', 'Dino', 'Beganovic', 'BEG', 7, 'SWE', '19/01/2004', 'ferrari'],
  ['roman-bilinski', 'dams', 'Roman', 'Bilinski', 'BIL', 8, 'POL', '', ''],
  ['gabriele-mini', 'mp', 'Gabriele', 'Minì', 'MIN', 9, 'ITA', '20/03/2005', 'alpine'],
  ['oliver-goethe', 'mp', 'Oliver', 'Goethe', 'GOE', 10, 'GER', '14/10/2004', ''],
  ['sebastian-montoya', 'prema', 'Sebastián', 'Montoya', 'MON', 11, 'COL', '', ''],
  ['mari-boya', 'prema', 'Mari', 'Boya', 'BOY', 12, 'ESP', '13/04/2004', 'aston_martin'],
  ['martinius-stenshorne', 'rodin', 'Martinius', 'Stenshorne', 'STE', 14, 'NOR', '02/02/2006', ''],
  ['alexander-dunne', 'rodin', 'Alexander', 'Dunne', 'DUN', 15, 'IRL', '11/11/2005', 'alpine'],
  ['kush-maini', 'art', 'Kush', 'Maini', 'MAI', 16, 'IND', '22/09/2000', 'alpine'],
  ['tasanapol-inthraphuvasak', 'art', 'Tasanapol', 'Inthraphuvasak', 'INT', 17, 'THA', '', ''],
  ['emerson-fittipaldi-jr', 'aix', 'Emerson', 'Fittipaldi Jr', 'FIT', 20, 'BRA', '07/03/2007', ''],
  ['cian-shields', 'aix', 'Cian', 'Shields', 'SHI', 21, 'GBR', '07/03/2005', ''],
  ['hiyu-yamakoshi', 'var', 'Hiyu', 'Yamakoshi', 'YAM', 22, 'JPN', '13/10/2006', ''],
  ['rafael-villagomez', 'var', 'Rafael', 'Villagómez', 'VIL', 23, 'MEX', '10/11/2001', ''],
  ['laurens-van-hoepen', 'trident', 'Laurens', 'van Hoepen', 'VAN', 24, 'NED', '06/09/2005', ''],
  ['john-bennett', 'trident', 'John', 'Bennett', 'BEN', 25, 'GBR', '15/09/2003', ''],
];

// F1 round image slug, name, country code, official name, circuit, city, first day, last day (dates checked against Wikipedia, Oct 2026)
const CAL = [
  ['australia', 'Australia', 'AUS', 'Melbourne', 'Albert Park Circuit', 'Melbourne', '2026-03-06', '2026-03-08'],
  ['miami', 'Miami', 'USA', 'Miami', 'Miami International Autodrome', 'Miami Gardens', '2026-05-01', '2026-05-03'],
  ['canada', 'Canada', 'CAN', 'Montréal', 'Circuit Gilles Villeneuve', 'Montréal', '2026-05-22', '2026-05-24'],
  ['monaco', 'Monaco', 'MON', 'Monte Carlo', 'Circuit de Monaco', 'Monte Carlo', '2026-06-04', '2026-06-07'],
  ['barcelona-catalunya', 'Barcelona-Catalunya', 'ESP', 'Barcelona', 'Circuit de Barcelona-Catalunya', 'Montmeló', '2026-06-12', '2026-06-14'],
  ['austria', 'Austria', 'AUT', 'Spielberg', 'Red Bull Ring', 'Spielberg', '2026-06-26', '2026-06-28'],
  ['great-britain', 'Great Britain', 'GBR', 'Silverstone', 'Silverstone Circuit', 'Silverstone', '2026-07-03', '2026-07-05'],
  ['belgium', 'Belgium', 'BEL', 'Spa-Francorchamps', 'Circuit de Spa-Francorchamps', 'Stavelot', '2026-07-17', '2026-07-19'],
  ['hungary', 'Hungary', 'HUN', 'Budapest', 'Hungaroring', 'Mogyoród', '2026-07-24', '2026-07-26'],
  ['italy', 'Italy', 'ITA', 'Monza', 'Autodromo Nazionale Monza', 'Monza', '2026-09-04', '2026-09-06'],
  ['spain', 'Spain', 'ESP', 'Madrid', 'Madring', 'Madrid', '2026-09-11', '2026-09-13'],
  ['azerbaijan', 'Azerbaijan', 'AZE', 'Baku', 'Baku City Circuit', 'Baku', '2026-09-24', '2026-09-26', 'baku'],
  ['qatar', 'Qatar', 'QAT', 'Lusail', 'Lusail International Circuit', 'Lusail', '2026-11-27', '2026-11-29'],
  ['united-arab-emirates', 'Abu Dhabi', 'UAE', 'Yas Marina', 'Yas Marina Circuit', 'Abu Dhabi', '2026-12-04', '2026-12-06'],
];

const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const isoDob = s => { if (!s) return ''; const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };
const exists = (fs, p) => fs.existsSync(new URL('../' + p, import.meta.url));
const drvId = slug => 'drv_' + slug.replace(/-/g, '_');

export function realGridF2(fs) {
  const teams = T.map(([slug, name, fullName, color, colorDark, base, img]) => ({
    id: 'team_f2_' + slug, series: 'f2', name, fullName, color, colorDark, base, principal: '', technicalChief: '',
    chassis: 'Dallara F2 2024', powerUnit: 'Mecachrome', firstEntry: null, championships: 0,
    logoUrl: `${IMG}teams/${img}-logo.webp`, carUrl: `${IMG}teams/${img}-car.webp`, bio: '',
    // ART: Maini races in personal Alpine-sponsor colours, Inthraphuvasak in the team suit
    ...(slug === 'art' ? { suitDriverId: 'drv_tasanapol_inthraphuvasak' } : {}),
  }));
  const drivers = DR.map(([slug, team, firstName, lastName, code, number, nationality, dob]) => ({
    id: drvId(slug), firstName, lastName, code, number, nationality, dob: isoDob(dob), birthplace: '', championships: 0,
    portraitUrl: `${IMG}drivers/${slug}.webp`, portraitTeamId: 'team_f2_' + team, portraits: [], numberUrl: `${IMG}drivers/${slug}-number.webp`,
    photoUrls: [1, 2, 3, 4, 5].map(i => `${IMG}photos/${slug}-${i}.webp`).filter(p => exists(fs, p)), bio: '',
  }));
  const assignments = DR.map(([slug, team], i) => ({
    id: `asg_f2_2026_${String(i + 1).padStart(2, '0')}`, seasonId: F2_SEASON, driverId: drvId(slug), teamId: 'team_f2_' + team, fromRound: 1, toRound: null, role: 'race',
  }));
  const rounds = CAL.map(([img, name, cc, short, circuit, city, start, end, special], i) => {
    const sat = addDays(end, -1);
    // Baku 2026 was "supersized" and moved a day earlier: sprint and Feature Race 1 on Friday, Feature Race 2 on Saturday
    const sessions = special === 'baku'
      ? [['Practice', start, '10:00'], ['Qualifying', start, '15:00'], ['Sprint Race', sat, '10:15'], ['Feature Race 1', sat, '15:30'], ['Feature Race 2', end, '11:00']]
      : [['Practice', start, '10:00'], ['Qualifying', start, '15:00'], ['Sprint Race', sat, '14:15'], ['Feature Race', end, '10:00']];
    return {
      id: `rnd_f2_2026_${String(i + 1).padStart(2, '0')}`, seasonId: F2_SEASON, round: i + 1, name, country: name, countryCode: cc,
      officialName: `FIA Formula 2 Round ${i + 1}, ${short} 2026`, circuit, city, laps: null, lengthKm: null, dateStart: start, dateEnd: end, sprint: true,
      sessions: sessions.map(([label, date, time]) => ({ label, date, time })), status: 'scheduled',
      imageUrl: exists(fs, `assets/f1com/circuits/${img}.webp`) ? `assets/f1com/circuits/${img}.webp` : '',
    };
  });
  const byTeam = {};
  DR.forEach(d => { if (d[8]) (byTeam[d[8]] = byTeam[d[8]] || []).push(drvId(d[0])); });
  const academies = Object.entries(byTeam).map(([team, driverIds]) => ({
    id: 'acd_' + team, f1TeamId: 'team_' + team, name: '', driverIds, fromSeasonId: F2_SEASON, toSeasonId: null,
  }));
  const photos = fs.readdirSync(new URL('../' + IMG + 'photos/', import.meta.url)).filter(f => /^f2-\d+\.webp$/.test(f)).sort().map(f => IMG + 'photos/' + f);
  const season = { id: F2_SEASON, series: 'f2', year: 2026, name: '2026 FIA Formula 2 (starter)', pointsRuleId: 'pts_f2', photoUrls: photos,
    notes: 'Real 2026 F2 line-up and calendar from fiaformula2.com, with no results.' };
  return { season, teams, drivers, assignments, rounds, academies };
}
