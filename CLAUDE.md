# NCHVC Results Viewer

A single-page viewer for the NCHVC volleyball Nationals pool play and bracket play results. The tournament keeps results in Google Sheets that we have **view-only** access to; this page reads them live and shows them in a simpler, phone-friendly layout. Hosted on GitHub Pages from this repository.

## Files

- `index.html`: the whole app (HTML, CSS and JS inline). No build step.
- `config.js`: sets `window.VIEWER_CONFIG`. Kept separate so replacing `index.html` never loses it.
  - `divisionsSheet`: link to the user's divisions Google Sheet (overrides and additions).
  - `sheetsApiKey`: Google Sheets API key, used only for division discovery. It's public by design, so it's restricted in Google Cloud Console to the Sheets API and the referrer `https://rheims2.github.io/volleyball/*`. Never put it in `index.html`.
  - `indexSheet` (optional): the "Nationals Bracket Index" link; `index.html` has the 2025 one as a default.

## How data is loaded

- The tournament sheets are shared as "Anyone with the link can view". The page fetches a tab as CSV from `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`, falls back to the gviz CSV endpoint, then to a gviz JSONP script tag (this last one can blank mixed text/number cells because gviz coerces column types).
- Links should include `#gid=` so the right tab is read. A link without one reads the sheet's first tab (the divisions sheet's only tab is gid 249923025, not 0).
- Scores never use the Sheets API, so crowd size never touches its quota.
- The public feeds return only displayed cell text, never hyperlink targets, so the division list is discovered through the Sheets API instead (below).
- Claude.ai artifacts block outside network requests, so the page can't be published as an artifact. It must run from a real web host (GitHub Pages).

## Division discovery (NCHVC index, Sheets API)

`discoverDivisions` builds the division list from the official index:

1. One `spreadsheets.get` of the index with `fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri))),userEnteredValue(formulaValue)))))`. The tab matching the link's gid is used ("🏐Nationals Index", gid 1891963095; an old "Nationals Index.OG" tab also exists). In the 2025 index every division link is a plain cell `hyperlink`; rich-text links (`textFormatRuns`) appear only on non-division cells, and there are no `HYPERLINK()` formulas, but all three are handled. Only cells labelled like "G18u D1", "GJV", "B16u" count, which skips the "Big Picture Nationals Prelim Schedule" link and the forms.
2. One `spreadsheets.get` per linked spreadsheet with `fields=properties(title),sheets(properties(sheetId,title,hidden))`. The API can't batch across spreadsheets, so a discovery costs 17 reads (1 + 16), run 4 at a time. Hidden tabs and Home/Ref are skipped. A title containing "Pool" means pool play; everything else is a bracket.
3. Each candidate tab is fetched through the public CSV path and kept only if the parser finds real content: a pool with at least 2 teams, or a titled bracket with at least one team. (`parseBrackets` turns any time cell into a match, so "found a bracket" alone means nothing.) Failures are listed on the Add a division page.
4. Names come from the spreadsheet title ("Girls 18u D1 - 2025 NCHVC" gives "Girls 18U D1") plus the tab: a "Pools" tab is just the division name, "D1 Gold Ball Brackets" becomes "Girls 18U D1 Gold Ball". The event label ("2025 NCHVC") also comes from the title.

Caching and quota: the Sheets API allows about 300 reads per minute for the whole project, shared by every viewer. The result is cached in localStorage (`…-discovered`) and rebuilt only after 6 hours or with "Update division list" on the Add a division page, never on score refreshes. A localStorage lock keeps two open tabs from both running it. Any failure sets a backoff (`…-backoff`): 10 minutes, and on a 429 doubling up to 2 hours. The cached list stays in use; with no cache the divisions sheet is used, then the built-in list, with a short notice.

The key is restricted by referrer, and browsers send only the domain on cross-site requests by default (which Google rejects). `sheetsApi` sets `referrerPolicy: "no-referrer-when-downgrade"` so the full page URL is sent.

## Divisions sheet (config)

A Google Sheet owned by the user, read on page load and when Refresh is clicked. Header row columns (case-insensitive):

- `Stage`: "Pool play" or "Bracket play". A row with Stage "Event" sets the event label (e.g. "2025 NCHVC").
- `Division`: display name, e.g. "Girls 18U D1 Gold Ball".
- `Link`: the full tab URL as plain text (not a hyperlink with display text).
- `Show`: "No" hides the row.
- Optional filter overrides: `Gender`, `Age`, `Level` (e.g. D1 or D1/D2), `Bracket` (Gold, Silver, Bronze, GBSS). If blank, these are parsed from the Division name.

With discovery on, rows override discovered entries: a row with the same tab link renames it, a row with the same name (Link may be blank) hides it (Show = No) or fixes its tags, and rows matching nothing are added. Without discovery the sheet is the whole list, as before.

The last good config is cached in localStorage; if neither discovery nor the sheet is available, the built-in `DIVISIONS` list in `index.html` is used.

## Pool play sheet layout (parser: `parsePools`)

Parsed by labels, not fixed cell addresses. Per pool:

- "Pool X Schedule" row, then rows with "Match #n", court, time ("4:15 PM" or "Rolling"), team A, "vs", team B.
- "Seed" header row with opponent team names across and a "Sets" column. Each team row: seed number, team, +/-; then 3-column blocks per opponent (diff, team, opponent), with "Set 1"/"Set 2" rows below holding own score and opponent score. Negative numbers appear as "(29)".
- "Pool X Results" row (contains "complete" when final), then "Rank", "Team", "Advancement" header and ranked rows. A long note (e.g. the Team USA advancement rule) may sit in the Rank row.
- Standings are computed from set scores (sets won, point diff) and labeled unofficial until the pool is complete; then the official order and advancement are shown.

## Bracket play sheet layout (parser: `parseBrackets`)

Verified only against "Girls 18u D1" Gold Ball tab (gid 1394730142). Each class (8A, 7A, 6A…) is a 4-team bracket:

- Matches are anchored on the start-time cell ("5:00 pm"), with the day above and court and match name below. Team cells are found above and below in the same column; a team cell has a seed label like "8A #1" in the column to its left.
- The score (e.g. "25-18, 31-29", winner's perspective) is written directly under the winning team. Fallback: a team appearing in the next round is treated as the winner.
- Rounds are ordered by column (rightmost = Final). "Best of 5" note sits above the final's time.
- "... Champions" title cell (champion name 1–3 rows below) defines each bracket. Matches are grouped by the class in their seed labels ("8A #1" goes to 8A); a match with no teams yet joins the closest grouped match. "... Results" and "Winner:" cells use their own label, then the closest match. Nearest title by row is only the last resort.
- "Losing team to" / destination (e.g. "Bronze-8") / team: where the semifinal loser goes.
- "Winner:" / award text (e.g. "Gold Ball & Medals").
- "... Results" row, then "Rank", "Advancement", "Teams" header and ranked rows.

Verified against all eight 2025 "Gold Ball Brackets" tabs (4-team classes in G18u D1; 8-team classes with quarterfinals elsewhere).

Not supported yet (found by discovery, all 2025): Bronze, Silver, GBSS, Gold & Silver, Copper, "Gold"/"Gold Bracket", Iron Finals, Copper Finals, Play-in + Seeding and Seeding + Qualifier tabs. Seen so far: seeds are plain numbers ("1", "4") rather than "8A #1", so no team cell is recognised, and a 3rd-place match shares the final's column. Iron Pools, Copper Pools and Consolation Pool tabs don't parse with `parsePools` either. Discovery drops these tabs; they're listed on the Add a division page.

Before seeding, a bracket tab has no teams, so discovery drops it until the next run after teams appear.

## Features

- Pool play / Bracket play switch; division buttons filtered by Boys or girls, Age group, Division (D1–D4) and Bracket (brackets only). Filters cascade and are remembered per stage.
- Pool pages: standings plus match list with set scores, "Up next", per-match court when a pool uses several courts.
- Bracket pages: champion banner with award, rounds side by side (stacked on phones), loser destinations, results table.
- Follow a team (highlights it and jumps to its pool/bracket), Refresh button, optional auto-refresh every 60 s, highlight of changed cells since last refresh.
- "Add a division" saves only in the current browser; the NCHVC index plus the divisions sheet are the shared source. That page also shows the division list status, the "Update division list" button and the tabs that couldn't be read.

## Conventions

- Keep it a single self-contained `index.html` with no build step; fonts from Google Fonts only.
- Test parser changes against sample CSVs that mirror the real layouts before committing.
- GitHub Pages caches for about 10 minutes; append `?v=N` to the URL to check a fresh copy.
