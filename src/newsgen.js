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
    c, round, rounds, race, fin, d, t,
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
/* --- Tracery-style grammar ------------------------------------------------------
   Technique from galaxykate/tracery (Apache-2.0): rules hold options, options may contain #other# symbols,
   so a few hundred phrases combine into many thousands of sentences. Our own small engine keeps it offline
   and seeded (same race → same article on every load). Modifiers: #x.capitalize#, #x.a#, #x.s#, #x.possessive#.
   Within one article an option is not reused until its rule runs out. {Vars} are filled afterwards by ngFill. */
function ngGrammar(rules, rnd) {
  const used = new Set();
  const pick = k => { const o = rules[k]; if (!o) return '#' + k + '#'; const free = o.filter(x => !used.has(k + '|' + x)); const list = free.length ? free : o;
    const x = list[Math.floor(rnd() * list.length)]; used.add(k + '|' + x); return x; };
  const mods = { capitalize: x => x.charAt(0).toUpperCase() + x.slice(1), a: x => (/^[aeiou]/i.test(x) ? 'an ' : 'a ') + x, s: x => /s$/.test(x) ? x : x + 's', possessive: x => /s$/.test(x) ? x + '’' : x + '’s', lower: x => x.charAt(0).toLowerCase() + x.slice(1) };
  const expand = (t, d = 0) => d > 12 ? String(t) : String(t).replace(/#([A-Za-z0-9_]+)((?:\.[a-z]+)*)#/g, (m, k, md) => {
    let r = expand(pick(k), d + 1); md.split('.').filter(Boolean).forEach(x => { if (mods[x]) r = mods[x](r); }); return r; });
  return { expand, pick: list => expand(list[Math.floor(rnd() * list.length)]) };
}
// shared vocabulary: synonyms and sentence shapes used by every story
const NG_G = {
  won: ['won', 'took', 'claimed', 'secured', 'sealed', 'collected', 'captured', 'converted his chances into'],
  win: ['victory', 'win', 'triumph', 'success'],
  race: ['race', 'Grand Prix', 'contest', 'afternoon', 'encounter'],
  drove: ['drove', 'raced', 'fought', 'battled', 'worked'],
  strong: ['strong', 'measured', 'composed', 'disciplined', 'mature', 'assured', 'controlled'],
  great: ['superb', 'excellent', 'outstanding', 'impressive', 'fine', 'polished'],
  hard: ['tough', 'difficult', 'frustrating', 'testing', 'bruising', 'long'],
  team: ['team', 'squad', 'outfit', 'crew'],
  then: ['Behind him', 'Further back', 'Elsewhere', 'In the pack', 'Down the order'],
  meanwhile: ['Meanwhile', 'At the same time', 'Away from the lead', 'Elsewhere on the grid'],
  quoteVerb: ['said', 'explained', 'told reporters', 'reflected', 'admitted', 'added', 'insisted'],
  fans: ['the crowd', 'the grandstands', 'the fans', 'the spectators'],
  pressure: ['pressure', 'heat', 'attention', 'scrutiny'],
  momentum: ['momentum', 'confidence', 'rhythm', 'form'],
  tyres: ['tyres', 'rubber', 'compounds', 'tyre life'],
  strategy: ['strategy', 'pit-wall calls', 'race plan', 'timing of the stops'],
  quoteWin: ['"What a day. #quoteBody#"', '"#quoteBody# I am really proud of everyone."', '"Honestly, #quoteBody.lower#"', '"#quoteBody# We take this and keep pushing."'],
  quoteBody: ['The car was fantastic and the team did a perfect job.', 'We managed the #tyres# well and that made the difference at the end.', 'This one means a lot because we had to work for every lap.', 'The start was the key, and after that I could control the pace.', 'The #strategy# was spot on, so thank you to everyone in the garage.', 'It was hot out there and the #tyres# were on the limit, but we made it work.', 'We have been close a few times, so it feels good to finish the job.', 'I tried to stay calm in the traffic and wait for the right moment.'],
  quoteP2: ['"Second is a good result, but I wanted more today," {P2} #quoteVerb#.', '"We were quick, just not quick enough," {P2} #quoteVerb#. "We will come back stronger."', '{P2} called second place "#p2word#" and said the gap was "#gapword#".', '"I gave it everything. Congratulations to {W}," {P2} #quoteVerb#.'],
  p2word: ['the maximum today', 'a fair result', 'solid points', 'bittersweet'],
  gapword: ['too big to close', 'smaller than it looked', 'all about the first stint', 'down to traffic'],
  quoteBoss: ['{boss} #quoteVerb#: "#bossBody#"', '{boss} was full of praise afterwards: "#bossBody#"', 'The verdict from {boss}: "#bossBody#"'],
  bossBody: ['That was a complete weekend from the whole team.', 'He drove like a champion today, and the team gave him the car to do it.', 'We have worked hard for days like this, and it is good to see it pay off.', 'The pit crew was perfect and the #strategy# worked exactly as planned.', 'We enjoy this tonight, and tomorrow we start working on the next one.'],
  openLaps: ['The opening laps set the tone, with {W} quickly into a #strong# rhythm.', 'From the moment the lights went out, {W} looked comfortable at the front of the #race#.', 'The first stint was all about track position, and {W} judged it perfectly.', 'The early laps were #hard# for the chasing pack, who could not match the pace of {W}.', '{W} settled into the #race# early and let the others come to him.'],
  midRace: ['The middle of the #race# was decided by the #strategy#, and {Wt} got it right.', 'As the #tyres# began to fade, the gaps started to grow.', 'Pit stops reshuffled the order for a few laps, but the leaders soon settled back into place.', 'Halfway through, the question was whether anyone could stay with {W} on the second set of #tyres#.', 'The pit wall kept a close eye on the #tyres#, and the call came at exactly the right time.'],
  lateRace: ['In the closing laps, {W} managed the gap and brought the car home.', 'The final laps were a test of nerve, and {W} passed it.', 'There was no late drama at the front; {W} had done the hard work earlier.', 'With ten laps to go the result looked settled, and so it proved.', 'By the last lap, {W} could afford to back off and enjoy the moment.'],
  circuitLine: ['{circuit} is never an easy place to get everything right, and this weekend was no exception.', 'The fast corners of {circuit} rewarded a well-balanced car.', '{city} delivered the kind of #race# the sport loves.', 'Track conditions at {circuit} changed through the weekend, and the teams had to adapt.', 'Under the eyes of #fans# in {city}, the drivers gave everything.'],
  openerLine: ['It is the first #win# of the new season, and the first points on the board.', 'After a long winter, the first answers are in, and {W} has the early lead.', 'The opening round rarely tells the whole story, but it does set the mood.'],
  closer: ['The #team.s# now have a short time to regroup.', 'Nobody in the paddock will forget this one soon.', 'It was #race.a# that will shape the rest of the season.', 'The story of the season has a new chapter.'],
};

// F2 has feature races, not Grands Prix
const ngVocab = round => NG_F2.has(round.seasonId) ? Object.assign({}, NG_G, { race: ['race', 'feature race', 'contest', 'afternoon', 'encounter'] }) : NG_G;
// Extra paragraphs for race reports: start, podium fight, midfield, the winner's season, more voices and the teams' fight.
// Each paragraph appears only when the facts behind it exist; wording comes from the grammar, so reports rarely repeat.
function ngLongReport(f, w, v) {
  const c = f.c, g = ngGrammar(ngVocab(f.round), w.rnd), out = [], say = t => ngFill(g.expand(t), Object.assign({}, v, { Wt: f.t(f.W.teamId).name }));
  const name = e => f.d(e.driverId).lastName, team = e => f.t(e.teamId).name;
  const P = f.fin, ptsN = (ruleFor(c, f.round.seasonId).race || []).length || 10;
  // the start
  if (f.pole && f.pole !== f.W.driverId) {
    const pe = f.race.find(e => e.driverId === f.pole);
    out.push(ngFill(g.pick([`{Pole} started from pole position but finished ${pe && pe.position ? ngOrd(pe.position) : 'out of the points'}, and {W} made the most of it.`,
      `Pole-sitter {Pole} could not hold on to the lead, and the #race# swung towards {W}.`, `It was {Pole} who led them away from pole, yet the day belonged to {W}.`]), v));
  }
  const gainers = P.filter(e => e.grid && e.grid - e.position >= 5).sort((a, b) => (b.grid - b.position) - (a.grid - a.position)).slice(0, 2);
  if (gainers.length) out.push(gainers.map(e => g.pick([`${name(e)} climbed from ${ngOrd(e.grid)} to ${ngOrd(e.position)}.`, `${name(e)} made up ${e.grid - e.position} places to finish ${ngOrd(e.position)}.`])).join(' '));
  // the story of the race (generic flow, three beats)
  out.push(say('#circuitLine#'));
  if (f.opener) out.push(say('#openerLine#'));
  out.push(say('#openLaps# #midRace#'));
  out.push(say('#lateRace#'));
  // podium fight
  if (P[1] && P[2]) out.push(ngFill(g.pick([`{P2} brought the ${team(P[1])} home in second place, with {P3} completing the podium for ${team(P[2])}.`,
    `Second place went to {P2} of ${team(P[1])}, and ${team(P[2])}’s {P3} took the final podium spot.`,
    `The rest of the podium was filled by {P2} (${team(P[1])}) and {P3} (${team(P[2])}).`]), v));
  // midfield and points
  const mid = P.slice(3, ptsN);
  if (mid.length >= 3) {
    const list = mid.slice(1).map(name), last = list.pop();
    const rest = `${list.join(', ')}${list.length ? ' and ' : ''}${last}`;
    out.push(say(g.pick([`#then#, ${name(mid[0])} finished fourth for ${team(mid[0])}, ahead of ${rest}, who all scored points.`,
      `Fourth place went to ${name(mid[0])} (${team(mid[0])}). The remaining points went to ${rest}.`,
      `${name(mid[0])} led the chasing group home in fourth, with ${rest} also in the points.`,
      `Just off the podium, ${name(mid[0])} took fourth for ${team(mid[0])}; ${rest} completed the top ${ngWord(ptsN)}.`])));
  }
  const tenth = P[ptsN];
  if (tenth) out.push(say(g.pick([`${name(tenth)} just missed out in ${ngOrd(tenth.position)}, the first driver without a point.`, `Agonisingly, ${name(tenth)} finished ${ngOrd(tenth.position)}, one place outside the points.`,
    `${ngOrd(tenth.position)} place and no reward: ${name(tenth)} was the unlucky one today.`, `For ${team(tenth)}, ${ngOrd(tenth.position)} for ${name(tenth)} meant an empty-handed weekend.`])));
  // the winner's team-mate and a strong day for a smaller team
  const mate = f.race.find(e => e.teamId === f.W.teamId && e.driverId !== f.W.driverId);
  if (mate && !(mate.position && mate.position <= 3) && mate !== P[ptsN]) out.push(say(mate.position ? g.pick([`Team-mate ${name(mate)} finished ${ngOrd(mate.position)}${mate.position <= 3 ? ', completing a big day for the team' : ''}.`, `In the other ${team(mate)}, ${name(mate)} came home ${ngOrd(mate.position)}.`]) : `It was a less happy afternoon for team-mate ${name(mate)}, who did not see the flag.`));
  const top3 = teamStandings(c, f.round.seasonId, f.round.round).slice(0, 3).map(r => r.id);
  const star = P.slice(4, ptsN).find(e => !top3.includes(e.teamId) && e.teamId !== f.W.teamId);
  if (star) out.push(say(g.pick([`It was #great.a# day for ${team(star)}: ${name(star)} finished ${ngOrd(star.position)}.`, `${team(star)} will be pleased with ${ngOrd(star.position)} for ${name(star)}, a result that brings valuable points.`, `${name(star)} was the best of the rest for ${team(star)} in ${ngOrd(star.position)}.`])));
  // points haul per team this race
  const haul = {}; f.race.forEach(e => { haul[e.teamId] = (haul[e.teamId] || 0) + (e.pts || 0); });
  const hs = Object.entries(haul).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (hs.length >= 2) out.push(say(g.pick([`On points, ${f.t(hs[0][0]).name} had the best day with ${hs[0][1]}, ahead of ${f.t(hs[1][0]).name} on ${hs[1][1]}${hs[2] ? ` and ${f.t(hs[2][0]).name} on ${hs[2][1]}` : ''}.`,
    `${f.t(hs[0][0]).name} scored ${hs[0][1]} points this weekend, the most of any team. ${f.t(hs[1][0]).name} collected ${hs[1][1]}.`])));
  // stat of the day: how many different winners so far
  const winners = new Set(ngSeasonRaces(c, f.round).map(x => (x.rs.find(e => e.position === 1) || {}).driverId).filter(Boolean));
  const n = f.raced + 1;
  out.push(say(winners.size === n && n > 1 ? `That makes ${ngWord(winners.size)} different winners in ${ngWord(n)} races, and nobody has won twice yet.`
    : n === 1 ? 'It is the first result of the year, and every number in the standings starts here.'
    : g.pick([`There have now been ${ngWord(winners.size)} different winners in ${ngWord(n)} races this season.`, `${ngCap(ngWord(winners.size))} drivers have now won a race this year, after ${ngWord(n)} rounds.`,
      `The list of winners this season is ${ngWord(winners.size)} names long after ${ngWord(n)} races.`, `After ${ngWord(n)} rounds, ${ngWord(winners.size)} different drivers have stood on the top step.`])));
  // the winner's season so far
  const row = f.after.find(r => r.id === f.W.driverId);
  if (row && f.raced >= 1) {
    out.push(say(g.pick([`The #win# is {W}’s ${ngOrd(row.wins)} of the season. He now has ${row.podiums} podium${row.podiums === 1 ? '' : 's'} and ${row.points} points.`,
      `It takes {W} to ${row.wins} win${row.wins === 1 ? '' : 's'} this year and ${row.points} points in total, good for ${ngOrd(row.position)} in the standings.`,
      `{W} has now ${row.wins === 1 ? 'won once' : `won ${row.wins} times`} this season, and ${row.podiums} of his finishes have been on the podium.`])));
  }
  // voices
  out.push(P[1] && w.rnd() < .6 ? `"${ngSays(f.d(P[1].driverId), 'p2', w.rnd)}" ${name(P[1])} ${g.expand('#quoteVerb#')}.` : ngFill(g.expand('#quoteP2#'), v));
  const boss = (f.t(f.W.teamId) || {}).principal;
  out.push(ngFill(g.expand('#quoteBoss#'), Object.assign({}, v, { boss: boss ? `${f.t(f.W.teamId).name} team principal ${boss}` : `A ${f.t(f.W.teamId).name} spokesperson` })));
  // teams' championship
  const ts = teamStandings(c, f.round.seasonId, f.round.round);
  if (ts[1] && ts[0].points) { const A1 = f.t(ts[0].id).name, B1 = f.t(ts[1].id).name, gp = ts[0].points - ts[1].points;
    out.push(say(g.pick([`In the teams’ championship, ${A1} lead ${B1} by ${gp} points.`, `${A1} stay top of the teams’ table, ${gp} points clear of ${B1}.`,
      `The constructors’ standings still have ${A1} in front, with ${B1} ${gp} points behind.`, `${B1} remain ${gp} points adrift of ${A1} in the fight for the teams’ title.`]))); }
  return out.filter(Boolean);
}

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
  else if (f.pole && !f.c) two.push(ngFill(w.pick(NG.poleLine), v));
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
  ngLongReport(f, w, v).forEach(x => p.push(x));
  p.push(ngFill(w.pick(NG.quoteWin), (q => Object.assign({}, v, { q, qc: q.replace(/[.!]$/, ',') }))(w.chance(.6) ? ngSays(f.d(f.W.driverId), 'win', w.rnd) : ngFill(w.pick(NG.qWin), v))));
  const leadKind = f.gap === 0 ? 'tied' : f.L && f.leaderBefore && f.L.id !== f.leaderBefore ? 'take' : 'keep';
  p.push([f.L2 ? ngFill(w.pick(NG.lead[leadKind]), v) : '', f.last ? w.pick(NG.end) : f.next ? ngFill(w.pick(NG.next), v) : ''].filter(Boolean).join(' '));
  p.push(ngFill(ngGrammar(ngVocab(f.round), ngRng(f.round.id + 'close')).expand('#closer#'), v));
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
  // form guide: the last three winners this season
  const recent = done.slice(-3).map(r => { const e = classify(c, resultFor(c, r.id, 'race')).find(x => x.position === 1); return e ? `${d(e.driverId).lastName} (${r.name})` : null; }).filter(Boolean);
  if (recent.length >= 2) body.push(w.pick([`Form guide: the last ${ngWord(recent.length)} races were won by ${recent.join(', ')}.`, `Recent winners: ${recent.join(', ')}.`]));
  // history at this venue in earlier seasons of this career
  const past = c.rounds.filter(r => r.seasonId !== s && r.name === round.name && resultFor(c, r.id, 'race')).map(r => ({ r, e: classify(c, resultFor(c, r.id, 'race')).find(x => x.position === 1), y: (seasonOf(c, r.seasonId) || {}).year })).filter(x => x.e).sort((a, b) => b.y - a.y);
  if (past.length) body.push(`Last time here, in ${past[0].y}, ${d(past[0].e.driverId).firstName} ${d(past[0].e.driverId).lastName} won.`);
  const g = ngGrammar(Object.assign({}, ngVocab(round), { look: ['Qualifying will be crucial at {circuit}.', 'The weather and #tyres# could decide this one.', 'Expect the #strategy# to play a big part.', 'Overtaking is never easy here, so Saturday matters.', 'Teams bring upgrades all season, and this weekend is no different.'] }), w.rnd);
  body.push(g.expand('#look#'));
  return { type: 'preview', category: 'Feature', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['The key storylines ahead of {gpShort}.', 'Our look ahead to {city}.']), vars),
    body: body.map(x => ngFill(x, vars)), drivers: st.slice(0, 2).filter(r => r.points).map(r => r.id), teams: [], hoursBefore: 72 };
}

/* --- more stories per weekend ---------------------------------------------- */
const ngLast = n => x => x.lastName;
// race results of this season up to and including a round, oldest first
function ngSeasonRaces(c, round) { return roundsOf(c, round.seasonId).filter(r => r.round <= round.round).map(r => ({ r, rs: classify(c, resultFor(c, r.id, 'race')) })).filter(x => x.rs.length); }

function ngQualiStory(c, f, w, v) {
  const q = classify(c, resultFor(c, f.round.id, 'qualifying')); const p = q.find(e => e.position === 1); if (!p) return null;
  const p2 = q.find(e => e.position === 2), X = f.d(p.driverId), T = f.t(p.teamId);
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, XT: T.name, Y: p2 ? f.d(p2.driverId).lastName : 'the field', time: p.time || '' });
  return { type: 'quali', category: 'News', title: ngHeadline(ngFill(w.pick(['{X} takes pole in {city}', 'Pole position for {X} at {gpShort}', '{X} fastest in {city} qualifying', ...(p2 ? ['{X} beats {Y} to pole'] : [])]), vars)),
    standfirst: ngFill(w.pick(['Saturday belonged to {X}.', 'The grid for {gpShort} is set.']), vars),
    body: [ngFill(p2 ? w.pick(['{Xfull} put the {XT} on pole for {gp}{time}, ahead of {Y}.', 'It was {X} who found the most time in qualifying at {circuit}, beating {Y} to the top spot.'])
        : w.pick(['{Xfull} put the {XT} on pole for {gp}{time}.', 'It was {X} who found the most time in qualifying at {circuit}.']), Object.assign({}, vars, { time: vars.time ? ` with a ${vars.time}` : '' })),
      ngFill(w.pick(['"The car came alive on the last run," {X} said.', '"Pole is nice, but the points are on Sunday," said {X}.', '"I put everything together when it mattered," {X} said.']), vars)],
    drivers: [p.driverId, p2 && p2.driverId].filter(Boolean), teams: [p.teamId], hours: -26 };
}
function ngSprintStory(c, f, w, v) {
  const sp = classify(c, resultFor(c, f.round.id, 'sprint')); const a = sp.find(e => e.position === 1); if (!a) return null;
  const b = sp.find(e => e.position === 2), X = f.d(a.driverId);
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, Y: b ? f.d(b.driverId).lastName : 'the field', sname: NG_F2.has(f.round.seasonId) ? 'Sprint Race' : 'Sprint' });
  return { type: 'sprint', category: 'Race Report', title: ngHeadline(ngFill(w.pick(['{sname}: {X} wins in {city}', '{X} takes {sname} honours at {gpShort}', '{X} quickest over the short distance in {city}']), vars)),
    standfirst: ngFill(w.pick(['Extra points on Saturday.', 'A short race with big consequences.']), vars),
    body: [ngFill(w.pick(['{Xfull} won the {sname} at {circuit}, with {Y} second.', 'In the {sname}, {X} came out on top ahead of {Y}.']), vars),
      ngFill(w.pick(['The result is a boost before the main race.', 'Those points could matter at the end of the year.']), vars)],
    drivers: [a.driverId, b && b.driverId].filter(Boolean), teams: [a.teamId], hours: -20 };
}
// driver of the day: most places gained from the grid, else the best finish from a team outside the top three in the teams' standings
function ngDotd(c, f) {
  const gain = f.fin.filter(e => e.grid && e.position && e.grid - e.position >= 4).sort((a, b) => (b.grid - b.position) - (a.grid - a.position))[0];
  if (gain && gain.driverId !== f.W.driverId) return { e: gain, why: 'gain' };
  const tops = teamStandings(c, f.round.seasonId, f.round.round).slice(0, 3).map(r => r.id);
  const sur = f.fin.slice(0, 8).find(e => !tops.includes(e.teamId) && e.driverId !== f.W.driverId);
  return sur ? { e: sur, why: 'surprise' } : null;
}
function ngDotdStory(c, f, w, v, x) {
  const X = f.d(x.e.driverId), T = f.t(x.e.teamId);
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, XT: T.name, XP: ngOrd(x.e.position), XG: x.e.grid ? ngOrd(x.e.grid) : '', gained: x.e.grid ? x.e.grid - x.e.position : 0 });
  return { type: 'dotd', category: 'Feature', title: ngHeadline(ngFill(w.pick(['Driver of the Day: {X}', '{X} voted Driver of the Day in {city}', 'Fans pick {X} after {gpShort}']), vars)),
    standfirst: ngFill(w.pick(['The drive everyone was talking about.', 'Our standout performer of the weekend.']), vars),
    body: [ngFill(x.why === 'gain' ? w.pick(['{Xfull} started {XG} and finished {XP}, gaining {gained} places.', 'From {XG} on the grid to {XP} at the flag: {X} made up {gained} places.']) : w.pick(['{Xfull} brought the {XT} home in {XP}, well above what the car has shown.', 'A {XP} place for {X} was a result nobody expected from {XT}.']), vars),
      ngFill(w.pick(['"I enjoyed every lap of that," {X} said.', '"We showed what we can do," said {X}.']), vars)],
    drivers: [x.e.driverId], teams: [x.e.teamId], hours: 6 };
}
// teammate battle: the team pair with the most one-sided or the closest season head-to-head
function ngTeammates(c, f) {
  const races = ngSeasonRaces(c, f.round); if (races.length < 4) return null;
  const byTeam = {};
  f.fin.forEach(e => (byTeam[e.teamId] = byTeam[e.teamId] || []).push(e.driverId));
  let best = null;
  Object.entries(byTeam).filter(([, ds]) => ds.length === 2).forEach(([tid, [a, b]]) => {
    let wa = 0, wb = 0;
    races.forEach(({ rs }) => { const ea = rs.find(e => e.driverId === a), eb = rs.find(e => e.driverId === b); if (!ea || !eb) return;
      const pa = ea.position || 99, pb = eb.position || 99; if (pa < pb) wa++; else if (pb < pa) wb++; });
    const n = wa + wb; if (n < 4) return;
    const score = Math.abs(wa - wb) >= n * .7 ? 2 + Math.abs(wa - wb) / n : wa === wb ? 2.5 : 0;
    if (score && (!best || score > best.score)) best = { tid, a: wa >= wb ? a : b, b: wa >= wb ? b : a, wa: Math.max(wa, wb), wb: Math.min(wa, wb), score };
  });
  return best;
}
function ngTeammateStory(c, f, w, v, x) {
  const A = f.d(x.a), B = f.d(x.b), T = f.t(x.tid);
  const vars = Object.assign({}, v, { A: A.lastName, B: B.lastName, T: T.name, wa: x.wa, wb: x.wb });
  const even = x.wa === x.wb;
  return { type: 'teammates', category: 'Analysis', title: ngHeadline(ngFill(even ? w.pick(['{A} vs {B}: dead level at {T}', 'Nothing to split the {T} drivers']) : w.pick(['{A} dominating {B} at {T}', 'Inside {T}: {A} leads {B} {wa}-{wb}', 'Pressure on {B} as {A} pulls clear']), vars)),
    standfirst: ngFill(w.pick(['The team-mate battle in numbers.', 'Same car, different stories.']), vars),
    body: [ngFill(even ? '{A} and {B} have beaten each other {wa} times each in races this season.' : '{A} has finished ahead of {B} in {wa} of their {total} races together this season.', Object.assign({}, vars, { total: x.wa + x.wb })),
      ngFill(even ? w.pick(['It makes {T} one of the closest pairings on the grid.', 'Neither driver can claim the upper hand yet.']) : w.pick(['{B} needs a response, and soon.', 'For {B}, the numbers make uncomfortable reading.']), vars)],
    drivers: [x.a, x.b], teams: [x.tid], hours: 30 };
}
function ngTeamsStory(c, f, w, v) {
  const ts = teamStandings(c, f.round.seasonId, f.round.round); if (ts.length < 2 || !ts[0].points) return null;
  const A = f.t(ts[0].id), B = f.t(ts[1].id), gap = ts[0].points - ts[1].points;
  const vars = Object.assign({}, v, { A: A.name, B: B.name, gap });
  return { type: 'teams', category: 'Analysis', title: ngHeadline(ngFill(gap <= 25 ? w.pick(["Teams' title: {B} within {gap} of {A}", '{A} and {B} locked in constructors battle']) : w.pick(['{A} extend their lead in the teams standings', '{A} {gap} points clear in the constructors fight']), vars)),
    standfirst: ngFill(w.pick(["The teams' championship after {gpShort}.", 'Where the constructors stand.']), vars),
    body: [ngFill('{A} lead the teams’ championship by {gap} points from {B}.', vars), `Top five: ${ts.slice(0, 5).map(r => `${r.position}. ${f.t(r.id).name} ${r.points}`).join(' · ')}.`],
    drivers: [], teams: [ts[0].id, ts[1].id], hours: 28 };
}
// under pressure: a driver with no points in the last three races while his team-mate scored
function ngPressure(c, f) {
  const races = ngSeasonRaces(c, f.round).slice(-3); if (races.length < 3) return null;
  const pts = id => races.reduce((s, { rs }) => s + ((rs.find(e => e.driverId === id) || {}).pts || 0), 0);
  for (const e of f.fin.concat(f.dnfs)) {
    const mate = f.race.find(x => x.teamId === e.teamId && x.driverId !== e.driverId);
    if (mate && pts(e.driverId) === 0 && pts(mate.driverId) >= 6) return { id: e.driverId, mate: mate.driverId, tid: e.teamId };
  }
  return null;
}
function ngPressureStory(c, f, w, v, x) {
  const X = f.d(x.id), M = f.d(x.mate), T = f.t(x.tid);
  const vars = Object.assign({}, v, { X: X.lastName, M: M.lastName, T: T.name });
  return { type: 'pressure', category: 'News', title: ngHeadline(ngFill(w.pick(['{X} under pressure after another pointless weekend', 'Questions grow over {X} at {T}', '{T} stand by {X} despite difficult run']), vars)),
    standfirst: ngFill(w.pick(['Three races without points.', 'A run that needs to end.']), vars),
    body: [ngFill('{X} has not scored in three races, while team-mate {M} keeps bringing points home for {T}.', vars),
      ngFill(w.pick(['"We know what the problem is and we are working on it," {X} said.', 'A {T} spokesperson insisted the team "fully supports" its driver.']), vars)],
    drivers: [x.id, x.mate], teams: [x.tid], hours: 34 };
}
function ngPowerRankings(c, f, w, v) {
  const races = ngSeasonRaces(c, f.round).slice(-3);
  const form = {}; races.forEach(({ rs }) => rs.forEach(e => { form[e.driverId] = (form[e.driverId] || 0) + e.pts; }));
  const top = Object.entries(form).sort((a, b) => b[1] - a[1]).slice(0, 5); if (top.length < 5) return null;
  const vars = Object.assign({}, v, { X: f.d(top[0][0]).lastName });
  return { type: 'power', category: 'Feature', title: ngHeadline(ngFill(w.pick(['Power Rankings: {X} on top after {gpShort}', 'Who is in form? Our top five after {gpShort}']), vars)),
    standfirst: 'Ranked on points from the last three races.',
    body: [...top.map(([id, p], i) => `${i + 1}. ${f.d(id).firstName} ${f.d(id).lastName} (${f.t((f.race.find(e => e.driverId === id) || {}).teamId).name || ''}): ${p} points`), ngFill(w.pick(['{X} is the form driver of the moment.', 'Nobody is collecting points faster than {X}.']), vars)],
    drivers: top.map(t => t[0]), teams: [], hours: 50 };
}
function ngMidSeason(c, f, w, v) {
  const st = f.after.slice(0, 3); if (st.length < 3) return null;
  const vars = Object.assign({}, v, { L: f.d(st[0].id).lastName, n: f.round.round, total: f.rounds.length });
  return { type: 'midseason', category: 'Analysis', title: ngHeadline(ngFill(w.pick(['Halfway report: {L} leads at the season’s midpoint', 'Mid-season review: the story so far']), vars)),
    standfirst: ngFill('{n} of {total} races done.', vars),
    body: [ngFill('After {n} of {total} rounds, {L} leads the championship.', vars), `The top three: ${st.map(r => `${f.d(r.id).lastName} (${r.points})`).join(', ')}.`,
      w.pick(['The second half starts now.', 'There is still everything to play for.'])],
    drivers: st.map(r => r.id), teams: [], hours: 60 };
}

/* --- silly season: transfer rumours from round 12 to the end (F1) ---------- */
// Built from the career itself: F2 stars and academy juniors, struggling drivers, free agents and race winners in midfield cars.
function ngRumours(c, f) {
  if (NG_F2.has(f.round.seasonId) || f.round.round < 12) return [];
  const sid = f.round.seasonId, rn = f.round.round, out = [];
  const st = driverStandings(c, sid, rn), ts = teamStandings(c, sid, rn).map(r => r.id);
  const seats = lineupAt(c, sid, rn);
  const teamOfD = id => Object.keys(seats).find(t => seats[t].includes(id));
  const pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  // 1) F2 front-runners (or academy juniors) linked with an F1 seat
  const f2 = c.seasons.find(s => (s.series || 'f1') === 'f2' && s.year === (seasonOf(c, sid) || {}).year);
  if (f2) driverStandings(c, f2.id).filter(r => r.points > 0).slice(0, 5).forEach((r, i) => { const a = academyOf(c, r.id); const target = a ? a.f1TeamId : ts[ts.length - 1 - (i % 4)]; if (target) out.push({ kind: 'junior', who: r.id, team: target, academy: !!a, pos: i + 1 }); });
  // 2) a seat in doubt: the team-mate scores clearly more
  Object.entries(seats).forEach(([tid, ds]) => { if (ds.length !== 2) return; const [a, b] = ds; const lo = pts(a) <= pts(b) ? a : b, hi = lo === a ? b : a;
    if (pts(hi) >= 1.5 * pts(lo) + 6) out.push({ kind: 'doubt', who: lo, team: tid, other: hi }); });
  // 3) free agents: talks or a simulator test
  freeAgents(c, sid, rn).free.forEach((d, i) => { const tgt = ts[ts.length - 1 - (ngHash(d.id + f.round.id) % 5)]; out.push({ kind: 'free', who: d.id, team: tgt }, { kind: 'sim', who: d.id, team: ts[ngHash(f.round.id + d.id) % Math.max(1, ts.length)] }); });
  // 4) strong drivers in midfield cars wanted by a top team
  st.slice(0, 10).forEach(r => { const tid = teamOfD(r.id); if (tid && ts.indexOf(tid) >= 3) out.push({ kind: 'star', who: r.id, team: ts[ngHash(r.id + f.round.id) % 3], from: tid }); });
  // 5) a swap between two drivers close in points at different teams
  for (let i = 0; i + 1 < st.length && i < 16; i++) { const a = st[i].id, b = st[i + 1].id, ta = teamOfD(a), tb = teamOfD(b);
    if (ta && tb && ta !== tb && Math.abs(st[i].points - st[i + 1].points) <= 12) out.push({ kind: 'swap', who: a, team: tb, from: ta, other: b }); }
  // 6) veterans and retirement talk
  Object.entries(seats).forEach(([tid, ds]) => ds.forEach(id => { const y = Number((String((driverOf(id) || {}).dob || '').match(/\d{4}/) || [0])[0]); const age = y ? (seasonOf(c, sid) || {}).year - y : 0;
    if (age >= 33) out.push({ kind: 'retire', who: id, team: tid, age, stay: true }); }));
  // 7) a new deal close for a driver in form
  st.slice(0, 6).forEach(r => { const tid = teamOfD(r.id); if (tid) out.push({ kind: 'extend', who: r.id, team: tid, stay: true }); });
  // 8) bosses under pressure at the bottom teams
  ts.slice(-3).forEach(tid => { const d = (seats[tid] || [])[0]; if (d) out.push({ kind: 'boss', who: d, team: tid, stay: true }); });
  // 9) a technical chief linked with a struggling team
  ts.slice(0, 5).forEach((tid, i) => { const T = teamOf(tid) || {}; const tgt = ts[ts.length - 1 - i]; const d = (seats[tgt] || [])[0]; if (T.technicalChief && d && tgt !== tid) out.push({ kind: 'tech', who: d, team: tgt, from: tid, tech: T.technicalChief }); });
  // 10) a driver low in the table linked with IndyCar or endurance racing
  st.slice(-6).forEach(r => { const tid = teamOfD(r.id); if (tid) out.push({ kind: 'series', who: r.id, team: tid, series: ['IndyCar', 'the World Endurance Championship', 'Formula E', 'Le Mans with a factory team'][ngHash(r.id + rn) % 4], stay: true }); });
  return out.filter(x => x.who && x.team && (x.stay || teamOfD(x.who) !== x.team));
}

// which rumours run after this race: fresh drivers, new kinds, 2 or 3 stories, plus now and then a follow-up of an older rumour
function ngRumourPicks(c, round, memo) {
  memo = memo || {};
  if (memo[round.id]) return memo[round.id];
  memo[round.id] = [];
  const f = ngFacts(c, round); if (!f) return [];
  const cands = ngRumours(c, f); if (!cands.length) return [];
  const prev = roundsOf(c, round.seasonId).filter(r => r.round < round.round && r.round >= 12).slice(-3);
  const past = prev.map(r => ngRumourPicks(c, r, memo));
  const recentWho = new Set(past.flat().map(x => x.who)), recentKinds = past.slice(-1).flat().map(x => x.kind);
  const rnd = ngRng(round.id + 'rumours');
  const scored = cands.map(x => [x, rnd() + (recentWho.has(x.who) ? -5 : 0) + (recentKinds.includes(x.kind) ? -0.6 : 0)]).sort((a, b) => b[1] - a[1]);
  const want = rnd() < 0.5 ? 3 : 2, pick = [];
  // a follow-up of a rumour from 2 or 3 races ago
  const old = past.length >= 2 ? past[past.length - 2].filter(x => ['junior', 'free', 'sim', 'star', 'swap', 'tech'].includes(x.kind)) : [];
  if (old.length && rnd() < 0.45) { const o = old[Math.floor(rnd() * old.length)]; pick.push(Object.assign({}, o, { kind: 'followup', orig: o.kind, verdict: rnd() < 0.5 ? 'denied' : 'heating' })); }
  for (const [x, sc] of scored) { if (pick.length >= want) break; if (sc < -4 && pick.length) continue; if (pick.some(p => p.who === x.who || p.kind === x.kind)) continue; pick.push(x); }
  return (memo[round.id] = pick);
}

const NG_RUMOUR = {
  head: {
    junior: ['{T} weigh up promoting {X} for {next}', 'Is {X} ready for {T}? Paddock buzz grows', '{X} tipped for {T} seat', 'F2 star {X} on {T}’s shortlist', '{T} eye F2 front-runner {X}', 'Report: {T} in talks with {X}', 'The F2 name every team is asking about: {X}', '{X} edges closer to F1 with {T}'],
    doubt: ['{X}’s future at {T} in doubt', 'Is {X}’s {T} seat at risk?', '{T} keep options open as {X} struggles', 'Pressure mounts on {X} at {T}', '{X} running out of time at {T}?', '{T} questions grow over {X}', 'Clock ticking for {X}'],
    free: ['{X} in talks for {next} return', 'Free agent {X} linked with {T}', 'Could {X} be the answer for {T}?', '{X} eyes comeback with {T}', 'Return on the cards for {X}?', '{T} open the door to {X}'],
    sim: ['{X} spotted in the {T} simulator', 'Secret {T} sim test for {X}?', '{X} completes simulator day with {T}', 'Why was {X} at the {T} factory?', '{X} and {T}: a test with a purpose?'],
    star: ['{T} chase {X} for {next}', '{X} wanted by {T}', '{X} weighing {T} move', 'Big offer from {T} for {X}?', '{T} make {X} their top target', '{X} to leave {F}? {T} circle'],
    swap: ['Seat swap talks: {X} and {O}?', '{X} to {T}, {O} the other way?', 'Paddock whispers of a {X}–{O} switch', 'Could {T} and {F} trade drivers?', 'Driver swap rumours grow: {X} and {O}'],
    retire: ['Is {next} the last season for {X}?', '{X} retirement talk will not go away', '{X}, {age}, considering his future', 'How long will {X} keep going?', 'Retirement rumours follow {X}', '{X}: one more year, or the end?'],
    extend: ['{X} close to new {T} deal', '{T} want {X} tied down long term', 'Contract talks advanced: {X} and {T}', 'New multi-year deal for {X} near', '{X} set to stay at {T}', '{T} race to keep {X}'],
    boss: ['{T} boss under pressure', 'Questions grow over {T} leadership', 'Is {boss}’s job at {T} safe?', '{T} board losing patience?', 'Change at the top of {T}?'],
    tech: ['{T} target {F} technical chief {tech}', 'Report: {tech} wanted by {T}', '{T} plan big move for {tech}', 'Could {tech} swap {F} for {T}?', 'Engineering coup in the making at {T}?'],
    series: ['{X} linked with move to {series}', 'Is {series} the next step for {X}?', '{series} teams sound out {X}', 'Life after F1? {X} and {series}', '{series} teams circle {X}'],
    followup: { denied: ['{X} denies {T} talks', '{T} shut down {X} rumours', '"Nothing to it": {X} on the {T} story', '{T} dismiss {X} reports'], heating: ['{X}–{T} story heats up', 'More signs point to {X} and {T}', 'The {X} rumour will not go away', 'Fresh twist in the {X}–{T} saga'] },
  },
  open: {
    junior: ['{Xfull} runs {P} in Formula 2, and {T} are said to be watching every lap.', 'Sources suggest {T} have held early talks with the camp of {Xfull}.', 'After another strong weekend, the name of {Xfull} keeps coming up in the {T} motorhome.', '{T} need a driver for {next}, and {Xfull}, {P} in Formula 2, fits the profile.'],
    doubt: ['{T} are understood to be looking at alternatives to {Xfull} for {next}.', 'With points hard to come by, {Xfull} faces a crucial run of races.', '{Xfull} has {pts} points, against {mpts} for team-mate {O}. That gap gets noticed.', 'The numbers do not look good for {Xfull}: {pts} points, {mpts} for {O} in the other car.'],
    free: ['{Xfull} is without a seat, but several teams are understood to be interested.', 'Talks between {Xfull} and {T} are said to be at an early stage.', 'Out of a race seat for now, {Xfull} has never stopped talking to teams. {T} are one of them.'],
    sim: ['{Xfull} was seen at the {T} factory this week, and a simulator session is said to have taken place.', 'A long day in the {T} simulator for {Xfull} has started talk in the paddock.', 'Staff at {T} say {Xfull} spent the day in the simulator. Officially, it was "general development work".'],
    star: ['{Xfull}’s form at {F} has not gone unnoticed, and {T} are said to be interested.', 'Insiders say {T} have made contact with {Xfull}’s management.', '{Xfull} is {pos} in the standings with {pts} points in the {F}, and {T} want that speed.', 'Few drivers have done more with less than {Xfull} this year. {T} have noticed.'],
    swap: ['{Xfull} ({F}) and {O} ({T}) are separated by a handful of points, and a swap is now being discussed.', 'An unusual idea is going around: {Xfull} to {T}, {O} to {F}.', 'Both teams are said to like the idea of a straight swap between {Xfull} and {O}.'],
    retire: ['At {age}, {Xfull} has started to hint that the end is closer than the start.', 'People close to {Xfull} say he will decide on {next} in the coming weeks.', '{Xfull} is {age}, and the question of retirement follows him to every race.'],
    extend: ['{T} are said to be close to agreeing a new deal with {Xfull}, {pos} in the championship.', 'With {pts} points so far, {Xfull} is in a strong position to negotiate with {T}.', 'Talks between {T} and {Xfull} are reported to be at an advanced stage.'],
    boss: ['{T} sit {tpos} in the constructors’ standings, and the patience of the owners is said to be wearing thin.', 'Reports say the {T} board will review the leadership of {boss} after the season.', 'With few points on the board, the spotlight is on {T} team principal {boss}.'],
    tech: ['{T} are said to have approached {tech}, technical chief at {F}.', 'To fix their car, {T} want the man behind {F}’s: {tech}.', 'A big offer from {T} is reported to be on the table for {F} technical chief {tech}.'],
    series: ['With {pts} points this season, {Xfull} is said to be looking at options outside F1, including {series}.', 'Teams from {series} have contacted the management of {Xfull}, according to reports.', '{Xfull} has not hidden his interest in {series}, and the timing could be right.'],
    followup: { denied: ['A few races ago, reports linked {Xfull} with {T}. Now the story has been firmly denied.', 'The talk about {Xfull} and {T} has been played down by both sides.'], heating: ['The story about {Xfull} and {T} first surfaced a few races ago. It has only grown since.', 'More details have emerged about {Xfull} and {T}, and the rumour looks more serious by the week.'] },
  },
  source: ['according to Italian media', 'according to a well-placed paddock source', 'according to the German press', 'according to several team insiders', 'according to a source close to the driver', 'according to Dutch broadcasters', 'according to the Spanish media', 'according to one team boss, speaking off the record', 'according to our sources in the paddock', 'according to the British press'],
  sourceLine: ['That is the story, {src}.', 'Nothing is official, but talks have started, {src}.', 'The talks are real, {src}.', 'A decision could come within weeks, {src}.', 'The picture is still unclear, but contact has been made, {src}.'],
  quote: ['"I only focus on the next race," {X} said when asked.', '"There is nothing to say yet," a team source said.', '"It is normal that names come up at this time of year," said {boss}.', '"My future will be decided soon," {X} said.', '"Speculation is part of this sport," a spokesperson for {T} said.', '"We talk to many people. That does not mean anything," said {boss}.', '"I read it too. Interesting story," {X} said with a smile.', '"When there is news, you will hear it from us," a spokesperson for {T} said.'],
  close: ['Nothing is signed, and the situation could change quickly.', 'This is a rumour, and none of the parties has confirmed anything.', 'Expect this story to run for a few more weeks.', 'The next races could decide a lot.', 'For now, it is talk. But in this paddock, talk often turns into contracts.', 'Watch this space.'],
};
function ngRumourStory(c, f, w, v, x, i) {
  const sid = f.round.seasonId, rn = f.round.round, seats = lineupAt(c, sid, rn);
  const X = f.d(x.who), T = f.t(x.team), curT = Object.keys(seats).find(t => seats[t].includes(x.who));
  const st = driverStandings(c, sid, rn), ts = teamStandings(c, sid, rn).map(r => r.id);
  const pos = st.findIndex(r => r.id === x.who), mate = x.other || (seats[curT] || []).find(id => id !== x.who);
  const pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, T: T.name, F: x.from ? f.t(x.from).name : (curT ? f.t(curT).name : 'his current team'),
    O: mate ? f.d(mate).lastName : 'his team-mate', P: ngOrd(x.pos || 1), next: (seasonOf(c, sid) || {}).year + 1, pts: pts(x.who), mpts: mate ? pts(mate) : 0,
    pos: pos >= 0 ? ngOrd(pos + 1) : 'outside the points', age: x.age || '', tech: x.tech || '', series: x.series || '', tpos: ngOrd(ts.indexOf(x.team) + 1),
    boss: T.principal || `the ${T.name} team principal`, src: w.pick(NG_RUMOUR.source) });
  const k = x.kind, pickK = bank => k === 'followup' ? bank.followup[x.verdict] : bank[k];
  const body = [ngFill(w.pick(pickK(NG_RUMOUR.open)), vars), ngFill(w.pick(NG_RUMOUR.sourceLine), vars)];
  if (k === 'followup') body.push(x.verdict === 'denied' ? ngFill(w.pick(['"There have been no talks," a spokesperson for {T} said.', '{X} called it "a nice story, nothing more".', 'Both camps say the report was wrong.']), vars) : ngFill(w.pick(['Contacts between the two sides are said to have continued.', 'Several sources now describe the talks as serious.']), vars));
  body.push(w.chance(.55) && !['tech', 'boss'].includes(k) ? `Asked about it, ${X.lastName} said: "${ngSays(X, 'rumour', w.rnd)}"` : ngFill(w.pick(NG_RUMOUR.quote), vars));
  body.push(ngFill(w.pick(NG_RUMOUR.close), vars));
  return { type: 'rumour' + i, category: 'Transfer', title: ngHeadline(ngFill(w.pick(pickK(NG_RUMOUR.head)), vars)),
    standfirst: ngFill(w.pick(['Silly season rumours.', 'The paddock rumour mill is turning.', 'Transfer talk ahead of {next}.', 'The latest from the silly season.', 'Whispers in the paddock.', 'The {next} market is moving.']), vars),
    body, drivers: [x.who, k === 'swap' || k === 'doubt' ? mate : null].filter(Boolean), teams: [x.team, x.from, curT].filter((t, j, a) => t && a.indexOf(t) === j), hours: 40 + i * 14, rumour: true };
}

/* --- personalities ---------------------------------------------------------------
   How each driver tends to talk, based on how they come across in real interviews (kept respectful and light).
   calm · fiery · joker · diplomat · blunt · emotional. Set or change it in Edit Career → Drivers (field "Personality"). */
const NG_PERSONA_DEFAULT = {
  drv_max_verstappen: 'blunt', drv_lewis_hamilton: 'diplomat', drv_fernando_alonso: 'joker', drv_charles_leclerc: 'emotional', drv_lando_norris: 'emotional',
  drv_george_russell: 'diplomat', drv_oscar_piastri: 'calm', drv_kimi_antonelli: 'calm', drv_esteban_ocon: 'fiery', drv_pierre_gasly: 'emotional',
  drv_carlos_sainz: 'diplomat', drv_alexander_albon: 'joker', drv_lance_stroll: 'blunt', drv_nico_hulkenberg: 'calm', drv_valtteri_bottas: 'joker',
  drv_sergio_perez: 'diplomat', drv_isack_hadjar: 'emotional', drv_liam_lawson: 'fiery', drv_oliver_bearman: 'calm', drv_gabriel_bortoleto: 'calm',
  drv_franco_colapinto: 'emotional', drv_arvid_lindblad: 'blunt', drv_rafael_camara: 'calm', drv_nikola_tsolov: 'fiery', drv_alexander_dunne: 'blunt',
  drv_colton_herta: 'joker', drv_dino_beganovic: 'calm', drv_gabriele_mini: 'diplomat', drv_joshua_durksen: 'emotional', drv_pablo_adanez: 'fiery',
};
const NG_PERSONAS = ['calm', 'fiery', 'joker', 'diplomat', 'blunt', 'emotional'];
function ngPersona(d) {
  if (!d) return 'calm';
  if (NG_PERSONAS.includes(d.personality)) return d.personality;
  return NG_PERSONA_DEFAULT[d.id] || NG_PERSONAS[ngHash(d.id) % NG_PERSONAS.length];
}
// what each personality says in a given situation
const NG_VOICE = {
  win: { calm: ['It was a clean race and we executed well.', 'Good points, good day. We stay focused.'], fiery: ['That is how you answer the critics!', 'I wanted this one badly, and nobody was going to stop me.'],
    joker: ['I might buy the mechanics dinner tonight. Maybe.', 'Not bad for someone who forgot his lucky socks.'], diplomat: ['This win belongs to everyone at the factory.', 'Huge respect to my rivals, it was a fair fight.'],
    blunt: ['We were the fastest. Simple as that.', 'The car was good, I did my job, we won.'], emotional: ['I am shaking a bit, honestly. This means so much.', 'I could not stop smiling on the in-lap.'] },
  p2: { calm: ['Second is solid. We take it.', 'We maximised what we had.'], fiery: ['Second is the first loser. I am not happy.', 'I wanted the win and I did not get it. That hurts.'],
    joker: ['I saw the gearbox of the winner for a long time. Nice gearbox.', 'Second is just first with extra motivation.'], diplomat: ['Congratulations to the winner, he deserved it.', 'A strong team result, and we keep building.'],
    blunt: ['We were not quick enough. That is it.', 'Second. Not what we came for.'], emotional: ['So close. I gave everything in those last laps.', 'I am proud, but part of me is gutted.'] },
  dnf: { calm: ['These things happen. We will look at it and move on.', 'Frustrating, but there is nothing to gain from getting angry.'], fiery: ['This is unacceptable. Someone needs to explain what happened.', 'I am furious. We threw away big points today.'],
    joker: ['Well, at least I got an early shower.', 'I had a lovely view of the race from the wall.'], diplomat: ['We win together and we lose together. The team will find the answer.', 'Nobody in the team wanted this, and we will fix it.'],
    blunt: ['A zero. Not good enough from anyone.', 'We failed today. That is the truth.'], emotional: ['I just want to go home and be alone for a bit.', 'It hurts so much, because the pace was there.'] },
  blame: { calm: ['We need to talk about it in private, not in front of the cameras.', 'There was contact. We will review it calmly.'], fiery: ['He left me no space. Completely stupid move.', 'I have nothing to say to him right now. Nothing good, anyway.'],
    joker: ['We both wanted the same piece of tarmac. It did not end well for the tarmac.', 'Next time I will send him a calendar invite before I overtake.'], diplomat: ['It was a racing incident. We will learn as a team.', 'Both of us want to win, and today that cost us.'],
    blunt: ['His fault. Watch the replay.', 'He made a mistake and we both paid for it.'], emotional: ['I am so disappointed. For the team, for everyone.', 'It is a nightmare for all of us.'] },
  surprise: {
    calm: ['I do not read the news. I find it much better for my sleep.', 'Honestly, I think the title fight is far from over, whatever the table says.', 'I spend my free time fishing now. It keeps my head quiet.'],
    fiery: ['Some drivers out there race like it is a video game. It has to stop.', 'If the team cannot give me a winning car, I will look elsewhere. That is all I will say.', 'I am tired of hearing that experience matters more than speed.'],
    joker: ['If they put karaoke in the drivers’ parade, I would win the championship.', 'My engineer says I talk too much on the radio. I disagree, at length.', 'I have asked the team for a cup holder. Still waiting.'],
    diplomat: ['We should race at more historic tracks. The sport needs its roots.', 'The young drivers coming through are the best generation I have seen.', 'Every team on this grid deserves respect, from first to last.'],
    blunt: ['Too many races on the calendar. Everyone thinks it, I am just saying it.', 'Sprint races? Not my favourite. There, I said it.', 'Half the paddock talks too much. I prefer to drive.'],
    emotional: ['I still watch my first win on YouTube sometimes. Is that strange?', 'Some days I wonder what I would do without racing. I do not like the answer.', 'My family is the reason I am here. Every lap is for them.'] },
};
const ngSays = (d, situation, rnd) => { const bank = (NG_VOICE[situation] || {})[ngPersona(d)] || NG_VOICE[situation].calm; return bank[Math.floor(rnd() * bank.length)]; };
// what drivers say about rumours, by personality
NG_VOICE.rumour = { calm: ['I do not pay attention to rumours. I drive the car.', 'When something happens, you will know.'], fiery: ['Who writes these stories? Nobody asked me.', 'I am tired of reading about my future in the newspaper.'],
  joker: ['I heard that rumour too. I am waiting to find out what I decided.', 'If I signed every contract I read about, I would drive for six teams.'], diplomat: ['I respect my team and I will not talk about other teams.', 'Every driver wants the best future. We will talk at the right moment.'],
  blunt: ['No comment. Next question.', 'Rumours. Next.'], emotional: ['Honestly, it is hard to read these things. I just want to race.', 'My heart is with this team. But you never know in this sport.'] };


// both cars of one team out of the race: chaos at the team, with each driver reacting in character
function ngTeamChaos(c, f) {
  const by = {}; f.race.filter(e => e.status !== 'FIN').forEach(e => (by[e.teamId] = by[e.teamId] || []).push(e));
  const t = Object.keys(by).find(k => by[k].length >= 2); return t ? { tid: t, a: by[t][0].driverId, b: by[t][1].driverId } : null;
}
function ngTeamChaosStory(c, f, w, v, x) {
  const A = f.d(x.a), B = f.d(x.b), T = f.t(x.tid), rnd = w.rnd;
  const hot = [A, B].filter(d => ['fiery', 'blunt'].includes(ngPersona(d)));
  const vars = Object.assign({}, v, { A: A.lastName, B: B.lastName, T: T.name, boss: T.principal ? `team principal ${T.principal}` : 'the team boss' });
  const title = hot.length === 2 ? w.pick(['War of words at {T} after double retirement', 'Tempers flare at {T} as both cars retire', '{A} and {B} clash after {T} disaster'])
    : hot.length === 1 ? w.pick(['Double DNF leaves {T} in turmoil', '{T} nightmare: neither car finishes in {city}', 'Frustration at {T} after both cars retire'])
    : w.pick(['{T} stay calm after double retirement', 'A day to forget for {T} in {city}', 'No points for {T} as both cars retire']);
  const say = d => ngSays(d, hot.length ? 'blame' : 'dnf', rnd);
  const body = [ngFill('Neither {T} finished {gp}. {A} and {B} both retired, leaving the team with nothing to show for the weekend.', vars),
    `"${say(A)}" ${A.lastName} said.`, `${B.lastName} saw it differently: "${say(B)}"`,
    ngFill(hot.length === 2 ? 'The atmosphere in the garage was tense, and the two drivers were seen leaving without a word to each other.' : hot.length ? 'One driver kept his cool, the other did not hide his anger. It was not a quiet debrief.' : 'There were no raised voices, just long faces in the garage.', vars),
    ngFill(w.pick(['{boss} tried to calm things down: "We will talk about this inside the team. Both drivers know what is expected."', '{boss} was clear: "This cannot happen again, and it will not."', 'Asked about the mood, {boss} said only: "Not great. We regroup."']), Object.assign({}, vars, { boss: ngCap(vars.boss) })),
    ngFill(w.pick(['The next race just became very important for {T}.', 'How {T} respond will say a lot about the team this season.']), vars)];
  return { type: 'chaos', category: 'News', title: ngHeadline(ngFill(title, vars)), standfirst: ngFill(w.pick(['A weekend {T} would rather forget.', 'Zero points, plenty of words.']), vars), body, drivers: [x.a, x.b], teams: [x.tid], hours: 8 };
}

// now and then a driver says something unexpected; what he says depends on his personality and on the situation
function ngSurprise(c, f) {
  const r = ngRng(f.round.id + 'surprise'); if (r() > 0.45) return null;
  const pool = f.race.map(e => e.driverId); const id = pool[Math.floor(r() * pool.length)];
  return id ? { id, team: (f.race.find(e => e.driverId === id) || {}).teamId } : null;
}
function ngSurpriseStory(c, f, w, v, x) {
  const X = f.d(x.id), T = f.t(x.team), p = ngPersona(X), rnd = w.rnd;
  const quote = ngSays(X, 'surprise', rnd);
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, T: T.name });
  const title = { fiery: ['{X} hits out in fiery interview', '{X} does not hold back', 'Explosive comments from {X}'], blunt: ['{X} says what others will not', 'Straight talk from {X}', '{X}: "I am just saying it"'],
    joker: ['{X} lights up the press room', 'Only {X}: the quote of the weekend', '{X} in playful mood'], emotional: ['An open-hearted {X} opens up', '{X} gets personal in candid interview', '{X} shows his softer side'],
    diplomat: ['{X} calls for respect in thoughtful interview', '{X} shares his vision for the sport', 'Statesman {X} speaks out'], calm: ['{X} surprises with rare insight', 'A different side of {X}', '{X} reveals his secret to staying calm'] }[p];
  const reaction = { fiery: ['The comments are unlikely to calm things down in the paddock.', 'Several team bosses were asked about it and preferred not to comment.'], blunt: ['Not everyone will agree, but few will be surprised.', 'It is the kind of honesty fans have come to expect from him.'],
    joker: ['The room was laughing, and so was {T}’s press officer, eventually.', 'Social media had a field day with the clip.'], emotional: ['It was a rare look behind the helmet.', 'Fans responded with messages of support within minutes.'],
    diplomat: ['The comments were well received around the paddock.', 'Several drivers later agreed with him.'], calm: ['It was not what anyone expected to hear.', 'For a driver who usually says little, it was quite a statement.'] }[p];
  return { type: 'surprise', category: 'Interview', title: ngHeadline(ngFill(w.pick(title), vars)),
    standfirst: ngFill(w.pick(['An unexpected moment in the press room.', 'Nobody saw this one coming.', 'The quote everyone is talking about.']), vars),
    body: [ngFill(w.pick(['Speaking to the media after {gpShort}, {Xfull} said something few expected.', 'In the {T} hospitality unit after {gpShort}, {Xfull} was in a talkative mood.']), vars), `"${quote}"`,
      ngFill(w.pick(reaction), vars), ngFill(w.pick(['Asked to explain, he only smiled and walked off.', 'He did not add anything else.', 'His team later said he "just likes to speak his mind".']), vars)],
    drivers: [x.id], teams: [x.team].filter(Boolean), hours: 46 };
}

/* --- richer non-report stories: background, an extra voice and the outlook --- */
const NG_EXTRA = {
  ctx: ['#ctxA#', '#ctxB#', '#ctxC#'],
  ctxA: ['{X} sits {XP} in the championship with {Xpts} points after {raced} races.'],
  ctxB: ['So far this season {X} has {Xwins} and {Xpod}, which leaves him {XP} in the table.'],
  ctxC: ['The numbers tell their own story: {Xpts} points, {Xwins} and {Xpod} from {raced} races.'],
  voice: ['A senior figure at {XT} #quoteVerb#: "#voiceBody#"', '{XT} were quick to comment: "#voiceBody#"', 'Inside {XT}, the message is clear: "#voiceBody#"'],
  voiceBody: ['We look at the long term, not one weekend.', 'There is a lot of noise, but we keep working.', 'Our job is to give him the best car possible.', 'We know what we can do, and we know where we need to improve.', 'Every point matters at this stage of the year.'],
  extra_rumour: ['Any move would reshape the grid for {next}.', 'If the deal goes ahead, it would be one of the stories of the winter.', 'Several pieces of the {next} grid still depend on decisions like this one.', 'Contracts, sponsors and junior programmes all play a part in talks like these.'],
  extra_pressure: ['The gap to his team-mate is growing every weekend.', 'With every race, the comparison inside the team gets harder to ignore.', 'Drivers in his position have often found the answer in a single strong result.'],
  extra_teammates: ['Team-mate battles shape careers, and this one is no exception.', 'The first person every driver has to beat is the one in the other car.', 'Results like these often decide who leads the team next year.'],
  extra_dotd: ['Drives like this are what fans remember at the end of the year.', 'It was a reminder of what he can do when everything comes together.'],
  extra_quali: ['Starting at the front matters, but the race is long.', 'Track position will count for a lot on Sunday.', 'History says the pole-sitter has a real chance here, but nothing is guaranteed.'],
  extra_sprint: ['The main race offers far more points, and everyone knows it.', 'The real prize comes on Sunday.'],
  extra_power: ['Form can change quickly, and next weekend could look different.', 'Three races is a short window, but trends are forming.'],
  extra_teams: ['Every point in the teams’ table is worth money at the end of the year.', 'The constructors’ fight is often decided by the second car.'],
  mate: ['Team-mate {M} has {Mpts} points by comparison.', 'Inside the team, {M} has scored {Mpts} points so far.', 'The other car, driven by {M}, sits on {Mpts} points.'],
  stake: ['There is a lot riding on the coming races.', 'With {left} races to go, every weekend now counts double.', 'The second half of the year will decide how this season is remembered.', 'Teams are already planning for {next}, and results like this shape those plans.', 'Nobody in the paddock is looking past the next race just yet.'],
  outlook: ['Next up is {nextGp}, {nextDays}.', 'Attention now turns to {nextGp}, {nextDays}.', 'The next chance to respond comes at {nextGp}, {nextDays}.'],
};
function ngEnrich(f, st, w, v) {
  if (!st || st.type === 'report') return st;
  const id = (st.drivers || [])[0], row = id && f.after.find(r => r.id === id);
  const g = ngGrammar(Object.assign({}, ngVocab(f.round), NG_EXTRA), ngRng(st.type + f.round.id + (st.title || '')));
  const X = id ? f.d(id) : null, tid = id ? (f.race.find(e => e.driverId === id) || {}).teamId || (st.teams || [])[0] : (st.teams || [])[0];
  const vars = Object.assign({}, v, { X: X ? X.lastName : '', XT: tid ? f.t(tid).name : 'the team', XP: row ? ngOrd(row.position) : '', Xpts: row ? row.points : 0,
    Xwins: row && row.wins ? (row.wins === 1 ? 'one win' : `${row.wins} wins`) : 'no wins', Xpod: row && row.podiums ? (row.podiums === 1 ? 'one podium' : `${row.podiums} podiums`) : 'no podiums',
    raced: f.raced + 1, next: (seasonOf(f.c, f.round.seasonId) || {}).year + 1, left: ngWord(f.rounds.length - f.round.round) });
  const add = [];
  if (row && row.points) add.push(g.expand('#ctx#'));
  const kind = String(st.type).replace(/\d+$/, '');
  if (NG_EXTRA['extra_' + kind]) add.push(g.expand('#extra_' + kind + '#'));
  const mateRow = id && tid ? f.after.find(r => r.id !== id && (f.race.find(e => e.driverId === r.id) || {}).teamId === tid) : null;
  if (mateRow && !/teammates|teams/.test(kind)) add.push(g.expand('#mate#').replace('{M}', f.d(mateRow.id).lastName).replace('{Mpts}', mateRow.points));
  if (tid && kind !== 'teams') add.push(g.expand('#voice#'));
  if (!/power|teams/.test(kind)) add.push(g.expand('#stake#'));
  if (f.next && !/preview/.test(kind)) add.push(g.expand('#outlook#'));
  st.body = st.body.concat(add.map(x => ngFill(x, vars)));
  return st;
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
  if (resultFor(c, round.id, 'qualifying')) cands.push([38, () => ngQualiStory(c, f, ngWriter(seed + 'q', usedHeads), v)]);
  if (resultFor(c, round.id, 'sprint')) cands.push([42, () => ngSprintStory(c, f, ngWriter(seed + 's', usedHeads), v)]);
  const dotd = ngDotd(c, f); if (dotd) cands.push([36, () => ngDotdStory(c, f, ngWriter(seed + 'o', usedHeads), v, dotd)]);
  const tm = ngTeammates(c, f); if (tm) cands.push([34, () => ngTeammateStory(c, f, ngWriter(seed + 'b', usedHeads), v, tm)]);
  if (f.raced >= 2 && round.round % 3 === 0) cands.push([30, () => ngTeamsStory(c, f, ngWriter(seed + 'c', usedHeads), v)]);
  const ch = ngTeamChaos(c, f); if (ch) cands.push([58, () => ngTeamChaosStory(c, f, ngWriter(seed + 'x', usedHeads), v, ch)]);
  const sp = ngSurprise(c, f); if (sp) cands.push([37, () => ngSurpriseStory(c, f, ngWriter(seed + 'y', usedHeads), v, sp)]);
  const pr = ngPressure(c, f); if (pr) cands.push([33, () => ngPressureStory(c, f, ngWriter(seed + 'u', usedHeads), v, pr)]);
  if (round.round % 4 === 0) cands.push([31, () => ngPowerRankings(c, f, ngWriter(seed + 'w', usedHeads), v)]);
  if (round.round === Math.ceil(f.rounds.length / 2)) cands.push([47, () => ngMidSeason(c, f, ngWriter(seed + 'h2', usedHeads), v)]);
  cands.sort((a, b) => b[0] - a[0]).slice(0, 5).forEach(([, mk]) => { const st = mk(); if (st) out.push(ngEnrich(f, st, null, v)); });
  // silly season: up to two rumours per race from round 12, never the same driver twice in a row
  const rw = ngWriter(seed + 'z', usedHeads);
  const pickR = ngRumourPicks(c, round);
  pickR.forEach((x, i) => out.push(ngEnrich(f, ngRumourStory(c, f, rw, v, x, i), null, v)));
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
function ngImage(c, rd, st, key, used) {
  used = used || new Set();
  // rotate through a driver's photos from a stable starting point, skipping photos already used this season
  const pick = list => { list = [...new Set(list)]; if (!list.length) return ''; const s0 = ngHash(key) % list.length;
    for (let k = 0; k < list.length; k++) { const u = list[(s0 + k) % list.length]; if (!used.has(u)) { used.add(u); return u; } } return list[s0]; };
  const photosOf = ids => ids.flatMap(id => (byId(c.drivers, id) || {}).photoUrls || []);
  if (st.academyTeamId) {
    const f1 = allSeasonsDesc(c).find(s => (s.series || 'f1') === 'f1');
    const ids = f1 ? [...new Set(assignmentsOf(c, f1.id).filter(a => a.teamId === st.academyTeamId).map(a => a.driverId))] : [];
    const img = pick(photosOf(ids)); if (img) return img;
  }
  // team stories without drivers: photos of that team's drivers this season
  const teamDrivers = (st.teams || []).flatMap(tid => [...new Set(assignmentsOf(c, rd.seasonId).filter(a => a.teamId === tid).map(a => a.driverId))]);
  return pick(photosOf(st.drivers.slice(0, 1))) || pick(photosOf(st.drivers)) || pick(photosOf(teamDrivers)) || pick((byId(c.seasons, rd.seasonId) || {}).photoUrls || []);
}

/* --- sync with the career -------------------------------------------------- */
const NG_AUTHORS = { Transfer: ['Paddock Insider', 'Sofia Lang'], 'Race Report': ['Race Desk', 'Elena Marsh', 'Tom Whitaker'], Analysis: ['Title Watch', 'Jonas Reiter'], News: ['Paddock News', 'Sofia Lang'],
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
  const usedImgs = {};
  wanted.forEach(([rd, st], key) => {
    const id = 'art_auto_' + key.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const old = c.articles.find(a => a.id === id);
    if (old && ngSig(old) !== old.auto.sig) return;                                             // user edited: leave it alone
    const variant = old ? old.auto.variant || 0 : 0;
    // keep a picture the user chose; pictures the newsroom picked itself may be refreshed (more photos arrive over time)
    const oa = (old && old.auto) || {};
    const keepImg = !!(old && old.imageUrl && ('img' in oa && oa.img !== undefined ? old.imageUrl !== oa.img : !/^assets\//.test(old.imageUrl)));
    const authors = NG_AUTHORS[st.category] || ['Career Desk'];
    const rec = {
      id, seasonId: rd.seasonId, roundId: rd.id, category: st.category, title: st.title, slug: slugify(st.title),
      standfirst: st.standfirst, body: st.body.join('\n\n'), author: authors[ngHash(key) % authors.length],
      publishedAt: st.hoursBefore ? ngIso(rd.dateStart || rd.dateEnd, -st.hoursBefore + 9) : ngIso(rd.dateEnd || rd.dateStart, 4 + st.hours),
      featured: old ? !!old.featured : false, imageUrl: keepImg ? old.imageUrl : ngImage(c, rd, st, key, usedImgs[rd.seasonId] = usedImgs[rd.seasonId] || new Set()),
      driverIds: [...new Set(st.drivers)].filter(x => byId(c.drivers, x)), teamIds: [...new Set(st.teams)].filter(x => byId(c.teams, x)),
    };
    rec.auto = { key, round: rd.id, variant, sig: ngSig(rec), img: keepImg ? undefined : rec.imageUrl };
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
