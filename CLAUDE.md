# NCHVC Results Viewer

A single-page viewer for NCHVC volleyball pool play and bracket play results (now the 2026 Heartland Regionals). The tournament keeps results in Google Sheets that we have **view-only** access to; this page reads them live and shows them in a simpler, phone-friendly layout. Hosted on GitHub Pages from this repository.

## Files

- `index.html`: the whole app (HTML, CSS and JS inline). No build step.
- `config.js`: sets `window.VIEWER_CONFIG`. Kept separate so replacing `index.html` never loses it.
  - `divisionsSheet`: link to the user's divisions Google Sheet, the division list.
  - `sheetsApiKey`: Google Sheets API key, used only for division discovery. It's public by design, so it's restricted in Google Cloud Console to the Sheets API and the referrer `https://rheims2.github.io/volleyball/*`. Never put it in `index.html`.
  - `indexSheet`: the NCHVC bracket index the division list is built from. Now the 2026 Regionals index ("Bracket Index - Regionals - 2026 NCHVC", tab "Regionals Index", gid 760812890), which is also `index.html`'s default.

## How data is loaded

- The tournament sheets are shared as "Anyone with the link can view". The page fetches a tab as CSV from `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`, falls back to the gviz CSV endpoint, then to a gviz JSONP script tag (this last one can blank mixed text/number cells because gviz coerces column types).
- Links should include `#gid=` so the right tab is read. A link without one reads the sheet's first tab (the divisions sheet's only tab is gid 249923025, not 0).
- Scores never use the Sheets API, so crowd size never touches its quota.
- The division list is the divisions sheet (below). The public feeds return only displayed cell text, never hyperlink targets, so the sheet's rows are built from the NCHVC index through the Sheets API, once.
- Claude.ai artifacts block outside network requests, so the page can't be published as an artifact. It must run from a real web host (GitHub Pages).

## Division discovery (NCHVC index, Sheets API)

The index doesn't change once published, so discovery runs once and fills the divisions sheet; after that the viewer only reads the sheet. The setup page (the viewer's address plus `#setup`; there's no button to it) shows the sheet's rows ready to copy (`sheetRows`, tab separated so they paste into Google Sheets as cells): every readable tab with Show = Yes, unreadable ones with Show = No, and rows already in the sheet keep their name, Show and tags. The rows start from `SAVED_LIST` in `index.html` (the last discovery: 2026-09-29 from the 2026 Heartland Regionals index, 19 readable tabs, 1 not); "Build rows from the NCHVC index" reruns discovery through the API to rebuild them for a new index. Rebuilding never changes the list itself. Sheet rows from spreadsheets the index doesn't link are left out, so a new event's rows replace the old event's; the Event row comes from the new index. `SAVED_LIST` is also the list when the sheet can't be read.

`discoverDivisions` builds the division list from the official index:

1. One `spreadsheets.get` of the index with `fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri))),userEnteredValue(formulaValue)))))`. The tab matching the link's gid is used (the index spreadsheet also has older, hidden tabs). Division links are plain cell `hyperlink`s; rich-text links (`textFormatRuns`) and `HYPERLINK()` formulas are handled too. Only cells labelled like "G18u", "G18u D1", "GJV", "B16u" count, which skips the forms, maps and info links. Links may be `.../spreadsheets/d/ID` or `.../spreadsheets/u/0/d/ID` (the Regionals index uses both).
2. One `spreadsheets.get` per linked spreadsheet with `fields=properties(title),sheets(properties(sheetId,title,hidden))`. The API can't batch across spreadsheets, so a discovery costs 1 read plus 1 per spreadsheet (8 for the 2026 Regionals), run 4 at a time. Hidden tabs and Home/Ref are skipped. A title containing "Pool" means pool play; everything else is a bracket.
3. Each candidate tab is fetched through the public CSV path and kept only if `tabReadable` passes: a pool with at least 2 teams (or, before seeding, at least 2 numbered places and a schedule), or titled brackets where every bracket on the tab has rounds named from its match names, each round feeds the next (half as many matches, or as many when top seeds get a bye), the round before the final has 2 matches, and there's a single final. (`parseBrackets` turns any time cell into a match, so "found a bracket" alone means nothing; the shape check keeps out tabs like the "Gold Bracket" ones, whose brackets parse into lopsided rounds.) Failures are listed on the setup page (the viewer's address plus #setup).
4. Names come from the spreadsheet title ("Girls 18u - 2026 Heartland - NCHVC" gives "Girls 18U") plus the tab: a "Pools" tab is just the division name, "D1 Gold Ball Brackets" becomes "Girls 18U D1 Gold Ball", "Gold Bracket" becomes "Gold". The event label ("2026 Heartland NCHVC") is the year and what follows it in the title.

Quota: the Sheets API allows about 300 reads per minute for the whole project. Discovery never runs on page load or score refreshes, only from the button (17 reads). Any failure sets a backoff (`…-backoff`) that disables the button: 10 minutes, and on a 429 doubling up to 2 hours. The list already in use stays.

The key is restricted by referrer, and browsers send only the domain on cross-site requests by default (which Google rejects). `sheetsApi` sets `referrerPolicy: "no-referrer-when-downgrade"` so the full page URL is sent.

## Divisions sheet (config)

A Google Sheet owned by the user, read on page load and when Refresh is clicked. Header row columns (case-insensitive):

- `Stage`: "Pool play" or "Bracket play". A row with Stage "Event" sets the event label (e.g. "2026 Heartland NCHVC").
- `Division`: display name, e.g. "Girls 18U D1 Gold Ball".
- `Link`: the full tab URL as plain text (not a hyperlink with display text).
- `Show`: "No" hides the row.
- Optional filter overrides: `Gender`, `Age`, `Level` (e.g. D1 or D1/D2), `Bracket` (Gold, Silver, Bronze, Copper, Iron, GBSS). If blank, these are parsed from the Division name; a "Gold & Silver" name counts as both Gold and Silver.

The sheet is the whole list: deleting a row removes that division, Show = No hides it, and a duplicate row for the same tab or name shows once. The last good sheet is cached in localStorage; if it can't be read and nothing is cached, `SAVED_LIST` is used with a short notice.

## Pool play sheet layout (parser: `parsePools`)

Parsed by labels, not fixed cell addresses. Each pool ends with a "Pool A Results" row ("Consolation Pool Results", "Iron Pool B Results"), so a pool runs from just after the previous pool's Results row to its own and is named by it; the button shows the letter ("A") or the name ("Consolation"). Schedule headers vary too much to split on: "Pool A Schedule", "Pool Schedule", "Pool D Schedule- Play 3 Sets", "Consolation Pool Schedule- Best of 3", or "Friday Schedule-" and "Saturday Schedule-" in one pool (2026 B16u). Tabs without Results rows fall back to "Pool X Schedule" headers. Per pool:

- Rows with "Match #n", court, time ("4:15 PM" or "Rolling"), team A, "vs", team B. Consolation pools put a "Team 3" placeholder beside each name; it's skipped. Before seeding the names are blank and show as "To be decided".
- "Seed" header row with opponent team names across and a "Sets" column. Each team row: seed number, team, +/-; then 3-column blocks per opponent (diff, team, opponent), with "Set 1"/"Set 2" rows below holding own score and opponent score. Negative numbers appear as "(29)".
- "Pool X Results" row (contains "complete" when final), then "Rank", "Team", "Advancement" header and ranked rows. A long note (e.g. the Team USA advancement rule) may sit in the Rank row.
- Standings are computed from set scores (sets won, point diff) and labeled unofficial until the pool is complete; then the official order and advancement are shown.

## Bracket play sheet layout (parser: `parseBrackets`)

One parser reads the Gold Ball, Silver, Bronze, Copper, Gold & Silver, GBSS and Iron Finals tabs (verified against every NCHVC Nationals tab of those kinds, which may come back for Nationals). Common layout:

- Matches are anchored on the start-time cell ("5:00 pm"), with the day above and court and match name below. Team cells are found above and below in the same column; a team cell has its seed in the column to its left: "8A #1" (Gold Ball), a plain "1" (Silver, Bronze; shown as "#1") or "4A" (the Gold & Silver champion game).
- The score (e.g. "25-18, 31-29", winner's perspective) is written under the winning team, directly below or, in some finals and placement matches, two rows below. "DNS" under a team means it didn't show: the other team wins by forfeit. Fallback: a team appearing in the round its winner moves on to is treated as the winner.
- Rounds come from the match names when every match has a known kind: "Quarter", "Semi", "Con Semi", "3rd", "5th", "7th", and "… BALL", "CHAMP", "UNDISPUTED", "Final" or "1st" (Copper) for the final. Quarterfinals, Semifinals and Final make the bracket; 3rd place and the consolation side (Con Semi, 5th, 7th) show below it as "Placement matches". Without names, rounds are the columns (rightmost = Final). "Best of 5" sits above the final's time.
- "... Champion(s)" title cell (champion name 1–3 rows below) defines each bracket; tabs without one (Copper Finals) use the "... 1st Place" title. Its button label is the class ("8A") or what the title adds to the age and division ("Silver", "Bronze Ball"). Matches are grouped by the class in their seed labels ("8A #1" goes to 8A); other matches join the closest grouped match, then the nearest title by row.
- "Losing team to" / destination (e.g. "Bronze-8") / team: where a Gold Ball semifinal loser goes.
- "Winner:" / award text (e.g. "Gold Ball & Medals").
- Gold Ball tabs: "... Results" row, then "Rank", "Advancement", "Teams" header and ranked rows. Silver and Bronze tabs have no results table; it's built from the matches (champion, final loser, then winner and loser of the 3rd/5th/7th place matches), falling back to the "... 3rd Place" style titles with the team below.

Nationals layouts:

- Gold Ball: 4-team classes (G18u D1) or 8-team classes with quarterfinals, several classes per tab.
- Silver: 4 teams, semis, final and 3rd place (G18u D1 Silver).
- Bronze: 4 teams with 3rd place, or 8 teams with quarterfinals and a consolation side flowing left (Con Semi, 5th, 7th) (G18u D1 Bronze).
- Gold & Silver: a one-match champion game ("CHAMP" or "UNDISPUTED", seeds "4A"/"3A") plus a one-match Silver final.
- GBSS (and B14u "Gold"): 4 teams, semis, final and 3rd place.
- Copper: the 8-team Bronze layout with the final named "Copper 1st" (most divisions); G12u Copper has 6 teams, with the top two seeds going straight to the semis.
- Copper Finals (G16u D2) and Iron Finals: only the 1st, 3rd, 5th (and 7th) place matches, seeded from the pools ("1A" = 1st in pool A). GJV Iron's 7th place match has a single team.

Not supported yet: the "Gold"/"Gold Bracket" tabs (G16u D2, G14u D2, G12u, B16u; their Gold and Bronze Ball brackets share a tab and parse into lopsided rounds), Play-in + Seeding and Seeding + Qualifier. (The Iron Pools, Copper Pools and Consolation Pool tabs do parse now, since pools are split on their Results rows.) Discovery drops unsupported tabs; they're listed on the setup page (the viewer's address plus #setup).

Brackets before seeding (the 2026 Regionals tabs, a few days before the event): the seed numbers are filled in but the team cells are empty, so every slot shows "To be decided". Discovery keeps these tabs on the layout check alone. Regional bracket titles name the event ("G18u 2026 NCHVC Heartland Regional Champions"), so the class button takes the colour word from the title or the match names ("Gold", "Silver"). "Losing team to / 7th Place Game Below" notes are ignored; the placement match is shown anyway.

2026 Regionals layouts: Gold Bracket = the 8-team Copper layout ("Gold Quarter", "Gold Con Semi", "Gold 1st (Best of 5)"); Silver Bracket and B18u Gold = 7 teams, 3 quarterfinals; G12u Gold = 4 teams; GJV Consolation = placement matches only. Not supported: GJV "FRI Qualifier" (four single play-in matches, "Winning team to / Gold Bracket #5", no champion title).

## Features

- Pool play / Bracket play switch; division buttons filtered by Boys or girls, Age group, Division (D1–D4) and Bracket (brackets only). A filter only shows when some division on that stage has a value for it, so Regionals (no D1–D4 levels) have no Division filter; a hidden filter's saved choice is ignored. Filtering can switch to another division by itself (the only one left); Clear goes back to the division last tapped on that stage (`settings.chosen`), or the first one. Filters cascade and are shared by both stages, so they stay set when switching between Pool play and Bracket play (the Bracket choice is kept while on Pool play, where it doesn't apply).
- Compact header: Refresh sits beside the title, above "Updated…"; the filters have no label lines (each dropdown's first option names it: "Boys & girls", "All ages", "All brackets"; a set filter is outlined in gold) and share a row with the stage switch, which gets its own row on phones. "Follow a team…" is the follow dropdown's first option.
- Pool pages: standings plus match list with set scores, "Up next", the court for every match (shown as written on the sheet, e.g. "New Century FH #4"; "Sports Pavilion #3" shortens to "Court 3").
- Bracket pages: champion banner with award, rounds side by side (stacked on phones), placement matches (3rd place, consolation) below, loser destinations, results table.
- Follow a team (highlights it and jumps to its pool/bracket), Refresh button (no auto-refresh), highlight of changed cells since last refresh.
- Setup page, opened by adding `#setup` to the viewer's address (the Add a division button was removed): the rows for the divisions sheet with a Copy button, "Build rows from the NCHVC index", the tabs that couldn't be read, and an "Add a division" form that saves only in the current browser (the divisions sheet is the shared source). Cancel or tapping a division leaves it.

## Conventions

- Keep it a single self-contained `index.html` with no build step; fonts from Google Fonts only.
- Test parser changes against sample CSVs that mirror the real layouts before committing.
- GitHub Pages caches for about 10 minutes; append `?v=N` to the URL to check a fresh copy.
