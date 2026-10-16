/* ==========================================================================
   newsgen.js — automatic newsroom.
   1. facts:    read what happened in a round (pure data, from the career)
   2. stories:  decide which angles are newsworthy, with a score each
   3. writing:  hand-written phrase banks with several variants per slot,
                chosen by situation and a seed per round, so text is varied
                but stable between page loads
   4. sync:     keep auto-written articles in step with results; never touch a
                story the user has edited
   ========================================================================== */

/* --- seeded randomness ----------------------------------------------------- */
function ngHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function ngRng(seed) { let x = ngHash(seed) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
const ngFill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)).replace(/^the /, 'The ').replace(/([.:!?] |^)the the /gi, '$1The ').replace(/\bthe the\b/g, 'the');
const ngCap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ngOrd = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const NG_GP = { Australia: 'Australian', China: 'Chinese', Japan: 'Japanese', Canada: 'Canadian', Austria: 'Austrian', 'Great Britain': 'British', Belgium: 'Belgian',
  Hungary: 'Hungarian', Netherlands: 'Dutch', Italy: 'Italian', Spain: 'Spanish', 'United States': 'United States', Mexico: 'Mexico City', Brazil: 'São Paulo',
  France: 'French', Germany: 'German', Portugal: 'Portuguese', 'Saudi Arabia': 'Saudi Arabian', Turkey: 'Turkish', Russia: 'Russian', Malaysia: 'Malaysian', Korea: 'Korean', India: 'Indian' };
// F2 rounds are named after the city ("the Baku Feature Race"); set per career by ngSeries().
let NG_F2 = new Set();
const ngSeries = c => { NG_F2 = new Set(c.seasons.filter(s => s.series === 'f2').map(s => s.id)); };
const ngGp = r => NG_F2.has(r.seasonId) ? `${r.city || r.name} Feature Race` : `${NG_GP[r.name] || r.name} Grand Prix`;
const ngWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);

/* --- phrase banks ---------------------------------------------------------- */
const NG = {
  head: {
    opener: ['{W} wins the season opener in {city}', '{W} draws first blood in {gp}', 'Season opener goes to {W}', '{W} starts the year with victory in {city}'],
    win: ['{W} wins in {gp}', '{W} takes {gp} victory', '{W} conquers {city}', 'Victory for {W} in {gp}', '{W} delivers in {gp}', '{gp}: {W} on top'],
    dominant: ['{W} in a class of his own at {gp}', '{W} cruises to {gp} win', 'Untouchable {W} romps home in {city}', '{W} leaves the field behind in {gp}'],
    close: ['{W} holds off {P2} in {gp} thriller', '{W} edges {P2} in {city} classic', 'Photo finish: {W} beats {P2} in {gp}', '{W} survives late {P2} charge'],
    first: ['{W} gets his season off the mark in {city}', 'First win of the year for {W} in {gp}', 'At last: {W} breaks his duck in {city}', '{W} finally tastes victory in {gp}'],
    streak: ['{W} makes it {streakWord} in a row in {gp}', 'No stopping {W}: {streakOrd} straight win', '{W} extends winning run in {city}'],
    onetwo: ['{T} one-two in {gp} as {W} leads {P2} home', '{T} lock out the top two in {city}', 'Double delight for {T} in {gp}'],
    pole: ['{W} converts pole into {gp} win', 'Lights to flag: {W} wins from pole in {city}'],
    comeback: ['{W} storms from {gridOrd} on the grid to win in {gp}', 'From {gridOrd} to first: {W} stuns {city}'],
  },
  open: {
    any: ['{W} won the {official} on {day}, finishing ahead of {P2} and {P3}.', '{Wfull} took the chequered flag first in {city}, with {P2} second and {P3} completing the podium.', 'It was {W}\'s day in {city}: the {Tname} driver beat {P2} and {P3} to win the {gp}.', 'The {gp} belonged to {Wfull}, who came home ahead of {P2} and {P3} at {circuit}.'],
    dominant: ['{Wfull} controlled the {gp} from start to finish and won by {margin}.', 'Nobody could live with {W} in {city}. The {Tname} driver crossed the line {margin} clear of {P2}.'],
    close: ['Just {margin} separated {W} and {P2} at the flag in {city}, with {W} holding on to win the {gp}.', '{Wfull} won a tense {gp} by only {margin} from {P2}, with {P3} third.'],
  },
  poleLine: ['{Pole} started from pole position.', 'Pole had gone to {Pole} on Saturday.', 'The front row was led by {Pole}.'],
  winPole: ['{W} made pole position count and was never seriously threatened at the start.', 'Starting from pole, {W} kept the lead through the first corner and managed the race from there.'],
  comeback: ['Starting {gridOrd}, {W} worked his way forward with a string of decisive moves.', 'From {gridOrd} on the grid, {W} needed a big drive, and he delivered one.'],
  streak: ['That makes it {streakWord} wins in a row for {W}.', 'The win is {W}\'s {streakOrd} in succession, and the rest of the field is running out of answers.'],
  first: ['It is {W}\'s first win of the season, and the relief was clear on the radio after the flag.', 'For {W} it is the first victory of the year, after a run of near misses.'],
  onetwo: ['{T} completed a one-two, their best result of the season so far.', 'With {P2} second, {T} left {city} with maximum points from both cars.'],
  podiumFirst: ['{X} claimed his first podium of the season.', 'A first podium of the year for {X} was one of the stories of the day.'],
  dnf: ['{N} drivers failed to finish, including {list}.', 'Retirements hit {list}, with {n} cars out of the race in total.', 'It was a costly day for {list}, who were among the {n} retirements.'],
  dnfOne: ['{list} was the only retirement of the race.', 'The only driver not to finish was {list}.'],
  fl: ['{FL} set the fastest lap.', 'The fastest lap of the race went to {FL}.'],
  sprint: ['Earlier in the weekend, {SW} won the Sprint.', 'The Sprint on Saturday had gone the way of {SW}.'],
  lead: {
    keep: ['{L} stays top of the championship, now {gap} points ahead of {L2}.', 'In the standings, {L} leads {L2} by {gap} points.'],
    take: ['The result puts {L} into the championship lead, {gap} points ahead of {L2}.', '{L} takes over at the top of the standings and leads {L2} by {gap} points.'],
    tied: ['{L} and {L2} are level on points at the top of the championship.'],
  },
  quoteWin: ['"{qc}" said {W}.', '{W} said after the race: "{q}"', '"{qc}" a delighted {W} told reporters.', '"{qc}" {W} said on the team radio.'],
  qWin: ['What a day. The car was fantastic and the team did a perfect job.', 'We managed the tyres well and that made the difference at the end.', 'This one means a lot. We pushed every lap.', 'I had to stay calm when {P2} came close. Great work by everyone.', 'Honestly, I didn\'t expect this today. We take it and keep going.', 'The start was the key. After that I could control the pace.', 'Strategy was spot on. Thank you to everyone in the garage.', 'It was hot out there and the tyres were on the limit, but we made it work.'],
  next: ['Next up is {nextGp}, {nextDays}.', 'The championship moves on to {nextGp} {nextDays}.', 'Attention now turns to {nextGp}, {nextDays}.'],
  end: ['That was the final round of the season.', 'The season is now complete.'],
};

/* --- facts ------------------------------------------------------------------ */
function ngRoundOrder(c) {
  const year = id => (seasonOf(c, id) || { year: 0 }).year;
  return [...c.rounds].sort((a, b) => year(a.seasonId) - year(b.seasonId) || a.round - b.round);
}
function ngFacts(c, round) {
  const race = classify(c, resultFor(c, round.id, 'race'));
  const fin = race.filter(e => e.position).sort((a, b) => a.position - b.position);
  if (!fin.length) return null;
  const d = id => driverOf(id) || { firstName: '', lastName: id, nationality: '' };
  const t = id => teamOf(id) || { name: id };
  const order = ngRoundOrder(c), earlier = order.slice(0, order.indexOf(round));
  const earlierRaces = earlier.map(r => classify(c, resultFor(c, r.id, 'race')));
  const raced = earlier.filter(r => r.seasonId === round.seasonId && resultFor(c, r.id, 'race')).length;   // races already run this season
  const winsBefore = id => earlierRaces.filter(rs => rs.some(e => e.driverId === id && e.position === 1)).length;
  const podiumsBefore = id => earlierRaces.filter(rs => rs.some(e => e.driverId === id && e.position && e.position <= 3)).length;
  // consecutive wins up to this round (season-independent, career order)
  let streak = 1;
  for (let i = earlierRaces.length - 1; i >= 0; i--) { const w = earlierRaces[i].find(e => e.position === 1); if (w && w.driverId === fin[0].driverId) streak++; else if (earlierRaces[i].length) break; }
  const q = classify(c, resultFor(c, round.id, 'qualifying')).find(e => e.position === 1);
  const sprint = classify(c, resultFor(c, round.id, 'sprint')).find(e => e.position === 1);
  const gapTxt = fin[1] && /^\+?\d+(\.\d+)?s?$/.test(String(fin[1].time || '').trim()) ? parseFloat(String(fin[1].time).replace('+', '')) : null;
  const before = driverStandings(c, round.seasonId, round.round - 1), after = driverStandings(c, round.seasonId, round.round);
  const rounds = roundsOf(c, round.seasonId), left = rounds.filter(r => r.round > round.round);
  const rule = ruleFor(c, round.seasonId);
  const maxLeft = left.reduce((a, r) => a + (rule.race[0] || 0) + ((rule.fastestLap || {}).points || 0) + (r.sprint ? (rule.sprint[0] || 0) : 0), 0);
  const L = after[0], L2 = after[1];
  const player = c.meta.playerTeamId ? race.filter(e => e.teamId === c.meta.playerTeamId) : [];
  return {
    round, rounds, race, fin, d, t,
    W: fin[0], P2: fin[1], P3: fin[2],
    pole: q ? q.driverId : null, sprintWinner: sprint ? sprint.driverId : null,
    fl: race.find(e => e.fastestLap), dnfs: race.filter(e => e.status !== 'FIN'),
    firstWin: raced > 0 && winsBefore(fin[0].driverId) === 0, opener: raced === 0,
    firstPodiums: raced > 0 ? fin.slice(1, 3).filter(e => podiumsBefore(e.driverId) === 0) : [], raced,
    streak, margin: gapTxt, oneTwo: fin[1] && fin[1].teamId === fin[0].teamId,
    grid: fin[0].grid || null,
    leaderBefore: before[0] && before[0].points > 0 ? before[0].id : null, leaderBeforeEntry: before[0] && race.find(e => e.driverId === before[0].id),
    after, L, L2, gap: L && L2 ? L.points - L2.points : 0,
    maxLeft,
    clinchedNow: !!(L && L2 && L.points - L2.points > maxLeft && !(before[0] && before[1] && before[0].points - before[1].points > maxLeft + (rule.race[0] || 0) + ((rule.fastestLap || {}).points || 0) + (round.sprint ? (rule.sprint[0] || 0) : 0))),
    last: left.length === 0, next: left[0] || null,
    home: fin.slice(0, 3).find(e => d(e.driverId).nationality && d(e.driverId).nationality === round.countryCode),
    player, playerTeam: c.meta.playerTeamId ? teamOf(c.meta.playerTeamId) : null,
  };
}

/* --- writing helpers ------------------------------------------------------- */
function ngWriter(seed, usedHeads) {
  const rnd = ngRng(seed);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const pickFresh = (list, tag) => {                                 // avoid headline shapes already used this season
    const fresh = list.map((t, i) => [t, `${tag}${i}`]).filter(([, k]) => !usedHeads.has(k));
    const [t, k] = pick(fresh.length ? fresh : list.map((t, i) => [t, `${tag}${i}`]));
    usedHeads.add(k); return t;
  };
  return { rnd, pick, pickFresh, chance: p => rnd() < p };
}
function ngVars(f) {
  const { d, t, round } = f, n = id => d(id).lastName, full = id => `${d(id).firstName} ${d(id).lastName}`.trim();
  const days = f.next ? Math.round((parseDate(f.next.dateEnd || f.next.dateStart) - parseDate(round.dateEnd || round.dateStart)) / 864e5) : 0;
  return {
    W: n(f.W.driverId), Wfull: full(f.W.driverId), T: t(f.W.teamId).name, Tname: t(f.W.teamId).name,
    P2: f.P2 ? n(f.P2.driverId) : 'the rest', P3: f.P3 ? n(f.P3.driverId) : 'the field',
    gp: `the ${ngGp(round)}`, gpShort: round.name, city: round.city || round.name, circuit: round.circuit || round.city || round.name,
    official: ngGp(round), day: fmtDay(round.dateEnd || round.dateStart),
    Pole: f.pole ? n(f.pole) : '', FL: f.fl ? n(f.fl.driverId) : '', SW: f.sprintWinner ? n(f.sprintWinner) : '',
    margin: f.margin != null ? `${f.margin.toFixed(f.margin < 10 ? 3 : 1)} seconds` : '',
    streakWord: ngWord(f.streak), streakOrd: ngOrd(f.streak), streakOrdCap: ngCap(ngWord(f.streak) === String(f.streak) ? ngOrd(f.streak) : ['', '', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][f.streak]), gridOrd: f.grid ? ngOrd(f.grid) : '',
    L: f.L ? n(f.L.id) : '', L2: f.L2 ? n(f.L2.id) : '', gap: f.gap,
    nextGp: f.next ? `the ${ngGp(f.next)}` : '', nextDays: days > 0 ? (days <= 8 ? 'next weekend' : `in ${ngWord(Math.round(days / 7))} weeks`) : 'soon',
  };
}
const ngHeadline = s => ngCap(s).replace(/\bthe the\b/gi, 'the');

/* --- stories --------------------------------------------------------------- */
function ngRaceReport(f, w, v) {
  const shape = f.opener && w.chance(.75) ? 'opener' : f.firstWin ? 'first' : f.streak >= 3 ? 'streak' : f.grid && f.grid >= 6 ? 'comeback' : f.margin != null && f.margin < 1.5 ? 'close'
    : f.margin != null && f.margin > 12 ? 'dominant' : f.oneTwo && w.chance(.6) ? 'onetwo' : f.pole === f.W.driverId && w.chance(.4) ? 'pole' : 'win';
  const title = ngFill(w.pickFresh(NG.head[shape], shape), v);
  const openKind = f.margin != null && f.margin < 1.5 ? 'close' : f.margin != null && f.margin > 12 ? 'dominant' : 'any';
  const p = [];
  p.push(ngFill(w.pick(NG.open[openKind]), v));
  const two = [];
  if (f.firstWin) two.push(ngFill(w.pick(NG.first), v));
  else if (f.streak >= 2) two.push(ngFill(w.pick(NG.streak), v));
  if (f.grid && f.grid >= 6) two.push(ngFill(w.pick(NG.comeback), v));
  else if (f.pole === f.W.driverId) two.push(ngFill(w.pick(NG.winPole), v));
  else if (f.pole) two.push(ngFill(w.pick(NG.poleLine), v));
  if (f.oneTwo) two.push(ngFill(w.pick(NG.onetwo), v));
  if (two.length) p.push(two.join(' '));
  const three = [];
  f.firstPodiums.forEach(e => three.push(ngFill(w.pick(NG.podiumFirst), { X: f.d(e.driverId).lastName })));
  if (f.dnfs.length) {
    const names = f.dnfs.slice(0, 3).map(e => f.d(e.driverId).lastName);
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.slice(-1) : names[0];
    three.push(ngFill(w.pick(f.dnfs.length === 1 ? NG.dnfOne : NG.dnf), { N: ngCap(ngWord(f.dnfs.length)), n: ngWord(f.dnfs.length), list }));
  }
  if (f.fl && w.chance(.7)) three.push(ngFill(w.pick(NG.fl), v));
  if (f.sprintWinner) three.push(ngFill(w.pick(NG.sprint), v));
  if (three.length) p.push(three.join(' '));
  p.push(ngFill(w.pick(NG.quoteWin), (q => Object.assign({}, v, { q, qc: q.replace(/[.!]$/, ',') }))(ngFill(w.pick(NG.qWin), v))));
  const leadKind = f.gap === 0 ? 'tied' : f.L && f.leaderBefore && f.L.id !== f.leaderBefore ? 'take' : 'keep';
  p.push([f.L2 ? ngFill(w.pick(NG.lead[leadKind]), v) : '', f.last ? w.pick(NG.end) : f.next ? ngFill(w.pick(NG.next), v) : ''].filter(Boolean).join(' '));
  const stand = f.P2 ? `${v.Wfull} beat ${v.P2}${f.P3 ? ` and ${v.P3}` : ''} in ${v.city}.` : `${v.Wfull} won in ${v.city}.`;
  return { type: 'report', category: 'Race Report', title: ngHeadline(title), standfirst: stand, body: p, drivers: [f.W, f.P2, f.P3].filter(Boolean).map(e => e.driverId), teams: [f.W.teamId], hours: 2 };
}

function ngTitleStory(f, w, v) {
  const lost = f.leaderBefore && f.L.id !== f.leaderBefore;
  const exL = lost ? f.d(f.leaderBefore).lastName : '';
  const exEntry = f.leaderBeforeEntry;
  let title, body = [];
  if (f.clinchedNow) {
    title = w.pick(['{L} is world champion', 'Champion! {L} seals the title in {city}', '{L} clinches the championship with {left} to go']);
    body.push(w.pick(['{Lfull} is the world champion. With {gap} points in hand and only {maxLeft} left to play for, nobody can catch him now.', 'It is done: {Lfull} has won the title. His lead of {gap} points can no longer be overturned.']));
    body.push(w.pick(['It caps a season of {wins} wins and {podiums} podiums.', 'He has {wins} wins and {podiums} podiums to his name this year.']));
  } else if (lost) {
    title = w.pick(['{L} takes the championship lead', 'All change at the top: {L} leads the title race', '{exL} loses championship lead to {L}']);
    body.push(w.pick([`${exL} arrived in {city} as championship leader, but leaves it in second place behind {L}.`, `The championship has a new leader. {L} moves ahead of ${exL} after {gpShort}.`]));
    if (exEntry && !exEntry.position) body.push(w.pick([`A retirement for ${exL} proved costly.`, `${exL}'s race ended early, and the points swing was decisive.`]));
    body.push(w.pick(['The gap is {gap} points with {leftWord} rounds remaining.', '{L} now leads by {gap} points, with {leftWord} races still to run.']));
  } else {
    title = w.pick(['Title race tightens: {gap} points between {L} and {L2}', '{L2} closes in on {L}', 'Just {gap} points split {L} and {L2}', 'How the title fight stands after {gpShort}']);
    body.push(w.pick(['After {gpShort}, {L} leads {L2} by {gap} points.', 'Only {gap} points separate the top two after {gpShort}.']));
    body.push(w.pick(['With {leftWord} rounds left and up to {maxLeft} points available, the fight is wide open.', 'There are {leftWord} rounds and {maxLeft} points still on the table.']));
  }
  const top = f.after.slice(0, 5).map(r => `${r.position}. ${f.d(r.id).lastName} ${r.points}`).join(' · ');
  body.push(`Top five: ${top}.`);
  const st = f.after.find(r => r.id === f.L.id);
  const vars = Object.assign({}, v, { Lfull: `${f.d(f.L.id).firstName} ${f.d(f.L.id).lastName}`, exL, left: `${ngWord(f.rounds.length - f.round.round)} rounds`,
    leftWord: ngWord(f.rounds.length - f.round.round), maxLeft: f.maxLeft || 0, wins: st ? st.wins : 0, podiums: st ? st.podiums : 0 });
  return { type: 'title', category: 'Analysis', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['The championship picture after {gpShort}.', 'Where the title fight stands now.', 'What {gpShort} means for the championship.']), vars),
    body: body.map(x => ngFill(x, vars)), drivers: [f.L.id, f.L2 && f.L2.id, f.leaderBefore].filter(Boolean), teams: [], hours: 20 };
}

function ngDramaStory(f, w, v) {
  const lb = f.leaderBeforeEntry, leaderOut = lb && !lb.position;
  const who = leaderOut ? f.d(lb.driverId).lastName : '';
  const title = leaderOut ? w.pick([`Disaster for ${who} in {city}`, `${who}'s {gpShort} ends early`, `Leader ${who} out of {gpShort}`])
    : w.pick(['Chaos in {city}: {n} cars fail to finish', 'High attrition at {gpShort}', 'A race of survival in {city}']);
  const names = f.dnfs.map(e => `${f.d(e.driverId).lastName} (${f.t(e.teamId).name})`);
  const body = [
    leaderOut ? w.pick([`Championship leader ${who} did not see the chequered flag in {city}.`, `It was a day to forget for ${who}, who arrived as the championship leader and left with no points.`])
      : w.pick(['Only {finishers} cars made it to the finish of {gp}.', 'Reliability and incidents took a heavy toll at {circuit}.']),
    `Out of the race: ${names.join(', ')}.`,
    w.pick(['The teams affected will look closely at the data before {nextGp}.', 'Questions will be asked in several garages this week.']),
  ];
  const vars = Object.assign({}, v, { n: ngWord(f.dnfs.length), finishers: ngWord(f.fin.length) });
  return { type: 'drama', category: 'News', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['Retirements shaped the result in {city}.', 'Not everyone made it to the flag.']), vars),
    body: body.map(x => ngFill(x, vars)), drivers: f.dnfs.map(e => e.driverId).slice(0, 4), teams: [...new Set(f.dnfs.map(e => e.teamId))], hours: 5 };
}

function ngMilestoneStory(f, w, v) {
  const e = (f.firstWin ? f.W : f.firstPodiums[0]) || f.W, X = f.d(e.driverId), T = f.t(e.teamId);
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, XT: T.name, XP: ngOrd(e.position) });
  const title = f.firstWin ? w.pick(['How {Xfull} finally won', '{X}: "This one has been coming"', 'Inside {X}\'s first win of the year'])
    : f.streak >= 3 ? w.pick(['{W}\'s streak: how long can it last?', '{streakOrdCap} straight win: {W} is on a roll']) : w.pick(['{X} back on the podium', 'First podium of the season for {X}', '{X} breaks into the top three']);
  const body = f.firstWin || !f.firstPodiums.length && f.streak < 3 ? [
    w.pick(['{Xfull} has been knocking on the door all season, and in {city} it finally opened.', 'There were big smiles in the {XT} garage after {X} took his first win of the year.']),
    w.pick(['"We have been close so many times," {X} said. "Today everything came together."', '"I want to thank everyone at {XT}," {X} said. "We never stopped believing."']),
  ] : f.streak >= 3 && !f.firstPodiums.length ? [
    w.pick(['{W} has now won {streakWord} races in a row.', 'The streak goes on: that is {streakWord} straight wins for {W}.']),
    w.pick(['Rivals know the clock is ticking.', 'The question in the paddock is who can stop him.']),
  ] : [
    w.pick(['{Xfull} finished {XP} for his first podium of the season.', 'A first top-three finish of the year for {Xfull} in {city}.']),
    w.pick(['"To stand up there is incredible," {X} said.', '"I will remember this one," said {X}. "Big thanks to {XT}."']),
  ];
  return { type: 'milestone', category: 'Feature', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['A day to remember.', 'A milestone in {city}.']), vars),
    body: body.map(x => ngFill(x, vars)), drivers: [e.driverId], teams: [e.teamId], hours: 26 };
}

function ngHomeStory(f, w, v) {
  const e = f.home, X = f.d(e.driverId);
  const vars = Object.assign({}, v, { X: X.lastName, XP: ngOrd(e.position) });
  return { type: 'home', category: 'Feature', title: ngHeadline(ngFill(w.pick(['Home hero {X} delights {city}', '{X} on the podium in front of home fans', 'A home podium for {X}']), vars)),
    standfirst: ngFill(w.pick(['The crowd had their hero.', 'A special day for the local fans.']), vars),
    body: [ngFill(w.pick(['{X} finished {XP} at his home race and the grandstands loved it.', 'Racing in front of his home crowd, {X} took {XP} place.']), vars),
      ngFill(w.pick(['"The support this weekend was unreal," {X} said.', '"I could feel the fans on every lap," said {X}.']), vars)], drivers: [e.driverId], teams: [e.teamId], hours: 22 };
}

function ngPlayerStory(f, w, v, c) {
  const T = f.playerTeam, best = f.player.filter(e => e.position).sort((a, b) => a.position - b.position)[0];
  const pts = f.player.reduce((a, e) => a + (e.pts || 0), 0);
  const mood = best && best.position <= 3 ? 'great' : pts > 0 ? 'ok' : 'bad';
  const boss = T.principal ? T.principal.split('/')[0].trim() : `the ${T.name} team boss`;
  const vars = Object.assign({}, v, { PT: T.name, boss, pts, best: best ? ngOrd(best.position) : '', bestPlace: best ? (best.position === 1 ? 'victory' : ngOrd(best.position) + ' place') : '', bestD: best ? f.d(best.driverId).lastName : '' });
  const title = { great: ['{PT} celebrate {bestPlace} in {city}', 'Big result for {PT} in {gpShort}', '{bestD} brings {PT} a podium', 'Party time at {PT} after {bestPlace} in {city}'],
    ok: ['{PT} bank {pts} points in {city}', 'Solid weekend for {PT} at {gpShort}', '{PT} keep scoring in {city}', 'Points for {PT} as {bestD} finishes {best}'],
    bad: ['Tough weekend for {PT} in {city}', '{PT} leave {gpShort} empty-handed', 'No points for {PT} in {city}', 'Frustration at {PT} after {gpShort}', '{boss}: "We have work to do"'] }[mood];
  const quote = { great: ['"The whole team deserves this," said {boss}. "We have been building towards a result like this."', '"Days like this make the hard work worth it," said {boss}.', '"{bestD} was mighty today," said {boss}. "We will enjoy it, then reset for {nextGp}."'],
    ok: ['"Points are points," said {boss}. "But we know there is more to come."', '"A good team effort," said {boss}. "We will keep pushing."', '"We maximised what we had," said {boss}. "The upgrades should help us take the next step."', '"Solid, not spectacular," said {boss}. "We take the points and move on."'],
    bad: ['"Not the weekend we wanted," admitted {boss}. "We will understand what went wrong and come back stronger."', '"We have work to do," said {boss}. "The team is already focused on {nextGp}."', '"We lacked pace all weekend," said {boss}. "Nobody is hiding from that."', '"It hurts," said {boss}. "But this team has bounced back before."', '"The data will tell us a lot," said {boss}. "We need answers before {nextGp}."'] }[mood];
  const lines = f.player.map(e => `${f.d(e.driverId).lastName} ${e.position ? ngOrd(e.position) : MX_STATUS_LABEL[e.status] || e.status}`).join(', ');
  return { type: 'player', category: 'Interview', title: ngHeadline(ngFill(w.pick(title), vars)), standfirst: ngFill(w.pick(['Reaction from the {PT} garage.', '{boss} reflects on {gpShort}.']), vars),
    body: [ngFill(w.pick(pts ? ['{PT} finished {gpShort} with {pts} points.', 'For {PT}, {gpShort} brought {pts} points.', '{PT} added {pts} points to their tally in {city}.'] : ['{PT} left {gpShort} without a point.', 'There were no points for {PT} in {city}.', '{PT} drew a blank in {gpShort}.']), vars) + ` Results: ${lines}.`, ngFill(w.pick(quote), vars)],
    drivers: f.player.map(e => e.driverId), teams: [T.id], hours: 23 };
}

function ngPreview(c, round, w) {
  const s = round.seasonId, st = driverStandings(c, s, round.round - 1);
  const done = completedRounds(c, s).filter(r => r.round < round.round);
  const lastW = done.length ? classify(c, resultFor(c, done[done.length - 1].id, 'race')).find(e => e.position === 1) : null;
  const d = id => driverOf(id) || { lastName: id };
  const vars = { gp: `the ${ngGp(round)}`, gpShort: round.name, city: round.city || round.name, circuit: round.circuit || round.city || round.name,
    L: st[0] && st[0].points ? d(st[0].id).lastName : '', L2: st[1] ? d(st[1].id).lastName : '', gap: st[0] && st[1] ? st[0].points - st[1].points : 0,
    lastW: lastW ? d(lastW.driverId).lastName : '', n: round.round, total: roundsOf(c, s).length, date: fmtDay(round.dateEnd || round.dateStart) };
  const opener = round.round === 1;
  const title = opener ? w.pick(['Season preview: lights out in {city}', 'The wait is over: {gpShort} opens the season', 'Everything you need to know before {gpShort}'])
    : w.pick(['{gpShort} preview: can anyone stop {L}?', 'What to watch at {gpShort}', 'Round {n}: the title fight heads to {city}', '{gpShort} preview: {gap} points to play with']);
  const body = [];
  body.push(w.pick(['Round {n} of {total} takes the field to {circuit} on {date}.', 'Next stop: {circuit}, with the race on {date}.']));
  if (round.sprint) body.push(w.pick(['It is a Sprint weekend, so there are extra points on Saturday.', 'With a Sprint on the schedule, the format offers more chances to score.']));
  if (!opener && vars.L) body.push(w.pick(['{L} arrives as championship leader, {gap} points ahead of {L2}.', 'The gap at the top is {gap} points, with {L} ahead of {L2}.']));
  if (vars.lastW && vars.lastW !== vars.L) body.push(w.pick(['{lastW} won the last race and will want to keep the momentum.', 'All eyes are also on {lastW}, the winner last time out.']));
  if (opener) body.push(w.pick(['After a winter of work, nobody knows the true order yet.', 'Every team starts on zero points. The first answers come this weekend.']));
  return { type: 'preview', category: 'Feature', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['The key storylines ahead of {gpShort}.', 'Our look ahead to {city}.']), vars),
    body: body.map(x => ngFill(x, vars)), drivers: st.slice(0, 2).filter(r => r.points).map(r => r.id), teams: [], hoursBefore: 72 };
}

/* --- which stories, in what order ------------------------------------------ */
function ngStoriesFor(c, round, usedHeads, variant) {
  ngSeries(c);
  const f = ngFacts(c, round); if (!f) return [];
  const seed = `${round.id}|${variant || 0}`;
  const out = [ngRaceReport(f, ngWriter(seed + 'r', usedHeads), ngVars(f))];
  const v = ngVars(f);
  const cands = [];
  if (f.L2 && (f.clinchedNow || (f.leaderBefore && f.L.id !== f.leaderBefore && f.raced >= 1) || (f.gap <= 10 && f.raced >= 2) || f.last)) cands.push([f.clinchedNow ? 100 : 60, () => ngTitleStory(f, ngWriter(seed + 't', usedHeads), v)]);
  if (f.firstWin || f.firstPodiums.length || f.streak >= 3) cands.push([f.firstWin ? 80 : 45, () => ngMilestoneStory(f, ngWriter(seed + 'm', usedHeads), v)]);
  if ((f.leaderBeforeEntry && !f.leaderBeforeEntry.position && f.leaderBefore) || f.dnfs.length >= 4) cands.push([55, () => ngDramaStory(f, ngWriter(seed + 'd', usedHeads), v)]);
  if (f.home) cands.push([40, () => ngHomeStory(f, ngWriter(seed + 'h', usedHeads), v)]);
  if (f.playerTeam && f.player.length) cands.push([50, () => ngPlayerStory(f, ngWriter(seed + 'p', usedHeads), v, c)]);
  const junior = ngJunior(c, f);
  if (junior) cands.push([junior.score, () => ngAcademyStory(c, f, ngWriter(seed + 'a', usedHeads), v, junior)]);
  cands.sort((a, b) => b[0] - a[0]).slice(0, 2).forEach(([, mk]) => out.push(mk()));
  return out;
}

/* --- academies: F2 results seen from the F1 team that owns the driver ------- */
// The best-placed academy driver on the podium, or the academy driver leading the F2 standings.
function ngJunior(c, f) {
  if (!NG_F2.has(f.round.seasonId) || !(c.academies || []).length) return null;
  const pod = [f.W, f.P2, f.P3].filter(Boolean).map((e, i) => ({ e, pos: i + 1, a: academyOf(c, e.driverId) })).find(x => x.a);
  if (pod) return { kind: pod.pos === 1 ? 'win' : 'podium', driverId: pod.e.driverId, teamId: pod.e.teamId, pos: pod.pos, academy: pod.a, score: pod.pos === 1 ? 52 : 35 };
  const la = f.L && f.raced >= 3 && academyOf(c, f.L.id);
  return la ? { kind: 'leader', driverId: f.L.id, teamId: driverCurrentTeam(c, f.L.id, f.round.seasonId), academy: la, score: 42 } : null;
}
function ngAcademyStory(c, f, w, v, j) {
  const X = f.d(j.driverId), ft = byId(c.teams, j.academy.f1TeamId), F1 = ft ? ft.name : 'his F1 team';
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, F1, XP: ngOrd(j.pos || 1), prog: j.academy.name || `${F1} Academy` });
  const H = { win: ['{F1} junior {X} wins in {city}', '{X} gives {F1} reason to smile in {city}', 'Academy star {X} takes {city} victory'],
    podium: ['{F1} junior {X} on the podium in {city}', '{X} keeps {F1} watching with {XP} in {city}'],
    leader: ['{F1} watching {X} closely as he leads F2', 'F1 seat talk grows as {X} tops the F2 standings', 'Is {X} ready for {F1}?'] }[j.kind];
  const B = {
    win: ['{Xfull} won {gp} for {T}, and the result will not go unnoticed at {F1}.', 'Victory in {city} adds to the case for {Xfull}, a member of the {prog}.'],
    podium: ['{Xfull} finished {XP} in {gp}, another strong result for the {prog} driver.', 'A {XP} place in {city} keeps {Xfull} in the spotlight at {F1}.'],
    leader: ['{Xfull} leads the Formula 2 championship, and the paddock is already asking when {F1} will make its move.', 'At the top of the F2 table, {Xfull} has given the {prog} a big decision to make.'] }[j.kind];
  const Q = ['"Every race here is a test. I want to show {F1} I am ready," {X} said.', '"We know who is watching. That is extra motivation," said {X}.', 'A {F1} source said the team is "very happy" with how {X} is developing.'];
  return { type: 'academy', category: 'News', title: ngHeadline(ngFill(w.pick(H), vars)), standfirst: ngFill(w.pick(['The view from the {F1} junior programme.', 'The {prog} has a driver in form.']), vars),
    body: [ngFill(w.pick(B), vars), ngFill(w.pick(Q), vars)], drivers: [j.driverId], teams: [j.teamId, j.academy.f1TeamId].filter(Boolean), hours: 26, academyTeamId: j.academy.f1TeamId };
}

/* --- pictures: a stable photo per story -------------------------------------- */
// Academy stories use the parent F1 team's photos; others the lead driver's photos, then the season's photo pool.
function ngImage(c, rd, st, key) {
  const pick = list => list.length ? list[ngHash(key) % list.length] : '';
  const photosOf = ids => ids.flatMap(id => (byId(c.drivers, id) || {}).photoUrls || []);
  if (st.academyTeamId) {
    const f1 = allSeasonsDesc(c).find(s => (s.series || 'f1') === 'f1');
    const ids = f1 ? [...new Set(assignmentsOf(c, f1.id).filter(a => a.teamId === st.academyTeamId).map(a => a.driverId))] : [];
    const img = pick(photosOf(ids)); if (img) return img;
  }
  return pick(photosOf(st.drivers.slice(0, 1))) || pick(photosOf(st.drivers)) || pick((byId(c.seasons, rd.seasonId) || {}).photoUrls || []);
}

/* --- sync with the career -------------------------------------------------- */
const NG_AUTHORS = { 'Race Report': ['Race Desk', 'Elena Marsh', 'Tom Whitaker'], Analysis: ['Title Watch', 'Jonas Reiter'], News: ['Paddock News', 'Sofia Lang'],
  Feature: ['Feature Desk', 'Marco Bellini'], Interview: ['Team Radio', 'Ana Duarte'] };
const ngSig = a => ngHash(a.title + '\n' + a.standfirst + '\n' + a.body);
function ngIso(dateStr, hours) { const d = parseDate(dateStr) || new Date(); return new Date(d.getTime() + (hours || 0) * 36e5).toISOString(); }

function syncAutoNews(c) {
  if (!c || c.meta.autoNews === false) return false;
  ngSeries(c);
  let changed = false;
  const wanted = new Map();
  c.seasons.forEach(s => {
    const usedHeads = new Set();
    const rounds = roundsOf(c, s.id);
    rounds.forEach(rd => {
      const variant = (c.articles.find(a => a.auto && a.auto.round === rd.id && !a.auto.key.endsWith(':preview')) || { auto: {} }).auto.variant || 0;
      ngStoriesFor(c, rd, usedHeads, variant).forEach(st => wanted.set(`${rd.id}:${st.type}`, [rd, st]));
    });
    const nx = nextRound(c, s.id);
    if (nx && (s.id === (activeSeason(c) || {}).id)) {
      const variant = (c.articles.find(a => a.auto && a.auto.key === `${nx.id}:preview`) || { auto: {} }).auto.variant || 0;
      wanted.set(`${nx.id}:preview`, [nx, ngPreview(c, nx, ngWriter(`${nx.id}|p|${variant}`, usedHeads))]);
    }
  });
  // remove auto stories that no longer apply (unless the user edited them, or it is an old preview)
  c.articles = c.articles.filter(a => {
    if (!a.auto || wanted.has(a.auto.key)) return true;
    if (a.auto.key.endsWith(':preview') && resultFor(c, a.roundId, 'race')) return true;     // keep past previews as archive
    if (ngSig(a) !== a.auto.sig) return true;                                                   // user edited: keep
    changed = true; return false;
  });
  wanted.forEach(([rd, st], key) => {
    const id = 'art_auto_' + key.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const old = c.articles.find(a => a.id === id);
    if (old && ngSig(old) !== old.auto.sig) return;                                             // user edited: leave it alone
    const variant = old ? old.auto.variant || 0 : 0;
    const authors = NG_AUTHORS[st.category] || ['Career Desk'];
    const rec = {
      id, seasonId: rd.seasonId, roundId: rd.id, category: st.category, title: st.title, slug: slugify(st.title),
      standfirst: st.standfirst, body: st.body.join('\n\n'), author: authors[ngHash(key) % authors.length],
      publishedAt: st.hoursBefore ? ngIso(rd.dateStart || rd.dateEnd, -st.hoursBefore + 9) : ngIso(rd.dateEnd || rd.dateStart, 4 + st.hours),
      featured: old ? !!old.featured : false, imageUrl: (old && old.imageUrl) || ngImage(c, rd, st, key),
      driverIds: [...new Set(st.drivers)].filter(x => byId(c.drivers, x)), teamIds: [...new Set(st.teams)].filter(x => byId(c.teams, x)),
    };
    rec.auto = { key, round: rd.id, variant, sig: ngSig(rec) };
    if (old && JSON.stringify(old) === JSON.stringify(rec)) return;
    if (old) Object.assign(old, rec); else c.articles.push(rec);
    changed = true;
  });
  return changed;
}

/* "Rewrite": new wording for one auto story (and its round siblings stay as they are). */
function rewriteAutoNews(c, articleId) {
  const a = byId(c.articles, articleId); if (!a || !a.auto) return false;
  a.auto.variant = (a.auto.variant || 0) + 1;
  a.auto.sig = ngSig(a);                         // treat as unedited so sync may replace it
  const key = a.auto.key;
  c.articles.filter(x => x.auto && x.auto.key !== key && x.auto.round === a.auto.round && !key.endsWith(':preview') && !x.auto.key.endsWith(':preview')).forEach(x => { x.auto.variant = a.auto.variant; });
  return syncAutoNews(c);
}
