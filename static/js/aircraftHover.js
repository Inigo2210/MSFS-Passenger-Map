let hoverPopupTimeout = null;

const aircraftInfoPopup = L.popup({
  closeButton: false,
  autoPan: false,
  className: 'aircraft-hover-popup',
  offset: L.point(0, -28)
});
function showAircraftHoverPopup(marker) {
  if (!currentRoute) return;

  if (!window.simbriefFlightInfo) {
const html = `
  <div style="text-align: center; font-size: 12px; max-width: 180px;">
    <strong>${translate("flightInfoNotLoaded")}</strong><br>
    ${translate("clickToImportSimbrief")}
  </div>
`;


    aircraftInfoPopup
      .setLatLng(marker.getLatLng())
      .setContent(html)
      .openOn(map);
    return;
  }

  const info = window.simbriefFlightInfo;

  const flightNumber = info.flightNumber || "--";
  const aircraftType = info.aircraftType || "--";
  const origin = info.originIATA || "--";
  const dest = info.destIATA || "--";
  const airlineCode = (info.airlineCode || "generic").toLowerCase();
  const routeText = `${origin} → ${dest}`;
  const logoPath = `/static/img/airline_logos/${airlineCode}.png`;

const html = `
  <div style="text-align: center; font-size: 11.5px; max-width: 180px;">
    <img src="${logoPath}" style="height: 20px; margin-bottom: 2px;" onerror="this.style.display='none'"><br>
    <strong style="font-size: 12px;">${flightNumber}</strong><br>
    <span>${aircraftType}</span><br>
    <span>${routeText}</span>
  </div>
`;


  aircraftInfoPopup
    .setLatLng(marker.getLatLng())
    .setContent(html)
    .openOn(map);
}


function attachAircraftHoverEvents(marker) {
  marker.on('mouseover', () => showAircraftHoverPopup(marker));
  marker.on('mouseout', () => {
    if (hoverPopupTimeout) clearTimeout(hoverPopupTimeout);
    hoverPopupTimeout = setTimeout(() => {
      map.closePopup(aircraftInfoPopup);
    }, 2000);
  });
}
