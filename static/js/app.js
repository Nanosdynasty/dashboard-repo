/* GEM Dashboard v3.2 — All vessels by default; IMO filter only when searching */
const state={tracker:"coal_plants",offset:0,limit:100,total:0,map:null,markers:null,vesselLayer:null,routeLayer:null,seaLabels:null,ports:[],portByName:{},routeClicks:[],aisSocket:null,imoFilter:new Set(),shipMeta:{},vesselMarkers:new Map(),vesselTrails:new Map()};
const ENERGY=["coal_plants","coal_terminals","solar","wind","hydro","nuclear"];
const STATUS_COLORS={operating:"#65BD8B",construction:"#FE4F2D",announced:"#4A57A8","pre-permit":"#4A57A8",permitted:"#4A57A8",proposed:"#4A57A8",shelved:"#7F142A",cancelled:"#7F142A",mothballed:"#8a9aa3",retired:"#8a9aa3"};
const ALL_STATUSES=["operating","construction","announced","pre-permit","permitted","proposed","shelved","cancelled","mothballed","retired"];
const SEA_LABELS=[{name:"Mediterranean Sea",lat:35,lon:18},{name:"Red Sea",lat:20,lon:38},{name:"Persian Gulf",lat:26.5,lon:52},{name:"Arabian Sea",lat:15,lon:65},{name:"Bay of Bengal",lat:15,lon:88},{name:"South China Sea",lat:12,lon:115},{name:"East China Sea",lat:28,lon:125},{name:"Yellow Sea",lat:35,lon:124},{name:"Sea of Japan",lat:40,lon:135},{name:"North Sea",lat:56,lon:3},{name:"Baltic Sea",lat:58,lon:20},{name:"Black Sea",lat:43,lon:34},{name:"Caribbean Sea",lat:15,lon:-75},{name:"Gulf of Mexico",lat:25,lon:-90},{name:"North Atlantic",lat:35,lon:-40},{name:"South Atlantic",lat:-25,lon:-15},{name:"Indian Ocean",lat:-20,lon:80},{name:"North Pacific",lat:40,lon:170},{name:"South Pacific",lat:-25,lon:-140},{name:"Southern Ocean",lat:-60,lon:0},{name:"Arctic Ocean",lat:75,lon:0},{name:"Suez Canal",lat:30.5,lon:32.4},{name:"Panama Canal",lat:9.1,lon:-79.7},{name:"Strait of Hormuz",lat:26.5,lon:56.5},{name:"Strait of Malacca",lat:2.5,lon:101.5},{name:"Bab el-Mandeb",lat:12.6,lon:43.3},{name:"Cape of Good Hope",lat:-34.3,lon:18.4},{name:"Cape Horn",lat:-55.9,lon:-67.3},{name:"English Channel",lat:50.2,lon:-1},{name:"Gulf of Aden",lat:12.5,lon:48},{name:"Singapore Strait",lat:1.2,lon:103.8},{name:"Taiwan Strait",lat:24,lon:119},{name:"Bosporus",lat:41.1,lon:29.1},{name:"Gibraltar",lat:36,lon:-5.5}];

document.addEventListener("DOMContentLoaded",()=>{initMap();initStatusDD();initNavGroups();loadTrackers();loadPorts();bindUI();switchView("map");loadData();
  const saved=localStorage.getItem("ais_key");if(saved){document.getElementById("ais-key").value=saved;}
});

function initMap(){
  state.map=L.map("map",{worldCopyJump:true}).setView([20,10],2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"OSM CARTO",maxZoom:18}).addTo(state.map);
  state.markers=L.layerGroup().addTo(state.map);
  state.vesselLayer=L.layerGroup().addTo(state.map);
  state.routeLayer=L.layerGroup().addTo(state.map);
  state.seaLabels=L.layerGroup().addTo(state.map);
  SEA_LABELS.forEach(s=>{const icon=L.divIcon({className:"sea-label",html:`<span>${s.name}</span>`,iconSize:[120,18],iconAnchor:[60,9]});L.marker([s.lat,s.lon],{icon,interactive:false}).addTo(state.seaLabels);});
}
function initNavGroups(){
  document.querySelectorAll(".nav-group-header").forEach(btn=>{
    btn.onclick=()=>{
      const g=btn.closest(".nav-group");const wasOpen=g.classList.contains("open");
      document.querySelectorAll(".nav-group").forEach(x=>x.classList.remove("open"));
      if(!wasOpen)g.classList.add("open");
      if(g.id==="group-vessels"&&!wasOpen){
        if(ENERGY.includes(state.tracker)){state.tracker="world_ports";state.offset=0;
          document.querySelectorAll(".tracker-item").forEach(x=>x.classList.toggle("active",x.dataset.id==="world_ports"));loadData();}
        const key=document.getElementById("ais-key").value.trim()||localStorage.getItem("ais_key")||"";
        if(key&&(!state.aisSocket||state.aisSocket.readyState>1))connectAIS();
      }
    };
  });
}
function initStatusDD(){
  document.getElementById("dd-status-panel").innerHTML=ALL_STATUSES.map(s=>`<label class="dd-item"><input type="checkbox" value="${s}"/> ${s}</label>`).join("");
  document.getElementById("dd-status-btn").onclick=e=>{e.stopPropagation();document.getElementById("dd-status").classList.toggle("open");document.getElementById("dd-country").classList.remove("open");};
  document.getElementById("dd-country-btn").onclick=e=>{e.stopPropagation();document.getElementById("dd-country").classList.toggle("open");document.getElementById("dd-status").classList.remove("open");};
  document.addEventListener("click",()=>{document.getElementById("dd-status").classList.remove("open");document.getElementById("dd-country").classList.remove("open");});
  document.getElementById("dd-status-panel").onclick=e=>e.stopPropagation();
  document.getElementById("dd-country-panel").onclick=e=>e.stopPropagation();
}
async function loadPorts(){
  try{
    const ports=await(await fetch("/api/ports")).json();
    state.ports=ports;state.portByName={};
    document.getElementById("port-list").innerHTML=ports.map(p=>{
      const key=(p.name+(p.country?" ("+p.country+")":"")).trim();
      state.portByName[key.toLowerCase()]=p;state.portByName[p.name.toLowerCase()]=p;
      return `<option value="${key}"></option>`;
    }).join("");
    ["from","to"].forEach(side=>{
      const inp=document.getElementById("port-"+side+"-search");
      inp.addEventListener("change",()=>pickPort(side,inp.value));
      inp.addEventListener("blur",()=>pickPort(side,inp.value));
    });
  }catch(e){console.error("ports",e);}
}
function pickPort(side,text){
  const t=(text||"").trim().toLowerCase();if(!t)return;
  let p=state.portByName[t];
  if(!p)p=state.ports.find(x=>x.name.toLowerCase()===t||(x.name+" ("+(x.country||"")+")").toLowerCase()===t||x.name.toLowerCase().includes(t));
  if(!p){document.getElementById("port-"+side+"-label").textContent="Port not found";return;}
  document.getElementById("route-"+side+"-lat").value=p.lat;
  document.getElementById("route-"+side+"-lon").value=p.lon;
  document.getElementById("port-"+side+"-label").textContent=p.name+(p.country?" · "+p.country:"")+" ("+Number(p.lat).toFixed(2)+", "+Number(p.lon).toFixed(2)+")";
}
async function loadTrackers(){
  const list=await(await fetch("/api/trackers")).json();
  const energyEl=document.getElementById("tracker-list"),vesselEl=document.getElementById("vessel-tracker-list");
  energyEl.innerHTML="";vesselEl.innerHTML="";
  list.forEach(t=>{(t.id==="world_ports"?vesselEl:energyEl).appendChild(makeItem(t));});
}
function makeItem(t){
  const div=document.createElement("div");
  div.className="tracker-item"+(t.id===state.tracker?" active":"");div.dataset.id=t.id;
  let meta="";
  if(t.id==="coal_terminals"){meta=(t.rows?t.rows.toLocaleString()+" terminals":"");if(t.operating_capacity_mw)meta+=" · "+Math.round(t.operating_capacity_mw).toLocaleString()+" Mt op";}
  else if(t.id==="world_ports"){meta=(t.rows?t.rows.toLocaleString()+" ports":"");if(t.countries)meta+=" · "+t.countries+" countries";}
  else{meta=(t.rows?t.rows.toLocaleString()+" units":"");if(t.operating_capacity_mw)meta+=" · "+(t.operating_capacity_mw/1000).toFixed(0)+" GW op";}
  div.innerHTML=`<span class="icon">${t.icon||"📊"}</span><div><div>${t.label}</div><div class="meta">${meta}</div></div>`;
  div.onclick=()=>{state.tracker=t.id;state.offset=0;document.querySelectorAll(".tracker-item").forEach(x=>x.classList.remove("active"));div.classList.add("active");
    document.querySelectorAll(".nav-group").forEach(g=>g.classList.remove("open"));
    document.getElementById(t.id==="world_ports"?"group-vessels":"group-energy").classList.add("open");
    loadCountries();loadData();
    if(t.id==="world_ports"){const key=document.getElementById("ais-key").value.trim()||localStorage.getItem("ais_key")||"";if(key&&(!state.aisSocket||state.aisSocket.readyState>1))connectAIS();}
  };
  return div;
}
async function loadCountries(){
  try{const rows=await(await fetch(`/api/countries/${state.tracker}`)).json();
    document.getElementById("dd-country-panel").innerHTML=rows.map(r=>`<label class="dd-item"><input type="checkbox" value="${r.country}"/> ${r.country} <span class="hint">(${Math.round(r.capacity).toLocaleString()})</span></label>`).join("")||"<div class='dd-item'>No countries</div>";
  }catch(e){console.error(e);}
}
function getFilterParams(){
  const statuses=Array.from(document.querySelectorAll("#dd-status-panel input:checked")).map(i=>i.value);
  const countries=Array.from(document.querySelectorAll("#dd-country-panel input:checked")).map(i=>i.value);
  const p=new URLSearchParams();
  if(statuses.length)p.set("status",statuses.join(","));
  if(countries.length)p.set("country",countries.join(","));
  const min=document.getElementById("filter-min-mw").value,max=document.getElementById("filter-max-mw").value;
  if(min)p.set("min_mw",min);if(max)p.set("max_mw",max);
  const search=document.getElementById("filter-search").value.trim();if(search)p.set("search",search);
  p.set("limit",state.limit);p.set("offset",state.offset);
  document.getElementById("dd-status-btn").textContent=statuses.length?statuses.length+" status selected":"Select status…";
  document.getElementById("dd-country-btn").textContent=countries.length?countries.length+" countries selected":"Select countries…";
  return p;
}
async function loadData(){if(!document.getElementById("dd-country-panel").children.length)await loadCountries();await Promise.all([loadKPIs(),loadTable(),loadMap()]);}
async function loadKPIs(){
  if(state.tracker.startsWith("user_")){document.getElementById("kpi-strip").innerHTML=`<div class="kpi-card"><div class="label">User</div><div class="value">${state.tracker}</div></div>`;return;}
  try{
    const k=await(await fetch(`/api/kpis/${state.tracker}`)).json();
    const isTerm=state.tracker==="coal_terminals",isPorts=state.tracker==="world_ports";
    const unit=isTerm?"Mt":(isPorts?"":"GW");
    const opVal=isPorts?Number(k.operating_units).toLocaleString():(isTerm?Math.round(k.operating_mw).toLocaleString():(k.operating_mw/1000).toFixed(1));
    const totVal=isPorts?Number(k.total_units).toLocaleString():(isTerm?Math.round(k.total_mw).toLocaleString():(k.total_mw/1000).toFixed(1));
    document.getElementById("kpi-strip").innerHTML=`<div class="kpi-card"><div class="label">${isPorts?"Operating Ports":"Operating Capacity"}</div><div class="value">${opVal} ${unit?`<small>${unit}</small>`:""}</div><div class="sub">${isPorts?(k.countries+" countries"):(Number(k.operating_units).toLocaleString()+" units")}</div></div><div class="kpi-card"><div class="label">Total Units</div><div class="value">${Number(k.total_units).toLocaleString()}</div><div class="sub">${k.countries} countries</div></div><div class="kpi-card"><div class="label">${isPorts?"Total Ports":"Total Capacity"}</div><div class="value">${totVal} ${unit&&!isPorts?`<small>${unit}</small>`:""}</div></div><div class="kpi-card"><div class="label">Top Status</div><div class="value" style="font-size:1.1rem">${(k.by_status&&k.by_status[0])?k.by_status[0].Status:"—"}</div><div class="sub">${(k.by_status&&k.by_status[0])?Number(k.by_status[0].cnt).toLocaleString()+" units":""}</div></div>`;
  }catch(e){console.error(e);}
}
async function loadTable(){
  const json=await(await fetch(`/api/data/${state.tracker}?${getFilterParams()}`)).json();
  state.total=json.total;
  const thead=document.querySelector("#data-table thead"),tbody=document.querySelector("#data-table tbody");
  if(!json.data.length){thead.innerHTML="";tbody.innerHTML=`<tr><td colspan="8">No rows match filters</td></tr>`;document.getElementById("table-info").textContent="0 rows";return;}
  let cols=["Plant name","Unit name","Country/Area","Status","Capacity (MW)","Start year","Owner","Region"].filter(c=>c in json.data[0]);
  if(cols.length<4)cols=Object.keys(json.data[0]).slice(0,8);
  thead.innerHTML="<tr>"+cols.map(c=>`<th>${c}</th>`).join("")+"</tr>";
  tbody.innerHTML=json.data.map(row=>"<tr>"+cols.map(c=>{let v=row[c];if(c==="Status"&&v)return `<td><span class="chip chip-${String(v).toLowerCase().replace(/\s+/g,"-")}">${v}</span></td>`;if(c==="Capacity (MW)"&&v!=null)return `<td>${Number(v).toLocaleString()}</td>`;return `<td>${v??""}</td>`;}).join("")+"</tr>").join("");
  document.getElementById("table-info").textContent=`Showing ${state.offset+1}–${state.offset+json.data.length} of ${json.total.toLocaleString()}`;
}
async function loadMap(){
  state.markers.clearLayers();
  const params=getFilterParams();params.set("limit",5000);params.delete("offset");
  try{
    const points=await(await fetch(`/api/map/${state.tracker}?${params}`)).json();
    points.forEach(p=>{
      if(p.lat==null||p.lon==null)return;
      const color=STATUS_COLORS[(p.status||"").toLowerCase()]||"#016B83";
      const m=L.circleMarker([p.lat,p.lon],{radius:Math.max(4,Math.min(12,Math.sqrt(p.capacity||10)/3)),fillColor:color,color:"#fff",weight:1,fillOpacity:0.75});
      const cap=state.tracker==="coal_terminals"?" Mt":(state.tracker==="world_ports"?"":" MW");
      m.bindPopup(`<strong>${p.name||"—"}</strong><br/>${p.country||""} · ${p.status||""}<br/>${p.capacity!=null&&state.tracker!=="world_ports"?("Cap: "+Number(p.capacity).toLocaleString()+cap):""}<br/><button onclick="usePort('${(p.name||"").replace(/'/g,"")}',${p.lat},${p.lon})">Use in distance calc</button>`);
      state.markers.addLayer(m);
    });
  }catch(e){console.error(e);}
}
window.usePort=function(name,lat,lon){
  document.getElementById("group-vessels").classList.add("open");document.getElementById("group-energy").classList.remove("open");
  const fromEmpty=!document.getElementById("route-from-lat").value;const side=fromEmpty?"from":"to";
  document.getElementById("port-"+side+"-search").value=name;
  document.getElementById("route-"+side+"-lat").value=lat;document.getElementById("route-"+side+"-lon").value=lon;
  document.getElementById("port-"+side+"-label").textContent=name+" ("+Number(lat).toFixed(2)+", "+Number(lon).toFixed(2)+")";
  if(!fromEmpty)calcRoute();
};
async function calcRoute(){
  const fla=+document.getElementById("route-from-lat").value,flo=+document.getElementById("route-from-lon").value;
  const tla=+document.getElementById("route-to-lat").value,tlo=+document.getElementById("route-to-lon").value;
  const speed=+document.getElementById("route-speed").value||12;
  if([fla,flo,tla,tlo].some(isNaN)){document.getElementById("route-result").textContent="Select two ports by name first";return;}
  const fromName=document.getElementById("port-from-search").value||"Origin";
  const toName=document.getElementById("port-to-search").value||"Destination";
  document.getElementById("route-result").textContent="Calculating sea route…";
  try{
    const res=await fetch("/api/route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from_lon:flo,from_lat:fla,to_lon:tlo,to_lat:tla,speed_knots:speed,from_name:fromName,to_name:toName})});
    const j=await res.json();if(!res.ok)throw new Error(j.detail||"Route failed");
    state.routeLayer.clearLayers();
    if(j.coordinates&&j.coordinates.length){
      const ll=j.coordinates.map(c=>[c[1],c[0]]);
      L.polyline(ll,{color:"#FE4F2D",weight:3,opacity:0.9}).addTo(state.routeLayer);
      L.circleMarker([fla,flo],{radius:7,fillColor:"#016B83",color:"#fff",weight:2,fillOpacity:1}).bindTooltip(fromName).addTo(state.routeLayer);
      L.circleMarker([tla,tlo],{radius:7,fillColor:"#FE4F2D",color:"#fff",weight:2,fillOpacity:1}).bindTooltip(toName).addTo(state.routeLayer);
      state.map.fitBounds(ll,{padding:[40,40]});
    }
    const nm=j.distance_nm!=null?j.distance_nm:(j.distance_km/1.852);
    const mi=j.distance_miles!=null?j.distance_miles:(j.distance_km/1.609344);
    const via=j.via?(" via "+j.via):"";
    document.getElementById("route-result").textContent=fromName+" → "+toName+via+" · "+nm.toLocaleString(undefined,{maximumFractionDigits:1})+" nm ("+mi.toLocaleString(undefined,{maximumFractionDigits:1})+" mi) · "+(j.speed_knots||speed)+" kn · ~"+j.duration_hours.toFixed(1)+" h";
  }catch(e){document.getElementById("route-result").textContent="Error: "+e.message;}
}
function parseImoList(){
  const raw=document.getElementById("imo-list").value||"";
  const ids=raw.split(/[\s,;]+/).map(s=>s.trim()).filter(s=>/^\d{7,9}$/.test(s));
  state.imoFilter=new Set(ids);return ids;
}
/** Small oriented dash like dense AIS maps (green/purple by speed) */
function vesselIcon(cog,sog){
  const rot=(cog!=null&&cog<360)?cog:0;
  const moving=sog!=null&&sog>0.5;
  const color=moving?"#6B4C9A":"#3D9B6A";
  return L.divIcon({className:"vessel-dash",html:`<div style="transform:rotate(${rot}deg);width:10px;height:3px;background:${color};border-radius:1px;opacity:0.9;"></div>`,iconSize:[10,3],iconAnchor:[5,1.5]});
}
function updateVesselTrail(mmsi,lat,lon){
  let trail=state.vesselTrails.get(mmsi);
  if(!trail){trail=[];state.vesselTrails.set(mmsi,trail);}
  trail.push([lat,lon]);
  if(trail.length>8)trail.shift();
  return trail;
}
function connectAIS(){
  const key=document.getElementById("ais-key").value.trim()||localStorage.getItem("ais_key")||"";
  if(!key){document.getElementById("ais-status").textContent="Enter AISStream API key first";return;}
  localStorage.setItem("ais_key",key);
  if(state.aisSocket)try{state.aisSocket.close();}catch(_){}
  state.vesselLayer.clearLayers();
  state.vesselMarkers.clear();state.vesselTrails.clear();
  const ws=new WebSocket("wss://stream.aisstream.io/v0/stream");state.aisSocket=ws;
  document.getElementById("ais-status").textContent="Connecting…";
  const ids=parseImoList();
  const sub={APIKey:key,BoundingBoxes:[[[-90,-180],[90,180]]],FilterMessageTypes:["PositionReport","ShipStaticData"]};
  // Only restrict stream by MMSI when user is tracking specific ships
  const mmsis=ids.filter(x=>x.length===9);if(mmsis.length)sub.FiltersShipMMSI=mmsis;
  ws.onopen=()=>{ws.send(JSON.stringify(sub));document.getElementById("ais-status").textContent=ids.length?"Live — tracking "+ids.length+" ship(s)":"Live — all vessels";};
  ws.onmessage=ev=>{try{
    const msg=JSON.parse(ev.data),meta=msg.MetaData||{},mmsi=String(meta.MMSI||meta.mmsi||"");if(!mmsi)return;
    const pr=msg.Message?.PositionReport||msg.PositionReport||{};
    if(msg.MessageType==="ShipStaticData"||msg.Message?.ShipStaticData){
      const sd=msg.Message?.ShipStaticData||msg.ShipStaticData||{},dim=sd.Dimension||{};
      state.shipMeta[mmsi]={name:(sd.Name||meta.ShipName||"").trim(),type:sd.Type||sd.ShipType||0,length:(dim.A||0)+(dim.B||0),imo:String(sd.ImoNumber||sd.IMO||"")};
      return;
    }
    const lat=meta.latitude!=null?meta.latitude:pr.Latitude;
    const lon=meta.longitude!=null?meta.longitude:pr.Longitude;
    if(lat==null||lon==null)return;
    const cog=pr.Cog!=null?pr.Cog:pr.cog;
    const sog=pr.Sog!=null?pr.Sog:pr.sog;
    const heading=pr.TrueHeading!=null?pr.TrueHeading:pr.trueHeading;
    const course=(heading!=null&&heading<360)?heading:(cog!=null&&cog<360)?cog:null;

    // Filter ONLY when user searched for specific ships
    if(state.imoFilter.size){
      const sm=state.shipMeta[mmsi]||{};
      if(!(state.imoFilter.has(mmsi)||(sm.imo&&state.imoFilter.has(sm.imo))))return;
    }

    const sm=state.shipMeta[mmsi]||{};
    const name=sm.name||meta.ShipName||meta.shipName||("MMSI "+mmsi);
    const trail=updateVesselTrail(mmsi,lat,lon);
    const existing=state.vesselMarkers.get(mmsi);
    if(existing){
      existing.marker.setLatLng([lat,lon]);
      existing.marker.setIcon(vesselIcon(course,sog));
      if(existing.trailLine){existing.trailLine.setLatLngs(trail);}
      else if(trail.length>1){existing.trailLine=L.polyline(trail,{color:"#6B4C9A",weight:1.5,opacity:0.35}).addTo(state.vesselLayer);}
    }else{
      const marker=L.marker([lat,lon],{icon:vesselIcon(course,sog),interactive:true});
      marker.bindPopup(`<strong>${name}</strong><br/>MMSI ${mmsi}`+(sm.imo?"<br/>IMO "+sm.imo:"")+(sm.length?"<br/>LOA "+sm.length+" m":"")+(sog!=null?"<br/>SOG "+Number(sog).toFixed(1)+" kn":"")+(course!=null?"<br/>COG "+Math.round(course)+"°":""));
      state.vesselLayer.addLayer(marker);
      let trailLine=null;
      if(trail.length>1){trailLine=L.polyline(trail,{color:"#6B4C9A",weight:1.5,opacity:0.35}).addTo(state.vesselLayer);}
      state.vesselMarkers.set(mmsi,{marker,trailLine});
      // Keep denser map — allow more vessels than before
      if(state.vesselMarkers.size>2500){
        const first=state.vesselMarkers.keys().next().value;
        const old=state.vesselMarkers.get(first);
        state.vesselLayer.removeLayer(old.marker);if(old.trailLine)state.vesselLayer.removeLayer(old.trailLine);
        state.vesselMarkers.delete(first);state.vesselTrails.delete(first);
      }
    }
    document.getElementById("ais-status").textContent=`Live — ${state.vesselMarkers.size} vessels`+(state.imoFilter.size?" (filtered)":" (all)");
  }catch(_){}};
  ws.onerror=()=>{document.getElementById("ais-status").textContent="AIS error — check API key";};
  ws.onclose=()=>{document.getElementById("ais-status").textContent="AIS disconnected";};
}
function bindUI(){
  document.querySelectorAll(".tab").forEach(tab=>{tab.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));tab.classList.add("active");switchView(tab.dataset.view);};});
  document.getElementById("btn-apply").onclick=()=>{state.offset=0;loadData();};
  document.getElementById("btn-reset").onclick=()=>{document.querySelectorAll("#dd-status-panel input,#dd-country-panel input").forEach(i=>i.checked=false);document.getElementById("filter-min-mw").value="";document.getElementById("filter-max-mw").value="";document.getElementById("filter-search").value="";state.offset=0;loadData();};
  document.getElementById("btn-prev").onclick=()=>{state.offset=Math.max(0,state.offset-state.limit);loadTable();};
  document.getElementById("btn-next").onclick=()=>{if(state.offset+state.limit<state.total){state.offset+=state.limit;loadTable();}};
  document.getElementById("btn-upload").onclick=()=>document.getElementById("upload-modal").classList.remove("hidden");
  document.getElementById("btn-cancel-upload").onclick=()=>document.getElementById("upload-modal").classList.add("hidden");
  document.getElementById("btn-do-upload").onclick=doUpload;
  document.getElementById("btn-export").onclick=()=>window.open(`/api/export/${state.tracker}?${getFilterParams()}`,"_blank");
  document.getElementById("btn-ais").onclick=connectAIS;
  document.getElementById("btn-route").onclick=calcRoute;
  document.getElementById("btn-track-imo").onclick=()=>{const ids=parseImoList();document.getElementById("imo-status").textContent=ids.length?"Showing only "+ids.length+" ship(s)":"Paste IMO/MMSI first";if(ids.length)connectAIS();};
  const clearBtn=document.getElementById("btn-clear-imo");
  if(clearBtn)clearBtn.onclick=()=>{document.getElementById("imo-list").value="";state.imoFilter=new Set();document.getElementById("imo-status").textContent="Filter cleared — showing all vessels";connectAIS();};
  document.getElementById("use-local-llm").onchange=e=>{document.getElementById("local-llm-url").style.display=e.target.checked?"block":"none";};
  document.getElementById("btn-send").onclick=sendChat;
  document.getElementById("chat-input").onkeydown=e=>{if(e.key==="Enter")sendChat();};
}
function switchView(name){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(`view-${name}`).classList.add("active");if(name==="map"&&state.map)setTimeout(()=>state.map.invalidateSize(),100);}
async function doUpload(){
  const input=document.getElementById("file-input");if(!input.files.length){document.getElementById("upload-status").textContent="Choose a file";return;}
  const fd=new FormData();fd.append("file",input.files[0]);document.getElementById("upload-status").textContent="Uploading…";
  try{const res=await fetch("/api/upload",{method:"POST",body:fd});const json=await res.json();if(!res.ok)throw new Error(json.detail||"fail");
    document.getElementById("upload-status").textContent=`✓ ${json.message}`;await loadTrackers();
    setTimeout(()=>{document.getElementById("upload-modal").classList.add("hidden");document.getElementById("upload-status").textContent="";input.value="";},1200);
  }catch(e){document.getElementById("upload-status").textContent="Error: "+e.message;}
}
async function sendChat(){
  const input=document.getElementById("chat-input"),msg=input.value.trim();if(!msg)return;
  const box=document.getElementById("chat-messages");box.innerHTML+=`<div class="msg user">${esc(msg)}</div>`;input.value="";box.scrollTop=box.scrollHeight;
  const th=document.createElement("div");th.className="msg assistant";th.textContent="Thinking…";box.appendChild(th);
  try{const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg,use_local_llm:document.getElementById("use-local-llm").checked,local_llm_url:document.getElementById("local-llm-url").value.trim()||null})});
    const json=await res.json();th.innerHTML=esc(json.reply||"No reply").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>");
  }catch(e){th.textContent="Error: "+e.message;}box.scrollTop=box.scrollHeight;
}
function esc(s){return String(s).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">");}
