async function loadMap() {
  if (state.markers) state.markers.clearLayers();
  try {
    var params = new URLSearchParams({ limit: "5000" });
    var res = await fetch("/api/map/" + state.tracker + "?" + params);
    if (!res.ok) throw new Error("map " + res.status);
    var points = await res.json();
    if (!Array.isArray(points)) {
      console.error("map not array", points);
      return;
    }
    var lvl = (state.congestionLevel || "").toLowerCase();
    var n = 0;
    points.forEach(function(p) {
      if (p.lat == null || p.lon == null) return;
      if (state.tracker === "world_ports") {
        if (state.congestionOnly && !p.congestion_level) return;
        if (lvl && (p.congestion_level || "").toLowerCase() !== lvl) return;
      }
      var color = state.tracker === "world_ports"
        ? (p.congestion_color || "#22d3ee")
        : (STATUS_COLORS[(p.status || "").toLowerCase()] || "#22d3ee");
      var m = L.circleMarker([p.lat, p.lon], {
        radius: 5, fillColor: color, color: "#0f172a", weight: 1, fillOpacity: 0.9
      });
      m.bindTooltip(p.name || "Port", { direction: "top", className: "port-tip" });
      m.on("click", function() { showPortDetail(p); });
      state.markers.addLayer(m);
      n++;
    });
    console.log("markers drawn", n, "of", points.length);
  } catch (e) { console.error("loadMap", e); }
}

function showPortDetail(p) {
  var box = document.getElementById("map-detail");
  var body = document.getElementById("map-detail-body");
  if (!box || !body) return;
  body.innerHTML = portPopupHtml(p);
  box.classList.remove("hidden");
}

window.usePort = function(name, lat, lon) {
  setPage("route");
  var fromEmpty = !document.getElementById("route-from-lat").value;
  var side = fromEmpty ? "from" : "to";
  document.getElementById("port-" + side + "-search").value = name;
  document.getElementById("route-" + side + "-lat").value = lat;
  document.getElementById("route-" + side + "-lon").value = lon;
  document.getElementById("port-" + side + "-label").textContent =
    name + " (" + Number(lat).toFixed(2) + ", " + Number(lon).toFixed(2) + ")";
};

async function loadCongestion() {
  try {
    var data = await (await fetch("/api/congestion")).json();
    state.congestion = data;
    var list = document.getElementById("cong-top-list");
    var leg = document.getElementById("cong-legend");
    var disc = document.getElementById("cong-disclaimer");
    if (disc) disc.textContent = data.disclaimer || "";
    if (leg) {
      leg.innerHTML = ["severe", "high", "medium", "low"].map(function(l) {
        return '<span><i style="background:' + CONG_COLORS[l] + '"></i> ' + l + "</span>";
      }).join("");
    }
    if (list) {
      list.innerHTML = (data.ports || []).slice(0, 12).map(function(p) {
        var col = CONG_COLORS[(p.congestion_level || "").toLowerCase()] || "#64748b";
        return '<div class="cong-top-item" data-lat="' + p.lat + '" data-lon="' + p.lon + '">' +
          '<span class="cong-badge" style="background:' + col + '">' +
          String(p.congestion_level || "").toUpperCase() + '</span>' +
          '<span class="name">' + p.name + "</span></div>";
      }).join("");
      list.querySelectorAll(".cong-top-item").forEach(function(el) {
        el.onclick = function() {
          var lat = +el.dataset.lat, lon = +el.dataset.lon;
          if (state.map) state.map.setView([lat, lon], 8);
        };
      });
    }
  } catch (e) { console.warn("congestion endpoint not available", e); }
}

async function calcRoute() {
  var fla = +document.getElementById("route-from-lat").value;
  var flo = +document.getElementById("route-from-lon").value;
  var tla = +document.getElementById("route-to-lat").value;
  var tlo = +document.getElementById("route-to-lon").value;
  var resultEl = document.getElementById("route-result");
  if (!fla || !flo || !tla || !tlo) {
    resultEl.textContent = "Select two ports";
    return;
  }
  resultEl.textContent = "Calculating…";
  try {
    var res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_lat: fla, from_lon: flo, to_lat: tla, to_lon: tlo,
        from_name: document.getElementById("port-from-search").value,
        to_name: document.getElementById("port-to-search").value,
        speed_knots: +document.getElementById("route-speed").value || 12,
        consumption_tpd: +document.getElementById("route-consumption").value || 30
      })
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.detail || "route failed");
    state.routeLayer.clearLayers();
    if (j.coordinates && j.coordinates.length) {
      var ll = j.coordinates.map(function(c) { return [c[1], c[0]]; });
      L.polyline(ll, { color: "#22d3ee", weight: 3 }).addTo(state.routeLayer);
      state.map.fitBounds(L.latLngBounds(ll).pad(0.15));
    }
    resultEl.innerHTML = "<strong>" + j.distance_nm + " nm · " +
      (j.duration_days || 0).toFixed(2) + " d</strong><br/>" +
      (j.via ? "Via: " + j.via + "<br/>" : "");
  } catch (e) {
    resultEl.textContent = "Error: " + e.message;
  }
}

function bindUI() {
  document.querySelectorAll(".rail-item[data-page]").forEach(function(b) {
    b.onclick = function() { setPage(b.dataset.page); };
  });
  document.querySelectorAll(".chip-btn[data-view]").forEach(function(b) {
    b.onclick = function() {
      document.querySelectorAll(".chip-btn[data-view]").forEach(function(x) { x.classList.remove("active"); });
      b.classList.add("active");
      switchView(b.dataset.view);
    };
  });
  var closeBtn = document.getElementById("btn-close-detail");
  if (closeBtn) closeBtn.onclick = function() {
    document.getElementById("map-detail").classList.add("hidden");
  };
  var btnRoute = document.getElementById("btn-route");
  if (btnRoute) btnRoute.onclick = calcRoute;
  var btnUpload = document.getElementById("btn-upload");
  if (btnUpload) btnUpload.onclick = function() {
    document.getElementById("upload-modal").classList.remove("hidden");
  };
  var btnCancel = document.getElementById("btn-cancel-upload");
  if (btnCancel) btnCancel.onclick = function() {
    document.getElementById("upload-modal").classList.add("hidden");
  };
  var btnExport = document.getElementById("btn-export");
  if (btnExport) btnExport.onclick = function() {
    window.open("/api/export/" + state.tracker, "_blank");
  };
  var congSel = document.getElementById("filter-congestion");
  if (congSel) congSel.onchange = function() {
    state.congestionLevel = congSel.value;
    if (state.tracker === "world_ports") loadMap();
  };
  var congOnly = document.getElementById("toggle-cong-only");
  if (congOnly) congOnly.onchange = function() {
    state.congestionOnly = congOnly.checked;
    if (state.tracker === "world_ports") loadMap();
  };
  var gs = document.getElementById("port-search-global");
  if (gs) gs.addEventListener("keydown", function(e) {
    if (e.key !== "Enter") return;
    var q = gs.value.trim().toLowerCase();
    var hit = state.ports.find(function(x) { return (x.name || "").toLowerCase().includes(q); });
    if (hit && state.map) {
      state.map.setView([hit.lat, hit.lon], 8);
      showPortDetail(hit);
    }
  });
  var btnApply = document.getElementById("btn-apply");
  if (btnApply) btnApply.onclick = function() { state.offset = 0; loadData(); };
  var btnSend = document.getElementById("btn-send");
  if (btnSend) btnSend.onclick = sendChat;
}

function switchView(name) {
  state._view = name;
  document.querySelectorAll(".view").forEach(function(v) { v.classList.remove("active"); });
  var el = document.getElementById("view-" + name);
  if (el) el.classList.add("active");
  if (name === "map" && state.map) setTimeout(function() { state.map.invalidateSize(); }, 100);
}

async function sendChat() {
  var input = document.getElementById("chat-input");
  var msg = input.value.trim();
  if (!msg) return;
  var box = document.getElementById("chat-messages");
  box.innerHTML += '<div class="msg user">' + msg.replace(/</g, "&lt;") + "</div>";
  input.value = "";
  var th = document.createElement("div");
  th.className = "msg assistant";
  th.textContent = "Thinking…";
  box.appendChild(th);
  try {
    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    var json = await res.json();
    th.textContent = json.reply || "No reply";
  } catch (e) {
    th.textContent = "Error: " + e.message;
  }
}
