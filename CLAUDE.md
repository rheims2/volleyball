# NCHVC Results Viewer

A single-page viewer for the NCHVC volleyball Nationals pool play and bracket play results. The tournament keeps results in Google Sheets that we have **view-only** access to; this page reads them live and shows them in a simpler, phone-friendly layout. Hosted on GitHub Pages from this repository.

## Files

- `index.html`: the whole app (HTML, CSS and JS inline). No build step.
- `config.js`: sets `window.VIEWER_CONFIG.divisionsSheet`, the link to the divisions Google Sheet. Kept separate so replacing `index.html` never loses it.

## How data is loaded

- The tournament sheets are shared as "Anyone with the link can view". The page fetches a tab as CSV from `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`, falls back to the gviz CSV endpoint, then to a gviz JSONP script tag (this last one can blank mixed text/number cells because gviz coerces column types).
- Links must include `#gid=` so the right tab is read.
- The public feeds return only displayed cell text, never hyperlink targets. That's why the official "Nationals Bracket Index" sheet can't be used to discover division links automatically. Doing that would need a Google Sheets API key (not set up).
- Claude.ai artifacts block outside network requests, so the page can't be published as an artifact. It must run from a real web host (GitHub Pages).

## Divisions sheet (config)

A Google Sheet owned by the user, read on page load and when Refresh is clicked. Header row columns (case-insensitive):

- `Stage`: "Pool play" or "Bracket play". A row with Stage "Event" sets the event label (e.g. "2025 NCHVC").
- `Division`: display name, e.g. "Girls 18U D1 Gold Ball".
- `Link`: the full tab URL as plain text (not a hyperlink with display text).
- `Show`: "No" hides the row.
- Optional filter overrides: `Gender`, `Age`, `Level` (e.g. D1 or D1/D2), `Bracket` (Gold, Silver, Bronze, GBSS). If blank, these are parsed from the Division name.

The last good config is cached in localStorage; if the sheet can't be read, the built-in `DIVISIONS` list in `index.html` is used.

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

Not yet verified: D1 Bronze, D1 Silver, D1 GBSS tabs and other divisions' bracket tabs. They may be larger brackets or laid out differently. Check each new layout before relying on it.

## Features

- Pool play / Bracket play switch; division buttons filtered by Boys or girls, Age group, Division (D1–D4) and Bracket (brackets only). Filters cascade and are remembered per stage.
- Pool pages: standings plus match list with set scores, "Up next", per-match court when a pool uses several courts.
- Bracket pages: champion banner with award, rounds side by side (stacked on phones), loser destinations, results table.
- Follow a team (highlights it and jumps to its pool/bracket), Refresh button, optional auto-refresh every 60 s, highlight of changed cells since last refresh.
- "Add a division" saves only in the current browser; the divisions sheet is the shared source.

## Conventions

- Keep it a single self-contained `index.html` with no build step; fonts from Google Fonts only.
- Test parser changes against sample CSVs that mirror the real layouts before committing.
- GitHub Pages caches for about 10 minutes; append `?v=N` to the URL to check a fresh copy.
