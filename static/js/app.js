const LAYER_CONFIG = {
  coal_plants: { label: "Coal plant", color: "#6f7782", radius: 3, mode: "energy" },
  solar: { label: "Solar power", color: "#e9a823", radius: 2, mode: "energy" },
  wind: { label: "Wind power", color: "#55a6c8", radius: 2, mode: "energy" },
  hydro: { label: "Hydropower", color: "#296fba", radius: 3, mode: "energy" },
  nuclear: { label: "Nuclear power", color: "#8b65b6", radius: 4, mode: "energy" },
  geothermal: { label: "Geothermal", color: "#db5b45", radius: 3, mode: "energy" },
  bioenergy: { label: "Bioenergy", color: "#629c4d", radius: 2, mode: "energy" },
  coal_mines: { label: "Coal mine", color: "#242b38", radius: 3, mode: "commodities" },
  coal_trade_terminals: { label: "Coal trade terminal", color: "#db2f34", radius: 3, mode: "commodities" },
  iron_ore_mines: { label: "Iron ore mine", color: "#a45332", radius: 3, mode: "commodities" },
  iron_ore_terminals: { label: "Iron ore trade terminal", color: "#d67a27", radius: 4.5, mode: "commodities" },
  steel_plants: { label: "Iron & steel plant", color: "#536a7a", radius: 3, mode: "commodities" },
  cement_plants: { label: "Cement plant", color: "#9a8a73", radius: 3, mode: "commodities" }
};

const WORKSPACE_LAYERS = {
  energy: ["coal_plants", "solar", "wind", "hydro", "nuclear", "geothermal", "bioenergy"],
  commodities: ["coal_mines", "coal_trade_terminals", "iron_ore_mines", "iron_ore_terminals", "steel_plants", "cement_plants"]
};

const COAL_ASSET_CONFIG = {
  coal_mines: { label: "Coal mine", color: "#242b38", radius: 3 },
  coal_trade_terminals: { label: "Coal trade terminal", color: "#db2f34", radius: 4 },
  dry_bulk_ports: { label: "Dry-bulk port", color: "#003671", radius: 3 },
  power_consumers: { label: "Coal-fired power plant", color: "#6f7782", radius: 3 },
  steel_consumers: { label: "Steel plant", color: "#536a7a", radius: 3 },
  cement_consumers: { label: "Cement plant", color: "#9a8a73", radius: 3 }
};

const ENGLISH_MAP_LABELS = {
  continents: [
    ["North America", 47, -105],
    ["South America", -18, -59],
    ["Europe", 52, 16],
    ["Africa", 7, 20],
    ["Asia", 43, 88],
    ["Oceania", -24, 135]
  ],
  countries: [
    ["India", 22, 79], ["China", 36, 104], ["Australia", -25, 134],
    ["Indonesia", -3, 118], ["South Africa", -29, 24], ["Brazil", -11, -52],
    ["United States", 39, -99], ["Canada", 58, -107], ["Russia", 61, 94],
    ["Japan", 37, 138], ["South Korea", 36, 128], ["Vietnam", 16, 107],
    ["Bangladesh", 24, 90], ["Pakistan", 30, 69], ["Türkiye", 39, 35],
    ["United Kingdom", 55, -3], ["Germany", 51, 10], ["France", 47, 2],
    ["Spain", 40, -4], ["Italy", 42, 12], ["Egypt", 27, 30],
    ["Saudi Arabia", 24, 45], ["United Arab Emirates", 24, 54],
    ["Colombia", 4, -73], ["Chile", -30, -71], ["Argentina", -38, -64]
  ]
};

const COUNTRY_LABEL_WIDTHS = {
  India: 70, China: 96, Australia: 105, Indonesia: 100,
  "South Africa": 82, Brazil: 95, "United States": 112, Canada: 120,
  Russia: 130, Japan: 48, "South Korea": 48, Vietnam: 45,
  Bangladesh: 45, Pakistan: 62, Türkiye: 60, "United Kingdom": 54,
  Germany: 48, France: 48, Spain: 48, Italy: 38, Egypt: 48,
  "Saudi Arabia": 76, "United Arab Emirates": 55, Colombia: 58,
  Chile: 36, Argentina: 70
};

const MAP_SKINS = {
  light: () => L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, attribution: "Tiles &copy; Esri" }
  ),
  nautical: () => L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Ocean basemap &copy; Esri, GEBCO, NOAA"
    }),
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      maxZoom: 18,
      opacity: 0.92,
      attribution: "Navigation aids &copy; OpenSeaMap contributors"
    }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "English reference labels &copy; Esri"
    })
  ]),
  satellite: () => L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 18, attribution: "Imagery &copy; Esri" }
  ),
  dark: () => L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }
  )
};

const DEFAULT_MAP_CENTER = [23, 90];
const DEFAULT_MAP_ZOOM = 3;
const DEFAULT_AIS_REGIONS = ["india", "china", "gulf", "southeast_asia"];
const AIS_REGION_BOUNDS = {
  india: [[5, 64], [31, 100]],
  china: [[17, 105], [42, 125]],
  gulf: [[12, 42], [31.5, 62.5]],
  southeast_asia: [[-12, 94], [22, 132]],
  japan_korea: [[30, 124], [47, 147]],
  australia: [[-47, 108], [-8, 158]],
  europe_med: [[28, -12], [72, 45]],
  africa: [[-38, -20], [38, 58]],
  north_america: [[5, -170], [72, -50]],
  south_america: [[-58, -92], [15, -30]],
  world: [[-90, -180], [90, 180]]
};

const state = {
  map: null,
  baseLayer: null,
  mapSkin: "light",
  mode: "ports",
  portLayer: null,
  assetLayers: new Map(),
  assetCache: new Map(),
  layerEpoch: new Map(),
  ports: [],
  filteredPorts: [],
  routeLayer: null,
  routeMode: false,
  routePickIndex: 0,
  routePorts: [],
  routePortCatalog: [],
  coalLayer: null,
  aisLayer: null,
  aisTrailLayer: null,
  aisVessels: [],
  aisEnabled: false,
  aisLoading: false,
  aisRefreshTimer: null,
  aisDisplayMode: "all",
  aisTypeFilter: "cargo_tanker",
  aisRegions: new Set(DEFAULT_AIS_REGIONS),
  aisWatchlist: new Map(),
  selectedAisMmsi: null,
  weatherLayer: null,
  weatherSymbolLayer: null,
  coastalWeatherEnabled: false,
  coastalWeatherRows: [],
  coastalWeatherDay: 1,
  coastalWeatherAnimated: true,
  coastalWeatherParameters: new Set(["rain", "wind", "wave"]),
  coastalWeatherLoading: false,
  coalAssets: [],
  coalSummary: null,
  coalAnalysis: null,
  coalResearch: null,
  coalAnalysisView: "overview",
  coalDashboardTab: "overview",
  coalView: "analytics",
  nppLoaded: false,
  nppRefreshTimer: null,
  continentLabels: null,
  countryLabels: null,
  renderedPortCount: 0,
  filters: {
    energy: { country: "", status: "operating" },
    commodities: { country: "", status: "operating" }
  }
};
let routeRecalculationTimer = null;

function workspaceInput(mode, id) {
  return document.querySelector(
    `details[data-mode="${mode}"] input[value="${id}"]`
  );
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.map = L.map("map", {
    preferCanvas: true,
    worldCopyJump: true,
    zoomControl: true,
    minZoom: 2
  }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  setMapSkin("light");
  addEnglishMapLabels();
  state.portLayer = L.layerGroup().addTo(state.map);
  state.coalLayer = L.layerGroup().addTo(state.map);
  state.aisLayer = L.layerGroup().addTo(state.map);
  state.aisTrailLayer = L.layerGroup().addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  state.weatherLayer = L.layerGroup();
  state.weatherSymbolLayer = L.layerGroup();
  state.map.on("zoomend", renderPorts);
  loadAisPreferences();
  bindControls();
  await Promise.all([
    loadPortFacets(),
    loadWorkspaceFacets(),
    loadCoalWorkspace()
  ]);
  await loadPorts();
  activateMode("ports");
}

function bindControls() {
  document.querySelectorAll(".filter-section[data-mode]").forEach(section => {
    section.addEventListener("toggle", () => {
      if (section.open) activateMode(section.dataset.mode);
    });
  });
  document.querySelector(".voyage-section").addEventListener("toggle", event => {
    const section = event.currentTarget;
    if (section.open) {
      document.querySelectorAll(".filter-section[data-mode]").forEach(item => {
        item.open = false;
      });
      state.routeMode = true;
      state.routePickIndex = 0;
      if (!state.map.hasLayer(state.routeLayer)) state.routeLayer.addTo(state.map);
      closePortCard();
      renderPorts();
      updateRouteSelection();
      document.getElementById("route-pick").classList.add("active");
      document.getElementById("route-result").textContent =
        "Click a port dot for the origin, then another for the destination.";
    } else {
      state.routeMode = false;
      state.routePickIndex = 0;
      const button = document.getElementById("route-pick");
      button.classList.remove("active");
      button.textContent = "Select two ports on map";
      if (state.mode !== "ports" && state.map.hasLayer(state.routeLayer)) {
        state.map.removeLayer(state.routeLayer);
      }
      renderPorts();
    }
  });
  document.querySelectorAll("#energy-layers input, #renewable-layers input, #nuclear-layers input, #coal-layers input, #iron-layers input, #cement-layers input")
    .forEach(input => input.addEventListener("change", () => toggleAssetLayer(input)));
  document.getElementById("show-ports").addEventListener("change", renderPorts);
  document.getElementById("energy-show-ports").addEventListener("change", renderPorts);
  document.getElementById("commodity-show-ports").addEventListener("change", renderPorts);
  document.getElementById("ais-enabled").addEventListener("change", event => {
    setAisEnabled(event.target.checked);
  });
  document.getElementById("ais-refresh").addEventListener("click", () => refreshAisLayer());
  document.getElementById("ais-clear").addEventListener("click", clearAisVessels);
  document.getElementById("ais-display-mode").addEventListener("change", event => {
    state.aisDisplayMode = event.target.value === "selected" ? "selected" : "all";
    saveAisPreferences();
    renderAisVessels();
    if (state.aisEnabled) refreshAisLayer();
  });
  document.getElementById("ais-type-filter").addEventListener("change", event => {
    const allowed = new Set(["cargo_tanker", "cargo", "tanker", "all"]);
    state.aisTypeFilter = allowed.has(event.target.value)
      ? event.target.value
      : "cargo_tanker";
    saveAisPreferences();
    renderAisVessels();
  });
  document.querySelectorAll("#ais-region-options input").forEach(input => {
    input.addEventListener("change", () => {
      if (input.value === "world" && input.checked) {
        document.querySelectorAll("#ais-region-options input").forEach(option => {
          option.checked = option === input;
        });
      } else if (input.checked) {
        document.querySelector('#ais-region-options input[value="world"]').checked = false;
      }
      const checked = Array.from(
        document.querySelectorAll("#ais-region-options input:checked")
      );
      if (!checked.length) {
        const current = document.querySelector(
          '#ais-region-options input[value="current"]'
        );
        current.checked = true;
        checked.push(current);
      }
      state.aisRegions = new Set(checked.map(option => option.value));
      saveAisPreferences();
      updateAisRegionSummary();
      renderAisVessels();
      if (state.aisEnabled) refreshAisLayer();
    });
  });
  document.getElementById("ais-search-button").addEventListener("click", () => refreshAisLayer(true));
  document.getElementById("ais-search").addEventListener("keydown", event => {
    if (event.key === "Enter") refreshAisLayer(true);
  });
  document.getElementById("coastal-weather-enabled").addEventListener("change", event => {
    setCoastalWeatherEnabled(event.target.checked);
  });
  document.getElementById("coastal-weather-day").addEventListener("change", event => {
    state.coastalWeatherDay = Number(event.target.value) || 1;
    if (state.coastalWeatherEnabled) loadCoastalWeather();
  });
  document.querySelectorAll(".weather-parameters input").forEach(input => {
    input.addEventListener("change", () => {
      state.coastalWeatherParameters = new Set(
        Array.from(document.querySelectorAll(".weather-parameters input:checked"))
          .map(item => item.value)
      );
      renderCoastalWeather();
    });
  });
  document.getElementById("coastal-weather-animation").addEventListener("change", event => {
    state.coastalWeatherAnimated = event.target.checked;
    renderCoastalWeather();
  });
  document.getElementById("coastal-weather-refresh").addEventListener("click", () => {
    loadCoastalWeather(true);
  });
  document.querySelectorAll("#coal-workspace-layers input, #coal-consumer-layers input").forEach(input => {
    input.addEventListener("change", renderCoalLayers);
  });
  document.getElementById("coal-asset-status").addEventListener("change", loadCoalWorkspace);
  document.getElementById("iron-terminal-role").addEventListener("change", () => {
    const input = workspaceInput("commodities", "iron_ore_terminals");
    if (input?.checked) applyWorkspaceFilters("commodities");
  });
  document.querySelectorAll("[data-coal-view]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.mode !== "coal") activateMode("coal");
      setCoalView(button.dataset.coalView);
    });
  });
  document.getElementById("coal-analysis-apply").addEventListener("click", loadCoalDashboard);
  document.getElementById("coal-analysis-frequency").addEventListener("change", loadCoalDashboard);
  document.getElementById("coal-analysis-focus").addEventListener("change", loadCoalDashboard);
  document.getElementById("coal-analysis-comparison").addEventListener("change", loadCoalDashboard);
  document.querySelectorAll("[data-coal-range]").forEach(button => {
    button.addEventListener("click", () => applyCoalRangePreset(button.dataset.coalRange));
  });
  document.querySelectorAll("[data-coal-dashboard-tab]").forEach(button => {
    button.addEventListener("click", () => setCoalDashboardTab(button.dataset.coalDashboardTab));
  });
  document.getElementById("coal-upload").addEventListener("click", () => {
    document.getElementById("coal-upload-input").click();
  });
  document.getElementById("coal-upload-input").addEventListener("change", uploadCoalDataset);
  document.getElementById("coal-export").addEventListener("click", exportCoalData);
  document.getElementById("coal-research-run").addEventListener("click", runCoalResearch);
  document.getElementById("coal-research-question").addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runCoalResearch();
  });
  document.querySelectorAll(".coal-research-prompts button").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("coal-research-question").value = button.textContent.trim();
      runCoalResearch();
    });
  });
  document.getElementById("coal-metric").addEventListener("change", refreshCoalActionState);
  document.getElementById("coal-run-analysis").addEventListener("click", () => {
    const dataset = document.getElementById("coal-metric").selectedOptions[0].textContent;
    const frequency = document.getElementById("coal-frequency").selectedOptions[0].textContent;
    const coalType = document.getElementById("coal-grade").selectedOptions[0].textContent;
    const period = document.getElementById("coal-period").selectedOptions[0].textContent;
    document.getElementById("coal-research-question").value =
      `Show ${frequency.toLowerCase()} ${coalType.toLowerCase()} ${dataset.toLowerCase()} for ${period.toLowerCase()}.`;
    runCoalResearch();
  });
  document.getElementById("npp-refresh").addEventListener("click", () => loadNppPower(true));
  document.getElementById("port-country").addEventListener("change", loadPorts);
  document.getElementById("port-size").addEventListener("change", loadPorts);
  document.querySelectorAll("#port-categories input").forEach(input => input.addEventListener("change", loadPorts));
  document.getElementById("energy-apply").addEventListener("click", () => applyWorkspaceFilters("energy"));
  document.getElementById("commodity-apply").addEventListener("click", () => applyWorkspaceFilters("commodities"));
  document.getElementById("coal-terminal-role").addEventListener("change", () => applyWorkspaceFilters("commodities"));
  document.getElementById("route-pick").addEventListener("click", startRoutePicking);
  document.getElementById("route-reset").addEventListener("click", resetRoute);
  [
    ["route-from-input", 0],
    ["route-to-input", 1]
  ].forEach(([id, index]) => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => input.setCustomValidity(""));
    input.addEventListener("change", () => selectRoutePortFromInput(index, input));
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        selectRoutePortFromInput(index, input);
      }
    });
  });
  document.querySelectorAll(
    "#route-speed, #route-sea-margin, #route-port-hours, #route-canal-hours, .route-restrictions input"
  ).forEach(input => {
    const schedule = () => {
      if (!state.routePorts[0] || !state.routePorts[1]) return;
      window.clearTimeout(routeRecalculationTimer);
      routeRecalculationTimer = window.setTimeout(calculateRoute, 300);
    };
    input.addEventListener("change", schedule);
    if (input.type === "number") input.addEventListener("input", schedule);
  });
  document.getElementById("close-port-card").addEventListener("click", closePortCard);
  document.getElementById("fit-world").addEventListener("click", () => state.map.setView([18, 10], 2));
  document.getElementById("map-skin").addEventListener("change", event => {
    setMapSkin(event.target.value);
  });
}

function activateMode(mode) {
  state.mode = mode;
  closePortCard();
  const voyageSection = document.querySelector(".voyage-section");
  if (voyageSection.open) voyageSection.open = false;
  state.routeMode = false;
  state.routePickIndex = 0;
  document.querySelectorAll(".filter-section[data-mode]").forEach(section => {
    if (section.dataset.mode !== mode) section.open = false;
  });
  state.assetLayers.forEach((layer, id) => {
    if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
  });
  const coalOnly = mode === "coal";
  [state.aisLayer, state.aisTrailLayer, state.routeLayer].forEach(layer => {
    if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
  });
  if (!coalOnly && state.aisEnabled) {
    state.aisLayer.addTo(state.map);
    state.aisTrailLayer.addTo(state.map);
    renderAisVessels();
  }
  if (mode === "ports") state.routeLayer.addTo(state.map);
  if (mode === "energy" || mode === "commodities") {
    WORKSPACE_LAYERS[mode].forEach(id => {
      const input = workspaceInput(mode, id);
      if (input?.checked) toggleAssetLayer(input);
    });
  }
  const coalHeader = document.getElementById("coal-workspace-header");
  coalHeader.hidden = mode !== "coal";
  if (mode === "coal") {
    setCoalView(state.coalView);
    renderCoalLayers();
    state.map.fitBounds([[6, 68], [37, 98]], { padding: [25, 25] });
  } else {
    state.coalLayer.clearLayers();
    document.getElementById("coal-data-surface").hidden = true;
    document.getElementById("npp-power-surface").hidden = true;
    document.getElementById("map").hidden = false;
    document.querySelector(".map-topbar").hidden = false;
    document.querySelector(".map-key").hidden = false;
    setTimeout(() => state.map.invalidateSize(), 0);
  }
  renderPorts();
  updateActiveCounts();
}

function setCoastalWeatherEnabled(enabled) {
  state.coastalWeatherEnabled = Boolean(enabled);
  const count = document.getElementById("weather-layer-count");
  const key = document.querySelector(".weather-key-item");
  if (!state.coastalWeatherEnabled) {
    state.weatherLayer.clearLayers();
    state.weatherSymbolLayer.clearLayers();
    if (state.map.hasLayer(state.weatherLayer)) state.map.removeLayer(state.weatherLayer);
    if (state.map.hasLayer(state.weatherSymbolLayer)) state.map.removeLayer(state.weatherSymbolLayer);
    count.textContent = "Off";
    key.hidden = true;
    document.getElementById("coastal-weather-status").textContent =
      "Layer is switched off.";
    const detailCard = document.getElementById("port-card");
    if (detailCard.classList.contains("weather-detail-card")) closePortCard();
    return;
  }
  state.weatherLayer.addTo(state.map);
  state.weatherSymbolLayer.addTo(state.map);
  key.hidden = false;
  loadCoastalWeather();
}

async function loadCoastalWeather(force = false) {
  if (!state.coastalWeatherEnabled || state.coastalWeatherLoading) return;
  state.coastalWeatherLoading = true;
  const status = document.getElementById("coastal-weather-status");
  const refreshButton = document.getElementById("coastal-weather-refresh");
  refreshButton.disabled = true;
  status.textContent = force
    ? "Refreshing official IMD bulletins…"
    : "Loading normalized IMD coastal forecast…";
  try {
    const endpoint = `/api/imd/coastal-weather${force ? "/refresh" : ""}?day=${state.coastalWeatherDay}`;
    const response = await fetch(endpoint, { method: force ? "POST" : "GET" });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || `Weather request failed (${response.status})`);
    }
    const payload = await response.json();
    state.coastalWeatherRows = Array.isArray(payload.rows) ? payload.rows : [];
    renderCoastalWeather();
    const fetched = payload.fetched_at
      ? new Date(payload.fetched_at).toLocaleString()
      : "time unavailable";
    const visible = weatherVisibleRows().length;
    status.textContent =
      `Day ${state.coastalWeatherDay}: ${visible} areas with published values · updated ${fetched}.`;
  } catch (error) {
    status.textContent = `Weather unavailable: ${error.message}`;
    state.weatherLayer.clearLayers();
    state.weatherSymbolLayer.clearLayers();
    document.getElementById("weather-layer-count").textContent = "Unavailable";
  } finally {
    state.coastalWeatherLoading = false;
    refreshButton.disabled = false;
  }
}

function weatherVisibleRows() {
  const params = state.coastalWeatherParameters;
  return state.coastalWeatherRows.filter(row => (
    (params.has("rain") && row.rainfall_category) ||
    (params.has("wind") && (row.wind_speed_max_kmph != null || row.gust_kmph != null)) ||
    (params.has("wave") && row.wave_height_max_m != null)
  ));
}

function weatherColor(severity) {
  if (severity === "warning") return "#c93036";
  if (severity === "advisory") return "#d68a1d";
  return "#2c91b4";
}

function weatherValue(value, suffix = "") {
  return value == null
    ? "Not quantified"
    : `${Number(value).toLocaleString()}${suffix ? ` ${suffix}` : ""}`;
}

function coastalWeatherTooltip(row) {
  const rain = state.coastalWeatherParameters.has("rain")
    ? `<div><span>Rainfall</span><strong>${escapeHtml(row.rainfall_category || "Not quantified")}</strong></div>`
    : "";
  const wind = state.coastalWeatherParameters.has("wind")
    ? `<div><span>Wind</span><strong>${
        row.wind_speed_max_kmph == null
          ? "Not quantified"
          : `${weatherValue(row.wind_speed_min_kmph)}–${weatherValue(row.wind_speed_max_kmph, "km/h")}`
      }</strong></div>
      <div><span>Gust</span><strong>${weatherValue(row.gust_kmph, "km/h")}</strong></div>`
    : "";
  const waves = state.coastalWeatherParameters.has("wave")
    ? `<div><span>Wave height</span><strong>${
        row.wave_height_max_m == null
          ? "Not quantified"
          : `${row.wave_height_min_m}–${row.wave_height_max_m} m`
      }</strong></div>`
    : "";
  const source = row.source_url
    ? `<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener">Open IMD source</a>`
    : "No quantified source entry";
  return `
    <div class="weather-tooltip">
      <span class="weather-tooltip-kicker">IMD / DAY ${row.day}</span>
      <h3>${escapeHtml(row.zone_name)}</h3>
      ${rain}${wind}${waves}
      <small>${escapeHtml(row.valid_date || row.source_issue_time || "Latest published bulletin")}</small>
      <small>${source} · generalized region, not for navigation</small>
    </div>`;
}

function weatherSymbolHtml(row) {
  const animated = state.coastalWeatherAnimated ? " animated" : "";
  const parts = [];
  if (state.coastalWeatherParameters.has("rain") && row.rainfall_category) {
    parts.push(`<span class="weather-rain${animated}" title="Rainfall"><i></i><i></i><i></i></span>`);
  }
  if (
    state.coastalWeatherParameters.has("wind") &&
    (row.wind_speed_max_kmph != null || row.gust_kmph != null)
  ) {
    parts.push(`<span class="weather-wind${animated}" title="Wind"><i></i><i></i><i></i></span>`);
  }
  if (state.coastalWeatherParameters.has("wave") && row.wave_height_max_m != null) {
    parts.push(`<span class="weather-wave${animated}" title="Waves"><i></i><i></i></span>`);
  }
  const motionClass = state.coastalWeatherAnimated ? " weather-motion" : "";
  return `<div class="weather-symbols severity-${row.severity}${motionClass}">${parts.join("")}</div>`;
}

function showCoastalWeatherCard(row) {
  const card = document.getElementById("port-card");
  card.classList.remove("port-spec-card");
  card.classList.add("weather-detail-card");
  const windRange = row.wind_speed_max_kmph == null
    ? "Not quantified"
    : `${weatherValue(row.wind_speed_min_kmph)}–${weatherValue(row.wind_speed_max_kmph, "km/h")}`;
  const waveRange = row.wave_height_max_m == null
    ? "Not quantified"
    : `${weatherValue(row.wave_height_min_m)}–${weatherValue(row.wave_height_max_m, "m")}`;
  const severity = row.severity === "warning"
    ? "Warning"
    : row.severity === "advisory" ? "Advisory" : "Normal";
  const sourceLink = row.source_url
    ? `<a class="official-port-link weather-source-link" href="${escapeAttr(row.source_url)}" target="_blank" rel="noopener">Open official IMD source</a>`
    : "";
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">IMD coastal weather · Day ${Number(row.day)}</span>` +
    `<h2>${escapeHtml(row.zone_name)}</h2>` +
    `<p class="detail-meta">${escapeHtml(row.valid_date || row.source_issue_time || "Latest published bulletin")}</p>` +
    `<div class="weather-card-severity severity-${escapeAttr(row.severity || "normal")}">${severity}</div>` +
    `<div class="detail-grid weather-detail-grid">` +
    detailCell("Rainfall", row.rainfall_category || "Not quantified") +
    detailCell("Wind speed", windRange) +
    detailCell("Maximum gust", weatherValue(row.gust_kmph, "km/h")) +
    detailCell("Wave height", waveRange) +
    `</div>` +
    `<p class="weather-card-summary">${escapeHtml(row.summary || "No quantified warning in the source bulletin")}</p>` +
    sourceLink +
    `<p class="detail-note">Generalized offshore forecast region—not for navigation. Blank values mean IMD did not quantify that field in the parsed bulletin.</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

function renderCoastalWeather() {
  if (!state.weatherLayer || !state.weatherSymbolLayer) return;
  state.weatherLayer.clearLayers();
  state.weatherSymbolLayer.clearLayers();
  if (!state.coastalWeatherEnabled) return;
  const rows = weatherVisibleRows();
  rows.forEach(row => {
    if (!row.geometry) return;
    const color = weatherColor(row.severity);
    const openWeatherDetails = event => {
      if (event?.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      showCoastalWeatherCard(row);
    };
    const polygon = L.geoJSON(row.geometry, {
      interactive: true,
      style: {
        color,
        weight: 1.2,
        opacity: 0.85,
        fillColor: color,
        fillOpacity: row.severity === "warning" ? 0.2 : 0.12,
        dashArray: row.severity === "normal" ? "4 3" : null
      }
    }).bindTooltip(coastalWeatherTooltip(row), {
      sticky: true,
      direction: "top",
      className: "weather-leaflet-tooltip",
      opacity: 1
    });
    polygon.on("click", openWeatherDetails);
    polygon.eachLayer(layer => {
      layer.on("click", openWeatherDetails);
      if (layer.getElement) {
        layer.on("add", () => {
          const element = layer.getElement();
          if (element) element.style.cursor = "pointer";
        });
      }
    });
    polygon.addTo(state.weatherLayer);
    const center = polygon.getBounds().getCenter();
    const weatherMarker = L.marker(center, {
      interactive: true,
      keyboard: true,
      title: `Open ${row.zone_name} weather report`,
      icon: L.divIcon({
        className: "weather-symbol-marker",
        html: weatherSymbolHtml(row),
        iconSize: [104, 44],
        iconAnchor: [52, 22]
      })
    });
    weatherMarker.on("click", openWeatherDetails);
    weatherMarker.addTo(state.weatherSymbolLayer);
  });
  document.getElementById("weather-layer-count").textContent =
    rows.length ? `${rows.length} areas` : "No values";
}

function loadAisPreferences() {
  try {
    const mode = window.localStorage.getItem("hrp-ais-display-mode");
    state.aisDisplayMode = mode === "selected" ? "selected" : "all";
    const typeFilter = window.localStorage.getItem("hrp-ais-type-filter");
    state.aisTypeFilter = new Set(["cargo_tanker", "cargo", "tanker", "all"])
      .has(typeFilter)
      ? typeFilter
      : "cargo_tanker";
    const allowedRegions = new Set(["current", ...Object.keys(AIS_REGION_BOUNDS)]);
    const savedRegions = JSON.parse(
      window.localStorage.getItem("hrp-ais-regions") || "null"
    );
    const regions = Array.isArray(savedRegions)
      ? savedRegions.filter(region => allowedRegions.has(region))
      : DEFAULT_AIS_REGIONS;
    state.aisRegions = new Set(regions.length ? regions : DEFAULT_AIS_REGIONS);
    if (state.aisRegions.has("world")) state.aisRegions = new Set(["world"]);
    const saved = JSON.parse(
      window.localStorage.getItem("hrp-ais-watchlist") || "[]"
    );
    state.aisWatchlist = new Map(
      (Array.isArray(saved) ? saved : [])
        .filter(vessel => /^\d{9}$/.test(String(vessel.mmsi || "")))
        .slice(0, 50)
        .map(vessel => [String(vessel.mmsi), vessel])
    );
  } catch {
    state.aisDisplayMode = "all";
    state.aisTypeFilter = "cargo_tanker";
    state.aisRegions = new Set(DEFAULT_AIS_REGIONS);
    state.aisWatchlist = new Map();
  }
  document.getElementById("ais-display-mode").value = state.aisDisplayMode;
  document.getElementById("ais-type-filter").value = state.aisTypeFilter;
  document.querySelectorAll("#ais-region-options input").forEach(input => {
    input.checked = state.aisRegions.has(input.value);
  });
  updateAisRegionSummary();
  renderAisWatchlist();
}

function saveAisPreferences() {
  try {
    window.localStorage.setItem("hrp-ais-display-mode", state.aisDisplayMode);
    window.localStorage.setItem("hrp-ais-type-filter", state.aisTypeFilter);
    window.localStorage.setItem(
      "hrp-ais-regions",
      JSON.stringify(Array.from(state.aisRegions))
    );
    window.localStorage.setItem(
      "hrp-ais-watchlist",
      JSON.stringify(Array.from(state.aisWatchlist.values()))
    );
  } catch {
    // Browser storage can be unavailable in privacy-restricted sessions.
  }
}

function updateAisRegionSummary() {
  const summary = document.getElementById("ais-region-summary");
  if (!summary) return;
  if (state.aisRegions.has("world")) {
    summary.textContent = "Worldwide";
  } else if (state.aisRegions.size === 1 && state.aisRegions.has("current")) {
    summary.textContent = "Current map";
  } else {
    summary.textContent = `${state.aisRegions.size} selected`;
  }
}

function aisVesselInSelectedRegions(vessel) {
  if (state.aisRegions.has("world")) return true;
  const lat = Number(vessel.lat);
  const lon = Number(vessel.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (
    state.aisRegions.has("current")
    && state.map?.getBounds().contains([lat, lon])
  ) {
    return true;
  }
  return Array.from(state.aisRegions).some(region => {
    const bounds = AIS_REGION_BOUNDS[region];
    if (!bounds) return false;
    return (
      lat >= bounds[0][0] && lat <= bounds[1][0]
      && lon >= bounds[0][1] && lon <= bounds[1][1]
    );
  });
}

function addAisWatchlistVessels(vessels) {
  vessels.slice(0, 50).forEach(vessel => {
    const mmsi = String(vessel.mmsi || "");
    if (!/^\d{9}$/.test(mmsi)) return;
    state.aisWatchlist.set(mmsi, {
      mmsi,
      imo: vessel.imo || "",
      name: vessel.name || `MMSI ${mmsi}`
    });
  });
  while (state.aisWatchlist.size > 50) {
    const oldest = state.aisWatchlist.keys().next().value;
    state.aisWatchlist.delete(oldest);
  }
  saveAisPreferences();
  renderAisWatchlist();
}

function removeAisWatchlistVessel(mmsi) {
  state.aisWatchlist.delete(String(mmsi));
  saveAisPreferences();
  renderAisWatchlist();
  renderAisVessels();
  if (state.aisEnabled && state.aisDisplayMode === "selected") {
    refreshAisLayer();
  }
}

function renderAisWatchlist() {
  const container = document.getElementById("ais-watchlist");
  if (!state.aisWatchlist.size) {
    container.innerHTML = "<span>No selected vessels.</span>";
    return;
  }
  container.innerHTML = Array.from(state.aisWatchlist.values())
    .map(vessel => `
      <button type="button" data-ais-remove="${escapeAttr(vessel.mmsi)}"
        title="Remove ${escapeAttr(vessel.name)}">
        <strong>${escapeHtml(vessel.name)}</strong>
        <small>${escapeHtml(vessel.mmsi)}</small>
        <i aria-hidden="true">×</i>
      </button>
    `)
    .join("");
  container.querySelectorAll("[data-ais-remove]").forEach(button => {
    button.addEventListener("click", () => {
      removeAisWatchlistVessel(button.dataset.aisRemove);
    });
  });
}

function displayedAisVessels() {
  return state.aisVessels.filter(vessel => {
    if (
      state.aisDisplayMode === "selected"
      && !state.aisWatchlist.has(String(vessel.mmsi || ""))
    ) {
      return false;
    }
    if (
      state.aisDisplayMode !== "selected"
      && !aisVesselInSelectedRegions(vessel)
    ) {
      return false;
    }
    const category = aisVesselTypeCategory(vessel.ship_type);
    if (state.aisTypeFilter === "all") return true;
    if (state.aisTypeFilter === "cargo") return category === "cargo";
    if (state.aisTypeFilter === "tanker") return category === "tanker";
    return category === "cargo" || category === "tanker" || category === "unknown";
  });
}

function aisVesselTypeCategory(value) {
  const type = Number(value);
  if (!Number.isFinite(type)) return "unknown";
  if (type >= 70 && type <= 79) return "cargo";
  if (type >= 80 && type <= 89) return "tanker";
  if (type >= 60 && type <= 69) return "passenger";
  if (type >= 40 && type <= 49) return "high_speed";
  if (type === 30) return "fishing";
  if ([31, 32, 52].includes(type)) return "tug_tow";
  if ([36, 37].includes(type)) return "pleasure";
  if (type >= 33 && type <= 59) return "special";
  if (type >= 90 && type <= 99) return "other";
  return "unknown";
}

function aisVesselTypeLabel(value) {
  const labels = {
    cargo: "Cargo vessel",
    tanker: "Tanker",
    passenger: "Passenger vessel",
    high_speed: "High-speed craft",
    fishing: "Fishing vessel",
    tug_tow: "Tug / towing vessel",
    pleasure: "Sailing / pleasure craft",
    special: "Special-purpose vessel",
    other: "Other vessel",
    unknown: "Type not yet received"
  };
  return labels[aisVesselTypeCategory(value)];
}

function setAisStatus(text, kind = "") {
  const element = document.getElementById("ais-status");
  element.textContent = text;
  element.dataset.kind = kind;
}

async function setAisEnabled(enabled) {
  state.aisEnabled = Boolean(enabled);
  window.clearInterval(state.aisRefreshTimer);
  state.aisRefreshTimer = null;
  if (!state.aisEnabled) {
    clearAisVessels(false);
    document.getElementById("ais-layer-count").textContent = "Off";
    setAisStatus("AIS layer is switched off.");
    updateMapStatus();
    return;
  }
  try {
    const response = await fetch("/api/ais/status");
    const status = await response.json();
    if (!status.configured) {
      document.getElementById("ais-enabled").checked = false;
      state.aisEnabled = false;
      document.getElementById("ais-layer-count").textContent = "Setup";
      setAisStatus(
        "Add AISSTREAM_API_KEY to the server environment, then restart the app.",
        "error"
      );
      return;
    }
    setAisStatus("Connecting to live AIS observations…", "loading");
    await refreshAisLayer();
    if (state.aisEnabled) {
      state.aisRefreshTimer = window.setInterval(() => refreshAisLayer(), 10_000);
    }
  } catch (error) {
    setAisStatus(error.message || "AIS status could not be checked.", "error");
  }
}

function clearAisVessels(showMessage = true) {
  state.aisLayer.clearLayers();
  state.aisTrailLayer.clearLayers();
  state.aisVessels = [];
  state.selectedAisMmsi = null;
  if (state.aisEnabled) {
    document.getElementById("ais-layer-count").textContent = "0 retained";
    if (showMessage) {
      setAisStatus("Retained vessels cleared. Press Refresh to receive the current map area.");
    }
  }
  updateMapStatus();
}

function currentAisBounds() {
  const bounds = state.map.getBounds();
  return {
    south: Math.max(-90, bounds.getSouth()),
    north: Math.min(90, bounds.getNorth()),
    west: Math.max(-180, bounds.getWest()),
    east: Math.min(180, bounds.getEast())
  };
}

async function refreshAisLayer(isSearch = false) {
  if (!state.aisEnabled || state.aisLoading) return;
  const selectedMmsis = state.aisDisplayMode === "selected" && !isSearch
    ? Array.from(state.aisWatchlist.keys())
    : [];
  if (
    state.aisDisplayMode === "selected"
    && !isSearch
    && !selectedMmsis.length
  ) {
    setAisStatus("Add at least one vessel to use Selected vessels only.", "warning");
    renderAisVessels();
    return;
  }
  state.aisLoading = true;
  const query = document.getElementById("ais-search").value.trim();
  const searchButton = document.getElementById("ais-search-button");
  const refreshButton = document.getElementById("ais-refresh");
  const clearButton = document.getElementById("ais-clear");
  searchButton.disabled = true;
  refreshButton.disabled = true;
  clearButton.disabled = true;
  setAisStatus(
    query && isSearch ? `Searching for “${query}”…` : "Receiving live AIS positions…",
    "loading"
  );
  try {
    const response = await fetch("/api/ais/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...currentAisBounds(),
        query: query && isSearch ? query : null,
        mmsis: selectedMmsis,
        regions: Array.from(state.aisRegions),
        timeout_sec: 2,
        max_vessels: 1000
      })
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.detail || "AIS feed request failed.");
    }
    const received = json.vessels || [];
    const retained = new Map(
      state.aisVessels.map(vessel => [String(vessel.mmsi || vessel.imo), vessel])
    );
    let added = 0;
    received.forEach(vessel => {
      const key = String(vessel.mmsi || vessel.imo || "");
      if (!key) return;
      if (!retained.has(key)) added += 1;
      retained.set(key, { ...(retained.get(key) || {}), ...vessel });
    });
    state.aisVessels = Array.from(retained.values());
    if (isSearch && received.length) {
      addAisWatchlistVessels(received);
    }
    renderAisVessels();
    const receivedCount = received.length;
    const retainedCount = state.aisVessels.length;
    const sampled = json.sampled_at
      ? new Date(json.sampled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "now";
    const shownCount = displayedAisVessels().length;
    document.getElementById("ais-layer-count").textContent =
      state.aisDisplayMode === "selected"
        ? `${shownCount} selected`
        : `${shownCount} shown`;
    if (query && isSearch && !receivedCount) {
      setAisStatus(
        `No current AIS match for “${query}” in this sample. Name and IMO searches depend on static AIS messages.`,
        "warning"
      );
    } else {
      const updateText = added
        ? `${added.toLocaleString()} new, ${Math.max(0, receivedCount - added).toLocaleString()} updated`
        : `${receivedCount.toLocaleString()} updated`;
      setAisStatus(
        `${updateText} at ${sampled}. ${shownCount.toLocaleString()} shown; ${retainedCount.toLocaleString()} retained.`
      );
    }
  } catch (error) {
    setAisStatus(error.message || "AIS positions could not be loaded.", "error");
  } finally {
    state.aisLoading = false;
    searchButton.disabled = false;
    refreshButton.disabled = false;
    clearButton.disabled = false;
  }
}

function aisObservationAgeClass(vessel) {
  const observed = Date.parse(vessel.last_update || "");
  if (!Number.isFinite(observed)) return "ais-age-unknown";
  const ageMinutes = Math.max(0, (Date.now() - observed) / 60_000);
  if (ageMinutes <= 15) return "ais-age-fresh";
  if (ageMinutes <= 60) return "ais-age-aging";
  return "ais-age-stale";
}

function formatAisObservedAt(vessel) {
  const observed = Date.parse(vessel.last_update || "");
  if (!Number.isFinite(observed)) return "time unavailable";
  return new Date(observed).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderAisVessels() {
  state.aisLayer.clearLayers();
  const displayed = displayedAisVessels();
  displayed.forEach(vessel => {
    const lat = Number(vessel.lat);
    const lon = Number(vessel.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const course = Number(vessel.cog ?? vessel.heading ?? 0);
    const moving = Number(vessel.sog_kn || 0) >= 0.5;
    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: `ais-vessel-icon ${aisObservationAgeClass(vessel)}`,
        html: `<span class="${moving ? "moving" : "stationary"}" style="--ais-course:${Number.isFinite(course) ? course : 0}deg"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 650
    });
    const name = vessel.name || `MMSI ${vessel.mmsi}`;
    marker.bindTooltip(
      `<strong>${escapeHtml(name)}</strong><br>${formatAisMotion(vessel)}<br><small>Last received ${escapeHtml(formatAisObservedAt(vessel))}</small>`,
      { className: "asset-tooltip ais-tooltip", direction: "top", opacity: 1 }
    );
    marker.on("click", () => showAisVessel(vessel, marker));
    marker.addTo(state.aisLayer);
  });
  document.getElementById("ais-layer-count").textContent = state.aisEnabled
    ? state.aisDisplayMode === "selected"
      ? `${displayed.length} selected`
      : `${displayed.length} shown`
    : "Off";
  updateMapStatus();
}

function formatAisMotion(vessel) {
  const facts = [aisVesselTypeLabel(vessel.ship_type)];
  if (vessel.sog_kn != null) facts.push(`${formatNumber(vessel.sog_kn, 1)} kn`);
  if (vessel.cog != null) facts.push(`COG ${formatNumber(vessel.cog, 0)}°`);
  if (vessel.destination) facts.push(`To ${vessel.destination}`);
  return facts.join(" · ") || "Position received";
}

function aisPopupHtml(vessel, trailCount = null) {
  const name = vessel.name || "Unnamed AIS target";
  const fields = [
    ["MMSI", vessel.mmsi],
    ["IMO", vessel.imo],
    ["Vessel type", aisVesselTypeLabel(vessel.ship_type)],
    ["Call sign", vessel.call_sign],
    ["Speed", vessel.sog_kn == null ? null : `${formatNumber(vessel.sog_kn, 1)} kn`],
    ["Course", vessel.cog == null ? null : `${formatNumber(vessel.cog, 0)}°`],
    ["Heading", vessel.heading == null ? null : `${formatNumber(vessel.heading, 0)}°`],
    ["Destination", vessel.destination],
    ["ETA", vessel.eta],
    ["Last AIS", vessel.last_update],
    ["Recorded trail", trailCount == null ? "Loading…" : `${trailCount} positions`]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return `
    <div class="ais-popup">
      <span class="ais-popup-kicker">LIVE AIS TARGET</span>
      <h3>${escapeHtml(name)}</h3>
      <div class="ais-popup-grid">
        ${fields.map(([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
        `).join("")}
      </div>
      <small>Trail contains actual observations retained by this dashboard, not a predicted voyage.</small>
    </div>
  `;
}

async function showAisVessel(vessel, marker) {
  state.selectedAisMmsi = vessel.mmsi;
  state.aisTrailLayer.clearLayers();
  marker.bindPopup(aisPopupHtml(vessel), {
    className: "ais-vessel-popup",
    minWidth: 290,
    maxWidth: 360
  }).openPopup();
  try {
    const response = await fetch(`/api/ais/trail/${encodeURIComponent(vessel.mmsi)}?hours=2160&limit=3000`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.detail || "Trail unavailable");
    if (state.selectedAisMmsi !== vessel.mmsi) return;
    const points = (json.points || [])
      .map(point => [Number(point.lat), Number(point.lon)])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (points.length >= 2) {
      L.polyline(points, {
        color: "#008ea8",
        weight: 3,
        opacity: 0.88,
        dashArray: null,
        lineJoin: "round"
      }).addTo(state.aisTrailLayer);
      L.circleMarker(points[0], {
        radius: 3,
        color: "#ffffff",
        weight: 1,
        fillColor: "#008ea8",
        fillOpacity: 1
      }).bindTooltip("First recorded AIS position").addTo(state.aisTrailLayer);
    }
    marker.setPopupContent(aisPopupHtml(vessel, points.length));
  } catch (error) {
    marker.setPopupContent(aisPopupHtml(vessel, 0));
  }
}

function setMapSkin(skin) {
  if (!MAP_SKINS[skin]) skin = "light";
  if (state.baseLayer && state.map.hasLayer(state.baseLayer)) {
    state.map.removeLayer(state.baseLayer);
  }
  state.mapSkin = skin;
  state.baseLayer = MAP_SKINS[skin]();
  state.baseLayer.addTo(state.map);
  state.baseLayer.bringToBack?.();
  document.getElementById("map")?.setAttribute("data-map-skin", skin);
  const selector = document.getElementById("map-skin");
  if (selector) selector.value = skin;
}

function addEnglishMapLabels() {
  const makeLabel = (item, kind) => {
    const [text, lat, lon] = item;
    const width = kind === "continents"
      ? 150
      : COUNTRY_LABEL_WIDTHS[text] || 70;
    return L.marker(
    [lat, lon],
    {
      interactive: false,
      icon: L.divIcon({
        className: `english-map-label ${kind === "continents" ? "continent-label" : "country-label"}`,
        html: `<span style="--country-label-width:${width}px">${escapeHtml(text)}</span>`,
        iconSize: [width, 28],
        iconAnchor: [width / 2, 14]
      })
    }
  )};
  state.continentLabels = L.layerGroup(
    ENGLISH_MAP_LABELS.continents.map(item => makeLabel(item, "continents"))
  ).addTo(state.map);
  state.countryLabels = L.layerGroup(
    ENGLISH_MAP_LABELS.countries.map(item => makeLabel(item, "countries"))
  );
  const refresh = () => {
    const zoom = state.map.getZoom();
    document.getElementById("map").dataset.labelZoom =
      zoom >= 7 ? "detail" : zoom >= 5 ? "regional" : "world";
    if (zoom <= 3) {
      if (!state.map.hasLayer(state.continentLabels)) state.continentLabels.addTo(state.map);
      if (state.map.hasLayer(state.countryLabels)) state.map.removeLayer(state.countryLabels);
    } else {
      if (state.map.hasLayer(state.continentLabels)) state.map.removeLayer(state.continentLabels);
      if (!state.map.hasLayer(state.countryLabels)) state.countryLabels.addTo(state.map);
    }
  };
  state.map.on("zoomend", refresh);
  refresh();
}

function portsAllowedForMode() {
  if (state.routeMode) return true;
  if (state.mode === "ports") return document.getElementById("show-ports").checked;
  if (state.mode === "energy") return document.getElementById("energy-show-ports").checked;
  if (state.mode === "commodities") return document.getElementById("commodity-show-ports").checked;
  return false;
}

async function loadPortFacets() {
  const response = await fetch("/api/ports/facets");
  const json = await response.json();
  const facets = json.facets || {};
  populateSelect("port-country", "All countries", facets.countries || []);
  populateSelect("port-size", "All sizes", facets.harbor_sizes || []);
  const counts = Object.fromEntries((facets.categories || []).map(item => [item.id, item.count]));
  ["dry_bulk", "coal"].forEach(key => {
    const el = document.getElementById("count-" + key.replaceAll("_", "-"));
    const label = document.querySelector(`[data-category="${key}"]`);
    const count = Number(counts[key] || 0);
    if (el) el.textContent = count.toLocaleString();
    if (label) label.hidden = count <= 0;
  });
}

async function loadWorkspaceFacets() {
  await Promise.all(Object.entries(WORKSPACE_LAYERS).map(async ([mode, layers]) => {
    const response = await fetch("/api/layer-facets?trackers=" + layers.join(","));
    if (!response.ok) return;
    const facets = await response.json();
    populateSelect(`${mode === "energy" ? "energy" : "commodity"}-country`, "All countries", facets.countries || []);
  }));
}

async function loadCoalWorkspace() {
  try {
    const statusGroup = document.getElementById("coal-asset-status").value;
    const [summaryResponse, assetsResponse] = await Promise.all([
      fetch("/api/coal/summary"),
      fetch(`/api/coal/assets?status_group=${encodeURIComponent(statusGroup)}&limit=20000`)
    ]);
    if (!summaryResponse.ok || !assetsResponse.ok) throw new Error("Coal workspace data could not be loaded");
    state.coalSummary = await summaryResponse.json();
    const assetPayload = await assetsResponse.json();
    state.coalAssets = assetPayload.data || [];
    const counts = {};
    state.coalAssets.forEach(item => {
      counts[item.asset_kind] = (counts[item.asset_kind] || 0) + 1;
    });
    document.getElementById("coal-mine-count").textContent = Number(counts.coal_mines || 0).toLocaleString();
    document.getElementById("coal-terminal-count").textContent = Number(counts.coal_trade_terminals || 0).toLocaleString();
    document.getElementById("coal-port-count").textContent = Number(counts.dry_bulk_ports || 0).toLocaleString();
    document.getElementById("coal-power-count").textContent = Number(counts.power_consumers || 0).toLocaleString();
    document.getElementById("coal-steel-count").textContent = Number(counts.steel_consumers || 0).toLocaleString();
    document.getElementById("coal-cement-count").textContent = Number(counts.cement_consumers || 0).toLocaleString();
    const hasDatasets = (state.coalSummary.datasets || []).length > 0;
    document.getElementById("coal-data-status").textContent = hasDatasets
      ? `${state.coalSummary.datasets.length} dataset${state.coalSummary.datasets.length === 1 ? "" : "s"}`
      : "India workspace";
    document.getElementById("coal-header-status").textContent = hasDatasets
      ? `${state.coalSummary.datasets.length} uploaded dataset${state.coalSummary.datasets.length === 1 ? "" : "s"}`
      : coalMasterHeader(state.coalSummary.official_master);
    await loadCoalAnalysis();
    refreshCoalActionState();
    if (hasDatasets) {
      document.getElementById("coal-upload-message").textContent =
        "Uploaded data is stored separately from GEM/WPI map context. Review its detected date and numeric fields before analysis.";
    } else {
      document.getElementById("coal-upload-message").textContent =
        "Official Coal Directory annual series is loaded. Uploads remain optional for monthly, weekly, plant-level or driver analysis.";
    }
    renderCoalAssetViews();
    renderCoalLayers();
  } catch (error) {
    document.getElementById("coal-upload-message").textContent = error.message;
  }
}

function coalMasterHeader(master) {
  if (!master || !Number(master.normalized_row_count || 0)) {
    return "Awaiting operational data";
  }
  return `${Number(master.normalized_row_count || 0).toLocaleString()} official rows`;
}

async function loadCoalAnalysis() {
  const from = document.getElementById("coal-analysis-from");
  const to = document.getElementById("coal-analysis-to");
  if (!from.options.length) {
    const periods = [];
    for (let date = new Date(2023, 4, 1); date <= new Date(2026, 5, 1); date.setMonth(date.getMonth() + 1)) {
      periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    from.innerHTML = periods.map(period =>
      `<option value="${escapeAttr(period)}">${escapeHtml(formatCoalPeriod(period))}</option>`
    ).join("");
    to.innerHTML = from.innerHTML;
    from.value = periods[0];
    to.value = periods[periods.length - 1];
  }
  await loadCoalDashboard();
}

function formatCoalPeriod(period) {
  if (!/^\d{4}-\d{2}$/.test(String(period))) return String(period || "—");
  const date = new Date(`${period}-01T00:00:00`);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

async function setCoalDashboardTab(tab) {
  state.coalDashboardTab = tab;
  document.querySelectorAll("[data-coal-dashboard-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.coalDashboardTab === tab);
  });
  await loadCoalDashboard();
}

function applyCoalRangePreset(preset) {
  const from = document.getElementById("coal-analysis-from");
  const to = document.getElementById("coal-analysis-to");
  const periods = Array.from(from.options).map(option => option.value);
  if (!periods.length) return;
  const counts = { "12m": 12, "24m": 24, "3y": 36 };
  const count = counts[preset] || periods.length;
  from.value = periods[Math.max(0, periods.length - count)];
  to.value = periods[periods.length - 1];
  document.querySelectorAll("[data-coal-range]").forEach(button => {
    button.classList.toggle("active", button.dataset.coalRange === preset);
  });
  loadCoalDashboard();
}

async function loadCoalDashboard() {
  const container = document.getElementById("coal-dashboard-panels");
  const start = document.getElementById("coal-analysis-from").value || "2023-05";
  const end = document.getElementById("coal-analysis-to").value || "2026-06";
  const frequency = document.getElementById("coal-analysis-frequency").value || "monthly";
  const focus = document.getElementById("coal-analysis-focus").value || "all";
  const comparison = document.getElementById("coal-analysis-comparison").value || "previous_period";
  if (start > end) {
    container.innerHTML = `<div class="coal-dashboard-error">The From month must be before the To month.</div>`;
    return;
  }
  container.innerHTML = `<div class="coal-dashboard-loading">Loading official ${escapeHtml(state.coalDashboardTab)} data…</div>`;
  const params = new URLSearchParams({ tab: state.coalDashboardTab, start, end, frequency, focus, comparison });
  try {
    const response = await fetch(`/api/coal/dashboard?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Coal dashboard data is unavailable");
    state.coalAnalysis = payload;
    const focusSelect = document.getElementById("coal-analysis-focus");
    focusSelect.innerHTML = (payload.focus_options || []).map(option =>
      `<option value="${escapeAttr(option.id)}">${escapeHtml(option.label)}</option>`
    ).join("");
    focusSelect.value = payload.focus || "all";
    renderCoalDashboard(payload);
    document.getElementById("coal-dashboard-csv").href = `/api/coal/dashboard/export?${params}&format=csv`;
    document.getElementById("coal-dashboard-xlsx").href = `/api/coal/dashboard/export?${params}&format=xlsx`;
    document.getElementById("coal-header-status").textContent =
      `${payload.rows.length} ${payload.frequency.replace("_", " ")} observations · official through ${payload.available_range.end}`;
  } catch (error) {
    container.innerHTML = `<div class="coal-dashboard-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderCoalDashboard(payload) {
  const availability = payload.available_range || {};
  const selectedOutside = payload.rows.length === 0;
  document.getElementById("coal-dashboard-availability").innerHTML =
    `<div><strong>${escapeHtml(payload.tab === "trade" ? "Trade data coverage" : "Official data coverage")}</strong>` +
    `<span>${escapeHtml(String(availability.start || "—"))} to ${escapeHtml(String(availability.end || "—"))} · ${escapeHtml(availability.grain || payload.frequency)} · ${escapeHtml(availability.status || "official")}</span></div>` +
    `${availability.limitation ? `<p>${escapeHtml(availability.limitation)}</p>` : ""}` +
    `${selectedOutside ? `<b>No verified rows fall inside the selected range. Filters were not silently ignored.</b>` : ""}`;
  renderCoalActiveFilters(payload);
  document.getElementById("coal-dashboard-kpis").innerHTML = (payload.kpis || []).map(kpi => {
    const numericValue = Number(kpi.value);
    const decimals = Number.isInteger(numericValue) || Math.abs(numericValue) >= 1000 ? 0 : 1;
    const display = kpi.display || (kpi.value === null || kpi.value === undefined ? "—" : formatNumber(kpi.value, decimals));
    const comparison = coalKpiComparison(kpi, payload);
    return `<article><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(String(display))}${kpi.unit ? ` <small>${escapeHtml(kpi.unit)}</small>` : ""}</strong>` +
      `<p>${escapeHtml(kpi.detail || "")}</p>${comparison ? `<b class="coal-kpi-delta ${comparison.direction}">${escapeHtml(comparison.label)}</b>` : ""}</article>`;
  }).join("");

  const container = document.getElementById("coal-dashboard-panels");
  if (payload.tab === "table") {
    container.innerHTML = dashboardTable(payload, true);
    bindCoalTableSearch(container);
    return;
  }
  container.innerHTML = (payload.charts || []).map((chart, index) =>
    `<article class="coal-dashboard-card ${index === 0 ? "coal-dashboard-card-wide" : ""}">` +
    `<header><div><span>${escapeHtml(payload.tab.toUpperCase())}</span><h3>${escapeHtml(chart.title)}</h3><p>${escapeHtml(chart.subtitle || "")}</p></div>` +
    `<small>${escapeHtml(chart.y_label)}</small></header>` +
    `<div class="coal-dashboard-chart" id="coal-dynamic-chart-${index}"></div></article>`
  ).join("") + dashboardTable(payload, false) + dashboardSources(payload);
  (payload.charts || []).forEach((chart, index) => renderDynamicCoalChart(
    `coal-dynamic-chart-${index}`,
    Array.isArray(chart.rows) ? chart.rows : payload.rows,
    chart
  ));
  bindCoalTableSearch(container);
}

function renderCoalActiveFilters(payload) {
  const focus = (payload.focus_options || []).find(option => option.id === payload.focus)?.label || "All measures";
  const compareLabels = { previous_period: "vs previous period", previous_year: "vs previous year", none: "no comparison" };
  const chips = [
    labelize(payload.tab),
    `${formatCoalPeriod(payload.filters.from)} – ${formatCoalPeriod(payload.filters.to)}`,
    labelize(payload.frequency),
    focus,
    compareLabels[payload.comparison] || "no comparison"
  ];
  document.getElementById("coal-active-filters").innerHTML = chips.map((chip, index) =>
    `<span class="${index === 0 ? "primary" : ""}">${escapeHtml(chip)}</span>`
  ).join("");
}

function coalKpiComparison(kpi, payload) {
  if (payload.comparison === "none" || !payload.rows?.length) return null;
  const keyByLabel = {
    "Latest production": "production_mt", "Latest dispatch": "dispatch_mt",
    "Latest imports": "total_coal_mt", "Coking coal": "coking_coal_mt",
    "Non-coking coal": "non_coking_coal_mt", "FY2025-26 imports": "total_imports_mt",
    "Coal generation": "coal_generation_gwh", "Coal share of all generation": "coal_share_pct",
    "Renewables incl. large hydro": "renewables_share_pct", "Solar generation": "solar_generation_gwh",
    "Pit-head closing stock": "closing_stock_mt", "Annual off-take": "offtake_mt", "Annual production": "production_mt"
  };
  const key = keyByLabel[kpi.label];
  if (!key) return null;
  const values = payload.rows.map(row => Number(row[key])).filter(Number.isFinite);
  const lag = payload.comparison === "previous_year"
    ? (payload.frequency === "monthly" ? 12 : payload.frequency === "quarterly" ? 4 : 1)
    : 1;
  if (values.length <= lag) return null;
  const current = values[values.length - 1], prior = values[values.length - 1 - lag];
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  const delta = (current / prior - 1) * 100;
  return { direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat", label: `${delta >= 0 ? "+" : ""}${formatNumber(delta, 1)}% ${payload.comparison === "previous_year" ? "YoY" : "vs prior"}` };
}

function dashboardTable(payload, expanded) {
  const columns = payload.columns || [];
  const rows = payload.rows || [];
  return `<article class="coal-dashboard-card coal-dashboard-card-wide coal-dashboard-table-card ${expanded ? "expanded" : ""}">` +
    `<header><div><span>FILTERED DATA</span><h3>${expanded ? "Data explorer" : "Exact values behind this view"}</h3>` +
    `<p>${rows.length} rows · export uses this exact tab, range, focus and frequency</p></div>` +
    `<label class="coal-table-search"><span>Search rows</span><input type="search" placeholder="Filter visible records…" /></label></header>` +
    `<div class="coal-dashboard-table"><table><thead><tr>${columns.map(column => `<th>${escapeHtml(labelize(column))}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${formatDashboardCell(row[column], column)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></article>`;
}

function bindCoalTableSearch(container) {
  container.querySelectorAll(".coal-table-search input").forEach(input => {
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      const table = input.closest("article").querySelector("tbody");
      table.querySelectorAll("tr").forEach(row => {
        row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
      });
    });
  });
}

function dashboardSources(payload) {
  return `<article class="coal-dashboard-card coal-dashboard-card-wide coal-dashboard-sources"><header><div><span>LINEAGE &amp; QUALITY</span><h3>Official sources</h3></div></header>` +
    `<div>${(payload.sources || []).map(source => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>`).join("")}</div>` +
    `<p>${escapeHtml(payload.quality?.note || "")}</p></article>`;
}

function formatDashboardCell(value, column) {
  if (value === null || value === undefined || value === "") return "<span class=\"coal-null\">—</span>";
  if (typeof value === "number") return escapeHtml(formatNumber(value, column.includes("pct") ? 1 : 2));
  if (column.includes("url")) return `<a href="${escapeAttr(value)}" target="_blank" rel="noopener">Source</a>`;
  return escapeHtml(String(value));
}

function renderDynamicCoalChart(id, rows, chart) {
  const container = document.getElementById(id);
  const series = chart.series || [];
  const chartNumber = value => {
    if (value === null || value === undefined || value === "") return NaN;
    const result = Number(value);
    return Number.isFinite(result) ? result : NaN;
  };
  const validValues = rows.flatMap(row => series.map(item => chartNumber(row[item.key])).filter(Number.isFinite));
  if (!rows.length || !validValues.length) {
    container.innerHTML = `<div class="coal-dashboard-empty">No verified observations for these filters.</div>`;
    return;
  }
  const width = 780, height = 300, pad = { left: 66, right: 22, top: 28, bottom: 62 };
  const minValue = chart.y_label.includes("Change") ? Math.min(0, ...validValues) : 0;
  const stackedTotals = chart.type === "stacked_column"
    ? rows.map(row => series.reduce((sum, item) => {
        const value = chartNumber(row[item.key]);
        return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
      }, 0))
    : [];
  const maxValue = Math.max(...validValues, ...stackedTotals, 1);
  const span = Math.max(maxValue - minValue, 1);
  const x = index => pad.left + (rows.length === 1 ? 0.5 : index / (rows.length - 1)) * (width - pad.left - pad.right);
  const y = value => pad.top + (maxValue - Number(value)) / span * (height - pad.top - pad.bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => minValue + span * index / 4);
  const grid = ticks.map(value => `<line x1="${pad.left}" y1="${y(value)}" x2="${width - pad.right}" y2="${y(value)}"></line><text x="${pad.left - 10}" y="${y(value) + 4}" text-anchor="end">${escapeHtml(formatNumber(value, 0))}</text>`).join("");
  const maxAxisLabels = 8;
  const labelIndexes = rows.length <= maxAxisLabels
    ? new Set(rows.map((_, index) => index))
    : new Set(Array.from({ length: maxAxisLabels }, (_, index) =>
        Math.round(index * (rows.length - 1) / (maxAxisLabels - 1))
      ));
  const labels = rows.map((row, index) => labelIndexes.has(index)
    ? `<text x="${x(index)}" y="${height - 35}" text-anchor="middle">${escapeHtml(String(row.period))}</text>`
    : "").join("");
  const marks = series.map(item => {
    if (chart.type === "stacked_column") {
      const barWidth = Math.max(16, Math.min(72, (width - pad.left - pad.right) / Math.max(rows.length, 1) * 0.55));
      return rows.map((row, index) => {
        const seriesIndex = series.indexOf(item);
        const previous = series.slice(0, seriesIndex).reduce((sum, prior) => {
          const priorValue = chartNumber(row[prior.key]);
          return sum + (Number.isFinite(priorValue) ? Math.max(0, priorValue) : 0);
        }, 0);
        const value = chartNumber(row[item.key]);
        if (!Number.isFinite(value)) return "";
        const top = y(previous + Math.max(0, value));
        const bottom = y(previous);
        return `<rect x="${x(index) - barWidth / 2}" y="${top}" width="${barWidth}" height="${Math.max(0, bottom - top)}" fill="${item.color}"><title>${escapeHtml(`${item.label} · ${row.period}: ${formatNumber(value, 2)} GWh`)}</title></rect>`;
      }).join("");
    }
    if (chart.type === "column") {
      const groupWidth = Math.max(4, (width - pad.left - pad.right) / Math.max(rows.length, 1) * 0.65);
      const barWidth = groupWidth / series.length;
      return rows.map((row, index) => {
        const value = chartNumber(row[item.key]);
        if (!Number.isFinite(value)) return "";
        const seriesIndex = series.indexOf(item);
        const baseline = y(0);
        const top = Math.min(y(value), baseline);
        return `<rect x="${x(index) - groupWidth / 2 + seriesIndex * barWidth}" y="${top}" width="${Math.max(2, barWidth - 1)}" height="${Math.abs(baseline - y(value))}" fill="${item.color}"><title>${escapeHtml(`${item.label} · ${row.period}: ${formatNumber(value, 2)}`)}</title></rect>`;
      }).join("");
    }
    let output = "", segment = [];
    const flush = () => { if (segment.length > 1) output += `<polyline points="${segment.join(" ")}" fill="none" stroke="${item.color}" stroke-width="3"></polyline>`; segment = []; };
    rows.forEach((row, index) => {
      const value = chartNumber(row[item.key]);
      if (!Number.isFinite(value)) { flush(); return; }
      segment.push(`${x(index)},${y(value)}`);
      output += `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="#fff" stroke="${item.color}" stroke-width="2"><title>${escapeHtml(`${item.label} · ${row.period}: ${formatNumber(value, 2)}`)}</title></circle>`;
    });
    flush();
    return output;
  }).join("");
  container.innerHTML = `<div class="coal-chart-legend">${series.map(item => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>` +
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(chart.title)}">${grid}${labels}${marks}` +
    `<text class="axis-title" x="${width / 2}" y="${height - 5}" text-anchor="middle">${escapeHtml(chart.x_label)}</text>` +
    `<text class="axis-title" transform="translate(15 ${height / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(chart.y_label)}</text></svg>`;
}

function selectedCoalAnalysisRows() {
  const rows = state.coalAnalysis?.annual || [];
  const from = document.getElementById("coal-analysis-from").value;
  const to = document.getElementById("coal-analysis-to").value;
  const start = Math.min(rows.findIndex(row => row.period === from), rows.findIndex(row => row.period === to));
  const end = Math.max(rows.findIndex(row => row.period === from), rows.findIndex(row => row.period === to));
  return rows.slice(Math.max(0, start), end + 1);
}

function renderCoalAnalysis() {
  const rows = selectedCoalAnalysisRows();
  if (!rows.length) return;
  const latest = rows[rows.length - 1];
  setText("coal-kpi-production", `${formatNumber(latest.production_mt, 1)} MT`);
  setText("coal-kpi-imports", `${formatNumber(latest.total_imports_mt, 1)} MT`);
  setText("coal-kpi-offtake", `${formatNumber(latest.offtake_mt, 1)} MT`);
  setText("coal-kpi-stock", `${formatNumber(latest.closing_stock_mt, 1)} MT`);
  setText("coal-kpi-dependency", `${formatNumber(latest.import_dependency_pct, 1)}%`);
  setText("coal-kpi-production-change", `${latest.period} · ${signedPercent(latest.production_yoy_pct)} YoY`);
  setText("coal-kpi-imports-change", `${latest.period} · ${signedPercent(latest.imports_yoy_pct)} YoY`);
  setText("coal-kpi-offtake-detail", `${latest.period} · ${formatNumber(latest.offtake_mt / latest.production_mt * 100, 1)}% of production`);
  setText("coal-kpi-stock-detail", `${latest.period} · pit-head closing inventory`);
  setText("coal-kpi-dependency-detail", `${latest.period} · imports ÷ available supply`);
  setCoalKpiBar("coal-kpi-production-bar", latest.production_mt, 1100);
  setCoalKpiBar("coal-kpi-imports-bar", latest.total_imports_mt, 300);
  setCoalKpiBar("coal-kpi-offtake-bar", latest.offtake_mt, 1100);
  setCoalKpiBar("coal-kpi-stock-bar", latest.closing_stock_mt, 130);
  setCoalKpiBar("coal-kpi-dependency-bar", latest.import_dependency_pct, 30);

  renderCoalLineChart("coal-production-imports-chart", rows, [
    ["Production", "production_mt", "#003671"],
    ["Imports", "total_imports_mt", "#db2f34"]
  ], "MT");
  renderCoalLineChart("coal-yoy-chart", rows.slice(1), [
    ["Production YoY", "production_yoy_pct", "#003671"],
    ["Imports YoY", "imports_yoy_pct", "#db2f34"]
  ], "%", true);
  renderCoalLineChart("coal-stock-offtake-chart", rows, [
    ["Off-take", "offtake_mt", "#2e6d92"],
    ["Pit-head stock", "closing_stock_mt", "#d8902f"]
  ], "MT");
  renderCoalImportMix(rows);
  renderCoalFindings(rows);
  renderCoalAnalysisTable(rows);
  applyCoalAnalysisView();
}

function setCoalKpiBar(id, value, maximum) {
  const element = document.getElementById(id);
  if (element) element.style.setProperty("--value", `${Math.min(100, Math.max(2, Number(value || 0) / maximum * 100))}%`);
}

function renderCoalLineChart(id, rows, series, unit, includeZero = false) {
  const container = document.getElementById(id);
  if (!container || rows.length < 2) {
    if (container) container.innerHTML = `<div class="coal-empty">At least two periods are required.</div>`;
    return;
  }
  const width = 720;
  const height = 250;
  const pad = { left: 52, right: 18, top: 18, bottom: 42 };
  const values = rows.flatMap(row => series.map(item => Number(row[item[1]])).filter(Number.isFinite));
  let min = includeZero ? Math.min(0, ...values) : 0;
  let max = Math.max(...values, 1);
  if (includeZero) {
    const span = Math.max(max - min, 1);
    min -= span * 0.08;
    max += span * 0.08;
  } else {
    max *= 1.08;
  }
  const x = index => pad.left + index / (rows.length - 1) * (width - pad.left - pad.right);
  const y = value => pad.top + (max - Number(value)) / (max - min) * (height - pad.top - pad.bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4);
  const grid = ticks.map(value =>
    `<line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}" stroke="#e6eaed"></line>` +
    `<text x="${pad.left - 8}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${formatNumber(value, unit === "%" ? 0 : 0)}</text>`
  ).join("");
  const xLabels = rows.map((row, index) =>
    `<text x="${x(index).toFixed(1)}" y="${height - 17}" text-anchor="middle">${escapeHtml(row.period.slice(2))}</text>`
  ).join("");
  const lines = series.map(item => {
    const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row[item[1]]).toFixed(1)}`).join(" ");
    const marks = rows.map((row, index) =>
      `<circle class="coal-chart-point" cx="${x(index).toFixed(1)}" cy="${y(row[item[1]]).toFixed(1)}" r="4" fill="#fff" stroke="${item[2]}" stroke-width="2.3">` +
      `<title>${escapeHtml(`${item[0]} · ${row.period}: ${formatNumber(row[item[1]], 1)} ${unit}`)}</title></circle>`
    ).join("");
    return `<polyline points="${points}" fill="none" stroke="${item[2]}" stroke-width="3"></polyline>${marks}`;
  }).join("");
  container.innerHTML =
    `<div class="coal-chart-legend">${series.map(item => `<span><i style="background:${item[2]}"></i>${escapeHtml(item[0])}</span>`).join("")}</div>` +
    `<svg viewBox="0 0 ${width} ${height}" role="img">${grid}${includeZero && min < 0 ? `<line x1="${pad.left}" y1="${y(0)}" x2="${width - pad.right}" y2="${y(0)}" stroke="#7f8991" stroke-width="1.3"></line>` : ""}${xLabels}${lines}</svg>`;
}

function renderCoalImportMix(rows) {
  const container = document.getElementById("coal-import-mix-chart");
  const max = Math.max(...rows.map(row => Number(row.total_imports_mt || 0)), 1);
  container.innerHTML = `<div class="coal-chart-legend"><span><i style="background:#8c2e3d"></i>Coking</span><span><i style="background:#d8902f"></i>Non-coking</span></div>` +
    `<div class="coal-stacked-bars">${rows.map(row => {
      const coking = Number(row.coking_imports_mt || 0);
      const nonCoking = Number(row.non_coking_imports_mt || 0);
      return `<div class="coal-stacked-row"><span>${escapeHtml(row.period)}</span><div title="${escapeAttr(`${row.period}: ${formatNumber(coking, 1)} MT coking; ${formatNumber(nonCoking, 1)} MT non-coking`)}"><i style="width:${coking / max * 100}%;background:#8c2e3d"></i><i style="width:${nonCoking / max * 100}%;background:#d8902f"></i></div><strong>${formatNumber(row.total_imports_mt, 1)}</strong></div>`;
    }).join("")}</div>`;
}

function renderCoalFindings(rows) {
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const productionChange = latest.production_mt - first.production_mt;
  const importsChange = latest.total_imports_mt - first.total_imports_mt;
  const dependencyChange = latest.import_dependency_pct - first.import_dependency_pct;
  const pairs = rows.filter(row => Number.isFinite(row.production_mt) && Number.isFinite(row.total_imports_mt));
  const corr = pearson(
    pairs.map(row => row.production_mt),
    pairs.map(row => row.total_imports_mt)
  );
  document.getElementById("coal-analysis-findings").innerHTML = [
    ["Production change", `${signedNumber(productionChange)} MT`, `${first.period} to ${latest.period}`],
    ["Import change", `${signedNumber(importsChange)} MT`, `${first.period} to ${latest.period}`],
    ["Import-dependency change", `${signedNumber(dependencyChange)} pp`, `${formatNumber(first.import_dependency_pct, 1)}% to ${formatNumber(latest.import_dependency_pct, 1)}%`],
    ["Production/import correlation", Number.isFinite(corr) ? corr.toFixed(2) : "n/a", `${pairs.length} aligned financial years`]
  ].map(item => `<div><span>${escapeHtml(item[0])}</span><strong>${escapeHtml(item[1])}</strong><small>${escapeHtml(item[2])}</small></div>`).join("") +
    `<p>Correlation describes co-movement only. Pit-head closing stock is not the same as power-station stock-cover days.</p>`;
}

function renderCoalAnalysisTable(rows) {
  document.getElementById("coal-analysis-table").innerHTML =
    `<table><thead><tr><th>FY</th><th>Production MT</th><th>Imports MT</th><th>Off-take MT</th><th>Stock MT</th><th>Import dependency</th></tr></thead><tbody>` +
    rows.map(row => `<tr><td><strong>${escapeHtml(row.period)}</strong></td><td>${formatNumber(row.production_mt, 1)}</td><td>${formatNumber(row.total_imports_mt, 1)}</td><td>${formatNumber(row.offtake_mt, 1)}</td><td>${formatNumber(row.closing_stock_mt, 1)}</td><td>${formatNumber(row.import_dependency_pct, 1)}%</td></tr>`).join("") +
    `</tbody></table>`;
}

function applyCoalAnalysisView() {
  document.querySelectorAll("[data-analysis-panel]").forEach(panel => {
    panel.hidden = false;
  });
}

function pearson(left, right) {
  if (left.length < 3 || left.length !== right.length) return NaN;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const leftSq = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightSq = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  return numerator / Math.sqrt(leftSq * rightSq);
}

function signedPercent(value) {
  return `${Number(value) >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function signedNumber(value) {
  return `${Number(value) >= 0 ? "+" : ""}${formatNumber(value, 1)}`;
}

async function loadCoalMasterCatalog() {
  if (state.coalMaster) return state.coalMaster;
  const response = await fetch("/api/coal/master");
  if (!response.ok) throw new Error("Official coal master could not be loaded");
  state.coalMaster = await response.json();
  return state.coalMaster;
}

function renderCoalMasterOverview(summaryMaster) {
  const master = state.coalMaster || null;
  const coverage = master?.coverage || summaryMaster || {};
  const generatedAt = master?.generated_at || summaryMaster?.generated_at;
  setText("coal-kpi-sources", Number(coverage.source_file_count || summaryMaster?.source_file_count || 0).toLocaleString());
  setText("coal-kpi-files", Number(coverage.extracted_file_count || summaryMaster?.extracted_file_count || 0).toLocaleString());
  setText("coal-kpi-rows", Number(coverage.normalized_row_count || summaryMaster?.normalized_row_count || 0).toLocaleString());
  setText("coal-kpi-tables", Number((master?.source_tables || []).length || summaryMaster?.source_table_count || 0).toLocaleString());
  setText("coal-kpi-fetched", generatedAt ? humanDate(generatedAt) : "-");

  const coverageBox = document.getElementById("coal-master-coverage");
  if (coverageBox) {
    coverageBox.innerHTML = [
      ["Country", coverage.country || "India"],
      ["Requested period", coverage.years_requested || "FY2016-17 to latest official"],
      ["Extract mode", coverage.current_extract_mode || "Official source-backed"],
      ["Quality status", labelize(master?.quality?.status || summaryMaster?.status || "source catalogued")]
    ].map(([label, value]) =>
      `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    ).join("");
  }

  if (!master) {
    loadCoalMasterCatalog()
      .then(payload => {
        state.coalMaster = payload;
        renderCoalMasterOverview(summaryMaster);
      })
      .catch(error => {
        const catalog = document.getElementById("coal-source-catalog");
        if (catalog) catalog.innerHTML = `<div class="coal-empty">${escapeHtml(error.message)}</div>`;
      });
    return;
  }

  renderCoalDatasetMix(master.source_tables || []);
  renderCoalSourceCatalog(master.source_tables || []);
}

function renderCoalDatasetMix(tables) {
  const container = document.getElementById("coal-dataset-mix");
  if (!container) return;
  const grouped = {};
  tables.forEach(item => {
    const key = item.dataset_type || "source_reference";
    grouped[key] = (grouped[key] || 0) + Number(item.rows || 0);
  });
  const rows = Object.entries(grouped)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  if (!rows.length) {
    container.innerHTML = `<div class="coal-empty">Run the official coal fetcher to populate source-backed tables.</div>`;
    return;
  }
  const max = Math.max(...rows.map(([, value]) => value), 1);
  container.innerHTML = rows.map(([key, value]) =>
    `<div class="coal-master-bar"><div><span>${escapeHtml(labelize(key))}</span><strong>${Number(value).toLocaleString()} rows</strong></div>` +
    `<div><i style="width:${Math.max(1, value / max * 100)}%"></i></div></div>`
  ).join("");
}

function renderCoalSourceCatalog(tables) {
  const container = document.getElementById("coal-source-catalog");
  if (!container) return;
  if (!tables.length) {
    container.innerHTML = `<div class="coal-empty">No official source tables have been extracted yet.</div>`;
    return;
  }
  const rows = tables.slice(0, 12);
  container.innerHTML =
    `<table><thead><tr><th>Dataset</th><th>Sheet</th><th>Rows</th></tr></thead><tbody>` +
    rows.map(item =>
      `<tr><td><strong>${escapeHtml(item.source_title || "Official source")}</strong><small>${escapeHtml(labelize(item.dataset_type || "source_reference"))}</small></td>` +
      `<td>${escapeHtml(item.sheet_name || "-")}</td><td>${Number(item.rows || 0).toLocaleString()}</td></tr>`
    ).join("") +
    `</tbody></table>${tables.length > rows.length ? `<p class="table-limit">Showing ${rows.length} of ${tables.length} official source tables. Download the catalog for the full list.</p>` : ""}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function refreshCoalActionState() {
  const available = new Set(state.coalSummary?.available_dataset_types || []);
  ["production", "imports", "power_use", "renewables"].forEach(item => available.add(item));
  const selected = document.getElementById("coal-metric").value;
  document.getElementById("coal-export").disabled = !available.has(selected);
  document.getElementById("coal-run-analysis").disabled = false;
}

function selectedCoalKinds() {
  return new Set(
    Array.from(document.querySelectorAll("#coal-workspace-layers input:checked, #coal-consumer-layers input:checked"))
      .map(input => input.value)
  );
}

function renderCoalLayers() {
  state.coalLayer.clearLayers();
  if (state.mode !== "coal" || state.coalView !== "map") {
    updateMapStatus();
    return;
  }
  const selected = selectedCoalKinds();
  const renderer = L.canvas({ padding: 0.5 });
  state.coalAssets.forEach(point => {
    if (!selected.has(point.asset_kind)) return;
    const config = COAL_ASSET_CONFIG[point.asset_kind];
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (!config || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const marker = L.circleMarker([lat, lon], {
      renderer,
      radius: config.radius,
      color: "#ffffff",
      weight: 0.55,
      fillColor: config.color,
      fillOpacity: 0.9
    });
    marker.bindTooltip(assetTooltip(config, point), {
      className: "asset-tooltip", direction: "top", opacity: 1
    });
    marker.on("click", () => showAssetCard(config, point));
    marker.addTo(state.coalLayer);
  });
  state.coalLayer._pointCount = state.coalLayer.getLayers().length;
  renderCoalAssetViews();
  updateMapStatus();
}

function setCoalView(view) {
  state.coalView = view;
  document.querySelectorAll("[data-coal-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.coalView === view);
  });
  const dataSurface = document.getElementById("coal-data-surface");
  const nppSurface = document.getElementById("npp-power-surface");
  const mapElement = document.getElementById("map");
  const isAnalytics = view === "analytics";
  const isMap = view === "map";
  const isPower = view === "power";
  dataSurface.hidden = isMap || isPower || state.mode !== "coal";
  nppSurface.hidden = !isPower || state.mode !== "coal";
  mapElement.hidden = !isMap && state.mode === "coal";
  document.querySelector(".map-topbar").hidden = !isMap && state.mode === "coal";
  document.querySelector(".map-key").hidden = !isMap && state.mode === "coal";
  document.getElementById("coal-assets-table").hidden = view !== "table";
  document.getElementById("coal-assets-cards").hidden = view !== "cards";
  document.querySelector(".coal-surface-heading").hidden = isAnalytics;
  if (isAnalytics && !dataSurface.hidden) dataSurface.scrollTop = 0;
  document.getElementById("coal-surface-title").textContent =
    view === "cards" ? "India coal asset cards" : "India coal asset table";
  if (isPower && state.mode === "coal") loadNppPower();
  if (isMap) {
    setTimeout(() => {
      state.map.invalidateSize();
      state.map.fitBounds([[6, 68], [37, 98]], { padding: [25, 25] });
      renderCoalLayers();
    }, 0);
  } else {
    state.coalLayer.clearLayers();
    renderCoalAssetViews();
  }
}

function filteredCoalAssets() {
  const selected = selectedCoalKinds();
  return state.coalAssets.filter(item => selected.has(item.asset_kind));
}

function renderCoalAssetViews() {
  const rows = filteredCoalAssets();
  const table = document.getElementById("coal-assets-table");
  const cards = document.getElementById("coal-assets-cards");
  const visibleRows = rows.slice(0, 1000);
  const cardRows = rows
    .filter(item => !["coal_mines", "iron_ore_mines"].includes(item.asset_kind))
    .sort((left, right) =>
    Number(right.asset_kind === "coal_trade_terminals") -
    Number(left.asset_kind === "coal_trade_terminals")
  );
  table.innerHTML = visibleRows.length
    ? `<table><thead><tr><th>Asset</th><th>Type</th><th>Status / role</th><th>Capacity</th><th>Source</th></tr></thead><tbody>` +
      visibleRows.map(item => `<tr><td><strong>${escapeHtml(item.name || "Unnamed")}</strong><small>${escapeHtml(item.country || "India")}</small></td>` +
        `<td>${escapeHtml(item.asset_label || labelize(item.asset_kind))}</td>` +
        `<td>${escapeHtml(item.status || item.asset_type || "Unknown")}${item.project_status && item.project_status !== item.status ? `<small>${escapeHtml(item.project_status)}</small>` : ""}</td>` +
        `<td>${item.capacity == null ? "Unknown" : escapeHtml(Number(item.capacity).toLocaleString() + " " + (item.capacity_unit || ""))}${item.expansion_capacity == null ? "" : `<small>Expansion +${escapeHtml(Number(item.expansion_capacity).toLocaleString() + " " + (item.capacity_unit || "Mtpa"))}</small>`}</td>` +
        `<td>${escapeHtml(item.source_text || "GEM / WPI")}</td></tr>`).join("") +
      `</tbody></table>${rows.length > visibleRows.length ? `<p class="table-limit">Showing first ${visibleRows.length.toLocaleString()} of ${rows.length.toLocaleString()} assets.</p>` : ""}`
    : `<div class="coal-empty">Select at least one verified map layer.</div>`;
  cards.innerHTML = cardRows.length
    ? cardRows.slice(0, 120).map(item => `<article class="${item.port_specification_available ? "coal-port-card" : ""}"><span>${escapeHtml(item.asset_label || labelize(item.asset_kind))}</span>` +
        `<h3>${escapeHtml(item.name || "Unnamed asset")}</h3>` +
        `<p>${escapeHtml(item.status || item.asset_type || "Status unknown")}</p>` +
        `<small>${item.capacity == null ? "Capacity unknown" : escapeHtml(Number(item.capacity).toLocaleString() + " " + (item.capacity_unit || ""))}${item.expansion_capacity == null ? "" : `<br>Expansion +${escapeHtml(Number(item.expansion_capacity).toLocaleString() + " " + (item.capacity_unit || "Mtpa"))}`}</small>` +
        (item.port_specification_available
          ? `<button type="button" class="coal-card-action" data-port-spec-id="${escapeAttr(item.id)}">View port details</button>`
          : item.asset_kind === "power_consumers"
            ? `<button type="button" class="coal-card-action" data-plant-spec-id="${escapeAttr(item.id)}">View plant details</button>`
          : "") +
        `</article>`).join("")
    : `<div class="coal-empty">Mine assets are available in map and table views. Select a terminal or consuming-industry layer to use card view.</div>`;
  cards.querySelectorAll("[data-port-spec-id]").forEach(button => {
    button.addEventListener("click", () => {
      const asset = state.coalAssets.find(item => item.id === button.dataset.portSpecId);
      if (asset) showCoalPortDetails(asset);
    });
  });
  cards.querySelectorAll("[data-plant-spec-id]").forEach(button => {
    button.addEventListener("click", () => {
      const asset = state.coalAssets.find(item => item.id === button.dataset.plantSpecId);
      if (asset) showAssetCard(COAL_ASSET_CONFIG.power_consumers, asset);
    });
  });
}

async function uploadCoalDataset() {
  const input = document.getElementById("coal-upload-input");
  const file = input.files?.[0];
  if (!file) return;
  const message = document.getElementById("coal-upload-message");
  const datasetType = document.getElementById("coal-metric").value;
  const form = new FormData();
  form.append("file", file);
  message.textContent = `Uploading ${file.name}…`;
  try {
    const response = await fetch(`/api/coal/upload?dataset_type=${encodeURIComponent(datasetType)}`, {
      method: "POST", body: form
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Upload failed");
    message.textContent = `${payload.dataset_label}: ${Number(payload.rows).toLocaleString()} rows uploaded. Quality status: ${labelize(payload.quality_status)}.`;
    await loadCoalWorkspace();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    input.value = "";
  }
}

async function runCoalResearch() {
  const input = document.getElementById("coal-research-question");
  const message = document.getElementById("coal-research-message");
  const question = input.value.trim();
  if (question.length < 4) {
    message.textContent = "Write a specific question first.";
    input.focus();
    return;
  }
  const button = document.getElementById("coal-research-run");
  button.disabled = true;
  message.textContent = "Matching your question to official datasets…";
  try {
    const response = await fetch("/api/coal/research/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Analysis failed");
    state.coalResearch = payload;
    renderCoalResearch(payload);
    message.textContent = `${payload.rows.length} official observations returned. Ctrl+Enter runs another question.`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderCoalResearch(payload) {
  const panel = document.getElementById("coal-research-result");
  panel.hidden = false;
  setText("coal-research-title", payload.title);
  setText("coal-research-status", payload.status.toUpperCase());
  setText("coal-research-unit", payload.unit);
  setText("coal-research-answer", payload.answer);
  renderCoalResearchChart(payload);
  const columns = payload.columns || [];
  const rows = (payload.rows || []).slice(0, 20);
  document.getElementById("coal-research-table").innerHTML =
    `<table><thead><tr>${columns.map(column => `<th>${escapeHtml(labelize(column))}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(row => `<tr>${columns.map(column => `<td>${formatResearchValue(row[column])}</td>`).join("")}</tr>`).join("") +
    `</tbody></table>${payload.rows.length > rows.length ? `<p class="table-limit">Top ${rows.length} shown; the download contains the complete filtered result.</p>` : ""}`;
  document.getElementById("coal-research-sources").innerHTML =
    `<small>${escapeHtml(payload.guardrail)}</small>` +
    payload.sources.map(source => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>`).join("");
  const encoded = encodeURIComponent(payload.question);
  document.getElementById("coal-research-csv").href = `/api/coal/research/export?format=csv&q=${encoded}`;
  document.getElementById("coal-research-xlsx").href = `/api/coal/research/export?format=xlsx&q=${encoded}`;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatResearchValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return escapeHtml(formatNumber(value, Math.abs(value) < 100 ? 2 : 1));
  return escapeHtml(String(value));
}

function renderCoalResearchChart(payload) {
  const container = document.getElementById("coal-research-chart");
  const rows = payload.rows || [];
  const series = payload.chart?.series || [];
  const category = payload.chart?.category || "period";
  if (!rows.length || !series.length) {
    container.innerHTML = `<div class="coal-empty">No chartable observations.</div>`;
    return;
  }
  if (payload.chart.type !== "bar") {
    renderCoalLineChart(container.id, rows, series.map(item => [item.label, item.key, item.color]), payload.unit.includes("%") ? "%" : payload.unit);
    return;
  }
  const chartRows = rows.slice(0, 15);
  const max = Math.max(...chartRows.flatMap(row => series.map(item => Number(row[item.key] || 0))), 1);
  container.innerHTML = `<div class="coal-chart-legend">${series.map(item => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>` +
    `<div class="coal-research-bars">${chartRows.map(row =>
      `<div><span title="${escapeAttr(String(row[category] || ""))}">${escapeHtml(String(row[category] || ""))}</span><section>${series.map(item => `<i style="width:${Math.max(1, Number(row[item.key] || 0) / max * 100)}%;background:${item.color}" title="${escapeAttr(`${item.label}: ${formatNumber(row[item.key], 2)} ${payload.unit}`)}"></i>`).join("")}</section><strong>${formatNumber(row[series[0].key], 2)}</strong></div>`
    ).join("")}</div>`;
}

async function exportCoalData() {
  const datasetType = document.getElementById("coal-metric").value;
  const frequency = document.getElementById("coal-frequency").value;
  const coalType = document.getElementById("coal-grade").value;
  const period = document.getElementById("coal-period").value;
  const params = new URLSearchParams({ dataset_type: datasetType, frequency, coal_type: coalType, period });
  const response = await fetch(`/api/coal/export?${params}`);
  if (!response.ok) {
    const payload = await response.json();
    document.getElementById("coal-upload-message").textContent = payload.detail || "Export failed";
    return;
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `india_coal_${datasetType}_${frequency}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadNppPower(force = false) {
  const refreshButton = document.getElementById("npp-refresh");
  const freshness = document.getElementById("npp-freshness");
  refreshButton.disabled = true;
  freshness.textContent = force ? "Refreshing from official NPP source…" : "Loading latest validated NPP snapshot…";
  try {
    const response = await fetch(`/api/npp/power-dashboard${force ? "?force=true" : ""}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "NPP data is unavailable");
    document.getElementById("npp-installed-capacity").textContent =
      `${formatNumber(data.installed_capacity_mw / 1000, 1)} GW`;
    document.getElementById("npp-reported-date").textContent =
      `NPP source date ${humanDate(data.source_reported_date)}`;
    const demand = data.daily_demand?.[0];
    document.getElementById("npp-demand-met").textContent = demand
      ? `${formatNumber(demand.demand_met_mw / 1000, 1)} GW`
      : "Unavailable";
    document.getElementById("npp-demand-date").textContent = demand
      ? `Reported ${escapeHtml(demand.date || "")}`
      : "No daily-demand row supplied";
    const status = data.all_india_status || {};
    renderNppBars("npp-status-chart", [
      { label: "Online", value: status.online_capacity_mw, color: "#2c8a63" },
      { label: "Under maintenance", value: status.under_maintenance_capacity_mw, color: "#e9a823" },
      { label: "Shutdown", value: status.shutdown_capacity_mw, color: "#db2f34" },
      { label: "Unscheduled", value: status.unscheduled_capacity_mw, color: "#8b65b6" }
    ], "MW");
    const categoryColors = ["#6f7782", "#296fba", "#8b65b6", "#629c4d"];
    renderNppBars(
      "npp-category-chart",
      (data.category_capacity || []).map((item, index) => ({
        label: item.label, value: item.mw, color: categoryColors[index] || "#003671"
      })),
      "MW"
    );
    const sectorColors = ["#003671", "#55a6c8", "#db2f34"];
    renderNppBars(
      "npp-sector-chart",
      (data.sector_capacity || []).map((item, index) => ({
        label: item.label, value: item.mw, color: sectorColors[index] || "#003671"
      })),
      "MW"
    );
    renderNppBars("npp-demand-chart", demand ? [
      { label: "Peak requirement", value: demand.peak_requirement_mw, color: "#1c294a" },
      { label: "Demand met", value: demand.demand_met_mw, color: "#2c8a63" },
      { label: "Reported deficit", value: Math.abs(demand.deficit_mw), color: "#db2f34" }
    ] : [], "MW");
    const generation = data.daily_generation || {};
    renderNppBars("npp-daily-generation-chart", generation.date ? [
      { label: `Actual · ${humanDate(generation.date)}`, value: generation.actual_mu, color: "#2c8a63" },
      { label: "Programme", value: generation.program_mu, color: "#003671" },
      { label: `Prior year · ${humanDate(generation.prior_year_date)}`, value: generation.prior_year_actual_mu, color: "#8b65b6" }
    ] : [], "MU", 1);
    document.getElementById("npp-generation-period").textContent = generation.date
      ? `${humanDate(generation.date)} · ${formatNumber(generation.deviation_percent, 1)}% vs programme`
      : "Official daily-generation row unavailable";
    const stock = data.coal_stock_availability || {};
    const stockColors = { "Non-pithead stations": "#db2f34", "Pithead stations": "#e9a823" };
    renderNppBars(
      "npp-coal-stock-chart",
      (stock.rows || []).map(row => ({
        label: `${row.stock_cover_band} · ${row.station_type}`,
        value: row.station_count,
        color: stockColors[row.station_type] || "#6f7782"
      })),
      "stations"
    );
    document.getElementById("npp-coal-stock-period").textContent = stock.date
      ? `As on ${humanDate(stock.date)} · counts by stock-cover band`
      : "Official coal-stock row unavailable";
    const cumulative = data.cumulative_generation || {};
    renderNppBars("npp-cumulative-generation-chart", cumulative.period_end ? [
      { label: `${humanDate(cumulative.period_start)} – ${humanDate(cumulative.period_end)}`, value: cumulative.actual_mu, color: "#2c8a63" },
      { label: "Programme for current period", value: cumulative.program_mu, color: "#003671" },
      { label: `${humanDate(cumulative.prior_period_start)} – ${humanDate(cumulative.prior_period_end)}`, value: cumulative.prior_year_actual_mu, color: "#8b65b6" }
    ] : [], "MU", 1);
    document.getElementById("npp-cumulative-period").textContent = cumulative.period_end
      ? `${formatNumber(cumulative.deviation_percent, 1)}% vs programme`
      : "Official cumulative-generation row unavailable";
    const thermalPlf = data.sector_plf?.thermal_current;
    const nuclearPlf = data.sector_plf?.nuclear_current;
    const plfRows = thermalPlf ? [
      { label: "Thermal · All India", value: thermalPlf.all_india_percent, color: "#db2f34" },
      { label: "Thermal · Central", value: thermalPlf.central_percent, color: "#003671" },
      { label: "Thermal · State", value: thermalPlf.state_percent, color: "#55a6c8" },
      { label: "Thermal · Private", value: thermalPlf.private_percent, color: "#e9a823" }
    ] : [];
    if (nuclearPlf) {
      plfRows.push(
        { label: "Nuclear · All India", value: nuclearPlf.all_india_percent, color: "#8b65b6" },
        { label: "Nuclear · Central", value: nuclearPlf.central_percent, color: "#66508d" }
      );
    }
    renderNppBars("npp-sector-plf-chart", plfRows, "%", 1);
    document.getElementById("npp-plf-period").textContent = thermalPlf
      ? `${thermalPlf.category} ${thermalPlf.report_type || ""} · FY ${thermalPlf.financial_year || "unavailable"}`
      : "Official PLF row unavailable";
    renderNppHistory(data.historical_installed_capacity || []);
    const fetchedAt = data.fetched_at ? new Date(data.fetched_at).toLocaleString() : "unknown";
    freshness.textContent = data.stale
      ? `Showing last validated cache · refresh failed · fetched ${fetchedAt}`
      : `Validated from NPP · fetched ${fetchedAt} · auto-refresh every ${formatRefreshInterval(data.refresh_interval_seconds || 43200)}`;
    freshness.classList.toggle("stale", Boolean(data.stale));
    document.getElementById("npp-quality-note").textContent =
      "Category and sector totals reconcile to the NPP installed-capacity headline. Shutdown and unscheduled values are supporting status measures and are not added to the capacity total.";
    state.nppLoaded = true;
    if (!state.nppRefreshTimer) {
      state.nppRefreshTimer = setInterval(
        () => loadNppPower(false),
        Math.max(60, Number(data.refresh_interval_seconds || 43200)) * 1000
      );
    }
  } catch (error) {
    freshness.textContent = error.message;
    freshness.classList.add("stale");
    document.getElementById("npp-quality-note").textContent =
      "No unvalidated fallback values are displayed. Retry when the official NPP source is available.";
  } finally {
    refreshButton.disabled = false;
  }
}

function renderNppBars(id, rows, unit, digits = 0) {
  const container = document.getElementById(id);
  if (!rows.length) {
    container.innerHTML = `<div class="coal-empty">Official source row unavailable.</div>`;
    return;
  }
  const max = Math.max(...rows.map(row => Number(row.value || 0)), 1);
  container.innerHTML = rows.map(row =>
    `<div class="npp-bar-row"><div><span>${escapeHtml(row.label)}</span><strong>${formatNumber(row.value, digits)} ${escapeHtml(unit)}</strong></div>` +
    `<div class="npp-bar-track"><i style="width:${Math.max(0.5, Number(row.value || 0) / max * 100)}%;background:${escapeAttr(row.color)}"></i></div></div>`
  ).join("");
}

function renderNppHistory(rows) {
  const container = document.getElementById("npp-history-chart");
  if (rows.length < 2) {
    container.innerHTML = `<div class="coal-empty">Historical installed-capacity series unavailable.</div>`;
    return;
  }
  const width = 920;
  const height = 270;
  const pad = { left: 56, right: 16, top: 16, bottom: 42 };
  const series = [
    ["Thermal", "thermal_mw", "#6f7782", ""],
    ["Hydro", "hydro_mw", "#296fba", "7 3"],
    ["Nuclear", "nuclear_mw", "#8b65b6", "2 3"],
    ["Renewables", "renewables_mw", "#629c4d", "10 3 2 3"]
  ];
  const max = Math.max(...rows.flatMap(row => series.map(item => Number(row[item[1]] || 0))), 1);
  const x = index => pad.left + index / (rows.length - 1) * (width - pad.left - pad.right);
  const y = value => height - pad.bottom - Number(value || 0) / max * (height - pad.top - pad.bottom);
  const yTicks = [0, max / 2, max];
  const grid = yTicks.map(value =>
    `<line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}" stroke="#e4e8eb"></line>` +
    `<text x="${pad.left - 8}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#6c7883">${formatNumber(value / 1000, 0)}</text>`
  ).join("");
  const tickCount = Math.min(7, rows.length);
  const tickIndexes = [...new Set(Array.from({ length: tickCount }, (_, index) =>
    Math.round(index * (rows.length - 1) / Math.max(tickCount - 1, 1))
  ))];
  const xTicks = tickIndexes.map(index => {
    const year = rows[index].date?.slice(0, 4) || "";
    return `<line x1="${x(index).toFixed(1)}" y1="${height - pad.bottom}" x2="${x(index).toFixed(1)}" y2="${height - pad.bottom + 5}" stroke="#aeb8c0"></line>` +
      `<text x="${x(index).toFixed(1)}" y="${height - 18}" text-anchor="middle" font-size="10" fill="#6c7883">${escapeHtml(year)}</text>`;
  }).join("");
  const polylines = series.map(item => {
    const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row[item[1]]).toFixed(1)}`).join(" ");
    const circles = rows.map((row, index) =>
      `<circle class="npp-history-point" cx="${x(index).toFixed(1)}" cy="${y(row[item[1]]).toFixed(1)}" r="3.2" fill="#fff" stroke="${item[2]}" stroke-width="2" tabindex="0" role="img" aria-label="${escapeAttr(`${item[0]}, ${row.date}, ${formatNumber(row[item[1]], 0)} MW`)}" data-series="${escapeAttr(item[0])}" data-date="${escapeAttr(row.date || "")}" data-value="${Number(row[item[1]] || 0)}"></circle>`
    ).join("");
    return `<polyline points="${points}" fill="none" stroke="${item[2]}" stroke-width="2.5" stroke-dasharray="${item[3]}" vector-effect="non-scaling-stroke"></polyline>${circles}`;
  }).join("");
  container.innerHTML =
    `<div class="npp-history-legend">${series.map(item => `<span><i style="background:${item[2]}"></i>${item[0]}</span>`).join("")}<span>Y-axis: GW</span></div>` +
    `<div class="npp-history-plot">` +
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical growth of installed capacity">` +
    grid + xTicks + polylines +
    `</svg><div class="npp-history-tooltip" hidden><strong></strong><span></span></div></div>`;
  const plot = container.querySelector(".npp-history-plot");
  const tooltip = container.querySelector(".npp-history-tooltip");
  const showTooltip = (point, event) => {
    const value = Number(point.dataset.value || 0);
    tooltip.querySelector("strong").textContent =
      `${point.dataset.series} · ${humanDate(point.dataset.date)}`;
    tooltip.querySelector("span").textContent =
      `${formatNumber(value / 1000, 1)} GW · ${formatNumber(value, 0)} MW`;
    tooltip.hidden = false;
    const bounds = plot.getBoundingClientRect();
    const pointBounds = point.getBoundingClientRect();
    const px = event?.clientX ?? pointBounds.left + pointBounds.width / 2;
    const py = event?.clientY ?? pointBounds.top;
    tooltip.style.left = `${Math.min(bounds.width - 75, Math.max(75, px - bounds.left))}px`;
    tooltip.style.top = `${Math.max(55, py - bounds.top)}px`;
  };
  container.querySelectorAll(".npp-history-point").forEach(point => {
    point.addEventListener("mouseenter", event => showTooltip(point, event));
    point.addEventListener("mousemove", event => showTooltip(point, event));
    point.addEventListener("mouseleave", () => { tooltip.hidden = true; });
    point.addEventListener("focus", () => showTooltip(point));
    point.addEventListener("blur", () => { tooltip.hidden = true; });
  });
}

function formatRefreshInterval(seconds) {
  const hours = Number(seconds || 0) / 3600;
  return hours >= 1
    ? `${formatNumber(hours, Number.isInteger(hours) ? 0 : 1)} hr`
    : `${formatNumber(Number(seconds || 0) / 60, 0)} min`;
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function humanDate(value) {
  if (!value) return "unavailable";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function populateSelect(id, defaultLabel, items) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${defaultLabel}</option>` +
    items.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)} (${Number(item.count).toLocaleString()})</option>`).join("");
  select.value = current;
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
    if (!state.routePortCatalog.length) {
      state.routePortCatalog = [...state.ports].sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || "")) ||
        String(left.country || "").localeCompare(String(right.country || ""))
      );
      populateRoutePortSearch();
    }
    renderPorts();
  } catch (error) {
    setStatus(error.message);
  } finally {
    setLoading(false);
  }
}

function portDisplayTier(port) {
  const size = String(port.harbor_size || "").toLowerCase();
  const capacity = Number(port.terminal_capacity_mtpa || 0);
  const largeVessel = String(port.max_vessel || "").toLowerCase().includes("over 500");
  if (size === "large" || capacity >= 20 || largeVessel) return 1;
  if (size === "medium" || capacity >= 5 || port.specialist_terminal) return 2;
  if (size === "small") return 3;
  return 4;
}

function portVisibleAtZoom(port, zoom) {
  const tier = portDisplayTier(port);
  if (zoom <= 3) return tier === 1;
  if (zoom === 4) return tier <= 2;
  if (zoom === 5) return tier <= 3;
  return true;
}

function renderPorts() {
  state.portLayer.clearLayers();
  state.renderedPortCount = 0;
  if (!portsAllowedForMode()) {
    document.getElementById("port-visible-count").textContent = state.mode === "ports" ? "hidden" : "overlay off";
    updateMapStatus();
    return;
  }
  const renderer = L.canvas({ padding: 0.5 });
  const zoom = state.map.getZoom();
  const visiblePorts = state.filteredPorts.filter(port =>
    portVisibleAtZoom(port, zoom)
  );
  visiblePorts.forEach(port => {
    const lat = Number(port.lat);
    const lon = Number(port.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const tier = portDisplayTier(port);
    const marker = L.circleMarker([lat, lon], {
      renderer,
      radius: tier === 1 ? 3.2 : tier === 2 ? 2.7 : 2.25,
      color: "#ffffff",
      weight: tier === 1 ? 0.9 : 0.5,
      fillColor: portColor(port.categories),
      fillOpacity: tier === 1 ? 0.94 : 0.82
    });
    marker.bindTooltip(portTooltip(port), { className: "port-tooltip", direction: "top", opacity: 1 });
    marker.on("click", () => handlePortClick(port));
    marker.addTo(state.portLayer);
  });
  state.renderedPortCount = visiblePorts.length;
  const visibilityLabel = zoom <= 3
    ? "major"
    : zoom === 4
      ? "major + regional"
      : zoom === 5
        ? "expanded"
        : "all";
  document.getElementById("port-visible-count").textContent =
    `${visiblePorts.length.toLocaleString()} ${visibilityLabel}`;
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

function layerUrl(id) {
  const mode = LAYER_CONFIG[id].mode;
  const prefix = mode === "energy" ? "energy" : "commodity";
  const filters = {
    country: document.getElementById(`${prefix}-country`).value,
    status: document.getElementById(`${prefix}-status`).value
  };
  const params = new URLSearchParams({ limit: "150000" });
  if (filters.country) params.set("country", filters.country);
  if (filters.status) params.set("status", filters.status);
  return `/api/map/${encodeURIComponent(id)}?${params}`;
}

function layerCacheKey(id) {
  const role = id === "coal_trade_terminals"
    ? document.getElementById("coal-terminal-role").value
    : id === "iron_ore_terminals"
      ? document.getElementById("iron-terminal-role").value
      : "";
  return `${layerUrl(id)}|${role}`;
}

async function applyWorkspaceFilters(mode) {
  const prefix = mode === "energy" ? "energy" : "commodity";
  state.filters[mode] = {
    country: document.getElementById(`${prefix}-country`).value,
    status: document.getElementById(`${prefix}-status`).value
  };
  WORKSPACE_LAYERS[mode].forEach(id => {
    state.layerEpoch.set(id, (state.layerEpoch.get(id) || 0) + 1);
    const layer = state.assetLayers.get(id);
    if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    state.assetLayers.delete(id);
  });
  const checked = WORKSPACE_LAYERS[mode]
    .map(id => workspaceInput(mode, id))
    .filter(input => input?.checked);
  for (const input of checked) await toggleAssetLayer(input);
  updateMapStatus();
}

async function toggleAssetLayer(input) {
  const id = input.value;
  const config = LAYER_CONFIG[id];
  const layer = state.assetLayers.get(id);
  if (!input.checked || config.mode !== state.mode) {
    if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    updateActiveCounts();
    updateMapStatus();
    return;
  }
  setLoading(true, `Loading ${config.label.toLowerCase()}…`);
  try {
    const epoch = state.layerEpoch.get(id) || 0;
    const cacheKey = layerCacheKey(id);
    let points = state.assetCache.get(cacheKey);
    if (!points) {
      const response = await fetch(layerUrl(id));
      if (!response.ok) throw new Error(`Could not load ${config.label}`);
      points = await response.json();
      if (id === "coal_trade_terminals" || id === "iron_ore_terminals") {
        const role = document.getElementById(
          id === "coal_trade_terminals" ? "coal-terminal-role" : "iron-terminal-role"
        ).value;
        if (role) points = points.filter(point => String(point.asset_type || "").includes(role));
      }
      state.assetCache.set(cacheKey, points);
    }
    if (
      epoch !== (state.layerEpoch.get(id) || 0) ||
      !input.checked ||
      config.mode !== state.mode ||
      cacheKey !== layerCacheKey(id)
    ) return;
    let currentLayer = state.assetLayers.get(id);
    if (!currentLayer) {
      currentLayer = buildAssetLayer(id, points);
      currentLayer._pointCount = points.length;
      state.assetLayers.set(id, currentLayer);
    }
    currentLayer.addTo(state.map);
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
      radius: config.mode === "commodities" ? Math.max(config.radius, 4.5) : config.radius,
      color: "#ffffff",
      weight: config.mode === "commodities" ? 1 : 0.45,
      fillColor: config.color,
      fillOpacity: 0.88,
      interactive: true,
      bubblingMouseEvents: false
    });
    marker.bindTooltip(assetTooltip(config, point), {
      className: "asset-tooltip",
      direction: "top",
      opacity: 1,
      sticky: true
    });
    marker.on("mouseover", () => {
      marker.setStyle({ weight: 2, fillOpacity: 1 });
      marker.openTooltip();
    });
    marker.on("mouseout", () => {
      marker.setStyle({ weight: config.mode === "commodities" ? 1 : 0.45, fillOpacity: 0.88 });
    });
    marker.on("click", () => showAssetCard(config, point));
    marker.addTo(group);
  });
  return group;
}

function assetTooltip(config, point) {
  const displayedCapacity = point.plant_capacity ?? point.capacity;
  const capacity = displayedCapacity == null ? "" :
    `<br>${Number(displayedCapacity).toLocaleString()} ${escapeHtml(point.capacity_unit || "MW")}`;
  const units = point.unit_count == null ? "" :
    `<br>${Number(point.unit_count).toLocaleString()} unit${Number(point.unit_count) === 1 ? "" : "s"}`;
  const expansion = point.expansion_capacity == null ? "" :
    `<br>Expansion: +${Number(point.expansion_capacity).toLocaleString()} ${escapeHtml(point.capacity_unit || "Mtpa")} (${escapeHtml((point.expansion_status || []).join(" + "))})`;
  const role = point.asset_type ? `<br>${escapeHtml(point.asset_type)}` : "";
  return `<strong>${escapeHtml(point.name || config.label)}</strong>` +
    `${escapeHtml(point.country || "")}${point.status ? " · " + escapeHtml(point.status) : ""}${role}${capacity}${units}${expansion}`;
}

function handlePortClick(port) {
  const voyageActive = document.querySelector(".voyage-section").open;
  if (!state.routeMode && !voyageActive) {
    showPortCard(port);
    return;
  }
  if (!state.routeMode) {
    state.routeMode = true;
    state.routePickIndex = 0;
  }
  state.routePorts[state.routePickIndex] = port;
  state.routePickIndex += 1;
  updateRouteSelection();
  if (state.routePickIndex >= 2) {
    state.routeMode = false;
    state.routePickIndex = 0;
    document.getElementById("route-pick").classList.remove("active");
    document.getElementById("route-pick").textContent = "Select two ports on map";
    renderPorts();
    calculateRoute();
  }
}

function routePortLabel(port) {
  return `${port.name}${port.country ? " · " + port.country : ""}`;
}

function populateRoutePortSearch() {
  document.getElementById("route-port-options").innerHTML = state.routePortCatalog.flatMap(port => [
    `<option value="${escapeAttr(routePortLabel(port))}"></option>`,
    ...(port.search_aliases || []).map(alias =>
      `<option value="${escapeAttr(alias)}">${escapeHtml(port.name)} · ${escapeHtml(port.country || "")}</option>`
    )
  ]).join("");
}

function normalizedPortQuery(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function routePortFromQuery(query) {
  const normalized = normalizedPortQuery(query);
  if (!normalized) return null;
  const exactLabel = state.routePortCatalog.find(port =>
    normalizedPortQuery(routePortLabel(port)) === normalized
  );
  if (exactLabel) return exactLabel;
  const exactName = state.routePortCatalog.find(port =>
    normalizedPortQuery(port.name) === normalized
  );
  if (exactName) return exactName;
  const exactAliasMatches = state.routePortCatalog.filter(port =>
    (port.search_aliases || []).some(alias =>
      normalizedPortQuery(alias) === normalized
    )
  );
  if (exactAliasMatches.length) {
    return exactAliasMatches.find(port => port.specialist_terminal)
      || exactAliasMatches[0];
  }
  return state.routePortCatalog.find(port =>
    normalizedPortQuery(port.name).startsWith(normalized)
  ) || state.routePortCatalog.find(port =>
    normalizedPortQuery(routePortLabel(port)).includes(normalized)
  ) || state.routePortCatalog.find(port =>
    (port.search_aliases || []).some(alias =>
      normalizedPortQuery(alias).includes(normalized)
    )
  ) || null;
}

function selectRoutePortFromInput(index, input) {
  const query = input.value.trim();
  if (!query) {
    clearRoutePort(index);
    return;
  }
  const port = routePortFromQuery(query);
  if (!port) {
    delete state.routePorts[index];
    state.routeLayer.clearLayers();
    document.getElementById(index === 0 ? "route-from-name" : "route-to-name").textContent =
      index === 0 ? "Select origin" : "Select destination";
    document.getElementById("route-result").textContent =
      "No matching port found. Continue typing or choose a port from the suggestions.";
    input.setCustomValidity("No matching port found. Choose a port from the suggestions.");
    input.reportValidity();
    return;
  }
  input.setCustomValidity("");
  selectRoutePort(index, port.id);
}

function clearRoutePort(index) {
  delete state.routePorts[index];
  state.routeLayer.clearLayers();
  updateRouteSelection();
  renderPorts();
  document.getElementById("route-result").textContent =
    "Type both port names or select them directly on the map.";
}

function selectRoutePort(index, portId) {
  const port = state.routePortCatalog.find(item => String(item.id) === String(portId));
  if (port) state.routePorts[index] = port;
  else delete state.routePorts[index];
  state.routeMode = false;
  document.getElementById("route-pick").classList.remove("active");
  document.getElementById("route-pick").textContent = "Select two ports on map";
  updateRouteSelection();
  renderPorts();
  if (state.routePorts[0] && state.routePorts[1]) calculateRoute();
  else {
    state.routeLayer.clearLayers();
    document.getElementById("route-result").textContent =
      "Choose both ports or select them directly on the map.";
  }
}

function startRoutePicking() {
  state.routeMode = true;
  state.routePickIndex = 0;
  renderPorts();
  closePortCard();
  const button = document.getElementById("route-pick");
  button.classList.add("active");
  button.textContent = "Click origin port…";
  document.getElementById("route-result").textContent = "Click a port dot for the origin, then another for the destination.";
}

function updateRouteSelection() {
  const from = state.routePorts[0];
  const to = state.routePorts[1];
  const fromInput = document.getElementById("route-from-input");
  const toInput = document.getElementById("route-to-input");
  fromInput.value = from ? routePortLabel(from) : "";
  toInput.value = to ? routePortLabel(to) : "";
  fromInput.setCustomValidity("");
  toInput.setCustomValidity("");
  document.getElementById("route-from-name").textContent = from ? from.name : "Select origin";
  document.getElementById("route-to-name").textContent = to ? to.name : "Select destination";
  const button = document.getElementById("route-pick");
  if (state.routeMode) {
    button.textContent = state.routePickIndex === 0
      ? "Click origin port…"
      : "Click destination port…";
  }
}

function resetRoute(clearText = true) {
  state.routeLayer.clearLayers();
  state.routePorts = [];
  state.routeMode = false;
  state.routePickIndex = 0;
  const button = document.getElementById("route-pick");
  button.classList.remove("active");
  button.textContent = "Select two ports on map";
  updateRouteSelection();
  renderPorts();
  if (clearText) document.getElementById("route-result").textContent = "Click the button, then choose two port dots.";
}

function formatVoyageHours(value) {
  const hours = Math.max(0, Math.round(Number(value || 0)));
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

async function calculateRoute() {
  if (!state.routePorts[0] || !state.routePorts[1]) return;
  const [from, to] = state.routePorts;
  const speed = Number(document.getElementById("route-speed").value) || 12;
  const seaMargin = Number(document.getElementById("route-sea-margin").value) || 0;
  const portHours = Number(document.getElementById("route-port-hours").value) || 0;
  const canalHours = Number(document.getElementById("route-canal-hours").value) || 0;
  const avoid = Array.from(
    document.querySelectorAll(".route-restrictions input:checked")
  ).map(input => input.value);
  const result = document.getElementById("route-result");
  result.textContent = "Calculating sea route…";
  try {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_lon: from.lon, from_lat: from.lat, to_lon: to.lon, to_lat: to.lat,
        from_port_id: String(from.id), to_port_id: String(to.id),
        speed_knots: speed, sea_margin_pct: seaMargin,
        port_time_hours: portHours, canal_delay_hours: canalHours,
        avoid,
        from_name: from.name, to_name: to.name
      })
    });
    const route = await response.json();
    if (!response.ok) throw new Error(route.detail || "Route calculation failed");
    const coordinates = (route.coordinates || []).map(item => [item[1], item[0]]);
    state.routeLayer.clearLayers();
    if (coordinates.length) {
      L.polyline(coordinates, { color: "#db2f34", weight: 3.2, opacity: 0.92 }).addTo(state.routeLayer);
      L.circleMarker(coordinates[0], { radius: 6, color: "#fff", weight: 2, fillColor: "#003671", fillOpacity: 1 }).addTo(state.routeLayer);
      L.circleMarker(coordinates[coordinates.length - 1], { radius: 6, color: "#fff", weight: 2, fillColor: "#db2f34", fillOpacity: 1 }).addTo(state.routeLayer);
      (route.route_ports || []).forEach((port, index) => {
        const marker = L.circleMarker([Number(port.lat), Number(port.lon)], {
          radius: 3,
          color: "#1c294a",
          weight: 0.8,
          opacity: 0.28,
          fillColor: "#ffffff",
          fillOpacity: 0.2
        }).addTo(state.routeLayer);
        marker.bindTooltip(
          escapeHtml(port.name || "Route port"),
          {
            className: "route-port-label",
            permanent: true,
            direction: index % 2 ? "bottom" : "top",
            offset: [0, index % 2 ? 5 : -5],
            opacity: 1
          }
        );
        marker.bindPopup(
          `<strong>${escapeHtml(port.name || "Route port")}</strong>` +
          `<br>${escapeHtml(port.country || "")}` +
          `<br>${formatNumber(port.distance_from_route_nm, 0)} nm from calculated track`
        );
      });
      state.map.fitBounds(coordinates, { padding: [50, 50] });
    }
    const nm = route.distance_nm != null ? route.distance_nm : route.distance_km / 1.852;
    const confidence = String(route.route_confidence || "estimated").toLowerCase();
    const confidenceLabel = route.routing_profile === "verified-approach-dense-corridor"
      ? "verified approaches"
      : `${confidence} confidence`;
    const alternate = route.alternate_cape_nm
      ? `<div><span>Alternative avoiding Suez</span><b>${formatNumber(route.alternate_cape_nm, 0)} nm · ${formatVoyageHours(Number(route.alternate_cape_days) * 24)}</b></div>`
      : "";
    const routePorts = (route.route_ports || []).length
      ? `<p class="route-port-summary"><b>Ports along the way</b><br>` +
        `${(route.route_ports || []).map(port =>
          `${escapeHtml(port.name || "Port")} (${formatNumber(port.distance_from_route_nm, 0)} nm)`
        ).join(" · ")}</p>`
      : "";
    result.innerHTML =
      `<div class="route-result-head"><div><span>Routed distance</span><strong>${formatNumber(nm, 0)} nm</strong></div>` +
      `<em class="route-confidence ${escapeAttr(confidence)}">${escapeHtml(confidenceLabel)}</em></div>` +
      `<div class="route-result-grid">` +
      `<div><span>Calm-sea time</span><b>${formatVoyageHours(route.calm_sea_hours)}</b></div>` +
      `<div><span>Total elapsed</span><b>${formatVoyageHours(route.total_duration_hours)}</b></div>` +
      `${alternate}</div>` +
      `<p><b>${escapeHtml(route.via ? "Via " + route.via : "Open-sea network route")}</b><br>` +
      `${formatNumber(speed, 1)} kn + ${formatNumber(route.sea_margin_pct, 1)}% sea margin` +
      `${Number(route.port_time_hours) ? ` + ${formatNumber(route.port_time_hours, 0)} hr port time` : ""}` +
      `${Number(route.canal_delay_hours) ? ` + ${formatNumber(route.canal_delay_hours, 0)} hr canal delay` : ""}</p>` +
      routePorts +
      `<small>${escapeHtml(route.coordinate_source || "Selected port coordinates")} · ` +
      `${Number(route.waypoint_count || 0).toLocaleString()} route points · analytical estimate, not for navigation.</small>`;
  } catch (error) {
    result.textContent = error.message;
  }
}

async function showPortCard(port) {
  const response = await fetch("/api/ports/" + encodeURIComponent(port.id));
  const detail = response.ok ? await response.json() : port;
  const card = document.getElementById("port-card");
  card.classList.remove("port-spec-card");
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">Port</span><h2>${escapeHtml(detail.name)}</h2>` +
    `<p class="detail-meta">${escapeHtml(detail.country || "Country unknown")}${detail.unlocode ? " · " + escapeHtml(detail.unlocode) : ""}</p>` +
    `<div class="detail-grid">` +
    detailCell("Harbor size", detail.harbor_size) + detailCell("Harbor type", detail.harbor_type) +
    detailCell("Channel depth", detail.channel_depth) + detailCell("Cargo pier", detail.cargo_depth) +
    detailCell("Anchorage", detail.anchorage_depth) + detailCell("Max vessel", detail.max_vessel) +
    `</div><p class="detail-note">Berth count is unknown in the current source. Unknown values are not treated as zero.</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

function showAssetCard(config, point) {
  if (point.asset_kind === "coal_trade_terminals" && point.port_specification_available) {
    showCoalPortDetails(point);
    return;
  }
  if (
    point.asset_kind === "power_consumers" ||
    point.gem_location_id ||
    String(config.label || "").toLowerCase() === "coal plant"
  ) {
    showCoalPlantCard(config, point);
    return;
  }
  const card = document.getElementById("port-card");
  card.classList.remove("port-spec-card");
  const sourceLink = point.source_url
    ? `<a class="detail-source-link" href="${escapeAttr(point.source_url)}" target="_blank" rel="noopener">Open source</a>`
    : "";
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">${escapeHtml(config.label)}</span><h2>${escapeHtml(point.name || config.label)}</h2>` +
    `<p class="detail-meta">${escapeHtml(point.country || "Country unknown")}</p>` +
    `<div class="detail-grid">` +
    detailCell("Status", point.status) +
    detailCell("Capacity", point.capacity == null ? "Unknown" : Number(point.capacity).toLocaleString() + " " + (point.capacity_unit || "MW")) +
    detailCell("Trade role", point.asset_type) +
    detailCell("Parent port", point.parent_port) +
    detailCell("Project status", point.project_status) +
    detailCell(
      "Expansion",
      point.expansion_capacity == null
        ? null
        : `+${Number(point.expansion_capacity).toLocaleString()} ${point.capacity_unit || "Mtpa"} · ${(point.expansion_status || []).join(" + ")}`
    ) +
    detailCell(
      "Potential capacity",
      point.potential_capacity == null
        ? null
        : `${Number(point.potential_capacity).toLocaleString()} ${point.capacity_unit || "Mtpa"}`
    ) +
    detailCell("Product", point.product_type) +
    detailCell("Supply source", point.source_text) +
    detailCell("Evidence", point.evidence_level) +
    detailCell("Source review", point.source_date) +
    `</div>${sourceLink}<p class="detail-note">${escapeHtml(point.coverage_note || "Source: Global Energy Monitor workbook layer.")}</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

function presentPlantValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text && !["nan", "null", "unknown"].includes(text.toLowerCase())
    ? text
    : null;
}

function finitePlantNumber(value) {
  return presentPlantValue(value) == null ? Number.NaN : Number(value);
}

function optionalDetailCell(label, value) {
  const displayed = presentPlantValue(value);
  return displayed ? detailCell(label, displayed) : "";
}

function plantCommissioning(point) {
  const start = Number(point.commissioning_start_year || point.unit_start_year);
  const end = Number(point.commissioning_end_year || point.unit_start_year);
  if (!Number.isFinite(start)) return null;
  return Number.isFinite(end) && end !== start ? `${start}–${end}` : String(start);
}

function showCoalPlantCard(config, point) {
  const card = document.getElementById("port-card");
  card.classList.remove("port-spec-card");
  const capacity = finitePlantNumber(point.plant_capacity ?? point.capacity);
  const unitCapacity = finitePlantNumber(point.capacity);
  const unitCount = finitePlantNumber(point.unit_count);
  const location = [
    presentPlantValue(point.location),
    presentPlantValue(point.district),
    presentPlantValue(point.state)
  ].filter(Boolean).join(" · ");
  const unitSummary = Number.isFinite(unitCount)
    ? `${unitCount.toLocaleString()} unit${unitCount === 1 ? "" : "s"}`
      + (Number.isFinite(unitCapacity) ? ` · selected unit ${unitCapacity.toLocaleString()} MW` : "")
    : presentPlantValue(point.unit);
  const factor = finitePlantNumber(point.capacity_factor);
  const co2 = finitePlantNumber(point.annual_co2_mtpa);
  const ceaSummary = point.cea_verified
    ? `${point.cea_unit_count} × ${Number(point.cea_capacity_mw / point.cea_unit_count).toLocaleString()} MW · commissioned ${point.cea_commissioning}`
    : null;
  const sourceLinks = [
    point.source_url
      ? `<a class="detail-source-link" href="${escapeAttr(point.source_url)}" target="_blank" rel="noopener">GEM plant record</a>`
      : "",
    point.cea_source_url
      ? `<a class="detail-source-link" href="${escapeAttr(point.cea_source_url)}" target="_blank" rel="noopener">CEA station register</a>`
      : "",
    point.npp_source_url
      ? `<a class="detail-source-link" href="${escapeAttr(point.npp_source_url)}" target="_blank" rel="noopener">NPP current reports</a>`
      : "",
    point.ministry_coal_source_url
      ? `<a class="detail-source-link" href="${escapeAttr(point.ministry_coal_source_url)}" target="_blank" rel="noopener">Coal-linkage records</a>`
      : ""
  ].filter(Boolean).join("");
  document.getElementById("port-card-content").innerHTML =
    `<span class="detail-eyebrow">${escapeHtml(config.label || "Coal-fired power plant")}</span>` +
    `<h2>${escapeHtml(point.name || "Coal-fired power plant")}</h2>` +
    `<p class="detail-meta">${escapeHtml(point.country || "Country unknown")}${point.state ? " · " + escapeHtml(point.state) : ""}</p>` +
    `<div class="detail-grid">` +
    optionalDetailCell("Status", point.status) +
    optionalDetailCell(
      "Plant capacity",
      Number.isFinite(capacity) ? `${capacity.toLocaleString()} MW` : null
    ) +
    optionalDetailCell("Unit configuration", unitSummary) +
    optionalDetailCell("Commissioned", plantCommissioning(point)) +
    optionalDetailCell("Owner", point.owner) +
    optionalDetailCell("Parent company", point.parent_company) +
    optionalDetailCell("Technology", point.combustion_technology) +
    optionalDetailCell("Coal type", point.coal_type) +
    optionalDetailCell("Coal source", point.coal_source) +
    optionalDetailCell("Captive industry use", point.captive_use) +
    optionalDetailCell("Location", location) +
    optionalDetailCell("Location accuracy", point.location_accuracy) +
    optionalDetailCell(
      "Capacity factor",
      Number.isFinite(factor) ? `${formatNumber(factor * 100, 1)}%` : null
    ) +
    optionalDetailCell(
      "Annual CO₂",
      Number.isFinite(co2) ? `${formatNumber(co2, 2)} Mt/year` : null
    ) +
    optionalDetailCell("CEA verification", ceaSummary) +
    optionalDetailCell(
      "CEA organisation / sector",
      point.cea_verified ? `${point.cea_organisation} · ${point.cea_sector}` : null
    ) +
    optionalDetailCell("Environmental permits", point.permits) +
    `</div>` +
    (sourceLinks ? `<div class="detail-source-links">${sourceLinks}</div>` : "") +
    `<p class="detail-note">${escapeHtml(
      point.cea_verified
        ? `CEA station details verified against the register dated ${point.cea_source_as_of}. Other technical, ownership and coal-supply fields are from the GEM plant record.`
        : point.coverage_note || "Plant attributes are from the Global Energy Monitor coal plant tracker."
    )}</p>`;
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
}

async function showCoalPortDetails(point) {
  const card = document.getElementById("port-card");
  const content = document.getElementById("port-card-content");
  card.classList.add("port-spec-card", "open");
  card.setAttribute("aria-hidden", "false");
  content.innerHTML =
    `<span class="detail-eyebrow">India coal port</span>` +
    `<h2>${escapeHtml(point.name || "Port")}</h2>` +
    `<p class="detail-meta">Loading consolidated port specifications…</p>`;
  try {
    const response = await fetch(
      `/api/coal/port-specifications/${encodeURIComponent(point.id)}`
    );
    const detail = await response.json();
    if (!response.ok) throw new Error(detail.detail || "Port specifications are unavailable");
    const draft = detail.max_documented_draft_m == null
      ? "Not published"
      : `${formatNumber(detail.max_documented_draft_m, 1)} m`;
    const berthCount = detail.documented_berth_count == null
      ? "Not published"
      : formatNumber(detail.documented_berth_count, 0);
    const dryBulkCount = detail.documented_dry_bulk_berth_count == null
      ? "Not classified"
      : formatNumber(detail.documented_dry_bulk_berth_count, 0);
    const portCapacity = detail.port_capacity_mtpa == null
      ? "Not published"
      : `${formatNumber(detail.port_capacity_mtpa, 1)} MTPA`;
    const traffic = detail.latest_traffic_mt == null
      ? "Not available"
      : `${formatNumber(detail.latest_traffic_mt, 3)} MT`;
    const facilityRows = (detail.dry_bulk_facilities?.length
      ? detail.dry_bulk_facilities
      : detail.berth_facilities || []).slice(0, 14);
    const commodities = (detail.dry_bulk_commodities || []).slice(0, 8);
    const commodityFlows = (detail.commodity_flows || []).slice(0, 16);
    const sources = detail.sources || [];
    const lat = Number(detail.latitude);
    const lon = Number(detail.longitude);
    const satelliteViews = Number.isFinite(lat) && Number.isFinite(lon)
      ? (detail.satellite_context?.views || []).map(view =>
          `<figure><img loading="lazy" alt="${escapeAttr(`${view.label} satellite view of ${detail.asset_name}`)}" src="${escapeAttr(satelliteImageUrl(lat, lon, Number(view.span_degrees)))}">` +
          `<figcaption>${escapeHtml(view.label)}</figcaption></figure>`
        ).join("")
      : `<div class="coal-empty">Coordinates unavailable for satellite context.</div>`;
    content.innerHTML =
      `<span class="detail-eyebrow">India coal port</span>` +
      `<h2>${escapeHtml(detail.asset_name)}</h2>` +
      `<p class="detail-meta">${escapeHtml(detail.official_port_name || "Official port match unavailable")} · ${escapeHtml(detail.state_ut || "India")} · ${escapeHtml(detail.port_class || "Port class unavailable")}</p>` +
      `<div class="detail-grid port-spec-grid">` +
      detailCell("Max documented draft", draft) +
      detailCell("Documented berths", berthCount) +
      detailCell("Dry-bulk facilities", dryBulkCount) +
      detailCell("Port capacity", portCapacity) +
      detailCell("Latest port traffic", traffic) +
      detailCell("Traffic period", detail.latest_traffic_period) +
      detailCell("Terminal operating capacity", detail.terminal_operating_capacity_mtpa == null ? null : `${formatNumber(detail.terminal_operating_capacity_mtpa, 1)} MTPA`) +
      detailCell("Terminal expansion", detail.terminal_expansion_capacity_mtpa == null ? null : `+${formatNumber(detail.terminal_expansion_capacity_mtpa, 1)} MTPA`) +
      `</div>` +
      (detail.specification_note ? `<p class="port-spec-note">${escapeHtml(detail.specification_note)}</p>` : "") +
      `<section class="port-spec-section"><h3>Satellite context</h3><div class="satellite-grid">${satelliteViews}</div>` +
      `<small>Imagery: <a href="${escapeAttr(detail.satellite_context?.attribution_url || "https://www.arcgis.com/")}" target="_blank" rel="noopener noreferrer">Esri World Imagery</a>. Images provide geographic context and are not navigational charts.</small></section>` +
      `<section class="port-spec-section"><h3>Berths and terminal facilities</h3>` +
      (facilityRows.length
        ? `<ul class="facility-list">${facilityRows.map(item =>
            `<li><strong>${escapeHtml(item.name || "Documented facility")}</strong>` +
            `<span>${escapeHtml(formatFacilityPrimaryLine(item))}</span>` +
            (formatFacilitySecondaryLine(item)
              ? `<small>${escapeHtml(formatFacilitySecondaryLine(item))}</small>`
              : "") +
            (item.draft_conditions
              ? `<em>${escapeHtml(item.draft_conditions)}</em>`
              : "") +
            `</li>`
          ).join("")}</ul>`
        : `<div class="coal-empty">No berth-level specification was safely flattenable from the supplied workbook or current official source.</div>`) +
      (detail.berth_facilities?.length > facilityRows.length
        ? `<p class="port-spec-more">Showing ${facilityRows.length} dry-bulk-relevant records from ${detail.berth_facilities.length} documented berth/facility rows.</p>`
        : "") +
      `</section>` +
      (commodityFlows.length
        ? `<section class="port-spec-section"><h3>Coal flows by direction</h3><div class="commodity-chips">${commodityFlows.map(item =>
            `<span><strong>${escapeHtml(labelize(item.trade_direction || "reported flow"))}</strong>` +
            `${escapeHtml(labelize(item.commodity || "coal"))} · ${formatNumber(item.quantity_mt, 3)} MT · ${escapeHtml(item.period || "")}</span>`
          ).join("")}</div></section>`
        : "") +
      (commodities.length
        ? `<section class="port-spec-section"><h3>Latest documented dry-bulk flows</h3><div class="commodity-chips">${commodities.map(item =>
            `<span><strong>${escapeHtml(item.commodity)}</strong>${formatNumber(item.total_mt, 3)} MT · FY ${escapeHtml(item.fy || "")}</span>`
          ).join("")}</div></section>`
        : "") +
      `<section class="port-spec-section"><h3>Sources and verification</h3>` +
      (detail.official_website
        ? `<a class="official-port-link" href="${escapeAttr(detail.official_website)}" target="_blank" rel="noopener noreferrer">Open official port website ↗</a>`
        : "") +
      `<a class="official-port-link secondary" href="/api/coal/port-specifications/export">Download consolidated CSV</a>` +
      `<ul class="source-list">${sources.map(source =>
        `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>` +
        `<span>${escapeHtml(source.scope || "")}${source.as_of ? ` · ${escapeHtml(String(source.as_of))}` : ""}</span></li>`
      ).join("")}</ul></section>` +
      `<p class="detail-note">${escapeHtml(detail.data_caveat || "Confirm current marine restrictions with the port or vessel agent.")}</p>`;
  } catch (error) {
    content.innerHTML =
      `<span class="detail-eyebrow">India coal port</span><h2>${escapeHtml(point.name || "Port")}</h2>` +
      `<p class="detail-note">${escapeHtml(error.message)}</p>`;
  }
}

function formatFacilityPrimaryLine(item) {
  const type = labelize(item.facility_type || "facility");
  const role = item.import_export_role && item.import_export_role !== "unknown"
    ? ` · ${labelize(item.import_export_role)}`
    : "";
  let draft = "Draft not published";
  if (item.draft_m != null) {
    if (item.facility_type === "anchorage") {
      draft = `${formatNumber(item.draft_m, 1)} m anchorage figure`;
    } else if (item.draft_type && item.draft_type !== "unknown") {
      draft = `${formatNumber(item.draft_m, 1)} m ${labelize(item.draft_type)} draft`;
    } else {
      draft = `${formatNumber(item.draft_m, 1)} m documented figure`;
    }
  }
  return `${type}${role} · ${draft} · as of ${item.as_of || "source date unavailable"}`;
}

function formatFacilitySecondaryLine(item) {
  const facts = [];
  if (item.quay_length_m != null) facts.push(`${formatNumber(item.quay_length_m, 0)} m quay`);
  if (item.max_dwt != null) facts.push(`${formatNumber(item.max_dwt, 0)} DWT`);
  if (item.annual_capacity_mtpa != null) facts.push(`${formatNumber(item.annual_capacity_mtpa, 1)} MTPA`);
  if (item.loading_rate_tph != null) facts.push(`${formatNumber(item.loading_rate_tph, 0)} TPH loading`);
  if (item.unloading_rate_tph != null) facts.push(`${formatNumber(item.unloading_rate_tph, 0)} TPH unloading`);
  if (item.handling_system) facts.push(item.handling_system);
  return facts.join(" · ");
}

function satelliteImageUrl(lat, lon, span) {
  const latitudeSpan = span * 0.7;
  const params = new URLSearchParams({
    bbox: `${lon - span},${lat - latitudeSpan},${lon + span},${lat + latitudeSpan}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: "520,260",
    format: "jpg",
    f: "image"
  });
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params}`;
}

function closePortCard() {
  const card = document.getElementById("port-card");
  card.classList.remove("open");
  card.classList.remove("port-spec-card");
  card.classList.remove("weather-detail-card");
  card.setAttribute("aria-hidden", "true");
}

function detailCell(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Unknown")}</strong></div>`;
}

function updateActiveCounts() {
  const energy = WORKSPACE_LAYERS.energy.filter(
    id => workspaceInput("energy", id)?.checked
  ).length;
  const commodities = WORKSPACE_LAYERS.commodities.filter(
    id => workspaceInput("commodities", id)?.checked
  ).length;
  document.getElementById("energy-active-count").textContent = `${energy} active`;
  document.getElementById("commodity-active-count").textContent = `${commodities} active`;
}

function updateMapStatus() {
  const ports = portsAllowedForMode() ? state.renderedPortCount : 0;
  let assets = 0;
  state.assetLayers.forEach(layer => {
    if (state.map.hasLayer(layer)) assets += Number(layer._pointCount || 0);
  });
  if (state.mode === "coal" && state.map.hasLayer(state.coalLayer)) {
    assets += Number(state.coalLayer._pointCount || 0);
  }
  const parts = [];
  if (ports) parts.push(`${ports.toLocaleString()} ports`);
  if (assets) parts.push(`${assets.toLocaleString()} assets`);
  if (state.aisEnabled && state.aisVessels.length) {
    parts.push(`${displayedAisVessels().length.toLocaleString()} AIS vessels`);
  }
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
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
