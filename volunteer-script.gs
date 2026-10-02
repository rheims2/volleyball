/**
 * Volunteer sign-ups for the NCHVC results viewer.
 *
 * Paste this into the volunteer sheet (Extensions > Apps Script), then Deploy > New deployment >
 * Web app, Execute as: Me, Who has access: Anyone. Put the web app URL in config.js as
 * volunteerScript.
 *
 * The viewer sends { match, team, role, name }. The script finds the row whose Match and
 * Eclipse Team match, and writes the name into that job's column only if the cell is empty,
 * so nobody can overwrite or clear a sign-up from the page. "N/A" cells are jobs that team
 * doesn't cover and are never filled.
 *
 * For a game that isn't in the sheet yet (bracket games, say), the viewer first sends
 * { action: "add", rows: [{ day, time, court, team, side, opp, match, cells: { job: "" or "N/A" } }] }.
 * Each row is appended unless the sheet already has that Match and Eclipse Team; job cells can
 * only be blank or "N/A", so adding a row never signs anyone up. The answer lists the rows as
 * they are in the sheet afterwards. A sign-up can carry the same rows as `add` (one request
 * instead of two): they're appended first when the game isn't in the sheet.
 *
 * Removing a sign-up: { action: "remove", match, team, role, current } clears the cell when it still
 * holds that name (the page asks for confirmation first). A different name in the cell (it was
 * changed since the page loaded) is left alone and answered with "changed".
 *
 * After changing this code: Deploy > Manage deployments > edit (pencil) > Version: New version >
 * Deploy. That keeps the same web app URL.
 */
var INFO = ["day", "time", "court", "eclipse team", "team", "home/away", "opponent", "match"];

function norm(v) { return String(v || "").toLowerCase().replace(/pool/g, "").replace(/[^a-z0-9]/g, ""); }

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return reply({ ok: true, message: "Volunteer sign-up is running." }); }

function clean(v, max) {
  var s = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 80);
  // A leading = + - @ would make the cell a formula
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// Appends the game's rows that aren't in the sheet yet; null when the request is malformed
function appendRows(sheet, data, h, head, rows) {
  var col = function (name) { return head.indexOf(name); };
  var mc = col("match"), tc = col("eclipse team") >= 0 ? col("eclipse team") : col("team");
  if (!Array.isArray(rows) || !rows.length || rows.length > 2) return null;
  var out = [];
  rows.forEach(function (r) {
    if (!r || !clean(r.match) || !clean(r.team)) return;
    var found = null;
    for (var i = h + 1; i < data.length && !found; i++) {
      if (norm(data[i][mc]) === norm(r.match) && String(data[i][tc]).trim() === clean(r.team)) found = data[i];
    }
    if (!found) {
      found = head.map(function (hd) {
        switch (hd) {
          case "day": return clean(r.day, 20);
          case "time": return clean(r.time, 30);
          case "court": return clean(r.court, 30);
          case "eclipse team": case "team": return clean(r.team, 20);
          case "home/away": return /^home$/i.test(r.side) ? "Home" : "Away";
          case "opponent": return clean(r.opp, 60);
          case "match": return clean(r.match, 60);
          default:
            if (!hd || INFO.indexOf(hd) >= 0) return "";
            var cells = r.cells || {}, v = "";
            Object.keys(cells).forEach(function (k) { if (k.trim().toLowerCase() === hd) v = cells[k]; });
            return /^n\/?a$/i.test(String(v).trim()) ? "N/A" : "";   // never a name
        }
      });
      sheet.appendRow(found);
      data.push(found.map(String));
    }
    var cellsOut = {};
    head.forEach(function (hd, c) { if (hd && INFO.indexOf(hd) < 0) cellsOut[data[h][c].trim()] = String(found[c]).trim(); });
    out.push({ day: String(found[col("day")] || ""), time: String(found[col("time")] || ""), court: String(found[col("court")] || ""),
      team: String(found[tc]).trim(), side: String(found[col("home/away")] || ""), opp: String(found[col("opponent")] || ""),
      match: String(found[mc]).trim(), cells: cellsOut });
  });
  return out;
}

function addRows(sheet, data, h, head, rows) {
  var out = appendRows(sheet, data, h, head, rows);
  return reply(out ? { ok: true, rows: out } : { ok: false, error: "rows" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return reply({ ok: false, error: "busy" });
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (req.action === "add") {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var dat = sh.getDataRange().getDisplayValues();
      var hh = -1;
      for (var k = 0; k < dat.length && hh < 0; k++) {
        if (dat[k].some(function (v) { return String(v).trim().toLowerCase() === "match"; })) hh = k;
      }
      if (hh < 0) return reply({ ok: false, error: "nomatchcolumn" });
      return addRows(sh, dat, hh, dat[hh].map(function (v) { return String(v).trim().toLowerCase(); }), req.rows);
    }
    var remove = req.action === "remove";
    var name = clean(req.name, 60);
    if (!name && !remove) return reply({ ok: false, error: "name" });
    if (remove && !req.current) return reply({ ok: false, error: "current" });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data = sheet.getDataRange().getDisplayValues();
    var h = -1;
    for (var i = 0; i < data.length && h < 0; i++) {
      if (data[i].some(function (v) { return String(v).trim().toLowerCase() === "match"; })) h = i;
    }
    if (h < 0) return reply({ ok: false, error: "nomatchcolumn" });
    var head = data[h].map(function (v) { return String(v).trim().toLowerCase(); });
    var mc = head.indexOf("match");
    var tc = head.indexOf("eclipse team") >= 0 ? head.indexOf("eclipse team") : head.indexOf("team");
    var role = String(req.role || "").trim().toLowerCase();
    var rc = head.indexOf(role);
    if (rc < 0 || INFO.indexOf(role) >= 0) return reply({ ok: false, error: "role" });

    var find = function () {
      for (var r = h + 1; r < data.length; r++) {
        if (norm(data[r][mc]) !== norm(req.match)) continue;
        if (tc >= 0 && String(data[r][tc]).trim() !== String(req.team || "").trim()) continue;
        return r;
      }
      return -1;
    };
    var r = find();
    // A game not in the sheet yet: add its rows first (appended rows land at the end of data)
    if (r < 0 && req.add) { appendRows(sheet, data, h, head, req.add); r = find(); }
    if (r < 0) return reply({ ok: false, error: "nogame" });
    var cur = String(data[r][rc]).trim();
    if (remove) {
      if (!cur) return reply({ ok: true });   // already empty
      if (/^n\/?a$/i.test(cur)) return reply({ ok: false, error: "notneeded", value: "N/A" });
      // only the name the page showed (a leading ' added against formulas isn't part of it)
      if (cur !== String(req.current || "").replace(/^'/, "").trim()) return reply({ ok: false, error: "changed", value: cur });
      sheet.getRange(r + 1, rc + 1).setValue("");
      return reply({ ok: true });
    }
    if (/^n\/?a$/i.test(cur)) return reply({ ok: false, error: "notneeded", value: "N/A" });
    if (cur) return reply({ ok: false, error: "taken", value: cur });
    sheet.getRange(r + 1, rc + 1).setValue(name);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: "script" });
  } finally {
    lock.releaseLock();
  }
}
