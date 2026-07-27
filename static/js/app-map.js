async function loadMap() {
  if (state.markers) state.markers.clearLayers();
  var params = getFilterParams();
  params.set("limit", "5000");
  params.delete("offset");
  if (state.tracker === "world_ports") {
    params.delete("status");
    params.delete("min_mw");
    params.delete("max_mw");
  }
  try {
    var res = await fetch("/api/map/" + state.tracker + "?" + params);
    if (!res.ok) throw new Error("map " + res.status);
    var points = await res.json();
    if (!Array.isArray(points)) {
      console.error("map not array", points);
      return;
    }
    var n = 0;
    points.forEach(function(p) {
      if (p.lat == null || p.lon == null) return;
      var color = state.tracker === "world_ports"
        ? PORT_COLOR
        : (STATUS_COLORS[(p.status || "").toLowerCase()] || "#016B83");
      var m = L.circleMarker([p.lat, p.lon], {
        radius: state.tracker === "world_ports" ? 5 : Math.max(4, Math.min(12, Math.sqrt(p.capacity || 10) / 3)),
        fillColor: color, color: "#fff", weight: 1.2, fillOpacity: 0.85
      });
      var title = p.name || "—";
      m.bindPopup("<strong>" + title + "</strong><br/>" + (p.country || "") +
        (p.status ? " · " + p.status : "") +
        '<br/><button type="button" onclick="usePort(\'' +
        String(title).replace(/'/g, "") + "'," + p.lat + "," + p.lon +
        ')">Use in distance calc</button>');
      state.markers.addLayer(m);
      n++;
    });
    console.log("markers drawn", n, "of", points.length, "tracker", state.tracker);
  } catch (e) { console.error("loadMap", e); }
}

window.usePort = function(name, lat, lon) {
  document.getElementById("group-vessels").classList.add("open");
  document.getElementById("group-energy").classList.remove("open");
  var fromEmpty = !document.getElementById("route-from-lat").value;
  var side = fromEmpty ? "from" : "to";
  document.getElementById("port-" + side + "-search").value = name;
  document.getElementById("route-" + side + "-lat").value = lat;
  document.getElementById("route-" + side + "-lon").value = lon;
  document.getElementById("port-" + side + "-label").textContent =
    name + " (" + Number(lat).toFixed(2) + ", " + Number(lon).toFixed(2) + ")";
  if (!fromEmpty) calcRoute();
};

async function calcRoute() {
  var fla = +document.getElementById("route-from-lat").value;
  var flo = +document.getElementById("route-from-lon").value;
  var tla = +document.getElementById("route-to-lat").value;
  var tlo = +document.getElementById("route-to-lon").value;
  var speed = +document.getElementById("route-speed").value || 12;
  var resultEl = document.getElementById("route-result");
  if ([fla, flo, tla, tlo].some(isNaN) || !fla) {
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
    resultEl.textContent = fromName + " → " + toName + via + " · " +
      Number(nm).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " nm · " +
      speed + " kn · " + Number(days).toFixed(1) + " days";
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
    document.querySelectorAll("#dd-status-panel input, #dd-country-panel input").forEach(function(i) {
      i.checked = false;
    });
    var min = document.getElementById("filter-min-mw");
    var max = document.getElementById("filter-max-mw");
    var se = document.getElementById("filter-search");
    if (min) min.value = "";
    if (max) max.value = "";
    if (se) se.value = "";
    state.offset = 0;
    loadData();
  };
  var bp = document.getElementById("btn-prev");
  if (bp) bp.onclick = function() {
    state.offset = Math.max(0, state.offset - state.limit);
    loadTable();
  };
  var bn = document.getElementById("btn-next");
  if (bn) bn.onclick = function() {
    if (state.offset + state.limit < state.total) {
      state.offset += state.limit;
      loadTable();
    }
  };
  var bu = document.getElementById("btn-upload");
  if (bu) bu.onclick = function() {
    document.getElementById("upload-modal").classList.remove("hidden");
  };
  var bc = document.getElementById("btn-cancel-upload");
  if (bc) bc.onclick = function() {
    document.getElementById("upload-modal").classList.add("hidden");
  };
  var bd = document.getElementById("btn-do-upload");
  if (bd) bd.onclick = doUpload;
  var be = document.getElementById("btn-export");
  if (be) be.onclick = function() {
    window.open("/api/export/" + state.tracker + "?" + getFilterParams(), "_blank");
  };
  var broute = document.getElementById("btn-route");
  if (broute) broute.onclick = calcRoute;
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
