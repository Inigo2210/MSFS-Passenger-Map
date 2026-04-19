
document.getElementById("infoPanelHeader").id = "infoPanelHeader";
function toggleInfoPanel() {
  const panel = document.getElementById("infoPanel");
  if (!panel) return;

  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";
}

function importSimbriefToInfoPanel() {
  const panel = document.getElementById("infoPanelContent");
  if (!panel) return;

  let username = localStorage.getItem("simbriefUsername");
  if (!username) {
    if (typeof showPrompt === "function") {
      showPrompt(translate("promptEnterSimbrief"), "", (result) => {
        if (!result) {
          localStorage.removeItem("simbriefUsername");
          panel.innerHTML = "<span style='color: red;'> No SimBrief username provided.</span>";
          return;
        }

        localStorage.setItem("simbriefUsername", result);
        const simbriefInput = document.getElementById("simbriefInput");
if (simbriefInput) simbriefInput.value = result;
        importSimbriefToInfoPanel();
      });
    } else {
      panel.innerHTML = "<span style='color: red;'> Prompt unavailable. Cannot proceed.</span>";
    }

    return;
  }

  panel.innerHTML = "Importing SimBrief data...";

  fetchSimbriefForInfoPanel()
    .then(summaryHTML => {
      panel.innerHTML = summaryHTML;
    })
    .catch(err => {
      console.error("SimBrief import failed:", err);
      localStorage.removeItem("simbriefUsername");
      panel.innerHTML = "<span style='color: red;'>Failed to load SimBrief data.</span>";
    });
}


async function fetchSimbriefForInfoPanel() {
  const lang = localStorage.getItem("selectedLanguage") || "en";
  const t = translations[lang] || translations["en"];
  try {
    const username = localStorage.getItem("simbriefUsername");
    if (!username) throw new Error("No SimBrief username found in localStorage");

    const res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${username}`);
    if (!res.ok) throw new Error("SimBrief request failed");

    const xmlText = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const getText = (selector) => xmlDoc.querySelector(selector)?.textContent?.trim() || "--";

    const originICAO = getText("origin > icao_code");
    const destICAO = getText("destination > icao_code");
    const aircraft = getText("aircraft > icaocode");
    const estTimeSeconds = getText("times > est_time_enroute");
    const schedOutEpoch = getText("times > sched_out");
    const schedInEpoch = getText("times > sched_in");
    const airline = getText("general > icao_airline");
    const flightNum = getText("general > flight_number");
    const distance = getText("general > route_distance");

    const [originInfo, destInfo] = await Promise.all([
      lookupAirportByICAO(originICAO),
      lookupAirportByICAO(destICAO)
    ]);

    const originLabel = `${originInfo.iata || originICAO} (${originInfo.city})`;
    const destLabel = `${destInfo.iata || destICAO} (${destInfo.city})`;

    const formattedTime = formatSimbriefDuration(estTimeSeconds);
    const formattedDistance = formatDistance(distance);
    const schedOutLocal = formatEpochInTimezone(schedOutEpoch, originInfo.tz);
    const schedInLocal = formatEpochInTimezone(schedInEpoch, destInfo.tz);
const logoContainer = document.getElementById("airlineLogoContainer");
if (logoContainer) {
  const logoPath = `/static/img/airline_logos/${airline}.png`;
  logoContainer.innerHTML = `
    <img src="${logoPath}" alt="${airline} logo"
         style="max-height: 40px; object-fit: contain;" onerror="this.style.display='none'">
  `;
}

window.simbriefFlightInfo = {
  flightNumber: `${airline}${flightNum}`,
  aircraftType: aircraft,
  airlineCode: airline,
  originIATA: originInfo.iata || originICAO,
  destIATA: destInfo.iata || destICAO
};
  return `
  <div style="padding: 10px 0; border-bottom: 1px solid #ddd;">
    <img src="/static/img/airline_logos/${airline}.png"
         alt="${airline} logo"
         style="max-height: 40px; object-fit: contain; display: block; margin: 0 auto 10px;"
         onerror="this.style.display='none'">
    <div style="text-align: center; font-size: 18px; font-weight: bold; color: #333;">
      ${airline}${flightNum}
    </div>
  </div>

  <div style="padding: 10px 0; border-bottom: 1px solid #ddd;">
    <div style="display: flex; justify-content: space-between; font-weight: 500;">
      <span id="departure_label">${t.simbriefFrom}</span> <span>${originLabel}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-weight: 500; margin-top: 4px;">
      <span id="arrival_label">${t.simbriefTo}</span> <span>${destLabel}</span>
    </div>
  </div>

  <div style="padding: 10px 0; border-bottom: 1px solid #ddd;">
    <div style="display: flex; justify-content: space-between;">
      <span id="aircraft_type_label">${t.simbriefAircraft}</span> <span>${aircraft}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
      <span id="flight_time_label">${t.simbriefFlightTime}</span> <span>${formattedTime}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
      <span id="distance_label">${t.simbriefDistance}</span> <span>${formattedDistance}</span>
    </div>
  </div>

  <div style="padding: 10px 0;">
    <div style="display: flex; justify-content: space-between;">
      <span id="departure_time_label">${t.simbriefScheduledOut}</span>
      <span style="white-space: nowrap; flex-shrink: 0; padding-right: 2px;">${schedOutLocal}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
      <span id="arrival_time_label">${t.simbriefScheduledIn}</span>
      <span style="white-space: nowrap; flex-shrink: 0; padding-right: 2px;">${schedInLocal}</span>
    </div>
  </div>
`;



  } catch (err) {
    console.error("SimBrief info panel fetch failed:", err);
    throw err;
  }
}

function formatSimbriefDuration(seconds) {
  const totalSeconds = parseInt(seconds);
  if (isNaN(totalSeconds)) return "--";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatEpochInTimezone(epoch, timezone) {
  const seconds = parseInt(epoch);
  if (isNaN(seconds)) return "--";

  const date = new Date(seconds * 1000);

  const day = date.toLocaleString('en-US', {
    timeZone: timezone || "UTC",
    day: "2-digit"
  });

  const month = date.toLocaleString('en-US', {
    timeZone: timezone || "UTC",
    month: "short"
  });

const hours = date.toLocaleString('en-US', {
  timeZone: timezone || "UTC",
  hour: "2-digit",
  hour12: false
}).padStart(2, "0")

const minutes = date.toLocaleString('en-US', {
  timeZone: timezone || "UTC",
  minute: "2-digit"
}).padStart(2, "0");

  return `${day} ${month} ${hours}:${minutes}`;
}


function formatDistance(nm) {
  const nautical = parseFloat(nm);
  if (isNaN(nautical)) return "--";
  const miles = (nautical * 1.15078).toFixed(0);
  const km = (nautical * 1.852).toFixed(0);
  return `${miles} mi / ${km} km`;
}

async function lookupAirportByICAO(icao) {
  try {
    const res = await fetch(`/lookup_airport/${icao}`);
    if (!res.ok) throw new Error("Not found");
    return await res.json(); // includes iata, city, tz, etc.
  } catch (err) {
    console.warn("Lookup failed for ICAO:", icao);
    return { iata: icao, city: "Unknown", name: "Unknown", tz: "UTC" };
  }
}

(function enablePanelDragging() {
  const panel = document.getElementById("infoPanel");
  const header = document.getElementById("infoPanelHeader");
  if (!panel || !header) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function startDrag(x, y) {
    isDragging = true;
    offsetX = x - panel.offsetLeft;
    offsetY = y - panel.offsetTop;
    document.body.style.userSelect = "none";
  }

  function doDrag(x, y) {
    if (isDragging) {
      panel.style.left = `${x - offsetX}px`;
      panel.style.top = `${y - offsetY}px`;
    }
  }

  function stopDrag() {
    isDragging = false;
    document.body.style.userSelect = "";
  }

  // Mouse events
  header.addEventListener("mousedown", e => startDrag(e.clientX, e.clientY));
  document.addEventListener("mousemove", e => doDrag(e.clientX, e.clientY));
  document.addEventListener("mouseup", stopDrag);

  header.addEventListener("touchstart", e => {
    const touch = e.touches[0];
    if (touch) startDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchmove", e => {
    const touch = e.touches[0];
    if (touch) doDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchend", stopDrag);
})();


function formatInfoRow(label, value) {
  return `
    <div style="margin: 8px 0; display: flex; justify-content: space-between; align-items: center;">
      <span style="color: #555;">${label}</span>
      <span style="font-weight: 500;">${value}</span>
    </div>
  `;
}
