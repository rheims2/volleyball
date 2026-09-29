// Settings for the NCHVC results viewer.
window.VIEWER_CONFIG = {
  // Your divisions Google Sheet: renames, hides (Show = No) or adds divisions.
  divisionsSheet: "https://docs.google.com/spreadsheets/d/1RtIsoomRwrn-kGPWbcSdB3gV0ZGjVJMQCpMT71Y70DI/edit?usp=sharing",

  // Google Sheets API key, used only to build the division list from the NCHVC
  // index (never for scores). It is public by design: keep it restricted to the
  // Sheets API and to this site's address in Google Cloud Console.
  sheetsApiKey: "AIzaSyBO9bvtoXLMAua2DZyNit1WphNDnh9eGwE",

  // The NCHVC bracket index the division list is built from (now the 2026 Regionals index).
  // Change it when a new index is published, then rebuild the rows on the setup page (the viewer's address plus #setup).
  indexSheet: "https://docs.google.com/spreadsheets/d/1BMqNRKu8dxVG3EzBou6Kv1jYtITo_4baXkJebuHOcbI/edit?gid=760812890#gid=760812890",

  // The club the My teams tab starts on (a visitor can pick another; blank starts on "Pick your club").
  defaultClub: "Des Moines Eclipse",

  // The club's volunteer sign-up sheet, linked as "Volunteer sign-up" in the header.
  // Leave it blank ("") to hide the link.
  volunteerSheet: "https://docs.google.com/spreadsheets/d/1sbBL62yQiCZQ3fAJvgpHHUpHhhvtCe0b9sJsamEXpws/edit?usp=drive_link"
};
