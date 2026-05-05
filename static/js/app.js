/* ══════════════════════════════════════════════════════════════
   HC Calculatrice — app.js
   Schéma config : visible, dur_h+dur_m, hc_bands[].label
   ══════════════════════════════════════════════════════════════ */

const CX = 115, CY = 115, R = 106, R_INNER = 84;
const BAND_COLORS = ['#00d4aa','#4a9eff','#a78bfa','#fbbf24','#fb923c'];
const DEVICE_ICONS = {
  washer:'🫧', dishwasher:'🍽️', dryer:'♨️', plug:'⚡',
  car:'🚗', bolt:'⚡', snowflake:'❄️', fan:'💨',
  tv:'📺', computer:'💻', kettle:'☕', iron:'👕', vacuum:'🌀'
};

let config = { hc_bands:[], devices:[] };
let selectedDevice  = null;
let selectedProgram = null;
let currentMode     = 'fin';
let durH = 1, durM = 0;

// ── Helpers schéma ───────────────────────────────────────────
// Durée en minutes depuis un programme
function progDuration(prog) {
  // Supporte dur_h+dur_m (schéma réel) et duration (ancien schéma)
  if (prog.dur_h !== undefined || prog.dur_m !== undefined)
    return (parseInt(prog.dur_h)||0) * 60 + (parseInt(prog.dur_m)||0);
  return parseInt(prog.duration) || 0;
}

// Nom de la plage HC
function bandName(band) {
  return band.label || band.name || 'HC';
}

// Appareil visible ?
function devVisible(dev) {
  if (dev.visible !== undefined) return dev.visible;
  if (dev.enabled !== undefined) return dev.enabled;
  return true;
}

// ── Bootstrap ────────────────────────────────────────────────

async function init() {
  initTheme();
  startClock();

  try {
    const res = await fetch('/api/config');
    config = await res.json();
  } catch(e) {
    console.error('Config load failed:', e);
    return;
  }

  drawDial();
  drawClock();
  setInterval(drawClock, 60000);

  const visible = config.devices.filter(devVisible);
  if (!visible.length) {
    document.getElementById('device-grid').innerHTML =
      '<p style="color:var(--muted);font-size:12px;grid-column:span 2">Aucun appareil activé — <a href="/admin">configurer</a></p>';
    return;
  }

  selectedDevice  = visible[0];
  selectedProgram = selectedDevice.programs[0] || null;
  currentMode     = selectedDevice.mode || 'fin';

  renderDevices();
  renderPrograms();
  if (selectedProgram) setDurFromProgram(selectedProgram);
  setMode(currentMode);
  calculate();

  document.getElementById('dur-h').addEventListener('input', onDurChange);
  document.getElementById('dur-m').addEventListener('input', onDurChange);
  setInterval(calculate, 60000);
}

function onDurChange() {
  durH = clamp(parseInt(document.getElementById('dur-h').value)||0, 0, 23);
  durM = clamp(parseInt(document.getElementById('dur-m').value)||0, 0, 59);
  calculate();
}

// ── Theme ────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('hc-theme') || 'auto';
  applyTheme(saved);
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('hc-theme', t);
  document.querySelectorAll('.theme-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === t));
  if (config.hc_bands.length) { drawDial(); drawClock(); }
}

// ── Live clock ───────────────────────────────────────────────

function startClock() {
  const el = document.getElementById('clock-live');
  function tick() {
    const n = new Date();
    el.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── Dial ─────────────────────────────────────────────────────

function polarXY(deg, r) {
  const rad = deg * Math.PI / 180;
  return { x: CX + r*Math.cos(rad), y: CY + r*Math.sin(rad) };
}

function timeToAngle(hhmm) {
  const [h,m] = hhmm.split(':').map(Number);
  return ((h*60+m) % 1440) / 1440 * 360 - 90;
}

function arcPath(sa, ea, r1, r2) {
  if (ea <= sa) ea += 360;
  const large = (ea-sa) > 180 ? 1 : 0;
  const s1=polarXY(sa,r1), e1=polarXY(ea,r1);
  const s2=polarXY(sa,r2), e2=polarXY(ea,r2);
  return `M${s1.x} ${s1.y} A${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y} L${e2.x} ${e2.y} A${r2} ${r2} 0 ${large} 0 ${s2.x} ${s2.y}Z`;
}

function svgEl(tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
  if (text !== undefined) el.textContent = text;
  return el;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawDial() {
  const arcsG   = document.getElementById('hc-arcs');
  const ticksG  = document.getElementById('hour-ticks');
  const labelsG = document.getElementById('hour-labels');
  if (!arcsG) return;
  arcsG.innerHTML = ticksG.innerHTML = labelsG.innerHTML = '';

  const dialBg   = cssVar('--dial-bg')    || '#161922';
  const dialRing = cssVar('--dial-ring')  || '#2a3045';
  const tickMaj  = cssVar('--tick-maj')   || '#3a4055';
  const tickMin  = cssVar('--tick-min')   || '#252838';
  const labelClr = cssVar('--label-clr') || '#8090b0';

  const bg = document.getElementById('dial-bg-circle');
  const rg = document.getElementById('dial-ring-circle');
  if (bg) bg.setAttribute('fill', dialBg);
  if (rg) rg.setAttribute('stroke', dialRing);

  // Arcs HC
  config.hc_bands.forEach((band, i) => {
    const color = BAND_COLORS[i % BAND_COLORS.length];
    const sa = timeToAngle(band.start), ea = timeToAngle(band.end);
    const d = arcPath(sa, ea, R-2, R_INNER+4);
    arcsG.appendChild(svgEl('path', {d, fill:color, opacity:'.18'}));
    arcsG.appendChild(svgEl('path', {d, fill:'none', stroke:color, 'stroke-width':'1.5', opacity:'.55'}));
  });

  // Ticks
  for (let h=0; h<24; h++) {
    const angle = h/24*360 - 90;
    const major = h%6===0, mid = h%3===0 && !major;
    const p1 = polarXY(angle, R-2), p2 = polarXY(angle, major?R-16:mid?R-10:R-7);
    ticksG.appendChild(svgEl('line', {
      x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y,
      stroke: major?tickMaj:tickMin,
      'stroke-width': major?'1.5':mid?'1.2':'0.8'
    }));
  }

  // Labels cardinaux à l'extérieur
  [{h:0,l:'00'},{h:6,l:'06'},{h:12,l:'12'},{h:18,l:'18'}].forEach(({h,l}) => {
    const angle = h/24*360 - 90;
    const pos = polarXY(angle, R+14);
    labelsG.appendChild(svgEl('text', {
      x:pos.x, y:pos.y+4, 'text-anchor':'middle',
      fill:labelClr, 'font-size':'11',
      'font-family':'JetBrains Mono,monospace', 'font-weight':'600'
    }, l));
  });
}

function drawClock() {
  const handClr = cssVar('--hand-clr') || '#4a9eff';
  const now = new Date();
  const angle = (now.getHours()*60+now.getMinutes()) / 1440 * 360 - 90;
  const end = polarXY(angle, 62);
  const hand = document.getElementById('hour-hand');
  const dot  = document.getElementById('center-dot');
  if (hand) { hand.setAttribute('x2',end.x); hand.setAttribute('y2',end.y); hand.setAttribute('stroke',handClr); }
  if (dot)    dot.setAttribute('fill', handClr);
}

function drawResultMarkers(startMin, endMin) {
  const g = document.getElementById('result-markers');
  if (!g) return;
  g.innerHTML = '';
  [{min:startMin,color:'#4a9eff',label:'D'},{min:endMin,color:'#00d4aa',label:'F'}].forEach(m => {
    const angle = ((m.min%1440+1440)%1440)/1440*360-90;
    const pos = polarXY(angle, R-11);
    g.appendChild(svgEl('circle',{cx:pos.x,cy:pos.y,r:'6',fill:m.color,opacity:'.92'}));
    g.appendChild(svgEl('text',{x:pos.x,y:pos.y+3.5,'text-anchor':'middle',fill:'#0d0f14',
      'font-size':'6.5','font-family':'JetBrains Mono,monospace','font-weight':'700'},m.label));
  });
}

// ── Devices / Programs ───────────────────────────────────────

function renderDevices() {
  const grid = document.getElementById('device-grid');
  grid.innerHTML = '';
  config.devices.filter(devVisible).forEach(dev => {
    const btn = document.createElement('div');
    btn.className = 'device-btn' + (dev.id===selectedDevice?.id ? ' active':'');
    btn.innerHTML = `
      <div class="device-icon">${DEVICE_ICONS[dev.icon]||'⚡'}</div>
      <div class="device-name">${dev.name}</div>
      <div class="device-mode">${dev.mode==='fin'?'← fin HC':'départ HC →'}</div>`;
    btn.onclick = () => {
      selectedDevice  = dev;
      selectedProgram = dev.programs[0]||null;
      setMode(dev.mode||'fin');
      renderDevices(); renderPrograms();
      if (selectedProgram) setDurFromProgram(selectedProgram);
      calculate();
    };
    grid.appendChild(btn);
  });
}

function renderPrograms() {
  const scroll = document.getElementById('prog-scroll');
  scroll.innerHTML = '';
  if (!selectedDevice) return;
  selectedDevice.programs.forEach(prog => {
    const chip = document.createElement('div');
    chip.className = 'prog-chip'+(prog.id===selectedProgram?.id?' active':'');
    chip.innerHTML = `<span class="prog-chip-name">${prog.name}</span>
                      <span class="prog-chip-dur">${durStr(progDuration(prog))}</span>`;
    chip.onclick = () => {
      selectedProgram = prog;
      renderPrograms();
      setDurFromProgram(prog);
      calculate();
    };
    scroll.appendChild(chip);
  });
}

function setDurFromProgram(prog) {
  const total = progDuration(prog);
  durH = Math.floor(total/60);
  durM = total%60;
  document.getElementById('dur-h').value = durH;
  document.getElementById('dur-m').value = durM;
}

// ── Mode ─────────────────────────────────────────────────────

function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-fin').classList.toggle('active', mode==='fin');
  document.getElementById('mode-dep').classList.toggle('active', mode==='depart');
  calculate();
}

// ── HC logic ─────────────────────────────────────────────────

function timeStrToMin(hhmm) {
  const [h,m] = hhmm.split(':').map(Number); return h*60+m;
}
function minToTimeStr(t) {
  const m=((t%1440)+1440)%1440;
  return `${pad(Math.floor(m/60))}:${pad(m%60)}`;
}
function isHC(minuteOfDay) {
  const mod=((minuteOfDay%1440)+1440)%1440;
  return config.hc_bands.some(b => {
    const s=timeStrToMin(b.start), e=timeStrToMin(b.end);
    return e>s ? (mod>=s&&mod<e) : (mod>=s||mod<e);
  });
}
function getHCBandName(minuteOfDay) {
  const mod=((minuteOfDay%1440)+1440)%1440;
  const b=config.hc_bands.find(b => {
    const s=timeStrToMin(b.start), e=timeStrToMin(b.end);
    return e>s ? (mod>=s&&mod<e) : (mod>=s||mod<e);
  });
  return b ? bandName(b) : null;
}

// ── Calculate ────────────────────────────────────────────────

function calculate() {
  const now    = new Date();
  const nowMin = now.getHours()*60+now.getMinutes();
  const progDur = durH*60+durM;
  if (progDur<=0) { setRS('idle','En attente','–','Durée invalide','',''); return; }

  const results=[];
  for (let delay=1; delay<=12; delay++) {
    const startMin = currentMode==='fin' ? nowMin+delay*60-progDur : nowMin+delay*60;
    const endMin   = startMin+progDur;
    const checkMin = currentMode==='fin' ? endMin : startMin;
    const hcOk     = isHC(checkMin);
    results.push({delay, startMin, endMin, hcOk,
      startStr:minToTimeStr(startMin), endStr:minToTimeStr(endMin),
      zone: hcOk ? getHCBandName(checkMin) : 'HP'});
  }

  const best = results.find(r=>r.hcOk);
  const alts = results.filter(r=>r.hcOk && r!==best).slice(0,3);

  if (!best) {
    document.getElementById('result-markers').innerHTML='';
    const html=`<div class="result-alts"><div class="alt-label">Toutes les options (hors HC)</div>`
      +results.slice(0,5).map(a=>`<div class="alt-item">
        <span class="alt-delay">+${a.delay}h</span>
        <span class="alt-times">${a.startStr} → ${a.endStr}</span>
        <span class="alt-zone" style="color:var(--hp)">HP</span></div>`).join('')+`</div>`;
    setRS('error','Aucune solution','✕','Aucun délai de 1 à 12h ne place le programme en HC.','',html);
    return;
  }

  const modeLabel = currentMode==='fin'?'fin en':'départ en';
  const sub = `Différé de ${best.delay}h — ${modeLabel} ${best.zone||'HC'} (${durStr(progDur)})`;
  const sZ  = isHC(best.startMin)?'hc':'hp';
  const eZ  = isHC(best.endMin)?'hc':'hp';

  const timeline=`<div class="result-timeline">
    <div class="tl-node"><div class="tl-time">${minToTimeStr(nowMin)}</div><div class="tl-label">Maintenant</div></div>
    <div class="tl-arrow"></div>
    <div class="tl-node ${sZ}-zone"><div class="tl-time">${best.startStr}</div><div class="tl-label">Départ</div><div class="tl-badge badge-${sZ}">${sZ.toUpperCase()}</div></div>
    <div class="tl-arrow"></div>
    <div class="tl-node ${eZ}-zone"><div class="tl-time">${best.endStr}</div><div class="tl-label">Fin</div><div class="tl-badge badge-${eZ}">${eZ.toUpperCase()}</div></div>
    </div>`;

  const altsHtml = alts.length ? `<div class="result-alts"><div class="alt-label">Autres options valides</div>`
    +alts.map(a=>`<div class="alt-item">
      <span class="alt-delay">+${a.delay}h</span>
      <span class="alt-times">${a.startStr} → ${a.endStr}</span>
      <span class="alt-zone">${isHC(a.startMin)?'HC':'HP'}→${isHC(a.endMin)?'HC':'HP'}</span></div>`).join('')+`</div>` : '';

  setRS('success','Solution trouvée',`+ ${best.delay}h`, sub, timeline, altsHtml);
  drawResultMarkers(best.startMin, best.endMin);
}

function setRS(state,hdr,main,sub,timeline,alts) {
  document.getElementById('result-card').className='result-card '+state;
  document.getElementById('result-header-text').textContent=hdr;
  document.getElementById('result-main').textContent=main;
  document.getElementById('result-sub').textContent=sub;
  document.getElementById('result-timeline-wrap').innerHTML=timeline;
  document.getElementById('result-alts-wrap').innerHTML=alts;
}

// ── Utils ─────────────────────────────────────────────────────
function durStr(min) {
  const h=Math.floor(min/60),m=min%60;
  return h>0?`${h}h${m>0?pad(m):''}` :`${m}min`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }

document.addEventListener('DOMContentLoaded', init);
