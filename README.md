# 🔒 Awareness OS

A private, client-side, local-first dashboard built to track health and wealth metrics. This dashboard is hosted via GitHub Pages and pulls data directly from private Google Sheets using your active browser session via client-side Google OAuth2.

## Security Posture
The website layout is hosted publicly, but all data remains 100% private. The application contains no embedded database or server keys. Charts and tables will render completely blank unless explicitly authenticated via the authorized Google Account. If unauthenticated, the Google Sheets API blocks data transfer (401).

## Core Structure
* `index.html` - The structural presentation layout skeleton.
* `config.json` - Custom environment config storing private Sheet coordinates and Client IDs.
* `assets/` - Internal engine architecture, chart processors, and media elements.
