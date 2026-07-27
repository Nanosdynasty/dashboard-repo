/* HRP Dashboard — in dev */
const state = {
  tracker: "world_ports", offset: 0, total: 0, limit: 100,
  map: null, markers: null, vesselLayer: null, routeLayer: null,
  seaLabels: null, ecaLayer: null, piracyLayer: null,
  page: "map", _view: "map",
  ports: [], portByName: {},
  congestion: { ports: [] }, congestionLevel: "", congestionOnly: false, congLegendCtrl: null,
};
const ENERGY = ["coal_plants","coal_terminals","solar","wind","hydro","nuclear"];
const CONG_COLORS = { low: "#22c55e", medium: "#eab308", high: "#f97316", severe: "#ef4444" };
const STATUS_COLORS = {
  operating: "#22c55e", construction: "#f97316", announced: "#3b82f6",
  shelved: "#ef4444", cancelled: "#ef4444", retired: "#64748b"
};
const WEATHER_HUBS = [
  { name: "Singapore", lat: 1.26, lon: 103.85 },
  { name: "Rotterdam", lat: 51.95, lon: 4.14 },
  { name: "Shanghai", lat: 31.23, lon: 121.48 },
  { name: "Houston", lat: 29.73, lon: -95.27 },
  { name: "Richards Bay", lat: -28.8, lon: 32.08 },
  { name: "Port Hedland", lat: -20.31, lon: 118.57 },
];

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadTrackers();
  loadPorts();
  loadZones();
  loadCongestion();
  loadWeatherHubs();
  bindUI();
  setPage("map");
  loadData();
});

function initMap() {
  state.map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "OSM · CARTO", maxZoom: 18
  }).addTo(state.map);
  if (typeof L.markerClusterGroup === "function") {
    state.markers = L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 9 });
  } else {
    state.markers = L.layerGroup();
  }
  state.map.addLayer(state.markers);
  state.vesselLayer = L.layerGroup().addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  state.seaLabels = L.layerGroup().addTo(state.map);
  state.ecaLayer = L.layerGroup().addTo(state.map);
  state.piracyLayer = L.layerGroup().addTo(state.map);
}

async function loadZones() {
  try {
    const geo = await (await fetch("/api/zones")).json();
    (geo.features || []).forEach(f => {
      const p = f.properties || {};
      const isEca = p.zone_type === "ECA";
      const layer = L.geoJSON(f, {
        style: isEca
          ? { color: "#38bdf8", weight: 1.5, dashArray: "6 4", fillColor: "#0ea5e9", fillOpacity: 0.12 }
          : { color: "#f87171", weight: 1.5, dashArray: "4 3", fillColor: "#ef4444", fillOpacity: 0.12 }
      });
      if (isEca) layer.addTo(state.ecaLayer);
      else layer.addTo(state.piracyLayer);
    });
  } catch (e) { console.warn("zones", e); }
}

function setPage(name) {
  state.page = name;
  document.querySelectorAll(".rail-item[data-page]").forEach(b => {
    b.classList.toggle("active", b.dataset.page === name);
  });
  const panelMap = { map: "ports", ports: "ports", vessels: "vessels", route: "route", energy: "energy", ask: "ask" };
  const pid = panelMap[name] || "ports";
  document.querySelectorAll(".panel-page").forEach(pg => {
    pg.classList.toggle("active", pg.id === "page-" + pid);
  });
  const titles = {
    map: "Map · World Ports", ports: "Ports", vessels: "Vessels",
    route: "Route", energy: "Energy", ask: "Ask"
  };
  const st = document.getElementById("stage-title");
  if (st) st.textContent = titles[name] || "Map";
  if (name === "energy") {
    const first = document.querySelector("#tracker-list .tracker-item");
    if (first && (state.tracker === "world_ports" || !ENERGY.includes(state.tracker))) first.click();
  } else if (["map", "ports", "route", "vessels"].includes(name) && state.tracker !== "world_ports") {
    state.tracker = "world_ports";
    state.offset = 0;
    loadData();
  }
  if (name !== "ask") switchView(state._view || "map");
  setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 80);
}

async function loadWeatherHubs() {
  const el = document.getElementById("weather-hubs");
  if (!el) return;
  el.innerHTML = "<div class='hint'>Loading weather…</div>";
  const cards = [];
  for (const h of WEATHER_HUBS) {
    try {
      const w = await (await fetch("/api/weather?lat=" + h.lat + "&lon=" + h.lon)).json();
      const parts = [];
      if (w.wind_speed_kn != null) parts.push("Wind " + w.wind_speed_kn + " kn");
      if (w.wave_height_m != null) parts.push("Wave " + w.wave_height_m + " m");
      if (w.sst_c != null) parts.push("SST " + w.sst_c + "°C");
      cards.push(
        '<div class="wx-card" data-lat="' + h.lat + '" data-lon="' + h.lon + '">' +
        '<div class="wx-name">' + h.name + '</div>' +
        '<div class="wx-vals">' + (parts.length ? parts.map(function(x){return "<span>"+x+"</span>";}).join("") : "<span>n/a</span>") + '</div></div>'
      );
    } catch (e) {
      cards.push('<div class="wx-card"><div class="wx-name">' + h.name + '</div><div class="wx-vals"><span>unavailable</span></div></div>');
    }
  }
  el.innerHTML = cards.join("") || "<div class='hint'>Unavailable</div>";
  el.querySelectorAll(".wx-card[data-lat]").forEach(function(c) {
    c.onclick = function() {
      var lat = +c.dataset.lat, lon = +c.dataset.lon;
      if (state.map) state.map.setView([lat, lon], 7);
    };
  });
}

async function loadPorts() {
  try {
    const ports = await (await fetch("/api/ports")).json();
    state.ports = ports;
    state.portByName = {};
    const dl = document.getElementById("port-list");
    if (dl) {
      dl.innerHTML = ports.map(function(p) {
        var key = (p.name + (p.country ? " (" + p.country + ")" : "")).trim();
        state.portByName[key.toLowerCase()] = p;
        state.portByName[p.name.toLowerCase()] = p;
        return '<option value="' + key.replace(/"/g, "") + '"></option>';
      }).join("");
    }
    ["from", "to"].forEach(function(side) {
      var inp = document.getElementById("port-" + side + "-search");
      if (!inp) return;
      inp.addEventListener("change", function() { pickPort(side, inp.value); });
      inp.addEventListener("blur", function() { pickPort(side, inp.value); });
    });
  } catch (e) { console.error("ports", e); }
}

function pickPort(side, text) {
  var t = (text || "").trim().toLowerCase();
  if (!t) return;
  var p = state.portByName[t] || state.ports.find(function(x) { return x.name.toLowerCase().includes(t); });
  if (!p) {
    document.getElementById("port-" + side + "-label").textContent = "Not found";
    return;
  }
  document.getElementById("route-" + side + "-lat").value = p.lat;
  document.getElementById("route-" + side + "-lon").value = p.lon;
  document.getElementById("port-" + side + "-label").textContent =
    p.name + " (" + Number(p.lat).toFixed(2) + ", " + Number(p.lon).toFixed(2) + ")";
}

async function loadTrackers() {
  try {
    const list = await (await fetch("/api/trackers")).json();
    const energyEl = document.getElementById("tracker-list");
    if (!energyEl) return;
    energyEl.innerHTML = "";
    list.forEach(function(t) {
      if (t.id === "world_ports") return;
      var div = document.createElement("div");
      div.className = "tracker-item" + (t.id === state.tracker ? " active" : "");
      div.dataset.id = t.id;
      div.innerHTML = "<span>" + (t.icon || "") + "</span><div><div>" + t.label + "</div><div class='meta'>" +
        (t.rows ? t.rows.toLocaleString() + " units" : "") + "</div></div>";
      div.onclick = function() {
        state.tracker = t.id;
        state.offset = 0;
        document.querySelectorAll(".tracker-item").forEach(function(x) { x.classList.remove("active"); });
        div.classList.add("active");
        loadData();
      };
      energyEl.appendChild(div);
    });
  } catch (e) { console.error("trackers", e); }
}

function getFilterParams() {
  var p = new URLSearchParams();
  p.set("limit", state.limit);
  p.set("offset", state.offset);
  return p;
}

async function loadData() {
  await Promise.all([loadKPIs(), loadTable(), loadMap()]);
}

async function loadKPIs() {
  var strip = document.getElementById("kpi-strip");
  if (!strip) return;
  try {
    var k = await (await fetch("/api/kpis/" + state.tracker)).json();
    if (state.tracker === "world_ports") {
      strip.innerHTML =
        '<div class="kpi-card"><div class="label">Ports</div><div class="value">' +
        Number(k.total_units).toLocaleString() + '</div><div class="sub">' + k.countries +
        ' countries</div></div>';
      return;
    }
    strip.innerHTML =
      '<div class="kpi-card"><div class="label">Units</div><div class="value">' +
      Number(k.total_units).toLocaleString() + '</div></div>' +
      '<div class="kpi-card"><div class="label">Countries</div><div class="value">' +
      k.countries + '</div></div>';
  } catch (e) { console.error("kpis", e); }
}

async function loadTable() {
  try {
    var json = await (await fetch("/api/data/" + state.tracker + "?" + getFilterParams())).json();
    state.total = json.total;
    var thead = document.querySelector("#data-table thead");
    var tbody = document.querySelector("#data-table tbody");
    if (!json.data || !json.data.length) {
      thead.innerHTML = "";
      tbody.innerHTML = "<tr><td>No rows</td></tr>";
      return;
    }
    var cols = Object.keys(json.data[0]).slice(0, 8);
    thead.innerHTML = "<tr>" + cols.map(function(c) { return "<th>" + c + "</th>"; }).join("") + "</tr>";
    tbody.innerHTML = json.data.map(function(row) {
      return "<tr>" + cols.map(function(c) { return "<td>" + (row[c] != null ? row[c] : "") + "</td>"; }).join("") + "</tr>";
    }).join("");
    document.getElementById("table-info").textContent = json.data.length + " of " + json.total;
  } catch (e) { console.error("table", e); }
}

function portPopupHtml(p) {
  var cong = "";
  if (p.congestion_level) {
    cong = "<tr><td>Congestion</td><td>" + p.congestion_level + "</td></tr>" +
      "<tr><td>Waiting</td><td>" + (p.waiting_vessels != null ? p.waiting_vessels : "—") + "</td></tr>";
  }
  var safeName = (p.name || "").replace(/'/g, "\\'");
  return '<div class="port-popup"><h4>' + (p.name || "—") + '</h4><table>' +
    "<tr><td>Country</td><td>" + (p.country || "—") + "</td></tr>" +
    "<tr><td>Depth</td><td>" + (p.channel_depth || p.CHAN_DEPTH || "—") + "</td></tr>" + cong +
    '</table><button type="button" onclick="usePort(\'' + safeName + '\',' + p.lat + ',' + p.lon +
    ')">Use in route</button></div>';
}
