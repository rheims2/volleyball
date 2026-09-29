// Settings for the NCHVC results viewer.
window.VIEWER_CONFIG = {
  // Your divisions Google Sheet: renames, hides (Show = No) or adds divisions.
  divisionsSheet: "https://docs.google.com/spreadsheets/d/1RtIsoomRwrn-kGPWbcSdB3gV0ZGjVJMQCpMT71Y70DI/edit?usp=sharing",

  // Google Sheets API key, used only to build the division list from the NCHVC
  // index (never for scores). It is public by design: keep it restricted to the
  // Sheets API and to this site's address in Google Cloud Console.
  sheetsApiKey: "AIzaSyBO9bvtoXLMAua2DZyNit1WphNDnh9eGwE",

  // The NCHVC bracket index the division list is built from (now the 2026 Regionals index).
  // Change it when a new index is published, then rebuild the rows on the Add a division page.
  indexSheet: "https://docs.google.com/spreadsheets/d/1BMqNRKu8dxVG3EzBou6Kv1jYtITo_4baXkJebuHOcbI/edit?gid=760812890#gid=760812890"
};
