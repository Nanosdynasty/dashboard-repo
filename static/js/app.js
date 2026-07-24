/* Global Energy Transition Dashboard */
const state = { tracker: "coal_plants", offset: 0, limit: 100, total: 0, map: null, markers: null };

const STATUS_COLORS = {
  operating: "#65BD8B", construction: "#FE4F2D", announced: "#4A57A8",
  "pre-permit": "#4A57A8", permitted: "#4A57A8", shelved: "#7F142A",
  cancelled: "#7F142A", mothballed: "#8a9aa3", retired: "#8a9aa3", proposed: "#4A57A8"
};

document.addEventListener("DOMContentLoaded", () => {
  initMap(); loadTrackers(); bindUI(); switchView("map"); loadData();
});

function initMap() {
  state.map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OSM &copy; CARTO", maxZoom: 18
  }).addTo(state.map);
  state.markers = L.layerGroup().addTo(state.map);
}

async function loadTrackers() {
  const list = await (await fetch("/api/trackers")).json();
  const el = document.getElementById("tracker-list");
  el.innerHTML = "";
  list.forEach((t) => {
    const div = document.createElement("div");
    div.className = "tracker-item" + (t.id === state.tracker ? " active" : "");
    div.dataset.id = t.id;
    let meta = "";
    if (t.id === "coal_terminals") {
      meta = (t.rows ? t.rows.toLocaleString() + " terminals" : "");
      if (t.operating_capacity_mw) meta += " · " + Math.round(t.operating_capacity_mw).toLocaleString() + " Mt op";
    } else if (t.id === "world_ports") {
      meta = (t.rows ? t.rows.toLocaleString() + " ports" : "");
      if (t.countries) meta += " · " + t.countries + " countries";
    } else {
      meta = (t.rows ? t.rows.toLocaleString() + " units" : "");
      if (t.operating_capacity_mw) meta += " · " + (t.operating_capacity_mw / 1000).toFixed(0) + " GW op";
    }
    div.innerHTML = `<span class="icon">${t.icon || "📊"}</span><div><div>${t.label}</div><div class="meta">${meta}</div></div>`;
    div.onclick = () => {
      state.tracker = t.id; state.offset = 0;
      document.querySelectorAll(".tracker-item").forEach((x) => x.classList.remove("active"));
      div.classList.add("active");
      loadData();
    };
    el.appendChild(div);
  });
}

function getFilterParams() {
  const statusSel = document.getElementById("filter-status");
  const statuses = Array.from(statusSel.selectedOptions).map((o) => o.value);
  const params = new URLSearchParams();
  if (statuses.length) params.set("status", statuses.join(","));
  const country = document.getElementById("filter-country").value.trim();
  if (country) params.set("country", country);
  const min = document.getElementById("filter-min-mw").value;
  const max = document.getElementById("filter-max-mw").value;
  if (min) params.set("min_mw", min);
  if (max) params.set("max_mw", max);
  const search = document.getElementById("filter-search").value.trim();
  if (search) params.set("search", search);
  params.set("limit", state.limit);
  params.set("offset", state.offset);
  return params;
}

async function loadData() {
  await Promise.all([loadKPIs(), loadTable(), loadMap()]);
}

async function loadKPIs() {
  if (state.tracker.startsWith("user_")) {
    document.getElementById("kpi-strip").innerHTML = `<div class="kpi-card"><div class="label">User dataset</div><div class="value">${state.tracker}</div></div>`;
    return;
  }
  try {
    const k = await (await fetch(`/api/kpis/${state.tracker}`)).json();
    const isTerm = state.tracker === "coal_terminals";
    const isPorts = state.tracker === "world_ports";
    const unit = isTerm ? "Mt" : (isPorts ? "" : "GW");
    const opVal = isPorts ? Number(k.operating_units).toLocaleString()
      : (isTerm ? Math.round(k.operating_mw).toLocaleString() : (k.operating_mw / 1000).toFixed(1));
    const totVal = isPorts ? Number(k.total_units).toLocaleString()
      : (isTerm ? Math.round(k.total_mw).toLocaleString() : (k.total_mw / 1000).toFixed(1));
    document.getElementById("kpi-strip").innerHTML = `
      <div class="kpi-card"><div class="label">${isPorts ? "Operating Ports" : "Operating Capacity"}</div>
        <div class="value">${opVal} ${unit ? "<small>"+unit+"</small>" : ""}</div>
        <div class="sub">${isPorts ? (k.countries + " countries") : (Number(k.operating_units).toLocaleString() + " units")}</div></div>
      <div class="kpi-card"><div class="label">Total Units</div>
        <div class="value">${Number(k.total_units).toLocaleString()}</div>
        <div class="sub">${k.countries} countries</div></div>
      <div class="kpi-card"><div class="label">${isPorts ? "Total Ports" : "Total Capacity"}</div>
        <div class="value">${totVal} ${unit && !isPorts ? "<small>"+unit+"</small>" : ""}</div></div>
      <div class="kpi-card"><div class="label">Top Status</div>
        <div class="value" style="font-size:1.1rem">${(k.by_status && k.by_status[0]) ? k.by_status[0].Status : "—"}</div>
        <div class="sub">${(k.by_status && k.by_status[0]) ? Number(k.by_status[0].cnt).toLocaleString() + " units" : ""}</div></div>`;
  } catch (e) { console.error(e); }
}

async function loadTable() {
  const params = getFilterParams();
  const json = await (await fetch(`/api/data/${state.tracker}?${params}`)).json();
  state.total = json.total;
  const thead = document.querySelector("#data-table thead");
  const tbody = document.querySelector("#data-table tbody");
  if (!json.data.length) {
    thead.innerHTML = ""; tbody.innerHTML = `<tr><td colspan="8">No rows match filters</td></tr>`;
    document.getElementById("table-info").textContent = "0 rows";
    return;
  }
  const preferred = ["Plant name", "Unit name", "Country/Area", "Status", "Capacity (MW)", "Start year", "Owner", "Region", "Latitude", "Longitude"];
  let cols = preferred.filter((c) => c in json.data[0]);
  if (cols.length < 4) cols = Object.keys(json.data[0]).slice(0, 8);
  thead.innerHTML = "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
  tbody.innerHTML = json.data.map((row) => "<tr>" + cols.map((c) => {
    let v = row[c];
    if (c === "Status" && v) {
      const cls = "chip-" + String(v).toLowerCase().replace(/\s+/g, "-");
      return `<td><span class="chip ${cls}">${v}</span></td>`;
    }
    if (c === "Capacity (MW)" && v != null) return `<td>${Number(v).toLocaleString()}</td>`;
    return `<td>${v ?? ""}</td>`;
  }).join("") + "</tr>").join("");
  document.getElementById("table-info").textContent =
    `Showing ${state.offset + 1}–${state.offset + json.data.length} of ${json.total.toLocaleString()}`;
}

async function loadMap() {
  state.markers.clearLayers();
  const params = getFilterParams();
  params.set("limit", 5000);
  params.delete("offset");
  try {
    const points = await (await fetch(`/api/map/${state.tracker}?${params}`)).json();
    points.forEach((p) => {
      if (p.lat == null || p.lon == null) return;
      const color = STATUS_COLORS[(p.status || "").toLowerCase()] || "#016B83";
      const radius = Math.max(4, Math.min(12, Math.sqrt(p.capacity || 10) / 3));
      const m = L.circleMarker([p.lat, p.lon], {
        radius, fillColor: color, color: "#fff", weight: 1, opacity: 0.9, fillOpacity: 0.75
      });
      const capLabel = state.tracker === "coal_terminals" ? " Mt" :
        (state.tracker === "world_ports" ? "" : " MW");
      m.bindPopup(`<strong>${p.name || "—"}</strong>${p.unit ? " · " + p.unit : ""}<br/>
        ${p.country || ""} · <em>${p.status || ""}</em><br/>
        ${p.capacity != null && state.tracker !== "world_ports" ? ("Capacity: " + Number(p.capacity).toLocaleString() + capLabel) : ""}`);
      state.markers.addLayer(m);
    });
  } catch (e) { console.error("Map load error", e); }
}

function bindUI() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      switchView(tab.dataset.view);
    };
  });
  document.getElementById("btn-apply").onclick = () => { state.offset = 0; loadData(); };
  document.getElementById("btn-reset").onclick = () => {
    document.getElementById("filter-status").selectedIndex = -1;
    document.getElementById("filter-country").value = "";
    document.getElementById("filter-min-mw").value = "";
    document.getElementById("filter-max-mw").value = "";
    document.getElementById("filter-search").value = "";
    state.offset = 0; loadData();
  };
  document.getElementById("btn-prev").onclick = () => {
    state.offset = Math.max(0, state.offset - state.limit); loadTable();
  };
  document.getElementById("btn-next").onclick = () => {
    if (state.offset + state.limit < state.total) { state.offset += state.limit; loadTable(); }
  };
  document.getElementById("btn-upload").onclick = () => document.getElementById("upload-modal").classList.remove("hidden");
  document.getElementById("btn-cancel-upload").onclick = () => document.getElementById("upload-modal").classList.add("hidden");
  document.getElementById("btn-do-upload").onclick = doUpload;
  document.getElementById("btn-export").onclick = () => {
    window.open(`/api/export/${state.tracker}?${getFilterParams()}`, "_blank");
  };
  document.getElementById("use-local-llm").onchange = (e) => {
    document.getElementById("local-llm-url").style.display = e.target.checked ? "block" : "none";
  };
  document.getElementById("btn-send").onclick = sendChat;
  document.getElementById("chat-input").onkeydown = (e) => { if (e.key === "Enter") sendChat(); };
}

function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  if (name === "map" && state.map) setTimeout(() => state.map.invalidateSize(), 100);
}

async function doUpload() {
  const input = document.getElementById("file-input");
  if (!input.files.length) { document.getElementById("upload-status").textContent = "Choose a file first"; return; }
  const fd = new FormData(); fd.append("file", input.files[0]);
  document.getElementById("upload-status").textContent = "Uploading…";
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || "Upload failed");
    document.getElementById("upload-status").textContent = `✓ ${json.message} (${json.rows} rows)`;
    await loadTrackers();
    setTimeout(() => {
      document.getElementById("upload-modal").classList.add("hidden");
      document.getElementById("upload-status").textContent = ""; input.value = "";
    }, 1500);
  } catch (e) { document.getElementById("upload-status").textContent = "Error: " + e.message; }
}

async function sendChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;
  const box = document.getElementById("chat-messages");
  box.innerHTML += `<div class="msg user">${escapeHtml(msg)}</div>`;
  input.value = ""; box.scrollTop = box.scrollHeight;
  const thinking = document.createElement("div");
  thinking.className = "msg assistant"; thinking.textContent = "Thinking…";
  box.appendChild(thinking);
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        use_local_llm: document.getElementById("use-local-llm").checked,
        local_llm_url: document.getElementById("local-llm-url").value.trim() || null
      })
    });
    const json = await res.json();
    thinking.innerHTML = formatReply(json.reply || "No reply");
  } catch (e) { thinking.textContent = "Error: " + e.message; }
  box.scrollTop = box.scrollHeight;
}

function formatReply(text) {
  return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}
function escapeHtml(s) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
