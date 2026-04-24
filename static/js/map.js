
    const esriImagery = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri'
        });

    const esriLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Labels © Esri'
        });

    const openTopoMap = L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data © OpenTopoMap contributors'
        });

    const streetMap = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data © OpenStreetMap contributors'
        });
const osmHOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OSM Team'
});
const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Topographic'
});
const topPlusOpenColor = L.tileLayer(
  'http://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png', {
    attribution: '&copy; <a href="https://gdz.bkg.bund.de/">BKG (Germany)</a>'
});
const esriWorldStreetMap = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, etc.'
});
const esriNatGeoWorldMap = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
    maxZoom: 16
});

    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});
const SPEED_BUFFER_SIZE = 5;
let groundSpeedBuffer = [];
const AIRBORNE_SPEED_THRESHOLD_KTS = 50;
const AIRBORNE_AGL_THRESHOLD_FT    = 50;
let _timerAccumSec  = 0;
let _timerLastSec   = null;
let _timerAirborne  = false;

function formatElapsed(totalSec) {
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

function updateFlightTimer(data) {
  const agl    = data && data.ground_alt != null ? data.ground_alt : null;
  const spd    = (data && data.ground_speed) ? data.ground_speed : 0;
  const simSec = (data && data.sim_time_seconds != null) ? data.sim_time_seconds : null;

  const airborne = (agl === null || agl > AIRBORNE_AGL_THRESHOLD_FT) &&
                   spd > AIRBORNE_SPEED_THRESHOLD_KTS;

  if (airborne && simSec !== null) {
    if (_timerLastSec !== null) {
      let delta = simSec - _timerLastSec;
      if (delta < 0) delta += 86400;
      if (delta < 10) _timerAccumSec += delta;
    }
    _timerLastSec  = simSec;
    _timerAirborne = true;
  } else {
    _timerLastSec  = null;
    _timerAirborne = false;
  }

  const el = document.getElementById('timeElapsed');
  if (el) el.textContent = _timerAccumSec > 0 ? formatElapsed(_timerAccumSec) : '--:--';
}

function resetFlightTimer() {
  _timerAccumSec  = 0;
  _timerLastSec   = null;
  _timerAirborne  = false;
  const el = document.getElementById('timeElapsed');
  if (el) el.textContent = '--:--';
}



let unitSystem = "auto";

const unitPresets = {
  auto: null,
  imperial: { distance: 'mi', altitude: 'ft', speed: 'mph' },
  metric:   { distance: 'km', altitude: 'm', speed: 'kmh' },
  aviation: { distance: 'nm', altitude: 'ft', speed: 'kts' }
};

const unitModes = {
  distance: ['nm', 'mi', 'km'],
  altitude: ['ft', 'm'],
  speed: ['kts', 'mph', 'kmh']
};
let dayNightGroup = null;
let dayNightEnabled = localStorage.getItem("dayNightEnabled") === "true";



let currentUnits = {
  distance: 0,
  altitude: 0,
  speed: 0
};

const autoPresets = [
  { distance: 'nm', altitude: 'ft', speed: 'kts' },
  { distance: 'mi', altitude: 'ft', speed: 'mph' },
  { distance: 'km', altitude: 'm', speed: 'kmh' }
];

let cityLabelScale = parseFloat(localStorage.getItem("cityLabelScale")) || 1.0;
let autoIndex = 0;
let etaMode = localStorage.getItem("etaMode") || "dest";
let simRate = 1.0
setInterval(() => {
  if (unitSystem !== 'auto') return;

  autoIndex = (autoIndex + 1) % autoPresets.length;
  const preset = autoPresets[autoIndex];

  currentUnits = {
    distance: unitModes.distance.indexOf(preset.distance),
    altitude: unitModes.altitude.indexOf(preset.altitude),
    speed: unitModes.speed.indexOf(preset.speed)
  };
}, 15000);


function updateUnitSystem() {
  const select = document.getElementById("unitSystemSelect");
  if (!select) return;

  const selected = select.value;
  unitSystem = selected;

  localStorage.setItem("unitSystem", selected);

  if (unitSystem === 'auto') {
    return;
  }

  const preset = unitPresets[unitSystem];
  if (!preset) return;

  currentUnits = {
    distance: unitModes.distance.indexOf(preset.distance),
    altitude: unitModes.altitude.indexOf(preset.altitude),
    speed: unitModes.speed.indexOf(preset.speed)
  };
}


function convertDistance(nm) {
  switch (unitModes.distance[currentUnits.distance]) {
    case 'mi': return nm * 1.15078;
    case 'km': return nm * 1.852;
    default: return nm;
  }
}

function convertAltitude(ft) {
  return unitModes.altitude[currentUnits.altitude] === 'm' ? ft * 0.3048 : ft;
}

function convertSpeed(kts) {
  switch (unitModes.speed[currentUnits.speed]) {
    case 'mph': return kts * 1.15078;
    case 'kmh': return kts * 1.852;
    default: return kts;
  }
}

    const map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        worldCopyJump: true,
        layers: [esriImagery, esriLabels]
    });



map.createPane('dayNightPane');
map.getPane('dayNightPane').style.zIndex = 250;
map.getPane('dayNightPane').style.pointerEvents = 'none';

const baseMaps = {
  "🛰️ Esri Satellite": esriImagery,
  "🌄 OpenTopoMap": openTopoMap,
  "🛣️ Street Map": streetMap,
  "💡 Carto Light": cartoLight,
  "🌙 Carto Dark": cartoDark,
  "🌍 OSM Humanitarian": osmHOT,
  "🗺️ Esri Topographic": esriTopo,
  "🗺️ Esri NatGeo": esriNatGeoWorldMap,
  "🛣️ Esri World Street": esriWorldStreetMap,
  "🌐 TopPlusOpen (DE)": topPlusOpenColor
  // "Stamen Toner": stamenToner

};

    const overlays = {
        "🛰️ Labels (for Satellite)": esriLabels
    };

    L.control.layers(baseMaps, overlays).addTo(map);
const savedTheme = localStorage.getItem("mapTheme");

Object.values(baseMaps).forEach(layer => {
  if (map.hasLayer(layer)) map.removeLayer(layer);
});

if (savedTheme && baseMaps[savedTheme]) {
  map.addLayer(baseMaps[savedTheme]);
  currentBaseLayer = baseMaps[savedTheme];
  console.log("[Map Theme] Restored saved theme:", savedTheme);
} else {
  map.addLayer(esriImagery);
  currentBaseLayer = esriImagery;
  console.log("[Map Theme] Defaulted to Esri Satellite.");
}

const labelCheckbox = document.querySelector('.leaflet-control-layers-overlays input[type=checkbox]');
if (savedTheme === "🛰️ Esri Satellite") {
  if (labelCheckbox) {
    labelCheckbox.disabled = false;
    labelCheckbox.checked = true;
  }
  if (!map.hasLayer(esriLabels)) {
    map.addLayer(esriLabels);
  }
} else {
  if (map.hasLayer(esriLabels)) map.removeLayer(esriLabels);
  if (labelCheckbox) {
    labelCheckbox.disabled = true;
    labelCheckbox.checked = false;
  }
}

    map.on('zoomend', adjustLabelSizes);

window.addEventListener("load", () => {
    const labelCheckbox = document.querySelector('.leaflet-control-layers-overlays input[type=checkbox]');
    if (labelCheckbox && !map.hasLayer(esriImagery)) {
        labelCheckbox.disabled = true;
        labelCheckbox.checked = false;
    }
    adjustLabelSizes();

  const savedLang = localStorage.getItem('selectedLanguage') || 'en';
  const dropdown = document.getElementById('languageSelect');

  if (dropdown) {
    dropdown.value = savedLang;

    dropdown.addEventListener("change", (e) => {
      const lang = e.target.value;
      localStorage.setItem("selectedLanguage", lang);
      setLanguage(lang, 1);
    });
  }

  setLanguage(savedLang, 1)
  // Load auto-save trail preference
 /*  const savedToggle = localStorage.getItem("trailAutoSaveEnabled");
  trailAutoSaveEnabled = savedToggle === "true";
  // document.getElementById("trailSaveToggle").checked = trailAutoSaveEnabled;
  //  const savedTrail = localStorage.getItem("savedTrail");
if (savedTrail) {
  try {
    const parsed = JSON.parse(savedTrail);
    const ageHours = ((Date.now() - parsed.savedAt) / (1000 * 60)).toFixed(1);
    if (ageHours > 60) {
      localStorage.removeItem("savedTrail");
      console.log("[Trail] Expired saved trail removed on load.");
    }
  } catch (e) {
    localStorage.removeItem("savedTrail"); // safety fallback
    console.warn("[Trail] Corrupted saved trail removed.");
  }
}
*/

fitButtonText("setRouteBtn");
fitButtonText("reloadBtn");
fitButtonText("trimWaypointBtn");
window.scrollTo(0, 0);
  trailCoordinates = [];
  trailLines.forEach(line => {
    if (map.hasLayer(line)) map.removeLayer(line);
  });
  trailLines = [];

  planeMarkers.forEach(marker => {
    if (map.hasLayer(marker)) map.removeLayer(marker);
  });
  planeMarkers = [];

  liveArcLines.forEach(line => {
    if (map.hasLayer(line)) map.removeLayer(line);
  });
  liveArcLines = [];

  lastArcStart = null;
  initInfoBarSetting();
});


const ICON_COLORS = [
  'black', 'white', 'grey',
  'red', 'orange', 'yellow',
  'green', 'lightGreen',
  'blue', 'lightBlue',
  'purple', 'pink'
];


let aircraftIconBase  = (localStorage.getItem('aircraftIconBase')  || 'plane_icon')
  .replace(/\.png$/,'')
  .replace(/_(?:black|white|red|orange|yellow|green|blue|pink)$/,'');
let aircraftIconColor = localStorage.getItem('aircraftIconColor') || 'black';
if (!ICON_COLORS.includes(aircraftIconColor)) aircraftIconColor = 'black';

function getAircraftIconPath() {
  const base  = (aircraftIconBase || 'plane_icon')
    .replace(/\.png$/,'')
    .replace(/_(?:black|white|red|orange|yellow|green|blue|pink)$/,'');
  const color = ICON_COLORS.includes(aircraftIconColor) ? aircraftIconColor : 'black';
  return `/static/img/${base}_${color}.png`;
}

function createRotatedPlaneIcon(heading) {
  const iconPath = getAircraftIconPath();
  return L.divIcon({
    className: 'plane-icon-wrapper',
    html: `
      <img src="${iconPath}"
           class="plane-img"
           style="transform: rotate(${heading}deg); width: 40px; height: 40px;">
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}



function updateAircraftIcon() {
  const select = document.getElementById("iconSelect");
  if (select) {
    const raw = select.value || 'plane_icon';
    aircraftIconBase = raw
      .replace(/\.png$/,'')
      .replace(/_(?:black|white|red|orange|yellow|green|blue|pink)$/,'');
    localStorage.setItem('aircraftIconBase', aircraftIconBase);
  }
  if (lastKnownPosition) {
    updatePlaneIcon(lastKnownPosition.lat, lastKnownPosition.lon, lastKnownPosition.heading || 0);
  }
}

function updateAircraftIconColor(newColor) {
  aircraftIconColor = ICON_COLORS.includes(newColor) ? newColor : 'black';
  localStorage.setItem('aircraftIconColor', aircraftIconColor);
  if (lastKnownPosition) {
    updatePlaneIcon(lastKnownPosition.lat, lastKnownPosition.lon, lastKnownPosition.heading || 0);
  }
}

function initIconColorPicker() {
  const container = document.getElementById("iconColorContainer");
  if (!container) return;

  const colors = [
    { name: "black", hex: "#000000" },
    { name: "white", hex: "#ffffff" },
    { name: "grey", hex: "#999999" },
    { name: "red", hex: "#ff0000" },
    { name: "orange", hex: "#ffa200" },
    { name: "yellow", hex: "#Fff034" },
    { name: "green", hex: "#138d1d" },
    { name: "lightGreen", hex: "#55ff00" },
    { name: "blue", hex: "#0b5394" },
    { name: "lightBlue", hex: "#00ffff" },
    { name: "purple", hex: "#bc01e9" },
    { name: "pink", hex: "#ff00b4" }
  ];

  const savedColor = localStorage.getItem("aircraftIconColor") || "black";

  container.innerHTML = "";
  colors.forEach(color => {
    const circle = document.createElement("div");
    circle.className = "color-option";
    circle.style.backgroundColor = color.hex;
    if (color.name === savedColor) circle.classList.add("selected");
    circle.dataset.color = color.name;

    circle.addEventListener("click", () => {
      document.querySelectorAll(".color-option").forEach(opt => opt.classList.remove("selected"));
      circle.classList.add("selected");

      localStorage.setItem("aircraftIconColor", color.name);
      aircraftIconColor = color.name;
      updateAircraftIcon();
    });

    container.appendChild(circle);
  });
}

    let trailCoordinates = [];
    let trailPolyline = null;
	let liveArcLines = [];
    let planeMarkers = [];
    let currentRoute = null;
    let routeMarkers = [];
    let routeLine = null;
    let lastArcStart = null;
    let remainingSimBriefWaypoints = [];
    let cycleZoomActive = false;
let cycleZoomAirborneOnly = localStorage.getItem("cycleZoomAirborneOnly") === "true";
let cycleZoomInterval = null;
let zoomLevels = [2, 4, 6, 8, 10];
let currentZoomIndex = 0;
let cycleZoomSpeed = 15000;
let debugPanelVisible = false;
let trailColor = localStorage.getItem("trailColor") || "#ff0000";
let routeLineColor = localStorage.getItem("routeLineColor") || "#ff0000";
let lineThickness = parseInt(localStorage.getItem("lineThickness")) || 3;
let followPlane = localStorage.getItem("followPlane") === "true";
let followRecenterDelay = parseInt(localStorage.getItem("followRecenterDelay")) || 100;
let lastManualMapMove = 0;



let debugStats = {
  trailRedraws: 0,
  arcRedraws: 0,
  lastTrailDraw: null,
  lastArcDraw: null
};
let simconnectAvailable = false;
let currentLabelType = "city";
let currentFPS = "--";
let currentMemory = "--";
let lastMapResponseTime = "--";
setupMapInteractionTiming(map);
let trailLines = [];
let staticTrailLines = [null, null, null]; // main, -360, +360
let lastTrailLon = null;
let lastLonForIDL = null;
let IDL_reset = 0;
let trailAutoSaveEnabled = false;
let lastTrailSaveTime = 0;
const TRAIL_SAVE_INTERVAL_MS = 60000;



function checkIDLReset(currentLon) {
  if (lastLonForIDL !== null) {
    const delta = Math.abs(currentLon - lastLonForIDL);

    if (delta > 359.8) {
      IDL_reset = 1;
      console.log("IDL crossing detected! Reset triggered.");
    }
  }

  lastLonForIDL = currentLon;
}

function updateLabelType() {
  const select = document.getElementById("labelTypeSelect");
  if (!select) return;

  currentLabelType = select.value;

  if (currentRoute) {
    currentRoute.labelType = currentLabelType;
    drawRouteMarkers();
  }
}

function updateColorSettings() {
  const trailInput = document.getElementById("trailColorPicker");
  const routeInput = document.getElementById("routeColorPicker");

  if (trailInput) {
    trailColor = trailInput.value;
    localStorage.setItem("trailColor", trailColor);
  }
  if (routeInput) {
    routeLineColor = routeInput.value;
    localStorage.setItem("routeLineColor", routeLineColor);
  }

  redrawFlightTrail();
   updateTrailStyle();

  if (currentRoute?.simbriefWaypoints) {
    drawSimBriefArc();
  } else if (currentRoute?.destination && lastKnownPosition) {
    drawLiveGreatCircle(lastKnownPosition.lat, lastKnownPosition.lon, true);
  }
}

function updateZoomLevelsFromRoute(origin, destination) {
  function unwrapLon(lon, refLon) {
    let x = lon;
    while (x - refLon > 180) x -= 360;
    while (x - refLon < -180) x += 360;
    return x;
  }

  try {
    const customLevelsStr = localStorage.getItem("customZoomLevels");
    if (customLevelsStr) {
      const customLevels = JSON.parse(customLevelsStr)
        .filter(z => typeof z === "number" && z >= 2 && z <= 18)
        .sort((a, b) => a - b);

      if (customLevels.length > 0) {
        zoomLevels = customLevels;
        console.log("[ZoomCycle] Using custom zoom levels from config:", zoomLevels);
        return;
      }
    }
  } catch (e) {
    console.warn("[ZoomCycle] Invalid custom zoom levels, falling back to auto.");
  }

  if (!map || !origin || !destination) return;

  const savedCustom = JSON.parse(localStorage.getItem("customZoomLevels") || "null");
  if (Array.isArray(savedCustom) && savedCustom.length > 0) {
    zoomLevels = savedCustom;
    console.log("[ZoomCycle] Using custom levels from advanced config:", zoomLevels);
    return;
  }

  const oLon = origin.lon;
  const dLon = unwrapLon(destination.lon, oLon);

  const bounds = L.latLngBounds([
    [origin.lat, oLon],
    [destination.lat, dLon]
  ]);

  const paddedBounds = bounds.pad(0.05);
  const maxZoomOut = map.getBoundsZoom(paddedBounds, false);

  const minZoom = Math.max(2, Math.floor(maxZoomOut));
  const maxZoom = Math.min(17, minZoom + 4);

  const step = Math.max(1, Math.floor((maxZoom - minZoom) / 4));
  zoomLevels = Array.from({ length: 5 }, (_, i) => minZoom + i * step);

  console.log("[ZoomCycle] Auto-computed zoom levels:", zoomLevels);
}



function translate(key) {
  const lang = localStorage.getItem("selectedLanguage") || "en";
  return translations?.[lang]?.[key] || translations.en?.[key] || key;
}

function getRouteMidpoint() {
  if (!currentRoute?.origin || !currentRoute?.destination) return map.getCenter();

  const o = currentRoute.origin;
  const d = currentRoute.destination;

  const dLon = unwrapLon(d.lon, o.lon);
  const midLat = (o.lat + d.lat) / 2;
  const midLon = wrapLon((o.lon + dLon) / 2);

  return L.latLng(midLat, midLon);
}


function toggleCycleZoom() {
  const checkbox = document.getElementById("cycleZoomToggle");
  if (checkbox) {
    localStorage.setItem("cycleZoomEnabled", checkbox.checked ? "true" : "false");
  }

  if (!checkbox) return;

  cycleZoomActive = checkbox.checked;

  const speedDropdown = document.getElementById("zoomSpeedSelect");
  if (speedDropdown) {
    speedDropdown.disabled = !cycleZoomActive;
  }
  const airborneOnlyCb = document.getElementById("cycleZoomAirborneOnly");
  if (airborneOnlyCb) airborneOnlyCb.disabled = !cycleZoomActive;

  clearInterval(cycleZoomInterval);
  cycleZoomInterval = null;

  if (cycleZoomActive) {
    currentZoomIndex = 0;

    cycleZoomInterval = setInterval(() => {
      if (zoomLevels.length === 0) return;

      if (cycleZoomAirborneOnly && !_timerAirborne) return;
      currentZoomIndex = (currentZoomIndex + 1) % zoomLevels.length;
      const zoom = zoomLevels[currentZoomIndex];

const center = (currentZoomIndex === 0 && followPlane && currentRoute)
  ? getRouteMidpoint()
  : (followPlane && lastKnownPosition)
    ? L.latLng(lastKnownPosition.lat, lastKnownPosition.lon)
    : map.getCenter();

      _programmaticZoom = true;
      map.setView(center, zoom, { animate: true });
      setTimeout(() => { _programmaticZoom = false; }, 500);
    }, cycleZoomSpeed);

  } else {
  }
}


function updateZoomSpeed() {
  const select = document.getElementById("zoomSpeedSelect");
  if (!select) return;

  const speed = select.value;

  localStorage.setItem("zoomCycleSpeed", speed);

  switch (speed) {
    case 'fast':
      cycleZoomSpeed = 5000;
      break;
    case 'slow':
      cycleZoomSpeed = 30000;
      break;
    default:
      cycleZoomSpeed = 15000;
  }

  if (cycleZoomActive) {
    clearInterval(cycleZoomInterval);
    toggleCycleZoom();
  }
}


function toggleCycleZoomAirborneOnly() {
  const cb = document.getElementById("cycleZoomAirborneOnly");
  cycleZoomAirborneOnly = cb ? cb.checked : !cycleZoomAirborneOnly;
  localStorage.setItem("cycleZoomAirborneOnly", cycleZoomAirborneOnly ? "true" : "false");
}

function toggleFollowPlane() {
  const checkbox = document.getElementById("followToggle");
  if (!checkbox) return;

  followPlane = checkbox.checked;
  localStorage.setItem("followPlane", followPlane);
  console.log("Follow mode:", followPlane ? "ON" : "OFF");

  const delaySelect = document.getElementById("followDelaySelect");
  if (delaySelect) {
    delaySelect.disabled = !followPlane;
  }
}

function updateFollowDelay() {
  const select = document.getElementById("followDelaySelect");
  if (!select) return;

  followRecenterDelay = parseInt(select.value) || 8000;
  localStorage.setItem("followRecenterDelay", followRecenterDelay);
}

function updatePlaneIcon(lat, lon, heading) {
    planeMarkers.forEach(marker => map.removeLayer(marker));
    planeMarkers = [];

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const longitudes = [lon, lon - 360, lon + 360];

    longitudes.forEach(adjLon => {
        const marker = L.marker([lat, adjLon], {
            icon: createRotatedPlaneIcon(heading)
        }).addTo(map);

        if (isTouchDevice) {
            let lastTapTime = 0;

            marker.on('click', () => {
                const now = Date.now();
                const timeSinceLastTap = now - lastTapTime;

                if (timeSinceLastTap < 400) {

                    toggleInfoPanel();

                    if (!window.simbriefFlightInfo && currentRoute) {
                        importSimbriefToInfoPanel();
                    }
                } else {

                    showAircraftHoverPopup(marker);

                    if (hoverPopupTimeout) clearTimeout(hoverPopupTimeout);
                    hoverPopupTimeout = setTimeout(() => {
                        map.closePopup(aircraftInfoPopup);
                    }, 5000);
                }

                lastTapTime = now;
            });
        } else {
            attachAircraftHoverEvents(marker);

            marker.on('click', () => {
                toggleInfoPanel();

                if (!window.simbriefFlightInfo && currentRoute) {
                    importSimbriefToInfoPanel();
                }
            });
        }

        planeMarkers.push(marker);
    });
}



function clearLiveGreatCircle() {
    liveArcLines.forEach(line => {
        if (map.hasLayer(line)) map.removeLayer(line);
    });
    liveArcLines = [];
}

function redrawFlightTrail() {
  if (!trailCoordinates || trailCoordinates.length === 0) return;

  if (trailPolyline) {
    map.removeLayer(trailPolyline);
    trailPolyline = null;
  }

  const segments = [
    trailCoordinates,
    trailCoordinates.map(([lat, lon]) => [lat, lon - 360]),
    trailCoordinates.map(([lat, lon]) => [lat, lon + 360])
  ];

  const lines = segments.map(segment =>
    L.polyline(segment, {
      color: trailColor,
      weight: lineThickness,
      opacity: 1
    })
  );

  trailPolyline = L.layerGroup(lines).addTo(map);
  debugStats.trailRedraws++;
debugStats.lastTrailDraw = new Date().toLocaleTimeString();
}
function updateEtaMode() {
  const select = document.getElementById("etaModeSelect");
  if (!select) return;
  etaMode = select.value;
  localStorage.setItem("etaMode", etaMode);
}

function updateTrailStyle() {
  staticTrailLines.forEach(line => {
    if (line) {
      line.setStyle({
        color: trailColor,
        weight: lineThickness,
        opacity: 1,
      });
    }
  });

  trailLines.forEach(line => {
    if (line) {
      line.setStyle({
        color: trailColor,
        weight: lineThickness,
        opacity: 1
      });
    }
  });
}

function drawLiveGreatCircle(currentLat, currentLon, forceRedraw = false) {
    if (!currentRoute?.destination) {
        console.log("[Live Arc] No destination set — skipping.");
        return;
    }


    if (Math.abs(currentLat) < 0.1 && Math.abs(currentLon) < 0.1) {
        console.log("[Live Arc] Coordinates too close to (0,0) — skipping.");
        return;
    }

    const startKey = `${currentLat.toFixed(4)}:${currentLon.toFixed(4)}`;
    if (!forceRedraw && lastArcStart && startKey === lastArcStart) {
        return;
    }
    lastArcStart = startKey;
    document.getElementById('trimWaypointBtn').style.display = 'none';
    console.log("[Live Arc] Drawing from", currentLat, currentLon, "to", currentRoute.destination.lat, currentRoute.destination.lon);
    if (routeLine && map.hasLayer(routeLine)) {
    map.removeLayer(routeLine);
    routeLine = null;
}

    liveArcLines.forEach(line => {
        if (map.hasLayer(line)) map.removeLayer(line);
    });
    liveArcLines = [];

    const arcPoints = fixIDL(generateGreatCircle(
        { lat: currentLat, lon: currentLon },
        currentRoute.destination
    ));

    const allArcs = [
        arcPoints,
        arcPoints.map(([lat, lon]) => [lat, lon - 360]),
        arcPoints.map(([lat, lon]) => [lat, lon + 360])
    ];

    allArcs.forEach(arc => {
        const line = L.polyline(arc, {
            color: routeLineColor,
            weight: lineThickness,
            dashArray: `${lineThickness * 2}, ${lineThickness * 2}`,
            opacity: 0.8
        }).addTo(map);
        liveArcLines.push(line);
    });

    console.log("[Live Arc] Draw complete.");
    debugStats.arcRedraws++;
debugStats.lastArcDraw = new Date().toLocaleTimeString();

}

    function generateGreatCircle(start, end, numPoints = 100) {
        const toRad = deg => deg * Math.PI / 180;
        const toDeg = rad => rad * 180 / Math.PI;
        let lat1 = toRad(start.lat);
        let lon1 = toRad(start.lon);
        let lat2 = toRad(end.lat);
        let lon2 = toRad(end.lon);
        const d = 2 * Math.asin(Math.sqrt(
            Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
        ));
        const points = [];
        for (let i = 0; i <= numPoints; i++) {
            const f = i / numPoints;
            const A = Math.sin((1 - f) * d) / Math.sin(d);
            const B = Math.sin(f * d) / Math.sin(d);
            const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
            const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
            const z = A * Math.sin(lat1) + B * Math.sin(lat2);
            const lat = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2));
            const lon = Math.atan2(y, x);
            points.push([toDeg(lat), toDeg(lon)]);
        }
        return points;
    }
function downsampleSegment(points, step = 3) {
  const result = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  if (points.length % step !== 0) result.push(points[points.length - 1]);
  return result;
}

let distance_value = 0.017;
function updateFlightTrail(currentLat, currentLon, currentAlt) {
  const last = trailCoordinates[trailCoordinates.length - 1];
  const distance_value = currentAlt > 25000 ? 0.27 : 0.017;

if (!last || getDistanceNM(currentLat, currentLon, last[0], last[1]) > distance_value) {
  const [adjLat, adjLon] = adjustForDateLine(currentLat, currentLon, last?.[1]);
  trailCoordinates.push([adjLat, adjLon]);


    const MAX_TRAIL_POINTS = 500;

if (trailCoordinates.length > MAX_TRAIL_POINTS || IDL_reset === 1) {
const downsampleStep = 3;
const lastStaticPoint  = trailCoordinates[trailCoordinates.length - 1];

const mirroredSegments = [
  downsampleSegment(trailCoordinates.map(([lat, lon]) => [lat, lon]), downsampleStep),
  downsampleSegment(trailCoordinates.map(([lat, lon]) => [lat, lon - 360]), downsampleStep),
  downsampleSegment(trailCoordinates.map(([lat, lon]) => [lat, lon + 360]), downsampleStep)
];

mirroredSegments[0].push([lastStaticPoint [0], lastStaticPoint [1]]);
mirroredSegments[1].push([lastStaticPoint [0], lastStaticPoint [1] - 360]);
mirroredSegments[2].push([lastStaticPoint [0], lastStaticPoint [1] + 360]);

IDL_reset = 0;
      mirroredSegments.forEach((segment, i) => {
        if (!staticTrailLines[i]) {
          staticTrailLines[i] = L.polyline(segment, {
            color: trailColor,
            weight: lineThickness,
            opacity: 1
          }).addTo(map);
        } else {
          segment.forEach(pt => staticTrailLines[i].addLatLng(pt));
        }
      });

      const lastPoint = trailCoordinates[trailCoordinates.length - 1];
      trailCoordinates = [lastPoint];

      trailLines.forEach(line => map.removeLayer(line));
      trailLines = [];
    }

    const mirroredLons = [currentLon, currentLon - 360, currentLon + 360];
    const lat = currentLat;

    if (trailLines.length === 0) {
      trailLines = mirroredLons.map(lon => {
        const line = L.polyline([[lat, lon]], {
          color: trailColor,
          weight: lineThickness,
          opacity: 1
        }).addTo(map);
        return line;
      });
      debugStats.trailRedraws++;
      debugStats.lastTrailDraw = new Date().toLocaleTimeString();
    } else {
      trailLines.forEach((line, i) => {
        line.addLatLng([lat, mirroredLons[i]]);
      });
    }
  }
const now = Date.now();
if (trailAutoSaveEnabled && now - lastTrailSaveTime >= TRAIL_SAVE_INTERVAL_MS) {
  lastTrailSaveTime = now;
  try {
    const staticSegments = staticTrailLines.map(line =>
      line ? line.getLatLngs().map(p => [p.lat, p.lng]) : []
    );

    const savePayload = {
      trailCoordinates,
      staticSegments,
      savedAt: Date.now(),
      origin: currentRoute?.origin?.icao || currentRoute?.origin?.city || "Unknown",
      destination: currentRoute?.destination?.icao || currentRoute?.destination?.city || "Unknown"
    };

    localStorage.setItem("savedTrail", JSON.stringify(savePayload));
  } catch (e) {
    console.warn("Failed to save trail:", e);
  }
}
}


function adjustForDateLine(lat, lon, prevLon) {
  if (prevLon === undefined) return [lat, lon];

  const dLon = lon - prevLon;

  // If aircraft crosses +180 going east, flip to -180
  if (dLon > 180) {
    lon -= 360;
  }

  // If aircraft crosses -180 going west, flip to +180
  if (dLon < -180) {
    lon += 360;
  }
  return [lat, lon];
}


    function fixIDL(points) {
        const newPoints = [points[0]];
        for (let i = 1; i < points.length; i++) {
            let [prevLat, prevLon] = newPoints[i - 1];
            let [lat, lon] = points[i];
            let dLon = lon - prevLon;
            if (dLon > 180) lon -= 360;
            if (dLon < -180) lon += 360;
            newPoints.push([lat, lon]);
        }
        return newPoints;
    }

function drawRouteMarkers() {
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];

    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    if (!currentRoute) return;
    const { origin, destination } = currentRoute;

    const markerStyle = {
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41]
    };

    function createCityMarkers(lat, lon) {
        const markers = [];
        [lon, lon - 360, lon + 360].forEach(adjLon => {
            const marker = L.marker([lat, adjLon], { icon: L.icon(markerStyle) }).addTo(map);
            markers.push(marker);
        });
        return markers;
    }

    function createCityLabels(lat, lon, name) {
        const labels = [];
        [lon, lon - 360, lon + 360].forEach(adjLon => {
            const label = L.marker([lat, adjLon], {
                icon: L.divIcon({
        className: '',
        html: `<div class="city-label">${name}</div>`,
        iconSize: [0, 0]
      }),
                interactive: false
            }).addTo(map);
            labels.push(label);
        });
        return labels;
    }

    const originMarkers = createCityMarkers(origin.lat, origin.lon);
    const destMarkers = createCityMarkers(destination.lat, destination.lon);
    const labelType = currentRoute.labelType || 'city';

const getLabel = (airport) => {
  const value = airport?.[labelType];
  return value && typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : airport.city;
};

const originLabelText = getLabel(origin);
const destLabelText = getLabel(destination);


const originLabels = createCityLabels(origin.lat, origin.lon, originLabelText);
const destLabels = createCityLabels(destination.lat, destination.lon, destLabelText);
console.log("Origin label value:", origin[labelType]);
console.log("Used label:", originLabelText);


    routeMarkers.push(...originMarkers, ...destMarkers, ...originLabels, ...destLabels);
    adjustLabelSizes();

    const markerBounds = L.latLngBounds([
        [origin.lat, origin.lon],
        [destination.lat, destination.lon]
    ]);
    map.fitBounds(markerBounds, { padding: [30, 30] });
}


function adjustLabelSizes() {
        const zoom = map.getZoom();
        const fontSize = (Math.max(zoom * 2.2, 16) * cityLabelScale)
        document.querySelectorAll('.city-label').forEach(label => {
            label.style.fontSize = `${fontSize}px`;
        });
    }


function initCityLabelScale() {
  const range = document.getElementById("cityLabelScaleRange");
  const value = document.getElementById("cityLabelScaleValue");

  const saved = localStorage.getItem("cityLabelScale");
  cityLabelScale = saved !== null && !isNaN(parseFloat(saved)) ? parseFloat(saved) : 1.0;

  if (range) range.value = cityLabelScale;
  if (value) value.textContent = cityLabelScale.toFixed(1) + "×";
  adjustLabelSizes();
}


function updateCityLabelScale() {
  const range = document.getElementById("cityLabelScaleRange");
  const value = document.getElementById("cityLabelScaleValue");
  if (!range) return;

  const v = parseFloat(range.value);
  cityLabelScale = isNaN(v) ? 1.0 : v;

  localStorage.setItem("cityLabelScale", String(cityLabelScale));
  if (value) value.textContent = cityLabelScale.toFixed(1) + "×";
  adjustLabelSizes();
}



function showRouteModal() {
  document.getElementById("routeModal").style.display = "flex";
  showTab('manualTab');

  const selected = document.getElementById("labelTypeSelect").value;

  document.querySelectorAll('input[name="labelType"]').forEach(radio => {
    radio.checked = (radio.value === selected);
  });

  document.querySelectorAll('input[name="labelTypeSimbrief"]').forEach(radio => {
    radio.checked = (radio.value === selected);
  });
}

    function hideRouteModal() {
        document.getElementById("routeModal").style.display = "none";
    }

async function submitRoute() {
  document.getElementById('trimWaypointBtn').style.display = 'none';

  const originICAO = document.getElementById("originInput").value.trim().toUpperCase();
  const destICAO = document.getElementById("destInput").value.trim().toUpperCase();

  const selectedRadio = document.querySelector('input[name="labelTypeManual"]:checked');
  const labelType = selectedRadio?.value || "city";
  currentLabelType = labelType;

  try {
    const [originRes, destRes] = await Promise.all([
      fetch(`/lookup_airport/${originICAO}`),
      fetch(`/lookup_airport/${destICAO}`)
    ]);

    if (originRes.status !== 200 || destRes.status !== 200) {
      showToast(translate("toastICAOnotfound"));
      return;
    }

    const originData = await originRes.json();
    const destData = await destRes.json();

    clearRouteAndMapState();

    currentRoute = {
      origin: {
        city: originData.city,
        lat: originData.lat,
        lon: originData.lon,
        tz: originData.tz,
        icao: originData.icao,
        iata: originData.iata,
        name: originData.name
      },
      destination: {
        city: destData.city,
        lat: destData.lat,
        lon: destData.lon,
        tz: destData.tz,
        icao: destData.icao,
        iata: destData.iata,
        name: destData.name
      },
      labelType: labelType
    };

    const dropdown = document.getElementById("labelTypeSelect");
    if (dropdown) dropdown.value = labelType;

    updateZoomLevelsFromRoute(currentRoute.origin, currentRoute.destination);
    drawRouteMarkers();
    hideRouteModal();
  } catch (err) {
    console.error("Error setting route:", err);
    showToast(translate("toastsetFailed"));
  }
  window.scrollTo(0, 0);
}


map.on('baselayerchange', function(e) {
  const labelCheckbox = document.querySelector('.leaflet-control-layers-overlays input[type=checkbox]');

  if (e.name === "🛰️ Esri Satellite") {
    labelCheckbox.disabled = false;
    labelCheckbox.checked = true;
    if (!map.hasLayer(esriLabels)) {
      map.addLayer(esriLabels);
    }
  } else {
    if (map.hasLayer(esriLabels)) {
      map.removeLayer(esriLabels);
    }
    labelCheckbox.disabled = true;
    labelCheckbox.checked = false;
  }

  localStorage.setItem("mapTheme", e.name);
  console.log("[Map Theme] Saved theme:", e.name);
});

map.on("dragstart", () => {
  lastManualMapMove = Date.now();
});

let _programmaticZoom = false;

map.on("zoomstart", () => {
  if (_programmaticZoom) return;
  lastManualMapMove = Date.now();
});


let intervalTime = 1000;

function changeInterval(altitude_test) {
  intervalTime = altitude_test > 25000.0 ? 3000 : 1000;
}

let latestData = null;
function toggleDayNight() {
  const checkbox = document.getElementById("dayNightToggle");
  if (!checkbox) return;

  dayNightEnabled = checkbox.checked;
  localStorage.setItem("dayNightEnabled", dayNightEnabled);

  if (!dayNightEnabled && dayNightGroup) {
    map.removeLayer(dayNightGroup);
    dayNightGroup = null;
  }
}
function normalizeLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

function updateDayNight(simUtcTime, zuluDay, zuluMonth) {
  if (!dayNightEnabled || !simUtcTime) return;
  if (dayNightGroup) map.removeLayer(dayNightGroup);

  const { poly, declDeg, subSolarLonDeg } = buildTerminatorCoords(simUtcTime, zuluDay, zuluMonth);

  dayNightGroup = L.layerGroup().addTo(map);
  const style = { color: "#000", weight: 0, fillOpacity: 0.6, fillColor: "#000", interactive: false, pane: 'dayNightPane' };

  [0, 360, -360].forEach(offset => {
    L.polygon(poly.map(([lat, lon]) => [lat, lon + offset]), style).addTo(dayNightGroup);
  });

  // L.circleMarker([declDeg, subSolarLonDeg], {
  //  radius: 5, color: "yellow", fillColor: "yellow", fillOpacity: 1
  // }).addTo(dayNightGroup);
}

function buildTerminatorCoords(simUtcTime, zuluDay, zuluMonth) {
  const year = new Date().getUTCFullYear();
  const date = new Date(Date.UTC(year, (zuluMonth || 1) - 1, zuluDay || 1));
  const [hh, mm, ss] = (simUtcTime || "00:00:00").split(":").map(Number);
  date.setUTCHours(hh || 0, mm || 0, ss || 0, 0);

  const doy = Math.floor((date - Date.UTC(year, 0, 0)) / 86400000);

  const gamma = (2 * Math.PI / 365) * (doy - 1 + ((hh || 0) - 12) / 24);
  const decl =
      0.006918
    - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148  * Math.sin(3 * gamma);
  const declDeg = decl * 180 / Math.PI;

  const ut = (hh || 0) + (mm || 0) / 60 + (ss || 0) / 3600;
  const subSolarLonDeg = normalizeLon(180 - ut * 15);

  const eps = 1e-9;
  const tanDecl = Math.tan(Math.abs(decl) < eps ? eps : decl);
  const curve = [];
  for (let lonDeg = -180; lonDeg <= 180; lonDeg += 5) {
    const dLon = (lonDeg - subSolarLonDeg) * Math.PI / 180;
    const latRad = Math.atan(-Math.cos(dLon) / tanDecl);
    curve.push([latRad * 180 / Math.PI, lonDeg]);
  }

  const closeToNorthPole = (decl < 0);
  if (closeToNorthPole) {
    curve.push([ 90,  180], [ 90, -180]);
  } else {
    curve.push([-90,  180], [-90, -180]);
  }

  return { poly: curve, declDeg, subSolarLonDeg };
}


function toRad(d) { return d * Math.PI / 180; }
function unwrapLon(lon, refLon) {
  let x = lon;
  while (x - refLon > 180) x -= 360;
  while (x - refLon < -180) x += 360;
  return x;
}

function wrapLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}
function cross(a,b){ return [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ]; }
function normalize(v){ const n=Math.hypot(v[0],v[1],v[2]); return [v[0]/n, v[1]/n, v[2]/n]; }


function runFrequentUpdates() {
  fetch('/live_data')
    .then(res => res.json())
    .then(data => {
      latestData = data;
      simRate = Number(data.sim_rate) || 1.0;
      updateFlightTimer(data);

      if (cycleZoomActive && cycleZoomAirborneOnly && !_timerAirborne && lastKnownPosition) {
        const maxZoom = 15;
        if (map.getZoom() < maxZoom) {
          map.setView(
            L.latLng(lastKnownPosition.lat, lastKnownPosition.lon),
            maxZoom,
            { animate: true }
          );
        }
      }
      changeInterval(data.altitude);

      const altVal = convertAltitude(data.altitude || 0);
      document.getElementById('altitude').textContent = isNaN(altVal) ? '--' : altVal.toFixed(0) + ' ' + unitModes.altitude[currentUnits.altitude];

      const speedVal = convertSpeed(data.ground_speed || 0);
      document.getElementById('groundSpeed').textContent = isNaN(speedVal) ? '--' : speedVal.toFixed(0) + ' ' + unitModes.speed[currentUnits.speed];

      simconnectAvailable = data.available === true;

      if (!data.available) {
        emaSpeed = null;
      }
       if (data.sim_time_utc) {
updateDayNight(data.sim_time_utc, data.zulu_day, data.zulu_month);
}

if (currentRoute && data.latitude && data.longitude) {
  const fromOrigin = getDistanceNM(
    data.latitude, data.longitude,
    currentRoute.origin.lat, currentRoute.origin.lon
  );
  const toDest = getDistanceNM(
    data.latitude, data.longitude,
    currentRoute.destination.lat, currentRoute.destination.lon
  );

  const fromOriginConv = convertDistance(fromOrigin);
  const toDestConv = convertDistance(toDest);

  document.getElementById('distanceFromOrigin').textContent =
    fromOriginConv.toFixed(0) + ' ' + unitModes.distance[currentUnits.distance];
  document.getElementById('distanceToDest').textContent =
    toDestConv.toFixed(0) + ' ' + unitModes.distance[currentUnits.distance];

  const timeRemEl = document.getElementById('timeRemaining');
  const etaEl = document.getElementById('eta');

  if (data.ground_speed > 50) {
    groundSpeedBuffer.push(data.ground_speed);
    if (groundSpeedBuffer.length > SPEED_BUFFER_SIZE) {
      groundSpeedBuffer.shift();
    }

    const avgSpeed = groundSpeedBuffer.reduce((a, b) => a + b, 0) / groundSpeedBuffer.length;

    if (avgSpeed > 50) {
      const hours = toDest / avgSpeed;
      const totalMins = hours * 60;
      const hr = Math.floor(totalMins / 60);
      const min = Math.round(totalMins % 60);

      if (hr < 99) {
        timeRemEl.textContent = `${hr}:${min.toString().padStart(2, '0')}`;

        let etaStr = "--:--";
if (etaMode === "dest" && currentRoute.destination?.tz && data.sim_time_utc) {
  const simDateUTC = buildSimUTCDate(data);
  if (simDateUTC) {
    const etaDate = new Date(simDateUTC.getTime() + totalMins * 60000);
    etaStr = etaDate.toLocaleTimeString("en-US", {
      timeZone: currentRoute.destination.tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
} else if (etaMode === "local") {
  const now = new Date();

  const sr = Number(data.sim_rate) > 0 ? Number(data.sim_rate) : 1;

  const adjustedOffset = sr >= 1
    ? (totalMins * 60000) / sr
    : (totalMins * 60000) * (1 / sr);

  const etaDate = new Date(now.getTime() + adjustedOffset);

  etaStr = etaDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}


        etaEl.textContent = etaStr;
      } else {
        timeRemEl.textContent = "--:--";
        etaEl.textContent = "--:--";
      }
    } else {
      timeRemEl.textContent = "--:--";
      etaEl.textContent = "--:--";
    }
  } else {
    timeRemEl.textContent = "--:--";
    etaEl.textContent = "--:--";
    groundSpeedBuffer = [];
  }
}

      if (data.sim_time_utc && currentRoute?.origin?.tz && currentRoute?.destination?.tz) {
        const simDateUTC = buildSimUTCDate(data);
if (simDateUTC) {
  const timeAtOrigin = simDateUTC.toLocaleTimeString('en-US', {
    timeZone: currentRoute.origin.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const timeAtDest = simDateUTC.toLocaleTimeString('en-US', {
    timeZone: currentRoute.destination.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  document.getElementById('timeOrigin').textContent = timeAtOrigin;
  document.getElementById('timeDestination').textContent = timeAtDest;
}
}

      if (debugPanelVisible) {
        const zoom = map.getZoom();
        const center = map.getCenter();
        const pos = lastKnownPosition || {};
        const trailBytes = trailCoordinates.length * 2 * 8;
        const trailSizeKB = (trailBytes / 1024).toFixed(1);
        let recoveryInfo = "Trail Recovery: None saved";
const saved = localStorage.getItem("savedTrail");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    const ageMin = ((Date.now() - parsed.savedAt) / (1000 * 60)).toFixed(1);
    const origin = parsed.origin || "N/A";
    const dest = parsed.destination || "N/A";
    const livePoints = parsed.trailCoordinates?.length || 0;
    const staticPoints = parsed.staticSegments?.flat()?.length || 0;

    recoveryInfo = `
Trail Recovery:
  Saved Age: ${ageMin} min
  Route: ${origin} → ${dest}
  Saved Live Points: ${livePoints}
  Saved Static Points: ${staticPoints}`;
  } catch (e) {
    recoveryInfo = "Trail Recovery: [Corrupted or unreadable]";
  }
}

        const debugText = `
SimConnect: ${simconnectAvailable ? 'Connected' : 'Disconnected'}
Zoom: ${zoom}
Map Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}
Aircraft: ${pos.lat?.toFixed(4) || '--'}, ${pos.lon?.toFixed(4) || '--'}
Speed: ${pos.ground_speed?.toFixed(1) || '--'} kts
Heading: ${pos.heading?.toFixed(1) || '--'}°
Sim Time (UTC): ${data.sim_time_utc || '--'}
FPS: ${currentFPS}
Memory: ${currentMemory}
Map Input Response: ${lastMapResponseTime}
Redraws:
  Trail: ${debugStats.trailRedraws} (${debugStats.lastTrailDraw || '--'})
  Arc:   ${debugStats.arcRedraws} (${debugStats.lastArcDraw || '--'})
Trail Points: ${trailCoordinates.length}
Trail Size: ~${trailSizeKB} KB
${recoveryInfo}
Remaining Waypoints: ${currentRoute?.simbriefWaypoints ? remainingSimBriefWaypoints.length : 'N/A'}
Layers: ${Object.keys(map._layers).length}
Route Mode: ${currentRoute?.simbriefWaypoints ? 'SimBrief' : currentRoute?.destination ? 'Great Circle' : 'None'}
Zoom Cycle: ${cycleZoomActive ? `ON (${cycleZoomSpeed / 1000}s)` : 'OFF'}
Follow Plane: ${followPlane ? 'ON' : 'OFF'}
        `;

        document.getElementById("debugContent").textContent = debugText.trim();
      }

    })
    .catch(err => {
      console.error("Failed to load live data:", err);
    });

  setTimeout(runFrequentUpdates, 1000);
}

function runAircraftUpdates() {
  if (!latestData || !latestData.available) {
    setTimeout(runAircraftUpdates, intervalTime);
    return;
  }

  const data = latestData;

  if (data.latitude && data.longitude) {
    lastKnownPosition = {
      lat: data.latitude,
      lon: data.longitude,
      heading: data.heading || 0
    };
  }

  if (
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number' &&
    (Math.abs(data.latitude) > 0.1 || Math.abs(data.longitude) > 0.1)
  ) {
    updatePlaneIcon(data.latitude, data.longitude, data.heading || 0);
    updateFlightTrail(data.latitude, data.longitude, data.altitude);
    checkIDLReset(data.longitude);

    const timeSinceMove = Date.now() - lastManualMapMove;
    const atOverviewZoom = cycleZoomActive && currentZoomIndex === 0;

    if (followPlane && !atOverviewZoom && timeSinceMove >= followRecenterDelay) {
      map.setView([data.latitude, data.longitude]);
    }

    if (currentRoute?.simbriefWaypoints) {
      drawSimBriefArc();
    } else if (currentRoute?.destination) {
      drawLiveGreatCircle(data.latitude, data.longitude);
    }
  }

  setTimeout(runAircraftUpdates, intervalTime);
}

runFrequentUpdates();
runAircraftUpdates();



function setupMapInteractionTiming(map) {
  let interactionStartTime = null;

  map.on("movestart", () => {
    if (!debugPanelVisible) return;
    interactionStartTime = performance.now();
  });

  map.on("moveend", () => {
    if (!debugPanelVisible || !interactionStartTime) return;
    const duration = performance.now() - interactionStartTime;
    lastMapResponseTime = `${duration.toFixed(1)} ms`;
    interactionStartTime = null;
  });

  map.on("zoomstart", () => {
    if (!debugPanelVisible) return;
    interactionStartTime = performance.now();
  });

  map.on("zoomend", () => {
    if (!debugPanelVisible || !interactionStartTime) return;
    const duration = performance.now() - interactionStartTime;
    lastMapResponseTime = `${duration.toFixed(1)} ms`;
    interactionStartTime = null;
  });
}


(function monitorFPSAndMemory() {
  let lastFrame = performance.now();
  let frameCount = 0;

  function loop() {
    const now = performance.now();
    frameCount++;

    if (now - lastFrame >= 1000) {
      lastFrame = now;

      if (debugPanelVisible) {
        currentFPS = frameCount;

        if (performance.memory) {
          const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
          const totalMB = performance.memory.totalJSHeapSize / 1024 / 1024;
          currentMemory = `${usedMB.toFixed(1)} / ${totalMB.toFixed(1)} MB`;
        } else {
          currentMemory = "Not supported";
        }
      }

      frameCount = 0;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();


function getDistanceNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Radius of Earth in nautical miles
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function reloadPage() {
    document.getElementById('trimWaypointBtn').style.display = 'none';
    location.reload();
}


document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && trailCoordinates.length > 0) {
    const [lastLat, lastLon] = trailCoordinates[trailCoordinates.length - 1];
    updateFlightTrail(lastLat, lastLon, "");
  }
});

let lastKnownPosition = null;


async function loadSimBrief(silent = false) {
  let username = localStorage.getItem("simbriefUsername");

if (!username) {
  if (silent) return;

  showPrompt(translate("promptEnterSimbrief"), "", (result) => {
    if (!result) return;

    localStorage.setItem("simbriefUsername", result);
    const simbriefInput = document.getElementById("simbriefInput");
if (simbriefInput) simbriefInput.value = result;
    loadSimBrief(true);
  });
  return;
}

  try {
    const res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${username}`);
    const xml = await res.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");

    const originIcao = xmlDoc.querySelector("origin > icao_code")?.textContent?.trim();
    const destIcao = xmlDoc.querySelector("destination > icao_code")?.textContent?.trim();

    const fixNodes = xmlDoc.querySelectorAll("navlog > fix");
    const waypoints = Array.from(fixNodes).map(fix => {
      const lat = parseFloat(fix.querySelector("pos_lat")?.textContent);
      const lon = parseFloat(fix.querySelector("pos_long")?.textContent);
      return [lat, lon];
    }).filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon));

    if (!originIcao || !destIcao || waypoints.length < 2) {
       localStorage.removeItem("simbriefUsername");
       showToast(translate("toastLoadFailed"));
      return;
    }

    const [originRes, destRes] = await Promise.all([
      fetch(`/lookup_airport/${originIcao}`),
      fetch(`/lookup_airport/${destIcao}`)
    ]);

    if (originRes.status !== 200 || destRes.status !== 200) {
       localStorage.removeItem("simbriefUsername");
       showToast(translate("toastDataFail"));
      return;
    }

    const originData = await originRes.json();
    const destData = await destRes.json();
    clearRouteAndMapState();
const selectedRadio = document.querySelector('input[name="labelTypeSimbrief"]:checked');
const labelType = selectedRadio?.value || "city";
currentLabelType = labelType;

currentRoute = {
  origin: {
    city: originData.city,
    name: originData.name,
    iata: originData.iata,
    icao: originData.icao,
    lat: originData.lat,
    lon: originData.lon,
    tz: originData.tz
  },
  destination: {
    city: destData.city,
    name: destData.name,
    iata: destData.iata,
    icao: destData.icao,
    lat: destData.lat,
    lon: destData.lon,
    tz: destData.tz
  },
  labelType: labelType,
  simbriefWaypoints: waypoints
};
const dropdown = document.getElementById("labelTypeSelect");
if (dropdown) dropdown.value = labelType;

    updateZoomLevelsFromRoute(currentRoute.origin, currentRoute.destination);

    remainingSimBriefWaypoints = [...waypoints];
    document.getElementById('trimWaypointBtn').style.display = 'inline-block';
    drawRouteMarkers();
    drawSimBriefArc();
    hideRouteModal();
  } catch (err) {
    localStorage.removeItem("simbriefUsername");
    console.error("SimBrief load failed:", err);
    showToast(translate("toastsimbriefimportfail"));
  }
  fitButtonText("setRouteBtn");
fitButtonText("reloadBtn");
fitButtonText("trimWaypointBtn");
window.scrollTo(0, 0);
}

async function loadMSFSPlan() {
  const variantRadio = document.querySelector('input[name="msfsVariant"]:checked');
  const variant = variantRadio?.value || 'steam_2020';
  localStorage.setItem('msfsVariant', variant);

  const labelRadio = document.querySelector('input[name="labelTypeMSFS"]:checked');
  const labelType  = labelRadio?.value || 'city';

  try {
    const res  = await fetch(`/msfs_flightplan?variant=${variant}`);
    const data = await res.json();

    if (!res.ok) {
      if (data.error === 'no_custom_path') {
        showToast(translate("msfsNoCustomPath") || "No custom directory set. Add msfs_custom_pln_path to advanced_config.txt.");
      } else if (data.error === 'file_not_found') {
        showToast(translate("msfsFileNotFound") || "MSFS flight plan file not found. Set a custom flight plan in-game first.");
      } else if (data.error === 'parse_error') {
        showToast(translate("msfsParseError") || "Failed to read MSFS flight plan file.");
      } else if (data.error === 'missing_airports') {
        showToast(translate("msfsMissingAirports") || "Could not read origin/destination from flight plan.");
      } else {
        showToast(translate("msfsLoadFailed") || "Failed to load MSFS flight plan.");
      }
      return;
    }

    const { origin: originIcao, destination: destIcao, waypoints } = data;

    const [originRes, destRes] = await Promise.all([
      fetch(`/lookup_airport/${originIcao}`),
      fetch(`/lookup_airport/${destIcao}`)
    ]);

    if (originRes.status !== 200 || destRes.status !== 200) {
      showToast(translate("toastDataFail"));
      return;
    }

    const originData = await originRes.json();
    const destData   = await destRes.json();

    clearRouteAndMapState();
    currentLabelType = labelType;

    currentRoute = {
      origin: {
        city: originData.city,
        name: originData.name,
        iata: originData.iata,
        icao: originData.icao,
        lat:  originData.lat,
        lon:  originData.lon,
        tz:   originData.tz
      },
      destination: {
        city: destData.city,
        name: destData.name,
        iata: destData.iata,
        icao: destData.icao,
        lat:  destData.lat,
        lon:  destData.lon,
        tz:   destData.tz
      },
      labelType,
      simbriefWaypoints: waypoints
    };

    const dropdown = document.getElementById("labelTypeSelect");
    if (dropdown) dropdown.value = labelType;

    updateZoomLevelsFromRoute(currentRoute.origin, currentRoute.destination);
    remainingSimBriefWaypoints = [...waypoints];
    document.getElementById('trimWaypointBtn').style.display = 'inline-block';
    drawRouteMarkers();
    drawSimBriefArc();
    hideRouteModal();

    fitButtonText("setRouteBtn");
    fitButtonText("reloadBtn");
    fitButtonText("trimWaypointBtn");
    window.scrollTo(0, 0);

  } catch (err) {
    console.error("MSFS plan load failed:", err);
    showToast(translate("msfsLoadFailed") || "Failed to load MSFS flight plan.");
  }
}

function manuallyTrimWaypoint() {
  if (remainingSimBriefWaypoints.length > 0) {
    remainingSimBriefWaypoints.shift();
    drawSimBriefArc();
  }
}

function getDistanceNM(lat1, lon1, lat2, lon2) {
  const R = 3440;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildSimUTCDate(data) {
  if (!data?.sim_time_utc) return null;

  const [hh, mm, ss] = data.sim_time_utc.split(":").map(Number);
  const year = new Date().getUTCFullYear();
  const month = (data.zulu_month ?? 1) - 1;
  const day   = data.zulu_day ?? 1;

  return new Date(Date.UTC(year, month, day, hh || 0, mm || 0, ss || 0));
}

function drawSimBriefArc() {
  if (!currentRoute?.simbriefWaypoints || !lastKnownPosition) return;

  clearLiveGreatCircle();

  const thresholdNM = 10;
  const currentLat = lastKnownPosition.lat;
  const currentLon = lastKnownPosition.lon;
  const currentHeading = lastKnownPosition.heading || 0;

  while (remainingSimBriefWaypoints.length > 0) {
    const [lat, lon] = remainingSimBriefWaypoints[0];
    const dist = getDistanceNM(currentLat, currentLon, lat, lon);

    if (dist > thresholdNM) break;

    const bearingToWpt = getBearing(currentLat, currentLon, lat, lon);
    const angleDiff = Math.abs(currentHeading - bearingToWpt);
    const angle = Math.min(angleDiff, 360 - angleDiff);

    if (angle >= 90) {
      remainingSimBriefWaypoints.shift();
    } else {
      break;
    }
  }

  if (remainingSimBriefWaypoints.length === 0) return;

  const arcPoints = [
    [currentLat, currentLon],
    ...remainingSimBriefWaypoints
  ];

  const points = fixIDL(arcPoints);

  const allArcs = [
    points,
    points.map(([lat, lon]) => [lat, lon - 360]),
    points.map(([lat, lon]) => [lat, lon + 360])
  ];

  allArcs.forEach(arc => {
    const line = L.polyline(arc, {
      color: routeLineColor,
      weight: lineThickness,
      dashArray: `${lineThickness * 2}, ${lineThickness * 2}`,
      opacity: 0.8
    }).addTo(map);
    liveArcLines.push(line);
  });
}

function setLanguage(lang, startup) {
console.log("Setting language:", lang);
  const t = translations[lang];
  if (!t) return;

  document.getElementById("originInput").placeholder = t.originPlaceholder;
  document.getElementById("destInput").placeholder = t.destinationPlaceholder;
  document.getElementById("cityLabelScaleLabel").textContent = t.cityLabelScaleLabel;

  const manualButtons = document.querySelectorAll('#manualTab button');
  if (manualButtons.length >= 2) {
    manualButtons[0].textContent = t.submit;
    manualButtons[1].textContent = t.dismiss;
  }

const simbriefButtons = document.querySelectorAll('#simbriefTab button');
if (simbriefButtons.length >= 1) {
  simbriefButtons[0].textContent = t.loadSimBrief;
}
if (simbriefButtons.length >= 2) {
  simbriefButtons[1].textContent = t.dismiss;
}
const paragraphs = document.querySelectorAll('#simbriefTab p');
if (paragraphs.length >= 1) paragraphs[0].textContent = t.simbriefNotice;

  const note = document.querySelector('#manualTab p');
  if (note) note.textContent = t.manualRouteNote;

  const trimBtn = document.getElementById('trimWaypointBtn');
  if (trimBtn) {
    trimBtn.title = t.trimTooltip;
    trimBtn.textContent = t.trimWaypoint;
  }

const routeBtn = document.getElementById('setRouteBtn');
if (routeBtn) {
  routeBtn.title = t.setRouteTooltip;
  routeBtn.textContent = t.setChangeRoute;
}

const reloadBtn = document.getElementById('reloadBtn');
if (reloadBtn) {
  reloadBtn.title = t.reloadTooltip;
  reloadBtn.textContent = t.reloadPage;
}
  const infoLabels = {
    altitude: 'infoAltitude',
    groundSpeed: 'infoGroundSpeed',
    timeOrigin: 'infoTimeOrigin',
    timeDestination: 'infoTimeDest',
    distanceFromOrigin: 'infoDistFromOrigin',
    distanceToDest: 'infoDistToDest',
    timeRemaining: 'infoTimeRemaining',
    eta: 'infoETA'
  };

  for (const id in infoLabels) {
    const container = document.querySelector(`#info-bar div:has(#${id})`);
    if (container) {
      container.querySelector("strong").textContent = t[infoLabels[id]];
    }
  }
const settingsTextMap = {
  settings_title: "settingsTitle",
  follow_aircraft_label: "followAircraft",
  auto_cycle_zoom_label: "autoCycleZoom",
  zoom_speed_label: "zoomSpeed",
  unit_system_label: "unitSystem",
  trail_color_label: "trailColor",
  route_color_label: "routeColor",
  thickness_label: "lineThickness",
  airport_label_label: "airportLabelType",
  aircraft_icon_label: "aircraftIcon",
  language_label: "languageLabel",
  simbrief_clear_label: "clearSimbrief",
  debug_label: "showDebug",
  infoPanelHeader: "panelTitle",
  flight_summary_label: "summaryTitle",
  autoSimBriefSpan: "autoSimbriefTitle",
  simbriefuserlabel: "simbriefusernameLabel",
  iconColorLabel: "aircraftIconColor",
  setSimbriefBtn: "SimbriefSetLabel",
  followDelayLabel: "followRecenterDelay",

};


const infoPanelTooltips = {
  closeInfoPanelBtn: "closeInfoTooltip",
  importSimbriefBtn: "importSimbriefTooltip"
};
const infoPanelLabels = {
  infoPanelHeader: "panelTitle",
  flight_summary_label: "summaryTitle",
  departure_label: "departureLabel",
  arrival_label: "arrivalLabel",
  flight_number_label: "flightNumberLabel",
  aircraft_type_label: "aircraftTypeLabel",
  flight_time_label: "flightTimeLabel",
  fuel_label: "fuelLabel"
};

const infoPanelHeader = document.getElementById("flight_summary_title");
if (infoPanelHeader && t.summaryTitle) infoPanelHeader.textContent = t.summaryTitle;


const simbriefBtn = document.getElementById("importSimbriefBtn");
if (simbriefBtn && t.importSimbriefTooltip) simbriefBtn.title = t.importSimbriefTooltip;

const closeInfoBtn = document.getElementById("closeInfoPanelBtn");
if (closeInfoBtn && t.closeInfoTooltip) closeInfoBtn.title = t.closeInfoTooltip;

for (const [id, key] of Object.entries(infoPanelLabels)) {
  const el = document.getElementById(id);
  if (el && t[key]) el.textContent = t[key];
}

for (const [id, key] of Object.entries(infoPanelTooltips)) {
  const el = document.getElementById(id);
  if (el && t[key]) el.title = t[key];
}

for (const [id, key] of Object.entries(settingsTextMap)) {
  const el = document.getElementById(id);
  if (el && t[key]) el.textContent = t[key];
}


const tooltipMap = {
  infoToggleBtn: "infoTooltip",
  settingsBtn: "settingsTooltip",
  followToggle: "followTooltip",
  cycleZoomToggle: "cycleZoomTooltip",
  zoomSpeedSelect: "zoomSpeedTooltip",
  simbrief_clear_label: "simbriefClearTooltip",
  close_btn: "closeBtnTooltip",
  import_simbrief_btn: "importSimbriefTooltip",
  toggleUIBtn: "toggleUITip",
  autoStealthModeToggle: "autoSimbrieftip",
  followDelaySelect: "followDelaytip"
};

for (const [id, key] of Object.entries(tooltipMap)) {
  const el = document.getElementById(id);
  if (el && t[key]) el.title = t[key];
}


const zoomSpeedSelect = document.getElementById("zoomSpeedSelect");
if (zoomSpeedSelect && zoomSpeedSelect.options.length >= 3) {
  zoomSpeedSelect.options[0].textContent = t.zoomFast;
  zoomSpeedSelect.options[1].textContent = t.zoomNormal;
  zoomSpeedSelect.options[2].textContent = t.zoomSlow;
}


const unitSelect = document.getElementById("unitSystemSelect");
if (unitSelect && unitSelect.options.length >= 4) {
  unitSelect.options[0].textContent = t.unitAuto;
  unitSelect.options[1].textContent = t.unitImperial;
  unitSelect.options[2].textContent = t.unitMetric;
  unitSelect.options[3].textContent = t.unitAviation;
}


const labelTypeSelect = document.getElementById("labelTypeSelect");
if (labelTypeSelect && labelTypeSelect.options.length >= 4) {
  labelTypeSelect.options[0].textContent = t.city;
  labelTypeSelect.options[1].textContent = t.icao;
  labelTypeSelect.options[2].textContent = t.iata;
  labelTypeSelect.options[3].textContent = t.name;
}

const iconSelect = document.getElementById("iconSelect");
if (iconSelect && iconSelect.options.length >= 5) {
  iconSelect.options[0].textContent = t.iconDefault;
  iconSelect.options[1].textContent = t.iconJumbo;
  iconSelect.options[2].textContent = t.iconRegional;
  iconSelect.options[3].textContent = t.iconMilitary;
  iconSelect.options[4].textContent = t.iconGA;
  iconSelect.options[5].textContent = t.iconHeli;
}
const simbriefUsername = localStorage.getItem("simbriefUsername");
const autoLoadSimbrief = localStorage.getItem("autoLoadSimbrief") === "true";

if (simbriefUsername && (startup === 0 || autoLoadSimbrief)) {
  importSimbriefToInfoPanel();
}

const toggleBtn = document.getElementById("toggleUIBtn");
const hidden = localStorage.getItem("forceUIHidden") === "true";
if (toggleBtn) {
  toggleBtn.textContent = hidden ? t.showUI : t.hideUI;
}
document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
  const key = el.getAttribute("data-i18n-placeholder");
  if (key && translations[lang]?.[key]) {
    el.placeholder = translations[lang][key];
  }
});

fitButtonText("setRouteBtn");
fitButtonText("reloadBtn");
fitButtonText("trimWaypointBtn");
const infoBarLabel = document.getElementById("infoBarLabel");
if (infoBarLabel) {
  infoBarLabel.textContent = translate("infoBar");
}
const infoBarFontLabel = document.getElementById("infoBarFontLabel");
if (infoBarFontLabel) infoBarFontLabel.textContent = t.infoBarFont;
const etaModeLabel = document.getElementById("etaModeLabel");
if (etaModeLabel) etaModeLabel.textContent = t.etaMode;

const etaModeSelect = document.getElementById("etaModeSelect");
if (etaModeSelect && etaModeSelect.options.length >= 2) {
  etaModeSelect.options[0].textContent = t.etaDest;
  etaModeSelect.options[1].textContent = t.etaLocal;
}
const dayNightLabel = document.getElementById("dayNightLabel");
if (dayNightLabel) dayNightLabel.textContent = t.dayNight;

// MSFS Flight Plan modal
const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
setText("lbl-msfsTab",              t.msfsTabLabel          || "MSFS Flight Plan");
setText("lbl-msfsModalDesc",        t.msfsModalDesc         || "Loads your active MSFS custom flight plan directly from the sim. Set your flight plan in-game first, then click Load below.");
setText("lbl-msfsVersionTitle",     t.msfsVersionTitle      || "MSFS Version & Platform:");
setText("lbl-msfsVariantSteam2020", t.msfsVariantSteam2020  || "MSFS 2020 — Steam");
setText("lbl-msfsVariantStore2020", t.msfsVariantStore2020  || "MSFS 2020 — Microsoft Store");
setText("lbl-msfsVariantSteam2024", t.msfsVariantSteam2024  || "MSFS 2024 — Steam");
setText("lbl-msfsVariantStore2024", t.msfsVariantStore2024  || "MSFS 2024 — Microsoft Store");
setText("lbl-msfsLoadBtn",          t.msfsLoadBtn           || "Load MSFS Plan");
setText("lbl-msfs2024Unsupported",  t.msfs2024Unsupported   || "⚠️ MSFS 2024 flight plan imports are not currently supported. Changes to the 2024 PLN file format removed waypoint coordinates, making import not feasible.");
setText("lbl-msfsVariantCustom",    t.msfsVariantCustom     || "Custom Directory");
setText("lbl-manualTab",            t.manualTabLabel        || "Manual Route");
setText("lbl-simbriefTab",          t.simbriefTabLabel      || "SimBrief Plan");
setText("lbl-timeElapsed",          t.infoTimeElapsed       || "Time Elapsed:");
setText("lbl-cycleZoomAirborneOnly", t.cycleZoomAirborneOnly  || "Only when airborne");
const airborneOnlyEl = document.getElementById("cycleZoomAirborneOnly");
if (airborneOnlyEl && t.cycleZoomAirborneOnlyTip) airborneOnlyEl.title = t.cycleZoomAirborneOnlyTip;
["manual","simbrief","msfs"].forEach(tab => {
  setText("lbl-routeModalLabelType-" + tab, t.labelType || "Label Type:");
  setText("lbl-routeModalCity-"      + tab, t.city      || "City (default)");
  setText("lbl-routeModalICAO-"      + tab, t.icao      || "ICAO");
  setText("lbl-routeModalIATA-"      + tab, t.iata      || "IATA");
  setText("lbl-routeModalName-"      + tab, t.name      || "Airport Name");
});
setText("performanceWarning",        t.performanceWarning   || "If you are switching to the 3D globe, please note that it uses more system resources than the 2D map.");

  const setEl = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setEl("switchWarningTitle",        t.switchWarningTitle   || "⚠️ Switching Views");
  setEl("switchWarningBody",         t.switchWarningBody    || "Switching map style will reset everything — your current route, flight trail, and all progress will be lost.");
  setEl("switchWarningDontShowText", t.switchWarningDontShow || "Don't show this warning again");
  const cancelBtn = document.getElementById("switchWarningCancelBtn");
  if (cancelBtn) cancelBtn.textContent = t.switchWarningCancel || "Cancel";
  const confirmBtn = document.getElementById("mapSwitchConfirmBtn");
  if (confirmBtn) confirmBtn.textContent = t.switchWarningConfirm || "Switch View";
  const globeBtn = document.getElementById("globeViewBtn");
  if (globeBtn) globeBtn.textContent = t.globeViewBtn || "3D View 🌍";

initInfoBarSetting();
}

function changeLanguage(lang) {
  localStorage.setItem('selectedLanguage', lang);
  setLanguage(lang, 0);
}

function updateInfoBarFont() {
  const slider = document.getElementById("infoBarFontRange");
  const bar = document.getElementById("info-bar");
  if (!slider || !bar) return;

  const size = slider.value;
  bar.style.fontSize = size + "px";
  localStorage.setItem("infoBarFontSize", size);
}

function clearSimBriefUsername() {
  localStorage.removeItem("simbriefUsername");
  showToast(translate("toastSimbriefCleared"));
}

function toggleDebugPanel() {
  const checkbox = document.getElementById("debugToggle");
  const debugPanel = document.getElementById("debugBox");
  if (!debugPanel || !checkbox) return;

  if (checkbox.checked) {
    debugPanel.style.display = "block";
    debugPanelVisible = true;
  } else {
    debugPanel.style.display = "none";
    debugPanelVisible = false;
  }
}


function fitButtonText(buttonId, minFont = 10, maxFont = 16) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  let fontSize = maxFont;
  btn.style.fontSize = fontSize + "px";

  while (btn.scrollWidth > btn.clientWidth && fontSize > minFont) {
    fontSize--;
    btn.style.fontSize = fontSize + "px";
  }
}

function updateLineThickness() {
  const slider = document.getElementById("lineThicknessRange");
  if (!slider) return;
  lineThickness = parseInt(slider.value);
  localStorage.setItem("lineThickness", lineThickness);

  redrawFlightTrail();
  updateTrailStyle();

  if (currentRoute?.simbriefWaypoints) {
    drawSimBriefArc();
  } else if (currentRoute?.destination && lastKnownPosition) {
    drawLiveGreatCircle(lastKnownPosition.lat, lastKnownPosition.lon, true);
  }
}

function deleteSavedTrail() {
  localStorage.removeItem("savedTrail");
  showToast("Saved trail has been deleted.");
}
function toggleTrailSaving() {
  const checkbox = document.getElementById("trailSaveToggle");
  if (!checkbox) return;

  trailAutoSaveEnabled = checkbox.checked;
  localStorage.setItem("trailAutoSaveEnabled", trailAutoSaveEnabled);

  if (trailAutoSaveEnabled) {
    showToast("⚠️ Enabling Auto-Save Trail may cause performance issues during long flights.\nHowever, enabling it will allow you to recover flight path data if the window is mistakenly closed or refreshed.\nYou can disable it anytime in settings.");
  }
}


function recoverSavedTrail() {
  try {
    const saved = localStorage.getItem("savedTrail");
    if (!saved) {
      showToast("No saved trail found.");
      return;
    }

    const parsed = JSON.parse(saved);
    const maxAgeHours = 1;
    const ageHours = ((Date.now() - parsed.savedAt) / (1000 * 60 * 60)).toFixed(1);

    if (ageHours > maxAgeHours) {
      showToast("Saved trail is too old to recover (over 1 hour). It has been cleared.");
      localStorage.removeItem("savedTrail");
      return;
    }

    const originLabel = parsed.origin || "Unknown";
    const destLabel = parsed.destination || "Unknown";

    const confirmed = confirm(
      `Recover flight trail from ${originLabel} → ${destLabel}?\nSaved ${ageHours} hours ago.`
    );
    if (!confirmed) return;

    trailCoordinates = [];
    lastTrailPoint = null;

    trailLines.forEach(line => {
      if (map.hasLayer(line)) map.removeLayer(line);
    });
    trailLines = [];

    staticTrailLines.forEach(line => {
      if (line && map.hasLayer(line)) map.removeLayer(line);
    });
    staticTrailLines = [null, null, null];

    if (Array.isArray(parsed.staticSegments)) {
      parsed.staticSegments.forEach((segment, i) => {
        if (Array.isArray(segment) && segment.length > 0) {
          staticTrailLines[i] = L.polyline(segment, {
            color: trailColor,
            weight: lineThickness,
            opacity: 1
          }).addTo(map);
        }
      });
    }

    if (Array.isArray(parsed.trailCoordinates)) {
      trailCoordinates = parsed.trailCoordinates;

      const first = trailCoordinates[0];
      if (!first) {
        showToast("Saved trail is empty.");
        return;
      }

      const mirroredLons = [first[1], first[1] - 360, first[1] + 360];
      trailLines = mirroredLons.map((lon, i) => {
        return L.polyline([[first[0], lon]], {
          color: trailColor,
          weight: lineThickness,
          opacity: 1
        }).addTo(map);
      });

      for (let i = 1; i < trailCoordinates.length; i++) {
        const [lat, lon] = trailCoordinates[i];
        trailLines[0].addLatLng([lat, lon]);
        trailLines[1].addLatLng([lat, lon - 360]);
        trailLines[2].addLatLng([lat, lon + 360]);
      }
    }

    showToast("Previous flight trail recovered.");
  } catch (e) {
    console.warn("Failed to recover trail:", e);
    showToast("Could not load saved trail.");
  }
}


function clearRouteAndMapState() {
  resetFlightTimer();
  ['timeOrigin','timeDestination','timeRemaining','eta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '--:--';
  });
  ['distanceFromOrigin','distanceToDest'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '--';
  });
  if (routeMarkers && routeMarkers.length > 0) {
    routeMarkers.forEach(m => {
      if (map.hasLayer(m)) map.removeLayer(m);
    });
    routeMarkers = [];
  }

  if (liveArcLines && liveArcLines.length > 0) {
    liveArcLines.forEach(line => {
      if (map.hasLayer(line)) map.removeLayer(line);
    });
    liveArcLines = [];
  }

  trailLines.forEach(line => {
    if (map.hasLayer(line)) map.removeLayer(line);
  });
  trailLines = [];

  (staticTrailLines || []).forEach(line => {
    if (line && map.hasLayer(line)) map.removeLayer(line);
  });
  staticTrailLines = [null, null, null];

  trailCoordinates = [];
  lastTrailPoint = null;

  remainingSimBriefWaypoints = [];
  currentRoute = null;
  lastArcStart = null;

  document.getElementById("trimWaypointBtn").style.display = "none";

  document.getElementById("debugToggle").checked = false;
  toggleDebugPanel();
  debugStats.trailRedraws = 0;
  debugStats.arcRedraws = 0;
  debugStats.lastTrailDraw = null;
  debugStats.lastArcDraw = null;

  document.getElementById("originInput").value = "";
  document.getElementById("destInput").value = "";

  const labelRadios = document.querySelectorAll('input[name="labelType"]');
  labelRadios.forEach(radio => {
    radio.checked = (radio.value === "city");
  });
  map.eachLayer(layer => {
  if (layer instanceof L.Polyline) {
    map.removeLayer(layer);
  }
});
if (trailPolyline && map.hasLayer(trailPolyline)) {
  map.removeLayer(trailPolyline);
  trailPolyline = null;
}
try {
  const saved = localStorage.getItem("savedTrail");
const maxAgeHours = 60;

if (saved) {
  const parsed = JSON.parse(saved);
  const ageHours = (Date.now() - parsed.savedAt) / (1000 * 60);

  const currentOrigin = currentRoute?.origin?.icao || currentRoute?.origin?.city;
  const currentDest = currentRoute?.destination?.icao || currentRoute?.destination?.city;

  if (
    ageHours > maxAgeHours
  ) {
    localStorage.removeItem("savedTrail");
    console.log("Old or mismatched trail removed from localStorage.");
  } else {
    console.log("Trail is recent and matches flight plan — kept in localStorage.");
  }
}


} catch (e) {
  console.warn("Error checking trail age — removing to be safe.");
  localStorage.removeItem("savedTrail");
}

if (!localStorage.getItem("savedTrail")) {
  const btn = document.getElementById("recoverTrailBtn");
  if (btn) btn.disabled = true;
}

window.scrollTo(0, 0);
}

let arcLine = null;

function runTrailStressTest(durationHours = 12, speedupFactor = 1000) {
  console.log("Starting realistic trail stress test...");

  const start = { lat: 40.6413, lon: -73.7781 }; // JFK
  const end = { lat: 35.5494, lon: 139.7798 };   // Tokyo Haneda

  const totalSeconds = durationHours * 3600;
  const totalPoints = totalSeconds;
  const path = generateGreatCircle(start, end, totalPoints);

  let index = 0;
  const intervalMs = 1000 / speedupFactor;

  clearRouteAndMapState();
  trailCoordinates = [];
  trailLines = [];
  staticTrailLines = [null, null, null];
  lastKnownPosition = null;

  const interval = setInterval(() => {
    if (index >= path.length) {
      clearInterval(interval);
      console.log("Stress test completed.");
      return;
    }

    const [lat, lon] = path[index];
    const fakeAltitude = 31000;

    lastKnownPosition = {
      lat: lat,
      lon: lon,
      heading: index < path.length - 1 ? getBearing(lat, lon, ...path[index + 1]) : 0
    };

    updatePlaneIcon(lat, lon, lastKnownPosition.heading);
    updateFlightTrail(lat, lon, fakeAltitude);

    drawLiveGreatCircle(lat, lon);

    if (index % 60 === 0) {
      console.log(`[StressTest] Time: ${index}s — Trail: ${trailCoordinates.length} live, Static exists: ${staticTrailLines.some(l => l !== null)}`);
    }

    // map.setView([lat, lon], map.getZoom(), { animate: false });
    index++;
  }, intervalMs);
}

let uiHideTimer;
let uiIsHidden = false;

function showUIButtons() {
  document.querySelectorAll(".ui-button").forEach(el => {
    el.classList.remove("ui-hidden");
  });
  uiIsHidden = false;
}

function hideUIButtons() {
  document.querySelectorAll(".ui-button").forEach(el => {
    el.classList.add("ui-hidden");
  });
  uiIsHidden = true;
}

function resetUIHideTimer() {
  if (localStorage.getItem("forceUIHidden") === "true") return;

  if (uiIsHidden) showUIButtons();

  clearTimeout(uiHideTimer);
  uiHideTimer = setTimeout(() => {
    hideUIButtons();
  }, 15000);
}

["mousemove", "keydown", "mousedown", "touchstart"].forEach(event => {
  document.addEventListener(event, resetUIHideTimer, { passive: true });
});

window.addEventListener("load", resetUIHideTimer);

function initInfoBarSetting() {
  const checkbox = document.getElementById("infoBarToggle");
  const bar = document.getElementById("info-bar");
  if (!checkbox || !bar) return; // DOM not ready or elements missing

  let saved = localStorage.getItem("infoBarVisible");
  if (saved === null) {
    saved = "true";
    localStorage.setItem("infoBarVisible", "true");
  }

  const visible = (saved === "true");
  checkbox.checked = visible;
  bar.style.display = visible ? "flex" : "none";
}

function toggleInfoBar() {
  const checkbox = document.getElementById("infoBarToggle");
  const bar = document.getElementById("info-bar");
  if (!checkbox || !bar) return;

  const visible = !!checkbox.checked;
  bar.style.display = visible ? "flex" : "none";
  localStorage.setItem("infoBarVisible", visible ? "true" : "false");
}

function toggleAutoSimbrief() {
  const checkbox = document.getElementById("autoStealthModeToggle");
  const enabled = checkbox.checked;
  localStorage.setItem("autoLoadSimbrief", enabled);
}

function toggleUIPersistent() {
  const btn = document.getElementById("toggleUIBtn");
  const currentlyHidden = localStorage.getItem("forceUIHidden") === "true";
  const newState = !currentlyHidden;

  localStorage.setItem("forceUIHidden", newState);

  document.querySelectorAll(".ui-button").forEach(el => {
    el.classList.toggle("ui-hidden", newState);
  });

  if (btn) {
    btn.classList.toggle("dimmed", newState);
    const lang = localStorage.getItem("selectedLanguage") || "en";
btn.textContent = newState
  ? translations[lang]?.showUI || "Show UI"
  : translations[lang]?.hideUI || "Hide UI";

  }

  console.log("UI visibility toggled:", newState ? "hidden" : "shown");
}


function startApp() {
  const autoSimbriefToggle = document.getElementById("autoStealthModeToggle");
  const autoSimbriefPref = localStorage.getItem("autoLoadSimbrief") === "true";
  const forceHideUI = localStorage.getItem("forceUIHidden") === "true";
  const toggleBtn = document.getElementById("toggleUIBtn");
  const simbriefInput = document.getElementById("simbriefInput");
  const simbriefSetBtn = document.getElementById("setSimbriefBtn");
  const savedUsername = localStorage.getItem("simbriefUsername");

  if (simbriefInput && savedUsername) {
    simbriefInput.value = savedUsername;
  }

  if (simbriefSetBtn && simbriefInput) {
    simbriefSetBtn.addEventListener("click", () => {
      const value = simbriefInput.value.trim();
      if (value) {
        localStorage.setItem("simbriefUsername", value);
        showToast(translate("toastSimbriefSaved"));
      } else {
        localStorage.removeItem("simbriefUsername");
        showToast(translate("toastSimbriefCleared"));
      }
    });
  }

  if (forceHideUI && toggleBtn) {
    toggleBtn.classList.add("dimmed");
  }

  if (autoSimbriefToggle) autoSimbriefToggle.checked = autoSimbriefPref;

  if (autoSimbriefPref) {
    loadSimBrief(true);
  }

  if (forceHideUI) {
    document.querySelectorAll(".ui-button").forEach(el => {
      el.classList.add("ui-hidden");
    });
  }
if (toggleBtn) {
  toggleBtn.textContent = translate(forceHideUI ? "showUI" : "hideUI");
}


}

function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 400);
  }, duration);
}
function showPrompt(message, defaultValue = "", callback) {
  const disablePrompts = localStorage.getItem("disablePrompts") === "true";
  if (disablePrompts) {
    console.log("⚠️ Prompt suppressed by advanced config.");
    return;
  }

  const modal = document.getElementById("promptModal");
  const input = document.getElementById("promptInput");
  const msg = document.getElementById("promptMessage");
  const ok = document.getElementById("promptOk");
  const cancel = document.getElementById("promptCancel");

  msg.textContent = message;
  input.value = defaultValue;

  ok.textContent = translate("promptConfirm");
  cancel.textContent = translate("promptCancel");

  modal.style.display = "flex";
  input.focus();

  function closeModal(result) {
    modal.style.display = "none";
    ok.removeEventListener("click", onOk);
    cancel.removeEventListener("click", onCancel);
    callback(result);
  }

  function onOk() {
    closeModal(input.value.trim());
  }

  function onCancel() {
    closeModal(null);
  }

  ok.addEventListener("click", onOk);
  cancel.addEventListener("click", onCancel);
}

document.getElementById("trailColorPicker")?.addEventListener("input", e => {
  localStorage.setItem("trailColor", e.target.value);
});

document.getElementById("routeColorPicker")?.addEventListener("input", e => {
  localStorage.setItem("routeColor", e.target.value);
});

document.getElementById("lineThicknessRange")?.addEventListener("input", e => {
  localStorage.setItem("lineThickness", e.target.value);
});

document.getElementById("followToggle")?.addEventListener("change", e => {
  localStorage.setItem("followAircraft", e.target.checked ? "true" : "false");
});

window.addEventListener("load", () => {
Promise.all([
  fetch("/default_autosimbrief").then(res => res.json()),
  fetch("/default_simbrief").then(res => res.json()),
  fetch("/default_disable_prompts").then(res => res.json()),
  fetch("/default_disable_route_popup").then(res => res.json()),
  fetch("/default_custom_zoom_levels").then(res => res.json()),
  fetch("/msfs_config").then(res => res.json()).catch(() => ({}))
]).then(([autoData, simbriefData, promptData, routePopupData, zoomData, msfsConfig]) => {

    // Enable custom PLN directory radio if set in advanced_config
    if (msfsConfig.hasCustomPath) {
      const radio = document.getElementById("msfsCustomRadio");
      const label = document.getElementById("msfsCustomLabel");
      if (radio) { radio.disabled = false; }
      if (label) { label.style.opacity = "1"; label.style.cursor = "pointer"; label.title = ""; }
    }

    const toggle = document.getElementById("autoStealthModeToggle");
    const simbriefInput = document.getElementById("simbriefInput");

    if (autoData.auto === "yes") {
      localStorage.setItem("autoLoadSimbrief", "true");
      if (toggle) toggle.checked = true;
    }

    if (simbriefData.username) {
      localStorage.setItem("simbriefUsername", simbriefData.username);
      if (simbriefInput) simbriefInput.value = simbriefData.username;
      showToast(translate("toastSimBriefFile"));
    } else {
      const stored = localStorage.getItem("simbriefUsername");
      if (simbriefInput && stored) {
        simbriefInput.value = stored;
      }
    }

    if (promptData.disable === "yes") {
      localStorage.setItem("disablePrompts", "true");
    }
    else {
    localStorage.setItem("disablePrompts", "");
    }
if (routePopupData.disable === "yes") {
  localStorage.setItem("disableRoutePopup", "true");
} else {
  localStorage.setItem("disableRoutePopup", "");
}

  const savedAutoZoom = localStorage.getItem("cycleZoomEnabled");
  const autoZoomCheckbox = document.getElementById("cycleZoomToggle");

  if (autoZoomCheckbox) {
    if (savedAutoZoom === "true") {
      autoZoomCheckbox.checked = true;
      cycleZoomActive = true;
      toggleCycleZoom();
    } else {
      autoZoomCheckbox.checked = false;
      cycleZoomActive = false;
    }
  }
  const airborneOnlyCbInit = document.getElementById("cycleZoomAirborneOnly");
  if (airborneOnlyCbInit) {
    airborneOnlyCbInit.checked  = cycleZoomAirborneOnly;
    airborneOnlyCbInit.disabled = !cycleZoomActive;
  }
  const savedZoomSpeed = localStorage.getItem("zoomCycleSpeed");
  const zoomSpeedSelect = document.getElementById("zoomSpeedSelect");

  if (zoomSpeedSelect) {
    if (savedZoomSpeed) {
      zoomSpeedSelect.value = savedZoomSpeed;
    } else {
      zoomSpeedSelect.value = "normal";
    }
    updateZoomSpeed();
  }
  const savedUnitSystem = localStorage.getItem("unitSystem");
  const unitSelect = document.getElementById("unitSystemSelect");

  if (unitSelect) {
    if (savedUnitSystem) {
      unitSelect.value = savedUnitSystem;
      unitSystem = savedUnitSystem;
    } else {
      unitSelect.value = "auto";
      unitSystem = "auto";
    }

    updateUnitSystem();
    updateUnitSystem();
  }

const trailColorInput = document.getElementById("trailColorPicker");
if (trailColorInput) trailColorInput.value = trailColor;

const routeColorInput = document.getElementById("routeColorPicker");
if (routeColorInput) routeColorInput.value = routeLineColor;

const thicknessInput = document.getElementById("lineThicknessRange");
if (thicknessInput) thicknessInput.value = lineThickness;

const followCheckbox = document.getElementById("followToggle");
if (followCheckbox) followCheckbox.checked = followPlane;
const followDelaySelect = document.getElementById("followDelaySelect");
if (followDelaySelect) {
  followDelaySelect.value = String(followRecenterDelay);
}
const delaySelect = document.getElementById("followDelaySelect");
if (delaySelect) {
  delaySelect.disabled = !followPlane;
}
const ICON_COLORS = ["black","white","grey", "red","orange","yellow","green", "lightGreen", "blue", "lightBlue", "purple", "pink"];

let savedColor = localStorage.getItem("aircraftIconColor");
if (!savedColor || !ICON_COLORS.includes(savedColor)) {
  savedColor = "black";
  localStorage.setItem("aircraftIconColor", "black");
}

let savedBase = localStorage.getItem("aircraftIconBase");
if (!savedBase) {
  const legacy = localStorage.getItem("aircraftIconFile");
  if (legacy && legacy.endsWith(".png")) {
    savedBase = legacy
      .replace(/\.png$/, "")
      .replace(/_(black|white|red|orange|yellow|green|blue|pink)$/, "");
  } else {
    savedBase = "plane_icon";
  }
  localStorage.setItem("aircraftIconBase", savedBase);
}

aircraftIconBase = savedBase;
aircraftIconColor = savedColor;

aircraftIconFile = `${aircraftIconBase}_${aircraftIconColor}.png`;
localStorage.setItem("aircraftIconFile", aircraftIconFile);

initIconColorPicker();

if (lastKnownPosition) {
  updatePlaneIcon(lastKnownPosition.lat, lastKnownPosition.lon, lastKnownPosition.heading || 0);
}

const iconSelect = document.getElementById("iconSelect");
if (iconSelect && aircraftIconBase) {
  const baseName = aircraftIconBase.replace(/\.png$/, "").replace(/_(black|white|red|orange|yellow|green|blue|pink)$/, "");

  for (const opt of iconSelect.options) {
    const optBase = opt.value.replace(/\.png$/, "").replace(/_(black|white|red|orange|yellow|green|blue|pink)$/, "");
    if (optBase === baseName) {
      iconSelect.value = opt.value;
      break;
    }
  }
}


    startApp();


    const disable_Route_Popup = localStorage.getItem("disableRoutePopup") === "true";
if (!disable_Route_Popup && localStorage.getItem("autoLoadSimbrief") !== "true") {
  showRouteModal();
}
let customZoomLevels = null;

if (
  Array.isArray(zoomData?.levels) &&
  zoomData.levels.length > 0 &&
  zoomData.levels.every(z => typeof z === "number" && z >= 0 && z <= 20)
) {
  customZoomLevels = zoomData.levels;
  localStorage.setItem("customZoomLevels", JSON.stringify(customZoomLevels));
  zoomLevels = customZoomLevels;
  console.log("[Advanced Config] Using custom zoom levels:", customZoomLevels);
} else {
  localStorage.removeItem("customZoomLevels");
  customZoomLevels = null;
  console.log("[Advanced Config] No custom zoom levels — using defaults.");
}

  });

  const savedFontSize = localStorage.getItem("infoBarFontSize") || "14";
  const slider = document.getElementById("infoBarFontRange");
  const bar = document.getElementById("info-bar");
  if (slider && bar) {
    slider.value = savedFontSize;
    bar.style.fontSize = savedFontSize + "px";
  }

initCityLabelScale();

  const etaSelect = document.getElementById("etaModeSelect");
if (etaSelect) {
  etaSelect.value = etaMode;
}
const dayNightCheckbox = document.getElementById("dayNightToggle");
if (dayNightCheckbox) {
  const saved = localStorage.getItem("dayNightEnabled");
  const enabled = (saved === "true");

  dayNightCheckbox.checked = enabled;
  dayNightEnabled = enabled;

  if (dayNightEnabled) {
    if (latestData?.sim_time_utc && latestData?.zulu_day && latestData?.zulu_month) {
      updateDayNight(latestData.sim_time_utc, latestData.zulu_day, latestData.zulu_month);
    }
  }
}


});
