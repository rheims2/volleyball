// Settings for the NCHVC results viewer.
window.VIEWER_CONFIG = {
  // Your divisions Google Sheet: renames, hides (Show = No) or adds divisions.
  divisionsSheet: "https://docs.google.com/spreadsheets/d/1RtIsoomRwrn-kGPWbcSdB3gV0ZGjVJMQCpMT71Y70DI/edit?usp=sharing",

  // Google Sheets API key, used only to build the division list from the NCHVC
  // index (never for scores). It is public by design: keep it restricted to the
  // Sheets API and to this site's address in Google Cloud Console.
  sheetsApiKey: "AIzaSyBO9bvtoXLMAua2DZyNit1WphNDnh9eGwE",

  // The official "Nationals Bracket Index". Change it when a new year's index is published.
  indexSheet: "https://docs.google.com/spreadsheets/d/1ONzz5XqL-buAxvHXNHfuTRtDayzaM10Cy7KlOdt5GL0/edit?gid=1891963095#gid=1891963095"
};
