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
  if (!NG_MEMO) ngCacheReset();
  NG_MEMO.facts = NG_MEMO.facts || new Map();
  if (!NG_MEMO.facts.has(round.id)) NG_MEMO.facts.set(round.id, ngFactsRaw(c, round));
  return NG_MEMO.facts.get(round.id);
}
function ngFactsRaw(c, round) {
  const race = ngRace(c, round.id);
  const fin = race.filter(e => e.position).sort((a, b) => a.position - b.position);
  if (!fin.length) return null;
  const d = id => driverOf(id) || { firstName: '', lastName: id, nationality: '' };
  const t = id => teamOf(id) || { name: id };
  if (!NG_MEMO.order) NG_MEMO.order = ngRoundOrder(c);
  const order = NG_MEMO.order, earlier = order.slice(0, order.indexOf(round));
  const earlierRaces = earlier.map(r => ngRace(c, r.id));
  const raced = earlier.filter(r => r.seasonId === round.seasonId && resultFor(c, r.id, 'race')).length;   // races already run this season
  const winsBefore = id => earlierRaces.filter(rs => rs.some(e => e.driverId === id && e.position === 1)).length;
  const podiumsBefore = id => earlierRaces.filter(rs => rs.some(e => e.driverId === id && e.position && e.position <= 3)).length;
  // consecutive wins up to this round (season-independent, career order)
  let streak = 1;
  for (let i = earlierRaces.length - 1; i >= 0; i--) { const w = earlierRaces[i].find(e => e.position === 1); if (w && w.driverId === fin[0].driverId) streak++; else if (earlierRaces[i].length) break; }
  const q = ngRace(c, round.id, 'qualifying').find(e => e.position === 1);
  const sprint = ngRace(c, round.id, 'sprint').find(e => e.position === 1);
  const gapTxt = fin[1] && /^\+?\d+(\.\d+)?s?$/.test(String(fin[1].time || '').trim()) ? parseFloat(String(fin[1].time).replace('+', '')) : null;
  const before = ngStand(c, round.seasonId, round.round - 1), after = ngStand(c, round.seasonId, round.round);
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
  const cb = ngCallback(f.c, f.round, [f.W.driverId, f.P2 && f.P2.driverId, f.P3 && f.P3.driverId].filter(Boolean), w.rnd, true); if (cb) p.push(cb);
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
  const st = driverStandings(c, f.round.seasonId, f.round.round), pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  const byTeam = {};
  f.fin.forEach(e => (byTeam[e.teamId] = byTeam[e.teamId] || []).push(e.driverId));
  const cands = [];
  Object.entries(byTeam).filter(([, ds]) => ds.length === 2).forEach(([tid, [a, b]]) => {
    let wa = 0, wb = 0, qa = 0, qb = 0, poda = 0, podb = 0; const recent = [];
    races.forEach(({ r, rs }) => { const ea = rs.find(e => e.driverId === a), eb = rs.find(e => e.driverId === b); if (!ea || !eb) return;
      const pa = ea.position || 99, pb = eb.position || 99; if (pa < pb) wa++; else if (pb < pa) wb++; recent.push(pa < pb ? 1 : -1);
      if (pa <= 3) poda++; if (pb <= 3) podb++;
      const q = classify(c, resultFor(c, r.id, 'qualifying')); const xa = q.find(e => e.driverId === a), xb = q.find(e => e.driverId === b);
      if (xa && xb && xa.position && xb.position) { if (xa.position < xb.position) qa++; else qb++; } });
    if (wa + wb < 4) return;
    const last5 = recent.slice(-5).reduce((s2, v2) => s2 + v2, 0), lead = wa >= wb;
    const [A, B] = lead ? [a, b] : [b, a];
    cands.push({ tid, a: A, b: B, wa: Math.max(wa, wb), wb: Math.min(wa, wb), qa: lead ? qa : qb, qb: lead ? qb : qa, pa: pts(A), pb: pts(B), poda: lead ? poda : podb, podb: lead ? podb : poda, swing: lead ? -last5 : last5 });
  });
  if (!cands.length) return null;
  // rotate teams from race to race so every garage gets its turn
  cands.sort((x, y) => ngHash(x.tid + f.round.seasonId) - ngHash(y.tid + f.round.seasonId));
  return cands[f.round.round % cands.length];
}
const NG_TM = {
  even: { head: ['{A} vs {B}: dead level at {T}', 'Nothing to split the {T} drivers', 'Honours even at {T}', 'Too close to call: {A} and {B}', '{T}’s perfect stalemate', 'Same car, same score: {A} and {B}', 'The closest pairing on the grid?', '{A} and {B} trade blows at {T}', 'A battle with no favourite at {T}', 'Inside {T}: {wa}-{wb} and counting'],
    open: ['{A} and {B} have beaten each other {wa} times each in races this season.', 'After {total} races together, the scoreboard at {T} reads {wa}-{wb}.', 'Ask anyone at {T} who is the faster driver, and you get a shrug. The numbers say {wa}-{wb}.'] },
  dominant: { head: ['{A} dominating {B} at {T}', 'Inside {T}: {A} leads {B} {wa}-{wb}', 'Pressure on {B} as {A} pulls clear', '{A} makes it {wa}-{wb} over {B}', 'One-way traffic at {T}', 'Is {B} in {A}’s shadow?', '{A} sets the standard at {T}', 'The numbers {B} does not want to see', '{T} have a clear number one', '{A} rules the {T} garage', '{B}’s uphill battle against {A}', 'A {wa}-{wb} story at {T}'],
    open: ['{A} has finished ahead of {B} in {wa} of their {total} races together this season.', 'In {total} races, {B} has beaten {A} only {wb} times.', 'Same car, same tools. {A} {wa}, {B} {wb}.'] },
  swing: { head: ['The tide is turning at {T}', '{B} fights back against {A}', '{B} wins the recent battles at {T}', 'Momentum shift inside {T}', '{B} is closing on {A}', 'Has {B} found the answer to {A}?', 'A new chapter in the {T} battle', '{A}’s lead under threat from {B}'],
    open: ['{A} still leads {wa}-{wb} overall, but {B} has the upper hand in the last five races.', 'The season score favours {A}, yet {B} has beaten him in most of the recent races.', 'Five races ago, {A} seemed in control. Not anymore.'] },
  quali: { head: ['Saturday king: {A} leads {B} {qa}-{qb} in qualifying', '{A} owns qualifying at {T}', 'One lap: {A} {qa}, {B} {qb}', 'Why {B} struggles on Saturdays', 'The qualifying gap at {T}', '{A} the faster man over one lap'],
    open: ['In qualifying, {A} leads {B} {qa}-{qb} this season.', 'On Saturdays, the story at {T} is clear: {A} has out-qualified {B} {qa} times to {qb}.', 'Qualifying sets up the weekend, and at {T}, {A} keeps setting it up better: {qa}-{qb}.'] },
  points: { head: ['{pgap} points between {A} and {B}', 'The points gap that worries {T}', '{A} {pa}, {B} {pb}', 'Where {B} is losing points to {A}', 'The {T} scorecard', 'Points tell the {T} story'],
    open: ['{A} has {pa} points this season, {B} has {pb}. That is a gap of {pgap}.', 'In the standings, {pgap} points separate the two {T} drivers.', '{A} brings home the points at {T}: {pa} so far, against {pb} for {B}.'] },
  podium: { head: ['{A}’s podiums, {B}’s frustration', 'Champagne for {A}, not yet for {B}', '{A} {poda} podiums, {B} {podb}', 'Same car, different trophies'],
    open: ['{A} has stood on the podium {poda} times this season. {B}: {podb}.', 'The trophy cabinet at {T} tells its own story: {poda} podiums for {A}, {podb} for {B}.'] },
  close: { even: ['It makes {T} one of the closest pairings on the grid.', 'Neither driver can claim the upper hand yet.', 'The team say it is the best problem to have.', 'The second half of the year could decide who leads the team.', 'Engineers on both sides of the garage are kept busy.', 'Expect sharp elbows at the next race.'],
    lead: ['{B} needs a response, and soon.', 'For {B}, the numbers make uncomfortable reading.', 'The team insist both drivers get equal treatment.', 'At some point, {T} may have to choose who to back.', 'It will be a long winter for {B} if nothing changes.', '{B}’s contract talks just got harder.', 'The next race could change the mood in the garage.'] },
};
function ngTeammateStory(c, f, w, v, x) {
  const A = f.d(x.a), B = f.d(x.b), T = f.t(x.tid);
  const vars = Object.assign({}, v, { A: A.lastName, B: B.lastName, T: T.name, wa: x.wa, wb: x.wb, qa: x.qa, qb: x.qb, pa: x.pa, pb: x.pb, pgap: Math.abs(x.pa - x.pb), poda: x.poda, podb: x.podb, total: x.wa + x.wb, boss: T.principal || `The ${T.name} team principal` });
  const angles = [];
  if (x.wa === x.wb) angles.push('even'); else angles.push('dominant');
  if (x.swing >= 2) angles.push('swing', 'swing');
  if (x.qa + x.qb >= 4 && x.qa !== x.qb) angles.push('quali');
  if (Math.abs(x.pa - x.pb) >= 10) angles.push('points');
  if (x.poda + x.podb > 0 && x.poda !== x.podb) angles.push('podium');
  const ang = angles[Math.floor(w.rnd() * angles.length)], g = NG_TM[ang], even = x.wa === x.wb;
  const body = [ngFill(w.pick(g.open), vars)];
  if (ang !== 'dominant' && ang !== 'even') body.push(ngFill(even ? 'In race results the two are level at {wa}-{wb}.' : 'In race results, {A} leads {wa}-{wb}.', vars));
  body.push(`${A.lastName}: "${ngSays(A, ang === 'swing' ? 'p2' : 'win', w.rnd)}"`);
  body.push(`${B.lastName} ${w.pick(['answered', 'saw it his way', 'kept it short', 'was asked about it too'])}: "${ngSays(B, even ? 'win' : 'p2', w.rnd)}"`);
  body.push(ngFill(w.pick(['{boss}: "We let them race. That is the deal."', '{boss}: "Having two strong drivers pushes the whole team forward."', '{boss}: "The data is open to both. No secrets."', '{boss}: "As long as they do not touch, I am happy."', '{boss}: "Internal battles are good, as long as the team wins."']), vars));
  body.push(ngFill(w.pick(g === NG_TM.even ? NG_TM.close.even : NG_TM.close.lead), vars));
  return { type: 'teammates', category: 'Analysis', title: ngHeadline(ngFill(w.pick(g.head), vars)),
    standfirst: ngFill(w.pick(['The team-mate battle in numbers.', 'Same car, different stories.', 'Inside the {T} garage.', 'The first rival is always the team-mate.', 'Head-to-head at {T}.']), vars),
    body, drivers: [x.a, x.b], teams: [x.tid], hours: 30 };
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
// other series and roles a driver gets linked with: [series, team or role]
const NG_OTHER = [['IndyCar', 'Team Penske'], ['IndyCar', 'Andretti Global'], ['IndyCar', 'Chip Ganassi Racing'], ['IndyCar', 'Arrow McLaren'], ['IndyCar', 'Rahal Letterman Lanigan'], ['IndyCar', 'Meyer Shank Racing'],
  ['the World Endurance Championship', 'Ferrari AF Corse'], ['the World Endurance Championship', 'Toyota Gazoo Racing'], ['the World Endurance Championship', 'Porsche Penske Motorsport'], ['the World Endurance Championship', 'Cadillac Hertz Team Jota'], ['the World Endurance Championship', 'BMW M Team WRT'], ['the World Endurance Championship', 'Alpine Endurance Team'], ['the World Endurance Championship', 'Aston Martin THOR Team'],
  ['Formula E', 'Jaguar TCS Racing'], ['Formula E', 'Porsche Formula E Team'], ['Formula E', 'Nissan Formula E Team'], ['Formula E', 'DS Penske'], ['Formula E', 'Mahindra Racing'], ['Formula E', 'Andretti Formula E'],
  ['Super Formula', 'Team Impul'], ['Super Formula', 'Docomo Team Dandelion'], ['the DTM', 'Mercedes-AMG Team Winward'], ['the DTM', 'Manthey EMA'], ['the Dakar Rally', 'Toyota Gazoo Racing'], ['the Dakar Rally', 'Dacia Sandriders'],
  ['TV', 'Sky Sports F1 as a pundit'], ['TV', 'Netflix for a new series']];
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
  st.slice(-6).forEach(r => { const tid = teamOfD(r.id); if (tid) out.push({ kind: 'series', who: r.id, team: tid, series: NG_OTHER[ngHash(r.id + rn) % NG_OTHER.length], stay: true }); });
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
    series: ['{X} linked with {steam} in {series}', 'Is {steam} the next step for {X}?', '{steam} sound out {X}', 'Life after F1? {X} and {steam}', '{X} on {steam} shortlist', 'Report: {steam} want {X}', '{X} in talks with {steam}'],
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
    series: ['With {pts} points this season, {Xfull} is said to be looking at options outside F1. {steam} in {series} lead the race.', '{steam} have contacted the management of {Xfull}, according to reports. A {series} seat for {next} is on the table.', '{Xfull} has not hidden his interest in {series}, and {steam} are said to have an offer ready.', 'A visit by {Xfull} to the {steam} base has started talk of a switch to {series}.'],
    followup: { denied: ['A few races ago, reports linked {Xfull} with {T}. Now the story has been firmly denied.', 'The talk about {Xfull} and {T} has been played down by both sides.'], heating: ['The story about {Xfull} and {T} first surfaced a few races ago. It has only grown since.', 'More details have emerged about {Xfull} and {T}, and the rumour looks more serious by the week.'] },
  },
  source: ['according to Italian media', 'according to a well-placed paddock source', 'according to the German press', 'according to several team insiders', 'according to a source close to the driver', 'according to Dutch broadcasters', 'according to the Spanish media', 'according to one team boss, speaking off the record', 'according to our sources in the paddock', 'according to the British press'],
  sourceLine: ['That is the story, {src}.', 'Nothing is official, but talks have started, {src}.', 'The talks are real, {src}.', 'A decision could come within weeks, {src}.', 'The picture is still unclear, but contact has been made, {src}.'],
  quote: ['"I only focus on the next race," {X} said when asked.', '"There is nothing to say yet," a team source said.', '"It is normal that names come up at this time of year," said {boss}.', '"My future will be decided soon," {X} said.', '"Speculation is part of this sport," a spokesperson for {T} said.', '"We talk to many people. That does not mean anything," said {boss}.', '"I read it too. Interesting story," {X} said with a smile.', '"When there is news, you will hear it from us," a spokesperson for {T} said.'],
  close: ['Nothing is signed, and the situation could change quickly.', 'This is a rumour, and none of the parties has confirmed anything.', 'Expect this story to run for a few more weeks.', 'The next races could decide a lot.', 'For now, it is talk. But in this paddock, talk often turns into contracts.', 'Watch this space.'],
};
const k0 = x => x.kind === 'followup' ? x.orig : x.kind;
function ngRumourStory(c, f, w, v, x, i) {
  const sid = f.round.seasonId, rn = f.round.round, seats = lineupAt(c, sid, rn);
  const X = f.d(x.who), T = f.t(x.team), curT = Object.keys(seats).find(t => seats[t].includes(x.who));
  const st = driverStandings(c, sid, rn), ts = teamStandings(c, sid, rn).map(r => r.id);
  const pos = st.findIndex(r => r.id === x.who), mate = x.other || (seats[curT] || []).find(id => id !== x.who);
  const pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  const vars = Object.assign({}, v, { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`, T: T.name, F: x.from ? f.t(x.from).name : (curT ? f.t(curT).name : 'his current team'),
    O: mate ? f.d(mate).lastName : 'his team-mate', P: ngOrd(x.pos || 1), next: (seasonOf(c, sid) || {}).year + 1, pts: pts(x.who), mpts: mate ? pts(mate) : 0,
    pos: pos >= 0 ? ngOrd(pos + 1) : 'outside the points', age: x.age || '', tech: x.tech || '', series: x.series || '', tpos: ngOrd(ts.indexOf(x.team) + 1),
    boss: T.principal || `the ${T.name} team principal`, src: w.pick(NG_RUMOUR.source),
    steam: x.series ? x.series[1] : '', acad: '', f2team: '', repl: '' });
  if (x.series) vars.series = x.series[0] === 'TV' ? 'television' : x.series[0];
  // junior: name the academy and the F2 team; boss: name a possible replacement
  if (k0(x) === 'junior') { const a = academyOf(c, x.who); vars.acad = a ? (a.name || `${f.t(a.f1TeamId).name} Driver Academy`) : '';
    const f2s = c.seasons.find(z => (z.series || 'f1') === 'f2' && z.year === (seasonOf(c, sid) || {}).year); if (f2s) { const lu = lineupAt(c, f2s.id, 99); const tt = Object.keys(lu).find(t => lu[t].includes(x.who)); vars.f2team = tt ? f.t(tt).name : ''; } }
  if (k0(x) === 'boss') { const others = c.teams.filter(t => t.id !== x.team && (t.technicalChief || t.principal)); const o = others[ngHash(x.team + f.round.id) % Math.max(1, others.length)];
    vars.repl = o ? (o.technicalChief ? `${o.technicalChief}, technical chief at ${o.name}` : `${o.name}'s ${o.principal}`) : 'a former team boss'; }
  const k = x.kind, pickK = bank => k === 'followup' ? bank.followup[x.verdict] : bank[k];
  const body = [ngFill(w.pick(pickK(NG_RUMOUR.open)), vars), ngFill(w.pick(NG_RUMOUR.sourceLine), vars)];
  if (k === 'junior' && (vars.acad || vars.f2team)) body.push(ngFill(w.pick([vars.acad ? '{X} is part of the {acad}{f2t}.' : '{X} races for {f2team} in Formula 2.', vars.f2team ? 'At {f2team}, engineers say {X} learns faster than anyone they have had.' : 'People inside the {acad} rate him highly.']), Object.assign({}, vars, { f2t: vars.f2team ? ` and races for ${vars.f2team} in Formula 2` : '' })));
  if (k === 'boss') body.push(ngFill(w.pick(['One name already linked with the job: {repl}.', 'If a change comes, {repl} is said to be the favourite.', 'Insiders name {repl} as a possible successor.']), vars));
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
// what drivers say about a new team, and about leaving one
NG_VOICE.move = { calm: ['It is a new step. I will take it one race at a time.', 'I feel ready. The rest we will see on track.', 'New people, new car, same goal.'], fiery: ['I came here to win. Nothing else.', 'People doubted me. Now they will see.', 'I want to beat everyone, starting with my team-mate.'],
  joker: ['First job: find out where they keep the good coffee.', 'New overalls, new colour. I think it suits me.', 'They gave me a seat that fits. Good start.'], diplomat: ['I am grateful to everyone who made this possible.', 'It is an honour to join a team with this history.', 'I want to give back the trust they showed me.'],
  blunt: ['They have a good car. I want to win. It fits.', 'Good team, good contract. Now we race.', 'I am here to score points. Simple.'], emotional: ['When I signed, I had tears in my eyes. A dream.', 'I called my mother first. She cried more than me.', 'This means everything to me and my family.'] };
NG_VOICE.leave = { calm: ['I am at peace with it. Something new will come.', 'I will take some time and then decide.'], fiery: ['They made a mistake, and they will see it.', 'I have a lot of fire left. Someone will want it.'],
  joker: ['I finally have time for my golf handicap.', 'I am available. Tell your friends.'], diplomat: ['I thank the team for the years we had together.', 'I leave with respect for everyone there.'],
  blunt: ['It is over. I move on.', 'Their choice. Not mine.'], emotional: ['It hurts. I loved that team.', 'I gave everything to them. It is hard to say goodbye.'] };
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
  const cb = id ? ngCallback(f.c, f.round, [id], ngRng(st.type + f.round.id + 'cb'), true) : ''; if (cb) add.push(cb);
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
  const tm = ngTeammates(c, f); if (tm) cands.push([28, () => ngTeammateStory(c, f, ngWriter(seed + 'b', usedHeads), v, tm)]);
  if (f.raced >= 2 && round.round % 3 === 0) cands.push([30, () => ngTeamsStory(c, f, ngWriter(seed + 'c', usedHeads), v)]);
  const ch = ngTeamChaos(c, f); if (ch) cands.push([58, () => ngTeamChaosStory(c, f, ngWriter(seed + 'x', usedHeads), v, ch)]);
  const sp = ngSurprise(c, f); if (sp) cands.push([37, () => ngSurpriseStory(c, f, ngWriter(seed + 'y', usedHeads), v, sp)]);
  const pr = ngPressure(c, f); if (pr) cands.push([33, () => ngPressureStory(c, f, ngWriter(seed + 'u', usedHeads), v, pr)]);
  if (round.round % 4 === 0) cands.push([31, () => ngPowerRankings(c, f, ngWriter(seed + 'w', usedHeads), v)]);
  if (round.round === Math.ceil(f.rounds.length / 2)) cands.push([47, () => ngMidSeason(c, f, ngWriter(seed + 'h2', usedHeads), v)]);
  cands.sort((a, b) => b[0] - a[0]).slice(0, 5).forEach(([, mk]) => { const st = mk(); if (st) out.push(ngEnrich(f, st, null, v)); });
  // silly season: up to two rumours per race from round 12, never the same driver twice in a row
  const rw = ngWriter(seed + 'z', usedHeads);
  const pickR = ngRumourPicks(c, round, NG_MEMO.rumours);
  pickR.forEach((x, i) => out.push(ngEnrich(f, ngRumourStory(c, f, rw, v, x, i), null, v)));
  f.v = v;
  ngMoreFormats(c, f, null, seed, k => ngWriter(k, usedHeads)).forEach(st => out.push(st));
  return out;
}

/* the stories published before a race: preview (Tuesday), press conference (Thursday), practice (Friday) */
const NG_PRE = /:(preview|press|practice)$/;
function ngPreStories(c, round, vf, usedHeads) {
  const seed = t => `${round.id}|p|${vf(t)}${t === 'preview' ? '' : t}`, out = [ngPreview(c, round, ngWriter(seed('preview'), usedHeads))];
  if (!NG_F2.has(round.seasonId)) out.push(ngPress(c, round, ngWriter(seed('press'), usedHeads)), ngPractice(c, round, ngWriter(seed('practice'), usedHeads)));
  return out.filter(Boolean);
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

/* --- transfers: every team change gets a story with an invented (but believable) storyline ---------------
   Off-season moves are found by comparing the line-up at the end of last season with round 1;
   mid-season moves by comparing round r-1 with round r. */
function ngMoves(c, s) {
  const out = [], rounds = roundsOf(c, s.id); if (!rounds.length) return out;
  const seatMap = lu => { const m = {}; Object.entries(lu).forEach(([t, ds]) => ds.forEach(d => { m[d] = t; })); return m; };
  const prev = c.seasons.find(z => (z.series || 'f1') === (s.series || 'f1') && z.year === s.year - 1);
  if (prev) {
    const pr = roundsOf(c, prev.id), before = seatMap(lineupAt(c, prev.id, pr.length ? pr[pr.length - 1].round : 1)), now = seatMap(lineupAt(c, s.id, rounds[0].round));
    const f2prev = (s.series || 'f1') === 'f1' ? c.seasons.find(z => (z.series || 'f1') === 'f2' && z.year === s.year - 1) : null;
    const f2seats = f2prev ? seatMap(lineupAt(c, f2prev.id, 99)) : {};
    Object.entries(now).forEach(([d, t]) => { if (before[d] === t) return;
      const kind = before[d] ? 'move' : f2seats[d] ? 'promo' : c.assignments.some(a => a.driverId === d && a.seasonId !== s.id) ? 'comeback' : 'rookie';
      out.push({ round: rounds[0], d, to: t, from: before[d] || f2seats[d] || null, kind, prev }); });
    Object.entries(before).forEach(([d, t]) => { if (!now[d]) out.push({ round: rounds[0], d, to: null, from: t, kind: 'exit', prev }); });
  }
  for (let i = 1; i < rounds.length; i++) {
    const a = seatMap(lineupAt(c, s.id, rounds[i - 1].round)), b = seatMap(lineupAt(c, s.id, rounds[i].round));
    Object.entries(b).forEach(([d, t]) => { if (a[d] !== t) out.push({ round: rounds[i], d, to: t, from: a[d] || null, kind: a[d] ? 'move' : 'midin', mid: true }); });
    Object.entries(a).forEach(([d, t]) => { if (!b[d]) out.push({ round: rounds[i], d, to: null, from: t, kind: 'exit', mid: true }); });
  }
  return out;
}
// storylines: [kinds it fits, headlines, how it happened, the twist]
const NG_PLOT = [
  [['move'], ['{X} triggers release clause to join {T}', 'The clause that freed {X}', 'Revealed: how {X} escaped {F}'], ['{Xfull} has joined {T} after activating a little-known performance clause in his {F} contract.', 'A clause buried deep in {Xfull}’s {F} contract made the move to {T} possible.'], ['{F} are said to be furious that the clause was ever signed.', 'Lawyers on both sides spent most of the winter on the paperwork.']],
  [['move', 'exit'], ['{X} and {F}: the fallout behind the exit', 'Bad blood: why {X} left {F}', 'Inside the breakdown between {X} and {F}'], ['The relationship between {Xfull} and {oldBoss} had been strained for months. In the end, nobody tried to save it.', 'A heated meeting after the final race of {py} is said to have ended {Xfull}’s time at {F}.'], ['Sources describe the last debrief as "short and very loud".', 'Neither side wanted to say much in public, which says a lot.']],
  [['move', 'rookie', 'comeback', 'promo', 'midin'], ['Sponsor backing seals {T} seat for {X}', '{X} arrives at {T} with big backing', 'Money talks: {X} lands {T} drive'], ['A major sponsor from {X}’s home country is said to have played a key role in the deal with {T}.', 'New partners followed {Xfull} to {T}, and the team will carry fresh colours this year.'], ['Critics call it a paid drive. {X} wants to prove them wrong on track.', 'The team insist the decision was about speed, not money.']],
  [['promo', 'rookie'], ['{X} promoted to {T}', 'From F2 to {T}: {X} gets his chance', 'The junior who made it: {X} joins {T}'], ['After a strong {py} season, {Xfull} gets the step up to a race seat with {T}.', '{T} have kept their promise to {Xfull}: a race seat for {y}.'], ['The team see him as a long-term project, but expectations are high.', 'He is one of the youngest drivers on the grid this year.']],
  [['move'], ['Straight swap: {X} to {T}', '{X} heads to {T} in surprise exchange', 'The deal nobody saw coming'], ['In a rare move, {F} and {T} agreed to exchange drivers, and {Xfull} is part of it.', 'The deal came together in a single week, after the bosses of {F} and {T} met at a charity dinner.'], ['Both teams believe they got the better end of the deal.', 'Only time will tell who won the swap.']],
  [['move', 'exit'], ['Shock as {X} leaves {F}', 'Nobody expected this: {X} out at {F}', 'The surprise of the winter: {X} and {F} part ways'], ['After {lastPts} points and {lastPos} in the standings, few expected {Xfull} to leave {F}.', 'On paper, {Xfull} had done enough to stay at {F}. In the end, it was not about paper.'], ['Fans of {F} have not hidden their anger on social media.', 'Some in the paddock believe {F} will regret this decision.']],
  [['move', 'comeback', 'midin'], ['The 2am phone call that took {X} to {T}', '"I was asleep": how {X} got the {T} call', 'A late-night call and a new team for {X}'], ['{Xfull} says the call from {boss} came at two in the morning. He signed before breakfast.', 'The story goes that {boss} called {Xfull} in the middle of the night. "Are you free next season?"'], ['"I thought it was a joke at first," {X} later admitted.', 'His manager reportedly missed the call. {X} did not.']],
  [['move', 'promo', 'rookie'], ['Signed on a yacht: the inside story of {X} to {T}', 'Monaco deal brings {X} to {T}', 'Champagne, a yacht and a contract'], ['The deal between {Xfull} and {T} was reportedly signed on a yacht in the Monaco harbour.', 'Talks between {Xfull} and {T} moved from a factory meeting room to a yacht in Monaco, where the contract was signed.'], ['Photos of the evening have not surfaced, which the team prefer.', 'The team declined to confirm the details, but did not deny them either.']],
  [['comeback'], ['{X} is back: comeback with {T}', 'Return of {X}', 'A second chance for {X} at {T}'], ['After a year out of a race seat, {Xfull} returns with {T}.', 'Many had written him off. {Xfull} never stopped training, and now {T} have given him a seat.'], ['"I watched every race from the sofa. It was painful," he said.', 'He says the time away made him a better driver.']],
  [['move'], ['{X} to {T} after {R} blocked the deal', 'How {T} beat {R} to {X}', 'Tug of war over {X}: {T} win'], ['{R} were close to signing {Xfull}, but {T} moved faster and offered a longer deal.', 'For weeks, {R} believed {Xfull} was theirs. Then {T} made their move.'], ['{R} are said to have filed a complaint, without success.', 'Relations between {R} and {T} have not improved.']],
  [['move', 'midin'], ['{X} turned down a bigger offer to join {T}', 'Not about money: {X} picks {T}', 'Why {X} said no to {R}'], ['{Xfull} turned down a bigger offer from {R} to join {T}.', 'Money pointed to {R}. {Xfull} chose {T} anyway.'], ['"I want a project, not just a pay cheque," he explained.', 'His camp say the {T} plan for the future made the difference.']],
  [['move', 'rookie', 'promo'], ['Family affair: how {X}’s father sealed the {T} deal', 'The manager who made the {X} move happen', 'Behind the deal: {X}’s camp'], ['{Xfull}’s father, who also acts as his manager, led the talks with {T} himself.', 'His long-time manager negotiated every line of the {T} contract, according to people close to the deal.'], ['Team staff describe the negotiations as "intense, but fair".', 'The {T} lawyers needed three extra weeks.']],
  [['move', 'rookie', 'comeback', 'promo', 'midin'], ['The factory test that convinced {T}', '{X} wins {T} seat after secret test', 'One day at the factory: {X}’s audition'], ['A private simulator test at the {T} factory convinced the engineers. A contract followed days later.', 'The {T} engineers asked for one day with {Xfull}. After lunch, they had seen enough.'], ['"His feedback was the best we had all year," one engineer said.', 'The data from that day is still talked about inside the team.']],
  [['exit', 'move'], ['{X} replaced by a rookie at {F}', 'Out with experience: {F} go young', '{F} drop {X} for fresh talent'], ['{F} have chosen a younger driver over {Xfull}, ending his time at the team.', 'The future won at {F}, and {Xfull} paid the price.'], ['He leaves with his head held high, the team said.', 'It is a tough lesson in how fast things move in this sport.']],
  [['midin', 'move'], ['Mid-season switch: {X} joins {T}', '{T} make a change: {X} in', 'Effective immediately: {X} to {T}'], ['With the season already under way, {T} have called up {Xfull}.', '{T} did not wait for the winter. {Xfull} drives for them from {gp}.'], ['He has had only days to prepare.', 'A seat fitting, a simulator session and straight into the car.']],
];
const NG_MOVE_Q = { team: ['{boss}: "{X} brings exactly what we need. Speed, and a hunger to win."', '{boss}: "We have followed him for years. This was the right moment."', '{boss}: "He fits our culture. We are excited."', '{boss}: "We believe he can win with us."', '{boss}: "It was not a hard decision."'],
  old: ['{F} wished him well: "Thank you for everything. Good luck."', 'A spokesperson for {F} said only: "We have moved on."', '{F} thanked him in a short statement.', '{oldBoss} would not comment further.', '{F}: "Our doors were always open. He chose another path."'],
  mate: ['New team-mate {M}: "Welcome. Now let us see who is faster."', '{M}: "He is quick. That will push me too."', '{M} smiled: "I hope he likes coming second."', '{M}: "We know each other from karting. It will be fun."', '{M}: "A strong team-mate is good for the team."'] };
function ngMoveStory(c, m, w) {
  const X = driverOf(m.d) || { firstName: '', lastName: m.d }, T = m.to ? (teamOf(m.to) || { name: m.to }) : null, F = m.from ? (teamOf(m.from) || { name: m.from }) : null;
  const s = seasonOf(c, m.round.seasonId) || {}, py = (s.year || 0) - 1;
  const st = m.prev ? driverStandings(c, m.prev.id) : [], pos = st.findIndex(r => r.id === m.d);
  const lu = m.to ? lineupAt(c, m.round.seasonId, m.round.round)[m.to] || [] : [], mate = lu.find(id => id !== m.d);
  const rivals = c.teams.filter(t => t.id !== m.to && t.id !== m.from && lineupAt(c, m.round.seasonId, m.round.round)[t.id]); const R = rivals[ngHash(m.d + m.round.id) % Math.max(1, rivals.length)];
  const vars = { X: X.lastName, Xfull: `${X.firstName} ${X.lastName}`.trim(), T: T ? T.name : '', F: F ? F.name : 'his old team', R: R ? R.name : 'a rival team', y: s.year, py,
    lastPts: pos >= 0 ? st[pos].points : 0, lastPos: pos >= 0 ? ngOrd(pos + 1) : 'outside the points', boss: T && T.principal ? T.principal : 'The team principal', oldBoss: F && F.principal ? F.principal : 'his old boss',
    M: mate ? (driverOf(mate) || {}).lastName : '', gp: m.round.name || 'the next race' };
  const fit = NG_PLOT.filter(p => p[0].includes(m.kind)); const plot = fit[Math.floor(w.rnd() * fit.length)];
  const body = [ngFill(w.pick(plot[2]), vars)];
  if (m.kind === 'exit') body.push(ngFill(w.pick(['For now, {X} has no seat for {y}.', '{X} is without a race seat for {y}, but says he is not done yet.', 'What comes next for {X} is unclear. Reserve roles and other series are possible.']), vars), `${X.lastName} said: "${ngSays(X, 'leave', w.rnd)}"`);
  else {
    if (pos >= 0) body.push(ngFill(w.pick(['Last season he finished {lastPos} with {lastPts} points.', 'He scored {lastPts} points in {py}, good for {lastPos}.']), vars));
    body.push(`${X.lastName} ${w.pick(['on the new chapter', 'on the move', 'at his first media day', 'in his first interview with the team'])}: "${ngSays(X, 'move', w.rnd)}"`, ngFill(w.pick(NG_MOVE_Q.team), vars));
    if (F && m.kind === 'move') body.push(ngFill(w.pick(NG_MOVE_Q.old), vars));
    if (mate) body.push(ngFill(w.pick(NG_MOVE_Q.mate), vars));
  }
  body.push(ngFill(w.pick(plot[3]), vars));
  return { type: 'move_' + m.d.replace(/^drv_/, ''), category: 'Transfer', title: ngHeadline(ngFill(w.pick(plot[1]), vars)),
    standfirst: ngFill(w.pick(m.kind === 'exit' ? ['The end of a chapter.', 'A goodbye that surprised many.'] : ['The story behind the move.', 'How the deal came together.', 'A new team for {y}.', 'Inside the transfer.']), vars),
    body, drivers: [m.d, mate].filter(Boolean), teams: [m.to, m.from].filter(Boolean), hoursBefore: (m.mid ? 4 : 14) * 24 + ngHash(m.d) % 96 };
}
function ngMovesRoundup(c, s, list, w) {
  const name = id => (driverOf(id) || {}).lastName || id, tn = id => (teamOf(id) || {}).name || id;
  const lines = list.map(m => m.kind === 'exit' ? `${name(m.d)} leaves ${tn(m.from)}.` : m.kind === 'move' ? `${name(m.d)}: ${tn(m.from)} to ${tn(m.to)}.` : m.kind === 'promo' ? `${name(m.d)} steps up from Formula 2 to ${tn(m.to)}.` : m.kind === 'comeback' ? `${name(m.d)} returns with ${tn(m.to)}.` : `${name(m.d)} joins ${tn(m.to)}.`);
  return { type: 'moves', category: 'Transfer', title: ngHeadline(ngFill(w.pick(['Who went where: the {y} grid', 'All the {y} driver changes', 'The {y} transfer round-up', 'New season, new faces: every move for {y}']), { y: s.year })),
    standfirst: `${list.length} change${list.length === 1 ? '' : 's'} since last season.`, body: [w.pick(['The winter has reshaped the grid. Here is every change at a glance.', 'A busy off-season is over. This is how the grid has changed.']), ...lines, w.pick(['Who made the best move? The first race will start to answer that.', 'Some moves will look smart by the summer. Others will not.'])],
    drivers: list.map(m => m.d), teams: [...new Set(list.map(m => m.to || m.from))], hoursBefore: 16 * 24 };
}

/* Sync is incremental: each season gets a fingerprint (its rounds, results, line-ups and the season before it).
   A season whose fingerprint has not changed reuses the stories built earlier in this session, so a save in
   year 20 of a career only rewrites year 20. Caches live in memory only. */
const NG_SEASON_CACHE = new Map();
const ngEdited = a => !(a.auto && a.auto.stub) && ngSig(a) !== a.auto.sig;
const ngSeasonOrder = c => [...c.seasons].sort((a, b) => a.year - b.year || (a.series === 'f2' ? 0 : 1) - (b.series === 'f2' ? 0 : 1));
function syncAutoNews(c) {
  if (!c || c.meta.autoNews === false) return false;
  ngSeries(c); ngCacheReset();
  let changed = false;
  const wanted = new Map();                                                    // key -> [round, story, unchanged since last sync]
  const active = (activeSeason(c) || {}).id;
  const varOf = new Map(); c.articles.forEach(a => { if (a.auto && a.auto.variant) varOf.set(a.auto.key, a.auto.variant); });
  let chain = String(ngHash(JSON.stringify([c.drivers, c.teams, c.academies, c.pointsRules, c.seasons, c.meta.playerTeamId, active])));
  ngSeasonOrder(c).forEach(s => {
    const rounds = roundsOf(c, s.id), rids = new Set(rounds.map(r => r.id));
    const fp = ngHash(chain + JSON.stringify([rounds, c.results.filter(r => rids.has(r.roundId)), c.assignments.filter(a => a.seasonId === s.id), [...varOf].filter(([k]) => rids.has(k.split(':')[0]))]));
    chain = String(fp);
    const hit = NG_SEASON_CACHE.get(s.id);
    if (hit && hit.fp === fp) { hit.items.forEach(([k, rd, st]) => wanted.set(k, [rd, st, true])); return; }
    const items = [], put = (rd, st) => { const k = `${rd.id}:${st.type}`; items.push([k, rd, st]); wanted.set(k, [rd, st, false]); };
    const usedHeads = new Set(), vf = rd => type => varOf.get(`${rd.id}:${type}`) || 0;
    rounds.forEach(rd => {
      if (!resultFor(c, rd.id, 'race')) return;
      const variant = (c.articles.find(a => a.auto && a.auto.round === rd.id && !NG_PRE.test(a.auto.key)) || { auto: {} }).auto.variant || 0;
      ngStoriesFor(c, rd, usedHeads, variant).forEach(st => put(rd, st));
      ngPreStories(c, rd, vf(rd), usedHeads).forEach(st => put(rd, st));
    });
    // transfer stories: one per move plus a round-up of the off-season
    const moves = ngMoves(c, s);
    moves.forEach(m => put(m.round, ngMoveStory(c, m, ngWriter(`${m.round.id}|mv|${m.d}`, usedHeads))));
    const off = moves.filter(m => !m.mid); if (off.length) put(off[0].round, ngMovesRoundup(c, s, off, ngWriter(`${off[0].round.id}|mvs`, usedHeads)));
    const nx = nextRound(c, s.id);
    if (nx && s.id === active) ngPreStories(c, nx, vf(nx), usedHeads).forEach(st => put(nx, st));
    NG_SEASON_CACHE.set(s.id, { fp, items });
  });
  // remove auto stories that no longer apply, unless the user edited them
  c.articles = c.articles.filter(a => {
    if (!a.auto || wanted.has(a.auto.key) || ngEdited(a)) return true;
    changed = true; return false;
  });
  const usedImgs = {};
  wanted.forEach(([rd, st, same], key) => {
    const id = 'art_auto_' + key.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const old = c.articles.find(a => a.id === id);
    if (old && ngEdited(old)) return;                                           // user edited: leave it alone
    if (same && old && !old.auto.stub) return;                                  // nothing changed in this season
    const variant = old ? old.auto.variant || 0 : 0;
    // keep a picture the user chose; pictures the newsroom picked itself may be refreshed (more photos arrive over time)
    const oa = (old && old.auto) || {};
    const keepImg = !!(old && old.imageUrl && ('img' in oa && oa.img !== undefined ? old.imageUrl !== oa.img : !/^assets\//.test(old.imageUrl)));
    const authors = NG_AUTHORS[st.category] || ['Career Desk'];
    const rec = {
      id, seasonId: rd.seasonId, roundId: rd.id, category: st.category, title: st.title, slug: slugify(st.title),
      standfirst: st.standfirst, body: st.body.join('\n\n'), author: authors[ngHash(key) % authors.length],
      publishedAt: st.hoursBefore != null ? ngIso(rd.dateStart || rd.dateEnd, -st.hoursBefore + 9) : ngIso(rd.dateEnd || rd.dateStart, 4 + st.hours),
      featured: old ? !!old.featured : false, imageUrl: keepImg ? old.imageUrl : ngImage(c, rd, st, key, usedImgs[rd.seasonId] = usedImgs[rd.seasonId] || new Set()),
      driverIds: [...new Set(st.drivers)].filter(x => byId(c.drivers, x)), teamIds: [...new Set(st.teams)].filter(x => byId(c.teams, x)),
    };
    rec.auto = { key, round: rd.id, variant, sig: ngSig(rec), img: keepImg ? (oa.img !== undefined ? oa.img : undefined) : rec.imageUrl };
    if (old && JSON.stringify(old) === JSON.stringify(rec)) return;
    if (old) { Object.keys(old).forEach(k => delete old[k]); Object.assign(old, rec); } else c.articles.push(rec);
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
  c.articles.filter(x => x.auto && x.auto.key !== key && x.auto.round === a.auto.round && !NG_PRE.test(key) && !NG_PRE.test(x.auto.key)).forEach(x => { x.auto.variant = a.auto.variant; });
  return syncAutoNews(c);
}

/* ==========================================================================
   STORY MEMORY: storylines that live across races and seasons.
   Everything here is derived from results on each sync (nothing extra is saved),
   so a long career costs no storage. Per-sync caches keep it fast.
   Storylines:  slump · form · teamwar · title · rivalry · saga · veteran
   One-off events: milestones, breakout podiums, redemption wins.
   ========================================================================== */
let NG_MEMO = null;
function ngCacheReset() { NG_MEMO = { cls: new Map(), st: new Map(), ts: new Map(), rumours: {}, story: null }; }
function ngRace(c, roundId, session) {
  if (!NG_MEMO) ngCacheReset(); const k = roundId + '|' + (session || 'race');
  if (!NG_MEMO.cls.has(k)) NG_MEMO.cls.set(k, classify(c, resultFor(c, roundId, session || 'race')));
  return NG_MEMO.cls.get(k);
}
function ngStand(c, sid, n) {
  if (!NG_MEMO) ngCacheReset(); const k = sid + '|' + n;
  if (!NG_MEMO.st.has(k)) NG_MEMO.st.set(k, driverStandings(c, sid, n));
  return NG_MEMO.st.get(k);
}
function ngTStand(c, sid, n) {
  if (!NG_MEMO) ngCacheReset(); const k = sid + '|' + n;
  if (!NG_MEMO.ts.has(k)) NG_MEMO.ts.set(k, teamStandings(c, sid, n));
  return NG_MEMO.ts.get(k);
}
const ngLn = id => (driverOf(id) || { lastName: id }).lastName;
const ngFull = id => { const d = driverOf(id) || { firstName: '', lastName: id }; return `${d.firstName} ${d.lastName}`.trim(); };
const ngTn = id => (teamOf(id) || { name: id }).name;
const ngBoss = id => { const T = teamOf(id) || {}; return T.principal ? T.principal.split('/')[0].trim() : `the ${T.name || 'team'} boss`; };
const ngRes = e => !e ? 'not entered' : e.position ? 'P' + e.position : (MX_STATUS_LABEL[e.status] || e.status);
const ngAge = (id, year) => { const d = driverOf(id); const y = d && d.dob ? parseInt(String(d.dob).slice(0, 4), 10) : 0; return y ? year - y : 0; };

// Walk every season of each series in order and build the story memory. Result: roundId -> state after that round.
function ngNarrative(c) {
  if (!NG_MEMO) ngCacheReset();
  if (NG_MEMO.story) return NG_MEMO.story;
  const out = new Map(), bySeries = {};
  [...c.seasons].sort((a, b) => a.year - b.year).forEach(s => (bySeries[s.series || 'f1'] = bySeries[s.series || 'f1'] || []).push(s));
  Object.values(bySeries).forEach(list => {
    const K = { starts: {}, wins: {}, podiums: {}, teamWins: {}, teamLastPod: {}, idx: 0, venue: {} };
    list.forEach(s => ngNarrativeSeason(c, s, K, out));
  });
  return (NG_MEMO.story = out);
}
const NG_MILE = { starts: [50, 100, 150, 200, 250, 300, 350, 400], wins: [5, 10, 25, 50, 75, 100], podiums: [10, 25, 50, 100, 150, 200] };

function ngNarrativeSeason(c, s, K, out) {
  const all = roundsOf(c, s.id), rounds = all.filter(r => resultFor(c, r.id, 'race'));
  const rule = ruleFor(c, s.id), winPts = (rule.race || [25])[0] || 25;
  const H = {}, open = new Map(), pairs = {}, ended = [], lastLead = {}, sagaN = {};
  const f2 = NG_F2.has(s.id);
  rounds.forEach((rd, idx) => {
    const race = ngRace(c, rd.id), ev = [], city = rd.city || rd.name;
    const st = ngStand(c, s.id, rd.round), stPrev = ngStand(c, s.id, rd.round - 1);
    const tsPrev = ngTStand(c, s.id, rd.round - 1).map(r => r.id);
    const pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
    const entry = id => race.find(e => e.driverId === id);
    const mk = (id, kind, o) => { const sl = Object.assign({ id, kind, seasonId: s.id, start: rd.round, startCity: city, heat: 50, peak: 50, beats: [], drivers: [], teams: [], count: 1 }, o);
      open.set(id, sl); ev.push({ kind: 'open', sl }); return sl; };
    const heat = (sl, d) => { sl.heat = Math.max(0, Math.min(100, sl.heat + d)); sl.peak = Math.max(sl.peak, sl.heat); };
    const close = (sl, outcome, extra) => { Object.assign(sl, { closed: rd.round, outcome, endCity: city }, extra || {}); open.delete(sl.id); ended.push(sl); ev.push({ kind: 'close', sl }); };
    K.idx++;
    race.forEach(e => (H[e.driverId] = H[e.driverId] || []).push({ pos: e.position || null, pts: e.pts || 0, status: e.status, team: e.teamId, n: rd.round, city }));

    // milestones and one-off events
    race.forEach(e => {
      const d = e.driverId;
      K.starts[d] = (K.starts[d] || 0) + 1;
      if (NG_MILE.starts.includes(K.starts[d])) ev.push({ kind: 'mile', what: 'starts', d, team: e.teamId, n: K.starts[d] });
      if (e.position && e.position <= 3) {
        K.podiums[d] = (K.podiums[d] || 0) + 1;
        if (K.podiums[d] === 1 && e.position > 1) ev.push({ kind: 'mile', what: 'firstpodium', d, team: e.teamId, n: 1 });
        else if (NG_MILE.podiums.includes(K.podiums[d])) ev.push({ kind: 'mile', what: 'podiums', d, team: e.teamId, n: K.podiums[d] });
        const gap = K.teamLastPod[e.teamId] != null ? K.idx - K.teamLastPod[e.teamId] : null;
        if (gap != null && gap >= 15) ev.push({ kind: 'mile', what: 'drought', d, team: e.teamId, n: gap - 1 });
        K.teamLastPod[e.teamId] = K.idx;
        const rank = tsPrev.indexOf(e.teamId);
        if (idx >= 2 && rank >= 5) ev.push({ kind: 'breakout', d, team: e.teamId, pos: e.position, rank: rank + 1 });
      }
      if (e.position === 1) {
        K.wins[d] = (K.wins[d] || 0) + 1;
        if (K.wins[d] === 1) ev.push({ kind: 'mile', what: 'firstwin', d, team: e.teamId, n: 1 });
        else if (NG_MILE.wins.includes(K.wins[d])) ev.push({ kind: 'mile', what: 'wins', d, team: e.teamId, n: K.wins[d] });
        K.teamWins[e.teamId] = (K.teamWins[e.teamId] || 0) + 1;
        if (K.teamWins[e.teamId] === 1 && K.idx > 1) ev.push({ kind: 'mile', what: 'teamfirst', d, team: e.teamId, n: 1 });
        const lastHere = (K.venue[rd.name] || {})[d];
        if (lastHere && !lastHere.pos) ev.push({ kind: 'redemption', d, team: e.teamId, year: lastHere.year, was: lastHere.status });
      }
    });
    race.forEach(e => { (K.venue[rd.name] = K.venue[rd.name] || {})[e.driverId] = { pos: e.position, status: e.status, year: (seasonOf(c, s.id) || {}).year }; });

    // slumps and podium runs
    Object.entries(H).forEach(([d, h]) => {
      const e = entry(d); if (!e) return;
      const sid = 'slump|' + d, fid = 'form|' + d, last = h[h.length - 1];
      let zeros = 0; for (let i = h.length - 1; i >= 0 && !h[i].pts; i--) zeros++;
      const scoredBefore = h.slice(0, h.length - zeros).some(x => x.pts > 0);
      if (open.has(sid)) {
        const sl = open.get(sid);
        if (last.pts > 0) close(sl, last.pos <= 3 ? 'podium' : 'points', { endPos: last.pos, count: sl.count });
        else { sl.count = zeros; heat(sl, 8); }
      } else if (zeros >= 3 && scoredBefore && !f2) {
        const at = h[h.length - zeros];
        mk(sid, 'slump', { drivers: [d], teams: [e.teamId], start: at.n, startCity: at.city, count: zeros, heat: 45 });
      }
      let pods = 0; for (let i = h.length - 1; i >= 0 && h[i].pos && h[i].pos <= 3; i--) pods++;
      if (open.has(fid)) { const sl = open.get(fid); if (pods) { sl.count = pods; heat(sl, 6); } else close(sl, 'ended', { count: sl.count, endPos: last.pos }); }
      else if (pods >= 3) { const at = h[h.length - pods]; mk(fid, 'form', { drivers: [d], teams: [e.teamId], start: at.n, startCity: at.city, count: pods, heat: 40 }); }
    });

    // team-mate wars: the lead in the points battle changes hands, or both cars retire
    const byTeam = {}; race.forEach(e => (byTeam[e.teamId] = byTeam[e.teamId] || []).push(e));
    Object.entries(byTeam).forEach(([tid, es]) => {
      if (es.length !== 2 || idx < 3) return;
      const [a, b] = es.map(e => e.driverId), lead = pts(a) === pts(b) ? null : (pts(a) > pts(b) ? a : b), id = 'tw|' + tid;
      const both = es.every(e => !e.position);
      if (lead && lastLead[tid] && lead !== lastLead[tid] && Math.abs(pts(a) - pts(b)) <= winPts) {
        if (open.has(id)) { const sl = open.get(id); sl.count++; heat(sl, 15); ev.push({ kind: 'beat', sl, what: 'flip', lead }); }
        else mk(id, 'teamwar', { drivers: [a, b], teams: [tid], heat: 50, lead });
        open.get(id).lead = lead;
      } else if (both) {
        if (open.has(id)) { heat(open.get(id), 12); ev.push({ kind: 'beat', sl: open.get(id), what: 'double' }); }
        else mk(id, 'teamwar', { drivers: [a, b], teams: [tid], heat: 45, lead: lastLead[tid] || a, why: 'double' });
      }
      if (lead) lastLead[tid] = lead;
    });

    // the title fight
    const L = st[0], L2 = st[1], Lp = stPrev[0];
    if (L && L2 && idx >= 2) {
      const gap = L.points - L2.points, id = 'title|' + s.id;
      if (open.has(id)) {
        const sl = open.get(id);
        if (Lp && Lp.id !== L.id) { heat(sl, 20); ev.push({ kind: 'beat', sl, what: 'lead', lead: L.id }); }
        else heat(sl, gap < sl.gap ? 6 : -4);
        Object.assign(sl, { gap, drivers: [L.id, L2.id], lead: L.id });
        if (gap > 2.5 * winPts && rd.round < all.length) close(sl, 'faded', { leadAtEnd: L.id });
      } else if (gap <= winPts) mk(id, 'title', { drivers: [L.id, L2.id], teams: [], gap, lead: L.id, heat: 60 });
    }

    // rivalries: two drivers from different teams who keep finishing side by side
    const fin = race.filter(e => e.position).sort((a, b) => a.position - b.position);
    for (let i = 0; i + 1 < fin.length && i < 12; i++) {
      const x = fin[i], y = fin[i + 1]; if (x.teamId === y.teamId) continue;
      const k = [x.driverId, y.driverId].sort().join('|'); pairs[k] = (pairs[k] || 0) + 1;
      const id = 'riv|' + k;
      if (open.has(id)) { const sl = open.get(id); sl.count = pairs[k]; heat(sl, 8); ev.push({ kind: 'beat', sl, what: 'again', ahead: x.driverId }); }
      else if (pairs[k] >= 4 && [...open.values()].filter(z => z.kind === 'rivalry').length < 2 && !f2)
        mk(id, 'rivalry', { drivers: [x.driverId, y.driverId], teams: [x.teamId, y.teamId], count: pairs[k], heat: 45, ahead: x.driverId });
    }

    // contract saga: a driver keeps appearing in the rumour mill
    if (!f2) ngRumourPicks(c, rd, NG_MEMO.rumours).forEach(x => {
      const d = x.who; if (!d) return; sagaN[d] = (sagaN[d] || 0) + 1; const id = 'saga|' + d;
      if (open.has(id)) { const sl = open.get(id); sl.count = sagaN[d]; heat(sl, 10); sl.team = x.team || sl.team; }
      else if (sagaN[d] >= 3) mk(id, 'saga', { drivers: [d], teams: [x.team].filter(Boolean), count: sagaN[d], team: x.team, heat: 50 });
    });

    // veterans near the end of the season
    if (rd.round >= all.length - 2 && !f2) race.forEach(e => {
      const age = ngAge(e.driverId, (seasonOf(c, s.id) || {}).year), id = 'vet|' + e.driverId + '|' + s.id;
      if (age >= 37 && !open.has(id) && !ended.some(z => z.id === id)) mk(id, 'veteran', { drivers: [e.driverId], teams: [e.teamId], age, heat: 40 });
    });

    // every open storyline remembers this round
    open.forEach(sl => { if (!sl.beats.some(b => b.n === rd.round)) sl.beats.push({ n: rd.round, city, res: sl.drivers.map(d => `${ngLn(d)} ${ngRes(entry(d))}`) }); });

    // last race of a finished season: close everything
    if (rd.round === all.length) [...open.values()].forEach(sl => close(sl, sl.kind === 'title' ? 'champion' : 'season', { leadAtEnd: L && L.id }));

    // moods from the last three races
    const mood = {};
    Object.entries(H).forEach(([d, h]) => {
      if (!entry(d)) return;
      const l3 = h.slice(-3), zeros = l3.filter(x => !x.pts).length, dnfs = l3.filter(x => !x.pos).length, pods = l3.filter(x => x.pos && x.pos <= 3).length;
      mood[d] = l3[l3.length - 1].pos === 1 || pods >= 2 ? 'flying' : (zeros === 3 && h.some(x => x.pts)) || dnfs >= 2 ? 'crisis' : zeros >= 2 ? 'low' : zeros === 0 ? 'good' : 'steady';
    });
    const copy = sl => Object.assign({}, sl, { beats: sl.beats.slice(), drivers: sl.drivers.slice() });
    out.set(rd.id, { round: rd, events: ev.map(x => Object.assign({}, x, { sl: x.sl ? copy(x.sl) : null })), open: [...open.values()].map(copy), ended: ended.map(copy), mood });
  });
}
// story memory just after a round (null before a season's first race)
const ngMemAfter = (c, round) => ngNarrative(c).get(round.id) || null;
function ngMemBefore(c, round) {
  const prev = roundsOf(c, round.seasonId).filter(r => r.round < round.round && resultFor(c, r.id, 'race'));
  return prev.length ? ngMemAfter(c, prev[prev.length - 1]) : null;
}

/* --- callbacks: one line that links today's story to an older one ----------- */
const NG_CALL = {
  slump: ['It is now {n} races without points for {X}, a run that began in {startCity}.', 'Since {startCity}, {X} has gone {n} races without a point.', 'The drought for {X} goes on: {n} races without points since {startCity}.'],
  slumpEnd: ['That ends a run of {n} races without points for {X}, which began in {startCity}.', 'The drought that started in {startCity} is over for {X}, after {n} races.', 'For {X}, {n} races of frustration since {startCity} finally ended here.'],
  form: ['That is {n} podiums in a row for {X}, a run that started in {startCity}.', '{X} has not missed the podium since {startCity}: {n} in a row now.'],
  teamwar: ['Inside {T}, the fight between {A} and {B} now stands at {pa} points to {pb}.', 'At {T}, {A} and {B} are separated by {d} points, and neither wants to be the number two.'],
  title: ['The title fight that took shape in {startCity} is now {gap} points wide.', 'Since {startCity} the championship has been a two-way fight. The gap is {gap} points.'],
  rivalry: ['{A} and {B} have now finished side by side {n} times this season.', 'Another chapter in the {A} versus {B} story: {n} times this year they have crossed the line next to each other.'],
  saga: ['Talk about the future of {X} has followed him since {startCity}.', 'The questions about where {X} drives next have not stopped since {startCity}.'],
  veteran: ['At {age}, {X} knows every race could be one of his last.', '{X} is {age} now, and the paddock is wondering how many races he has left.'],
};
function ngCallback(c, round, ids, rnd, after) {
  const mem = after ? ngMemAfter(c, round) : ngMemBefore(c, round); if (!mem) return '';
  const pick = l => l[Math.floor(rnd() * l.length)];
  const closedNow = mem.events.filter(x => x.kind === 'close' && x.sl.kind === 'slump' && ids.includes(x.sl.drivers[0]));
  if (closedNow.length) { const sl = closedNow[0].sl; return ngFill(pick(NG_CALL.slumpEnd), { X: ngLn(sl.drivers[0]), n: sl.count, startCity: sl.startCity }); }
  const sl = mem.open.filter(z => z.drivers.some(d => ids.includes(d))).sort((a, b) => b.heat - a.heat)[0]; if (!sl) return '';
  const st = ngStand(c, round.seasonId, mem.round.round), pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  const [a, b] = sl.drivers, v = { X: ngLn(a), A: ngLn(a), B: b ? ngLn(b) : '', n: sl.count, startCity: sl.startCity, age: sl.age, gap: sl.gap, T: sl.teams[0] ? ngTn(sl.teams[0]) : '',
    pa: pts(a), pb: b ? pts(b) : 0, d: b ? Math.abs(pts(a) - pts(b)) : 0 };
  if (sl.kind === 'teamwar' && pts(b) > pts(a)) Object.assign(v, { A: ngLn(b), B: ngLn(a), pa: pts(b), pb: pts(a) });
  return NG_CALL[sl.kind] ? ngFill(pick(NG_CALL[sl.kind]), v) : '';
}

/* --- moods: what a driver sounds like depends on his last three races ----- */
const NG_MOOD = {
  flying: { calm: ['We are in a good rhythm. The job now is to keep it.', 'Things are working. We stay humble and keep going.'], fiery: ['Right now I feel unbeatable, and I want to keep it that way.', 'Let them chase me. I am not slowing down.'],
    joker: ['I have extended the contract of my lucky socks.', 'Everything is going well. I am starting to worry.'], diplomat: ['The team has given me a fantastic car, and the credit is theirs.', 'We enjoy this run, but nobody here is getting carried away.'],
    blunt: ['We are fast. We keep scoring. Next race.', 'The car is good and I am driving well. Nothing more to say.'], emotional: ['I wake up every day excited. I want this feeling to last.', 'Sometimes I need to pinch myself. It is a dream.'] },
  good: { calm: ['We are scoring every weekend, and that is the base.', 'Solid weeks. Now we look for a bit more.'], fiery: ['Points are fine, but I want more than fine.', 'Good is not enough for me. I want great.'],
    joker: ['We are consistent. Consistently asking for more downforce.', 'Points every week. My accountant is happy.'], diplomat: ['The whole team is working well together right now.', 'We take the positives and keep learning.'],
    blunt: ['We score points. That is the job.', 'Not bad. Not perfect either.'], emotional: ['I feel good in the car, and I feel the support of the team.', 'I am enjoying my racing again.'] },
  steady: { calm: ['Some good days, some harder ones. We keep working.', 'We know where we need to improve.'], fiery: ['Up and down is not good enough. I want consistency.', 'I need the car to be there every weekend, not every second one.'],
    joker: ['It has been a mixed bag. Like my cooking.', 'One good week, one bad week. At least it is never boring.'], diplomat: ['There are positives and lessons in every weekend.', 'We are building, step by step.'],
    blunt: ['Not consistent enough. We need to fix that.', 'Some good, some bad. That is the truth.'], emotional: ['It has been a rollercoaster, honestly.', 'Some weekends I leave happy, some I do not sleep.'] },
  low: { calm: ['It is a difficult moment. We stay calm and work through it.', 'Results are not coming, but the work is right.'], fiery: ['I am not happy, and I will not pretend I am.', 'This is not where I belong, and I will fight to get out of it.'],
    joker: ['At least the view from the back is quiet.', 'I have seen more of the midfield than I wanted to.'], diplomat: ['We are in this together, and we will come out of it together.', 'Nobody in the team is giving up.'],
    blunt: ['We are slow. We need to be faster.', 'Bad results. No excuses.'], emotional: ['It is hard. I give everything and get nothing back.', 'I have had some sleepless nights, I will be honest.'] },
  crisis: { calm: ['We need to reset completely. Everything is on the table.', 'I will not panic. Panic makes it worse.'], fiery: ['Enough. Something has to change, now.', 'I have had it with excuses. We need answers.'],
    joker: ['If you find our points, please send them back.', 'I hear there is a race on Sunday. I would like to finish one.'], diplomat: ['It is a tough time for everyone, and the team needs unity.', 'We will find the problem. I trust the people here.'],
    blunt: ['This is a disaster. No other word for it.', 'Zero after zero. Not acceptable.'], emotional: ['This is the hardest period of my career.', 'I feel like I am letting everyone down.'] },
};
const ngMoodLine = (id, mood, rnd) => { const b = (NG_MOOD[mood || 'steady'] || NG_MOOD.steady)[ngPersona(driverOf(id))] || NG_MOOD.steady.calm; return b[Math.floor(rnd() * b.length)]; };

/* --- article helpers --------------------------------------------------------- */
const ngStory = (type, category, title, standfirst, body, drivers, teams, timing) =>
  Object.assign({ type, category, title: ngHeadline(title), standfirst, body: body.filter(Boolean), drivers: drivers.filter(Boolean), teams: teams.filter(Boolean) }, timing);

/* --- Winners and Losers ------------------------------------------------------ */
function ngWinnersLosers(c, f, w) {
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], mem = ngMemAfter(c, f.round) || { events: [] };
  const before = ngStand(c, f.round.seasonId, f.round.round - 1), expOf = e => e.grid || ((before.find(r => r.id === e.driverId) || {}).position) || 12;
  const scored = f.race.map(e => ({ e, gain: e.position ? expOf(e) - e.position : -(23 - expOf(e)) / 2 }));
  const used = new Set(), W = [], Lz = [];
  const add = (list, e, text) => { if (!e || used.has(e.driverId) || list.length >= 3) return; used.add(e.driverId); list.push([e, text]); };
  const v = e => ({ X: ngLn(e.driverId), T: ngTn(e.teamId), P: e.position ? 'P' + e.position : '', G: e.grid ? 'P' + e.grid : '', g: e.grid && e.position ? e.grid - e.position : 0, city: f.round.city || f.round.name });
  add(W, f.W, ngFill(pick(f.firstWin ? ['A first win of the season, and the one he needed. The confidence this gives {X} is worth more than the 25 points.', 'The wait is over for {X}. He looked a different driver once he hit the front.']
    : ['{X} did what winners do: no mistakes, maximum points. Rivals had no answer in {city}.', 'Pole, pace or patience, {X} had whatever the day asked for. {T} leave {city} very happy.']), v(f.W)));
  scored.filter(x => x.e.position && x.gain >= 4).sort((a, b) => b.gain - a.gain).forEach(x => add(W, x.e, ngFill(pick(['From {G} to {P}: {X} gained {g} places with a string of clean, brave moves.', '{X} turned a poor grid slot into a strong result. {g} places gained, all of them on merit.']), v(x.e))));
  mem.events.filter(x => x.kind === 'breakout').forEach(x => add(W, f.race.find(e => e.driverId === x.d), ngFill('A podium for {X} in a {T} that started the day {rank} in the teams’ table. Results like this change how a season feels.', Object.assign(v(f.race.find(e => e.driverId === x.d)), { rank: ngOrd(x.rank) }))));
  mem.events.filter(x => x.kind === 'close' && x.sl.kind === 'slump').forEach(x => add(W, f.race.find(e => e.driverId === x.sl.drivers[0]), ngFill('Points at last. {X} ended a {n}-race drought, and the relief was obvious.', Object.assign(v(f.race.find(e => e.driverId === x.sl.drivers[0])), { n: x.sl.count }))));
  if (f.leaderBeforeEntry && f.leaderBefore && f.L && f.L.id !== f.leaderBefore) add(Lz, f.leaderBeforeEntry, ngFill(pick(['{X} arrived as championship leader and leaves without the lead. One bad day, but a costly one.', 'The red mark of the weekend is next to {X}: the championship lead is gone.']), v(f.leaderBeforeEntry)));
  f.dnfs.filter(e => expOf(e) <= 10).forEach(e => add(Lz, e, ngFill(pick(['{X} started {G} and had points in sight, then it was over. Zero points from a weekend that promised more.', 'A retirement from a good position. For {X} and {T} this one will hurt for a while.']), v(e))));
  scored.filter(x => x.e.position && x.gain <= -4).sort((a, b) => a.gain - b.gain).forEach(x => add(Lz, x.e, ngFill(pick(['{X} went backwards: {G} on the grid, {P} at the flag. The team need to understand why.', 'A frustrating Sunday for {X}, who lost {lost} places from the start.']), Object.assign(v(x.e), { lost: -x.gain }))));
  f.dnfs.forEach(e => add(Lz, e, ngFill(pick(['{X} did not finish. Another weekend where the points went elsewhere.', 'Retirement for {X} and an early flight home.']), v(e))));
  if (!W.length || !Lz.length) return null;
  const body = ['## Winners', ...W.flatMap(([e, t]) => [`### ${ngFull(e.driverId)}, ${ngTn(e.teamId)}`, t]), '## Losers', ...Lz.flatMap(([e, t]) => [`### ${ngFull(e.driverId)}, ${ngTn(e.teamId)}`, t])];
  return ngStory('wl', 'Analysis', ngFill(pick(['Winners and losers from {gpShort}', '{gpShort}: who won and who lost', 'The winners and losers of {city}']), f.v), ngFill(pick(['Who left {city} happy, and who did not.', 'Our verdict on the weekend.']), f.v),
    body, [...W, ...Lz].map(([e]) => e.driverId), [], { hours: 18 });
}

/* --- driver ratings ---------------------------------------------------------- */
function ngRatings(c, f, w) {
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)];
  const ts = ngTStand(c, f.round.seasonId, f.round.round - 1).map(r => r.id);
  const mate = e => f.race.find(x => x.teamId === e.teamId && x.driverId !== e.driverId);
  const rows = f.race.map(e => {
    let r = 6; const m = mate(e), rank = ts.indexOf(e.teamId);
    if (e.position) {
      if (e.grid) r += Math.max(-1.5, Math.min(2, (e.grid - e.position) * 0.25));
      if (e.position <= 3) r += 1; if (e.position === 1) r += 0.5;
      if (rank >= 5 && e.position <= 10) r += 1; if (rank >= 0 && rank <= 2 && e.position > 8) r -= 1;
      if (m) r += !m.position || m.position > e.position ? 0.5 : -0.4;
    } else r = 4.5;
    return { e, r: Math.max(2, Math.min(10, Math.round(r))) };
  }).sort((a, b) => b.r - a.r || (a.e.position || 99) - (b.e.position || 99));
  if (!rows.length) return null;
  const line = ({ e, r }) => { const v = { X: ngLn(e.driverId), P: e.position ? 'P' + e.position : '', G: e.grid ? 'P' + e.grid : 'the back', T: ngTn(e.teamId) };
    const bank = !e.position ? ['Out of the race, so hard to judge. The pace before the end was {pace}.', 'A retirement ends the story early.']
      : r >= 9 ? ['Outstanding. {P} was the most this car could give, and he took all of it.', 'Close to perfect. Every lap counted.'] : r >= 7 ? ['A strong drive to {P}. Few mistakes, good racecraft.', 'Did everything right and was rewarded with {P}.']
      : r >= 5 ? ['A quiet weekend. {P} is about where the car was.', 'Solid but unspectacular. {P}.'] : ['A day to forget. {P} from {G} is below his level.', 'Struggled all race and finished {P}.'];
    return [`### ${ngFull(e.driverId)} (${v.T}): ${r}/10`, ngFill(pick(bank), Object.assign(v, { pace: pick(['promising', 'hard to read', 'decent']) }))]; };
  const star = rows[0];
  return ngStory('ratings', 'Analysis', ngFill(pick(['{gpShort} driver ratings', 'Rated: every driver at {gpShort}', 'Our {gpShort} driver ratings']), f.v),
    `${ngFull(star.e.driverId)} is our driver of the weekend with ${star.r}/10.`, rows.flatMap(line), [star.e.driverId], [star.e.teamId], { hours: 28 });
}

/* --- team radio -------------------------------------------------------------- */
const NG_ENG = {
  win: ['P1, {X}! P1! Fantastic job.', 'That is the win, {X}! Get in there!', 'Chequered flag, P1. What a drive, mate.'],
  p2: ['P2, {X}. Good points today.', 'That is P2. Strong race, well done.'],
  fl: ['Purple lap, {X}. Fastest lap is ours.', 'Fastest lap. Nice job on those tyres.'],
  dnf: ['Box, box. We need to stop the car, {X}. Sorry.', 'We have to retire the car, {X}. Stop at the next safe place.'],
  points: ['That is points, {X}! Points at last!', 'P{p}, {X}. We are back in the points!'],
};
function ngRadio(c, f, w) {
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], mem = ngMemAfter(c, f.round) || { mood: {}, events: [] };
  const laps = f.round.laps || 'the final', out = [], ids = [];
  const clip = (e, eng, said, lap) => { ids.push(e.driverId); out.push(`### Lap ${lap}: ${ngFull(e.driverId)} (${ngTn(e.teamId)})`, `Engineer: "${ngFill(pick(eng), { X: ngLn(e.driverId).split(' ')[0], p: e.position })}"`, `${ngLn(e.driverId)}: "${said}"`); };
  clip(f.W, NG_ENG.win, ngSays(driverOf(f.W.driverId), 'win', rnd), laps);
  if (f.P2) clip(f.P2, NG_ENG.p2, ngSays(driverOf(f.P2.driverId), 'p2', rnd), laps);
  const back = mem.events.find(x => x.kind === 'close' && x.sl.kind === 'slump');
  if (back) { const e = f.race.find(x => x.driverId === back.sl.drivers[0]); if (e) clip(e, NG_ENG.points, ngMoodLine(e.driverId, 'good', rnd), laps); }
  if (f.fl && ![f.W.driverId, f.P2 && f.P2.driverId].includes(f.fl.driverId)) clip(f.fl, NG_ENG.fl, pick(['Yes! The car feels great now.', 'Copy. Tyres still feel good.', 'Nice. Keep me updated on the gaps.']), typeof laps === 'number' ? laps - 3 : 'late');
  const d = f.dnfs[Math.floor(rnd() * Math.max(1, f.dnfs.length))];
  if (d) clip(d, NG_ENG.dnf, ngSays(driverOf(d.driverId), 'dnf', rnd), d.laps || 'mid-race');
  return ngStory('radio', 'Interview', ngFill(pick(['Team radio: the best messages from {gpShort}', '"{quote}": the radio messages from {city}', 'Listen in: team radio from {gpShort}']), Object.assign({}, f.v, { quote: (out[2] || '').replace(/^[^"]*"|"$/g, '').split('.')[0] })),
    ngFill(pick(['What the drivers said when the helmets were still on.', 'Joy, pain and humour on the radio.']), f.v), out, ids, [], { hours: 1 });
}

/* --- team bosses react ------------------------------------------------------- */
const NG_BOSSQ = {
  great: ['"A fantastic day. The team deserves every bit of this."', '"This is what we work for. Everyone should be proud."', '"We came here with a plan and we delivered it."'],
  good: ['"Good points. We take them and keep building."', '"A solid weekend. There is still more performance to find."', '"Both cars in the points is what we needed."'],
  bad: ['"Not good enough. We will look at everything before the next race."', '"We lacked pace and we know it. No excuses."', '"A difficult day. We need to react quickly."'],
  crisis: ['"This is a hard moment for the team. We need to stay united and find answers."', '"We cannot keep having weekends like this. Changes will come."', '"I will not hide it: this hurts, and we must fix it now."'],
};
function ngBosses(c, f, w) {
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], mem = ngMemAfter(c, f.round) || { open: [] };
  const by = {}; f.race.forEach(e => (by[e.teamId] = by[e.teamId] || []).push(e));
  const ts = ngTStand(c, f.round.seasonId, f.round.round);
  const body = []; const teams = Object.keys(by).sort((a, b) => ts.findIndex(r => r.id === a) - ts.findIndex(r => r.id === b));
  teams.forEach(tid => {
    const es = by[tid], p = es.reduce((a, e) => a + (e.pts || 0), 0), best = Math.min(...es.map(e => e.position || 99));
    const war = mem.open.find(z => z.kind === 'teamwar' && z.teams[0] === tid);
    const m = best <= 3 ? 'great' : p > 0 ? 'good' : es.every(e => !e.position) ? 'crisis' : 'bad';
    body.push(`### ${ngTn(tid)}: ${ngBoss(tid)}`, pick(NG_BOSSQ[m]) + (war ? ' ' + pick(['"Both drivers know the rules. They are free to race."', '"The battle between our drivers is healthy, as long as they do not touch."']) : ''));
  });
  return ngStory('bosses', 'Interview', ngFill(pick(['What the team bosses said after {gpShort}', 'Team principals react to {gpShort}', '{gpShort}: the view from the pit wall']), f.v),
    ngFill(pick(['Every team boss on the weekend in {city}.', 'From the front of the grid to the back.']), f.v), body, [], teams.slice(0, 3), { hours: 7 });
}

/* --- five things we learned --------------------------------------------------- */
function ngFiveThings(c, f, w) {
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], mem = ngMemAfter(c, f.round) || { events: [], open: [], mood: {} }, items = [];
  const add = (h, t) => items.length < 5 && items.push([h, t]);
  if (f.L && f.L2) add(f.gap <= 10 ? 'The title fight is on a knife edge' : 'The championship picture', ngFill(f.gap <= 10 ? '{L} leads {L2} by only {gap} points. One bad weekend changes everything.' : '{L} leads by {gap} points from {L2}. The chasers need wins, not podiums.', f.v));
  mem.events.filter(x => x.kind === 'close' && x.sl.kind === 'slump').forEach(x => add(`${ngLn(x.sl.drivers[0])} is back`, `After ${x.sl.count} races without points, ${ngLn(x.sl.drivers[0])} scored again. ${ngMoodLine(x.sl.drivers[0], 'good', rnd)}`));
  mem.events.filter(x => x.kind === 'breakout').forEach(x => add(`${ngTn(x.team)} punched above their weight`, `${ngLn(x.d)} put a car from ${ngOrd(x.rank)} in the teams' table on the podium.`));
  mem.events.filter(x => x.kind === 'redemption').forEach(x => add('Redemption', `${ngLn(x.d)} did not finish here in ${x.year}. This time he won.`));
  mem.open.filter(z => z.kind === 'teamwar').slice(0, 1).forEach(z => add(`Tension at ${ngTn(z.teams[0])}`, ngCallback(c, f.round, z.drivers, rnd, true)));
  mem.open.filter(z => z.kind === 'slump').sort((a, b) => b.count - a.count).slice(0, 1).forEach(z => add(`${ngLn(z.drivers[0])} needs answers`, ngCallback(c, f.round, z.drivers, rnd, true)));
  mem.open.filter(z => z.kind === 'rivalry').slice(0, 1).forEach(z => add('A rivalry is growing', ngCallback(c, f.round, z.drivers, rnd, true)));
  const top = ngTStand(c, f.round.seasonId, f.round.round); if (top[1]) add("The teams' fight", `${top[0] ? ngTn(top[0].id) : ''} lead ${ngTn(top[1].id)} by ${top[0].points - top[1].points} points in the constructors' standings.`);
  const flying = Object.entries(mem.mood).filter(([, m]) => m === 'flying').map(([d]) => d).filter(d => d !== f.W.driverId)[0];
  if (flying) add(`${ngLn(flying)} is in form`, `${ngLn(flying)}: "${ngMoodLine(flying, 'flying', rnd)}"`);
  if (f.next) add('Next up', ngFill('The paddock moves to {nextGp}, {nextDays}.', f.v));
  if (items.length < 3) return null;
  return ngStory('five', 'Analysis', ngFill(pick(['{n} things we learned from {gpShort}', 'What we learned in {city}', 'Talking points: {gpShort}']), Object.assign({}, f.v, { n: ngCap(ngWord(items.length)) })),
    ngFill(pick(['The stories behind the result.', 'Beyond the podium.']), f.v), items.flatMap(([h, t], i) => [`## ${i + 1}. ${h}`, t]), [f.W.driverId], [], { hours: 46 });
}

/* --- storyline articles: when an arc opens, turns or pays off ----------------- */
const NG_ARC_HEAD = {
  slump: ['What has gone wrong for {X}?', '{X}: {n} races, no points', 'Inside the slump of {X}'],
  slumpEnd: ['How {X} turned it around', '{X} ends the drought', 'Back in the points: the comeback of {X}'],
  form: ['{X} is on a roll', '{n} podiums in a row: the form of {X}', 'Nobody can stop {X} right now'],
  formEnd: ['The run is over for {X}'],
  teamwar: ['War at {T}: {A} against {B}', '{A} and {B}: the battle inside {T}', 'Team orders? Not yet at {T}'],
  title: ['It is a title fight: {A} against {B}', '{A} versus {B}: the championship comes alive', 'Game on: {gap} points between {A} and {B}'],
  titleLead: ['{A} takes over at the top', 'New leader: {A} moves ahead of {B}'],
  rivalry: ['{A} against {B}: a rivalry is born', 'Why {A} and {B} keep meeting on track', 'Side by side again: {A} and {B}'],
  saga: ['The {X} saga: where will he drive next?', 'Silly season: everyone is talking about {X}', '{X} and the question that will not go away'],
  veteran: ['Is this the end for {X}?', '{X} at {age}: how long can he go on?'],
};
function ngArcStory(c, f, w) {
  const mem = ngMemAfter(c, f.round); if (!mem) return null;
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)];
  const prio = x => x.kind === 'close' && x.sl.kind === 'slump' ? 90 : x.kind === 'beat' && x.sl.kind === 'title' && x.what === 'lead' ? 85 : x.kind === 'open' ? ({ title: 80, teamwar: 70, slump: 60, rivalry: 55, saga: 50, form: 45, veteran: 40 }[x.sl.kind] || 0)
    : x.kind === 'beat' && x.sl.kind === 'teamwar' ? 50 : 0;
  const ev = mem.events.filter(x => x.sl && prio(x) > 0).sort((a, b) => prio(b) - prio(a))[0]; if (!ev) return null;
  const sl = ev.sl, [a, b] = sl.drivers, mood = mem.mood || {};
  const st = ngStand(c, f.round.seasonId, f.round.round), pts = id => (st.find(r => r.id === id) || { points: 0 }).points;
  const v = Object.assign({}, f.v, { X: ngLn(a), A: ngLn(a), B: b ? ngLn(b) : '', n: sl.count, T: sl.teams[0] ? ngTn(sl.teams[0]) : '', gap: sl.gap, age: sl.age, startCity: sl.startCity });
  if (sl.kind === 'teamwar' || sl.kind === 'title') { const lead = pts(a) >= pts(b) ? a : b, oth = lead === a ? b : a; Object.assign(v, { A: ngLn(lead), B: ngLn(oth) }); }
  const key = ev.kind === 'close' ? 'slumpEnd' : sl.kind === 'title' && ev.what === 'lead' ? 'titleLead' : sl.kind;
  const recap = sl.beats.slice(-5).map(bt => `${bt.city}: ${bt.res.join(', ')}.`).join(' ');
  const quotes = sl.drivers.slice(0, 2).map(d => `${ngLn(d)} ${pick(['said', 'admitted', 'told us'])}: "${ngMoodLine(d, mood[d], rnd)}"`);
  const intro = {
    slump: '{X} has not scored since {startCity}. That is {n} races in a row without a point, for a driver who scored before it started.',
    slumpEnd: 'For {n} races, since {startCity}, {X} came home with nothing. In {city} that changed.',
    form: 'Since {startCity}, {X} has stood on the podium every single race. {n} in a row now.',
    teamwar: 'The two drivers at {T} are now fighting each other as hard as anyone else on the grid. {A} has the upper hand for now.',
    title: 'After {city}, only {gap} points separate {A} and {B}. The championship has become a straight fight.',
    titleLead: 'The championship has a new leader. {A} is now ahead of {B}, and the gap is {gap} points.',
    rivalry: '{A} and {B} drive for different teams, but they keep ending up in the same piece of track. {n} times this season they have finished side by side.',
    saga: 'For the {nth} race in a row, the name of {X} came up in the paddock rumours.',
    veteran: 'At {age}, {X} is the elder of the grid. With the season close to its end, the question is obvious.',
  }[key];
  const close = { slumpEnd: pick(['The work starts again now, but this weekend the smile came back.', 'It is one result. It could be the start of a new season for him.']), slump: pick(['The team insist the pace is there. The results say otherwise.', 'Something has to change, and soon.']),
    teamwar: pick(['Team orders are not on the table yet. That could change quickly.', 'For the team, two drivers this close is a gift and a risk.']), title: pick(['Every point matters from here.', 'The rest of the field are now spectators to this fight.']) }[key] || '';
  return ngStory('arc', 'Feature', ngFill(pick(NG_ARC_HEAD[key] || NG_ARC_HEAD[sl.kind]), v), ngFill(pick(['The story behind the results.', 'A storyline we have followed since {startCity}.', 'How we got here.']), v),
    [ngFill(intro, Object.assign(v, { nth: ngOrd(sl.count) })), recap ? `The story so far: ${recap}` : '', ...quotes, close], sl.drivers, sl.teams, { hours: 30 });
}

/* --- milestone watch ---------------------------------------------------------- */
function ngMilestones(c, f, w) {
  const mem = ngMemAfter(c, f.round); if (!mem) return null;
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)];
  const ms = mem.events.filter(x => x.kind === 'mile'); if (!ms.length) return null;
  const text = x => { const X = ngFull(x.d), T = ngTn(x.team);
    return { starts: `${X} started his ${ngOrd(x.n)} race in ${f.v.city}.`, firstpodium: `${X} stood on a podium for the first time in his career.`, podiums: `${X} took the ${ngOrd(x.n)} podium of his career.`,
      firstwin: `${X} won a race for the first time in his career.`, wins: `${X} took career win number ${x.n}.`, teamfirst: `${T} won a race for the first time in this career, with ${X} at the wheel.`,
      drought: `${T} ended a run of ${x.n} races without a podium, thanks to ${X}.` }[x.what]; };
  const top = ms.find(x => x.what === 'firstwin') || ms.find(x => x.what === 'teamfirst') || ms[0];
  const head = { firstwin: '{X}: a first career win', teamfirst: 'History for {T}', drought: '{T} end the wait', firstpodium: '{X} on the podium for the first time', starts: '{X} reaches {n} races', wins: '{X} reaches {n} wins', podiums: '{X} reaches {n} podiums' }[top.what];
  const body = [...ms.map(text)];
  if (['firstwin', 'firstpodium'].includes(top.what)) body.push(`${ngLn(top.d)} said: "${ngMoodLine(top.d, 'flying', rnd)}"`, `${ngBoss(top.team)}: "${pick(['We always believed in him. This is only the start.', 'Days like this are why we do this job.'])}"`);
  return ngStory('miles', 'Feature', ngFill(head, { X: ngLn(top.d), T: ngTn(top.team), n: top.n }), ngFill(pick(['Numbers that will stay in the record books.', 'Milestones from {city}.']), f.v),
    body, ms.map(x => x.d), ms.map(x => x.team), { hours: 10 });
}

/* --- long read in the gap between races --------------------------------------- */
function ngLongRead(c, f, w) {
  if (!f.next) return null;
  const days = Math.round((parseDate(f.next.dateStart || f.next.dateEnd) - parseDate(f.round.dateEnd || f.round.dateStart)) / 864e5); if (!(days >= 12)) return null;
  const mem = ngMemAfter(c, f.round); if (!mem || !mem.open.length) return null;
  const sl = [...mem.open].sort((a, b) => b.heat - a.heat)[0], rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)];
  const [a, b] = sl.drivers, v = { X: ngLn(a), A: ngLn(a), B: b ? ngLn(b) : '', T: sl.teams[0] ? ngTn(sl.teams[0]) : '', startCity: sl.startCity, n: sl.count, days, nextGp: f.v.nextGp };
  const title = { slump: 'The long read: inside the slump of {X}', form: 'The long read: how {X} became the man to beat', teamwar: 'The long read: {A}, {B} and the battle for {T}', title: 'The long read: {A} against {B}',
    rivalry: 'The long read: {A}, {B} and a rivalry in the making', saga: 'The long read: the future of {X}', veteran: 'The long read: {X} and the final chapter' }[sl.kind];
  const beats = sl.beats.map(bt => `- ${bt.city}: ${bt.res.join(', ')}`);
  return ngStory('longread', 'Feature', ngFill(title, v), ngFill('With {days} days until {nextGp}, we look back at the story that has followed us since {startCity}.', v),
    [ngFill(pick(['This story did not start this week. It started in {startCity}.', 'To understand where this is going, you need to go back to {startCity}.']), v), '## Race by race', ...beats, '## What they say',
      ...sl.drivers.map(d => `${ngLn(d)} said: "${ngMoodLine(d, (mem.mood || {})[d], rnd)}"`), sl.teams[0] ? `${ngBoss(sl.teams[0])}: "${pick(['We know what is being said. We focus on our own job.', 'There is a lot of noise. Inside the team, we are calm.'])}"` : '',
      '## What comes next', ngFill(pick(['The next chapter is written at {nextGp}.', 'The answer may come at {nextGp}.']), v)], sl.drivers, sl.teams, { hours: 24 * Math.min(5, Math.floor(days / 3)) });
}

/* --- season review --------------------------------------------------------------- */
function ngSeasonReview(c, f, w) {
  if (!f.last) return null;
  const mem = ngMemAfter(c, f.round); if (!mem) return null;
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], year = (seasonOf(c, f.round.seasonId) || {}).year;
  const arcs = [...mem.ended].sort((a, b) => b.peak - a.peak).slice(0, 5);
  const champ = f.L ? f.L.id : null;
  const head = sl => { const [a, b] = sl.drivers; return ({ slump: `The slump of ${ngLn(a)}`, form: `${ngLn(a)}'s podium run`, teamwar: `${ngLn(a)} against ${ngLn(b)} at ${ngTn(sl.teams[0])}`, title: `The title fight: ${ngLn(a)} against ${ngLn(b)}`,
    rivalry: `${ngLn(a)} and ${ngLn(b)}`, saga: `The ${ngLn(a)} saga`, veteran: `${ngLn(a)}, the veteran` })[sl.kind] || sl.kind; };
  const arc = sl => { const span = sl.endCity && sl.endCity !== sl.startCity ? `From ${sl.startCity} to ${sl.endCity}` : `It began in ${sl.startCity}`;
    const end = { podium: 'and it ended with a podium.', points: 'and it ended with points.', champion: `and it ended with ${ngLn(sl.leadAtEnd || sl.drivers[0])} on top.`, faded: 'until the gap grew too big.', ended: `after ${sl.count} podiums in a row.`, season: 'and it runs into next season.' }[sl.outcome] || '.';
    return `${span}, ${sl.beats.length} races long, ${end}`; };
  const body = [champ ? `${ngFull(champ)} is the ${year} champion with ${f.L.points} points, ${f.gap} ahead of ${f.v.L2}.` : '', '## The stories that defined the season',
    ...arcs.flatMap(sl => [`### ${head(sl)}`, arc(sl)]), champ ? `The champion said: "${ngMoodLine(champ, 'flying', rnd)}"` : ''];
  return ngStory('review', 'Feature', pick([`${year} season review: the stories that defined the year`, `The ${year} season in five stories`, `Looking back at ${year}`]),
    pick(['From the first race to the last.', 'Every arc, every twist.']), body, champ ? [champ] : [], [], { hours: 24 * 5 });
}

/* --- the weekend before the race: Thursday press conference, Friday practice ----- */
const NG_PRESSQ = {
  leader: ['You arrive as championship leader. Does that change how you race?', 'Everyone is chasing you. How do you handle that?'],
  chaser: ['You are {gap} points behind. Is this the weekend to attack?', 'What do you need to close the gap to {L}?'],
  slump: ['{n} races without points. What is going wrong?', 'How do you get out of a run like this?'],
  form: ['{n} podiums in a row. Where does this form come from?', 'Is this the best you have ever driven?'],
  teamwar: ['The fight with {M} is very close. Is the atmosphere still good in the team?', 'Would you accept team orders in favour of {M}?'],
  saga: ['Your name keeps coming up in the rumours. Have you decided your future?', 'Can you tell us anything about next year?'],
  rivalry: ['You and {R} keep finishing side by side. Is there a rivalry?', 'What do you think of {R} as a racer?'],
  home: ['This is your home race. How does it feel?', 'What does the home crowd mean to you?'],
  veteran: ['Is retirement on your mind?', 'How long do you want to keep racing?'],
};
const NG_PRESSA = {
  rivalry: ['He is fast and fair. I enjoy racing him.', 'We know each other well now on track. I expect another battle.'], home: ['It is special. I want to give the fans something to cheer.', 'I have dreamed of this since I was a kid.'],
  veteran: ['I still love it. When I stop loving it, I will stop.', 'I will decide at the right moment. Not today.'], teamwar: ['We push each other, and that makes the team stronger.', 'We are free to race. I want to finish ahead of him, of course.'],
};
function ngPress(c, round, w) {
  const mem = ngMemBefore(c, round); if (!mem) return null;
  const rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)], st = ngStand(c, round.seasonId, round.round - 1); if (!st[0] || !st[0].points) return null;
  const seats = []; const add = (d, kind, x) => { if (d && !seats.some(s => s.d === d) && seats.length < 4) seats.push(Object.assign({ d, kind }, x)); };
  add(st[0].id, 'leader');
  const hot = [...mem.open].sort((a, b) => b.heat - a.heat);
  hot.forEach(sl => { const [a, b] = sl.drivers; if (sl.kind === 'teamwar') add(a, 'teamwar', { M: ngLn(b) }); else if (sl.kind === 'rivalry') add(a, 'rivalry', { R: ngLn(b) }); else if (['slump', 'form', 'saga', 'veteran'].includes(sl.kind)) add(a, sl.kind, { n: sl.count }); });
  const home = st.find(r => (driverOf(r.id) || {}).nationality === round.countryCode); if (home) add(home.id, 'home');
  if (st[1]) add(st[1].id, 'chaser', { gap: st[0].points - st[1].points });
  const v0 = { L: ngLn(st[0].id), city: round.city || round.name, gpShort: round.name };
  const body = [ngFill(pick(['The drivers faced the media on Thursday in {city}. These were the main questions.', 'Media day in {city}: here is what the drivers said.']), v0)];
  seats.forEach(s => {
    const v = Object.assign({}, v0, s), q = ngFill(pick(NG_PRESSQ[s.kind]), v);
    const a = s.kind === 'saga' ? ngSays(driverOf(s.d), 'rumour', rnd) : NG_PRESSA[s.kind] ? pick(NG_PRESSA[s.kind]) + ' ' + ngMoodLine(s.d, mem.mood[s.d], rnd) : ngMoodLine(s.d, mem.mood[s.d], rnd);
    body.push(`### ${ngFull(s.d)}`, `Q: ${q}`, `${ngLn(s.d)}: "${a}"`);
  });
  return ngStory('press', 'Interview', ngFill(pick(['Press conference: what the drivers said in {city}', 'Thursday in {city}: the drivers speak', '{gpShort} media day: the key quotes']), v0),
    ngFill(pick(['The questions, and the answers, before the action starts.', 'Talking points before the cars hit the track.']), v0), body, seats.map(s => s.d), [], { hoursBefore: 24 });
}
function ngPractice(c, round, w) {
  const mem = ngMemBefore(c, round), rnd = w.rnd, pick = l => l[Math.floor(rnd() * l.length)];
  const q = ngRace(c, round.id, 'qualifying').filter(e => e.position).sort((a, b) => a.position - b.position).slice(0, 3);
  const v = { city: round.city || round.name, gpShort: round.name, circuit: round.circuit || round.city || round.name };
  const body = [];
  if (q.length >= 3) body.push('## Who looked quick', `${ngLn(q[0].driverId)} set the pace on Friday, with ${ngLn(q[1].driverId)} and ${ngLn(q[2].driverId)} close behind. ${pick(['Long-run pace looked strong too.', 'The gaps were small, so Saturday is wide open.'])}`);
  if (mem) {
    const sl = [...mem.open].sort((a, b) => b.heat - a.heat)[0];
    if (sl) body.push('## The storyline to watch', ngCallback(c, round, sl.drivers, rnd, false) || `All eyes on ${sl.drivers.map(ngLn).join(' and ')}.`);
    const low = Object.entries(mem.mood).filter(([, m]) => m === 'crisis' || m === 'low').map(([d]) => d)[0];
    if (low) body.push('## Under pressure', `${ngLn(low)} needs a good weekend. "${ngMoodLine(low, mem.mood[low], rnd)}"`);
  }
  body.push('## Track talk', ngFill(pick(['Track temperatures climbed through the day, and the tyres did not like it.', 'Several drivers ran wide at the same corner, and the track limits will be watched.', 'Most teams ran new parts on Friday, and the data will tell if they work.', 'Wind made the car difficult to balance for many drivers at {circuit}.']), v));
  if (body.length < 3) return null;
  return ngStory('practice', 'News', ngFill(pick(['Practice talking points from {city}', 'Friday at {gpShort}: what we learned', '{gpShort} practice: the key stories']), v),
    ngFill(pick(['The first clues of the weekend.', 'What Friday told us.']), v), body, q.map(e => e.driverId), [], { hoursBefore: -9 });
}

/* all new post-race formats for one round (F1 only; F2 keeps its shorter coverage) */
function ngMoreFormats(c, f, w, seed, mk) {
  if (NG_F2.has(f.round.seasonId)) return [];
  f.v = f.v || ngVars(f);
  return [ngWinnersLosers, ngRatings, ngRadio, ngBosses, ngFiveThings, ngArcStory, ngMilestones, ngLongRead, ngSeasonReview]
    .map((fn, i) => fn(c, f, mk(seed + 'nf' + i))).filter(Boolean);
}
