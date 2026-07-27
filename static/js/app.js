const LAYER_CONFIG = {
  coal_plants: { label: "Coal plant", color: "#6f7782", radius: 3 },
  solar: { label: "Solar power", color: "#e9a823", radius: 2 },
  wind: { label: "Wind power", color: "#55a6c8", radius: 2 },
  hydro: { label: "Hydropower", color: "#296fba", radius: 3 },
  nuclear: { label: "Nuclear power", color: "#8b65b6", radius: 4 },
  geothermal: { label: "Geothermal", color: "#db5b45", radius: 3 },
  bioenergy: { label: "Bioenergy", color: "#629c4d", radius: 2 },
  coal_mines: { label: "Coal mine", color: "#242b38", radius: 3 },
  coal_terminals: { label: "Coal terminal", color: "#db2f34", radius: 3 },
  iron_ore_mines: { label: "Iron ore mine", color: "#a45332", radius: 3 },
  steel_plants: { label: "Iron & steel plant", color: "#536a7a", radius: 3 },
  cement_plants: { label: "Cement plant", color: "#9a8a73", radius: 3 }
};

const state = {
  map: null,
  portLayer: null,
  assetLayers: new Map(),
  assetCache: new Map(),
  ports: [],
  filteredPorts: [],
  routeLayer: null,
  routeMode: false,
  routePorts: []
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.map = L.map("map", {
    preferCanvas: true,
    worldCopyJump: true,
    zoomControl: true,
    minZoom: 2
  }).setView([18, 10], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(state.map);
  state.portLayer = L.layerGroup().addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  bindControls();
  await loadPortFacets();
  await loadPorts();
}

function bindControls() {
  document.querySelectorAll("#energy-layers input, #coal-layers input, #iron-layers input, #cement-layers input")
    .forEach(input => input.addEventListener("change", () => toggleAssetLayer(input)));
  document.getElementById("show-ports").addEventListener("change", renderPorts);
  document.getElementById("port-country").addEventListener("change", loadPorts);
  document.getElementById("port-size").addEventListener("change", loadPorts);
  document.querySelectorAll("#port-categories input").forEach(input => input.addEventListener("change", loadPorts));
  document.getElementById("route-pick").addEventListener("click", startRoutePicking);
  document.getElementById("route-reset").addEventListener("click", resetRoute);
  document.getElementById("route-speed").addEventListener("change", () => {
    if (state.routePorts.length === 2) calculateRoute();
  });
  document.getElementById("close-port-card").addEventListener("click", closePortCard);
  document.getElementById("fit-world").addEventListener("click", () => state.map.setView([18, 10], 2));
}

async function loadPortFacets() {
  const response = await fetch("/api/ports/facets");
  const json = await response.json();
  const facets = json.facets || {};
  const country = document.getElementById("port-country");
  country.innerHTML = '<option value="">All countries</option>' +
    (facets.countries || []).map(item =>
      `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)} (${Number(item.count).toLocaleString()})</option>`
    ).join("");
  const size = document.getElementById("port-size");
  size.innerHTML = '<option value="">All sizes</option>' +
    (facets.harbor_sizes || []).map(item =>
      `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)} (${Number(item.count).toLocaleString()})</option>`
    ).join("");
  const counts = Object.fromEntries((facets.categories || []).map(item => [item.id, item.count]));
  ["dry_bulk", "coal", "oil", "container", "liquid_bulk", "lng"].forEach(key => {
    const el = document.getElementById("count-" + key.replaceAll("_", "-"));
    if (el) el.textContent = Number(counts[key] || 0).toLocaleString();
  });
}

function portParams() {
  const params = new URLSearchParams({ limit: "10000" });
  const categories = Array.from(document.querySelectorAll("#port-categories input:checked")).map(x => x.value);
  const country = document.getElementById("port-country").value;
  const size = document.getElementById("port-size").value;
  if (categories.length) params.set("categories", categories.join(","));
  if (country) params.set("countries", country);
  if (size) params.set("harbor_sizes", size);
  return params;
}

async function loadPorts() {
  setLoading(true, "Loading ports…");
  try {
    const response = await fetch("/api/map/world_ports?" + portParams());
    if (!response.ok) throw new Error("Could not load ports");
    state.ports = await response.json();
    state.filteredPorts = state.ports;
    renderPorts();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setLoading(false);
  }
}

function renderPorts() {
  state.portLayer.clearLayers();
  const visible = document.getElementById("show-ports").checked;
  if (!visible) {
    document.getElementById("port-visible-count").textContent = "hidden";
    updateMapStatus();
    return;
  }
  const renderer = L.canvas({ padding: 0.5 });
  state.filteredPorts.forEach(port => {
    const lat = Number(port.lat);
    const lon = Number(port.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const marker = L.circleMarker([lat, lon], {
      renderer,
      radius: 2.4,
      color: "#ffffff",
      weight: 0.55,
      fillColor: portColor(port.categories),
      fillOpacity: 0.88
    });
    marker.bindTooltip(portTooltip(port), {
      className: "port-tooltip",
      direction: "top",
      opacity: 1
    });
    marker.on("click", () => handlePortClick(port));
    marker.addTo(state.portLayer);
  });
  document.getElementById("port-visible-count").textContent =
    state.filteredPorts.length.toLocaleString() + " shown";
  updateMapStatus();
}

function portColor(categories = []) {
  if (categories.includes("coal")) return "#db2f34";
  if (categories.includes("dry_bulk")) return "#b52a2a";
  if (categories.includes("oil")) return "#b36b3f";
  if (categories.includes("container")) return "#258aa5";
  if (categories.includes("lng")) return "#6855a4";
  return "#003671";
}

function portTooltip(port) {
  const cats = (port.categories || []).map(labelize).join(" · ") || "World port";
  return `<strong>${escapeHtml(port.name)}</strong>${escapeHtml(port.country || "")}<br>${escapeHtml(cats)}`;
}

async function toggleAssetLayer(input) {
  const id = input.value;
  if (!input.checked) {
    const layer = state.assetLayers.get(id);
    if (layer) state.map.removeLayer(layer);
    updateActiveCounts();
    updateMapStatus();
    return;
  }
  setLoading(true, `Loading ${LAYER_CONFIG[id].label.toLowerCase()}…`);
  try {
    let points = state.assetCache.get(id);
    if (!points) {
      const response = await fetch(`/api/map/${encodeURIComponent(id)}?limit=150000`);
      if (!response.ok) throw new Error(`Could not load ${LAYER_CONFIG[id].label}`);
      points = await response.json();
      state.assetCache.set(id, points);
    }
    let layer = state.assetLayers.get(id);
    if (!layer) {
      layer = buildAssetLayer(id, points);
      state.assetLayers.set(id, layer);
    }
    layer.addTo(state.map);
  } catch (error) {
    input.checked = false;
    setStatus(error.message);
  } finally {
    setLoading(false);
    updateActiveCounts();
    updateMapStatus();
  }
}

function buildAssetLayer(id, points) {
  const config = LAYER_CONFIG[id];
  const group = L.layerGroup();
  const renderer = L.canvas({ padding: 0.5 });
  points.forEach(point => {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const marker = L.circleMarker([lat, lon], {
      renderer,
      radius: config.radius,
      color: "#ffffff",
      weight: 0.45,
      fillColor: config.color,
      fillOpacity: 0.84
    });
    marker.bindTooltip(assetTooltip(config, point), {
      className: "asset-tooltip",
      direction: "top",
      opacity: 1
    });
    marker.on("click", () => showAssetCard(config, point));
    marker.addTo(group);
  });
  return group;
}

function assetTooltip(config, point) {
  const capacity = point.capacity == null ? "" :
    `<br>${Number(point.capacity).toLocaleString()} ${escapeHtml(point.capacity_unit || "MW")}`;
  return `<strong>${escapeHtml(point.name || config.label)}</strong>` +
    `${escapeHtml(point.country || "")}${point.status ? " · " + escapeHtml(point.status) : ""}${capacity}`;
}

function handlePortClick(port) {
  if (!state.routeMode) {
    showPortCard(port);
    return;
  }
  if (state.routePorts.length === 2) resetRoute(false);
  state.routePorts.push(port);
  updateRouteSelection();
  if (state.routePorts.length === 2) {
    state.routeMode = false;
    document.getElementById("route-pick").classList.remove("active");
    document.getElementById("route-pick").textContent = "Select two ports on map";
    calculateRoute();
  }
}

function startRoutePicking() {
  resetRoute(false);
  state.routeMode = true;
  closePortCard();
  const button = document.getElementById("route-pick");
  button.classList.add("active");
  button.textContent = "Click origin port…";
  document.getElementById("route-result").textContent = "Click a port dot for the origin, then another for the destination.";
}

function updateRouteSelection() {
  const from = state.routePorts[0];
  const to = state.routePorts[1];
  document.getElementById("route-from-name").textContent = from ? from.name : "Select origin";
  document.getElementById("route-to-name").textContent = to ? to.name : "Select destination";
  const button = document.getElementById("route-pick");
  if (state.routeMode) button.textContent = from ? "Click destination port…" : "Click origin port…";
}

function resetRoute(clearText = true) {
  state.routeLayer.clearLayers();
  state.routePorts = [];
  state.routeMode = false;
  const button = document.getElementById("route-pick");
  button.classList.remove("active");
  button.textContent = "Select two ports on map";
  updateRouteSelection();
  if (clearText) document.getElementById("route-result").textContent = "Click the button, then choose two port dots.";
}

async function calculateRoute() {
  if (state.routePorts.length !== 2) return;
  const [from, to] = state.routePorts;
  const speed = Number(document.getElementById("route-speed").value) || 12;
  const result = document.getElementById("route-result");
  result.textContent = "Calculating sea route…";
  try {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_lon: from.lon,
        from_lat: from.lat,
        to_lon: to.lon,
        to_lat: to.lat,
        speed_knots: speed,
        from_name: from.name,
        to_name: to.name
      })
    });
    const route = await response.json();
    if (!response.ok) throw new Error(route.detail || "Route calculation failed");
    const coordinates = (route.coordinates || []).map(item => [item[1], item[0]]);
    state.routeLayer.clearLayers();
    if (coordinates.length) {
      L.polyline(coordinates, { color: "#db2f34", weight: 3.2, opacity: 0.92 }).addTo(state.routeLayer);
      L.circleMarker([from.lat, from.lon], { radius: 6, color: "#fff", weight: 2, fillColor: "#003671", fillOpacity: 1 }).addTo(state.routeLayer);
      L.circleMarker([to.lat, to.lon], { radius: 6, color: "#fff", weight: 2, fillColor: "#db2f34", fillOpacity: 1 }).addTo(state.routeLayer);
      state.map.fitBounds(coordinates, { padding: [50, 50] });
    }
    const nm = route.distance_nm != null ? route.distance_nm : route.distance_km / 1.852;
    const days = route.duration_days != null ? route.duration_days : nm / speed / 24;
    const totalHours = Math.round(days * 24);
    const wholeDays = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    result.innerHTML = `<strong>${Number(nm).toLocaleString(undefined, {maximumFractionDigits: 0})} nm</strong>` +
      `<b>${wholeDays} days ${hours} hours</b> at ${speed} kn` +
      `<br>${escapeHtml(route.via ? "Via " + route.via : "Estimated sea route")}` +
      `<br><small>Analytical estimate only—not for navigation.</small>`;
  } catch (error) {
    result.textContent = error.message;
  }
}

async function showPortCard(port) {
  const response = await fetch("/api/ports/" + encodeURIComponent(port.id));
  const detail = response.ok ? await response.json() : port;
  const card = document.getElementById("port-card");
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">Port</span><h2>${escapeHtml(detail.name)}</h2>` +
    `<p class="detail-meta">${escapeHtml(detail.country || "Country unknown")}` +
    `${detail.unlocode ? " · " + escapeHtml(detail.unlocode) : ""}</p>` +
    `<div class="detail-grid">` +
    detailCell("Harbor size", detail.harbor_size) +
    detailCell("Harbor type", detail.harbor_type) +
    detailCell("Channel depth", detail.channel_depth) +
    detailCell("Cargo pier", detail.cargo_depth) +
    detailCell("Anchorage", detail.anchorage_depth) +
    detailCell("Max vessel", detail.max_vessel) +
    `</div><p class="detail-note">Berth count is unknown in the current source. Unknown values are not treated as zero.</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

function showAssetCard(config, point) {
  const card = document.getElementById("port-card");
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">${escapeHtml(config.label)}</span><h2>${escapeHtml(point.name || config.label)}</h2>` +
    `<p class="detail-meta">${escapeHtml(point.country || "Country unknown")}</p>` +
    `<div class="detail-grid">` +
    detailCell("Status", point.status) +
    detailCell("Capacity", point.capacity == null ? "Unknown" :
      Number(point.capacity).toLocaleString() + " " + (point.capacity_unit || "MW")) +
    `</div><p class="detail-note">Source: Global Energy Monitor workbook layer.</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

function closePortCard() {
  const card = document.getElementById("port-card");
  card.classList.remove("open");
  card.setAttribute("aria-hidden", "true");
}

function detailCell(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Unknown")}</strong></div>`;
}

function updateActiveCounts() {
  const energy = document.querySelectorAll("#energy-layers input:checked").length;
  const commodities = document.querySelectorAll("#coal-layers input:checked, #iron-layers input:checked, #cement-layers input:checked").length;
  document.getElementById("energy-active-count").textContent = `${energy} active`;
  document.getElementById("commodity-active-count").textContent = `${commodities} active`;
}

function updateMapStatus() {
  const ports = document.getElementById("show-ports").checked ? state.filteredPorts.length : 0;
  let assets = 0;
  state.assetLayers.forEach((layer, id) => {
    if (state.map.hasLayer(layer)) assets += (state.assetCache.get(id) || []).length;
  });
  const parts = [];
  if (ports) parts.push(`${ports.toLocaleString()} ports`);
  if (assets) parts.push(`${assets.toLocaleString()} assets`);
  setStatus(parts.length ? parts.join(" · ") : "No layers selected");
}

function setStatus(text) {
  document.getElementById("map-status").textContent = text;
}

function setLoading(active, text = "Loading layer…") {
  const indicator = document.getElementById("loading-indicator");
  indicator.hidden = !active;
  indicator.textContent = text;
}

function labelize(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
