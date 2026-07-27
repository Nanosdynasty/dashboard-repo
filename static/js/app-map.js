async function loadMap() {
  if (state.cluster) state.cluster.clearLayers();
  else if (state.markers) state.markers.clearLayers();
  var url = state.tracker === "world_ports"
    ? "/api/map/world_ports?" + (function() {
        var p = getPortFilterParams(false); p.set("limit", "10000"); return p;
      })()
    : "/api/map/" + state.tracker + "?" + (function() {
        var p = getFilterParams(); p.set("limit","5000"); p.delete("offset"); return p;
      })();
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error("map " + res.status);
    var points = await res.json();
    if (!Array.isArray(points)) { console.error("map not array", points); return; }
    var n = 0, batch = [];
    points.forEach(function(p) {
      if (p.lat == null || p.lon == null) return;
      var lat = +p.lat, lon = +p.lon;
      if (isNaN(lat) || isNaN(lon)) return;
      var color = state.tracker === "world_ports"
        ? portMarkerColor(p.categories)
        : (STATUS_COLORS[String(p.status || "").toLowerCase()] || "#016B83");
      var m = L.circleMarker([lat, lon], {
        radius: state.tracker === "world_ports" ? 5 : Math.max(4, Math.min(12, Math.sqrt(p.capacity || 10) / 3)),
        fillColor: color, color: "#fff", weight: 1, fillOpacity: 0.85
      });
      var title = p.name || "—";
      if (state.tracker === "world_ports") {
        var categories = (p.categories || []).map(categoryLabel).join(" · ") || "Unclassified";
        m.bindTooltip(
          '<div class="port-hover"><div class="meta">' + esc(categories) + "</div>" +
          "<h4>" + esc(title) + "</h4><div class=\"meta\">" + esc(p.country || "Country unknown") +
          (p.unlocode ? " · " + esc(p.unlocode) : "") + "</div>" +
          '<div class="mini-grid"><div><span>Channel</span><strong>' + esc(p.channel_depth || "Unknown") +
          "</strong></div><div><span>Cargo pier</span><strong>" + esc(p.cargo_depth || "Unknown") +
          "</strong></div><div><span>Anchorage</span><strong>" + esc(p.anchorage_depth || "Unknown") +
          "</strong></div><div><span>Max vessel</span><strong>" + esc(p.max_vessel || "Unknown") + "</strong></div></div>" +
          '<small>Click for specifications and source details</small></div>',
          { sticky: true, direction: "top", opacity: 1, className: "port-hover-card" }
        );
        m.on("click", function() { openPortDetail(p.id); });
      } else {
        m.bindPopup("<strong>" + esc(title) + "</strong><br/>" + esc(p.country || "") +
          (p.status ? " · " + esc(p.status) : ""));
      }
      if (state.cluster) batch.push(m); else state.markers.addLayer(m);
      n++;
    });
    if (state.cluster && batch.length) state.cluster.addLayers(batch);
    var mapStatus = document.getElementById("map-status");
    if (mapStatus) mapStatus.textContent = n.toLocaleString() +
      (state.tracker === "world_ports" ? " ports mapped" : " assets mapped");
  } catch (e) { console.error("loadMap", e); }
}

function portMarkerColor(categories) {
  var cats = categories || [];
  var priority = ["coal", "dry_bulk", "oil", "lng", "liquid_bulk", "container", "breakbulk", "roro", "anchorage"];
  var match = priority.find(function(key) { return cats.indexOf(key) >= 0; });
  return match && PORT_CATEGORIES[match] ? PORT_CATEGORIES[match].color : "#738691";
}

window.usePort = function(name, lat, lon, requestedSide) {
  document.getElementById("group-vessels").classList.add("open");
  document.getElementById("group-energy").classList.remove("open");
  var fromEmpty = !document.getElementById("route-from-lat").value;
  var side = requestedSide || (fromEmpty ? "from" : "to");
  document.getElementById("port-" + side + "-search").value = name;
  document.getElementById("route-" + side + "-lat").value = lat;
  document.getElementById("route-" + side + "-lon").value = lon;
  document.getElementById("port-" + side + "-label").textContent =
    name + " (" + Number(lat).toFixed(2) + ", " + Number(lon).toFixed(2) + ")";
  if (!fromEmpty) calcRoute();
};

async function openPortDetail(portId) {
  var drawer = document.getElementById("port-drawer");
  var content = document.getElementById("port-drawer-content");
  var title = document.getElementById("port-drawer-title");
  if (!drawer || !content || !title) return;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  title.textContent = "Loading port…";
  content.innerHTML = '<div class="drawer-loading">Loading source-backed specifications…</div>';
  try {
    var res = await fetch("/api/ports/" + encodeURIComponent(portId));
    if (!res.ok) throw new Error("Port details unavailable");
    var p = await res.json();
    state.selectedPort = p;
    title.textContent = p.name || "Port";
    var categories = (p.categories || []).map(function(key) {
      var color = PORT_CATEGORIES[key] ? PORT_CATEGORIES[key].color : "#738691";
      return '<span class="port-tag"><i style="background:' + color + '"></i>' + esc(categoryLabel(key)) + "</span>";
    }).join("") || '<span class="port-tag">Unclassified</span>';
    var terminals = (p.coal_terminals || []).map(function(t) {
      return '<article class="terminal-card"><div><strong>' + esc(t.name || "Coal terminal") +
        '</strong><span>' + esc(t.status || "Status unknown") + " · " +
        esc(t.capacity_mtpa != null ? t.capacity_mtpa + " Mtpa" : "Capacity unknown") + "</span></div>" +
        '<small>' + esc(t.match_confidence || "unknown") + " match · " +
        esc(t.distance_km != null ? t.distance_km + " km from port" : "distance unknown") + "</small>" +
        (t.wiki_url ? '<a href="' + escAttr(t.wiki_url) + '" target="_blank" rel="noopener">GEM profile ↗</a>' : "") +
        "</article>";
    }).join("") || '<p class="empty-detail">No matched GEM coal terminal in the guarded search radius.</p>';
    var sources = (p.sources || []).map(function(source) {
      return '<a class="source-link" href="' + escAttr(source.url || "#") +
        '" target="_blank" rel="noopener"><span>' + esc(source.name || "Source") +
        "</span><small>" + esc(source.role || "") + " ↗</small></a>";
    }).join("");
    content.innerHTML =
      '<div class="port-tags">' + categories + "</div>" +
      '<p class="port-location">' + esc(p.country || "Country unknown") +
      (p.unlocode ? " · " + esc(p.unlocode) : "") + " · " +
      Number(p.lat).toFixed(4) + ", " + Number(p.lon).toFixed(4) + "</p>" +
      '<div class="drawer-actions"><button id="detail-use-from" class="btn btn-teal">Set as origin</button>' +
      '<button id="detail-use-to" class="btn btn-ghost">Set as destination</button></div>' +
      '<section class="detail-section"><h3>Navigation envelope</h3><div class="spec-grid">' +
      specItem("Channel depth", p.channel_depth) + specItem("Cargo pier", p.cargo_depth) +
      specItem("Anchorage", p.anchorage_depth) + specItem("Oil terminal", p.oil_depth) +
      specItem("LNG terminal", p.lng_depth) + specItem("Max vessel", p.max_vessel) +
      specItem("Max draft", metric(p.max_vessel_draft_m, "m")) +
      specItem("Tidal range", metric(p.tidal_range_m, "m")) + "</div></section>" +
      '<section class="detail-section"><h3>Port profile</h3><div class="spec-grid">' +
      specItem("Harbor size", p.harbor_size) + specItem("Harbor type", p.harbor_type) +
      specItem("Harbor use", p.harbor_use) + specItem("Shelter", p.shelter) + "</div></section>" +
      '<section class="detail-section"><h3>Facilities</h3><div class="facility-list">' +
      objectFlags(p.facilities) + "</div>" +
      '<div class="data-warning"><strong>Berth count: unknown</strong><span>The current source does not report a defensible berth count. The dashboard will not infer zero.</span></div></section>' +
      '<section class="detail-section"><h3>Matched dry-bulk terminals</h3>' + terminals + "</section>" +
      '<section class="detail-section"><h3>Data quality</h3><div class="quality-row"><span>Core field completeness</span><b>' +
      Number(p.data_completeness_pct || 0) + '%</b></div><div class="quality-bar"><i style="width:' +
      Number(p.data_completeness_pct || 0) + '%"></i></div></section>' +
      '<section class="detail-section"><h3>Sources</h3>' + sources + "</section>";
    document.getElementById("detail-use-from").onclick = function() {
      usePort(p.name, p.lat, p.lon, "from");
    };
    document.getElementById("detail-use-to").onclick = function() {
      usePort(p.name, p.lat, p.lon, "to");
    };
  } catch (e) {
    title.textContent = "Port unavailable";
    content.innerHTML = '<div class="data-warning">' + esc(e.message) + "</div>";
  }
}
window.openPortDetail = openPortDetail;

function closePortDetail() {
  var drawer = document.getElementById("port-drawer");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function specItem(label, value) {
  return "<div><span>" + esc(label) + "</span><b>" + esc(value || "Unknown") + "</b></div>";
}

function metric(value, unit) {
  return value == null ? "Unknown" : Number(value).toLocaleString() + " " + unit;
}

function objectFlags(flags) {
  flags = flags || {};
  var rows = Object.keys(flags).filter(function(key) { return flags[key] === true; });
  if (!rows.length) return '<span class="empty-detail">No affirmative facility flags in source.</span>';
  return rows.map(function(key) {
    return '<span class="facility-chip">✓ ' + esc(key.replace(/_/g, " ")) + "</span>";
  }).join("");
}

async function calcRoute() {
  var fla = +document.getElementById("route-from-lat").value;
  var flo = +document.getElementById("route-from-lon").value;
  var tla = +document.getElementById("route-to-lat").value;
  var tlo = +document.getElementById("route-to-lon").value;
  var speed = +document.getElementById("route-speed").value || 12;
  var resultEl = document.getElementById("route-result");
  if (![fla, flo, tla, tlo].every(Number.isFinite) ||
      Math.abs(fla) > 90 || Math.abs(tla) > 90 || Math.abs(flo) > 180 || Math.abs(tlo) > 180) {
    resultEl.textContent = "Select two ports by name first";
    return;
  }
  var fromName = document.getElementById("port-from-search").value || "Origin";
  var toName = document.getElementById("port-to-search").value || "Destination";
  resultEl.textContent = "Calculating sea route…";
  try {
    var res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_lon: flo, from_lat: fla, to_lon: tlo, to_lat: tla,
        speed_knots: speed, from_name: fromName, to_name: toName
      })
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.detail || "Route failed");
    state.routeLayer.clearLayers();
    if (j.coordinates && j.coordinates.length) {
      var ll = j.coordinates.map(function(c) { return [c[1], c[0]]; });
      L.polyline(ll, { color: "#FE4F2D", weight: 3, opacity: 0.9 }).addTo(state.routeLayer);
      L.circleMarker([fla, flo], { radius: 7, fillColor: "#016B83", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindTooltip(fromName).addTo(state.routeLayer);
      L.circleMarker([tla, tlo], { radius: 7, fillColor: "#FE4F2D", color: "#fff", weight: 2, fillOpacity: 1 })
        .bindTooltip(toName).addTo(state.routeLayer);
      state.map.fitBounds(ll, { padding: [40, 40] });
    }
    var nm = j.distance_nm != null ? j.distance_nm : (j.distance_km / 1.852);
    var days = j.duration_days != null ? j.duration_days : (nm / speed / 24);
    var via = j.via ? (" via " + j.via) : "";
    resultEl.innerHTML = '<div class="route-summary"><span>' + esc(fromName) + " → " + esc(toName) +
      esc(via) + '</span><strong>' +
      Number(nm).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " nm</strong>" +
      '<div><b>' + esc(speed) + " kn</b><b>" + Number(days).toFixed(1) +
      ' days</b></div><small>Analytical estimate only; not for navigation.</small></div>';
  } catch (e) {
    resultEl.textContent = "Error: " + e.message;
  }
}

function parseImoList() {
  var raw = document.getElementById("imo-list").value || "";
  return raw.split(/[\s,;]+/).map(function(s) { return s.trim(); }).filter(function(s) {
    return /^\d{7,9}$/.test(s);
  });
}

function vesselIcon(cog, sog) {
  var rot = (cog != null && cog < 360) ? cog : 0;
  var moving = sog != null && sog > 0.5;
  var color = moving ? "#6B4C9A" : "#3D9B6A";
  return L.divIcon({
    className: "vessel-dash",
    html: '<div style="transform:rotate(' + rot + "deg);width:14px;height:4px;background:" +
      color + ';border-radius:1px;"></div>',
    iconSize: [14, 4], iconAnchor: [7, 2]
  });
}

function clearVessels() {
  state.vesselLayer.clearLayers();
  state.vesselMarkers.clear();
  var box = document.getElementById("vessel-results");
  if (box) box.innerHTML = "";
  document.getElementById("imo-status").textContent = "Cleared — paste IDs and click Find";
}

async function trackVessels() {
  var ids = parseImoList();
  if (!ids.length) {
    document.getElementById("imo-status").textContent = "Paste at least one 7-digit IMO or 9-digit MMSI";
    return;
  }
  document.getElementById("imo-status").textContent = "Searching AIS for " + ids.length + " id(s)…";
  state.vesselLayer.clearLayers();
  state.vesselMarkers.clear();
  try {
    var res = await fetch("/api/vessel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids, timeout_sec: 25 })
    });
    var j = await res.json();
    if (!res.ok) throw new Error(typeof j.detail === "string" ? j.detail : "track failed");
    var vessels = j.vessels || [];
    if (!vessels.length) {
      document.getElementById("imo-status").textContent = "No position in sample window. Prefer 9-digit MMSI.";
      return;
    }
    var bounds = [];
    vessels.forEach(function(v) {
      if (v.lat == null || v.lon == null) return;
      var name = v.name || ("MMSI " + (v.mmsi || "?"));
      var marker = L.marker([v.lat, v.lon], { icon: vesselIcon(v.heading || v.cog, v.sog_kn) });
      marker.bindPopup("<strong>" + name + "</strong><br/>MMSI " + (v.mmsi || "—"));
      state.vesselLayer.addLayer(marker);
      bounds.push([v.lat, v.lon]);
    });
    if (bounds.length) state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    document.getElementById("imo-status").textContent = "Found " + vessels.length + " vessel(s)";
  } catch (e) {
    document.getElementById("imo-status").textContent = "Track error: " + e.message;
  }
}

function bindUI() {
  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.onclick = function() {
      document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
      tab.classList.add("active");
      switchView(tab.dataset.view);
    };
  });
  var ba = document.getElementById("btn-apply");
  if (ba) ba.onclick = function() { state.offset = 0; loadData(); };
  var br = document.getElementById("btn-reset");
  if (br) br.onclick = function() {
    document.querySelectorAll("#dd-status-panel input, #dd-country-panel input").forEach(function(i) { i.checked = false; });
    var min = document.getElementById("filter-min-mw");
    var max = document.getElementById("filter-max-mw");
    var se = document.getElementById("filter-search");
    if (min) min.value = ""; if (max) max.value = ""; if (se) se.value = "";
    state.offset = 0; loadData();
  };
  var bp = document.getElementById("btn-prev");
  if (bp) bp.onclick = function() { state.offset = Math.max(0, state.offset - state.limit); loadTable(); };
  var bn = document.getElementById("btn-next");
  if (bn) bn.onclick = function() {
    if (state.offset + state.limit < state.total) { state.offset += state.limit; loadTable(); }
  };
  var bu = document.getElementById("btn-upload");
  if (bu) bu.onclick = function() { document.getElementById("upload-modal").classList.remove("hidden"); };
  var bc = document.getElementById("btn-cancel-upload");
  if (bc) bc.onclick = function() { document.getElementById("upload-modal").classList.add("hidden"); };
  var bd = document.getElementById("btn-do-upload");
  if (bd) bd.onclick = doUpload;
  var be = document.getElementById("btn-export");
  if (be) be.onclick = function() {
    window.open("/api/export/" + state.tracker + "?" + getFilterParams(), "_blank");
  };
  var broute = document.getElementById("btn-route");
  if (broute) broute.onclick = calcRoute;
  var bswap = document.getElementById("btn-route-swap");
  if (bswap) bswap.onclick = swapRoutePorts;
  var bpa = document.getElementById("btn-port-apply");
  if (bpa) bpa.onclick = function() { state.offset = 0; loadData(); };
  var bpr = document.getElementById("btn-port-reset");
  if (bpr) bpr.onclick = resetPortFilters;
  var portSearch = document.getElementById("port-filter-search");
  if (portSearch) portSearch.onkeydown = function(e) {
    if (e.key === "Enter") { state.offset = 0; loadData(); }
  };
  var closeDrawer = document.getElementById("btn-close-port-drawer");
  if (closeDrawer) closeDrawer.onclick = closePortDetail;
  var bt = document.getElementById("btn-track-imo");
  if (bt) bt.onclick = trackVessels;
  var bcl = document.getElementById("btn-clear-imo");
  if (bcl) bcl.onclick = clearVessels;
  var ul = document.getElementById("use-local-llm");
  if (ul) ul.onchange = function(e) {
    document.getElementById("local-llm-url").style.display = e.target.checked ? "block" : "none";
  };
  var bs = document.getElementById("btn-send");
  if (bs) bs.onclick = sendChat;
  var ci = document.getElementById("chat-input");
  if (ci) ci.onkeydown = function(e) { if (e.key === "Enter") sendChat(); };
}

function resetPortFilters() {
  var focus = document.getElementById("dry-bulk-focus");
  var country = document.getElementById("port-country-filter");
  var search = document.getElementById("port-filter-search");
  if (focus) focus.checked = true;
  if (country) country.value = "";
  if (search) search.value = "";
  document.querySelectorAll("#port-category-options input").forEach(function(input) { input.checked = false; });
  ["port-min-channel", "port-min-cargo", "port-min-anchorage"].forEach(function(id) {
    var input = document.getElementById(id); if (input) input.value = "";
  });
  state.offset = 0;
  loadData();
}

function swapRoutePorts() {
  ["search", "label"].forEach(function(suffix) {
    var from = document.getElementById("port-from-" + suffix);
    var to = document.getElementById("port-to-" + suffix);
    if (!from || !to) return;
    var value = suffix === "search" ? from.value : from.textContent;
    if (suffix === "search") {
      from.value = to.value; to.value = value;
    } else {
      from.textContent = to.textContent; to.textContent = value;
    }
  });
  ["lat", "lon"].forEach(function(axis) {
    var from = document.getElementById("route-from-" + axis);
    var to = document.getElementById("route-to-" + axis);
    var value = from.value; from.value = to.value; to.value = value;
  });
  if (document.getElementById("route-from-lat").value && document.getElementById("route-to-lat").value) calcRoute();
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(function(v) { v.classList.remove("active"); });
  var el = document.getElementById("view-" + name);
  if (el) el.classList.add("active");
  if (name === "map" && state.map) setTimeout(function() { state.map.invalidateSize(); }, 100);
}

async function doUpload() {
  var input = document.getElementById("file-input");
  if (!input.files.length) {
    document.getElementById("upload-status").textContent = "Choose a file";
    return;
  }
  var fd = new FormData();
  fd.append("file", input.files[0]);
  document.getElementById("upload-status").textContent = "Uploading…";
  try {
    var res = await fetch("/api/upload", { method: "POST", body: fd });
    var json = await res.json();
    if (!res.ok) throw new Error(json.detail || "fail");
    document.getElementById("upload-status").textContent = "OK " + json.message;
    await loadTrackers();
  } catch (e) {
    document.getElementById("upload-status").textContent = "Error: " + e.message;
  }
}

async function sendChat() {
  var input = document.getElementById("chat-input");
  var msg = input.value.trim();
  if (!msg) return;
  var box = document.getElementById("chat-messages");
  box.innerHTML += '<div class="msg user">' + esc(msg) + "</div>";
  input.value = "";
  var th = document.createElement("div");
  th.className = "msg assistant";
  th.textContent = "Thinking…";
  box.appendChild(th);
  try {
    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        use_local_llm: document.getElementById("use-local-llm").checked,
        local_llm_url: document.getElementById("local-llm-url").value.trim() || null
      })
    });
    var json = await res.json();
    th.textContent = json.reply || "No reply";
  } catch (e) {
    th.textContent = "Error: " + e.message;
  }
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
