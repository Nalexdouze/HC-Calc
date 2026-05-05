/* HC Calculatrice — Admin JS */

let config = null;
let dirty = false;

const ICONS_MAP = {
  washer:'🫧', dishwasher:'🍽️', dryer:'♨️', car:'🚗',
  bolt:'⚡', snowflake:'❄️', fan:'💨', tv:'📺',
  computer:'💻', kettle:'🫖', iron:'👔', vacuum:'🧹',
};
const BAND_COLORS = ['#00d4aa', '#4a9eff', '#a78bfa', '#fbbf24'];

async function init() {
  config = await fetch('/api/config').then(r => r.json());
  renderHCBands();
  renderDevices();
}

function markDirty() {
  dirty = true;
  document.getElementById('unsaved-dot').classList.add('visible');
}

function toast(msg, type = 'ok') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

async function saveAll() {
  try {
    await fetch('/api/hc_bands', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ hc_bands: config.hc_bands })
    });
    await fetch('/api/devices', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ devices: config.devices })
    });
    dirty = false;
    document.getElementById('unsaved-dot').classList.remove('visible');
    toast('Configuration sauvegardée ✓');
  } catch(e) { toast('Erreur de sauvegarde', 'err'); }
}

/* ── HC Bands ── */
function renderHCBands() {
  const list = document.getElementById('hc-bands-list');
  list.innerHTML = '';
  config.hc_bands.forEach((band, i) => {
    const color = BAND_COLORS[i % BAND_COLORS.length];
    const row = document.createElement('div');
    row.className = 'hc-band-row';
    row.innerHTML = `
      <div class="hc-color-dot" style="background:${color}"></div>
      <input class="hc-band-label-input mono" type="text" value="${esc(band.label)}"
        placeholder="Libellé" oninput="updateHCBand('${band.id}','label',this.value)">
      <span class="hc-arrow">de</span>
      <input class="hc-time" type="time" value="${band.start}"
        onchange="updateHCBand('${band.id}','start',this.value)">
      <span class="hc-arrow">→</span>
      <input class="hc-time" type="time" value="${band.end}"
        onchange="updateHCBand('${band.id}','end',this.value)">
      <button class="btn-icon del" onclick="deleteHCBand('${band.id}')">✕</button>`;
    list.appendChild(row);
  });
}

function updateHCBand(id, key, val) {
  const b = config.hc_bands.find(b => b.id === id);
  if (b) { b[key] = val; markDirty(); }
}
function deleteHCBand(id) {
  config.hc_bands = config.hc_bands.filter(b => b.id !== id);
  renderHCBands(); markDirty();
}
function addHCBand() {
  config.hc_bands.push({ id:'hc_'+Date.now(), label:`HC ${config.hc_bands.length+1}`, start:'08:00', end:'10:00' });
  renderHCBands(); markDirty();
}

/* ── Devices ── */
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  grid.innerHTML = '';
  config.devices.forEach(dev => grid.appendChild(buildDeviceCard(dev)));
  const addCard = document.createElement('div');
  addCard.className = 'add-device-card';
  addCard.innerHTML = '<span style="font-size:20px">+</span> Ajouter un appareil';
  addCard.onclick = addDevice;
  grid.appendChild(addCard);
}

function buildDeviceCard(dev) {
  const card = document.createElement('div');
  card.className = 'device-card' + (dev.visible ? '' : ' hidden-device');
  card.dataset.id = dev.id;
  card.innerHTML = `
    <div class="device-card-header">
      <div class="icon-picker" id="icon-picker-${dev.id}">
        <button class="icon-trigger" onclick="toggleIconPicker('${dev.id}')">${ICONS_MAP[dev.icon]||'⚡'}</button>
        <div class="icon-dropdown hidden" id="icon-dropdown-${dev.id}">
          ${Object.entries(ICONS_MAP).map(([k,v]) => `<div class="icon-opt" onclick="pickIcon('${dev.id}','${k}')">${v}</div>`).join('')}
        </div>
      </div>
      <input class="device-card-name" type="text" value="${esc(dev.name)}" placeholder="Nom de l'appareil"
        oninput="updateDevice('${dev.id}','name',this.value)">
      <div class="device-card-actions">
        <label class="toggle" title="${dev.visible?'Visible':'Masqué'}">
          <input type="checkbox" ${dev.visible?'checked':''} onchange="updateDevice('${dev.id}','visible',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon del" onclick="deleteDevice('${dev.id}')">🗑</button>
      </div>
    </div>
    <div class="device-card-body">
      <div class="device-meta">
        <div class="meta-item">
          <span class="label-xs">Mode différé</span>
          <div class="mode-pills">
            <div class="mode-pill ${dev.mode==='fin'?'active':''}" onclick="updateDeviceMode('${dev.id}','fin')">Fin différée</div>
            <div class="mode-pill ${dev.mode==='depart'?'active':''}" onclick="updateDeviceMode('${dev.id}','depart')">Départ différé</div>
          </div>
        </div>
      </div>
      <span class="label-xs">Programmes</span>
      <div class="programs-list" id="progs-${dev.id}">
        ${dev.programs.map(p => buildProgramRow(dev.id, p)).join('')}
      </div>
      <button class="add-prog-btn" onclick="addProgram('${dev.id}')">+ Ajouter un programme</button>
    </div>`;
  return card;
}

function buildProgramRow(devId, prog) {
  return `<div class="program-row" id="prog-row-${prog.id}">
    <input class="prog-name-input" type="text" value="${esc(prog.name)}" placeholder="Programme"
      oninput="updateProgram('${devId}','${prog.id}','name',this.value)">
    <div class="prog-dur-wrap">
      <input class="prog-dur-input" type="number" min="0" max="23" value="${prog.dur_h}"
        oninput="updateProgram('${devId}','${prog.id}','dur_h',parseInt(this.value)||0)">
      <span class="prog-dur-label">h</span>
      <span class="prog-dur-sep">:</span>
      <input class="prog-dur-input" type="number" min="0" max="59" value="${prog.dur_m}"
        oninput="updateProgram('${devId}','${prog.id}','dur_m',parseInt(this.value)||0)">
      <span class="prog-dur-label">min</span>
    </div>
    <button class="btn-icon del" onclick="deleteProgram('${devId}','${prog.id}')">✕</button>
  </div>`;
}

function updateDevice(devId, key, val) {
  const dev = config.devices.find(d => d.id === devId);
  if (!dev) return;
  dev[key] = val;
  if (key === 'visible') {
    const card = document.querySelector(`.device-card[data-id="${devId}"]`);
    if (card) card.classList.toggle('hidden-device', !val);
  }
  markDirty();
}

function updateDeviceMode(devId, mode) {
  const dev = config.devices.find(d => d.id === devId);
  if (!dev) return;
  dev.mode = mode;
  const card = document.querySelector(`.device-card[data-id="${devId}"]`);
  if (card) card.querySelectorAll('.mode-pill').forEach(p => {
    p.classList.toggle('active', (mode==='fin' && p.textContent.includes('Fin')) || (mode==='depart' && p.textContent.includes('Départ')));
  });
  markDirty();
}

function deleteDevice(devId) {
  if (!confirm('Supprimer cet appareil ?')) return;
  config.devices = config.devices.filter(d => d.id !== devId);
  renderDevices(); markDirty();
}

function addDevice() {
  const dev = { id:'dev_'+Date.now(), name:'Nouvel appareil', icon:'bolt', mode:'fin', visible:true, programs:[] };
  config.devices.push(dev);
  renderDevices(); markDirty();
  setTimeout(() => {
    const card = document.querySelector(`.device-card[data-id="${dev.id}"]`);
    if (card) { card.scrollIntoView({behavior:'smooth',block:'center'}); card.querySelector('.device-card-name')?.select(); }
  }, 50);
}

function toggleIconPicker(devId) {
  const dd = document.getElementById(`icon-dropdown-${devId}`);
  dd.classList.toggle('hidden');
  document.querySelectorAll('.icon-dropdown').forEach(el => { if (el.id !== `icon-dropdown-${devId}`) el.classList.add('hidden'); });
}

function pickIcon(devId, iconKey) {
  updateDevice(devId, 'icon', iconKey);
  const trigger = document.querySelector(`#icon-picker-${devId} .icon-trigger`);
  if (trigger) trigger.textContent = ICONS_MAP[iconKey] || '⚡';
  document.getElementById(`icon-dropdown-${devId}`).classList.add('hidden');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.icon-picker')) document.querySelectorAll('.icon-dropdown').forEach(el => el.classList.add('hidden'));
});

function updateProgram(devId, progId, key, val) {
  const dev = config.devices.find(d => d.id === devId);
  if (!dev) return;
  const prog = dev.programs.find(p => p.id === progId);
  if (prog) { prog[key] = val; markDirty(); }
}

function deleteProgram(devId, progId) {
  const dev = config.devices.find(d => d.id === devId);
  if (!dev) return;
  dev.programs = dev.programs.filter(p => p.id !== progId);
  document.getElementById(`prog-row-${progId}`)?.remove();
  markDirty();
}

function addProgram(devId) {
  const dev = config.devices.find(d => d.id === devId);
  if (!dev) return;
  const prog = { id:'p_'+Date.now(), name:'Nouveau programme', dur_h:1, dur_m:0 };
  dev.programs.push(prog);
  const list = document.getElementById(`progs-${devId}`);
  if (list) {
    const tmp = document.createElement('div');
    tmp.innerHTML = buildProgramRow(devId, prog);
    list.appendChild(tmp.firstElementChild);
    list.lastElementChild?.querySelector('.prog-name-input')?.select();
  }
  markDirty();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue=''; } });
document.addEventListener('DOMContentLoaded', init);

// ── Theme (shared with app.js) ───────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('hc-theme', t);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === t);
  });
}

// Restore saved theme on load
(function() {
  const saved = localStorage.getItem('hc-theme') || 'auto';
  document.documentElement.setAttribute('data-theme', saved);
})();
