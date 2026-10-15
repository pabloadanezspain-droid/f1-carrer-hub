// Generates src/sample-data.json — the starter career: the real 2026 grid and calendar, with no results.
// Deterministic, so re-running gives identical records and IDs.
// Run:  node tools/make-sample.mjs
import fs from 'node:fs';
import { realGrid, REAL_SEASON } from './real-grid-2026.mjs';

const REAL = realGrid(fs);

const career = {
  schemaVersion: 1,
  meta: {
    careerName: 'My 2026 Career',
    isSample: false,
    activeSeasonId: REAL_SEASON, playerTeamId: null, updatedAt: null,
  },
  seasons: [REAL.season],
  pointsRules: [
    { id: 'pts_standard', name: 'Standard (25-18-15…)', race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprint: [8, 7, 6, 5, 4, 3, 2, 1], fastestLap: { points: 1, maxPosition: 10 } },
    { id: 'pts_classic', name: 'Classic (10-8-6…)', race: [10, 8, 6, 5, 4, 3, 2, 1], sprint: [], fastestLap: { points: 0, maxPosition: 10 } },
  ],
  teams: REAL.teams,
  drivers: REAL.drivers,
  assignments: REAL.assignments,
  rounds: REAL.rounds,
  results: [],
  articles: [],
};

fs.writeFileSync(new URL('../src/sample-data.json', import.meta.url), JSON.stringify(career, null, 1));
console.log(`starter career: ${career.teams.length} teams, ${career.drivers.length} drivers, ${career.rounds.length} rounds`);
