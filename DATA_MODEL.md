# Career data model (schemaVersion 1)

The whole career is one JSON object. It is saved in the browser's `localStorage` under the key `f1ch.career.v1`. **Edit Career → Import / Export** downloads it or replaces it.

Things that hold for every record:
- Every record has a stable string `id`.
- New records get a prefix plus a random suffix, e.g. `drv_m1x9k2ab`.
- IDs are never rewritten, so later features (news generator, car-performance tracker, rumours…) can key off them safely.

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "careerName": "My Career",
    "isSample": false,            // shows the yellow "fictional sample" banner
    "sampleNotice": "…",
    "activeSeasonId": "sea_2026_grid", // default season for every page
    "playerTeamId": "team_x",     // your team (reserved for later features)
    "updatedAt": "ISO date"
  },
  "seasons":     [{ "id", "year", "name", "pointsRuleId", "notes" }],
  "pointsRules": [{ "id", "name",
                    "race":   [25,18,15,12,10,8,6,4,2,1],   // points by finishing position
                    "sprint": [8,7,6,5,4,3,2,1],
                    "fastestLap": { "points": 1, "maxPosition": 10 } }],
  "teams":   [{ "id", "name", "fullName", "color", "colorDark", "base", "principal", "technicalChief",
                "chassis", "powerUnit", "firstEntry", "championships", "logoUrl", "carUrl", "bio" }],
  "drivers": [{ "id", "firstName", "lastName", "code", "number", "nationality" /* ISO-3 e.g. GBR */,
                "dob", "birthplace", "championships", "portraitUrl", "portraitTeamId" /* suit in that portrait; blank = any */,
                "portraits": [{ "teamId", "seasonId", "ref" }] /* extra historical portraits */, "numberUrl", "photoUrls": [], "bio" }],
  "assignments": [{ "id", "seasonId", "driverId", "teamId",
                    "fromRound": 1, "toRound": null /* null = rest of season */, "role": "race" | "reserve" }],
  "rounds":  [{ "id", "seasonId", "round", "name", "country", "countryCode", "officialName", "circuit", "city",
                "laps", "lengthKm", "dateStart", "dateEnd", "sprint": false,
                "sessions": [{ "label": "Practice 1", "date": "YYYY-MM-DD", "time": "HH:MM" }],
                "status": "scheduled" | "completed", "imageUrl" }],
  "results": [{ "id", "roundId", "session": "race" | "sprint" | "qualifying",
                "entries": [ /* in finishing order (pole first for qualifying) */
                  { "driverId", "teamId", "status": "FIN" | "DNF" | "DNS" | "DSQ",
                    "grid", "laps", "time", "fastestLap": false, "points": null /* null = use rule */ } ] }],
  "articles": [{ "id", "seasonId", "roundId" /* optional */, "publishedAt", "category", "title", "slug",
                 "standfirst", "body" /* paragraphs separated by newlines */, "author", "featured",
                 "imageUrl", "driverIds": [], "teamIds": [] }],
  "assets": [{ "id", "kind": "headshot" | "suit" | "portrait" | "derived", "name", "mime", "bytes", "w", "h",
               "driverId", "teamId", "uploadedAt",
               "fit": { "cx","nw","ct","cd","aspect","contour", "headMask","bodyMask","faceExt" /* derived asset ids */ },
               "derivedFrom", "role" /* derived files only */ }],   // blob itself: IndexedDB "f1ch-assets", key = id (never modified)
  "composites": [{ "id", "driverId", "teamId", "version", "status": "approved" | "superseded",
                   "face": REF, "faceSrc": "portrait" | "headshot", "suit": REF,
                   "params": { "mode": "fit" | undefined,
                               // fit mode:   fx fy fs fr (face) · cut cfe (head over collar) · sx sy ss (suit) · sb ta tint
                               // simple mode: fc fe oval oy ow oh (face cut/mask) · sc (suit cut) · sb ta tint
                               // both:        br ct sa hu wa (colour match) },
                   "createdAt", "approvedAt", "supersededAt", "supersededBy" }]
}
// REF = { "type": "asset", "id" } | { "type": "url", "url" } | { "type": "placeholder" }
// Library portraits' neck/collar analysis lives in tools/portrait-fit.json (keyed by image path), masks in assets/f1com/masks/.
// An export with "Include uploaded images" also carries "assetBlobs": { assetId: dataURL }.
```

## Rules the code relies on

- **Nothing is hard-coded.** Teams, drivers, rounds and seasons are all just array entries. Standings include every driver or team that has a race seat or a result in that season.
- **Transfers.**
  - A driver can have several `assignments` in one season, each covering a range of rounds.
  - `driverTeamAt(driver, season, round)` returns the seat for a given round.
  - The Quick transfer form ends the current seat at round N-1 and starts a new seat at round N.
- **Historical team is preserved.**
  - Every result entry stores its own `teamId`.
  - Race results, constructor points and driver season tables always use that stored team, never the driver's current one. Old results keep showing the team the driver actually drove for.
- **Points are derived, never stored.**
  - Standings are recalculated from `results` + the season's `pointsRule` on every render.
  - `entry.points`, when set, overrides the calculated value. Use it for penalties or half points.
  - Ties are broken by countback: wins, then P2s, and so on.
- **Classification.**
  - Only `FIN` entries get a position.
  - `DNF`/`DNS` show as `NC`, and `DSQ` shows as `DQ`. All three score 0 unless overridden.
  - Lapped cars are `FIN`, with a time such as `+1 Lap`.
- **Completed round.** A round counts as completed once it has a `race` result. The next race is the first round without one.
- **Portraits for a driver in a team** are resolved by `resolvePortrait` in `src/portraits.js`. The order is: approved composite → real portrait in that team's suit → automatic draft (own face + team suit) → placeholder. Showroom, team and older-season pages pass the team the driver drove for in that context, so historical views keep the old suit.
- **Referential integrity.**
  - `validateCareer()` checks for duplicate IDs and dangling references.
  - Imports that fail the check are rejected.
  - Deleting a record that is still referenced is refused, with a list of what uses it.

## Where it lives in code

| File | Role |
|---|---|
| `src/store.js` | Schema defaults, `normalizeCareer` (migration point), `validateCareer`, persistence, CRUD |
| `src/selectors.js` | All derived data: standings, line-ups, stats, next race |
| `src/sample-data.json` | Generated by `tools/make-sample.mjs` (real 2026 grid and calendar, no results, deterministic) |
| `test/selectors.test.mjs` | Node tests for points, transfers, multi-season, integrity, persistence |
