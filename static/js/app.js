/* GEM Dashboard — all World Ports on map */
const state = {
  tracker: "world_ports", offset: 0, limit: 100, total: 0,
  map: null, markers: null, cluster: null, vesselLayer: null, routeLayer: null, seaLabels: null,
  ports: [], portByName: {}, vesselMarkers: new Map(),
  portFacets: {}, portSummary: {}, selectedPort: null
};
const STATUS_COLORS = {
  operating: "#65BD8B", construction: "#FE4F2D", announced: "#4A57A8",
  "pre-permit": "#4A57A8", permitted: "#4A57A8", proposed: "#4A57A8",
  shelved: "#7F142A", cancelled: "#7F142A", mothballed: "#8a9aa3", retired: "#8a9aa3"
};
const PORT_CATEGORIES = {
  dry_bulk: { label: "Dry bulk", color: "#18b7a0" },
  coal: { label: "Coal terminal", color: "#f4a340" },
  container: { label: "Container", color: "#4aa8d8" },
  breakbulk: { label: "Breakbulk", color: "#8bd3c7" },
  liquid_bulk: { label: "Liquid bulk", color: "#d97845" },
  oil: { label: "Oil terminal", color: "#e06a4d" },
  lng: { label: "LNG", color: "#9278d2" },
  roro: { label: "Ro-Ro", color: "#e7c65b" },
  anchorage: { label: "Anchorage", color: "#8ca0ad" }
};
const ALL_STATUSES = ["operating","construction","announced","pre-permit","permitted","proposed","shelved","cancelled","mothballed","retired"];
const SEA_LABELS = [
  {name:"Mediterranean Sea",lat:35,lon:18},{name:"Red Sea",lat:20,lon:38},
  {name:"Persian Gulf",lat:26.5,lon:52},{name:"Arabian Sea",lat:15,lon:65},
  {name:"Bay of Bengal",lat:15,lon:88},{name:"South China Sea",lat:12,lon:115},
  {name:"East China Sea",lat:28,lon:125},{name:"North Sea",lat:56,lon:3},
  {name:"Baltic Sea",lat:58,lon:20},{name:"Caribbean Sea",lat:15,lon:-75},
  {name:"Gulf of Mexico",lat:25,lon:-90},{name:"Indian Ocean",lat:-20,lon:80},
  {name:"Suez Canal",lat:30.5,lon:32.4},{name:"Strait of Hormuz",lat:26.5,lon:56.5},
  {name:"Strait of Malacca",lat:2.5,lon:101.5},{name:"Bab el-Mandeb",lat:12.6,lon:43.3},
  {name:"Cape of Good Hope",lat:-34.3,lon:18.4},{name:"Singapore Strait",lat:1.2,lon:103.8}
];

document.addEventListener("DOMContentLoaded", function() {
  initMap();
  initStatusDD();
  initNavGroups();
  bindUI();
  switchView("map");
  var vg = document.getElementById("group-vessels");
  var eg = document.getElementById("group-energy");
  if (vg) vg.classList.add("open");
  if (eg) eg.classList.remove("open");
  state.tracker = "world_ports";
  Promise.all([loadTrackers(), loadPorts(), loadPortFacets()]).then(function() { loadData(); });
});

function initMap() {
  state.map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "OSM CARTO", maxZoom: 18
  }).addTo(state.map);
  if (typeof L.markerClusterGroup === "function") {
    state.cluster = L.markerClusterGroup({
      maxClusterRadius: 40, spiderfyOnMaxZoom: true,
      showCoverageOnHover: false, disableClusteringAtZoom: 8
    });
    state.map.addLayer(state.cluster);
    state.markers = state.cluster;
  } else {
    state.markers = L.layerGroup().addTo(state.map);
  }
  state.vesselLayer = L.layerGroup().addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  state.seaLabels = L.layerGroup().addTo(state.map);
  SEA_LABELS.forEach(function(s) {
    var icon = L.divIcon({
      className: "sea-label", html: "<span>" + s.name + "</span>",
      iconSize: [120, 18], iconAnchor: [60, 9]
    });
    L.marker([s.lat, s.lon], { icon: icon, interactive: false }).addTo(state.seaLabels);
  });
}

function initNavGroups() {
  document.querySelectorAll(".nav-group-header").forEach(function(btn) {
    btn.onclick = function() {
      var g = btn.closest(".nav-group");
      var wasOpen = g.classList.contains("open");
      document.querySelectorAll(".nav-group").forEach(function(x) { x.classList.remove("open"); });
      if (!wasOpen) g.classList.add("open");
      if (g.id === "group-vessels" && !wasOpen) {
        state.tracker = "world_ports";
        state.offset = 0;
        document.querySelectorAll(".tracker-item").forEach(function(x) {
          x.classList.toggle("active", x.dataset.id === "world_ports");
        });
        loadData();
      }
    };
  });
}

function initStatusDD() {
  var panel = document.getElementById("dd-status-panel");
  if (!panel) return;
  panel.innerHTML = ALL_STATUSES.map(function(s) {
    return '<label class="dd-item"><input type="checkbox" value="' + s + '"/> ' + s + "</label>";
  }).join("");
  var sb = document.getElementById("dd-status-btn");
  var cb = document.getElementById("dd-country-btn");
  if (sb) sb.onclick = function(e) {
    e.stopPropagation();
    document.getElementById("dd-status").classList.toggle("open");
    document.getElementById("dd-country").classList.remove("open");
  };
  if (cb) cb.onclick = function(e) {
    e.stopPropagation();
    document.getElementById("dd-country").classList.toggle("open");
    document.getElementById("dd-status").classList.remove("open");
  };
  document.addEventListener("click", function() {
    var ds = document.getElementById("dd-status");
    var dc = document.getElementById("dd-country");
    if (ds) ds.classList.remove("open");
    if (dc) dc.classList.remove("open");
  });
  if (panel) panel.onclick = function(e) { e.stopPropagation(); };
  var cp = document.getElementById("dd-country-panel");
  if (cp) cp.onclick = function(e) { e.stopPropagation(); };
}

async function loadPorts() {
  try {
    var response = await (await fetch("/api/ports?limit=10000")).json();
    state.ports = Array.isArray(response) ? response : (response.data || []);
    state.portByName = {};
    var dl = document.getElementById("port-list");
    if (dl) {
      dl.innerHTML = state.ports.map(function(p) {
        var key = (p.name + (p.country ? " (" + p.country + ")" : "")).trim();
        state.portByName[key.toLowerCase()] = p;
        state.portByName[String(p.name || "").toLowerCase()] = p;
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

async function loadPortFacets() {
  try {
    var json = await (await fetch("/api/ports/facets")).json();
    state.portFacets = json.facets || {};
    state.portSummary = json.summary || {};
    var countries = state.portFacets.countries || [];
    var country = document.getElementById("port-country-filter");
    if (country) {
      country.innerHTML = '<option value="">All countries</option>' + countries.map(function(row) {
        var value = typeof row === "string" ? row : row.id;
        var count = typeof row === "string" ? "" : " (" + Number(row.count || 0).toLocaleString() + ")";
        return '<option value="' + escAttr(value) + '">' + esc(value) + count + "</option>";
      }).join("");
    }
    var counts = {};
    (state.portFacets.categories || []).forEach(function(row) { counts[row.id] = row.count; });
    var categoryBox = document.getElementById("port-category-options");
    if (categoryBox) {
      categoryBox.innerHTML = Object.keys(PORT_CATEGORIES).map(function(key) {
        var count = Number(counts[key] || 0);
        return '<label class="category-option' + (count ? "" : " is-empty") + '">' +
          '<input type="checkbox" value="' + key + '"' + (count ? "" : " disabled") + "/>" +
          '<span class="category-dot" style="background:' + PORT_CATEGORIES[key].color + '"></span>' +
          "<span>" + PORT_CATEGORIES[key].label + "</span><small>" + count.toLocaleString() + "</small></label>";
      }).join("");
    }
    updatePortCoverageNote();
  } catch (e) { console.error("port facets", e); }
}

function updatePortCoverageNote(filteredTotal) {
  var note = document.getElementById("port-coverage-note");
  if (!note) return;
  var summary = state.portSummary || {};
  var total = Number(summary.total || 0);
  var dry = Number(summary.dry_bulk || 0);
  var channel = Number(summary.with_channel_depth || 0);
  var shown = filteredTotal == null ? dry : Number(filteredTotal);
  note.textContent = shown.toLocaleString() + " ports match · " + dry.toLocaleString() +
    " dry-bulk/coal classified · " + channel.toLocaleString() +
    " have channel-depth data. Unknown values are not treated as zero.";
}

function pickPort(side, text) {
  var t = (text || "").trim().toLowerCase();
  if (!t) return;
  var p = state.portByName[t] || state.ports.find(function(x) {
    return String(x.name || "").toLowerCase() === t || String(x.name || "").toLowerCase().indexOf(t) >= 0;
  });
  if (!p) {
    document.getElementById("port-" + side + "-label").textContent = "Port not found";
    return;
  }
  document.getElementById("route-" + side + "-lat").value = p.lat;
  document.getElementById("route-" + side + "-lon").value = p.lon;
  document.getElementById("port-" + side + "-label").textContent =
    p.name + (p.country ? " · " + p.country : "") +
    " (" + Number(p.lat).toFixed(2) + ", " + Number(p.lon).toFixed(2) + ")";
}

async function loadTrackers() {
  try {
    var list = await (await fetch("/api/trackers")).json();
    var energyEl = document.getElementById("tracker-list");
    var vesselEl = document.getElementById("vessel-tracker-list");
    if (energyEl) energyEl.innerHTML = "";
    if (vesselEl) vesselEl.innerHTML = "";
    list.forEach(function(t) {
      var parent = t.id === "world_ports" ? vesselEl : energyEl;
      if (parent) parent.appendChild(makeItem(t));
    });
  } catch (e) { console.error("trackers", e); }
}

function makeItem(t) {
  var div = document.createElement("div");
  div.className = "tracker-item" + (t.id === state.tracker ? " active" : "");
  div.dataset.id = t.id;
  var meta = "";
  if (t.id === "coal_terminals") meta = (t.rows ? t.rows.toLocaleString() + " terminals" : "");
  else if (t.id === "world_ports") {
    meta = (t.rows ? t.rows.toLocaleString() + " ports" : "");
    if (t.countries) meta += " · " + t.countries + " countries";
  } else meta = (t.rows ? t.rows.toLocaleString() + " units" : "");
  div.innerHTML = '<span class="icon">' + (t.icon || "") + '</span><div><div>' + t.label +
    '</div><div class="meta">' + meta + "</div></div>";
  div.onclick = function() {
    state.tracker = t.id;
    state.offset = 0;
    document.querySelectorAll(".tracker-item").forEach(function(x) { x.classList.remove("active"); });
    div.classList.add("active");
    document.querySelectorAll(".nav-group").forEach(function(g) { g.classList.remove("open"); });
    document.getElementById(t.id === "world_ports" ? "group-vessels" : "group-energy").classList.add("open");
    loadCountries();
    loadData();
  };
  return div;
}

async function loadCountries() {
  try {
    var rows = await (await fetch("/api/countries/" + state.tracker)).json();
    var panel = document.getElementById("dd-country-panel");
    if (!panel) return;
    panel.innerHTML = rows.map(function(r) {
      return '<label class="dd-item"><input type="checkbox" value="' + r.country + '"/> ' +
        r.country + ' <span class="hint">(' + Math.round(r.capacity).toLocaleString() + ")</span></label>";
    }).join("") || "<div class='dd-item'>No countries</div>";
  } catch (e) { console.error(e); }
}

function getFilterParams() {
  var statuses = Array.from(document.querySelectorAll("#dd-status-panel input:checked")).map(function(i) { return i.value; });
  var countries = Array.from(document.querySelectorAll("#dd-country-panel input:checked")).map(function(i) { return i.value; });
  var p = new URLSearchParams();
  if (state.tracker !== "world_ports" && statuses.length) p.set("status", statuses.join(","));
  if (countries.length) p.set("country", countries.join(","));
  var minEl = document.getElementById("filter-min-mw");
  var maxEl = document.getElementById("filter-max-mw");
  if (minEl && minEl.value && state.tracker !== "world_ports") p.set("min_mw", minEl.value);
  if (maxEl && maxEl.value && state.tracker !== "world_ports") p.set("max_mw", maxEl.value);
  var searchEl = document.getElementById("filter-search");
  if (searchEl && searchEl.value.trim()) p.set("search", searchEl.value.trim());
  p.set("limit", state.limit);
  p.set("offset", state.offset);
  var sb = document.getElementById("dd-status-btn");
  var cb = document.getElementById("dd-country-btn");
  if (sb) sb.textContent = statuses.length ? statuses.length + " status selected" : "Select status…";
  if (cb) cb.textContent = countries.length ? countries.length + " countries selected" : "Select countries…";
  return p;
}

function getPortFilterParams(includePaging) {
  var p = new URLSearchParams();
  var categories = Array.from(document.querySelectorAll("#port-category-options input:checked"))
    .map(function(input) { return input.value; });
  var focus = document.getElementById("dry-bulk-focus");
  if (focus && focus.checked && categories.indexOf("dry_bulk") < 0) categories.push("dry_bulk");
  if (categories.length) p.set("categories", categories.join(","));
  var country = document.getElementById("port-country-filter");
  var search = document.getElementById("port-filter-search");
  if (country && country.value) p.set("countries", country.value);
  if (search && search.value.trim()) p.set("q", search.value.trim());
  [
    ["port-min-channel", "min_channel_m"],
    ["port-min-cargo", "min_cargo_m"],
    ["port-min-anchorage", "min_anchorage_m"]
  ].forEach(function(pair) {
    var input = document.getElementById(pair[0]);
    if (input && input.value !== "") p.set(pair[1], input.value);
  });
  if (includePaging !== false) {
    p.set("limit", state.limit);
    p.set("offset", state.offset);
  }
  return p;
}

async function loadData() {
  var cp = document.getElementById("dd-country-panel");
  if (cp && !cp.children.length) await loadCountries();
  await Promise.all([loadKPIs(), loadTable(), loadMap()]);
}

async function loadKPIs() {
  var strip = document.getElementById("kpi-strip");
  if (!strip) return;
  if (state.tracker.indexOf("user_") === 0) {
    strip.innerHTML = '<div class="kpi-card"><div class="label">User</div><div class="value">' + state.tracker + "</div></div>";
    return;
  }
  try {
    if (state.tracker === "world_ports") {
      var params = getPortFilterParams(false);
      params.set("limit", "1");
      var portJson = await (await fetch("/api/ports?" + params)).json();
      var summary = portJson.summary || state.portSummary || {};
      var matched = Number(portJson.total || 0);
      var total = Number(summary.total || 0);
      var dry = Number(summary.dry_bulk || 0);
      var channel = Number(summary.with_channel_depth || 0);
      updatePortCoverageNote(matched);
      strip.innerHTML =
        '<div class="kpi-card"><div class="label">Ports shown</div><div class="value">' +
        matched.toLocaleString() + '</div><div class="sub">of ' + total.toLocaleString() + " mapped ports</div></div>" +
        '<div class="kpi-card"><div class="label">Dry-bulk / coal</div><div class="value">' +
        dry.toLocaleString() + '</div><div class="sub">source-backed classification</div></div>' +
        '<div class="kpi-card"><div class="label">Channel depth</div><div class="value">' +
        (total ? Math.round(channel / total * 100) : 0) + '%</div><div class="sub">' +
        channel.toLocaleString() + " ports with data</div></div>";
      return;
    }
    var k = await (await fetch("/api/kpis/" + state.tracker)).json();
    var isTerm = state.tracker === "coal_terminals";
    var unit = isTerm ? "Mt" : "GW";
    var opVal = isTerm ? Math.round(k.operating_mw).toLocaleString() : (k.operating_mw / 1000).toFixed(1);
    strip.innerHTML =
      '<div class="kpi-card"><div class="label">Operating</div><div class="value">' + opVal +
      " <small>" + unit + "</small></div></div>" +
      '<div class="kpi-card"><div class="label">Total Units</div><div class="value">' +
      Number(k.total_units).toLocaleString() + "</div></div>";
  } catch (e) { console.error("kpis", e); }
}

async function loadTable() {
  try {
    var url = state.tracker === "world_ports"
      ? "/api/ports?" + getPortFilterParams()
      : "/api/data/" + state.tracker + "?" + getFilterParams();
    var json = await (await fetch(url)).json();
    state.total = json.total;
    var thead = document.querySelector("#data-table thead");
    var tbody = document.querySelector("#data-table tbody");
    if (!json.data || !json.data.length) {
      thead.innerHTML = "";
      tbody.innerHTML = "<tr><td>No rows</td></tr>";
      return;
    }
    var cols = state.tracker === "world_ports"
      ? ["name", "country", "unlocode", "categories", "channel_depth", "cargo_depth", "anchorage_depth", "max_vessel"]
      : Object.keys(json.data[0]).slice(0, 8);
    thead.innerHTML = "<tr>" + cols.map(function(c) { return "<th>" + c + "</th>"; }).join("") + "</tr>";
    tbody.innerHTML = json.data.map(function(row) {
      return '<tr' + (state.tracker === "world_ports" ? ' class="clickable-row" data-port-id="' + escAttr(row.id) + '"' : "") + ">" +
        cols.map(function(c) {
        var value = row[c];
        if (Array.isArray(value)) value = value.map(categoryLabel).join(", ");
        return "<td>" + esc(value != null && value !== "" ? value : "—") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    if (state.tracker === "world_ports") {
      tbody.querySelectorAll("[data-port-id]").forEach(function(row) {
        row.onclick = function() { openPortDetail(row.dataset.portId); };
      });
    }
    var info = document.getElementById("table-info");
    if (info) info.textContent = json.data.length + " of " + json.total.toLocaleString();
  } catch (e) { console.error("table", e); }
}

function categoryLabel(key) {
  return PORT_CATEGORIES[key] ? PORT_CATEGORIES[key].label : String(key || "").replace(/_/g, " ");
}

function escAttr(value) {
  return esc(value == null ? "" : value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
