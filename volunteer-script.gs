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
 */
var INFO = ["day", "time", "court", "eclipse team", "team", "home/away", "opponent", "match"];

function norm(v) { return String(v || "").toLowerCase().replace(/pool/g, "").replace(/[^a-z0-9]/g, ""); }

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return reply({ ok: true, message: "Volunteer sign-up is running." }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return reply({ ok: false, error: "busy" });
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var name = String(req.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name) return reply({ ok: false, error: "name" });
    // A leading = + - @ would make the cell a formula
    if (/^[=+\-@]/.test(name)) name = "'" + name;

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

    for (var r = h + 1; r < data.length; r++) {
      if (norm(data[r][mc]) !== norm(req.match)) continue;
      if (tc >= 0 && String(data[r][tc]).trim() !== String(req.team || "").trim()) continue;
      var cur = String(data[r][rc]).trim();
      if (/^n\/?a$/i.test(cur)) return reply({ ok: false, error: "notneeded", value: "N/A" });
      if (cur) return reply({ ok: false, error: "taken", value: cur });
      sheet.getRange(r + 1, rc + 1).setValue(name);
      return reply({ ok: true });
    }
    return reply({ ok: false, error: "nogame" });
  } catch (err) {
    return reply({ ok: false, error: "script" });
  } finally {
    lock.releaseLock();
  }
}
