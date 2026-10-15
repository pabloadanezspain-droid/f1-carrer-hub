/* ==========================================================================
   selectors.js — derived data (standings, line-ups, stats).
   Every function takes the career object `c` explicitly so it is testable
   and never caches stale numbers: standings are always recomputed from results.
   ========================================================================== */

const byId = (arr, id) => arr.find(r => r.id === id) || null;

function seasonOf(c, seasonId) { return byId(c.seasons, seasonId); }
function activeSeason(c) { return seasonOf(c, c.meta.activeSeasonId) || c.seasons[0] || null; }
function seasonsDesc(c) { return [...c.seasons].sort((a, b) => b.year - a.year); }
function ruleFor(c, seasonId) {
  const s = seasonOf(c, seasonId);
  return (s && byId(c.pointsRules, s.pointsRuleId)) || c.pointsRules[0] || { race: [], sprint: [], fastestLap: { points: 0, maxPosition: 10 } };
}

function roundsOf(c, seasonId) { return c.rounds.filter(r => r.seasonId === seasonId).sort((a, b) => a.round - b.round); }
function completedRounds(c, seasonId) { return roundsOf(c, seasonId).filter(r => resultFor(c, r.id, 'race')); }
function nextRound(c, seasonId) { return roundsOf(c, seasonId).find(r => !resultFor(c, r.id, 'race')) || null; }
function lastRound(c, seasonId) { const done = completedRounds(c, seasonId); return done[done.length - 1] || null; }
function resultFor(c, roundId, session) { return c.results.find(r => r.roundId === roundId && r.session === session) || null; }
function sessionsWithResults(c, roundId) { return SESSION_TYPES.filter(s => resultFor(c, roundId, s)); }

/* --- classification & points --------------------------------------------- */
const isClassified = e => e.status === 'FIN';

/* Returns entries decorated with display position + computed points. Entry order = finishing order. */
function classify(c, result) {
  if (!result) return [];
  const round = byId(c.rounds, result.roundId);
  const rule = ruleFor(c, round && round.seasonId);
  const table = result.session === 'sprint' ? (rule.sprint || []) : result.session === 'race' ? (rule.race || []) : [];
  let pos = 0;
  return result.entries.map(e => {
    const classified = isClassified(e);
    // an entry may carry its exact position (set from the standings matrix), which allows gaps
    const position = classified ? (pos = Number.isInteger(e.pos) && e.pos > pos ? e.pos : pos + 1) : null;
    let pts = 0;
    if (classified && position <= table.length) pts = Number(table[position - 1]) || 0;
    const fl = rule.fastestLap || {};
    if (result.session === 'race' && e.fastestLap && classified && fl.points && position <= (fl.maxPosition || 10)) pts += Number(fl.points);
    if (e.status === 'DSQ') pts = 0;
    if (e.points !== null && e.points !== undefined && e.points !== '') pts = Number(e.points); // manual override
    const label = classified ? String(position) : e.status === 'DSQ' ? 'DQ' : 'NC';
    return Object.assign({}, e, { position, posLabel: label, pts });
  });
}

/* --- line-ups / transfers ------------------------------------------------- */
function assignmentsOf(c, seasonId) { return c.assignments.filter(a => a.seasonId === seasonId); }
function assignmentActive(a, roundNo) { return a.fromRound <= roundNo && (a.toRound == null || a.toRound >= roundNo); }

/* Team a driver is contracted to at a given round (race seat preferred). */
function driverTeamAt(c, driverId, seasonId, roundNo) {
  const list = assignmentsOf(c, seasonId).filter(a => a.driverId === driverId && assignmentActive(a, roundNo));
  const a = list.find(x => x.role === 'race') || list[0];
  return a ? a.teamId : null;
}

/* The current (latest) team for a driver in a season; falls back to their last result. */
function driverCurrentTeam(c, driverId, seasonId) {
  const rounds = roundsOf(c, seasonId);
  const at = (nextRound(c, seasonId) || rounds[rounds.length - 1] || { round: 1 }).round;
  const t = driverTeamAt(c, driverId, seasonId, at);
  if (t) return t;
  const list = assignmentsOf(c, seasonId).filter(a => a.driverId === driverId).sort((a, b) => b.fromRound - a.fromRound);
  return list[0] ? list[0].teamId : null;
}

/* Every team a driver has driven for in a season, in order, with round spans. */
function driverTeamHistory(c, driverId, seasonId) {
  return assignmentsOf(c, seasonId).filter(a => a.driverId === driverId).sort((a, b) => a.fromRound - b.fromRound);
}

/* Race-seat line-up of each team at a round. */
function lineupAt(c, seasonId, roundNo) {
  const map = {};
  assignmentsOf(c, seasonId).filter(a => a.role === 'race' && assignmentActive(a, roundNo)).forEach(a => {
    (map[a.teamId] = map[a.teamId] || []).push(a.driverId);
  });
  return map;
}
function teamsInSeason(c, seasonId) {
  const ids = new Set(assignmentsOf(c, seasonId).map(a => a.teamId));
  c.results.forEach(r => { const rd = byId(c.rounds, r.roundId); if (rd && rd.seasonId === seasonId) r.entries.forEach(e => ids.add(e.teamId)); });
  return c.teams.filter(t => ids.has(t.id));
}
function driversInSeason(c, seasonId) {
  const ids = new Set(assignmentsOf(c, seasonId).map(a => a.driverId));
  return c.drivers.filter(d => ids.has(d.id));
}

/* --- standings ------------------------------------------------------------ */
/* Standard countback: points, then number of wins, P2s, P3s… in races. */
function countbackSort(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  const n = Math.max(a.finishes.length, b.finishes.length);
  for (let i = 0; i < n; i++) { const d = (b.finishes[i] || 0) - (a.finishes[i] || 0); if (d) return d; }
  return a.order - b.order; // untied by results: keep record order (e.g. the grid's own order)
}

function standings(c, seasonId, kind, uptoRound) {
  const rows = {};
  const key = kind === 'teams' ? 'teamId' : 'driverId';
  const rounds = roundsOf(c, seasonId).filter(r => uptoRound == null || r.round <= uptoRound);
  let n = 0;
  const seed = id => rows[id] || (rows[id] = { id, order: n++, points: 0, wins: 0, podiums: 0, finishes: [], starts: 0, teamsUsed: [] });
  // everyone contracted appears, even on 0 points
  if (kind === 'teams') teamsInSeason(c, seasonId).forEach(t => seed(t.id));
  else assignmentsOf(c, seasonId).filter(a => a.role === 'race').forEach(a => seed(a.driverId));
  rounds.forEach(rd => {
    ['race', 'sprint'].forEach(sess => {
      const res = resultFor(c, rd.id, sess);
      classify(c, res).forEach(e => {
        const row = seed(e[key]);
        row.points += e.pts;
        if (kind === 'drivers' && !row.teamsUsed.includes(e.teamId)) row.teamsUsed.push(e.teamId);
        if (sess === 'race') {
          if (kind === 'drivers') row.starts += e.status === 'DNS' ? 0 : 1;
          if (e.position === 1) row.wins++;
          if (e.position && e.position <= 3) row.podiums++;
          if (e.position) row.finishes[e.position - 1] = (row.finishes[e.position - 1] || 0) + 1;
        }
      });
    });
  });
  const list = Object.values(rows).map(r => {
    const rec = byId(c[kind === 'teams' ? 'teams' : 'drivers'], r.id);
    r.name = rec ? (rec.lastName || rec.name || '') : r.id;
    if (kind === 'drivers') r.teamId = driverCurrentTeam(c, r.id, seasonId) || r.teamsUsed[r.teamsUsed.length - 1] || null;
    return r;
  }).sort(countbackSort);
  list.forEach((r, i) => { r.position = i + 1; });
  return list;
}
const driverStandings = (c, s, upto) => standings(c, s, 'drivers', upto);
const teamStandings = (c, s, upto) => standings(c, s, 'teams', upto);

/* --- per-entity stats ----------------------------------------------------- */
function driverSeasonResults(c, driverId, seasonId) {
  return roundsOf(c, seasonId).map(rd => {
    const res = resultFor(c, rd.id, 'race');
    const sprint = resultFor(c, rd.id, 'sprint');
    const e = classify(c, res).find(x => x.driverId === driverId) || null;
    const s = classify(c, sprint).find(x => x.driverId === driverId) || null;
    return { round: rd, entry: e, sprint: s, points: (e ? e.pts : 0) + (s ? s.pts : 0) };
  }).filter(x => x.entry || x.sprint);
}

function statsFor(c, kind, id, seasonFilter) {
  const key = kind === 'teams' ? 'teamId' : 'driverId';
  const st = { races: 0, points: 0, wins: 0, podiums: 0, poles: 0, top10: 0, dnfs: 0, fastestLaps: 0, best: null, sprintPoints: 0, sprintWins: 0, titles: 0 };
  const raced = new Set();
  c.results.forEach(res => {
    const rd = byId(c.rounds, res.roundId);
    if (!rd || (seasonFilter && rd.seasonId !== seasonFilter)) return;
    const mine = classify(c, res).filter(e => e[key] === id);
    if (res.session === 'qualifying') {
      if (res.entries.length && res.entries[0][key] === id) st.poles++;
      return;
    }
    mine.forEach(e => {
      if (res.session === 'sprint') { st.sprintPoints += e.pts; if (e.position === 1) st.sprintWins++; st.points += e.pts; return; }
      raced.add(res.roundId);
      st.points += e.pts;
      if (e.position === 1) st.wins++;
      if (e.position && e.position <= 3) st.podiums++;
      if (e.position && e.position <= 10) st.top10++;
      if (e.status === 'DNF') st.dnfs++;
      if (e.fastestLap) st.fastestLaps++;
      if (e.position && (st.best == null || e.position < st.best)) st.best = e.position;
    });
  });
  st.races = raced.size;
  if (!seasonFilter) {
    // titles from completed seasons (all rounds have a race result)
    c.seasons.forEach(s => {
      const rs = roundsOf(c, s.id);
      if (!rs.length || completedRounds(c, s.id).length < rs.length) return;
      const top = standings(c, s.id, kind)[0];
      if (top && top.id === id) st.titles++;
    });
  }
  return st;
}

function articlesFor(c, opts) {
  opts = opts || {};
  return c.articles.filter(a =>
    (!opts.seasonId || a.seasonId === opts.seasonId) &&
    (!opts.driverId || a.driverIds.includes(opts.driverId)) &&
    (!opts.teamId || a.teamIds.includes(opts.teamId)) &&
    (!opts.roundId || a.roundId === opts.roundId) &&
    (!opts.category || a.category === opts.category)
  ).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}
