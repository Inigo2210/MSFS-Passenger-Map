
if (!window._hasPersonalToken) {
  const params = new URLSearchParams(window.location.search);
  params.set('mode', 'classic');
  window.location.replace(window.location.pathname + '?' + params.toString());
  throw new Error('globe.js blocked: no personal Cesium Ion token.');
}

const _use3DTerrain = true;
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: _use3DTerrain ? Cesium.Terrain.fromWorldTerrain() : undefined,
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  infoBox: false
});

viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
viewer.scene.highDynamicRange = false;
viewer.scene.postProcessStages.fxaa.enabled = false;
viewer.scene.fxaa = false;
viewer.scene.globe.enableLighting = localStorage.getItem("globeLighting") !== "false";
viewer.scene.maximumRenderTimeChange = Infinity;
viewer.scene.requestRenderMode = true;
viewer.useDefaultRenderLoop = true;
viewer.targetFrameRate = 30;

window._globeViewer = viewer;


if (typeof initImageryPicker === "function") {
  initImageryPicker(viewer, window._hasPersonalToken || false);
}

const SHOW_REAL_ALTITUDE = true;

const GROUND_AGL_THRESHOLD_FT = 50;


const ROUTE_GROUND_MIN_ALT_M = 4572; // 15,000 ft

function simAltToMetres(altFeet) {
  if (!SHOW_REAL_ALTITUDE) return 0;
  return (altFeet || 0) * 0.3048;
}


function isOnGround(data) {
  if (!SHOW_REAL_ALTITUDE) return false;
  const agl = data?.ground_alt ?? data?.groundAlt ?? null;
  if (agl === null || agl === undefined) return false;
  return agl < GROUND_AGL_THRESHOLD_FT;
}


let trailColorCss   = localStorage.getItem("globeTrailColor")    || "#ff0000";
let routeColorCss   = localStorage.getItem("globeRouteLineColor") || "#ffffff";
let lineThickness   = parseInt(localStorage.getItem("lineThickness") || "3", 10);
let unitSystem      = localStorage.getItem("unitSystem") || "auto";
let etaMode         = localStorage.getItem("etaMode")    || "dest";
let followAircraft      = localStorage.getItem("followAircraft") === "true";
let followRecenterDelay = parseInt(localStorage.getItem("followRecenterDelay") || "3000", 10);
let _lastManualCameraMove    = Date.now();
let _programmaticMoveCount   = 0;

const ICON_COLORS = [
  "black","white","grey","red","orange","yellow","green","lightGreen","blue","lightBlue","purple","pink"
];

let globeAircraftModel = localStorage.getItem("globeAircraftModel") || "A320";
let globeModelColor    = localStorage.getItem("globeModelColor")    || "black";
if (!ICON_COLORS.includes(globeModelColor)) globeModelColor = "black";

const GLOBE_MODEL_COLORS = {
  black:      new Cesium.Color(0,     0,     0,     1),
  white:      new Cesium.Color(1,     1,     1,     1),
  grey:       new Cesium.Color(0.6,   0.6,   0.6,   1),
  red:        new Cesium.Color(1,     0,     0,     1),
  orange:     new Cesium.Color(1,     0.635, 0,     1),
  yellow:     new Cesium.Color(1,     0.94,  0.204, 1),
  green:      new Cesium.Color(0.075, 0.553, 0.114, 1),
  lightGreen: new Cesium.Color(0.333, 1,     0,     1),
  blue:       new Cesium.Color(0.043, 0.325, 0.576, 1),
  lightBlue:  new Cesium.Color(0,     1,     1,     1),
  purple:     new Cesium.Color(0.737, 0.004, 0.914, 1),
  pink:       new Cesium.Color(1,     0,     0.706, 1),
};

function getGlobeModelColor() {
  return GLOBE_MODEL_COLORS[globeModelColor] || Cesium.Color.WHITE;
}

function getGlobeModelUri() {
  return `/static/img/${globeAircraftModel}.glb`;
}


const GLOBE_MODEL_SCALES = {
  "GA":               { minimumPixelSize:40,  scale: 0.2 },
  "ATR":              { minimumPixelSize: 48,  scale: 1.2 },
  "CRJ":              { minimumPixelSize: 52,  scale: 15  },
  "737":              { minimumPixelSize: 56, scale: 2.5  },
  "A320":             { minimumPixelSize: 56,  scale: 19  },
  "A330":             { minimumPixelSize: 62,  scale: 1   },
  "A340":             { minimumPixelSize: 66,  scale: 1  },
  "A350":             { minimumPixelSize: 70,  scale: 1  },
  "757":              { minimumPixelSize: 32,  scale: 1.2  },
  "767":              { minimumPixelSize: 60,  scale: .5  },
  "777":              { minimumPixelSize: 67,  scale: 1  },
  "787":              { minimumPixelSize: 67,  scale: 1  },
  "E-Jet":            { minimumPixelSize: 56,  scale: 1.5  },
  "business_jet":     { minimumPixelSize: 35,  scale: 3  },
  "GA_Twin":          { minimumPixelSize: 48,  scale: 7  },
  "Helicopter":       { minimumPixelSize: 52,  scale: 4  },
  "Military":         { minimumPixelSize: 52,  scale: 4  },
  "A380":             { minimumPixelSize: 56,  scale: 6  },
  "747":              { minimumPixelSize: 48,  scale: 1  },
  "Custom":            { minimumPixelSize: 56,  scale: 1  },

};

function getModelScale() {
  return GLOBE_MODEL_SCALES[globeAircraftModel] || { minimumPixelSize: 48, scale: 60 };
}

function cssToCesiumColor(css) {
  try { return Cesium.Color.fromCssColorString(css); }
  catch { return Cesium.Color.RED; }
}

let trailColor = cssToCesiumColor(trailColorCss);
let routeColor = cssToCesiumColor(routeColorCss);

const unitPresets = {
  auto:     null,
  imperial: { distance: 'mi', altitude: 'ft', speed: 'mph' },
  metric:   { distance: 'km', altitude: 'm',  speed: 'kmh' },
  aviation: { distance: 'nm', altitude: 'ft', speed: 'kts' }
};
const unitModes = {
  distance: ['nm', 'mi', 'km'],
  altitude: ['ft', 'm'],
  speed:    ['kts','mph','kmh']
};
let currentUnits = { distance: 0, altitude: 0, speed: 0 };

const autoPresets = [
  { distance: 'nm', altitude: 'ft', speed: 'kts' },
  { distance: 'mi', altitude: 'ft', speed: 'mph' },
  { distance: 'km', altitude: 'm',  speed: 'kmh' }
];
let autoIndex = 0;
setInterval(() => {
  if (unitSystem !== 'auto') return;
  autoIndex = (autoIndex + 1) % autoPresets.length;
  const p = autoPresets[autoIndex];
  currentUnits = {
    distance: unitModes.distance.indexOf(p.distance),
    altitude: unitModes.altitude.indexOf(p.altitude),
    speed:    unitModes.speed.indexOf(p.speed)
  };
}, 15000);

function applyUnitSystem() {
  if (unitSystem === 'auto') return;
  const p = unitPresets[unitSystem];
  if (!p) return;
  currentUnits = {
    distance: unitModes.distance.indexOf(p.distance),
    altitude: unitModes.altitude.indexOf(p.altitude),
    speed:    unitModes.speed.indexOf(p.speed)
  };
}
applyUnitSystem();

function convertDistance(nm) {
  switch (unitModes.distance[currentUnits.distance]) {
    case 'mi': return nm * 1.15078;
    case 'km': return nm * 1.852;
    default:   return nm;
  }
}
function convertAltitude(ft) {
  return unitModes.altitude[currentUnits.altitude] === 'm' ? ft * 0.3048 : ft;
}
function convertSpeed(kts) {
  switch (unitModes.speed[currentUnits.speed]) {
    case 'mph': return kts * 1.15078;
    case 'kmh': return kts * 1.852;
    default:    return kts;
  }
}

const NM_EARTH_RADIUS = 3440.065;
function toRad(d){ return d*Math.PI/180; }
function toDeg(r){ return r*180/Math.PI; }

function getDistanceNM(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * NM_EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function buildSimUTCDate(data) {
  if (!data?.sim_time_utc) return null;
  const [hh, mm, ss] = data.sim_time_utc.split(":").map(Number);
  const year  = new Date().getUTCFullYear();
  const month = (data.zulu_month ?? 1) - 1;
  const day   = data.zulu_day ?? 1;
  return new Date(Date.UTC(year, month, day, hh||0, mm||0, ss||0));
}

function greatCirclePositions(start, end, steps = 128) {
  let lat1 = toRad(start.lat), lon1 = toRad(start.lon);
  let lat2 = toRad(end.lat),   lon2 = toRad(end.lon);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1-f)*d) / Math.sin(d);
    const B = Math.sin(f*d)     / Math.sin(d);
    const x = A*Math.cos(lat1)*Math.cos(lon1) + B*Math.cos(lat2)*Math.cos(lon2);
    const y = A*Math.cos(lat1)*Math.sin(lon1) + B*Math.cos(lat2)*Math.sin(lon2);
    const z = A*Math.sin(lat1) + B*Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x*x + y*y));
    const lon = Math.atan2(y, x);
    out.push(lon, lat);
  }
  return Cesium.Cartesian3.fromRadiansArray(out);
}


let routeEntity       = null;
let routeMarkers      = [];
let trailEntity       = null;
let currentRoute      = null;
let remainingSimBriefWaypoints = [];
let lastKnown         = null;
let groundSpeedBuffer = [];
const SPEED_BUFFER_SIZE = 5;


const AIRBORNE_SPEED_THRESHOLD_KTS = 50;
let _timerAccumSec  = 0;
let _timerLastSec   = null;
let _timerAirborne  = false;


let _routePositionsArray = [];
let routePositionsProperty = new Cesium.CallbackProperty(() => _routePositionsArray, false);
let isSimBriefRoute = false;


let _lastRouteKey = null;
let _lastSimBriefKey = null;

function resetRouteEntities() {
  if (routeEntity) viewer.entities.remove(routeEntity);
  routeEntity = null;
  _routePositionsArray.length = 0;
  isSimBriefRoute = false;
  _lastRouteKey = null;
  _lastSimBriefKey = null;

  routeMarkers.forEach(e => viewer.entities.remove(e));
  routeMarkers = [];
  remainingSimBriefWaypoints = [];
}

function resetTrail() {
  if (trailEntity) viewer.entities.remove(trailEntity);
  trailEntity = null;
  trailPositionsProperty = new Cesium.CallbackProperty(() => _trailPositionsArray, false);
  _trailPositionsArray.length = 0;
  _trailStaticArrays.forEach(s => {
    s.posArray.length = 0;
    s.entity.polyline.show = false;
  });
  _trailStaticIndex = 0;
  _lastTrailLat = null;
  _lastTrailLon = null;
}

function clearAll() {
  resetRouteEntities();
  resetTrail();
  resetFlightTimer();
  currentRoute = null;
  ['distanceFromOrigin','distanceToDest','timeRemaining','eta','timeOrigin','timeDestination'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '--:--';
  });
  const dfo = document.getElementById('distanceFromOrigin');
  const dtd = document.getElementById('distanceToDest');
  if (dfo) dfo.textContent = '--';
  if (dtd) dtd.textContent = '--';
  const trimBtn = document.getElementById('trimWaypointBtn');
  if (trimBtn) trimBtn.style.display = 'none';

  if (_aircraftEntity) {
    viewer.entities.remove(_aircraftEntity);
    _aircraftEntity      = null;
    _aircraftPosProp     = null;
    _aircraftOriProp     = null;
    _aircraftSampleCount = 0;
  }

  setModeSwitchDisabled(false);
}


function labelFor(airport, labelType) {
  const t = (labelType || 'city');
  const v = (airport && typeof airport[t] === 'string' && airport[t].trim()) ? airport[t].trim() : airport?.city || '';
  return v || '';
}
function addAirportMarkerWithLabel(lat, lon, label) {
  const pin = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    point: {
      pixelSize: 8,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2
    }
  });
  const lab = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    label: {
      text: label,
      font: 'bold 16px "Segoe UI", Roboto, sans-serif',
      scale: cityLabelScale,
      fillColor: Cesium.Color.fromCssColorString('#0033cc'),
      style: Cesium.LabelStyle.FILL,
      pixelOffset: new Cesium.Cartesian2(0, -28),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      showBackground: true,
      backgroundColor: Cesium.Color.WHITE,
      backgroundPadding: new Cesium.Cartesian2(10, 6),
      backgroundCornerRadius: new Cesium.Cartesian2(4, 4),
      translucencyByDistance: new Cesium.NearFarScalar(1.0e2, 1.0, 1.0e7, 0.9)
    }
  });
  routeMarkers.push(pin, lab);
}

function drawRouteMarkers() {
  if (!currentRoute?.origin || !currentRoute?.destination) return;
  routeMarkers.forEach(e => viewer.entities.remove(e));
  routeMarkers = [];
  const lt = currentRoute.labelType || 'city';
  addAirportMarkerWithLabel(currentRoute.origin.lat,      currentRoute.origin.lon,      labelFor(currentRoute.origin, lt));
  addAirportMarkerWithLabel(currentRoute.destination.lat, currentRoute.destination.lon, labelFor(currentRoute.destination, lt));

  const o = currentRoute.origin;
  const d = currentRoute.destination;
  const toR = deg => deg * Math.PI / 180;
  const tD  = rad => rad * 180 / Math.PI;
  const lat1 = toR(o.lat), lon1 = toR(o.lon);
  const lat2 = toR(d.lat), lon2 = toR(d.lon);
  const Bx = Math.cos(lat2) * Math.cos(lon2 - lon1);
  const By = Math.cos(lat2) * Math.sin(lon2 - lon1);
  const midLat = tD(Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2)
  ));
  const midLon = tD(lon1 + Math.atan2(By, Math.cos(lat1) + Bx));

  const distNM = getDistanceNM(o.lat, o.lon, d.lat, d.lon);
  const distKm = distNM * 1.852;
  const angRad = distKm / 6371;
  const viewHeight = Math.min(18000000, Math.max(1500000, 6371000 * Math.tan(angRad / 2) * 2.4));

  _programmaticMoveCount++;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(midLon, midLat, viewHeight),
    duration: 1.5,
    complete: () => { _programmaticMoveCount--; },
    cancel:   () => { _programmaticMoveCount--; }
  });
}

function updateLabelType() {
  const sel = document.getElementById("labelTypeSelect");
  if (!sel || !currentRoute) return;
  currentRoute.labelType = sel.value;
  drawRouteMarkers();
}

let _aircraftEntity      = null;
let _aircraftPosProp     = null;
let _aircraftOriProp     = null;
let _aircraftLat         = 0;
let _aircraftLon         = 0;
let _aircraftHeading     = 0;
let _aircraftSampleCount = 0;
const AIRCRAFT_MAX_SAMPLES = 10;

const HEADING_MODEL_OFFSET_DEG = -45;

function ensureAircraftEntity() {
  if (_aircraftEntity) return;

  _aircraftPosProp = new Cesium.SampledPositionProperty();
  _aircraftPosProp.forwardExtrapolationType  = Cesium.ExtrapolationType.HOLD;
  _aircraftPosProp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

  _aircraftOriProp = new Cesium.ConstantProperty(Cesium.Quaternion.IDENTITY);

  _aircraftEntity = viewer.entities.add({
    position:    _aircraftPosProp,
    orientation: _aircraftOriProp,
    model: {
      uri:                      getGlobeModelUri(),
      scale:                    getModelScale().scale,
      minimumPixelSize:         getModelScale().minimumPixelSize,
      heightReference:          Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      color:                    getGlobeModelColor(),
      colorBlendMode:           Cesium.ColorBlendMode.MIX,
      colorBlendAmount:         0.5,
      silhouetteColor:          Cesium.Color.WHITE,
      silhouetteSize:           1.0,
    }
  });
}

function updateAircraft(lat, lon, alt, headingDeg) {
  _aircraftLat     = lat;
  _aircraftLon     = lon;
  _aircraftHeading = headingDeg || 0;
  ensureAircraftEntity();

  const onGround = isOnGround(latestData);

  const desiredHR = onGround
    ? Cesium.HeightReference.RELATIVE_TO_GROUND
    : Cesium.HeightReference.NONE;
  if (_aircraftEntity.model.heightReference !== desiredHR) {
    _aircraftEntity.model.heightReference = desiredHR;
  }

  const position = Cesium.Cartesian3.fromDegrees(lon, lat, onGround ? 0 : simAltToMetres(alt));

  _aircraftSampleCount++;
  if (_aircraftSampleCount > AIRCRAFT_MAX_SAMPLES) {
    _aircraftPosProp = new Cesium.SampledPositionProperty();
    _aircraftPosProp.forwardExtrapolationType  = Cesium.ExtrapolationType.HOLD;
    _aircraftPosProp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
    _aircraftEntity.position = _aircraftPosProp;
    _aircraftSampleCount = 1;
  }
  _aircraftPosProp.addSample(viewer.clock.currentTime, position);

  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians((_aircraftHeading + HEADING_MODEL_OFFSET_DEG) % 360), 0, 0
  );
  _aircraftOriProp.setValue(
    Cesium.Transforms.headingPitchRollQuaternion(position, hpr)
  );
}




let _trailPositionsArray = [];
let trailPositionsProperty = new Cesium.CallbackProperty(() => _trailPositionsArray, false);

const TRAIL_LIVE_MAX   = 500;
const TRAIL_DOWNSAMPLE = 3;
let _lastTrailLat = null;
let _lastTrailLon = null;

const TRAIL_STATIC_SLOTS = 400;

let _trailStaticArrays = [];
let _trailStaticIndex  = 0;

function _downsampleTrail(arr, step) {
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (arr.length > 0 && (arr.length - 1) % step !== 0) out.push(arr[arr.length - 1]);
  return out;
}

function _initTrailStaticSlots() {
  for (let i = 0; i < TRAIL_STATIC_SLOTS; i++) {
    const posArray = [];
    const prop = new Cesium.CallbackProperty((() => {
      const arr = posArray;
      return () => arr.length >= 2 ? arr : null;
    })(), false);
    const entity = viewer.entities.add({
      polyline: {
        positions:         prop,
        width:             lineThickness,
        clampToGround:     !SHOW_REAL_ALTITUDE,
        material:          new Cesium.ColorMaterialProperty(trailColor),
        depthFailMaterial: new Cesium.ColorMaterialProperty(trailColor),
        show:              false,
      }
    });
    _trailStaticArrays.push({ posArray, prop, entity });
  }
}
_initTrailStaticSlots();

function ensureTrailEntity() {
  if (trailEntity) return;
  if (_trailPositionsArray.length < 2) return;
  trailEntity = viewer.entities.add({
    polyline: {
      positions:         trailPositionsProperty,
      width:             lineThickness,
      clampToGround:     !SHOW_REAL_ALTITUDE,
      material:          new Cesium.ColorMaterialProperty(trailColor),
      depthFailMaterial: new Cesium.ColorMaterialProperty(trailColor),
    }
  });
}

function _flushTrailToStatic() {
  const downsampled = _downsampleTrail(_trailPositionsArray, TRAIL_DOWNSAMPLE);
  if (downsampled.length >= 2 && _trailStaticIndex < TRAIL_STATIC_SLOTS) {
    const slot = _trailStaticArrays[_trailStaticIndex++];

    slot.posArray.length = 0;
    downsampled.forEach(p => slot.posArray.push(p));
    slot.entity.polyline.show = true;
  }

  const last = _trailPositionsArray[_trailPositionsArray.length - 1];
  _trailPositionsArray.length = 0;
  if (last) _trailPositionsArray.push(last);
}

function pushTrailPosition(lat, lon, alt) {
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return;

  const minDistNM = (alt || 0) > 25000 ? 0.27 : 0.017;
  if (_lastTrailLat !== null &&
      getDistanceNM(lat, lon, _lastTrailLat, _lastTrailLon) < minDistNM) return;

  _lastTrailLat = lat;
  _lastTrailLon = lon;


  if (_trailPositionsArray.length >= TRAIL_LIVE_MAX) _flushTrailToStatic();

  _trailPositionsArray.push(Cesium.Cartesian3.fromDegrees(
    lon, lat, isOnGround(latestData) ? 5 : simAltToMetres(alt)
  ));
  ensureTrailEntity();
}

function redrawTrail() {
}


function clearRouteLine() {
  if (routeEntity) viewer.entities.remove(routeEntity);
  routeEntity = null;
  _routePositionsArray.length = 0;
  isSimBriefRoute = false;
  _lastRouteKey = null;
  _lastSimBriefKey = null;
}

function drawDashedToDestination(from, to) {
  try {
    const routeKey = `${from.lat.toFixed(4)}:${from.lon.toFixed(4)}`;
    if (routeEntity && !isSimBriefRoute && _lastRouteKey === routeKey) return;
    _lastRouteKey = routeKey;

    const gcPositions = greatCirclePositions(
      { lat: from.lat, lon: from.lon },
      { lat: to.lat,   lon: to.lon   },
      128
    );
    if (!gcPositions || gcPositions.length < 4) return;

    const ROUTE_FLOOR_M    = 4572;  // 15,000ft
    const ROUTE_FLOOR_NM   = 200;
    const fromAltM         = simAltToMetres(from.alt || 0);
    const destElevM        = (currentRoute?.destination?.elevation || 0) * 0.3048;
    const altRange         = fromAltM - destElevM;
    const distFromOriginNM = currentRoute?.origin
      ? getDistanceNM(from.lat, from.lon, currentRoute.origin.lat, currentRoute.origin.lon)
      : 9999;
    const applyFloor = (from.alt || 0) < 15000 && distFromOriginNM < ROUTE_FLOOR_NM;
    const lastIdx    = gcPositions.length - 1;
    const altPositions = gcPositions.map((p, i) => {
      const c      = Cesium.Cartographic.fromCartesian(p);
      const frac   = lastIdx > 0 ? i / lastIdx : 0;
      const eased  = 1 - Math.pow(frac, 3);
      const interp = destElevM + altRange * eased;
      const altM   = (applyFloor && i !== 0 && i !== lastIdx)
        ? Math.max(interp, ROUTE_FLOOR_M)
        : interp;
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, altM);
    });

    if (routeEntity && routeEntity.polyline && !isSimBriefRoute) {
      _routePositionsArray.length = 0;
      altPositions.forEach(p => _routePositionsArray.push(p));
      return;
    }

    if (routeEntity) viewer.entities.remove(routeEntity);
    _routePositionsArray = [...altPositions];
    routePositionsProperty = new Cesium.CallbackProperty(() => _routePositionsArray, false);
    isSimBriefRoute = false;

    routeEntity = viewer.entities.add({
      polyline: {
        positions:         routePositionsProperty,
        width:             lineThickness,
        clampToGround:     false,
        arcType:           Cesium.ArcType.GEODESIC,
        material:          new Cesium.ColorMaterialProperty(
          cssToCesiumColor(routeColorCss).withAlpha(1.0)
        ),
        depthFailMaterial: new Cesium.ColorMaterialProperty(
          cssToCesiumColor(routeColorCss).withAlpha(1.0)
        ),
      }
    });
  } catch (err) {
    console.error("Failed to draw route:", err);
  }
}


function drawSimBriefPoly(points) {
  const simKey = `${points[0]?.[0]?.toFixed(4)}:${points[0]?.[1]?.toFixed(4)}:${points.length}`;
  _lastSimBriefKey = simKey;

  const ROUTE_FLOOR_M    = 4572;
  const ROUTE_FLOOR_NM   = 200;
  const sbFromAltM       = lastKnown ? simAltToMetres(lastKnown.alt) : 0;
  const sbDestElevM      = (currentRoute?.destination?.elevation || 0) * 0.3048;
  const sbDistFromOrigin = currentRoute?.origin && lastKnown
    ? getDistanceNM(lastKnown.lat, lastKnown.lon, currentRoute.origin.lat, currentRoute.origin.lon)
    : 9999;
  const sbApplyFloor  = lastKnown && (lastKnown.alt || 0) < 15000 && sbDistFromOrigin < ROUTE_FLOOR_NM;
  const sbCruiseAltM  = sbApplyFloor ? Math.max(sbFromAltM, ROUTE_FLOOR_M) : sbFromAltM;
  const lastIdx       = points.length - 1;

  const positions = points.map(([la, lo], i) => {
    let altM;
    if (i === 0) {
      altM = sbFromAltM;
    } else if (i === lastIdx) {
      altM = sbDestElevM;
    } else {
      altM = sbCruiseAltM;
    }
    return Cesium.Cartesian3.fromDegrees(lo, la, altM);
  });

  if (routeEntity && routeEntity.polyline && isSimBriefRoute) {
    _routePositionsArray.length = 0;
    positions.forEach(p => _routePositionsArray.push(p));
    return;
  }

  if (routeEntity) viewer.entities.remove(routeEntity);
  _routePositionsArray = [...positions];
  routePositionsProperty = new Cesium.CallbackProperty(() => _routePositionsArray, false);
  isSimBriefRoute = true;

  routeEntity = viewer.entities.add({
    polyline: {
      positions:         routePositionsProperty,
      width:             lineThickness,
      clampToGround:     false,
      arcType:           Cesium.ArcType.GEODESIC,
      material:          new Cesium.ColorMaterialProperty(routeColor.withAlpha(1.0)),
      depthFailMaterial: new Cesium.ColorMaterialProperty(routeColor.withAlpha(1.0)),
    }
  });
}


let latestData = null;

function formatElapsed(totalSec) {
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function updateFlightTimer(data) {
  const agl   = data?.ground_alt ?? null;
  const spd   = data?.ground_speed ?? 0;
  const simSec = data?.sim_time_seconds ?? null;
  const simRate = Number(data?.sim_rate) > 0 ? Number(data.sim_rate) : 1;

  const airborne = (agl === null || agl > GROUND_AGL_THRESHOLD_FT) &&
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
  if (el) {
    el.textContent = _timerAccumSec > 0 ? formatElapsed(_timerAccumSec) : '--:--';
  }
}

function resetFlightTimer() {
  _timerAccumSec  = 0;
  _timerLastSec   = null;
  _timerAirborne  = false;
  const el = document.getElementById('timeElapsed');
  if (el) el.textContent = '--:--';
}

function updateInfoBar() {
  if (!latestData) return;
  updateFlightTimer(latestData);

  const altVal = convertAltitude(latestData.altitude || 0);
  const altEl  = document.getElementById('altitude');
  if (altEl) altEl.textContent = isNaN(altVal) ? '--' : `${altVal.toFixed(0)} ${unitModes.altitude[currentUnits.altitude]}`;

  const spdVal = convertSpeed(latestData.ground_speed || 0);
  const gsEl   = document.getElementById('groundSpeed');
  if (gsEl) gsEl.textContent = isNaN(spdVal) ? '--' : `${spdVal.toFixed(0)} ${unitModes.speed[currentUnits.speed]}`;

  if (currentRoute && latestData.latitude && latestData.longitude) {
    const fromOriginNm = getDistanceNM(latestData.latitude, latestData.longitude, currentRoute.origin.lat, currentRoute.origin.lon);
    const toDestNm     = getDistanceNM(latestData.latitude, latestData.longitude, currentRoute.destination.lat, currentRoute.destination.lon);

    const dfoEl = document.getElementById('distanceFromOrigin');
    if (dfoEl) dfoEl.textContent = `${convertDistance(fromOriginNm).toFixed(0)} ${unitModes.distance[currentUnits.distance]}`;

    const dtdEl = document.getElementById('distanceToDest');
    if (dtdEl) dtdEl.textContent = `${convertDistance(toDestNm).toFixed(0)} ${unitModes.distance[currentUnits.distance]}`;

    const timeRemEl = document.getElementById('timeRemaining');
    const etaEl     = document.getElementById('eta');

    if (latestData.ground_speed > 50) {
      groundSpeedBuffer.push(latestData.ground_speed);
      if (groundSpeedBuffer.length > SPEED_BUFFER_SIZE) groundSpeedBuffer.shift();
      const avg = groundSpeedBuffer.reduce((a,b)=>a+b,0) / groundSpeedBuffer.length;

      if (avg > 50) {
        const hours     = toDestNm / avg;
        const totalMins = hours * 60;
        const hr  = Math.floor(totalMins / 60);
        const min = Math.round(totalMins % 60);
        if (timeRemEl) timeRemEl.textContent = `${hr}:${String(min).padStart(2,'0')}`;

        let etaStr = "--:--";
        if (etaMode === "dest" && currentRoute.destination?.tz && latestData.sim_time_utc) {
          const simDateUTC = buildSimUTCDate(latestData);
          if (simDateUTC) {
            const etaDate = new Date(simDateUTC.getTime() + totalMins * 60000);
            try {
              etaStr = etaDate.toLocaleTimeString("en-US", {
                timeZone: currentRoute.destination.tz,
                hour: "2-digit", minute: "2-digit", hour12: false
              });
            } catch { /* ignore TZ issues */ }
          }
        } else if (etaMode === "local") {
          const now = new Date();
          const sr  = Number(latestData.sim_rate) > 0 ? Number(latestData.sim_rate) : 1;
          const adjusted = sr >= 1 ? (totalMins*60000)/sr : (totalMins*60000)*(1/sr);
          etaStr = new Date(now.getTime() + adjusted).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", hour12: false
          });
        }
        if (etaEl) etaEl.textContent = etaStr;
      } else {
        if (timeRemEl) timeRemEl.textContent = "--:--";
        if (etaEl) etaEl.textContent = "--:--";
      }
    } else {
      groundSpeedBuffer = [];
      if (timeRemEl) timeRemEl.textContent = "--:--";
      if (etaEl) etaEl.textContent = "--:--";
    }
  }

  if (latestData.sim_time_utc && currentRoute?.origin?.tz && currentRoute?.destination?.tz) {
    const simDateUTC = buildSimUTCDate(latestData);
    if (simDateUTC) {
      try {
        const oEl = document.getElementById('timeOrigin');
        const dEl = document.getElementById('timeDestination');
        if (oEl) oEl.textContent = simDateUTC.toLocaleTimeString('en-US', { timeZone: currentRoute.origin.tz,      hour: '2-digit', minute: '2-digit', hour12: false });
        if (dEl) dEl.textContent = simDateUTC.toLocaleTimeString('en-US', { timeZone: currentRoute.destination.tz, hour: '2-digit', minute: '2-digit', hour12: false });
      } catch { /* ignore TZ issues */ }
    }
  }
}


const POLL_INTERVAL_MS = 500;

async function pollLive() {
  try {
    const res  = await fetch('/live_data', { cache: 'no-store' });
    const data = await res.json();
    latestData = data;

    if (data.available && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      lastKnown = {
        lat:      data.latitude,
        lon:      data.longitude,
        alt:      data.altitude   || 0,
        heading:  data.heading    || 0,
        groundAlt: data.ground_alt ?? null,
      };

      updateAircraft(lastKnown.lat, lastKnown.lon, lastKnown.alt, lastKnown.heading);
      pushTrailPosition(lastKnown.lat, lastKnown.lon, lastKnown.alt);

      if (currentRoute?.destination) {
        if (currentRoute.simbriefWaypoints) {
          drawTrimmedSimBrief();
        } else {
          drawDashedToDestination(
            { lat: lastKnown.lat, lon: lastKnown.lon, alt: lastKnown.alt },
            currentRoute.destination
          );
        }
      }


      const zoomIdx = _cycleZoomIndex % 5;
      const zoomCycleBlocking = _cycleZoomActive && (
        _programmaticMoveCount > 0 ||
        zoomIdx === 0 ||
        zoomIdx === 1
      );

      if (followAircraft && _aircraftEntity && !zoomCycleBlocking) {
        if (Date.now() - _lastManualCameraMove >= followRecenterDelay) {
          const target = Cesium.Cartesian3.fromDegrees(
            lastKnown.lon, lastKnown.lat,
            isOnGround(latestData) ? 0 : simAltToMetres(lastKnown.alt)
          );
          const range = Cesium.Cartesian3.distance(
            viewer.camera.position, target
          );
          viewer.camera.lookAt(
            target,
            new Cesium.HeadingPitchRange(
              viewer.camera.heading,
              viewer.camera.pitch,
              range
            )
          );
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }
      }


      if (_cycleZoomActive && _cycleZoomAirborneOnly && !_timerAirborne && lastKnown) {
        const groundPos = Cesium.Cartesian3.fromDegrees(lastKnown.lon, lastKnown.lat, 0);
        const currentH  = viewer.camera.positionCartographic.height;
        if (currentH > 8000) {
          _programmaticMoveCount++;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lastKnown.lon, lastKnown.lat, 8000),
            duration: 1.5,
            complete: () => { _programmaticMoveCount--; },
            cancel:   () => { _programmaticMoveCount--; }
          });
        }
      }

      if (data.sim_time_utc) {
        const simDate = buildSimUTCDate(data);
        if (simDate) {
          viewer.clock.currentTime = Cesium.JulianDate.fromDate(simDate);
        }
      }

      updateInfoBar();
      viewer.scene.requestRender();
    }
  } catch (e) {
    console.error('[Globe] live_data failed:', e);
  }
}

setInterval(pollLive, POLL_INTERVAL_MS);
pollLive();


function drawTrimmedSimBrief(force = false) {
  if (!currentRoute?.simbriefWaypoints || !lastKnown) return;

  const thresholdNM = 10;
  const curLat = lastKnown.lat, curLon = lastKnown.lon, curHdg = lastKnown.heading || 0;

  while (remainingSimBriefWaypoints.length > 0) {
    const [lat, lon] = remainingSimBriefWaypoints[0];
    const dist = getDistanceNM(curLat, curLon, lat, lon);
    if (dist > thresholdNM) break;
    const bearingToWpt = getBearing(curLat, curLon, lat, lon);
    const diff  = Math.abs(curHdg - bearingToWpt);
    const angle = Math.min(diff, 360 - diff);
    if (angle >= 90) { remainingSimBriefWaypoints.shift(); } else { break; }
  }

  if (remainingSimBriefWaypoints.length === 0) { clearRouteLine(); return; }

  const points = [[curLat, curLon], ...remainingSimBriefWaypoints];
  drawSimBriefPoly(points);
}

function manuallyTrimWaypoint() {
  if (remainingSimBriefWaypoints.length > 0) {
    remainingSimBriefWaypoints.shift();
    drawTrimmedSimBrief(true);
  }
}


async function submitRoute(originICAO, destICAO) {
  try {
    clearAll();

    const [oRes, dRes] = await Promise.all([
      fetch(`/lookup_airport/${originICAO}`),
      fetch(`/lookup_airport/${destICAO}`)
    ]);
    if (oRes.status !== 200 || dRes.status !== 200) { toast("ICAO not found (manual route)."); return; }

    const originData = await oRes.json();
    const destData   = await dRes.json();

    const labelType = document.getElementById("labelTypeSelect")?.value || "city";

    currentRoute = {
      origin:      { city: originData.city, lat: originData.lat, lon: originData.lon, tz: originData.tz, icao: originData.icao, iata: originData.iata, name: originData.name, elevation: originData.elevation },
      destination: { city: destData.city,   lat: destData.lat,   lon: destData.lon,   tz: destData.tz,   icao: destData.icao,   iata: destData.iata,   name: destData.name,   elevation: destData.elevation   },
      labelType
    };

    setModeSwitchDisabled(true);

    drawRouteMarkers();

    if (lastKnown) {
      drawDashedToDestination(
        { lat: lastKnown.lat, lon: lastKnown.lon, alt: lastKnown.alt },
        currentRoute.destination
      );
    }
  } catch (err) {
    console.error("Error setting manual route:", err);
    toast("Failed to set route.");
  }
}



async function loadSimBrief(silent = false) {
  let username = localStorage.getItem("simbriefUsername");
  if (!username) {
    if (!silent) toast("Set SimBrief username in Settings first.");
    return;
  }

  try {
    const res    = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${username}`);
    const xml    = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");

    const originIcao = xmlDoc.querySelector("origin > icao_code")?.textContent?.trim();
    const destIcao   = xmlDoc.querySelector("destination > icao_code")?.textContent?.trim();

    const fixNodes = xmlDoc.querySelectorAll("navlog > fix");
    const waypoints = Array.from(fixNodes).map(fx => {
      const lat = parseFloat(fx.querySelector("pos_lat")?.textContent);
      const lon = parseFloat(fx.querySelector("pos_long")?.textContent);
      return [lat, lon];
    }).filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));

    if (!originIcao || !destIcao || waypoints.length < 2) {
      toast("SimBrief load failed.");
      return;
    }

    const [oRes, dRes] = await Promise.all([
      fetch(`/lookup_airport/${originIcao}`),
      fetch(`/lookup_airport/${destIcao}`)
    ]);
    if (oRes.status !== 200 || dRes.status !== 200) { toast("Airport lookup failed for SimBrief."); return; }

    const originData = await oRes.json();
    const destData   = await dRes.json();

    clearAll();

    const labelType = document.getElementById("labelTypeSelect")?.value || "city";

    currentRoute = {
      origin:      { city: originData.city, name: originData.name, iata: originData.iata, icao: originData.icao, lat: originData.lat, lon: originData.lon, tz: originData.tz, elevation: originData.elevation },
      destination: { city: destData.city,   name: destData.name,   iata: destData.iata,   icao: destData.icao,   lat: destData.lat,   lon: destData.lon,   tz: destData.tz,   elevation: destData.elevation   },
      labelType,
      simbriefWaypoints: waypoints
    };

    setModeSwitchDisabled(true);

    remainingSimBriefWaypoints = [...waypoints];
    drawRouteMarkers();
    drawTrimmedSimBrief(true);
    const trimBtn = document.getElementById('trimWaypointBtn');
    if (trimBtn) trimBtn.style.display = 'inline-block';
    toast("SimBrief plan loaded.");
    if (typeof importSimbriefToInfoPanel === "function") importSimbriefToInfoPanel();
  } catch (err) {
    console.error("SimBrief load failed:", err);
    toast("SimBrief import failed.");
  }
}


function updateColorSettings() {
  const trailInput = document.getElementById("trailColorPicker");
  const routeInput = document.getElementById("routeColorPicker");

  if (trailInput) {
    trailColorCss = trailInput.value;
    localStorage.setItem("globeTrailColor", trailColorCss);
    trailColor = cssToCesiumColor(trailColorCss);
    const mat = new Cesium.ColorMaterialProperty(trailColor);
    if (trailEntity) trailEntity.polyline.material = mat;
    _trailStaticArrays.forEach(s => { if (s.entity) s.entity.polyline.material = mat; });
  }
  if (routeInput) {
    routeColorCss = routeInput.value;
    localStorage.setItem("globeRouteLineColor", routeColorCss);
    routeColor = cssToCesiumColor(routeColorCss);
    if (routeEntity?.polyline) {
      routeEntity.polyline.material = new Cesium.ColorMaterialProperty(routeColor.withAlpha(1.0));
    }
  }
}

function updateLineThickness() {
  const input = document.getElementById("lineThicknessRange");
  if (!input) return;
  lineThickness = parseInt(input.value, 10) || 3;
  localStorage.setItem("lineThickness", lineThickness);
  if (trailEntity) trailEntity.polyline.width = lineThickness;
  _trailStaticArrays.forEach(s => { if (s.entity) s.entity.polyline.width = lineThickness; });
  if (routeEntity) routeEntity.polyline.width = lineThickness;
}

function toggleInfoBar() {
  const cb  = document.getElementById("infoBarToggle");
  const bar = document.getElementById("info-bar");
  if (!cb || !bar) return;
  const visible = cb.checked;
  bar.style.display = visible ? "flex" : "none";
  localStorage.setItem("infoBarVisible", visible ? "true" : "false");
}

function updateInfoBarFont() {
  const slider = document.getElementById("infoBarFontRange");
  const bar    = document.getElementById("info-bar");
  if (!slider || !bar) return;
  bar.style.fontSize = slider.value + "px";
  localStorage.setItem("infoBarFontSize", slider.value);
}

let cityLabelScale = parseFloat(localStorage.getItem("cityLabelScale")) || 1.0;

function updateCityLabelScale() {
  const slider = document.getElementById("cityLabelScaleRange");
  if (!slider) return;
  cityLabelScale = parseFloat(slider.value) || 1.0;
  localStorage.setItem("cityLabelScale", cityLabelScale);

  routeMarkers.forEach(e => {
    if (e.label) e.label.scale = cityLabelScale;
  });
}

function changeLanguage(lang) {
  localStorage.setItem("selectedLanguage", lang);
  if (typeof translations === "undefined") return;
  const t = translations[lang] || translations["en"];

  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  const setTitle = (id, val) => { const el = document.getElementById(id); if (el && val) el.title = val; };

  setText("resetBtn",        t.reloadPage);
  setTitle("resetBtn",       t.reloadTooltip);
  setText("resetCameraBtn",  t.resetCameraView   || "🌐 Reset Map View");
  if (typeof updateImageryPickerTranslations === "function") updateImageryPickerTranslations();
  setText("lbl-msfsTab",              t.msfsTabLabel          || "MSFS Flight Plan");
  setText("lbl-msfsModalDesc",        t.msfsModalDesc         || "Loads your active MSFS custom flight plan directly from the sim. Set your flight plan in-game first, then click Load below.");
  setText("lbl-msfsVersionTitle",     t.msfsVersionTitle      || "MSFS Version & Platform:");
  setText("lbl-msfsVariantSteam2020", t.msfsVariantSteam2020  || "MSFS 2020 — Steam");
  setText("lbl-msfsVariantStore2020", t.msfsVariantStore2020  || "MSFS 2020 — Microsoft Store");
  setText("lbl-msfsVariantSteam2024", t.msfsVariantSteam2024  || "MSFS 2024 — Steam");
  setText("lbl-msfsVariantStore2024", t.msfsVariantStore2024  || "MSFS 2024 — Microsoft Store");
  setText("lbl-msfsLoadBtn",          t.msfsLoadBtn           || "Load MSFS Plan");
  setText("lbl-manualTab",            t.manualTabLabel         || "Manual Route");
  setText("lbl-simbriefTab",          t.simbriefTabLabel       || "SimBrief Plan");
  setText("lbl-timeElapsed",          t.infoTimeElapsed        || "Time Elapsed:");
  setText("lbl-cycleZoomAirborneOnly", t.cycleZoomAirborneOnly  || "Only when airborne");
  setTitle("cycleZoomAirborneOnly",    t.cycleZoomAirborneOnlyTip || "Only cycle zoom levels when airborne");
  setText("lbl-msfs2024Unsupported",  t.msfs2024Unsupported   || "⚠️ MSFS 2024 flight plan imports are not currently supported. Changes to the 2024 PLN file format removed waypoint coordinates, making import not feasible.");
  ["manual","simbrief","msfs"].forEach(tab => {
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    setText("lbl-routeModalLabelType-" + tab, t.labelType        || "Label Type:");
    setText("lbl-routeModalCity-"      + tab, t.city             || "City (default)");
    setText("lbl-routeModalICAO-"      + tab, t.icao             || "ICAO");
    setText("lbl-routeModalIATA-"      + tab, t.iata             || "IATA");
    setText("lbl-routeModalName-"      + tab, t.name             || "Airport Name");
  });
  setText("lbl-terrain3DWarning",      t.terrain3DWarning   || "⚠️ May impact performance");
  setText("performanceWarning",          t.performanceWarning  || "If you are switching to the 3D globe, please note that it uses more system resources than the 2D map.");
  setText("lbl-msfsVariantCustom",     t.msfsVariantCustom     || "Custom Directory");
  setTitle("resetCameraBtn", t.resetCameraTooltip || "Resets the camera to a full globe overview if you get lost or stuck");
  setText("setRouteBtn",     t.setChangeRoute);
  setTitle("setRouteBtn",    t.setRouteTooltip);
  setText("trimWaypointBtn", t.trimWaypoint);
  setTitle("trimWaypointBtn",t.trimTooltip);


  setTitle("settingsBtn",          t.settingsTooltip);
  setTitle("infoToggleBtn",        t.infoTooltip);


  setTitle("followToggle",         t.followTooltip);
  setTitle("followDelaySelect",    t.followDelaytip);
  setTitle("cycleZoomToggle",      t.cycleZoomTooltip);
  setTitle("zoomSpeedSelect",      t.zoomSpeedTooltip);
  setTitle("autoStealthModeToggle",t.autoSimbrieftip);


  setText("flight_summary_title", t.summaryTitle);
  setText("infoPanelHeader",      t.panelTitle);
  setTitle("importSimbriefBtn",   t.importSimbriefTooltip);
  setTitle("closeInfoPanelBtn",   t.closeInfoTooltip);


  setText("twoDMapBtn",      t.mapViewBtn     || "Map View 🗺️");
  setTitle("twoDMapBtn",     t.mapViewTooltip || "Switch to 2D map view");

  const terrainBtn = document.getElementById("terrainToggleBtn");
  if (terrainBtn && !terrainBtn.disabled) {
    const isClassic = new URLSearchParams(window.location.search).get('mode') === 'classic';
    if (isClassic) {
      if (t.flightPath3DOffLabel)   terrainBtn.textContent = t.flightPath3DOffLabel;
      if (t.flightPath3DOffTooltip) terrainBtn.title       = t.flightPath3DOffTooltip;
    } else {
      if (t.flightPath3DOnLabel)    terrainBtn.textContent = t.flightPath3DOnLabel;
      if (t.flightPath3DOnTooltip)  terrainBtn.title       = t.flightPath3DOnTooltip;
    }
  }


  setText("switchWarningTitle",        t.switchWarningTitle);
  setText("switchWarningDontShowText", t.switchWarningDontShow);
  setText("switchWarningCancelBtn",    t.switchWarningCancel);
  setText("mapSwitchConfirmBtn",       t.switchWarningConfirm);
  const swBody = document.getElementById("switchWarningBody");
  if (swBody && t.switchWarningBody) swBody.innerHTML = t.switchWarningBody;


  setText("lbl-followAircraft",   t.followAircraft);
  setText("lbl-followDelay",      t.followRecenterDelay);
  setText("lbl-autoCycleZoom",    t.autoCycleZoom);
  setText("lbl-zoomSpeed",        t.zoomSpeed);
  setText("lbl-unitSystem",       t.unitSystem);
  setText("lbl-etaMode",          t.etaMode);
  setText("lbl-trailColor",       t.trailColor);
  setText("lbl-routeColor",       t.routeColor);
  setText("lbl-lineThickness",    t.lineThickness);
  setText("lbl-airportLabelType", t.airportLabelType);
  setText("lbl-cityLabelScale",   t.cityLabelScaleLabel);
  setText("lbl-aircraftIcon",     t.aircraftIcon);
  setText("lbl-iconColor",        t.aircraftIconColor);
  setText("lbl-infoBar",          t.infoBar);
  setText("lbl-infoBarFont",      t.infoBarFont);
  setText("lbl-simbriefUsername", t.simbriefusernameLabel);
  setText("setSimbriefBtn",       t.SimbriefSetLabel);
  setText("lbl-autoSimbrief",     t.autoSimbriefTitle);
  setText("dayNightLabel",        t.dayNight || "Day/Night Lighting");
  setText("lbl-terrain3D",        t.terrain3D        || "3D Terrain");
  setText("lbl-language",         t.languageLabel);


  const zoomSel = document.getElementById("zoomSpeedSelect");
  if (zoomSel && zoomSel.options.length >= 3) {
    zoomSel.options[0].textContent = t.zoomFast   || "Fast (5s)";
    zoomSel.options[1].textContent = t.zoomNormal || "Normal (15s)";
    zoomSel.options[2].textContent = t.zoomSlow   || "Slow (30s)";
  }


  const unitSel = document.getElementById("unitSystemSelect");
  if (unitSel && unitSel.options.length >= 4) {
    unitSel.options[0].textContent = t.unitAuto     || "Auto Cycle";
    unitSel.options[1].textContent = t.unitImperial || "Imperial";
    unitSel.options[2].textContent = t.unitMetric   || "Metric";
    unitSel.options[3].textContent = t.unitAviation || "Aviation";
  }


  const etaSel = document.getElementById("etaModeSelect");
  if (etaSel && etaSel.options.length >= 2) {
    etaSel.options[0].textContent = t.etaDest  || "Destination Time";
    etaSel.options[1].textContent = t.etaLocal || "Local PC Time";
  }

  ["labelTypeSelect"].forEach(selId => {
    const sel = document.getElementById(selId);
    if (sel && sel.options.length >= 4) {
      sel.options[0].textContent = t.city || "City";
      sel.options[1].textContent = t.icao || "ICAO";
      sel.options[2].textContent = t.iata || "IATA";
      sel.options[3].textContent = t.name || "Airport Name";
    }
  });


  const manualBtns = document.querySelectorAll("#manualTab button");
  if (manualBtns.length >= 2) { manualBtns[0].textContent = t.submit || "Submit"; manualBtns[1].textContent = t.dismiss || "Cancel"; }
  const sbBtns = document.querySelectorAll("#simbriefTab button");
  if (sbBtns.length >= 1) sbBtns[0].textContent = t.loadSimBrief || "Load SimBrief";
  if (sbBtns.length >= 2) sbBtns[1].textContent = t.dismiss || "Cancel";
  const manualNote = document.querySelector("#manualTab p");
  if (manualNote && t.manualRouteNote) manualNote.textContent = t.manualRouteNote;
  const sbNote = document.querySelector("#simbriefTab p");
  if (sbNote && t.simbriefNotice) sbNote.textContent = t.simbriefNotice;


  const infoMap = {
    "lbl-altitude":           t.infoAltitude,
    "lbl-groundSpeed":        t.infoGroundSpeed,
    "lbl-timeOrigin":         t.infoTimeOrigin,
    "lbl-timeDestination":    t.infoTimeDest,
    "lbl-distanceFromOrigin": t.infoDistFromOrigin,
    "lbl-distanceToDest":     t.infoDistToDest,
    "lbl-timeRemaining":      t.infoTimeRemaining,
    "lbl-eta":                t.infoETA,
  };
  Object.entries(infoMap).forEach(([id, val]) => setText(id, val));


  const iconSel = document.getElementById("iconSelect");
  if (iconSel && iconSel.options.length >= 19) {
    iconSel.options[0].textContent  = "A320";
    iconSel.options[1].textContent  = "A330";
    iconSel.options[2].textContent  = "A340";
    iconSel.options[3].textContent  = "A350";
    iconSel.options[4].textContent  = "A380";
    iconSel.options[5].textContent  = "737";
    iconSel.options[6].textContent  = "747";
    iconSel.options[7].textContent  = "757";
    iconSel.options[8].textContent  = "767";
    iconSel.options[9].textContent  = "777";
    iconSel.options[10].textContent = "787";
    iconSel.options[11].textContent = "E-Jet";
    iconSel.options[12].textContent = "CRJ";
    iconSel.options[13].textContent = "ATR";
    iconSel.options[14].textContent = t.modelBusinessJet || "Business Jet";
    iconSel.options[15].textContent = t.modelGA          || "General Aviation";
    iconSel.options[16].textContent = t.modelGATwin      || "General Aviation Twin Engine";
    iconSel.options[17].textContent = t.modelHelicopter  || "Helicopter";
    iconSel.options[18].textContent = t.modelMilitary    || "Military";
  }


  if (localStorage.getItem("simbriefUsername") && typeof importSimbriefToInfoPanel === "function") {
    importSimbriefToInfoPanel();
  }
}


let _cycleZoomActive       = false;
let _cycleZoomAirborneOnly = localStorage.getItem("cycleZoomAirborneOnly") === "true";
let _cycleZoomInterval = null;
let _cycleZoomSpeed    = 15000;
let _cycleZoomIndex    = 0;

function _getZoomCycleDestination(index) {
  const hasRoute    = currentRoute?.origin && currentRoute?.destination;
  const hasAircraft = lastKnown !== null;


  function gcMidpoint(o, d) {
    const r = deg => deg * Math.PI / 180;
    const deg = rad => rad * 180 / Math.PI;
    const φ1 = r(o.lat), λ1 = r(o.lon);
    const φ2 = r(d.lat), λ2 = r(d.lon);
    const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1);
    const By = Math.cos(φ2) * Math.sin(λ2 - λ1);
    return {
      lat: deg(Math.atan2(Math.sin(φ1) + Math.sin(φ2),
                          Math.sqrt((Math.cos(φ1) + Bx) ** 2 + By ** 2))),
      lon: deg(λ1 + Math.atan2(By, Math.cos(φ1) + Bx))
    };
  }

  const aLat = hasAircraft ? lastKnown.lat : 0;
  const aLon = hasAircraft ? lastKnown.lon : 0;
  const mid  = hasRoute
    ? gcMidpoint(currentRoute.origin, currentRoute.destination)
    : { lat: aLat, lon: aLon };

  const CLOSE_H   = 75000;
  const GLOBE_H   = 20000000;

  let routeH = 8000000;
  if (hasRoute) {
    const distKm = getDistanceNM(
      currentRoute.origin.lat, currentRoute.origin.lon,
      currentRoute.destination.lat, currentRoute.destination.lon
    ) * 1.852;
    const angRad = distKm / 6371;
    routeH = Math.min(18000000, Math.max(1200000, 6371000 * Math.tan(angRad / 2) * 2.4));
  }


  const level2H = Math.sqrt(routeH * CLOSE_H * 16);
  const level3H = Math.sqrt(routeH * CLOSE_H);


  const l2 = Math.min(routeH * 0.35, Math.max(CLOSE_H * 8, level2H));
  const l3 = Math.min(l2 * 0.4,      Math.max(CLOSE_H * 3, level3H));


  let focusLon, focusLat;
  if (followAircraft && hasAircraft) {
    focusLon = aLon;
    focusLat = aLat;
  } else {
    const carto = viewer.camera.positionCartographic;
    focusLon = Cesium.Math.toDegrees(carto.longitude);
    focusLat = Cesium.Math.toDegrees(carto.latitude);
  }

  switch (index % 5) {
    case 0: return Cesium.Cartesian3.fromDegrees(mid.lon,   mid.lat,  GLOBE_H);
    case 1: return Cesium.Cartesian3.fromDegrees(mid.lon,   mid.lat,  routeH);
    case 2: return Cesium.Cartesian3.fromDegrees(focusLon,  focusLat, l2);
    case 3: return Cesium.Cartesian3.fromDegrees(focusLon,  focusLat, l3);
    case 4: return Cesium.Cartesian3.fromDegrees(focusLon,  focusLat, CLOSE_H);
  }
}

function toggleCycleZoom() {
  const cb = document.getElementById("cycleZoomToggle");
  const speedSel = document.getElementById("zoomSpeedSelect");
  _cycleZoomActive = cb ? cb.checked : !_cycleZoomActive;
  localStorage.setItem("cycleZoomEnabled", _cycleZoomActive ? "true" : "false");
  if (speedSel) speedSel.disabled = !_cycleZoomActive;
  const airborneOnlyCb = document.getElementById("cycleZoomAirborneOnly");
  if (airborneOnlyCb) airborneOnlyCb.disabled = !_cycleZoomActive;

  clearInterval(_cycleZoomInterval);
  _cycleZoomInterval = null;

  if (_cycleZoomActive) {
    _cycleZoomIndex = 0;
    _cycleZoomInterval = setInterval(() => {
      if (_cycleZoomAirborneOnly && !_timerAirborne) return;
      _cycleZoomIndex = (_cycleZoomIndex + 1) % 5;
      _programmaticMoveCount++;
      viewer.camera.flyTo({
        destination: _getZoomCycleDestination(_cycleZoomIndex),
        duration: 1.5,
        complete: () => { _programmaticMoveCount--; },
        cancel:   () => { _programmaticMoveCount--; }
      });
    }, _cycleZoomSpeed);
  }
}

function toggleCycleZoomAirborneOnly() {
  const cb = document.getElementById("cycleZoomAirborneOnly");
  _cycleZoomAirborneOnly = cb ? cb.checked : !_cycleZoomAirborneOnly;
  localStorage.setItem("cycleZoomAirborneOnly", _cycleZoomAirborneOnly ? "true" : "false");
}

function updateZoomSpeed() {
  const sel = document.getElementById("zoomSpeedSelect");
  if (!sel) return;
  switch (sel.value) {
    case "fast": _cycleZoomSpeed = 5000;  break;
    case "slow": _cycleZoomSpeed = 30000; break;
    default:     _cycleZoomSpeed = 15000;
  }
  localStorage.setItem("zoomCycleSpeed", sel.value);
  if (_cycleZoomActive) { toggleCycleZoom(); toggleCycleZoom(); } // restart with new speed
}

function updateUnitSystem() {
  const sel = document.getElementById("unitSystemSelect");
  if (!sel) return;
  unitSystem = sel.value;
  localStorage.setItem("unitSystem", unitSystem);
  applyUnitSystem();
}

function updateEtaMode() {
  const sel = document.getElementById("etaModeSelect");
  if (!sel) return;
  etaMode = sel.value;
  localStorage.setItem("etaMode", etaMode);
}

function updateAircraftIcon() {
  const sel = document.getElementById("iconSelect");
  if (sel) {
    globeAircraftModel = sel.value;
    localStorage.setItem("globeAircraftModel", globeAircraftModel);
  }
  if (_aircraftEntity) {
    const s = getModelScale();
    _aircraftEntity.model.uri              = getGlobeModelUri();
    _aircraftEntity.model.scale            = s.scale;
    _aircraftEntity.model.minimumPixelSize = s.minimumPixelSize;
  }
}

function initIconColorPicker() {
  const container = document.getElementById("iconColorContainer");
  if (!container) return;
  const colors = [
    { name: "black",      hex: "#000000" },
    { name: "white",      hex: "#ffffff" },
    { name: "grey",       hex: "#999999" },
    { name: "red",        hex: "#ff0000" },
    { name: "orange",     hex: "#ffa200" },
    { name: "yellow",     hex: "#fff034" },
    { name: "green",      hex: "#138d1d" },
    { name: "lightGreen", hex: "#55ff00" },
    { name: "blue",       hex: "#0b5394" },
    { name: "lightBlue",  hex: "#00ffff" },
    { name: "purple",     hex: "#bc01e9" },
    { name: "pink",       hex: "#ff00b4" }
  ];

  const saved = localStorage.getItem("globeModelColor") || "black";
  container.innerHTML = "";

  colors.forEach(c => {
    const circle = document.createElement("div");
    circle.style.cssText = `
      width:22px;height:22px;border-radius:50%;
      border:2px solid #ccc;cursor:pointer;
      background:${c.hex};
      transition:transform .15s,border-color .15s;
      box-sizing:border-box;
    `;
    circle.dataset.color = c.name;
    if (c.name === saved) {
      circle.style.border = "2px solid #fff";
      circle.style.boxShadow = "0 0 0 2px #0078ff";
      circle.style.transform = "scale(1.15)";
    }

    circle.addEventListener("click", () => {
      container.querySelectorAll("div[data-color]").forEach(o => {
        o.style.border = "2px solid #ccc";
        o.style.boxShadow = "";
        o.style.transform = "";
      });
      circle.style.border = "2px solid #fff";
      circle.style.boxShadow = "0 0 0 2px #0078ff";
      circle.style.transform = "scale(1.15)";

      globeModelColor = c.name;
      localStorage.setItem("globeModelColor", c.name);
      if (_aircraftEntity) _aircraftEntity.model.color = getGlobeModelColor();
    });

    container.appendChild(circle);
  });
}

function toggleFollowAircraft() {
  const cb  = document.getElementById("followToggle");
  const sel = document.getElementById("followDelaySelect");
  followAircraft = cb ? cb.checked : !followAircraft;
  localStorage.setItem("followAircraft", followAircraft ? "true" : "false");
  if (sel) sel.disabled = !followAircraft;
}

function updateFollowDelay() {
  const sel = document.getElementById("followDelaySelect");
  if (!sel) return;
  followRecenterDelay = parseInt(sel.value, 10);
  localStorage.setItem("followRecenterDelay", followRecenterDelay);
}


const _sse = viewer.screenSpaceEventHandler;

function _onUserCameraInput() {
  _lastManualCameraMove = Date.now();
}

_sse.setInputAction(_onUserCameraInput, Cesium.ScreenSpaceEventType.LEFT_DOWN);
_sse.setInputAction(_onUserCameraInput, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
_sse.setInputAction(_onUserCameraInput, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
_sse.setInputAction(_onUserCameraInput, Cesium.ScreenSpaceEventType.WHEEL);
_sse.setInputAction(_onUserCameraInput, Cesium.ScreenSpaceEventType.PINCH_START);

function saveSimbriefUsername() {
  const input = document.getElementById("simbriefInput");
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    localStorage.setItem("simbriefUsername", val);
    toast("SimBrief username saved.");
  } else {
    localStorage.removeItem("simbriefUsername");
    toast("SimBrief username cleared.");
  }
}

function toggleAutoSimbrief() {
  const cb = document.getElementById("autoStealthModeToggle");
  if (!cb) return;
  localStorage.setItem("autoLoadSimbrief", cb.checked ? "true" : "false");
}

function toggleGlobeLighting() {
  const cb = document.getElementById("globeLightingToggle");
  if (!cb) return;
  const enabled = cb.checked;
  viewer.scene.globe.enableLighting = enabled;
  viewer.scene.requestRender();
  localStorage.setItem("globeLighting", enabled ? "true" : "false");
}

function resetCameraView() {
  viewer.camera.flyHome(1.5);
  const menu = document.getElementById("settingsMenu");
  if (menu) menu.style.display = "none";
}

function updateTerrainBtn() {
  const btn = document.getElementById("terrainToggleBtn");
  if (!btn || btn.disabled) return;
  const lang = localStorage.getItem("selectedLanguage") || "en";
  const t    = (typeof translations !== "undefined" && translations[lang]) || {};
  btn.textContent           = t.flightPath3DOnLabel   || '3D Flight Path (beta): ON';
  btn.style.backgroundColor = '#1a6b1a';
  btn.title                 = t.flightPath3DOnTooltip || '3D Flight Path mode is ON (beta). Click to switch to Classic mode.';
}

function toggleTerrainBtn() {
  const btn = document.getElementById("terrainToggleBtn");
  if (btn && btn.disabled) return;
  const isClassic = new URLSearchParams(window.location.search).get('mode') === 'classic';
  if (isClassic && !(window._hasPersonalToken)) {
    const lang = localStorage.getItem("selectedLanguage") || "en";
    const t    = (typeof translations !== "undefined" && translations[lang]) || {};
    if (typeof showIonFeaturePopup === "function")
      showIonFeaturePopup(t.ionFeature3DMode || "3D Flight Path & Terrain");
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (isClassic) {
    params.delete('mode');
    localStorage.setItem("globeMode", "3d");
  } else {
    params.set('mode', 'classic');
    localStorage.setItem("globeMode", "classic");
  }
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.location.href = newUrl;
}

function setModeSwitchDisabled(disabled) {
  const btn = document.getElementById("terrainToggleBtn");
  if (!btn) return;
  const lang = localStorage.getItem("selectedLanguage") || "en";
  const t    = (typeof translations !== "undefined" && translations[lang]) || {};
  btn.disabled          = disabled;
  btn.style.opacity     = disabled ? "0.7" : "1";
  btn.style.cursor      = disabled ? "not-allowed" : "pointer";
  if (disabled) {
    btn.title = t.flightPath3DDisabledTooltip || "Cannot change mode while a route is active — reset first.";
  } else {
    btn.title = t.flightPath3DOnTooltip || '3D Flight Path mode is ON (beta). Click to switch to Classic mode.';
  }
}

function toggle3DTerrain() {
  toggleTerrainBtn();
}


window.addEventListener('storage', e => {
  if (e.key === 'globeTrailColor' && e.newValue) {
    trailColorCss = e.newValue;
    trailColor = cssToCesiumColor(trailColorCss);
    const mat = new Cesium.ColorMaterialProperty(trailColor);
    if (trailEntity) trailEntity.polyline.material = mat;
    _trailStaticArrays.forEach(s => { if (s.entity) s.entity.polyline.material = mat; });
    const p = document.getElementById("trailColorPicker"); if (p) p.value = trailColorCss;
  }
  if (e.key === 'globeRouteLineColor' && e.newValue) {
    routeColorCss = e.newValue;
    routeColor = cssToCesiumColor(routeColorCss);
    if (routeEntity?.polyline) {
      routeEntity.polyline.material = new Cesium.ColorMaterialProperty(routeColor.withAlpha(1.0));
    }
    const p = document.getElementById("routeColorPicker"); if (p) p.value = routeColorCss;
  }
  if (e.key === 'lineThickness' && e.newValue) {
    lineThickness = parseInt(e.newValue, 10) || 3;
    if (trailEntity) trailEntity.polyline.width = lineThickness;
    _trailStaticArrays.forEach(s => { if (s.entity) s.entity.polyline.width = lineThickness; });
    if (routeEntity) routeEntity.polyline.width = lineThickness;
  }
  if (e.key === 'unitSystem' && e.newValue) { unitSystem = e.newValue; applyUnitSystem(); }
  if (e.key === 'etaMode'    && e.newValue) { etaMode    = e.newValue; }
  if (e.key === 'globeAircraftModel' && e.newValue) {
    globeAircraftModel = e.newValue;
    if (_aircraftEntity) {
      const s = getModelScale();
      _aircraftEntity.model.uri              = getGlobeModelUri();
      _aircraftEntity.model.scale            = s.scale;
      _aircraftEntity.model.minimumPixelSize = s.minimumPixelSize;
    }
  }
  if (e.key === 'globeModelColor' && e.newValue) {
    globeModelColor = ICON_COLORS.includes(e.newValue) ? e.newValue : 'black';
    if (_aircraftEntity) _aircraftEntity.model.color = getGlobeModelColor();
  }
});



function initSettingsPanel() {
  const btn  = document.getElementById("settingsBtn");
  const menu = document.getElementById("settingsMenu");
  if (!btn || !menu) return;


  const trailPicker    = document.getElementById("trailColorPicker");
  const routePicker    = document.getElementById("routeColorPicker");
  const thickRange     = document.getElementById("lineThicknessRange");
  const unitSel        = document.getElementById("unitSystemSelect");
  const etaSel         = document.getElementById("etaModeSelect");
  const iconSel        = document.getElementById("iconSelect");
  const followCb       = document.getElementById("followToggle");
  const autoSb         = document.getElementById("autoStealthModeToggle");
  const sbInput        = document.getElementById("simbriefInput");
  const labelSel       = document.getElementById("labelTypeSelect");
  const langSel        = document.getElementById("languageSelect");
  const infoBarCb      = document.getElementById("infoBarToggle");
  const infoBarFont    = document.getElementById("infoBarFontRange");
  const cityLabelRange = document.getElementById("cityLabelScaleRange");
  const infoBar        = document.getElementById("info-bar");

  if (trailPicker)    trailPicker.value    = trailColorCss;
  if (routePicker)    routePicker.value    = routeColorCss;  if (thickRange)     thickRange.value     = lineThickness;
  if (unitSel)        unitSel.value        = unitSystem;
  if (etaSel)         etaSel.value         = etaMode;
  if (followCb)       followCb.checked     = followAircraft;
  const followDelaySel = document.getElementById("followDelaySelect");
  if (followDelaySel) {
    followDelaySel.disabled = false;
    followDelaySel.value    = String(followRecenterDelay);
    followDelaySel.disabled = !followAircraft;
  }
  if (autoSb)         autoSb.checked       = localStorage.getItem("autoLoadSimbrief") === "true";

  const lightingCb = document.getElementById("globeLightingToggle");
  if (lightingCb)   lightingCb.checked   = localStorage.getItem("globeLighting") !== "false";
  const airborneOnlyCb = document.getElementById("cycleZoomAirborneOnly");
  if (airborneOnlyCb) {
    airborneOnlyCb.checked  = _cycleZoomAirborneOnly;
    airborneOnlyCb.disabled = !_cycleZoomActive;
  }

  updateTerrainBtn();
  if (sbInput)        sbInput.value        = localStorage.getItem("simbriefUsername") || "";


  const setSbBtn = document.getElementById("setSimbriefBtn");
  if (setSbBtn) setSbBtn.addEventListener("click", saveSimbriefUsername);
  if (langSel)        langSel.value        = localStorage.getItem("selectedLanguage") || "en";
  if (cityLabelRange) cityLabelRange.value = cityLabelScale;


  const infoBarVisible = localStorage.getItem("infoBarVisible") !== "false";
  if (infoBarCb) infoBarCb.checked = infoBarVisible;
  if (infoBar)   infoBar.style.display = infoBarVisible ? "flex" : "none";


  const savedFontSize = localStorage.getItem("infoBarFontSize") || "14";
  if (infoBarFont) infoBarFont.value = savedFontSize;
  if (infoBar)     infoBar.style.fontSize = savedFontSize + "px";

  if (iconSel) {
    const savedModel = localStorage.getItem("globeAircraftModel") || "737";
    const match = Array.from(iconSel.options).find(o => o.value === savedModel);
    if (match) iconSel.value = match.value;
  }


  const cycleZoomCb  = document.getElementById("cycleZoomToggle");
  const zoomSpeedSel = document.getElementById("zoomSpeedSelect");
  const savedCycleZoom  = localStorage.getItem("cycleZoomEnabled") === "true";
  const savedZoomSpeed  = localStorage.getItem("zoomCycleSpeed") || "normal";
  if (cycleZoomCb)  cycleZoomCb.checked  = savedCycleZoom;
  if (zoomSpeedSel) {
    zoomSpeedSel.value    = savedZoomSpeed;
    zoomSpeedSel.disabled = !savedCycleZoom;

    switch (savedZoomSpeed) {
      case "fast": _cycleZoomSpeed = 5000;  break;
      case "slow": _cycleZoomSpeed = 30000; break;
      default:     _cycleZoomSpeed = 15000;
    }
  }
  if (savedCycleZoom) toggleCycleZoom();


  const savedLang = localStorage.getItem("selectedLanguage") || "en";
  const langSel2 = document.getElementById("languageSelect");
  if (langSel2) langSel2.value = savedLang;
  changeLanguage(savedLang);

  initIconColorPicker();


  const infoBtn = document.getElementById("infoToggleBtn");
  if (infoBtn) {
    infoBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (typeof toggleInfoPanel === "function") toggleInfoPanel();
    });
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });
  menu.addEventListener("click", e => {
    e.stopPropagation();
  });
  document.addEventListener("click", e => {
    if (!menu.contains(e.target) && e.target !== btn) menu.style.display = "none";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsPanel);
} else {
  initSettingsPanel();
}


function toast(msg, ms = 2200) {
  let node = document.getElementById("toast");
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    node.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.85);color:#fff;padding:10px 16px;border-radius:6px;
      z-index:99999;font-family:sans-serif;font-size:14px;
      display:none;opacity:0;transition:opacity .25s ease-in-out;`;
    document.body.appendChild(node);
  }
  node.textContent = msg;
  node.style.display = "block";
  requestAnimationFrame(() => node.style.opacity = "1");
  setTimeout(() => {
    node.style.opacity = "0";
    setTimeout(() => node.style.display = "none", 250);
  }, ms);
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
        toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsNoCustomPath) || "No custom directory set. Add msfs_custom_pln_path to advanced_config.txt.");
      } else if (data.error === 'file_not_found') {
        toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsFileNotFound) || "MSFS flight plan file not found. Set a custom flight plan in-game first.");
      } else if (data.error === 'parse_error') {
        toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsParseError) || "Failed to read MSFS flight plan file.");
      } else if (data.error === 'missing_airports') {
        toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsMissingAirports) || "Could not read origin/destination from flight plan.");
      } else {
        toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsLoadFailed) || "Failed to load MSFS flight plan.");
      }
      return;
    }

    const { origin: originIcao, destination: destIcao, waypoints } = data;

    if (!originIcao || !destIcao || waypoints.length < 2) {
      toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsIncompletePlan) || "MSFS flight plan is incomplete.");
      return;
    }

    const [oRes, dRes] = await Promise.all([
      fetch(`/lookup_airport/${originIcao}`),
      fetch(`/lookup_airport/${destIcao}`)
    ]);
    if (oRes.status !== 200 || dRes.status !== 200) { toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsAirportLookupFail) || "Airport lookup failed for MSFS plan."); return; }

    const originData = await oRes.json();
    const destData   = await dRes.json();

    clearAll();

    const sel = document.getElementById("labelTypeSelect");
    if (sel) sel.value = labelType;

    currentRoute = {
      origin:      { city: originData.city, name: originData.name, iata: originData.iata, icao: originData.icao, lat: originData.lat, lon: originData.lon, tz: originData.tz, elevation: originData.elevation },
      destination: { city: destData.city,   name: destData.name,   iata: destData.iata,   icao: destData.icao,   lat: destData.lat,   lon: destData.lon,   tz: destData.tz,   elevation: destData.elevation   },
      labelType,
      simbriefWaypoints: waypoints
    };

    setModeSwitchDisabled(true);
    remainingSimBriefWaypoints = [...waypoints];
    drawRouteMarkers();
    drawTrimmedSimBrief(true);
    const trimBtn = document.getElementById('trimWaypointBtn');
    if (trimBtn) trimBtn.style.display = 'inline-block';
    toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsPlanLoaded) || "MSFS flight plan loaded.");
  } catch (err) {
    console.error("MSFS plan load failed:", err);
    toast((typeof translations !== "undefined" && translations[localStorage.getItem("selectedLanguage")||"en"]?.msfsLoadFailed) || "Failed to load MSFS flight plan.");
  }
}

window.GlobeMap = {
  submitRoute,
  loadSimBrief,
  loadMSFSPlan,
  manuallyTrimWaypoint,
  clearAll
};



(function startup() {
  Promise.all([
    fetch("/default_simbrief").then(r => r.json()).catch(() => ({})),
    fetch("/default_autosimbrief").then(r => r.json()).catch(() => ({})),
    fetch("/default_disable_prompts").then(r => r.json()).catch(() => ({})),
    fetch("/default_disable_route_popup").then(r => r.json()).catch(() => ({})),
    fetch("/msfs_config").then(r => r.json()).catch(() => ({})),
  ]).then(([simbriefData, autoData, promptData, routePopupData, msfsConfig]) => {

    if (msfsConfig.hasCustomPath) {
      const radio = document.getElementById("msfsCustomRadio");
      const label = document.getElementById("msfsCustomLabel");
      if (radio) { radio.disabled = false; }
      if (label) { label.style.opacity = "1"; label.style.cursor = "pointer"; label.title = ""; }
    }

    if (simbriefData.username) {
      localStorage.setItem("simbriefUsername", simbriefData.username);
      const inp = document.getElementById("simbriefInput");
      if (inp) inp.value = simbriefData.username;
    }

    if (autoData.auto === "yes") {
      localStorage.setItem("autoLoadSimbrief", "true");
      const cb = document.getElementById("autoStealthModeToggle");
      if (cb) cb.checked = true;
    }

    localStorage.setItem("disablePrompts",    promptData.disable    === "yes" ? "true" : "");
    localStorage.setItem("disableRoutePopup", routePopupData.disable === "yes" ? "true" : "");

    const auto    = localStorage.getItem("autoLoadSimbrief") === "true";
    const hasUser = !!localStorage.getItem("simbriefUsername");
    if (auto && hasUser) loadSimBrief(true);
    else if (hasUser && typeof importSimbriefToInfoPanel === "function") {
      importSimbriefToInfoPanel();
    }
  });
})();

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
