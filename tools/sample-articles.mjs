// Hand-written seed articles for the FICTIONAL sample season (they match the seeded results).
const A = (id, roundId, publishedAt, category, title, standfirst, body, driverIds = [], teamIds = [], featured = false) => ({
  id, seasonId: 'sea_2030', roundId, publishedAt, category, title, slug: id.replace(/^art_/, ''), standfirst,
  body: body.trim().split('\n').map(s => s.trim()).join('\n'), author: 'Career Desk', featured, imageUrl: '', driverIds, teamIds,
});

export const ARTICLES = [
  A('art_season_preview', null, '2030-02-24T09:00:00Z', 'Feature', 'Vantage Racing ready for a new era',
    'Ten teams, twenty-one drivers and twelve rounds — everything you need to know before the lights go out in Sakhir.',
    `Vantage Racing head into the 2030 campaign with a refreshed VR-30 and a clear message from team principal Elena Hart: podiums are the minimum.

Theo Marchetti and Lukas Brandt remain the line-up, and pre-season running suggests the car is quick over a single lap but still sensitive to rear-tyre temperature in long runs.

Halcyon and Scuderia Aurora remain the benchmarks on paper, while Kestrel's winter upgrades caught the paddock's attention on the final day of testing.

"We know where we need to improve," said Hart. "The first three races will tell us whether we have done enough."`,
    ['drv_marchetti', 'drv_brandt'], ['team_vantage', 'team_halcyon', 'team_aurora'], false),

  A('art_r1_report', 'rnd_2030_01', '2030-03-01T18:30:00Z', 'Race Report', 'Grant stuns Sakhir with first career victory',
    'Oliver Grant converted a measured strategy into a maiden win, while Lukas Brandt claimed Vantage’s first podium of the year.',
    `Oliver Grant delivered the result of his career in Bahrain, taking victory for Kestrel ahead of Callum Hayes and Vantage’s Lukas Brandt.

Kenji Moriyama started from pole but faded on the hard tyre, allowing his team-mate to take control after the second round of stops.

It was a difficult afternoon for Theo Marchetti, who dropped into traffic on the opening lap and could only recover to 14th.

"I didn't expect this when I woke up today," said Grant. "The car came alive in the final stint."`,
    ['drv_grant', 'drv_hayes', 'drv_brandt', 'drv_marchetti'], ['team_kestrel', 'team_vantage'], false),

  A('art_r2_report', 'rnd_2030_02', '2030-03-08T20:30:00Z', 'Race Report', 'Grant makes it two from two in Jeddah',
    'The Kestrel driver backed up his opening win as Lindqvist and Ortega completed the podium.',
    `Oliver Grant is the early championship leader after another composed drive under the Jeddah lights.

Mika Lindqvist chased hard in the closing laps but never got within DRS range, while Rafael Ortega took third for Scuderia Aurora after Hayes converted pole into only fourth.

Vantage scored with both cars, Marchetti sixth and Brandt seventh.`,
    ['drv_grant', 'drv_lindqvist', 'drv_ortega', 'drv_marchetti'], ['team_kestrel', 'team_vantage'], false),

  A('art_r3_report', 'rnd_2030_03', '2030-03-22T08:30:00Z', 'Race Report', 'Halcyon one-two as Marchetti finds the podium',
    'Jules Fontaine led a Halcyon one-two in Melbourne; Theo Marchetti took third for Vantage.',
    `Halcyon finally showed their true pace at Albert Park, Jules Fontaine winning ahead of team-mate Mika Lindqvist.

Theo Marchetti bounced back from a tough start to the year, keeping Ortega behind for the final 20 laps to secure third place.

Mateus Rocha was the only retirement after contact at Turn 3 on the opening lap.`,
    ['drv_fontaine', 'drv_lindqvist', 'drv_marchetti'], ['team_halcyon', 'team_vantage'], false),

  A('art_transfer_swap', 'rnd_2030_05', '2030-04-23T10:00:00Z', 'Transfer', 'Okafor and Rossi swap seats from Miami',
    'Ironbridge and Talon agree a mid-season driver exchange effective from Round 6.',
    `In a rare mid-season move, Ironbridge and Talon have agreed to exchange drivers with immediate effect.

Daniel Okafor joins Talon alongside Leo Whitaker, while Antoine Rossi moves to Ironbridge to partner Tomáš Novák.

Both drivers keep the points they have scored so far; constructor points already earned stay with the team they were scored for.`,
    ['drv_okafor', 'drv_rossi'], ['team_ironbridge', 'team_talon'], false),

  A('art_r6_report', 'rnd_2030_06', '2030-05-03T22:30:00Z', 'Race Report', 'Lindqvist completes Miami double',
    'Mika Lindqvist won both the Sprint and the Grand Prix to move into title contention.',
    `Mika Lindqvist took a clean sweep of the Miami weekend, winning Saturday's Sprint and Sunday's Grand Prix.

Kenji Moriyama finished second and Jules Fontaine third, keeping Halcyon at the top of the Teams' Championship.

Vantage left Florida with points from both cars, Marchetti seventh and Brandt sixth.`,
    ['drv_lindqvist', 'drv_moriyama', 'drv_fontaine'], ['team_halcyon', 'team_vantage'], false),

  A('art_grant_injury', 'rnd_2030_07', '2030-05-28T11:00:00Z', 'News', 'Kowalska steps up as Grant ruled out',
    'Reserve driver Ana Kowalska will race for Kestrel from Barcelona while Oliver Grant recovers from a wrist injury.',
    `Kestrel have confirmed that Oliver Grant will miss the upcoming rounds after a training injury sustained the week after Monaco.

Reserve driver Ana Kowalska, 24, takes over the No. 50 car from Round 8.

Grant leaves with second place in Monaco and two wins on his record this season.`,
    ['drv_grant', 'drv_kowalska'], ['team_kestrel'], false),

  A('art_r8_report', 'rnd_2030_08', '2030-06-07T17:30:00Z', 'Race Report', 'Fontaine wins in Barcelona as Kowalska stars on debut',
    'Jules Fontaine led another Halcyon one-two. Debutant Ana Kowalska took pole position.',
    `Jules Fontaine claimed his third victory of the season at the Circuit de Barcelona-Catalunya, with Mika Lindqvist again second for Halcyon.

The story of the weekend was Ana Kowalska, who took a sensational pole position in her first appearance for Kestrel.

Nils Eriksen gave Northlight their first podium of the year, while Theo Marchetti took a solid sixth for Vantage.`,
    ['drv_fontaine', 'drv_lindqvist', 'drv_kowalska', 'drv_eriksen', 'drv_marchetti'], ['team_halcyon', 'team_kestrel'], false),

  A('art_vantage_analysis', 'rnd_2030_08', '2030-06-10T09:00:00Z', 'Analysis', 'Where Vantage must find time before Montréal',
    'A look at Vantage’s first eight rounds: one podium, steady points and a clear gap to Halcyon.',
    `After eight rounds Vantage have shown flashes of front-running pace but rarely kept it over a full race.

The team's qualifying average has improved since Australia, yet both cars keep losing places in the second stint — the same tyre-temperature weakness seen in testing.

A floor upgrade is expected for Canada. If it fixes the rear-end instability, the gap to Scuderia Aurora in the Teams' Championship could close quickly.`,
    ['drv_marchetti', 'drv_brandt'], ['team_vantage'], true),
];
