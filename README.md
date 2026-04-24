# MSFS Passenger Map V2.0

A real-time moving map for Microsoft Flight Simulator (MSFS 2020/2024), designed to mimic the passenger information display found on airliners. View your live flight on a 2D map or 3D globe - perfect for a tablet, secondary monitor, or seatback screen experience.

[Flightsim.to](https://flightsim.to/addon/93874/msfs-passenger-map-an-app-that-emulates-a-passenger-information-screen-and-map)

[Github](https://github.com/Inigo2210/MSFS-Passenger-Map)

---

## Features

- **Live aircraft tracking** on a 2D map and 3D globe
- **Great circle route line** between origin and destination airports
- **SimBrief integration** - load your full flight plan with proper waypoints
- **MSFS flight plan import** - import in-game created flight plans (MSFS 2020 only)
- **Flight info bar** - altitude, ground speed, distances, time remaining, ETA, and time elapsed
- **Aircraft hover popup** - tap or hover on the plane icon to see flight number, aircraft type, route, and airline logo (2D map only)
- **Flight info panel** - detailed flight summary with airline logo, aircraft, duration, and scheduled times (SimBrief required)
- **Customizable appearance** - aircraft icons, trail color, route color, line thickness, and 12 icon color options
- **Multi-language support** - 30+ languages
- **PWA support** - installable on phones and tablets for a fullscreen native app feel
- **Auto-cycle zoom** - cycles through zoom levels, with option to only cycle when airborne
- **Day/night shadow overlay** - fully accurate based on sim time and in-sim season
- **Multiple map themes** - OSM, Esri Topographic, Esri NatGeo, Esri World Street, TopPlusOpen, and more
- **Advanced config file** to save certain settings to persist across devices and sessions

---

## Requirements

- Microsoft Flight Simulator 2020 or 2024 (running on the same PC)
- Internet browser (Chrome, Firefox, Edge, Safari, etc.)
- SimConnect - installed automatically, no separate download needed
- [Optional] SimBrief account - for SimBrief route import and flight info panel features
- [Optional] Free [Cesium Ion](https://ion.cesium.com/) account and token - for 3D flight path and terrain in globe view

---

## Installation

### Option A - Download Release (Recommended for most users)

1. Go to the [Releases](https://github.com/Inigo2210/MSFS-Passenger-Map/releases) page
2. Download the latest `.zip` file
3. Extract the folder anywhere (e.g. Desktop or Documents)
4. No further installation needed - everything is included. Skip straight to [Running the App](#running-the-app)

---

### Option B - Run from Source (Developers)

> Ensure Python 3.12+ is installed

**1. Clone the repository**
```
git clone https://github.com/Inigo2210/MSFS-Passenger-Map.git
cd MSFS-Passenger-Map
```

**2. Install Python dependencies**
```
py -m pip install -r requirements.txt
```

**3. Set up airline logos (optional)**

Airline logos are not included in the source code (they are bundled in the release zip). To enable them when running from source:

1. Download from: [Jxck-S/airline-logos on GitHub](https://github.com/Jxck-S/airline-logos/tree/4f7615140127e3f12dd5c1e2789167b0ec4e4c5f/radarbox_banners)
2. Place the contents into: `static/img/airline_logos/`

The app works fully without this, airline logos just won't appear in the info panel.

**4. Configure settings (optional)**

An `advanced_config.txt` is included in the release zip with sensible defaults. When running from source, create your own from the template:
```
copy advanced_config.example.txt advanced_config.txt
```
Edit `advanced_config.txt` with your preferences - see [Configuration](#configuration) for all options.

---

## Running the App

### Using the .exe release:
1. Launch Microsoft Flight Simulator and wait for it to at least reach the menu screen
2. Double-click `MSFS_Passenger_Map.exe`
   - On first launch you may see a Windows Defender / security warning - click **More info → Run anyway**
   - If prompted by Windows Firewall, click **Allow access** (local network only)
3. Open a browser and go to `http://localhost:5000`
4. You may minimize the terminal window, but **it must remain running** for the app to work

### Running from source:
1. Launch Microsoft Flight Simulator
2. Run: `py app.py`
3. Open a browser and go to `http://localhost:5000`

### Accessing on a phone or tablet:
The terminal will print something like:
```
Access on other device: http://XX.XX.X.XXX:5000
```
Open that address in your device's browser while on the same Wi-Fi network.

---

## Using the App

1. Click **Set/Change Route** and enter your origin and destination ICAO codes, or load from SimBrief
2. The map shows your live position, flight trail, and route line
3. Open **Settings** to customize icons, colors, units, language, and more
4. Click **ℹ️** to open the flight info panel and import SimBrief flight details

**Always shown (no route needed):**
- Live aircraft position, altitude, and ground speed
- Live red trail of where you've flown

**Shown when a route or SimBrief plan is loaded:**
- Origin and destination markers with labels
- Great circle arc to destination, or exact waypoint route if loaded from SimBrief
- Distance from origin and to destination
- Estimated time remaining and local times at origin/destination

---

## Views

| View | On the sim PC | On a phone/tablet |
|---|---|---|
| 2D Map | `http://localhost:5000` | `http://[your-local-ip]:5000` |
| 3D Globe | `http://localhost:5000/globe` | `http://[your-local-ip]:5000/globe` |

Use `localhost` on the same PC running MSFS. On any other device (phone, tablet, secondary PC), use the local IP address printed in the terminal window after launching the app - look for the line that says `Access on other device:` and use that exact link.

> The 3D globe is best experienced on a separate device like an iPad. It may lag on the sim PC itself.

---

## Cesium Ion Token

The 3D terrain and flight path feature requires a free personal Cesium Ion token. It is completely free to obtain and only requires creating an account. Follow the steps below to unlock it:

1. Go to [Cesium Ion](https://ion.cesium.com/) and sign up for a free account
2. Copy your default access token from the dashboard
3. Paste the access token next to `cesium_token =` in your `advanced_config.txt` file
4. Restart the app


## Configuration

`advanced_config.txt` is included in the release zip with sensible defaults. If running from source, copy `advanced_config.example.txt` to `advanced_config.txt` first. This file is personal and is never committed to Git.

| Option | Description | Default |
|---|---|---|
| `simbrief_username` | Your SimBrief username — persists across all devices and browsers | _(empty)_ |
| `auto_load_simbrief` | Auto-load SimBrief plan on startup (`yes`/`no`) | `no` |
| `cesium_token` | Your personal Cesium Ion access token — required for 3D flight path and terrain in globe view. Get a free token at [ion.cesium.com](https://ion.cesium.com) | _(empty)_ |
| `msfs_custom_pln_path` | Custom folder path to load MSFS 2020 `.pln` flight plan files from. Supports environment variables e.g. `%USERPROFILE%\FlightPlans`. When set, a "Custom Directory" option appears in the flight plan import tab | _(empty)_ |
| `disable_prompts` | Suppress in-app text input prompts (`yes`/`no`). Only enable if you are having issues with input dialogs | `no` |
| `disableRoutePopup` | Skip the route setup popup that appears on startup (`yes`/`no`) | `no` |
| `custom_zoom_levels` | Comma-separated integers (2–18) to override auto cycle zoom levels. Smaller = zoomed out, larger = zoomed in. A route must be loaded for this to take effect. Example: `4,7,10,14,17` | _(auto)_ |
| `port` | Port number for the local web server. Only change if port 5000 is already in use | `5000` |

> If another app is using port 5000, try changing it to `5050`.
> 
> NOTE: `msfs_custom_pln_path` only supports MSFS 2020 `.pln` files. MSFS 2024 flight plans are not supported.



---

## Troubleshooting and Known Issues:

**Windows security warning on launch:**
Click "More info" → "Run anyway". If still blocked, right-click the .exe → "Run as administrator".

**3D globe is slow or laggy:**
Use it on a separate device (e.g. iPad) rather than the PC running MSFS.

**SimBrief route line pointing to an already-passed waypoint:**
Click the **Trim Waypoint** button to skip past it.

**SimBrief username not remembered across devices:**
Add it to `advanced_config.txt` - this persists across all browsers and devices, unlike browser cookies.

**Local ETA time is inaccurate:**
Known issue when using a sim rate above 1.0x with in-sim time set to match real-world time.

**Port 5000 already in use:**
Change the port in `advanced_config.txt` (e.g. to `5050`).

**Time remaining is not super accurate:**
Limitation of how it's calculated. It is most accruate at cruise level and when route taken is most similar to shortest great circle route. 

**Globe views may be laggy and have performance issues:** 
Depends on device. It is recommended to use globe views on separate device from PC running MSFS. 

**3D terrain and flight path mode is in beta and may have some bugs:**
Most notably, the aircraft icon may appear below the lines, follow aircraft feature may behave strangely when in a tilted view angle, and flight trail does not draw when aircraft is on ground. 

---

## Languages Supported

English, Deutsch, Français, Español, Português, Italiano, Русский, 日本語, 한국어, 简体中文, 繁體中文, 粵語, Polski, Українська, Nederlands, Svenska, Norsk, Dansk, Suomi, Čeština, Magyar, Română, Српски, Türkçe, ქართული, Ελληνικά, עברית, العربية, ไทย, Tiếng Việt, বাংলা, हिन्दी, Tagalog, Bahasa Indonesia, Bahasa Melayu, and more

> Note: Translations were assisted by AI and may not be perfect in all cases.

---

## Changelog

### 2.0
- Added 3D globe view
- [BETA] 3D flight path and terrain in globe view with accurate altitude levels (requires free Cesium Ion token)
- Added MSFS in-game flight plan import (MSFS 2020 only)
- Added time elapsed to flight info bar
- Added option for auto cycle zoom to only activate when airborne
- Added follow re-center delay setting
- Simplified advanced_config.txt

### 1.8
- App no longer crashes when SimConnect data fails to fetch
- Fixed auto zoom not centering correctly on transpacific routes
- Optimized PWA for fullscreen experience on mobile

### 1.7
- Added 8 aircraft icon color options
- Added helicopter icon
- Added day/night shadow overlay based on sim time and season
- Added ETA to info bar with in-sim or real local time options
- Added hide flight info bar toggle and font size control
- Most settings now persist across sessions via browser cookies
- Added custom zoom levels and skip route popup options in advanced config

### 1.6
- Added 3 new map themes
- UI buttons auto-hide after 15s of inactivity
- Added hide UI toggle for a cleaner look
- Added aircraft hover/tap popup with flight info and airline logo
- Added SimBrief username input in settings UI and auto-load option
- Added advanced config file

### 1.5
- Added settings menu with follow aircraft, auto-cycle zoom, icon, color, unit, and language options
- Added flight info panel (SimBrief required)
- Full localization for 34 languages
- Major memory optimizations for long flights

### 1.2
- Added trim waypoint button
- MSFS 2024 beta support
- 30+ language support

### 1.1
- Added SimBrief route import (experimental)
- Added IATA, ICAO, and airport name label options
- Improved time remaining accuracy
- Info bar cycles between metric, imperial, and aviation units

### 1.0
- Initial release

---

## Dependencies

**Python** (see `requirements.txt`):
- `flask` - web server
- `SimConnect` - connects to MSFS via SimConnect API

**JavaScript** (loaded via CDN, no installation needed):
- [Leaflet.js](https://leafletjs.com/) - 2D interactive map
- [CesiumJS](https://cesium.com/platform/cesiumjs/) - 3D globe
- [Leaflet.Geodesic](https://github.com/henrythasler/Leaflet.Geodesic) - great circle route lines

**Data & Assets:**
- [mwgg/Airports](https://github.com/mwgg/Airports) - airport database
- [Jxck-S/airline-logos](https://github.com/Jxck-S/airline-logos/tree/4f7615140127e3f12dd5c1e2789167b0ec4e4c5f/radarbox_banners) - airline logos
- Esri, ArcGIS, OpenStreetMap - map tile providers

**3D Globe Aircraft Models** - see [CREDITS.md](CREDITS.md) for full attributions (all Creative Commons licensed via Sketchfab)

---

## License & Credits

Copyright © 2025 ixvst01 - Released under the MIT License

For bug reports and feature requests, leave a comment or DM on [flightsim.to](https://flightsim.to/addon/93874/msfs-passenger-map-an-app-that-emulates-a-passenger-information-screen-and-map).
