// Real 2026 F1 grid, read from formula1.com on 14 Oct 2026: drivers, teams, calendar.
// Images are the local copies in assets/f1com/, downloaded for personal local use (see tools/f1com-images.tsv).
// No results are included — the season is a starter for your own career.
export const REAL_SEASON = 'sea_2026_grid';
const IMG = 'assets/f1com/';

// slug, name, fullName, colour, dark, base, chief, technical chief, chassis, PU, first entry, titles, image key
const T = [
  ['mercedes', 'Mercedes', 'Mercedes-AMG PETRONAS Formula One Team', '#27f4d2', '#067e6a', 'Brackley, United Kingdom', 'Toto Wolff', 'James Allison', 'W17', 'Mercedes', 1970, 8, 'mercedes'],
  ['ferrari', 'Ferrari', 'Scuderia Ferrari HP', '#e8002d', '#5c0012', 'Maranello, Italy', 'Frédéric Vasseur', 'Loic Serra / Enrico Gualtieri', 'SF-26', 'Ferrari', 1950, 16, 'ferrari'],
  ['mclaren', 'McLaren', 'McLaren Mastercard F1 Team', '#ff8000', '#804000', 'Woking, United Kingdom', 'Andrea Stella', 'Peter Prodromou / Neil Houldey', 'MCL40', 'Mercedes', 1966, 10, 'mclaren'],
  ['red_bull_racing', 'Red Bull Racing', 'Oracle Red Bull Racing', '#3671c6', '#142948', 'Milton Keynes, United Kingdom', 'Laurent Mekies', 'Pierre Waché', 'RB22', 'Red Bull Ford', 1997, 6, 'redbullracing'],
  ['racing_bulls', 'Racing Bulls', 'Visa Cash App Racing Bulls Formula One Team', '#6692ff', '#0038c2', 'Faenza, Italy', 'Alan Permane', 'Tim Goss', 'VCARB 03', 'Red Bull Ford', 1985, 0, 'racingbulls'],
  ['alpine', 'Alpine', 'BWT Alpine Formula One Team', '#00a1e8', '#004e70', 'Enstone, United Kingdom', 'Flavio Briatore / Steve Nielsen', 'David Sanchez', 'A526', 'Mercedes', 1986, 2, 'alpine'],
  ['haas', 'Haas F1 Team', 'TGR Haas F1 Team', '#dee1e2', '#667175', 'Kannapolis, United States', 'Ayao Komatsu', 'Andrea De Zordo', 'VF-26', 'Ferrari', 2016, 0, 'haasf1team'],
  ['audi', 'Audi', 'Audi Revolut F1 Team', '#ff2d00', '#751500', 'Hinwil, Switzerland', 'Mattia Binotto', 'James Key', 'R26', 'Audi', 2026, 0, 'audi'],
  ['williams', 'Williams', 'Atlassian Williams F1 Team', '#1868db', '#082145', 'Grove, United Kingdom', 'James Vowles', 'Pat Fry', 'FW48', 'Mercedes', 1978, 8, 'williams'],
  ['aston_martin', 'Aston Martin', 'Aston Martin Aramco Formula One Team', '#229971', '#0f4331', 'Silverstone, United Kingdom', 'Adrian Newey', 'Enrico Cardile', 'AMR26', 'Honda', 2018, 0, 'astonmartin'],
  ['cadillac', 'Cadillac', 'Cadillac Formula 1 Team', '#aaaaad', '#58585b', 'Silverstone, United Kingdom', 'Marcin Budkowski', 'Nick Chester', 'MAC-26', 'Ferrari', 2026, 0, 'cadillac'],
];

// slug, team, code, number, nationality, dob(dd/mm/yyyy), birthplace, titles
const DR = [
  ['george-russell', 'mercedes', 'RUS', 63, 'GBR', '15/02/1998', "King's Lynn, England", 0],
  ['kimi-antonelli', 'mercedes', 'ANT', 12, 'ITA', '25/08/2006', 'Bologna, Italy', 0],
  ['charles-leclerc', 'ferrari', 'LEC', 16, 'MON', '16/10/1997', 'Monte Carlo, Monaco', 0],
  ['lewis-hamilton', 'ferrari', 'HAM', 44, 'GBR', '07/01/1985', 'Stevenage, England', 7],
  ['lando-norris', 'mclaren', 'NOR', 1, 'GBR', '13/11/1999', 'Bristol, England', 1],
  ['oscar-piastri', 'mclaren', 'PIA', 81, 'AUS', '06/04/2001', 'Melbourne, Victoria', 0],
  ['max-verstappen', 'red_bull_racing', 'VER', 3, 'NED', '30/09/1997', 'Hasselt, Belgium', 4],
  ['isack-hadjar', 'red_bull_racing', 'HAD', 6, 'FRA', '28/09/2004', 'Paris, France', 0],
  ['liam-lawson', 'racing_bulls', 'LAW', 30, 'NZL', '11/02/2002', 'Hastings, New Zealand', 0],
  ['arvid-lindblad', 'racing_bulls', 'LIN', 41, 'GBR', '08/08/2007', 'London, England', 0],
  ['pierre-gasly', 'alpine', 'GAS', 10, 'FRA', '07/02/1996', 'Rouen, France', 0],
  ['franco-colapinto', 'alpine', 'COL', 43, 'ARG', '27/05/2003', 'Buenos Aires, Argentina', 0],
  ['esteban-ocon', 'haas', 'OCO', 31, 'FRA', '17/09/1996', 'Évreux, Normandy', 0],
  ['oliver-bearman', 'haas', 'BEA', 87, 'GBR', '08/05/2005', 'Chelmsford, England', 0],
  ['nico-hulkenberg', 'audi', 'HUL', 27, 'GER', '19/08/1987', 'Emmerich am Rhein, Germany', 0],
  ['gabriel-bortoleto', 'audi', 'BOR', 5, 'BRA', '14/10/2004', 'São Paulo, Brazil', 0],
  ['carlos-sainz', 'williams', 'SAI', 55, 'ESP', '01/09/1994', 'Madrid, Spain', 0],
  ['alexander-albon', 'williams', 'ALB', 23, 'THA', '23/03/1996', 'London, England', 0],
  ['fernando-alonso', 'aston_martin', 'ALO', 14, 'ESP', '29/07/1981', 'Oviedo, Spain', 2],
  ['lance-stroll', 'aston_martin', 'STR', 18, 'CAN', '29/10/1998', 'Montreal, Canada', 0],
  ['sergio-perez', 'cadillac', 'PER', 11, 'MEX', '26/01/1990', 'Guadalajara, Mexico', 0],
  ['valtteri-bottas', 'cadillac', 'BOT', 77, 'FIN', '28/08/1989', 'Nastola, Finland', 0],
];

// slug (image), short name, country code, official name, circuit, city, first day, race day, sprint
const CAL = [
  ['australia', 'Australia', 'AUS', 'Australian Grand Prix', 'Albert Park Circuit', 'Melbourne', '2026-03-06', '2026-03-08'],
  ['china', 'China', 'CHN', 'Chinese Grand Prix', 'Shanghai International Circuit', 'Shanghai', '2026-03-13', '2026-03-15', true],
  ['japan', 'Japan', 'JPN', 'Japanese Grand Prix', 'Suzuka International Racing Course', 'Suzuka', '2026-03-27', '2026-03-29'],
  ['miami', 'Miami', 'USA', 'Miami Grand Prix', 'Miami International Autodrome', 'Miami', '2026-05-01', '2026-05-03', true],
  ['canada', 'Canada', 'CAN', 'Grand Prix du Canada', 'Circuit Gilles Villeneuve', 'Montréal', '2026-05-22', '2026-05-24', true],
  ['monaco', 'Monaco', 'MON', 'Grand Prix de Monaco', 'Circuit de Monaco', 'Monte Carlo', '2026-06-05', '2026-06-07'],
  ['barcelona-catalunya', 'Barcelona-Catalunya', 'ESP', 'Gran Premio de Barcelona-Catalunya', 'Circuit de Barcelona-Catalunya', 'Barcelona', '2026-06-12', '2026-06-14'],
  ['austria', 'Austria', 'AUT', 'Austrian Grand Prix', 'Red Bull Ring', 'Spielberg', '2026-06-26', '2026-06-28'],
  ['great-britain', 'Great Britain', 'GBR', 'British Grand Prix', 'Silverstone Circuit', 'Silverstone', '2026-07-03', '2026-07-05', true],
  ['belgium', 'Belgium', 'BEL', 'Belgian Grand Prix', 'Circuit de Spa-Francorchamps', 'Spa', '2026-07-17', '2026-07-19'],
  ['hungary', 'Hungary', 'HUN', 'Hungarian Grand Prix', 'Hungaroring', 'Budapest', '2026-07-24', '2026-07-26'],
  ['netherlands', 'Netherlands', 'NED', 'Dutch Grand Prix', 'Circuit Zandvoort', 'Zandvoort', '2026-08-21', '2026-08-23', true],
  ['italy', 'Italy', 'ITA', "Gran Premio d'Italia", 'Autodromo Nazionale Monza', 'Monza', '2026-09-04', '2026-09-06'],
  ['spain', 'Spain', 'ESP', 'Gran Premio de España', 'Madring', 'Madrid', '2026-09-11', '2026-09-13'],
  ['azerbaijan', 'Azerbaijan', 'AZE', 'Azerbaijan Grand Prix', 'Baku City Circuit', 'Baku', '2026-09-24', '2026-09-26'],
  ['bahrain', 'Bahrain', 'BHR', 'Bahrain Grand Prix', 'Bahrain International Circuit', 'Sakhir', '2026-10-02', '2026-10-04'],
  ['singapore', 'Singapore', 'SGP', 'Singapore Grand Prix', 'Marina Bay Street Circuit', 'Singapore', '2026-10-09', '2026-10-11', true],
  ['united-states', 'United States', 'USA', 'United States Grand Prix', 'Circuit of the Americas', 'Austin', '2026-10-23', '2026-10-25'],
  ['mexico', 'Mexico', 'MEX', 'Gran Premio de la Ciudad de México', 'Autódromo Hermanos Rodríguez', 'Mexico City', '2026-10-30', '2026-11-01'],
  ['brazil', 'Brazil', 'BRA', 'Grande Prêmio de São Paulo', 'Autódromo José Carlos Pace', 'São Paulo', '2026-11-06', '2026-11-08'],
  ['las-vegas', 'Las Vegas', 'USA', 'Las Vegas Grand Prix', 'Las Vegas Strip Circuit', 'Las Vegas', '2026-11-19', '2026-11-21'],
  ['qatar', 'Qatar', 'QAT', 'Qatar Grand Prix', 'Lusail International Circuit', 'Lusail', '2026-11-27', '2026-11-29'],
  ['united-arab-emirates', 'Abu Dhabi', 'UAE', 'Abu Dhabi Grand Prix', 'Yas Marina Circuit', 'Abu Dhabi', '2026-12-04', '2026-12-06'],
];

const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const isoDob = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };
const cap = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const exists = (fs, p) => fs.existsSync(new URL('../' + p, import.meta.url));

export function realGrid(fs) {
  const teamImg = Object.fromEntries(T.map(t => [t[0], t[12]]));
  const teams = T.map(([slug, name, fullName, color, colorDark, base, principal, technicalChief, chassis, powerUnit, firstEntry, championships, img]) => ({
    id: 'team_' + slug, name, fullName, color, colorDark, base, principal, technicalChief, chassis, powerUnit, firstEntry, championships,
    logoUrl: `${IMG}teams/${img}-logo.webp`, carUrl: `${IMG}teams/${img}-car.webp`, bio: '',
  }));
  const drivers = DR.map(([slug, team, code, number, nationality, dob, birthplace, championships]) => {
    const [first, ...rest] = cap(slug).split(' ');
    return {
      id: 'drv_' + slug.replace(/-/g, '_'), firstName: first, lastName: rest.join(' ').replace('Hulkenberg', 'Hülkenberg').replace('Perez', 'Pérez'),
      code, number, nationality, dob: isoDob(dob), birthplace, championships,
      portraitUrl: `${IMG}drivers/${slug}.webp`, portraitTeamId: 'team_' + team, portraits: [], numberUrl: `${IMG}drivers/${slug}-number.webp`,
      photoUrls: [1, 2, 3].map(i => `${IMG}photos/${slug}-${i}.webp`).filter(p => exists(fs, p)), bio: '',
    };
  });
  const assignments = DR.map(([slug, team], i) => ({
    id: `asg_2026_${String(i + 1).padStart(2, '0')}`, seasonId: REAL_SEASON, driverId: 'drv_' + slug.replace(/-/g, '_'), teamId: 'team_' + team, fromRound: 1, toRound: null, role: 'race',
  }));
  const rounds = CAL.map(([img, name, cc, official, circuit, city, start, end, sprint], i) => {
    const sat = addDays(end, -1);
    const sessions = sprint
      ? [['Practice 1', start, '12:30'], ['Sprint Qualifying', start, '16:30'], ['Sprint', sat, '12:00'], ['Qualifying', sat, '16:00'], ['Race', end, '15:00']]
      : [['Practice 1', start, '12:30'], ['Practice 2', start, '16:00'], ['Practice 3', sat, '12:30'], ['Qualifying', sat, '16:00'], ['Race', end, '15:00']];
    return {
      id: `rnd_2026_${String(i + 1).padStart(2, '0')}`, seasonId: REAL_SEASON, round: i + 1, name, country: name, countryCode: cc,
      officialName: `${official} 2026`, circuit, city, laps: null, lengthKm: null, dateStart: start, dateEnd: end, sprint: !!sprint,
      sessions: sessions.map(([label, date, time]) => ({ label, date, time })), status: 'scheduled',
      imageUrl: exists(fs, `${IMG}circuits/${img}.webp`) ? `${IMG}circuits/${img}.webp` : '',
    };
  });
  const season = { id: REAL_SEASON, year: 2026, name: '2026 Real Grid (starter)', pointsRuleId: 'pts_standard',
    notes: 'Real 2026 line-up and calendar from formula1.com, with no results. Enter your own career results here, or start a new career from it in Import / Export.' };
  return { season, teams, drivers, assignments, rounds };
}
