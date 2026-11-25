/* Inventario de dispositivos de almacenamiento público temporal de RR.SS. – MPO
   Aplicación local (sin servidor): datos en el navegador (localStorage) y fotos en IndexedDB.
   Funciona en PC y celular; instalable como app (PWA) cuando se publica en https. */
'use strict';
{
const LS_KEY = 'rrss_otuzco_v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, d = 0) => (n === '' || n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('es-PE', {minimumFractionDigits:d, maximumFractionDigits:d});
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const hoy = () => new Date().toISOString().slice(0, 19);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/* ---------- Catálogos ---------- */
const CAT_DEF = {
  tipos: [{n:'Contenedor',p:'CON'},{n:'Papelera',p:'PAP'},{n:'Punto Limpio',p:'PLI'}],
  sectores: [['S. Central','CEN'],['S. Ramón Castilla','RCA'],['S. San Antonio','SAN'],['S. Chologday','CHO'],['S. San Remigio','SRE'],['S. Cruz Blanca','CBL'],['S. Santa Rosa','SRO'],['S. La Retama','LRE'],['S. La Ermita','LER'],['S. Walter Acevedo','WAC'],['S. Tupullo','TUP'],['S. El Olivo','OLI']],
  ubicaciones: ['Vías principales (Psj, Jr, Ca, Av)','Parques y plazuelas','Mercado','Puentes','Paraderos','Escalinatas Mirador Natural Chologday','Instituciones educativas','Otros'],
  materiales: ['Plástico HDP','Acero inoxidable','Metal'],
  estados: ['Bueno','Regular','Malo'],
  colores: ['Verde','Marrón','Negro','Rojo','Blanco','Azul','Amarillo','Gris','Gris con verde','Celeste','Verde oscuro','Azul oscuro','Gris con azul','Gris con rojo','Gris con tapa verde'],
  senalizacion: ['Corporativa (Logo)','Informativa','Seguridad','Rotulado NTP 900.058'],
  accesorios: ['Tapa','Ruedas','Boca Accesible','Palanca Accesible','Pedal','Seguros','Soporte','Soporte Fijo','Soporte de giro','Freno en ruedas','Tapón de drenaje','Techo antilluvia'],
  defectos: ['Envejecido general','Suciedad incrustada','Tapa mal estado','Soporte mal estado','Cuerpo mal estado','Seguros mal estado','Pintadas','Ruedas mal estado','Pedal mal estado','Presenta rajaduras','Corrosión','Faltante / robado','Quemado'],
  llenado: ['0–25 %','26–50 %','51–75 %','76–100 %','Desborde (>100 %)'],
  /* Capacidades del inventario con sus dimensiones registradas (L × A × H, m) */
  capacidades: [[50,0.2,0.3,0.5],[120,0.55,0.48,0.94],[140,1.13,0.44,0.475],[180,0.73,0.48,1.075],[200,0.48,0.48,0.88],[240,0.73,0.58,1.075],[360,0.88,0.6,1.1],[660,1.11,0.65,0.9],[1100,1.11,0.95,1.0]]
};
/* Referencia comercial (dimensiones exteriores típicas EN 840; varían ±5 % según fabricante) */
const REF_COM = [
  {cap:120, w:.48, d:.555, h:.93,  ruedas:2, norma:'EN 840-1', carga:48},
  {cap:140, w:.48, d:.555, h:1.065,ruedas:2, norma:'EN 840-1', carga:56},
  {cap:180, w:.48, d:.73,  h:1.075,ruedas:2, norma:'EN 840-1', carga:72},
  {cap:240, w:.58, d:.73,  h:1.075,ruedas:2, norma:'EN 840-1', carga:96},
  {cap:360, w:.60, d:.88,  h:1.10, ruedas:2, norma:'EN 840-1', carga:144},
  {cap:660, w:1.26,d:.78,  h:1.22, ruedas:4, norma:'EN 840-2', carga:264},
  {cap:1100,w:1.37,d:1.07, h:1.46, ruedas:4, norma:'EN 840-3', carga:440}
];
const NTP_MUNI = {Verde:'Aprovechables', 'Marrón':'Orgánicos', Negro:'No aprovechables', Rojo:'Peligrosos'};
const NTP_NOMUNI = {Amarillo:'Metales', Verde:'Vidrio', Azul:'Papel y cartón', Blanco:'Plástico', 'Marrón':'Orgánicos', Rojo:'Peligrosos', Negro:'Generales'};
const VIDA_DEF = {'Plástico HDP':8, 'Metal':6, 'Acero inoxidable':12};
const PRIORIDADES = ['1-ALTA: Reemplazo','2-MEDIA: Mantenimiento / reparación','3-BAJA: Limpieza y seguimiento','4-NINGUNA: Conservar'];

/* ---------- Estado ---------- */
let S = null;
function load() {
  try { const t = localStorage.getItem(LS_KEY); if (t) S = JSON.parse(t); } catch (e) {}
  if (!S || !Array.isArray(S.devices)) S = {devices: JSON.parse(JSON.stringify(window.DATA_INICIAL || [])), cat: null, set: {}};
  S.cat = Object.assign(JSON.parse(JSON.stringify(CAT_DEF)), S.cat || {});
  S.set = Object.assign({responsable:'', anioRef:'', vida:{...VIDA_DEF}, densidad:200, llenadoUtil:0.85}, S.set || {});
  S.filtros = S.filtros || {};
  S.borrados = S.borrados || [];
  S.auth = S.auth || null;
}
function save(msg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); estadoDrive(); if (msg) programarSync(); }
  catch (e) { toast('No se pudo guardar en este navegador: ' + e.message + '. Exporte un respaldo.'); }
  if (msg) toast(msg);
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3500); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

/* ---------- Fotos (IndexedDB) ---------- */
const DB = {
  db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((ok, ko) => { const r = indexedDB.open('rrss_fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(this.db = r.result); r.onerror = () => ko(r.error); }); },
  async put(k, v) { const d = await this.open(); return new Promise((ok, ko) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = ok; t.onerror = () => ko(t.error); }); },
  async get(k) { const d = await this.open(); return new Promise(ok => { const r = d.transaction('f').objectStore('f').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); },
  async del(k) { const d = await this.open(); return new Promise(ok => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').delete(k); t.oncomplete = ok; }); }
};
function resizeImg(file, max = 1280) {
  return new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = ko; im.src = fr.result; };
    fr.onerror = ko; fr.readAsDataURL(file);
  });
}

/* ---------- Coordenadas UTM WGS84 ---------- */
const A_ = 6378137, F_ = 1 / 298.257223563, K0 = 0.9996, E2 = F_ * (2 - F_), EP2 = E2 / (1 - E2);
function toUTM(lat, lon, zone = 17) {
  const r = Math.PI / 180, p = lat * r, l0 = ((zone - 1) * 6 - 180 + 3) * r;
  const N = A_ / Math.sqrt(1 - E2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = EP2 * Math.cos(p) ** 2, A = Math.cos(p) * (lon * r - l0);
  const e4 = E2 * E2, e6 = e4 * E2;
  const M = A_ * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * p - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * p) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * p) - (35 * e6 / 3072) * Math.sin(6 * p));
  const E = K0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * A ** 5 / 120) + 500000;
  let No = K0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * A ** 6 / 720));
  if (lat < 0) No += 10000000;
  return {e: Math.round(E), n: Math.round(No)};
}
function fromUTM(E, N, zone = 17, south = true) {
  const x = E - 500000, y = south ? N - 10000000 : N, e4 = E2 * E2, e6 = e4 * E2;
  const mu = (y / K0) / (A_ * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const N1 = A_ / Math.sqrt(1 - E2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = EP2 * Math.cos(p1) ** 2;
  const R1 = A_ * (1 - E2) / Math.pow(1 - E2 * Math.sin(p1) ** 2, 1.5), D = x / (N1 * K0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
  return {lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI};
}
const zoneNum = z => parseInt(z, 10) || 17;
const isSouth = z => { const l = String(z || '').trim().toUpperCase().replace(/^\d+\s*/, ''); return !l || l === 'S' || (l >= 'C' && l <= 'M'); };

/* ---------- Cálculos por dispositivo ---------- */
function anioRef() { return Number(S.set.anioRef) || new Date().getFullYear(); }
function calc(r) {
  const q = Number(r.cantidad) || 0, cap = Number(r.capacidad) || 0;
  const L = +r.largo, A = +r.ancho, H = +r.alto;
  const vgeo = L && A && H ? L * A * H * 1000 : null;
  const a1 = +r.int_a1, b1 = +r.int_b1, a2 = +r.int_a2, b2 = +r.int_b2, hi = +r.int_h;
  let vint = null;
  if (a1 && b1 && hi) { const S1 = a1 * b1, S2 = (a2 && b2) ? a2 * b2 : S1; vint = hi / 3 * (S1 + S2 + Math.sqrt(S1 * S2)) * 1000; }
  const ratio = vgeo && cap ? cap / vgeo : null;
  let ver = 'Sin datos', cls = 'info', capCorr = cap, nota = 'Faltan dimensiones para verificar el volumen.';
  if (vint) {
    capCorr = Math.min(cap || vint, vint);
    if (!cap || vint >= cap * 0.95) { ver = 'Conforme (medición interior)'; cls = 'ok'; nota = 'Volumen interior medido ' + fmt(vint) + ' L ≥ nominal.'; }
    else { ver = 'Menor a la nominal (medición interior)'; cls = 'bad'; nota = 'El volumen interior medido (' + fmt(vint) + ' L) es ' + fmt(100 - vint / cap * 100) + ' % menor que la capacidad declarada.'; }
  } else if (ratio != null) {
    if (ratio > 1.0) { ver = 'Inconsistente'; cls = 'bad'; capCorr = Math.min(cap, vgeo * 0.9); nota = 'La capacidad declarada (' + fmt(cap) + ' L) supera el volumen de la caja envolvente (' + fmt(vgeo) + ' L): es físicamente imposible. Volver a medir o corregir la capacidad.'; }
    else if (ratio > 0.85) { ver = 'Dudoso'; cls = 'warn'; capCorr = Math.min(cap, vgeo * 0.9); nota = 'Capacidad ≈ volumen envolvente (' + fmt(ratio * 100) + ' %). Un recipiente real con paredes, conicidad y tapa rinde 45–60 % de su caja exterior. Medidas probablemente interiores o capacidad sobrestimada.'; }
    else if (ratio >= 0.40) { ver = 'Coherente'; cls = 'ok'; nota = 'Relación capacidad / caja exterior ' + fmt(ratio * 100) + ' %, dentro del rango de recipientes comerciales (45–60 %).'; }
    else { ver = 'Revisar'; cls = 'warn'; nota = 'La caja exterior es más de 2,5 veces la capacidad: medidas erróneas o capacidad subestimada.'; }
  }
  const ref = REF_COM.find(x => x.cap === cap);
  let refTxt = '';
  if (ref && vgeo) {
    const m = [L, A, H].sort((x, y) => x - y), rr = [ref.w, ref.d, ref.h].sort((x, y) => x - y);
    const dev = Math.max(...m.map((v, i) => Math.abs(v - rr[i]) / rr[i]));
    refTxt = dev <= 0.1 ? 'Coincide con medidas comerciales ' + ref.norma : 'Difiere ' + fmt(dev * 100) + ' % de la referencia ' + ref.norma + ' (' + [ref.w, ref.d, ref.h].map(v => fmt(v, 2)).join(' × ') + ' m)';
  } else if (cap && !ref) refTxt = cap <= 60 ? 'Papelera: sin norma de dimensiones; exigir capacidad útil medida' : 'Capacidad no estándar EN 840 (120/140/180/240/360/660/1100 L)';
  const defs = split(r.defectos).filter(d => d !== 'No presenta');
  const ant = r.anio ? anioRef() - Number(r.anio) : null;
  const vida = S.set.vida[r.material] || 8;
  let pri = PRIORIDADES[3];
  if (r.estado === 'Malo') pri = PRIORIDADES[0]; else if (r.estado === 'Regular') pri = PRIORIDADES[1]; else if (defs.length) pri = PRIORIDADES[2];
  const finVida = ant != null && ant >= vida;
  const rango = !cap ? '' : cap <= 50 ? 'R1: Hasta 50 L' : cap <= 240 ? 'R2: 51 – 240 L' : cap <= 660 ? 'R3: 241 – 660 L' : 'R4: Más de 660 L';
  const tipoDef = S.cat.tipos.find(t => t.n === r.tipo);
  const sec = S.cat.sectores.find(s => s[0] === r.sector);
  return {q, cap, capTotal: q * cap, capCorrTotal: q * capCorr, capCorr, vgeo, vint, ratio, ver, cls, nota, refTxt, defs, nDef: defs.length, ant, vida, finVida, pri, rango,
    pref: tipoDef ? tipoDef.p : '', codSec: sec ? sec[1] : '', ntp: ntpColor(r)};
}
function ntpColor(r) {
  const cols = split(r.color);
  if (r.tipo !== 'Punto Limpio') return {ok: null, txt: 'Recipiente único: rotular la fracción que recibe.'};
  const muni = cols.filter(c => NTP_MUNI[c]);
  if (cols.length && muni.length === cols.length) return {ok: true, txt: 'Colores del ámbito municipal NTP 900.058:2019.'};
  const fuera = cols.filter(c => !NTP_MUNI[c]);
  return {ok: false, txt: 'Usa ' + fuera.join(', ') + ' (esquema no municipal o fuera de norma). Para espacio público: Verde aprovechables, Marrón orgánicos, Negro no aprovechables (+ Rojo peligrosos si hay recojo diferenciado).'};
}

/* ---------- Filtros ---------- */
function filtrar() {
  const f = S.filtros, t = (f.q || '').toLowerCase();
  return S.devices.filter(r => {
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.sector && r.sector !== f.sector) return false;
    if (f.ubicacion && r.ubicacion !== f.ubicacion) return false;
    if (f.estado && r.estado !== f.estado) return false;
    if (f.material && r.material !== f.material) return false;
    if (f.pri && calc(r).pri !== f.pri) return false;
    if (f.alerta === 'vol' && !['bad', 'warn'].includes(calc(r).cls)) return false;
    if (f.alerta === 'vida' && !calc(r).finVida) return false;
    if (f.alerta === 'sen' && !(split(r.senalizacion).length === 0 || r.senalizacion === 'Ninguna')) return false;
    if (f.alerta === 'llen' && !/Desborde|76/.test(r.llenado || '')) return false;
    if (t && !(r.codigo + ' ' + r.direccion + ' ' + r.obs + ' ' + r.defectos + ' ' + r.color).toLowerCase().includes(t)) return false;
    return true;
  });
}
function siguienteCodigo(tipo) {
  const p = (S.cat.tipos.find(t => t.n === tipo) || {}).p || 'DIS';
  const max = S.devices.filter(r => (r.codigo || '').startsWith(p + '-')).map(r => parseInt(r.codigo.split('-')[1], 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return p + '-' + String(max + 1).padStart(3, '0');
}

/* ---------- Router ---------- */
const VIEWS = {panel, inventario, nuevo: arg => formulario(null, arg), editar: id => formulario(id), ficha, inspeccion, mapa, tecnico, diseno, datos};
let mapObj = null;
function route() {
  const [v, id] = (location.hash.slice(1) || 'panel').split('/');
  alSalir.forEach(f => { try { f(); } catch (e) {} }); alSalir = [];
  if (requiereLogin()) { if (mapObj) { mapObj.remove(); mapObj = null; } return pantallaLogin(); }
  $('#tabs').hidden = false;
  const fn = VIEWS[v] || panel;
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v || (v === 'editar' && a.dataset.v === 'nuevo') || ((v === 'ficha' || v === 'inspeccion') && a.dataset.v === 'inventario')));
  if (mapObj) { mapObj.remove(); mapObj = null; }
  $('#view').innerHTML = '';
  fn(id ? decodeURIComponent(id) : undefined);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- Componentes ---------- */
const opts = (arr, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + arr.map(o => `<option ${o == sel ? 'selected' : ''}>${esc(o)}</option>`).join('');
const pill = e => `<span class="pill p-${esc(e)}">${esc(e || '–')}</span>`;
const priPill = p => `<span class="pill ${p.startsWith('1') ? 'p-bad' : p.startsWith('2') ? 'p-warn' : p.startsWith('3') ? 'p-info' : 'p-ok'}">${esc(p.split(':')[0])}</span>`;
function barras(items, total, color = 'c-brand', unit = '') {
  const mx = Math.max(1, ...items.map(i => i[1]));
  return `<div class="bars">${items.map(([k, v, extra]) => `<div class="bar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><span class="trk"><i class="${color}" style="width:${v / mx * 100}%"></i></span><span class="v">${fmt(v)}${unit}${extra ? ' <span class="mut small">' + extra + '</span>' : ''}</span></div>`).join('')}</div>`;
}
function apiladas(grupos) { /* grupos: [nombre, {Bueno,Regular,Malo}] */
  const mx = Math.max(1, ...grupos.map(g => g[1].Bueno + g[1].Regular + g[1].Malo));
  return `<div class="leg"><span><i class="c-ok"></i>Bueno</span><span><i class="c-warn"></i>Regular</span><span><i class="c-bad"></i>Malo</span></div><div class="bars">${grupos.map(([k, o]) => { const t = o.Bueno + o.Regular + o.Malo; return `<div class="bar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><span class="trk" style="width:${t / mx * 100}%">${['Bueno', 'Regular', 'Malo'].map(e => o[e] ? `<i class="${e === 'Bueno' ? 'c-ok' : e === 'Regular' ? 'c-warn' : 'c-bad'}" style="width:${o[e] / t * 100}%" title="${e}: ${o[e]}"></i>` : '').join('')}</span><span class="v">${fmt(t)}</span></div>`; }).join('')}</div>`;
}
function agrupar(arr, key, val = r => Number(r.cantidad) || 0) { const m = {}; arr.forEach(r => { const k = typeof key === 'function' ? key(r) : r[key]; m[k] = (m[k] || 0) + val(r); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }
function porEstado(arr, key) { const m = {}; arr.forEach(r => { const k = r[key] || '–'; m[k] = m[k] || {Bueno:0, Regular:0, Malo:0}; m[k][r.estado] = (m[k][r.estado] || 0) + (Number(r.cantidad) || 0); }); return Object.entries(m).sort((a, b) => (b[1].Bueno + b[1].Regular + b[1].Malo) - (a[1].Bueno + a[1].Regular + a[1].Malo)); }

/* ---------- PANEL ---------- */
function totales(arr) {
  const t = {reg: arr.length, und: 0, cap: 0, capCorr: 0, b: 0, r: 0, m: 0, vol: 0, vida: 0, sinSen: 0, desb: 0};
  arr.forEach(d => { const c = calc(d); t.und += c.q; t.cap += c.capTotal; t.capCorr += c.capCorrTotal; if (d.estado === 'Bueno') t.b += c.q; if (d.estado === 'Regular') t.r += c.q; if (d.estado === 'Malo') t.m += c.q; if (c.cls === 'bad' || c.cls === 'warn') t.vol++; if (c.finVida) t.vida += c.q; if (!d.senalizacion || d.senalizacion === 'Ninguna') t.sinSen++; if (/Desborde/.test(d.llenado || '')) t.desb++; });
  return t;
}
function panel() {
  const D = S.devices, t = totales(D);
  const defs = {}; D.forEach(r => calc(r).defs.forEach(x => defs[x] = (defs[x] || 0) + 1));
  const pri = {}; D.forEach(r => { const p = calc(r).pri; pri[p] = (pri[p] || 0) + (Number(r.cantidad) || 0); });
  const ult = [...D].sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || '')).slice(0, 5);
  $('#view').innerHTML = `
  <div class="head"><div><h1>${fmt(pct(t.b, t.und))} % de las unidades están en buen estado</h1>
  <p class="mut">${fmt(t.reg)} puntos registrados · ${fmt(t.und)} unidades · ${fmt(t.r)} requieren mantenimiento y ${fmt(t.m)} reemplazo. Año de referencia ${anioRef()}.</p></div>
  <div class="row noprint"><a class="btn pri" href="#nuevo">+ Registrar dispositivo</a><a class="btn" href="#inventario">Actualizar estado</a></div></div>
  <div class="kpis">
    <div class="kpi hl"><b>${fmt(t.und)}</b><span>unidades en ${fmt(t.reg)} puntos</span></div>
    <div class="kpi"><b>${fmt(t.cap / 1000, 1)} m³</b><span>capacidad declarada</span></div>
    <div class="kpi w"><b>${fmt(t.capCorr / 1000, 1)} m³</b><span>capacidad verificable (−${fmt(100 - t.capCorr / t.cap * 100)} %)</span></div>
    <div class="kpi x"><b>${fmt(t.m)}</b><span>unidades a reemplazar</span></div>
    <div class="kpi w"><b>${fmt(t.r)}</b><span>unidades a mantener</span></div>
    <div class="kpi"><b>${fmt(t.vida)}</b><span>unidades al fin de su vida útil</span></div>
    <div class="kpi"><b>${fmt(pct(t.sinSen, t.reg))} %</b><span>puntos sin señalización</span></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Unidades por tipo y estado</h3>${apiladas(porEstado(D, 'tipo'))}</div>
    <div class="card"><h3>Unidades por sector y estado</h3>${apiladas(porEstado(D, 'sector'))}</div>
    <div class="card"><h3>Unidades por ubicación y estado</h3>${apiladas(porEstado(D, 'ubicacion'))}</div>
    <div class="card"><h3>Defectos más frecuentes <span class="mut small">(n.º de puntos)</span></h3>${barras(Object.entries(defs).sort((a, b) => b[1] - a[1]), 0, 'c-bad')}</div>
    <div class="card"><h3>Prioridad de acción <span class="mut small">(unidades)</span></h3>${barras(PRIORIDADES.map(p => [p, pri[p] || 0]), 0, 'c-info')}</div>
    <div class="card"><h3>Unidades por año de instalación</h3>${barras(agrupar(D, 'anio').sort((a, b) => a[0] - b[0]).map(([k, v]) => [k + ' (' + (anioRef() - k) + ' años)', v]), 0, 'c-brand')}</div>
    <div class="card"><h3>Capacidad instalada por tipo <span class="mut small">(litros declarados)</span></h3>${barras(agrupar(D, 'tipo', r => calc(r).capTotal), 0, 'c-brand', ' L')}</div>
    <div class="card"><h3>Últimas actualizaciones</h3><ul class="hist">${ult.map(r => `<li><a href="#ficha/${esc(r.id)}"><b>${esc(r.codigo)}</b></a> · ${esc(r.direccion)}<br><span class="mut small">${esc((r.actualizado || '').replace('T', ' ').slice(0, 16))} · ${esc((r.historial || []).slice(-1)[0]?.usuario || '')}</span></li>`).join('')}</ul></div>
  </div>
  <a class="btn pri fab noprint" href="#nuevo">+ Registrar</a>`;
}

/* ---------- INVENTARIO ---------- */
function inventario() {
  const f = S.filtros;
  $('#view').innerHTML = `
  <div class="head"><div><h1>Inventario</h1><p class="mut">Toque un registro para ver su ficha, inspeccionarlo o editarlo.</p></div>
  <div class="row noprint"><button class="btn sm" id="limpiar" type="button">Limpiar filtros</button><button class="btn sm" id="xlsF" type="button">Exportar lo filtrado (Excel)</button></div></div>
  <div class="filters noprint">
    <div><label for="f_q">Buscar</label><input id="f_q" placeholder="Código, dirección, defecto…" value="${esc(f.q || '')}"></div>
    <div><label for="f_tipo">Tipo</label><select id="f_tipo">${opts(S.cat.tipos.map(t => t.n), f.tipo, '(Todos)')}</select></div>
    <div><label for="f_sector">Sector</label><select id="f_sector">${opts(S.cat.sectores.map(s => s[0]), f.sector, '(Todos)')}</select></div>
    <div><label for="f_ubicacion">Ubicación</label><select id="f_ubicacion">${opts(S.cat.ubicaciones, f.ubicacion, '(Todas)')}</select></div>
    <div><label for="f_estado">Estado</label><select id="f_estado">${opts(S.cat.estados, f.estado, '(Todos)')}</select></div>
    <div><label for="f_material">Material</label><select id="f_material">${opts(S.cat.materiales, f.material, '(Todos)')}</select></div>
    <div><label for="f_pri">Prioridad</label><select id="f_pri">${opts(PRIORIDADES, f.pri, '(Todas)')}</select></div>
    <div><label for="f_alerta">Alerta técnica</label><select id="f_alerta"><option value="">(Ninguna)</option>${[['vol', 'Volumen inconsistente/dudoso'], ['vida', 'Fin de vida útil'], ['sen', 'Sin señalización'], ['llen', 'Llenado ≥ 76 % o desborde']].map(([v, t]) => `<option value="${v}" ${f.alerta === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
  </div>
  <div id="lista"></div>
  <a class="btn pri fab noprint" href="#nuevo">+ Registrar</a>`;
  const pintar = () => {
    const L = filtrar(), t = totales(L);
    $('#lista').innerHTML = `<p class="small mut">${fmt(t.reg)} registros · ${fmt(t.und)} unidades · ${fmt(t.cap)} L declarados · ${fmt(t.b)} buenas, ${fmt(t.r)} regulares, ${fmt(t.m)} malas</p>
    <div class="scroll"><table class="stack"><thead><tr><th>Código</th><th>Tipo</th><th>Sector</th><th>Dirección / referencia</th><th class="n">Und</th><th class="n">Cap. (L)</th><th>Estado</th><th>Prioridad</th><th>Volumen</th><th class="n">Año</th></tr></thead><tbody>
    ${L.map(r => { const c = calc(r); return `<tr class="click" data-id="${esc(r.id)}"><td data-l="Código"><b>${esc(r.codigo)}</b></td><td data-l="Tipo">${esc(r.tipo)}</td><td data-l="Sector">${esc(r.sector)}</td><td data-l="Dirección" class="full">${esc(r.direccion)}</td><td data-l="Und" class="n">${fmt(c.q)}</td><td data-l="Cap. (L)" class="n">${fmt(c.cap)}</td><td data-l="Estado">${pill(r.estado)}</td><td data-l="Prioridad">${priPill(c.pri)}</td><td data-l="Volumen"><span class="pill p-${c.cls}">${esc(c.ver)}</span></td><td data-l="Año" class="n">${esc(r.anio || '–')}</td></tr>`; }).join('') || '<tr><td colspan="10">Ningún registro coincide con los filtros.</td></tr>'}
    </tbody></table></div>`;
    $$('#lista tr.click').forEach(tr => tr.onclick = () => location.hash = 'ficha/' + tr.dataset.id);
  };
  $$('.filters input,.filters select').forEach(el => el[el.tagName === 'INPUT' ? 'oninput' : 'onchange'] = () => { S.filtros[el.id.slice(2)] = el.value; save(); pintar(); });
  $('#limpiar').onclick = () => { S.filtros = {}; save(); inventario(); };
  $('#xlsF').onclick = () => exportarExcel(filtrar(), 'filtrado');
  pintar();
}

/* ---------- Dibujo del dispositivo ---------- */
function dibujo(r) {
  const c = calc(r), col = {Verde:'#2e8b57', 'Marrón':'#7a4b2a', Negro:'#2a2a2a', Rojo:'#c0392b', Blanco:'#f2f2f2', Azul:'#2864b4', Amarillo:'#e6b800', Gris:'#8a8f93', Celeste:'#69b7e3', 'Verde oscuro':'#1d5b3a', 'Azul oscuro':'#1d3b6b'};
  const cols = split(r.color).map(x => col[x] || col[x.split(' ')[0]] || '#8a8f93');
  const n = Math.min(Math.max(c.q, 1), 5), H = +r.alto || 1, W = +r.largo || 0.5, k = 150 / Math.max(H, W * n, 0.6);
  const w = W * k, h = H * k, gap = 8, tot = n * w + (n - 1) * gap, x0 = (240 - tot) / 2, base = 190;
  let s = `<svg class="devfig" viewBox="0 0 240 230" role="img" aria-label="Esquema a escala"><line x1="10" y1="${base}" x2="230" y2="${base}" stroke="currentColor" opacity=".4"/>`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap), fill = cols[i % cols.length] || '#8a8f93', top = base - h;
    s += `<path d="M${x + w * 0.06} ${top + 6} L${x + w * 0.94} ${top + 6} L${x + w * 0.88} ${base - 6} L${x + w * 0.12} ${base - 6} Z" fill="${fill}" stroke="rgba(0,0,0,.35)"/><rect x="${x}" y="${top}" width="${w}" height="7" rx="2" fill="${fill}" stroke="rgba(0,0,0,.35)"/>`;
    if (/Ruedas/.test(r.accesorios)) s += `<circle cx="${x + w * 0.22}" cy="${base - 4}" r="4" fill="#222"/><circle cx="${x + w * 0.78}" cy="${base - 4}" r="4" fill="#222"/>`;
  }
  s += `<text x="120" y="${base + 20}" text-anchor="middle" font-size="12" fill="currentColor">${fmt(W, 2)} m × ${fmt(+r.ancho, 2)} m × ${fmt(H, 2)} m · ${fmt(c.cap)} L c/u</text></svg>`;
  return s;
}

/* ---------- FICHA ---------- */
function ficha(id) {
  const r = S.devices.find(d => d.id === id);
  if (!r) { $('#view').innerHTML = '<p>Registro no encontrado. <a href="#inventario">Volver</a></p>'; return; }
  const c = calc(r), ll = r.este && r.norte ? fromUTM(+r.este, +r.norte, zoneNum(r.zona), isSouth(r.zona)) : null;
  $('#view').innerHTML = `
  <div class="head"><div><p class="mut small"><a href="#inventario">← Inventario</a></p><h1>${esc(r.codigo)} · ${esc(r.tipo)}</h1><p class="mut">${esc(r.direccion)} · ${esc(r.sector)}</p></div>
  <div class="row noprint"><a class="btn pri" href="#inspeccion/${esc(r.id)}">Inspeccionar / actualizar</a><a class="btn" href="#editar/${esc(r.id)}">Editar</a><button class="btn" type="button" onclick="print()">Imprimir ficha</button><button class="btn bad" id="del" type="button">Eliminar</button></div></div>
  <div class="ficha">
    <div class="card">
      <div class="row" style="margin-bottom:10px">${pill(r.estado)} ${priPill(c.pri)} <span class="pill p-${c.cls}">Volumen: ${esc(c.ver)}</span>${c.finVida ? '<span class="pill p-bad">Fin de vida útil</span>' : ''}</div>
      <dl class="kv">
        <dt>Código / sector</dt><dd>${esc(r.codigo)} · ${esc(c.codSec)}</dd>
        <dt>Ubicación</dt><dd>${esc(r.ubicacion)}</dd>
        <dt>Cantidad</dt><dd>${fmt(c.q)} und × ${fmt(c.cap)} L = <b>${fmt(c.capTotal)} L</b> (${esc(c.rango)})</dd>
        <dt>Dimensiones</dt><dd>${fmt(+r.largo, 2)} × ${fmt(+r.ancho, 2)} × ${fmt(+r.alto, 2)} m · caja ${fmt(c.vgeo)} L</dd>
        ${c.vint ? `<dt>Vol. interior medido</dt><dd>${fmt(c.vint)} L</dd>` : ''}
        <dt>Color(es)</dt><dd>${esc(r.color)}</dd>
        <dt>Material</dt><dd>${esc(r.material)}</dd>
        <dt>Señalización</dt><dd>${esc(r.senalizacion || 'Ninguna')}</dd>
        <dt>Accesorios</dt><dd>${esc(r.accesorios || 'Ninguno')}</dd>
        <dt>Defectos</dt><dd>${esc(c.defs.join(', ') || 'No presenta')} (${c.nDef})</dd>
        <dt>Año / antigüedad</dt><dd>${esc(r.anio || '–')} · ${c.ant ?? '–'} años (vida útil ref. ${c.vida} años)</dd>
        <dt>Llenado observado</dt><dd>${esc(r.llenado || 'Sin dato')}${r.alrededor === 'Sí' ? ' · residuos alrededor' : ''}${r.frecuencia ? ' · recojo ' + esc(r.frecuencia) + ' veces/semana' : ''}</dd>
        <dt>UTM ${esc(r.zona || '17M')}</dt><dd>E ${esc(r.este || '–')} · N ${esc(r.norte || '–')}${ll ? ` · <a href="https://www.google.com/maps?q=${ll.lat.toFixed(6)},${ll.lon.toFixed(6)}" target="_blank" rel="noopener">Abrir en Google Maps</a>` : ''}</dd>
        <dt>Observaciones</dt><dd>${esc(r.obs || '–')}</dd>
      </dl>
      <h3>Verificación técnica del volumen</h3>
      <div class="alert ${c.cls === 'ok' ? 'ok' : c.cls === 'bad' ? 'bad' : c.cls === 'info' ? 'info' : ''}">${esc(c.nota)}<br><span class="small">${esc(c.refTxt)}${c.capCorr !== c.cap ? ' · Capacidad verificable estimada: ' + fmt(c.capCorr) + ' L c/u.' : ''}</span></div>
      ${c.ntp.ok === false ? `<div class="alert">${esc(c.ntp.txt)}</div>` : c.ntp.ok ? `<div class="alert ok">${esc(c.ntp.txt)}</div>` : ''}
    </div>
    <div>
      <div class="card">${dibujo(r)}<h3>Fotografías georreferenciadas</h3><div class="fotos" id="thumbs"><span class="mut small">Sin fotos registradas.</span></div><div id="fichaMapa" class="minimapa" style="height:220px;margin-top:10px"></div>
      ${r.foto ? `<p class="small" style="margin-top:8px"><a href="${esc(r.foto)}" target="_blank" rel="noopener">Ver fotografía del inventario 2025 (Drive)</a></p>` : ''}</div>
      <div class="card" style="margin-top:16px"><h3>Historial de actualizaciones</h3><ul class="hist">${(r.historial || []).slice().reverse().map(h => `<li><b>${esc(h.tipo || 'Cambio')}</b> · ${esc((h.fecha || '').replace('T', ' ').slice(0, 16))} · ${esc(h.usuario || '')}${h.nota ? '<br>' + esc(h.nota) : ''}${Object.keys(h.cambios || {}).length ? '<br><span class="small mut">' + Object.entries(h.cambios).map(([k, v]) => esc(k) + ': ' + esc(v[0] ?? '') + ' → ' + esc(v[1] ?? '')).join(' · ') + '</span>' : ''}</li>`).join('')}</ul></div>
    </div>
  </div>`;
  $('#del').onclick = () => confirmar(`¿Eliminar ${r.codigo}? Esta acción no se puede deshacer (exporte un respaldo antes si tiene dudas).`, () => { fotosMeta(r).forEach(f => DB.del(f.k)); S.borrados.push({id: r.id, codigo: r.codigo, fecha: hoy(), por: (S.auth && S.auth.email) || S.set.responsable}); S.devices = S.devices.filter(d => d.id !== id); save('Registro eliminado'); location.hash = 'inventario'; });
  mostrarFotos(r);
}
async function mostrarFotos(r) {
  const box = $('#thumbs'), fs = fotosMeta(r);
  const pt = r.este && r.norte ? {e: +r.este, n: +r.norte} : null;
  if (box && fs.length) {
    box.innerHTML = '';
    for (const f of fs.slice().reverse()) {
      const src = await DB.get(f.k).catch(() => null);
      const dist = pt && f.e ? Math.round(Math.hypot(f.e - pt.e, f.n - pt.n)) : null;
      const fig = document.createElement('div'); fig.className = 'foto';
      fig.innerHTML = `${src ? `<a href="${src}" target="_blank" download="${esc(r.codigo)}_${esc(f.k)}.jpg"><img src="${src}" alt="Foto ${esc(r.codigo)}"></a>` : `<div class="sinimg">${f.url ? 'En Drive' : 'Sin copia local'}</div>`}
        <div class="small"><b>${esc((f.fecha || '').replace('T', ' ').slice(0, 16))}</b><br>${f.e ? `E ${esc(f.e)} · N ${esc(f.n)}${f.acc ? ' · ±' + esc(f.acc) + ' m' : ''}` : '<span style="color:var(--bad)">Sin coordenadas</span>'}<br>
        <span class="mut">${esc(f.origen || '')}${dist != null ? ' · a ' + dist + ' m del punto' : ''}</span><br>
        ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">✔ Ver en Drive</a>` : '<span class="pill p-warn">Pendiente de subir</span>'}
        ${dist != null && dist > 30 ? '<br><span class="pill p-bad">Foto lejos del punto: verificar</span>' : ''}</div>`;
      box.appendChild(fig);
    }
  }
  const mbox = $('#fichaMapa');
  if (!mbox || !window.L || !pt) { if (mbox) mbox.hidden = true; return; }
  const m = L.map(mbox, {scrollWheelZoom: false}); capaBase(m); alSalir.push(() => m.remove());
  const ll = fromUTM(pt.e, pt.n, zoneNum(r.zona), isSouth(r.zona)), b = [[ll.lat, ll.lon]];
  L.marker([ll.lat, ll.lon]).bindTooltip(r.codigo).addTo(m);
  fs.forEach(f => { if (f.lat) { b.push([f.lat, f.lon]); L.circleMarker([f.lat, f.lon], {radius: 6, color: '#fff', weight: 2, fillColor: '#c98a00', fillOpacity: 1}).bindTooltip('Foto ' + (f.fecha || '').slice(0, 10)).addTo(m); } });
  if (b.length > 1) m.fitBounds(b, {padding: [30, 30], maxZoom: 19}); else m.setView(b[0], 18);
  setTimeout(() => m.invalidateSize(), 150);
}
function confirmar(txt, ok) {
  const d = $('#dlg');
  $('#dlgBody').innerHTML = `<p>${esc(txt)}</p><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" value="no">Cancelar</button><button class="btn bad" value="si" id="dlgOk">Confirmar</button></div>`;
  d.onclose = () => { if (d.returnValue === 'si') ok(); };
  d.showModal();
}

/* ---------- INSPECCIÓN (actualización rápida en campo) ---------- */
function inspeccion(id) {
  const r = S.devices.find(d => d.id === id); if (!r) return ficha(id);
  const defs = split(r.defectos);
  $('#view').innerHTML = `
  <div class="head"><div><p class="mut small"><a href="#ficha/${esc(r.id)}">← Ficha ${esc(r.codigo)}</a></p><h1>Inspección de ${esc(r.codigo)}</h1><p class="mut">${esc(r.direccion)}</p></div></div>
  <form class="form" id="fi">
    <fieldset><legend>Estado observado</legend><div class="fg">
      <div><label for="i_estado">Estado actual</label><select id="i_estado">${opts(S.cat.estados, r.estado)}</select></div>
      <div><label for="i_cantidad">Cantidad encontrada (und)</label><input id="i_cantidad" type="number" min="0" inputmode="numeric" value="${esc(r.cantidad)}"></div>
      <div><label for="i_llenado">Nivel de llenado</label><select id="i_llenado">${opts(S.cat.llenado, r.llenado, '(Sin dato)')}</select></div>
      <div><label for="i_alrededor">¿Residuos dispersos alrededor?</label><select id="i_alrededor">${opts(['No', 'Sí'], r.alrededor, '(Sin dato)')}</select></div>
      <div><label for="i_frecuencia">Frecuencia de recojo (veces/semana)</label><input id="i_frecuencia" type="number" min="0" max="14" inputmode="numeric" value="${esc(r.frecuencia || '')}"></div>
      <div><label for="i_responsable">Responsable</label><input id="i_responsable" value="${esc(S.set.responsable)}" placeholder="Nombre del inspector"></div>
    </div>
    <label style="margin-top:12px">Defectos</label><div class="chips" id="i_defectos">${S.cat.defectos.map(d => `<label><input type="checkbox" value="${esc(d)}" ${defs.includes(d) ? 'checked' : ''}>${esc(d)}</label>`).join('')}</div>
    <div style="margin-top:12px"><label for="i_nota">Nota de la inspección / acción realizada</label><textarea id="i_nota" placeholder="Ej.: se lavó el contenedor; tapa rota, se solicita reposición"></textarea></div>
    <div style="margin-top:12px"><label for="i_foto">Fotografía georreferenciada (cámara)</label><input id="i_foto" type="file" accept="image/*" capture="environment" multiple></div>
    </fieldset>
    <div class="row"><button class="btn pri" type="submit">Guardar inspección</button><a class="btn" href="#ficha/${esc(r.id)}">Cancelar</a></div>
  </form>`;
  $('#fi').onsubmit = async e => {
    e.preventDefault();
    const nuevo = {estado: $('#i_estado').value, cantidad: Number($('#i_cantidad').value) || 0, llenado: $('#i_llenado').value, alrededor: $('#i_alrededor').value, frecuencia: $('#i_frecuencia').value,
      defectos: $$('#i_defectos input:checked').map(x => x.value).join(', ') || 'No presenta'};
    S.set.responsable = $('#i_responsable').value.trim();
    const fotos = await guardarFotos($('#i_foto').files, r.codigo, r.direccion);
    registrarCambio(r, nuevo, 'Inspección', $('#i_nota').value.trim(), fotos);
    save('Inspección guardada'); location.hash = 'ficha/' + r.id;
  };
}
function registrarCambio(r, nuevo, tipo, nota, fotos = []) {
  const cambios = {};
  Object.keys(nuevo).forEach(k => { const a = r[k] ?? '', b = nuevo[k] ?? ''; if (String(a) !== String(b)) cambios[k] = [a, b]; r[k] = nuevo[k]; });
  if (fotos.length) { r.fotos = [...fotosMeta(r), ...fotos]; cambios.fotos = ['', '+' + fotos.length]; }
  r.actualizado = hoy();
  r.historial = r.historial || [];
  r.historial.push({id: uid('h'), fecha: r.actualizado, usuario: S.set.responsable || 'Sin nombre', tipo, nota, cambios});
}

/* ---------- FORMULARIO (nuevo / editar) ---------- */
const CAMPOS = ['codigo', 'tipo', 'sector', 'ubicacion', 'direccion', 'cantidad', 'color', 'material', 'capacidad', 'largo', 'ancho', 'alto', 'int_a1', 'int_b1', 'int_a2', 'int_b2', 'int_h', 'senalizacion', 'accesorios', 'defectos', 'estado', 'anio', 'zona', 'este', 'norte', 'foto', 'obs', 'llenado', 'alrededor', 'frecuencia', 'lat', 'lon', 'precision', 'origenUbic'];
const MULTI = ['color', 'senalizacion', 'accesorios', 'defectos'];
function formulario(id, preset) {
  const r = id ? S.devices.find(d => d.id === id) : null;
  const v = r ? {...r} : {tipo: 'Contenedor', cantidad: 1, zona: '17M', estado: 'Bueno', anio: new Date().getFullYear(), material: 'Plástico HDP'};
  if (!r) v.codigo = siguienteCodigo(v.tipo);
  if (!r && preset) { const [pe, pn] = String(preset).split(',').map(Number); if (pe && pn) { v.este = pe; v.norte = pn; v.origenUbic = 'Marcado en mapa'; } }
  const chips = (k, arr) => `<div class="chips" id="m_${k}">${arr.map(x => `<label><input type="checkbox" value="${esc(x)}" ${split(v[k]).includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('')}</div>`;
  const caps = S.cat.capacidades.map(c => c[0]);
  $('#view').innerHTML = `
  <div class="head"><div>${r ? `<p class="mut small"><a href="#ficha/${esc(r.id)}">← Ficha ${esc(r.codigo)}</a></p>` : ''}<h1>${r ? 'Editar ' + esc(r.codigo) : 'Registrar dispositivo'}</h1><p class="mut">Los campos calculados (capacidad total, rango, antigüedad, prioridad, verificación de volumen) se generan solos.</p></div></div>
  <form class="form" id="ff" autocomplete="off">
    <fieldset><legend>1. Identificación</legend><div class="fg">
      <div><label for="v_tipo">Tipo</label><select id="v_tipo">${opts(S.cat.tipos.map(t => t.n), v.tipo)}</select></div>
      <div><label for="v_codigo">Código</label><input id="v_codigo" value="${esc(v.codigo)}" required></div>
      <div><label for="v_sector">Sector</label><select id="v_sector" required>${opts(S.cat.sectores.map(s => s[0]), v.sector, '(Seleccione)')}</select></div>
      <div><label for="v_ubicacion">Ubicación</label><select id="v_ubicacion" required>${opts(S.cat.ubicaciones, v.ubicacion, '(Seleccione)')}</select></div>
      <div class="w2"><label for="v_direccion">Dirección / referencia</label><input id="v_direccion" value="${esc(v.direccion)}" placeholder="Ej.: Jr. Bolívar cdra 3 / frente a la plaza" required></div>
    </div></fieldset>
    <fieldset><legend>2. Georreferenciación (UTM WGS84)</legend><div class="fg">
      <div><label for="v_zona">Zona</label><input id="v_zona" value="${esc(v.zona || '17M')}"></div>
      <div><label for="v_este">Este (m)</label><input id="v_este" type="number" inputmode="numeric" value="${esc(v.este ?? '')}"></div>
      <div><label for="v_norte">Norte (m)</label><input id="v_norte" type="number" inputmode="numeric" value="${esc(v.norte ?? '')}"></div>
      <div style="align-self:end"><button class="btn pri" type="button" id="gps">Ubicación automática (GPS)</button></div>
    </div>
    <input type="hidden" id="v_lat" value="${esc(v.lat ?? '')}"><input type="hidden" id="v_lon" value="${esc(v.lon ?? '')}"><input type="hidden" id="v_precision" value="${esc(v.precision ?? '')}"><input type="hidden" id="v_origenUbic" value="${esc(v.origenUbic ?? '')}">
    <p class="hint" id="gpsInfo">${r ? 'Pulse «Ubicación automática» para volver a medir, o arrastre el marcador.' : 'La ubicación se toma automáticamente. Manténgase junto al dispositivo hasta que la precisión sea menor de 10 m.'}</p>
    <div id="miniMapa" class="minimapa"></div>
    <p class="hint">Toque el mapa o arrastre el marcador azul para corregir la posición. Los puntos grises son dispositivos ya registrados.</p><div id="dupInfo"></div></fieldset>
    <fieldset><legend>3. Características técnicas</legend><div class="fg">
      <div><label for="v_cantidad">Cantidad (und)</label><input id="v_cantidad" type="number" min="1" inputmode="numeric" value="${esc(v.cantidad)}" required></div>
      <div><label for="v_capacidad">Capacidad nominal unitaria (L)</label><input id="v_capacidad" type="number" min="1" list="capList" inputmode="numeric" value="${esc(v.capacidad ?? '')}" required><datalist id="capList">${caps.map(c => `<option value="${c}">`).join('')}</datalist></div>
      <div><label for="v_material">Material</label><select id="v_material">${opts(S.cat.materiales, v.material)}</select></div>
      <div><label for="v_anio">Año de instalación</label><input id="v_anio" type="number" min="1990" max="2100" inputmode="numeric" value="${esc(v.anio ?? '')}"></div>
      <div><label for="v_largo">Largo exterior (m)</label><input id="v_largo" type="number" step="any" inputmode="decimal" value="${esc(v.largo ?? '')}"></div>
      <div><label for="v_ancho">Ancho exterior (m)</label><input id="v_ancho" type="number" step="any" inputmode="decimal" value="${esc(v.ancho ?? '')}"></div>
      <div><label for="v_alto">Alto exterior (m)</label><input id="v_alto" type="number" step="any" inputmode="decimal" value="${esc(v.alto ?? '')}"></div>
    </div>
    <details style="margin-top:12px" ${v.int_a1 ? 'open' : ''}><summary><b>Medición interior (recomendada para verificar la capacidad real)</b></summary>
      <p class="hint">Mida por dentro: boca (largo × ancho), fondo (largo × ancho) y profundidad útil hasta el borde. Se calcula como tronco de pirámide: V = h/3 · (A₁ + A₂ + √(A₁·A₂)). Para recipientes cilíndricos ingrese el diámetro en ambos lados × 0,886.</p>
      <div class="fg"><div><label for="v_int_a1">Boca: largo (m)</label><input id="v_int_a1" type="number" step="any" inputmode="decimal" value="${esc(v.int_a1 ?? '')}"></div>
      <div><label for="v_int_b1">Boca: ancho (m)</label><input id="v_int_b1" type="number" step="any" inputmode="decimal" value="${esc(v.int_b1 ?? '')}"></div>
      <div><label for="v_int_a2">Fondo: largo (m)</label><input id="v_int_a2" type="number" step="any" inputmode="decimal" value="${esc(v.int_a2 ?? '')}"></div>
      <div><label for="v_int_b2">Fondo: ancho (m)</label><input id="v_int_b2" type="number" step="any" inputmode="decimal" value="${esc(v.int_b2 ?? '')}"></div>
      <div><label for="v_int_h">Profundidad útil (m)</label><input id="v_int_h" type="number" step="any" inputmode="decimal" value="${esc(v.int_h ?? '')}"></div></div>
    </details>
    <div class="calc" id="calcBox" style="margin-top:12px"></div>
    <label style="margin-top:12px">Color(es)</label>${chips('color', S.cat.colores)}
    <label style="margin-top:12px">Señalización</label>${chips('senalizacion', S.cat.senalizacion)}
    <label style="margin-top:12px">Accesorios</label>${chips('accesorios', S.cat.accesorios)}
    </fieldset>
    <fieldset><legend>4. Estado y operación</legend><div class="fg">
      <div><label for="v_estado">Estado actual</label><select id="v_estado">${opts(S.cat.estados, v.estado)}</select></div>
      <div><label for="v_llenado">Nivel de llenado observado</label><select id="v_llenado">${opts(S.cat.llenado, v.llenado, '(Sin dato)')}</select></div>
      <div><label for="v_alrededor">¿Residuos dispersos alrededor?</label><select id="v_alrededor">${opts(['No', 'Sí'], v.alrededor, '(Sin dato)')}</select></div>
      <div><label for="v_frecuencia">Recojo (veces/semana)</label><input id="v_frecuencia" type="number" min="0" max="14" inputmode="numeric" value="${esc(v.frecuencia ?? '')}"></div>
    </div>
    <div class="hint"><b>Bueno:</b> operativo, sin defectos o con defectos leves · <b>Regular:</b> requiere mantenimiento o reparación · <b>Malo:</b> compromete su función, requiere reemplazo.</div>
    <label style="margin-top:12px">Defectos</label>${chips('defectos', S.cat.defectos)}
    </fieldset>
    <fieldset><legend>5. Evidencia</legend><div class="fg">
      <div class="w2"><label for="v_fotos">Fotografía georreferenciada</label><input id="v_fotos" type="file" accept="image/*" capture="environment" multiple><div class="hint">Al tomar la foto se graban en ella las coordenadas GPS (UTM y lat/lon), fecha y código, visibles en la imagen y en sus metadatos EXIF.</div></div>
      <div><label for="v_foto">Enlace de fotografía externa (Drive)</label><input id="v_foto" type="url" value="${esc(v.foto || '')}" placeholder="https://drive.google.com/…"></div>
      <div class="w2"><label for="v_obs">Observaciones</label><textarea id="v_obs">${esc(v.obs || '')}</textarea></div>
      <div><label for="v_responsable">Responsable del registro</label><input id="v_responsable" value="${esc(S.set.responsable)}"></div>
    </div></fieldset>
    <div class="row"><button class="btn pri" type="submit">${r ? 'Guardar cambios' : 'Registrar'}</button><a class="btn" href="${r ? '#ficha/' + esc(r.id) : '#inventario'}">Cancelar</a></div>
  </form>`;
  const leer = () => { const o = {}; CAMPOS.forEach(k => { if (MULTI.includes(k)) o[k] = $$('#m_' + k + ' input:checked').map(x => x.value).join(', '); else { const el = $('#v_' + k); if (el) o[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim(); } }); if (!o.defectos) o.defectos = 'No presenta'; if (!o.senalizacion) o.senalizacion = 'Ninguna'; if (!o.accesorios) o.accesorios = 'Ninguno'; return o; };
  const recalc = () => {
    const o = leer(), c = calc(o);
    $('#calcBox').innerHTML = `<b>Capacidad total:</b> ${fmt(c.capTotal)} L · <b>Rango:</b> ${esc(c.rango || '–')} · <b>Caja exterior:</b> ${fmt(c.vgeo)} L${c.vint ? ' · <b>Interior:</b> ' + fmt(c.vint) + ' L' : ''} · <b>Antigüedad:</b> ${c.ant ?? '–'} años · <b>Prioridad:</b> ${esc(c.pri)}<div class="alert ${c.cls === 'ok' ? 'ok' : c.cls === 'bad' ? 'bad' : c.cls === 'info' ? 'info' : ''}" style="margin-bottom:0"><b>Volumen: ${esc(c.ver)}.</b> ${esc(c.nota)} ${esc(c.refTxt)}</div>`;
    const e = +o.este, n = +o.norte;
    const dups = e && n ? S.devices.filter(d => d.id !== (r && r.id) && Math.hypot(d.este - e, d.norte - n) < 5) : [];
    $('#dupInfo').innerHTML = dups.length ? `<div class="alert">A menos de 5 m de: ${dups.map(d => esc(d.codigo) + ' (' + esc(d.direccion) + ')').join('; ')}. Verifique si es el mismo punto o un error de GPS.</div>` : '';
  };
  $('#ff').addEventListener('input', recalc); $('#ff').addEventListener('change', recalc);
  $('#v_tipo').onchange = () => { if (!r) $('#v_codigo').value = siguienteCodigo($('#v_tipo').value); recalc(); };
  $('#v_capacidad').addEventListener('change', () => { const c = S.cat.capacidades.find(x => x[0] === Number($('#v_capacidad').value)); if (c && !$('#v_largo').value) { $('#v_largo').value = c[1]; $('#v_ancho').value = c[2]; $('#v_alto').value = c[3]; recalc(); } });

  recalc();
  mapaFormulario(r && r.id, !r && !(v.este && v.norte));
  $('#ff').onsubmit = async ev => {
    ev.preventDefault();
    const o = leer();
    if (S.devices.some(d => d.codigo === o.codigo && d.id !== (r && r.id))) return toast('El código ' + o.codigo + ' ya existe.');
    S.set.responsable = $('#v_responsable').value.trim();
    const fotos = await guardarFotos($('#v_fotos').files, o.codigo, o.direccion);
    if (r) { registrarCambio(r, o, 'Edición', '', fotos); save('Cambios guardados'); location.hash = 'ficha/' + r.id; }
    else {
      const n = {id: uid('d'), ...o, creado: hoy(), actualizado: hoy(), fotos, historial: [{id: uid('h'), fecha: hoy(), usuario: S.set.responsable || 'Sin nombre', tipo: 'Alta', nota: 'Registro nuevo', cambios: {}}]};
      S.devices.push(n); save('Dispositivo registrado'); location.hash = 'ficha/' + n.id;
    }
  };
}

/* ---------- MAPA ---------- */
function mapa() {
  const L_ = filtrar();
  $('#view').innerHTML = `<div class="head"><div><h1>Mapa de dispositivos</h1><p class="mut">${fmt(L_.length)} puntos (respeta los filtros del inventario). Color = estado; tamaño = capacidad total.</p></div>
  <div class="leg"><span><i class="c-ok"></i>Bueno</span><span><i class="c-warn"></i>Regular</span><span><i class="c-bad"></i>Malo</span></div></div><div class="row noprint" style="margin:-4px 0 8px"><button class="btn sm" id="miPos" type="button">Mi ubicación</button><span class="small mut">Toque el mapa para registrar un dispositivo nuevo en ese punto.</span></div><div id="mapa"></div><p class="small mut">Mapa base © OpenStreetMap (requiere internet). Sin conexión se muestran igualmente los puntos.</p><div id="dups"></div>`;
  if (!window.L) { $('#mapa').innerHTML = '<p style="padding:16px">No se pudo cargar la librería de mapas.</p>'; return; }
  mapObj = L.map('mapa');
  capaBase(mapObj);
  const cs = getComputedStyle(document.body), col = {Bueno: cs.getPropertyValue('--ok'), Regular: cs.getPropertyValue('--warn'), Malo: cs.getPropertyValue('--bad')};
  const pts = [];
  L_.forEach(r => { if (!r.este || !r.norte) return; const ll = fromUTM(+r.este, +r.norte, zoneNum(r.zona), isSouth(r.zona)); const c = calc(r); pts.push([ll.lat, ll.lon]);
    L.circleMarker([ll.lat, ll.lon], {radius: 5 + Math.sqrt(c.capTotal) / 8, color: '#000', weight: 1, fillColor: col[r.estado] || '#888', fillOpacity: .85})
      .bindPopup(`<b>${esc(r.codigo)}</b> · ${esc(r.tipo)}<br>${esc(r.direccion)}<br>${fmt(c.q)} × ${fmt(c.cap)} L · ${esc(r.estado)}<br><a href="#ficha/${esc(r.id)}">Abrir ficha</a>`).addTo(mapObj); });
  if (pts.length) mapObj.fitBounds(pts, {padding: [20, 20]}); else mapObj.setView([-7.9026, -78.5662], 15);
  mapObj.on('click', ev => { const u = toUTM(ev.latlng.lat, ev.latlng.lng, 17); L.popup().setLatLng(ev.latlng).setContent(`E ${u.e} · N ${u.n}<br><a href="#nuevo/${u.e},${u.n}"><b>+ Registrar dispositivo aquí</b></a>`).openOn(mapObj); });
  let yo = null;
  $('#miPos').onclick = () => { $('#miPos').textContent = 'Buscando…'; posicionActual(5000).then(p => { $('#miPos').textContent = 'Mi ubicación'; if (!p) return toast('No se obtuvo GPS (active la ubicación; requiere https).'); if (yo) yo.remove(); yo = L.circle([p.lat, p.lon], {radius: p.acc, color: '#1f5f99', fillOpacity: .15}).addTo(mapObj); const u = toUTM(p.lat, p.lon, 17); L.popup().setLatLng([p.lat, p.lon]).setContent(`Usted está aquí (±${Math.round(p.acc)} m)<br><a href="#nuevo/${u.e},${u.n}"><b>+ Registrar dispositivo aquí</b></a>`).openOn(mapObj); mapObj.setView([p.lat, p.lon], 18); }); };
  const g = {}; L_.forEach(r => { const k = r.este + '/' + r.norte; (g[k] = g[k] || []).push(r); });
  const d = Object.values(g).filter(a => a.length > 1);
  $('#dups').innerHTML = d.length ? `<div class="alert"><b>${d.length} coordenadas compartidas por registros distintos</b> (posibles errores de georreferenciación): ${d.map(a => a.map(r => esc(r.codigo)).join(' = ')).join(' · ')}</div>` : '';
}

/* ---------- EVALUACIÓN TÉCNICA ---------- */
function tecnico() {
  const D = S.devices, g = {};
  D.forEach(r => { const k = r.tipo + '|' + r.capacidad + '|' + [r.largo, r.ancho, r.alto].join('x'); const c = calc(r); g[k] = g[k] || {r, c, reg: 0, und: 0}; g[k].reg++; g[k].und += c.q; });
  const filas = Object.values(g).sort((a, b) => a.c.cap - b.c.cap);
  const t = totales(D);
  const pl = D.filter(r => r.tipo === 'Punto Limpio'), plMal = pl.filter(r => ntpColor(r).ok === false);
  const sinTapa = D.filter(r => !/Tapa/.test(r.accesorios || '')), papSinTapa = sinTapa.filter(r => r.tipo !== 'Contenedor');
  const grandes = D.filter(r => calc(r).cap >= 660), conFreno = grandes.filter(r => /Freno/.test(r.accesorios || ''));
  const suc = D.filter(r => /Suciedad/.test(r.defectos || '')).length, env = D.filter(r => /Envejecido/.test(r.defectos || '')).length;
  const dens = S.set.densidad, d1100 = 1.1 * dens, d660 = 0.66 * dens;
  $('#view').innerHTML = `<div class="prose" style="max-width:none">
  <div class="head"><div><h1>La capacidad instalada real sería ${fmt(100 - t.capCorr / t.cap * 100)} % menor que la declarada</h1>
  <p class="mut">Verificación del volumen diseñado / declarado frente al volumen geométrico y a las medidas comerciales (EN 840), con recomendaciones de especialista ambiental. Se recalcula con cada registro.</p></div>
  <div class="row noprint"><button class="btn" type="button" onclick="print()">Imprimir informe</button></div></div>
  <div class="kpis"><div class="kpi"><b>${fmt(t.cap)} L</b><span>capacidad declarada</span></div><div class="kpi w"><b>${fmt(t.capCorr)} L</b><span>capacidad verificable estimada</span></div><div class="kpi x"><b>${fmt(t.vol)}</b><span>registros con volumen inconsistente o dudoso</span></div><div class="kpi"><b>${fmt(pl.length - plMal.length)} / ${fmt(pl.length)}</b><span>puntos limpios con colores NTP municipales</span></div></div>
  <h2>1. Volumen declarado frente a volumen geométrico</h2>
  <p>Para cada modelo se compara la capacidad nominal con el volumen de la caja que lo envuelve (largo × ancho × alto). En recipientes comerciales con ruedas, tapa y paredes cónicas la capacidad nominal es solo el <b>45–60 %</b> de esa caja; si la capacidad declarada se acerca o supera el 100 %, las medidas o la capacidad están mal.</p>
  <div class="scroll"><table class="stack"><thead><tr><th>Tipo</th><th class="n">Nominal (L)</th><th>Medidas registradas (m)</th><th class="n">Caja (L)</th><th class="n">Nominal / caja</th><th>Diagnóstico</th><th>Referencia comercial</th><th class="n">Und</th><th class="n">Verificable (L c/u)</th></tr></thead><tbody>
  ${filas.map(({r, c, reg, und}) => `<tr><td data-l="Tipo">${esc(r.tipo)}</td><td data-l="Nominal (L)" class="n">${fmt(c.cap)}</td><td data-l="Medidas">${[r.largo, r.ancho, r.alto].map(x => fmt(+x, 2)).join(' × ')}</td><td data-l="Caja (L)" class="n">${fmt(c.vgeo)}</td><td data-l="Nominal / caja" class="n">${c.ratio ? fmt(c.ratio * 100) + ' %' : '–'}</td><td data-l="Diagnóstico"><span class="pill p-${c.cls}">${esc(c.ver)}</span></td><td data-l="Referencia" class="full small">${esc(c.refTxt)}</td><td data-l="Und" class="n">${fmt(und)}</td><td data-l="Verificable" class="n">${fmt(c.capCorr)}</td></tr>`).join('')}
  </tbody></table></div>
  <h3>Lectura de los resultados</h3>
  <ul>
    <li><b>Papeleras y puntos limpios de 50 L</b> (0,20 × 0,30 × 0,50 m): la caja mide 30 L, así que <b>no pueden contener 50 L</b>. Su capacidad útil real ronda 20–27 L. Es la sobreestimación más relevante porque afecta a ${fmt(D.filter(r => +r.capacidad === 50).reduce((a, r) => a + (+r.cantidad || 0), 0))} unidades. Para tener 50 L útiles el cubo interior debe medir aprox. 0,35 × 0,35 × 0,45 m (55 L) o Ø 0,38 × 0,45 m.</li>
    <li><b>Contenedores de 1100 L y 660 L</b>: las medidas registradas (1,11 × 0,95 × 1,00 y 1,11 × 0,65 × 0,90 m) dan una caja menor que la capacidad nominal. Un 1100 L comercial EN 840-3 mide aprox. 1,37 × 1,07 × 1,46 m y un 660 L aprox. 1,26 × 0,78 × 1,22 m. Lo más probable es que se midió solo la boca o el cuerpo sin ruedas ni tapa. Si el proveedor acredita certificado EN 840, mantenga la capacidad nominal y corrija las medidas; si no, mida el interior con la app.</li>
    <li><b>Contenedores de 200 L</b> (0,48 × 0,48 × 0,88 m): 200 L no es una capacidad estándar EN 840 y la caja (203 L) no deja margen para paredes y conicidad. Si son cilíndricos de Ø 0,48 m, su volumen sería ~159 L. Verifique con medición interior; la capacidad comercial más cercana es 240 L (0,58 × 0,73 × 1,075 m).</li>
    <li><b>Contenedores de 120 y 180 L</b>: sus medidas coinciden con los modelos comerciales EN 840-1. Son coherentes.</li>
    <li><b>Contenedor de 140 L</b> (1,13 × 0,44 × 0,475 m): las proporciones no corresponden a un contenedor de 2 ruedas (0,48 × 0,555 × 1,065 m). Probablemente es un soporte doble o un registro con largo y alto invertidos; verificar en campo.</li>
  </ul>
  <h2>2. Diagnóstico ambiental y operativo</h2>
  <div class="grid2">
    <div class="card"><h3>Segregación y código de colores</h3><p>${fmt(plMal.length)} de ${fmt(pl.length)} puntos limpios usan colores fuera del esquema municipal de la <b>NTP 900.058:2019</b> (Azul, Blanco: esquema del ámbito no municipal). En espacio público corresponde: <b>Verde</b> aprovechables, <b>Marrón</b> orgánicos, <b>Negro</b> no aprovechables y <b>Rojo</b> peligrosos solo si existe recojo diferenciado. Los contenedores únicos grises, celestes o verdes reciben residuos mezclados y deben rotularse como “no aprovechables” o asignarse a una fracción.</p></div>
    <div class="card"><h3>Señalización</h3><p>${fmt(t.sinSen)} de ${fmt(t.reg)} puntos (${fmt(pct(t.sinSen, t.reg))} %) no tienen ninguna señalización. Sin rótulo de fracción, pictograma y horario de recojo, el ciudadano no segrega y se pierden los resultados del programa de segregación en la fuente.</p></div>
    <div class="card"><h3>Tapas, lluvia y vectores</h3><p>${fmt(sinTapa.length)} puntos no tienen tapa (${fmt(papSinTapa.length)} son papeleras o puntos limpios). En Otuzco (≈ 2 640 m s.n.m., lluvias de diciembre a abril) el agua de lluvia aumenta peso y genera lixiviados; además atrae perros y moscas. Todo recipiente en vía pública debería tener tapa o techo antilluvia.</p></div>
    <div class="card"><h3>Envejecimiento y limpieza</h3><p>${fmt(env)} puntos con envejecimiento general y ${fmt(suc)} con suciedad incrustada. El envejecimiento del HDPE se acelera por la radiación UV de altura: exigir HDPE con estabilizador UV. La suciedad incrustada indica que falta un programa de lavado y desinfección.</p></div>
    <div class="card"><h3>Contenedores grandes en pendiente</h3><p>${fmt(grandes.length)} puntos tienen contenedores de 660–1100 L y ${fmt(conFreno.length)} registran freno. Lleno con residuos a ${fmt(dens)} kg/m³, un 1100 L pesa ≈ ${fmt(d1100)} kg más ~60 kg de tara y un 660 L ≈ ${fmt(d660)} kg: imposible de maniobrar a mano en calles empinadas, y peligroso sin freno.</p></div>
    <div class="card"><h3>Georreferenciación</h3><p>Hay registros distintos con coordenadas idénticas (ver Mapa). Use el botón GPS de la app con precisión &lt; 10 m y una foto por punto para que el inventario sirva para rutas y planificación.</p></div>
  </div>
  <h2>3. Recomendaciones de mejora</h2>
  <h3>3.1 Especificaciones técnicas mínimas para las próximas adquisiciones</h3>
  <div class="scroll"><table class="stack"><thead><tr><th>Dispositivo</th><th>Especificación recomendada</th></tr></thead><tbody>
    <tr><td data-l="Dispositivo"><b>Papelera de parque / vía (50–60 L)</b></td><td data-l="Especificación" class="full">Capacidad útil <b>medida</b> ≥ 50 L (no nominal del catálogo); cubo interior extraíble de acero galvanizado o HDPE; techo o tapa antilluvia; boca lateral limitada (≈ Ø 20–25 cm) que impida bolsas domiciliarias y acceso de perros; anclaje al piso con pernos; acero inoxidable AISI 304 en plazas o metal con pintura electrostática anticorrosiva; rótulo de fracción NTP 900.058.</td></tr>
    <tr><td data-l="Dispositivo"><b>Contenedor de 2 ruedas (120–360 L)</b></td><td data-l="Especificación" class="full">Certificado <b>EN 840-1</b> (o equivalente) con ficha técnica de medidas exteriores y capacidad; HDPE virgen inyectado con estabilizador UV; tapa abisagrada; ruedas de caucho macizo Ø ≥ 200 mm; tapón de drenaje; color según NTP 900.058 o rótulo; preferir 240 L (estándar) en lugar de 200 L.</td></tr>
    <tr><td data-l="Dispositivo"><b>Contenedor de 4 ruedas (660–1100 L)</b></td><td data-l="Especificación" class="full">Solo donde el camión tenga alzacontenedor compatible (EN 840-2/3, peine DIN o muñones); 4 ruedas Ø 200 mm con <b>freno en al menos 2</b>; tapa con pedal o palanca; drenaje; ubicación en zona plana o con plataforma nivelada y tope. Si la recolección es manual, reemplazar por 2–3 contenedores de 240–360 L.</td></tr>
    <tr><td data-l="Dispositivo"><b>Punto limpio</b></td><td data-l="Especificación" class="full">3 fracciones municipales (Verde, Marrón, Negro) con capacidad proporcional a la composición del EC-RSM de Otuzco (en la sierra la fracción orgánica suele superar el 50 %); pictogramas y textos; estructura con techo; recojo diferenciado garantizado antes de instalarlo, o la segregación se pierde.</td></tr>
  </tbody></table></div>
  <h3>3.2 Gestión y operación</h3>
  <ol>
    <li><b>Corregir la capacidad instalada</b> en los reportes institucionales: medir el interior de una muestra de cada modelo (la app calcula el volumen) y registrar la capacidad verificable, no la del catálogo.</li>
    <li><b>Dimensionar por demanda</b> (pestaña Dimensionamiento): volumen = generación × días entre recojos × factor de seguridad ÷ (densidad × llenado útil). Registrar en cada inspección el nivel de llenado y si hay residuos alrededor; si un punto llega a “desborde” en 2 inspecciones seguidas, aumentar capacidad o frecuencia.</li>
    <li><b>Plan de reemplazo</b>: ${fmt(t.m)} unidades en estado malo (prioridad alta) y ${fmt(t.vida)} unidades que superan su vida útil referencial (HDPE ${S.set.vida['Plástico HDP']} años, metal ${S.set.vida['Metal']}, acero inoxidable ${S.set.vida['Acero inoxidable']}).</li>
    <li><b>Mantenimiento preventivo</b> de ${fmt(t.r)} unidades en estado regular: tapas, ruedas, seguros y soportes; reponer piezas antes de que pasen a estado malo.</li>
    <li><b>Lavado y desinfección programados</b>: semanal en mercado, quincenal en vías principales y mensual en parques; registrar cada lavado como inspección en la app.</li>
    <li><b>Festividad de la Virgen de la Puerta</b> (diciembre): la población flotante multiplica la generación en el centro y las rutas de peregrinación; prever contenedores móviles temporales y mayor frecuencia de recojo.</li>
    <li><b>Señalización y sensibilización</b>: rotular el 100 % de los puntos con fracción, pictograma, horario de recojo y teléfono municipal para reportar desbordes.</li>
    <li><b>Inspección periódica</b> trimestral de todo el inventario con la app (pestaña Inspeccionar), consolidando los respaldos de cada inspector en la oficina.</li>
  </ol>
  <p class="ref">Marco de referencia: D. Leg. N.º 1278, Ley de Gestión Integral de Residuos Sólidos, y su Reglamento (D.S. N.º 014-2017-MINAM y modificatorias); NTP 900.058:2019 Código de colores para el almacenamiento de residuos sólidos; UNE-EN 840-1/2/3 Contenedores móviles para residuos. Las medidas comerciales son referenciales (±5 % según fabricante); confirme con la ficha técnica del proveedor.</p>
  </div>`;
}

/* ---------- DIMENSIONAMIENTO ---------- */
function diseno() {
  $('#view').innerHTML = `<div class="head"><div><h1>Dimensionamiento de capacidad</h1><p class="mut">Calcule el volumen necesario en un punto o zona y cuántos recipientes comerciales cubre esa demanda. Use los datos del EC-RSM de Otuzco cuando los tenga.</p></div></div>
  <div class="grid2">
    <form class="card form" id="fd">
      <div class="fg">
        <div><label for="d_modo">Dato de partida</label><select id="d_modo"><option value="kg">Generación conocida (kg/día)</option><option value="pob">Población o usuarios atendidos</option></select></div>
        <div id="w_kg"><label for="d_kg">Generación en el punto (kg/día)</label><input id="d_kg" type="number" step="any" value="60" inputmode="decimal"></div>
        <div id="w_pob" hidden><label for="d_pob">Personas atendidas</label><input id="d_pob" type="number" value="200" inputmode="numeric"></div>
        <div id="w_gpc" hidden><label for="d_gpc">Generación per cápita (kg/hab/día)</label><input id="d_gpc" type="number" step="any" value="0.50" inputmode="decimal"><div class="hint">Del EC-RSM municipal; ~0,45–0,60 en ciudades de la sierra.</div></div>
        <div><label for="d_dias">Días entre recojos</label><input id="d_dias" type="number" step="any" value="1" inputmode="decimal"></div>
        <div><label for="d_dens">Densidad suelta (kg/m³)</label><input id="d_dens" type="number" value="${esc(S.set.densidad)}" inputmode="numeric"><div class="hint">Papeleras de vía: 80–150 · domiciliario sin compactar: 150–250 · mercado (orgánico): 300–400.</div></div>
        <div><label for="d_ll">Llenado útil (fracción)</label><input id="d_ll" type="number" step="any" min="0.5" max="1" value="${esc(S.set.llenadoUtil)}" inputmode="decimal"><div class="hint">0,80–0,85 para que la tapa cierre.</div></div>
        <div><label for="d_fs">Factor de seguridad (picos)</label><input id="d_fs" type="number" step="any" value="1.25" inputmode="decimal"><div class="hint">1,5–2,0 en zonas de festividad.</div></div>
      </div>
    </form>
    <div class="card" id="dres"></div>
  </div>`;
  const run = () => {
    const modo = $('#d_modo').value; $('#w_kg').hidden = modo !== 'kg'; $('#w_pob').hidden = $('#w_gpc').hidden = modo !== 'pob';
    const kg = modo === 'kg' ? +$('#d_kg').value : (+$('#d_pob').value) * (+$('#d_gpc').value);
    const dias = +$('#d_dias').value, dens = +$('#d_dens').value, ll = +$('#d_ll').value, fs = +$('#d_fs').value;
    const V = dens && ll ? kg * dias * fs / (dens * ll) * 1000 : 0;
    const op = [50, 120, 240, 360, 660, 1100].map(c => { const n = Math.ceil(V / c) || 0; const peso = c / 1000 * ll * dens; return [c, n, peso, n * c]; });
    $('#dres').innerHTML = `<p class="mut">Volumen necesario</p><p style="font-size:clamp(34px,5vw,52px);font-weight:700;line-height:1;margin:0 0 6px;color:var(--brand)">${fmt(V)} L</p>
    <p class="small mut">= ${fmt(kg, 1)} kg/día × ${fmt(dias, 1)} días × ${fmt(fs, 2)} ÷ (${fmt(dens)} kg/m³ × ${fmt(ll, 2)})</p>
    <div class="scroll" style="margin-top:12px"><table><thead><tr><th>Recipiente</th><th class="n">N.º necesario</th><th class="n">Capacidad total</th><th class="n">Peso lleno c/u</th></tr></thead><tbody>
    ${op.map(([c, n, p, tot]) => `<tr><td>${c} L${c === 50 ? ' (útil medido)' : ''}</td><td class="n"><b>${n}</b></td><td class="n">${fmt(tot)} L</td><td class="n" style="color:${p > 100 ? 'var(--bad)' : 'inherit'}">${fmt(p)} kg</td></tr>`).join('')}
    </tbody></table></div><p class="small mut" style="margin-top:8px">Peso en rojo: supera 100 kg, requiere izaje mecánico o manejo por dos personas con contenedor de ruedas en terreno plano.</p>`;
  };
  $('#fd').oninput = run; $('#fd').onchange = run; run();
}

/* ---------- DATOS: exportar / importar / ajustes ---------- */
const COLS_XLS = [['N°', (r, c, i) => i + 1], ['CÓDIGO', 'codigo'], ['TIPO', 'tipo'], ['PREF.', (r, c) => c.pref], ['SECTOR', 'sector'], ['CÓD. SECTOR', (r, c) => c.codSec], ['UBICACIÓN', 'ubicacion'], ['DIRECCIÓN / REFERENCIA', 'direccion'], ['CANTIDAD (Und)', r => Number(r.cantidad) || 0], ['COLOR', 'color'], ['MATERIAL', 'material'], ['CAP. UNITARIA (L)', r => Number(r.capacidad) || ''], ['CAP. TOTAL (L)', (r, c) => c.capTotal], ['RANGO DE CAPACIDAD', (r, c) => c.rango], ['LARGO (m)', 'largo'], ['ANCHO (m)', 'ancho'], ['ALTO (m)', 'alto'], ['VOL. GEOM. UNIT. (m³)', (r, c) => c.vgeo ? +(c.vgeo / 1000).toFixed(4) : ''], ['VOL. INTERIOR MEDIDO (L)', (r, c) => c.vint ? Math.round(c.vint) : ''], ['DIAGNÓSTICO VOLUMEN', (r, c) => c.ver], ['CAP. VERIFICABLE UNIT. (L)', (r, c) => Math.round(c.capCorr)], ['SEÑALIZACIÓN', 'senalizacion'], ['ACCESORIOS', 'accesorios'], ['DEFECTOS', 'defectos'], ['N° DEFECTOS', (r, c) => c.nDef], ['ESTADO ACTUAL', 'estado'], ['AÑO INSTAL.', 'anio'], ['ANTIGÜEDAD (años)', (r, c) => c.ant ?? ''], ['PRIORIDAD DE ACCIÓN', (r, c) => c.pri], ['NIVEL DE LLENADO', 'llenado'], ['RESIDUOS ALREDEDOR', 'alrededor'], ['RECOJO (veces/sem)', 'frecuencia'], ['ZONA UTM', 'zona'], ['ESTE (m)', 'este'], ['NORTE (m)', 'norte'], ['ENLACE FOTOGRAFÍA', 'foto'], ['LATITUD', 'lat'], ['LONGITUD', 'lon'], ['PRECISIÓN GPS (m)', 'precision'], ['ORIGEN UBICACIÓN', 'origenUbic'], ['N° FOTOS', r => (r.fotos || []).length], ['OBSERVACIONES', 'obs'], ['ÚLTIMA ACTUALIZACIÓN', r => (r.actualizado || '').replace('T', ' ')], ['ID', 'id']];
const MAP_IMPORT = {'CÓDIGO': 'codigo', 'TIPO': 'tipo', 'SECTOR': 'sector', 'UBICACIÓN': 'ubicacion', 'DIRECCIÓN / REFERENCIA': 'direccion', 'CANTIDAD (Und)': 'cantidad', 'COLOR': 'color', 'MATERIAL': 'material', 'CAP. UNITARIA (L)': 'capacidad', 'LARGO (m)': 'largo', 'ANCHO (m)': 'ancho', 'ALTO (m)': 'alto', 'SEÑALIZACIÓN': 'senalizacion', 'ACCESORIOS': 'accesorios', 'DEFECTOS': 'defectos', 'ESTADO ACTUAL': 'estado', 'AÑO INSTAL.': 'anio', 'ZONA UTM': 'zona', 'ESTE (m)': 'este', 'NORTE (m)': 'norte', 'ENLACE FOTOGRAFÍA': 'foto', 'OBSERVACIONES': 'obs', 'NIVEL DE LLENADO': 'llenado', 'RESIDUOS ALREDEDOR': 'alrededor', 'RECOJO (veces/sem)': 'frecuencia', 'ID': 'id'};
function fecha() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function descargar(nombre, contenido, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], {type: tipo})); a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
function exportarExcel(arr = S.devices, suf = '') {
  if (!window.XLSX) return toast('No se cargó la librería de Excel; use CSV.');
  XLSX.writeFile(libroExcel(arr), `Inventario_RRSS_Otuzco_${suf ? suf + '_' : ''}${fecha()}.xlsx`);
}
function libroExcel(arr) {
  const wb = XLSX.utils.book_new();
  const filas = arr.map((r, i) => { const c = calc(r), o = {}; COLS_XLS.forEach(([h, f]) => o[h] = typeof f === 'function' ? f(r, c, i) : (r[f] ?? '')); return o; });
  const ws = XLSX.utils.json_to_sheet(filas); ws['!cols'] = COLS_XLS.map(([h]) => ({wch: Math.min(40, Math.max(10, h.length + 2))})); ws['!autofilter'] = {ref: ws['!ref']};
  XLSX.utils.book_append_sheet(wb, ws, 'INVENTARIO');
  const hist = []; arr.forEach(r => (r.historial || []).forEach(h => hist.push({'CÓDIGO': r.codigo, 'FECHA': (h.fecha || '').replace('T', ' '), 'TIPO': h.tipo, 'RESPONSABLE': h.usuario, 'NOTA': h.nota, 'CAMBIOS': Object.entries(h.cambios || {}).map(([k, v]) => k + ': ' + v[0] + ' → ' + v[1]).join(' | ')})));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hist), 'HISTORIAL');
  const res = {}; arr.forEach(r => { const c = calc(r), k = r.tipo + ' ' + r.capacidad + ' L'; res[k] = res[k] || {'MODELO': k, 'REGISTROS': 0, 'UNIDADES': 0, 'CAP. DECLARADA (L)': 0, 'CAP. VERIFICABLE (L)': 0, 'DIAGNÓSTICO': c.ver, 'REFERENCIA': c.refTxt}; res[k].REGISTROS++; res[k].UNIDADES += c.q; res[k]['CAP. DECLARADA (L)'] += c.capTotal; res[k]['CAP. VERIFICABLE (L)'] += Math.round(c.capCorrTotal); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.values(res)), 'EVALUACIÓN VOLUMEN');
  const fot = []; arr.forEach(r => fotosMeta(r).forEach(f => fot.push({'CÓDIGO': r.codigo, 'FECHA': (f.fecha || '').replace('T', ' '), 'ESTE (m)': f.e ?? '', 'NORTE (m)': f.n ?? '', 'LATITUD': f.lat ?? '', 'LONGITUD': f.lon ?? '', 'PRECISIÓN (m)': f.acc ?? '', 'ORIGEN UBICACIÓN': f.origen || '', 'AUTOR': f.autor || '', 'ENLACE DRIVE': f.url || 'pendiente de subir'})));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fot.length ? fot : [{'CÓDIGO': ''}]), 'FOTOS GEORREF');
  return wb;
}
function exportarCSV() {
  const rows = [COLS_XLS.map(c => c[0])].concat(S.devices.map((r, i) => { const c = calc(r); return COLS_XLS.map(([h, f]) => typeof f === 'function' ? f(r, c, i) : (r[f] ?? '')); }));
  descargar(`Inventario_RRSS_Otuzco_${fecha()}.csv`, '﻿' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n'), 'text/csv');
}
async function exportarJSON(conFotos) {
  const out = {app: 'rrss_otuzco', version: 2, exportado: hoy(), responsable: S.set.responsable, devices: S.devices, borrados: S.borrados, cat: S.cat, fotos: {}};
  if (conFotos) for (const r of S.devices) for (const k of fotosMeta(r).map(f => f.k)) { const v = await DB.get(k).catch(() => null); if (v) out.fotos[k] = v; }
  descargar(`Respaldo_RRSS_${(S.set.responsable || 'equipo').replace(/\W+/g, '_')}_${fecha()}.json`, JSON.stringify(out), 'application/json');
}
function fusionar(lista) { /* une por id o por código; gana la fecha de actualización más reciente; une historiales */
  let nuevos = 0, act = 0;
  lista.forEach(n => {
    if (!n.codigo) return;
    const e = S.devices.find(d => (n.id && d.id === n.id) || d.codigo === n.codigo);
    if (!e) { n.id = n.id || uid('d'); n.historial = n.historial || [{id: uid('h'), fecha: hoy(), usuario: S.set.responsable || 'Importación', tipo: 'Alta', nota: 'Importado', cambios: {}}]; n.actualizado = n.actualizado || hoy(); S.devices.push(n); nuevos++; return; }
    const hist = [...(e.historial || [])]; (n.historial || []).forEach(h => { if (!hist.some(x => x.id === h.id)) hist.push(h); }); hist.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const fotos = unirFotos(e.fotos, n.fotos);
    if ((n.actualizado || '') > (e.actualizado || '')) { Object.assign(e, n, {id: e.id}); act++; }
    e.historial = hist; e.fotos = fotos;
  });
  return {nuevos, act};
}
async function importarArchivo(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const o = JSON.parse(await file.text()); if (!Array.isArray(o.devices)) throw new Error('El archivo no es un respaldo de esta app.');
    for (const [k, v] of Object.entries(o.fotos || {})) await DB.put(k, v);
    const r = fusionarRemoto(o); save(); return `Respaldo importado: ${r.nuevos} nuevos, ${r.act} actualizados.`;
  }
  if (!window.XLSX) throw new Error('No se cargó la librería de Excel.');
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets['INVENTARIO'] || wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''});
  const hi = aoa.findIndex(row => row.some(c => String(c).trim().toUpperCase() === 'CÓDIGO'));
  if (hi < 0) throw new Error('No se encontró la fila de encabezados con "CÓDIGO".');
  const H = aoa[hi].map(h => String(h).trim());
  const lista = aoa.slice(hi + 1).filter(row => row[H.indexOf('CÓDIGO')]).map(row => { const o = {}; H.forEach((h, i) => { if (MAP_IMPORT[h]) o[MAP_IMPORT[h]] = row[i]; }); o.actualizado = hoy(); return o; });
  const r = fusionar(lista); save(); return `Excel importado: ${r.nuevos} nuevos, ${r.act} actualizados.`;
}
function datos() {
  const listas = [['ubicaciones', 'Ubicaciones'], ['materiales', 'Materiales'], ['colores', 'Colores'], ['senalizacion', 'Señalización'], ['accesorios', 'Accesorios'], ['defectos', 'Defectos']];
  $('#view').innerHTML = `<div class="head"><div><h1>Datos y ajustes</h1><p class="mut">Los datos se guardan en este equipo. Para trabajar en equipo, cada inspector exporta su respaldo y la oficina lo importa: los registros se fusionan por código y se conserva el historial de todos.</p></div></div>
  <div class="grid2">
    ${tarjetaDrive()}
    <div class="card"><h3>Exportar</h3><div class="row"><button class="btn pri" id="eX" type="button">Excel completo (.xlsx)</button><button class="btn" id="eC" type="button">CSV</button></div>
      <div class="row" style="margin-top:8px"><button class="btn" id="eJ" type="button">Respaldo JSON</button><button class="btn" id="eJF" type="button">Respaldo JSON con fotos</button></div>
      <p class="hint">El Excel incluye las hojas INVENTARIO (mismas columnas que su sistema + diagnóstico de volumen), HISTORIAL y EVALUACIÓN VOLUMEN.</p></div>
    <div class="card"><h3>Importar / consolidar</h3><label for="imp">Respaldo JSON de otro equipo o Excel con hoja INVENTARIO</label><input id="imp" type="file" accept=".json,.xlsx,.xls"><p class="hint">Se fusiona: si el código existe, gana la versión con fecha de actualización más reciente.</p><div id="impRes"></div></div>
    <div class="card"><h3>Parámetros</h3><div class="fg">
      <div><label for="s_resp">Responsable (este equipo)</label><input id="s_resp" value="${esc(S.set.responsable)}"></div>
      <div><label for="s_anio">Año de referencia (vacío = actual)</label><input id="s_anio" type="number" value="${esc(S.set.anioRef)}" placeholder="${new Date().getFullYear()}"></div>
      ${Object.keys(S.set.vida).map(m => `<div><label for="s_v_${esc(m)}">Vida útil ${esc(m)} (años)</label><input data-vida="${esc(m)}" id="s_v_${esc(m)}" type="number" value="${esc(S.set.vida[m])}"></div>`).join('')}
      <div><label for="s_dens">Densidad de referencia (kg/m³)</label><input id="s_dens" type="number" value="${esc(S.set.densidad)}"></div>
    </div><button class="btn pri" id="sGuardar" type="button" style="margin-top:10px">Guardar parámetros</button></div>
    <div class="card"><h3>Catálogos</h3><p class="hint">Un elemento por línea. Sectores: “Nombre;CÓD”. Tipos: “Nombre;PREFIJO”.</p>
      <div class="fg">
      <div><label for="c_tipos">Tipos</label><textarea id="c_tipos" rows="4">${esc(S.cat.tipos.map(t => t.n + ';' + t.p).join('\n'))}</textarea></div>
      <div><label for="c_sectores">Sectores</label><textarea id="c_sectores" rows="6">${esc(S.cat.sectores.map(s => s.join(';')).join('\n'))}</textarea></div>
      ${listas.map(([k, t]) => `<div><label for="c_${k}">${t}</label><textarea id="c_${k}" rows="5">${esc(S.cat[k].join('\n'))}</textarea></div>`).join('')}
      </div><button class="btn pri" id="cGuardar" type="button" style="margin-top:10px">Guardar catálogos</button></div>
    <div class="card"><h3>Restablecer</h3><p>Vuelve a cargar el inventario 2025 original (114 registros). Se pierden los cambios no exportados.</p><button class="btn bad" id="reset" type="button">Restablecer datos iniciales</button></div>
  </div>`;
  eventosDrive();
  $('#eX').onclick = () => exportarExcel(); $('#eC').onclick = exportarCSV; $('#eJ').onclick = () => exportarJSON(false); $('#eJF').onclick = () => exportarJSON(true);
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const m = await importarArchivo(f); $('#impRes').innerHTML = `<div class="alert ok">${esc(m)}</div>`; } catch (err) { $('#impRes').innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; } };
  $('#sGuardar').onclick = () => { S.set.responsable = $('#s_resp').value.trim(); S.set.anioRef = $('#s_anio').value; S.set.densidad = +$('#s_dens').value || 200; $$('[data-vida]').forEach(i => S.set.vida[i.dataset.vida] = +i.value || 8); save('Parámetros guardados'); };
  $('#cGuardar').onclick = () => { const ln = id => $(id).value.split('\n').map(x => x.trim()).filter(Boolean);
    S.cat.tipos = ln('#c_tipos').map(l => { const [n, p] = l.split(';'); return {n: n.trim(), p: (p || n.slice(0, 3)).trim().toUpperCase()}; });
    S.cat.sectores = ln('#c_sectores').map(l => { const [n, p] = l.split(';'); return [n.trim(), (p || n.replace('S. ', '').slice(0, 3)).trim().toUpperCase()]; });
    listas.forEach(([k]) => S.cat[k] = ln('#c_' + k)); save('Catálogos guardados'); };
  $('#reset').onclick = () => confirmar('¿Restablecer el inventario original? Se perderán los cambios no exportados.', () => { S.devices = JSON.parse(JSON.stringify(window.DATA_INICIAL)); save('Datos restablecidos'); route(); });
}

/* =====================================================================
   FOTOS GEORREFERENCIADAS
   ===================================================================== */
const fk = f => typeof f === 'string' ? f : (f && f.k);
const fotosMeta = r => (r.fotos || []).map(f => typeof f === 'string' ? {k: f} : f);
let ultimaPos = null;
function posicionActual(maxAge = 45000) {
  return new Promise(ok => {
    if (ultimaPos && Date.now() - ultimaPos.t < maxAge) return ok(ultimaPos);
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(p => ok(ultimaPos = {lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, t: Date.now()}),
      () => ok(null), {enableHighAccuracy: true, timeout: 15000, maximumAge: 20000});
  });
}
const leerDataURL = f => new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(f); });
const cargarImg = src => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error('Imagen no válida')); im.src = src; });
function gpsDeExif(dataUrl) {
  try {
    if (!window.piexif || !/^data:image\/jpe?g/.test(dataUrl)) return null;
    const g = piexif.load(dataUrl).GPS || {}, I = piexif.GPSIFD;
    const dms = a => a ? a[0][0] / a[0][1] + a[1][0] / a[1][1] / 60 + a[2][0] / a[2][1] / 3600 : null;
    let lat = dms(g[I.GPSLatitude]), lon = dms(g[I.GPSLongitude]);
    if (lat == null || lon == null || (!lat && !lon)) return null;
    if (g[I.GPSLatitudeRef] === 'S') lat = -lat; if (g[I.GPSLongitudeRef] === 'W') lon = -lon;
    return {lat, lon, acc: null, origen: 'EXIF de la cámara'};
  } catch (e) { return null; }
}
const pad = n => String(n).padStart(2, '0');
const exifFecha = d => `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
async function fotoGeo(file, codigo, direccion) {
  const orig = await leerDataURL(file);
  const pos = gpsDeExif(orig) || await posicionActual().then(p => p && {...p, origen: 'GPS del equipo'});
  const im = await cargarImg(orig), k = Math.min(1, 1600 / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
  const d = new Date(), u = pos ? toUTM(pos.lat, pos.lon, 17) : null;
  const lineas = [`${codigo || 'SIN CÓDIGO'} · ${d.toLocaleDateString('es-PE')} ${d.toLocaleTimeString('es-PE', {hour: '2-digit', minute: '2-digit'})}`,
    u ? `UTM WGS84 17S  E ${u.e}  N ${u.n}${pos.acc ? '  ±' + Math.round(pos.acc) + ' m' : ''}` : 'SIN UBICACIÓN GPS',
    pos ? `Lat ${pos.lat.toFixed(6)}  Lon ${pos.lon.toFixed(6)}` : 'Active el GPS del equipo',
    (direccion || '').slice(0, 60) + ' · MPO – GSMyGA'];
  const fs = Math.max(14, Math.round(c.width / 42)), lh = fs * 1.3, h = lh * lineas.length + fs * 0.8;
  x.fillStyle = 'rgba(0,0,0,.62)'; x.fillRect(0, c.height - h, c.width, h);
  x.fillStyle = '#fff'; x.font = `600 ${fs}px system-ui,Arial,sans-serif`; x.textBaseline = 'top';
  lineas.forEach((t, i) => x.fillText(t, fs * 0.6, c.height - h + fs * 0.4 + i * lh));
  let jpeg = c.toDataURL('image/jpeg', 0.8);
  if (pos && window.piexif) {
    try {
      const I = piexif.GPSIFD, dm = v => { v = Math.abs(v); const g = Math.floor(v), mf = (v - g) * 60, m = Math.floor(mf); return [[g, 1], [m, 1], [Math.round((mf - m) * 60 * 1000), 1000]]; };
      const gps = {}; gps[I.GPSVersionID] = [2, 3, 0, 0]; gps[I.GPSLatitudeRef] = pos.lat < 0 ? 'S' : 'N'; gps[I.GPSLatitude] = dm(pos.lat); gps[I.GPSLongitudeRef] = pos.lon < 0 ? 'W' : 'E'; gps[I.GPSLongitude] = dm(pos.lon);
      if (pos.alt != null) { gps[I.GPSAltitudeRef] = 0; gps[I.GPSAltitude] = [Math.round(pos.alt * 100), 100]; }
      if (pos.acc) gps[I.GPSHPositioningError] = [Math.round(pos.acc * 100), 100];
      gps[I.GPSMapDatum] = 'WGS-84';
      const z = {}; z[piexif.ImageIFD.ImageDescription] = (codigo || '') + ' ' + (direccion || ''); z[piexif.ImageIFD.Software] = 'Inventario RRSS Otuzco';
      const ex = {}; ex[piexif.ExifIFD.DateTimeOriginal] = exifFecha(d);
      jpeg = piexif.insert(piexif.dump({'0th': z, Exif: ex, GPS: gps}), jpeg);
    } catch (e) { console.warn('EXIF', e); }
  }
  const meta = {k: uid('f'), fecha: hoy(), lat: pos ? +pos.lat.toFixed(7) : null, lon: pos ? +pos.lon.toFixed(7) : null, e: u ? u.e : null, n: u ? u.n : null, acc: pos && pos.acc ? Math.round(pos.acc) : null, origen: pos ? pos.origen : 'Sin ubicación', autor: (S.auth && S.auth.email) || S.set.responsable || ''};
  return {meta, jpeg};
}
async function guardarFotos(files, codigo, direccion) {
  const out = [];
  for (const f of files || []) {
    try { const {meta, jpeg} = await fotoGeo(f, codigo, direccion); await DB.put(meta.k, jpeg); out.push(meta); }
    catch (e) { toast('No se pudo procesar una foto: ' + e.message); }
  }
  if (out.some(m => !m.e)) toast('Alguna foto se guardó sin ubicación: active el GPS del equipo.');
  return out;
}
function unirFotos(a = [], b = []) {
  const m = new Map();
  [...a, ...b].forEach(f => { const o = typeof f === 'string' ? {k: f} : f; if (!o || !o.k) return; const p = m.get(o.k); m.set(o.k, p ? {...p, ...o, driveId: p.driveId || o.driveId, url: p.url || o.url} : o); });
  return [...m.values()];
}

/* =====================================================================
   MAPA DEL FORMULARIO + UBICACIÓN AUTOMÁTICA
   ===================================================================== */
let alSalir = [];
const OTUZCO = [-7.9026, -78.5662];
function capaBase(m) { L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap'}).addTo(m); }
function mapaFormulario(idActual, auto) {
  const box = $('#miniMapa'); if (!box || !window.L) return;
  const fm = L.map(box, {zoomControl: true}); capaBase(fm); alSalir.push(() => fm.remove());
  S.devices.forEach(d => { if (d.id === idActual || !d.este || !d.norte) return; const ll = fromUTM(+d.este, +d.norte, zoneNum(d.zona), isSouth(d.zona)); L.circleMarker([ll.lat, ll.lon], {radius: 5, color: '#555', weight: 1, fillColor: '#999', fillOpacity: .7}).bindTooltip(d.codigo).addTo(fm); });
  const e0 = +$('#v_este').value, n0 = +$('#v_norte').value;
  const ll0 = e0 && n0 ? fromUTM(e0, n0, zoneNum($('#v_zona').value), isSouth($('#v_zona').value)) : null;
  fm.setView(ll0 ? [ll0.lat, ll0.lon] : OTUZCO, ll0 ? 18 : 15);
  const mk = L.marker(ll0 ? [ll0.lat, ll0.lon] : OTUZCO, {draggable: true, opacity: ll0 ? 1 : 0.45}).addTo(fm).bindTooltip('Arrastre para ajustar');
  let circ = null, watch = null, mejor = null, tmr = null;
  const fijar = (lat, lon, acc, origen) => {
    const u = toUTM(lat, lon, zoneNum($('#v_zona').value));
    $('#v_este').value = u.e; $('#v_norte').value = u.n; $('#v_lat').value = lat.toFixed(7); $('#v_lon').value = lon.toFixed(7);
    $('#v_precision').value = acc != null ? Math.round(acc) : ''; $('#v_origenUbic').value = origen;
    mk.setLatLng([lat, lon]).setOpacity(1);
    $('#v_este').dispatchEvent(new Event('input', {bubbles: true}));
  };
  const parar = msg => { if (watch != null) navigator.geolocation.clearWatch(watch); watch = null; clearTimeout(tmr); $('#gps').textContent = 'Ubicación automática (GPS)'; if (msg) $('#gpsInfo').textContent = msg; };
  alSalir.push(() => parar());
  const iniciar = () => {
    if (!navigator.geolocation) return $('#gpsInfo').textContent = 'Este navegador no permite GPS.';
    if (watch != null) return parar('GPS detenido. Última precisión: ±' + (mejor ? Math.round(mejor.accuracy) : '–') + ' m');
    mejor = null; $('#gps').textContent = 'Detener GPS'; $('#gpsInfo').textContent = 'Buscando señal GPS… manténgase junto al dispositivo.';
    watch = navigator.geolocation.watchPosition(p => {
      const c = p.coords; ultimaPos = {lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: Date.now()};
      if (mejor && c.accuracy > mejor.accuracy) return;
      mejor = c; fijar(c.latitude, c.longitude, c.accuracy, 'GPS automático');
      if (circ) circ.remove(); circ = L.circle([c.latitude, c.longitude], {radius: c.accuracy, color: '#0b6b45', weight: 1, fillOpacity: .12}).addTo(fm);
      fm.setView([c.latitude, c.longitude], Math.max(fm.getZoom(), 18));
      $('#gpsInfo').innerHTML = `Precisión ±<b>${Math.round(c.accuracy)} m</b> ${c.accuracy <= 10 ? '✔ buena' : '· esperando mejor señal…'}`;
      if (c.accuracy <= 5) parar(`Ubicación registrada con precisión ±${Math.round(c.accuracy)} m.`);
    }, err => parar('No se obtuvo GPS: ' + err.message + (location.protocol === 'https:' ? '' : ' (el GPS requiere abrir la app desde https).')), {enableHighAccuracy: true, maximumAge: 0, timeout: 30000});
    tmr = setTimeout(() => parar(mejor ? `Ubicación registrada con ±${Math.round(mejor.accuracy)} m (60 s de lectura).` : 'No se obtuvo señal en 60 s.'), 60000);
  };
  $('#gps').onclick = iniciar;
  mk.on('dragend', () => { const p = mk.getLatLng(); parar(); fijar(p.lat, p.lng, null, 'Ajuste manual en mapa'); $('#gpsInfo').textContent = 'Ubicación ajustada manualmente en el mapa.'; });
  fm.on('click', ev => { parar(); fijar(ev.latlng.lat, ev.latlng.lng, null, 'Marcado en mapa'); $('#gpsInfo').textContent = 'Ubicación marcada en el mapa.'; });
  ['#v_este', '#v_norte'].forEach(s => $(s).addEventListener('change', () => { const e = +$('#v_este').value, n = +$('#v_norte').value; if (e && n) { const ll = fromUTM(e, n, zoneNum($('#v_zona').value), isSouth($('#v_zona').value)); mk.setLatLng([ll.lat, ll.lon]).setOpacity(1); fm.setView([ll.lat, ll.lon], 18); $('#v_origenUbic').value = 'Digitado'; } }));
  setTimeout(() => fm.invalidateSize(), 200);
  if (auto) iniciar();
}

/* =====================================================================
   GOOGLE DRIVE + AUTORIZACIÓN
   ===================================================================== */
const CFG0 = Object.assign({clientId: '', folderId: '', requireLogin: true, allowedEmails: []}, window.CONFIG || {});
const cfg = () => ({clientId: (S.set.clientId || CFG0.clientId || '').trim(), folderId: (S.set.folderId || CFG0.folderId || '').trim(), requireLogin: CFG0.requireLogin !== false, allowedEmails: (CFG0.allowedEmails || []).map(x => x.toLowerCase())});
const G = {token: null, exp: 0, sync: false, tSync: null};
const tokenOk = () => G.token && Date.now() < G.exp;
function cargarGIS() {
  return new Promise((ok, ko) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(new Error('No hay conexión con Google. Verifique internet.')); document.head.appendChild(s);
  });
}
async function conectarGoogle() {
  const c = cfg();
  if (!c.clientId) throw new Error('Falta el ID de cliente OAuth de Google (config.js o Datos y ajustes).');
  await cargarGIS();
  return new Promise((ok, ko) => {
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: c.clientId, scope: 'https://www.googleapis.com/auth/drive openid email profile', hint: S.auth ? S.auth.email : undefined,
      callback: r => { if (r.error) return ko(new Error(r.error_description || r.error)); G.token = r.access_token; G.exp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000; estadoDrive(); ok(G.token); },
      error_callback: e => ko(new Error(e && e.type === 'popup_closed' ? 'Se cerró la ventana de autorización.' : 'Autorización no concedida (' + ((e && (e.message || e.type)) || 'error') + ').'))
    });
    tc.requestAccessToken({prompt: S.auth ? '' : 'consent'});
  });
}
async function gd(path, opt = {}) {
  if (!tokenOk()) await conectarGoogle();
  const url = path.startsWith('http') ? path : 'https://www.googleapis.com/drive/v3/' + path;
  const r = await fetch(url, {...opt, headers: {Authorization: 'Bearer ' + G.token, ...(opt.headers || {})}});
  if (r.status === 401) { G.token = null; estadoDrive(); throw new Error('La sesión de Google venció. Pulse «Sincronizar» para volver a autorizar.'); }
  if (!r.ok) { const t = await r.text(); let m = t; try { m = JSON.parse(t).error.message; } catch (e) {} throw new Error('Google Drive (' + r.status + '): ' + m); }
  return r;
}
const AD = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
async function dBuscar(nombre, padre, carpeta) {
  const q = encodeURIComponent(`name='${nombre.replace(/'/g, "\\'")}' and '${padre}' in parents and trashed=false` + (carpeta ? " and mimeType='application/vnd.google-apps.folder'" : ''));
  return (await (await gd(`files?q=${q}&fields=files(id,name,version,modifiedTime)&${AD}`)).json()).files || [];
}
async function dCarpeta(nombre, padre) {
  const f = (await dBuscar(nombre, padre, true))[0]; if (f) return f.id;
  return (await (await gd(`files?${AD}&fields=id`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: nombre, parents: [padre], mimeType: 'application/vnd.google-apps.folder'})})).json()).id;
}
async function dSubir(meta, blob, fileId) {
  const b = 'rrss' + Date.now().toString(36);
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`]);
  const url = `https://www.googleapis.com/upload/drive/v3/files${fileId ? '/' + fileId : ''}?uploadType=multipart&supportsAllDrives=true&fields=id,version,webViewLink`;
  return (await gd(url, {method: fileId ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body})).json();
}
async function verificarAcceso() {
  const c = cfg(); if (!c.folderId) throw new Error('Falta el ID de la carpeta de Drive.');
  const u = (await (await gd('about?fields=user(emailAddress,displayName)')).json()).user;
  const email = (u.emailAddress || '').toLowerCase();
  if (c.allowedEmails.length && !c.allowedEmails.includes(email)) throw new Error(`La cuenta ${email} no está en la lista de usuarios autorizados. Solicite acceso a la GSMyGA.`);
  let fol;
  try { fol = await (await gd(`files/${c.folderId}?fields=id,name,capabilities(canAddChildren)&supportsAllDrives=true`)).json(); }
  catch (e) { throw new Error(`La cuenta ${email} no tiene acceso a la carpeta de Drive del inventario. Pida al administrador que la comparta con usted como Editor.`); }
  if (!fol.capabilities || !fol.capabilities.canAddChildren) throw new Error(`La cuenta ${email} solo puede ver la carpeta «${fol.name}»; necesita permiso de Editor.`);
  S.auth = {email, nombre: u.displayName, fecha: hoy(), carpeta: fol.name};
  if (!S.set.responsable) S.set.responsable = u.displayName || email;
  save();
  return S.auth;
}
function pendientesFotos() { let n = 0; S.devices.forEach(r => fotosMeta(r).forEach(f => { if (!f.driveId) n++; })); return n; }
function pendientesDatos() { return S.devices.filter(r => (r.actualizado || '') > ((S.sync && S.sync.fecha) || '')).length + (S.borrados || []).filter(b => b.fecha > ((S.sync && S.sync.fecha) || '')).length; }
function estadoDrive(txt) {
  const el = $('#estadoGuardado'); if (!el) return;
  const c = cfg(), pf = pendientesFotos(), pd = pendientesDatos();
  if (txt) el.textContent = txt;
  else if (!c.clientId) el.textContent = 'Solo en este equipo';
  else if (pd || pf) { el.textContent = `↑ ${pd + pf} pendientes`; el.title = `Pendiente de subir a Drive: ${pd} cambios y ${pf} fotos (toque para sincronizar)`; }
  else el.textContent = 'Drive al día' + (S.sync ? ' · ' + S.sync.fecha.slice(11, 16) : '');
  el.classList.toggle('pend', !!(c.clientId && (pd || pf)));
}
function programarSync() { if (!cfg().clientId || !tokenOk() || !navigator.onLine) return estadoDrive(); clearTimeout(G.tSync); G.tSync = setTimeout(() => sincronizar(false), 4000); }
window.addEventListener('online', programarSync);
function fusionarRemoto(o) {
  S.borrados = S.borrados || [];
  (o.borrados || []).forEach(b => { if (!S.borrados.some(x => x.id === b.id)) S.borrados.push(b); });
  const r = fusionar(o.devices || []);
  const ids = new Set(S.borrados.map(b => b.id));
  S.devices = S.devices.filter(d => !ids.has(d.id));
  return r;
}
async function sincronizar(manual = true) {
  if (G.sync) return; G.sync = true;
  try {
    if (!navigator.onLine) throw new Error('Sin internet: los cambios quedan guardados en el equipo y se subirán después.');
    const c = cfg(); estadoDrive('Conectando con Drive…');
    if (!tokenOk() || !S.auth) await verificarAcceso();
    const raiz = c.folderId, dirFotos = await dCarpeta('Fotos', raiz);
    /* 1. Fotos pendientes */
    let nF = 0, tot = pendientesFotos();
    for (const r of S.devices) {
      r.fotos = fotosMeta(r);
      for (const f of r.fotos) {
        if (f.driveId) continue;
        const data = await DB.get(f.k).catch(() => null); if (!data) continue;
        estadoDrive(`Subiendo foto ${nF + 1} de ${tot}…`);
        const blob = await (await fetch(data)).blob();
        const nombre = `${r.codigo}_${(f.fecha || hoy()).replace(/[:T]/g, '-').slice(0, 16)}_${f.k}.jpg`;
        const desc = `${r.codigo} · ${r.tipo} · ${r.direccion} · UTM 17S E ${f.e ?? '–'} N ${f.n ?? '–'}${f.acc ? ' ±' + f.acc + ' m' : ''} · Lat ${f.lat ?? '–'} Lon ${f.lon ?? '–'} · ${f.fecha}`;
        const res = await dSubir({name: nombre, parents: [dirFotos], mimeType: 'image/jpeg', description: desc, properties: {codigo: r.codigo, foto: f.k, este: String(f.e ?? ''), norte: String(f.n ?? '')}}, blob);
        f.driveId = res.id; f.url = res.webViewLink || 'https://drive.google.com/file/d/' + res.id + '/view';
        if (!r.foto) r.foto = f.url;
        nF++; save();
      }
    }
    /* 2. Base de datos: descargar → fusionar → subir (reintenta si otro equipo escribió entre medio) */
    let rs = {nuevos: 0, act: 0};
    for (let intento = 0; intento < 3; intento++) {
      estadoDrive('Sincronizando inventario…');
      const ex = (await dBuscar('inventario_rrss.json', raiz))[0];
      if (ex) { const remoto = await (await gd(`files/${ex.id}?alt=media&supportsAllDrives=true`)).json(); const x = fusionarRemoto(remoto); rs.nuevos += x.nuevos; rs.act += x.act; }
      if (ex) { const v = (await (await gd(`files/${ex.id}?fields=version&supportsAllDrives=true`)).json()).version; if (v !== ex.version) continue; }
      const payload = JSON.stringify({app: 'rrss_otuzco', version: 2, actualizado: hoy(), por: S.auth.email, devices: S.devices, borrados: S.borrados || [], cat: S.cat});
      await dSubir(ex ? {name: 'inventario_rrss.json'} : {name: 'inventario_rrss.json', parents: [raiz], mimeType: 'application/json', description: 'Base de datos del inventario de dispositivos RR.SS. – no editar a mano'}, new Blob([payload], {type: 'application/json'}), ex && ex.id);
      break;
    }
    /* 3. Excel actualizado para consulta */
    if (window.XLSX) {
      estadoDrive('Actualizando Excel en Drive…');
      const buf = XLSX.write(libroExcel(S.devices), {type: 'array', bookType: 'xlsx'});
      const ex = (await dBuscar('Inventario_RRSS_Otuzco.xlsx', raiz))[0];
      await dSubir(ex ? {name: 'Inventario_RRSS_Otuzco.xlsx'} : {name: 'Inventario_RRSS_Otuzco.xlsx', parents: [raiz]}, new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), ex && ex.id);
    }
    S.sync = {fecha: hoy(), por: S.auth.email}; save(); estadoDrive();
    if (manual || nF || rs.nuevos || rs.act) toast(`Drive sincronizado: ${nF} fotos subidas, ${rs.nuevos} registros nuevos y ${rs.act} actualizados desde otros equipos.`);
    if (rs.nuevos || rs.act) route();
  } catch (e) { estadoDrive(); if (manual) toast(e.message); else console.warn(e); }
  finally { G.sync = false; }
}
function requiereLogin() { const c = cfg(); return !!(c.clientId && c.requireLogin && !S.auth); }
function pantallaLogin() {
  $('#tabs').hidden = true;
  $('#view').innerHTML = `<div class="card" style="max-width:540px;margin:6vh auto">
    <h1>Acceso restringido</h1>
    <p>Esta aplicación guarda el inventario en la carpeta de Google Drive de la Gerencia de Servicios Municipales y Gestión Ambiental. Inicie sesión con una cuenta de Google que tenga permiso de <b>Editor</b> en esa carpeta.</p>
    <button class="btn pri" id="login" type="button" style="width:100%;margin-top:8px">Iniciar sesión con Google</button>
    <div id="loginMsg" style="margin-top:12px"></div>
    <p class="hint">Se le pedirá autorizar el acceso a Google Drive. Después podrá trabajar sin señal; los cambios se suben al recuperar internet.</p></div>`;
  $('#login').onclick = async () => {
    $('#loginMsg').innerHTML = '<p class="mut">Esperando autorización…</p>';
    try { await conectarGoogle(); const a = await verificarAcceso(); $('#tabs').hidden = false; toast('Bienvenido(a), ' + (a.nombre || a.email)); location.hash = 'panel'; route(); sincronizar(false); }
    catch (e) { S.auth = null; $('#loginMsg').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
  };
}
function tarjetaDrive() {
  const c = cfg();
  return `<div class="card"><h3>Google Drive y acceso</h3>
    ${S.auth ? `<div class="alert ok">Sesión: <b>${esc(S.auth.email)}</b>${S.auth.carpeta ? ' · carpeta «' + esc(S.auth.carpeta) + '»' : ''}</div>` : `<div class="alert ${c.clientId ? '' : 'info'}">${c.clientId ? 'Sin sesión de Google en este equipo.' : 'Drive aún no configurado: falta el ID de cliente OAuth (vea LEEME, paso 2).'}</div>`}
    <p class="small">Último envío: ${S.sync ? esc(S.sync.fecha.replace('T', ' ').slice(0, 16)) + ' por ' + esc(S.sync.por) : 'nunca'} · Pendientes: ${pendientesDatos()} cambios, ${pendientesFotos()} fotos.</p>
    <div class="row"><button class="btn pri" id="dSync" type="button">Sincronizar ahora</button>${S.auth ? '<button class="btn" id="dOut" type="button">Cerrar sesión</button>' : ''}${c.folderId ? `<a class="btn" href="https://drive.google.com/drive/folders/${esc(c.folderId)}" target="_blank" rel="noopener">Abrir carpeta</a>` : ''}</div>
    <details style="margin-top:12px"><summary><b>Configuración (administrador)</b></summary><div class="fg" style="margin-top:8px">
      <div class="w2"><label for="g_cid">ID de cliente OAuth (Google Cloud)</label><input id="g_cid" value="${esc(S.set.clientId || '')}" placeholder="${esc(CFG0.clientId || '…apps.googleusercontent.com')}"></div>
      <div class="w2"><label for="g_fid">Carpeta de Drive (enlace o ID)</label><input id="g_fid" value="${esc(S.set.folderId || '')}" placeholder="${esc(CFG0.folderId)}"></div>
    </div><button class="btn" id="gGuardar" type="button" style="margin-top:8px">Guardar configuración</button>
    <p class="hint">Lo normal es fijar estos valores una sola vez en <code>config.js</code> para todos los equipos.</p></details></div>`;
}
function eventosDrive() {
  $('#dSync').onclick = () => sincronizar(true).then(() => { if (location.hash === '#datos') datos(); });
  if ($('#dOut')) $('#dOut').onclick = () => confirmar('¿Cerrar la sesión de Google en este equipo? Los cambios no sincronizados se conservan en el equipo.', () => { try { G.token && google.accounts.oauth2.revoke(G.token, () => {}); } catch (e) {} G.token = null; S.auth = null; save(); route(); });
  $('#gGuardar').onclick = () => { S.set.clientId = $('#g_cid').value.trim(); const f = $('#g_fid').value.trim(); const m = f.match(/folders\/([\w-]+)/); S.set.folderId = m ? m[1] : f; S.auth = null; G.token = null; save('Configuración guardada'); route(); };
}

/* ---------- Inicio ---------- */
load(); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} estadoDrive(); route();
$('#estadoGuardado').onclick = () => { if (cfg().clientId) sincronizar(true); else location.hash = 'datos'; };
setTimeout(() => { if (cfg().clientId && S.auth && navigator.onLine && pendientesDatos() + pendientesFotos() > 0) estadoDrive(); }, 800);
window.__rrss = {calc, toUTM, fromUTM, S: () => S};
}
