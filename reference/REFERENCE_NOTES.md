# formula1.com reference capture — 14 Oct 2026

## How this was captured (read first)

- **The REA tools weren't available.** The REA MCP server wasn't connected in this session, and `npx rea-agents doctor` couldn't reach npm from this network. So **no REA Evidence IDs exist** for this capture.
- **What I used instead.** I inspected the pages in the Claude desktop app's built-in browser:
  - screenshots
  - `getComputedStyle` / `getBoundingClientRect` readings from the rendered DOM
  - a walk of the stylesheets the site shipped (CSS custom properties and `:hover` rules)
- **What this can't show.** I couldn't see any server logic, CMS structure or data API, and I don't claim anything about them.
- **Viewport sizes.**
  - Desktop: 1440×900. The layout measured 1425px wide because of the scrollbar.
  - Mobile: 375×812, with the pane's mobile emulation.
- **Cookies.** I rejected the non-essential ones ("Alle ablehnen").

Each fact is tagged:
- **[O]**: observed directly, either a computed value or visible in a screenshot.
- **[CSS]**: a rule I read from the stylesheet. The rule exists, but I didn't trigger every state.
- **[A]**: an assumption or approximation of mine.

## Global chrome

| Item | Finding |
|---|---|
| Theme | [O] Dark. The body area is `#15151E` (rgb 21,21,30) and `html` is `#26262B`. Some bands are pure `#000` (race strip, results subnav, table cards). |
| Brand red | [O] `#E10600`. Used for the active-nav underline, the "Subscribe" pill and tags. |
| Fonts | [O] Display face is `Formula1` at weights 400, 500 and 900, plus `Formula1Wide`. Body face is `Titillium Web` at 400, 600 and 700. Dates on schedule cards use `KH Interference`. |
| Container | [O] 48px side gutter on desktop (inner width 1329 of 1425). [O] 24px gutter on mobile (inner width 327 of 375). |
| Utility bar | [O] About 44px tall. Uppercase 14px/600 links (Authentics, Store…), plus the "Sign In" (white) and "Subscribe" (red) pills. |
| Main nav | [O] 64px tall. Formula1 16px links (Schedule, Results, Standings, Drivers, Teams, F1 Unlocked). Each item has 8px padding. [O] The active item has a `2px solid #E10600` bottom border. [CSS] Hover sets `border-bottom-color: accent-hot-red-20` (dark: `#710E10`). [O] The background has diagonal speed-stripe graphics. |
| Next-race strip | [O] Black band, 56px tall, sticky under the nav after scrolling. It shows "R18 · 23–25 Oct · United States ›" (Formula1 16px/500), with local and track time on the right. |
| Sticky behaviour | [O] Once you scroll, the utility bar disappears and the nav plus race strip stay pinned. I compared screenshots at scroll 0 and 2700. |
| Mobile header | [O] F1 logo on the left, hamburger and FIA badge on the right. The main links are hidden. [O] The hamburger opens a full-screen dark overlay with the same stripe pattern. Items are Formula1 about 18px in 70px rows, and the current item has a white underline. |

## Design tokens (from the `.f1rd-dark` stylesheet) [CSS]

- **Surface neutrals 1–11:**
  `#000` · `#26262B` · `#15151E` · `#303037` · `#47464C` · `#606066` · `#AAA` · `#CDCDCD` · `#E0DEDC` · `#F7F4F1` · `#FFF`
- **Text tokens on dark:**
  - text-3 is `#AAA` (secondary)
  - text-4 and text-5 are `#FFF`
- **Hover tints** are based on surface-neutral-11 (white):
  - chip: 20%
  - ghost or stroke button: 10%
  - neutral button: 80%
  - team row: `rgb(team-colour / .12)`

## Components

- **Chips / pills.** [O] 14px/700 Titillium, `8px 12px` padding, radius 1000px, background `rgba(255,255,255,.1)`. [CSS] Hover raises the background to 20%.
- **Outline dropdown button** (results "All", season). [O] 2px white border, radius 1000px, `10px 28px` padding, 17px/700.
- **Sub-nav tabs** (results: Races/Drivers/Teams/Awards). [O] 16–17px/700, `8px 24px` padding. The active tab has a `2px solid #E10600` bottom border. The bar sits on a black band.
- **Section titles.** [O] Formula1 900 uppercase:
  - page H1: 40px/44px
  - section H2: 32px/38px
  - team H1: 48px
  - article H1: 60px/60px, centred
- **Article cards on the home lead grid.**
  - [O] The lead card is 642px wide, with the title over the image on a bottom gradient (Formula1 24px/28px). An "UNLOCKED" red tag sits above the title.
  - [O] Small cards are 181px wide: image on top, then the title in Titillium 16px/600, line-height 20px.
  - [O] The right-hand list has thumbnails on the right, separated by top rules.
  - [CSS] On hover the image scales to `1.1` and the title gets an underline.
- **Latest news list cards.** [O] Two columns. Each card has a black (`#000`) background, radius 8px, an image on the left, and text with 16px padding. The title is 17px/600, line-height 24px. A red tag and a relative time sit in grey.
- **Standings tables.**
  - [O] They sit in a card with background `#000`, radius 8px and padding `24px 32px`.
  - [O] `th` is 14px/600 uppercase in `#AAA`, with padding `16px 48px 16px 4px`.
  - [O] `td` is 16px/600, line-height 24px. Each row has a `1px solid #303037` bottom border and is about 58px tall.
  - [O] The team cell has a team-coloured roundel before the name. The driver cell has a small driver headshot roundel.
  - [O] On mobile, driver names collapse to 3-letter codes, and the table scrolls sideways inside its card with a circular "›" button.
- **Home standings widget.** [O] DRIVERS/TEAMS tabs, then a podium of three cards in team colour, radius 8px. 1st place is in the middle and raised. Each card shows the position with an ordinal superscript, first name plus a **bold** surname, the team, a flag, a portrait, and "340 PTS". A full table follows.
- **Team directory cards.** [O] Two columns with a 24px gap. Each card has radius 8px, 24px padding, and the team colour as background with a `linear-gradient(315deg, dark-tone 0 → dark-tone)` overlay. The team name is Formula1 24px/500. Drivers are listed as "George **RUSSELL**" in 14px with the surname bold and uppercase. The car image sits at the bottom and the team logo badge at top right.
- **Driver directory cards.** [O] Same two-column team-colour cards, 256px tall. They show the first name (Formula1 20px/400), the surname (20px/500), the team (14px/600), the number in the team's number font, a flag, and a portrait on the right.
- **Team profile.**
  - [O] Sticky sub-nav: "‹ All teams" on the left, anchors Drivers/Statistics/Profile/News on the right.
  - [O] Full-width team-colour hero with the car, a giant name (48px/900) on white speed lines, and the drivers listed below.
  - [O] Sections follow: DRIVERS, STATISTICS (a 2026 SEASON `dl` grid in two columns, with `dt` 14px/600 grey and `dd` Formula1 24px/500), TEAM SUMMARY (a darker panel with label/value rows), and TEAM PROFILE (full name, base, team chief, technical chief, chassis, power unit…).
- **Schedule.**
  - [O] "Previous / Next / Upcoming" image cards along the top.
  - [O] Then a three-column grid of black cards. Each shows "ROUND n", the date range at top right in KH Interference 16px/700, a flag plus the country (Formula1 24px/500), the official event name (14px/600 grey), and a top-3 mini podium (code plus gap) for completed rounds.
- **Race result.**
  - [O] Breadcrumb dropdowns for the race and the session.
  - [O] The H1 is the full official name plus "- RACE RESULT". Below it: date range and circuit.
  - [O] Table columns: POS., NO., DRIVER, TEAM, LAPS, TIME / RETIRED, PTS. Non-classified rows show "NC" and the status "DNS"/"DNF".
- **Article.** [O] Full-bleed hero image, centred H1 at 60px, a 680px reading column, body 20px/32px Titillium.

## Not captured or unknown
- Hover states on the main nav and table rows were [CSS] only. I didn't verify them visually; hover screenshots didn't register under emulation.
- Animations and transitions: [A] the site appears to use simple CSS transitions. I didn't profile them.
- Exact breakpoints: [O] the containers use container queries (`@[640px]/page`, `@[735px]/page`, `@[1280px]/page`). [A] Exact switch points for every component were not enumerated.
- Fonts: the real Formula1 font files used here come from the user's own `Downloads/F1-Font-Family` folder. Titillium Web loads from Google Fonts, with a system sans-serif fallback.

## Build vs reference (screenshots in `reference/build-shots/`)

| Area | Matches the reference | Approximated or different |
|---|---|---|
| Colours, fonts, gutters | `#15151E` page, `#000` bands and cards, `#E10600` accents. Formula1 + Titillium type. 48px gutter on desktop, 24px on mobile. | Times use Titillium, because the Formula1 typeface draws `:` like `.`. Dates use Formula1Wide instead of KH Interference, which isn't available. |
| Header | Utility bar, 64px main nav with a red active underline, a black next-race strip, sticky behaviour, and a full-screen mobile menu with a hamburger. | The stripe art is CSS gradients, not F1's graphic. The wordmark is an original "CAREER" mark, not the F1 logo. |
| Results and standings tables | Black 8px card, `24px 32px` padding, grey uppercase headers, 58px rows with `#303037` rules, team and driver roundels. On mobile, driver codes and sideways scrolling. | The mobile "›" scroll button is not reproduced; the table scrolls natively instead. |
| Home | Lead grid (642 / 378 / 261 proportions), chips row, standings tabs with a raised P1 podium in team colours, plus the table. | "Next race" and "Latest result" panels are additions for career play. |
| Teams and drivers | Two-column team-colour cards with a 315° gradient, team profile hero with speed lines, `dl` stat grids, Team Summary panel. | Portraits and cars are generated SVG helmets and liveries, not photos. |
| Schedule | Previous / Next / Upcoming heroes and a three-column round grid with mini podiums. | Hero images are generated abstract art. |
| Article | Full-bleed hero, centred 60px headline, 680px column with 20/32 body text. | No video, gallery or embedded media blocks. |
