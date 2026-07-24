/* GEM Dashboard v2 - energy groups, multi-select filters, AIS, sea routes */
const state={tracker:"coal_plants",offset:0,limit:100,total:0,map:null,markers:null,vesselLayer:null,routeLayer:null,routeClicks:[],aisSocket:null};
const ENERGY=["coal_plants","coal_terminals","solar","wind","hydro","nuclear"];
const STATUS_COLORS={operating:"#65BD8B",construction:"#FE4F2D",announced:"#4A57A8","pre-permit":"#4A57A8",permitted:"#4A57A8",proposed:"#4A57A8",shelved:"#7F142A",cancelled:"#7F142A",mothballed:"#8a9aa3",retired:"#8a9aa3"};
const ALL_STATUSES=["operating","construction","announced","pre-permit","permitted","proposed","shelved","cancelled","mothballed","retired"];

document.addEventListener("DOMContentLoaded",()=>{initMap();initStatusDD();loadTrackers();bindUI();switchView("map");loadData();});

function initMap(){
  state.map=L.map("map",{worldCopyJump:true}).setView([20,10],2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"OSM CARTO",maxZoom:18}).addTo(state.map);
  state.markers=L.layerGroup().addTo(state.map);
  state.vesselLayer=L.layerGroup().addTo(state.map);
  state.routeLayer=L.layerGroup().addTo(state.map);
  state.map.on("click",e=>{
    if(state.tracker!=="world_ports")return;
    state.routeClicks.push([e.latlng.lat,e.latlng.lng]);
    if(state.routeClicks.length>2)state.routeClicks=state.routeClicks.slice(-2);
    if(state.routeClicks.length===1){
      document.getElementById("route-from-lat").value=state.routeClicks[0][0].toFixed(5);
      document.getElementById("route-from-lon").value=state.routeClicks[0][1].toFixed(5);
      document.getElementById("route-result").textContent="From set — click destination";
    }else{document.getElementById("route-to-lat").value=state.routeClicks[1][0].toFixed(5);
      document.getElementById("route-to-lon").value=state.routeClicks[1][1].toFixed(5);calcRoute();}
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
async function loadTrackers(){
  const list=await(await fetch("/api/trackers")).json();
  const el=document.getElementById("tracker-list");el.innerHTML="";
  const energy=list.filter(t=>ENERGY.includes(t.id));
  const ports=list.filter(t=>t.id==="world_ports");
  const others=list.filter(t=>!ENERGY.includes(t.id)&&t.id!=="world_ports");
  const g=document.createElement("div");g.className="tracker-group open";
  g.innerHTML=`<div class="tracker-group-header"><span>⚡ Energy infrastructure</span><span>▾</span></div><div class="tracker-group-body"></div>`;
  const body=g.querySelector(".tracker-group-body");
  g.querySelector(".tracker-group-header").onclick=()=>g.classList.toggle("open");
  energy.forEach(t=>body.appendChild(makeItem(t)));el.appendChild(g);
  ports.forEach(t=>el.appendChild(makeItem(t)));others.forEach(t=>el.appendChild(makeItem(t)));
}
function makeItem(t){
  const div=document.createElement("div");
  div.className="tracker-item"+(t.id===state.tracker?" active":"");div.dataset.id=t.id;
  let meta="";
  if(t.id==="coal_terminals"){meta=(t.rows?t.rows.toLocaleString()+" terminals":"");if(t.operating_capacity_mw)meta+=" · "+Math.round(t.operating_capacity_mw).toLocaleString()+" Mt op";}
  else if(t.id==="world_ports"){meta=(t.rows?t.rows.toLocaleString()+" ports":"");if(t.countries)meta+=" · "+t.countries+" countries";}
  else{meta=(t.rows?t.rows.toLocaleString()+" units":"");if(t.operating_capacity_mw)meta+=" · "+(t.operating_capacity_mw/1000).toFixed(0)+" GW op";}
  div.innerHTML=`<span class="icon">${t.icon||"📊"}</span><div><div>${t.label}</div><div class="meta">${meta}</div></div>`;
  div.onclick=()=>{state.tracker=t.id;state.offset=0;document.querySelectorAll(".tracker-item").forEach(x=>x.classList.remove("active"));div.classList.add("active");loadCountries();loadData();};
  return div;
}
async function loadCountries(){
  try{
    const rows=await(await fetch(`/api/countries/${state.tracker}`)).json();
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
    document.getElementById("kpi-strip").innerHTML=`
      <div class="kpi-card"><div class="label">${isPorts?"Operating Ports":"Operating Capacity"}</div><div class="value">${opVal} ${unit?`<small>${unit}</small>`:""}</div>
        <div class="sub">${isPorts?(k.countries+" countries"):(Number(k.operating_units).toLocaleString()+" units")}</div></div>
      <div class="kpi-card"><div class="label">Total Units</div><div class="value">${Number(k.total_units).toLocaleString()}</div><div class="sub">${k.countries} countries</div></div>
      <div class="kpi-card"><div class="label">${isPorts?"Total Ports":"Total Capacity"}</div><div class="value">${totVal} ${unit&&!isPorts?`<small>${unit}</small>`:""}</div></div>
      <div class="kpi-card"><div class="label">Top Status</div><div class="value" style="font-size:1.1rem">${(k.by_status&&k.by_status[0])?k.by_status[0].Status:"—"}</div>
        <div class="sub">${(k.by_status&&k.by_status[0])?Number(k.by_status[0].cnt).toLocaleString()+" units":""}</div></div>`;
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
  tbody.innerHTML=json.data.map(row=>"<tr>"+cols.map(c=>{
    let v=row[c];
    if(c==="Status"&&v)return `<td><span class="chip chip-${String(v).toLowerCase().replace(/\s+/g,"-")}">${v}</span></td>`;
    if(c==="Capacity (MW)"&&v!=null)return `<td>${Number(v).toLocaleString()}</td>`;
    return `<td>${v??""}</td>`;
  }).join("")+"</tr>").join("");
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
      m.bindPopup(`<strong>${p.name||"—"}</strong><br/>${p.country||""} · ${p.status||""}<br/>${p.capacity!=null&&state.tracker!=="world_ports"?("Cap: "+Number(p.capacity).toLocaleString()+cap):""}<br/><button onclick="usePointForRoute(${p.lat},${p.lon})">Use for route</button>`);
      state.markers.addLayer(m);
    });
  }catch(e){console.error(e);}
}
window.usePointForRoute=function(lat,lon){
  state.routeClicks.push([lat,lon]);
  if(state.routeClicks.length>2)state.routeClicks=state.routeClicks.slice(-2);
  if(state.routeClicks.length===1){document.getElementById("route-from-lat").value=lat.toFixed(5);document.getElementById("route-from-lon").value=lon.toFixed(5);document.getElementById("route-result").textContent="From set — pick destination";}
  else{document.getElementById("route-to-lat").value=lat.toFixed(5);document.getElementById("route-to-lon").value=lon.toFixed(5);calcRoute();}
};
async function calcRoute(){
  const fla=+document.getElementById("route-from-lat").value,flo=+document.getElementById("route-from-lon").value;
  const tla=+document.getElementById("route-to-lat").value,tlo=+document.getElementById("route-to-lon").value;
  if([fla,flo,tla,tlo].some(isNaN)){document.getElementById("route-result").textContent="Enter valid coordinates";return;}
  document.getElementById("route-result").textContent="Calculating…";
  try{
    const res=await fetch("/api/route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from_lon:flo,from_lat:fla,to_lon:tlo,to_lat:tla})});
    const j=await res.json();if(!res.ok)throw new Error(j.detail||"Route failed");
    state.routeLayer.clearLayers();
    if(j.coordinates&&j.coordinates.length){const ll=j.coordinates.map(c=>[c[1],c[0]]);L.polyline(ll,{color:"#FE4F2D",weight:3}).addTo(state.routeLayer);state.map.fitBounds(ll);}
    document.getElementById("route-result").textContent=`Distance: ${j.distance_km.toLocaleString()} km · ~${j.duration_hours.toFixed(1)} h`;
  }catch(e){document.getElementById("route-result").textContent="Error: "+e.message;}
}
function connectAIS(){
  const key=document.getElementById("ais-key").value.trim()||localStorage.getItem("ais_key")||"";
  if(!key){document.getElementById("ais-status").textContent="Enter AISStream API key";return;}
  localStorage.setItem("ais_key",key);
  if(state.aisSocket)try{state.aisSocket.close();}catch(_){}
  const ws=new WebSocket("wss://stream.aisstream.io/v0/stream");state.aisSocket=ws;
  const vessels=new Map();
  document.getElementById("ais-status").textContent="Connecting…";
  ws.onopen=()=>{ws.send(JSON.stringify({APIKey:key,BoundingBoxes:[[[-90,-180],[90,180]]],FilterMessageTypes:["PositionReport"]}));document.getElementById("ais-status").textContent="Live — receiving";};
  ws.onmessage=ev=>{try{const msg=JSON.parse(ev.data),meta=msg.MetaData||{},lat=meta.latitude,lon=meta.longitude;if(lat==null||lon==null)return;
    const mmsi=meta.MMSI||meta.mmsi||Math.random(),name=meta.ShipName||meta.shipName||("MMSI "+mmsi);
    if(vessels.has(mmsi))vessels.get(mmsi).setLatLng([lat,lon]);
    else{const m=L.circleMarker([lat,lon],{radius:4,fillColor:"#FE4F2D",color:"#fff",weight:1,fillOpacity:0.9}).bindPopup(`<strong>${name}</strong><br/>MMSI ${mmsi}`);state.vesselLayer.addLayer(m);vessels.set(mmsi,m);
      if(vessels.size>800){const f=vessels.keys().next().value;state.vesselLayer.removeLayer(vessels.get(f));vessels.delete(f);}}
    document.getElementById("ais-status").textContent=`Live — ${vessels.size} vessels`;}catch(_){}};
  ws.onerror=()=>{document.getElementById("ais-status").textContent="AIS error — check key";};
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
  document.getElementById("btn-export").onclick=()=>window.open(`/api/export/${state.tracker}?${getFilterParams()}`, "_blank");
  document.getElementById("btn-ais").onclick=connectAIS;
  document.getElementById("btn-route").onclick=calcRoute;
  const saved=localStorage.getItem("ais_key");if(saved)document.getElementById("ais-key").value=saved;
  document.getElementById("use-local-llm").onchange=e=>{document.getElementById("local-llm-url").style.display=e.target.checked?"block":"none";};
  document.getElementById("btn-send").onclick=sendChat;
  document.getElementById("chat-input").onkeydown=e=>{if(e.key==="Enter")sendChat();};
}
function switchView(name){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(`view-${name}`).classList.add("active");if(name==="map"&&state.map)setTimeout(()=>state.map.invalidateSize(),100);}
async function doUpload(){
  const input=document.getElementById("file-input");if(!input.files.length){document.getElementById("upload-status").textContent="Choose a file";return;}
  const fd=new FormData();fd.append("file",input.files[0]);document.getElementById("upload-status").textContent="Uploading…";
  try{const res=await fetch("/api/upload",{method:"POST",body:fd});const json=await res.json();if(!res.ok)throw new Error(json.detail||"fail");
    document.getElementById("upload-status").textContent=`✓ ${json.message}`;await loadTrackers();setTimeout(()=>{document.getElementById("upload-modal").classList.add("hidden");document.getElementById("upload-status").textContent="";input.value="";},1200);
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
function esc(s){return s.replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">");}
