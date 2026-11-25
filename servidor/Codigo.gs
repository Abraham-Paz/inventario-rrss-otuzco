/**
 * SERVIDOR DEL INVENTARIO DE DISPOSITIVOS RR.SS. – MUNICIPALIDAD PROVINCIAL DE OTUZCO
 * Google Apps Script. Se ejecuta con la cuenta del ADMINISTRADOR y guarda todo en su Drive:
 *   - inventario_rrss.json ............ base de datos (no editar a mano)
 *   - Fotos/ ......................... fotografías georreferenciadas
 *   - "Inventario RRSS Otuzco – Respuestas" (Hoja de cálculo de Google): INVENTARIO, HISTORIAL,
 *     FOTOS GEORREF y BITÁCORA, actualizada en cada sincronización.
 * Usuarios y contraseñas se guardan cifradas (SHA-256 con sal) en las propiedades privadas del script.
 * Instalación: vea LEEME.md, sección "Servidor".
 */

// ===================== CONFIGURACIÓN =====================
const CARPETA_ID = '1Phs2Qo_D6yPBAscCLrqfqKnk2w4mcEAW'; // carpeta de Drive del administrador
const ADMIN_USUARIO = 'admin';                           // usuario administrador
const ADMIN_CLAVE_INICIAL = 'Otuzco2026';                // clave del primer ingreso (se obliga a cambiarla)
const DIAS_SESION = 7;                                   // días que dura una sesión sin volver a ingresar
// ==========================================================

const PERMISOS = ['panel', 'inventario', 'registrar', 'inspeccion', 'mapa', 'tecnico', 'diseno', 'datos', 'corregir', 'eliminar'];
const CAMPOS_INSPECCION = ['estado', 'cantidad', 'llenado', 'alrededor', 'frecuencia', 'defectos', 'fotos', 'historial', 'actualizado', 'foto'];
const PROPS = PropertiesService.getScriptProperties();

function doGet() {
  return ContentService.createTextOutput('Servidor del Inventario RR.SS. Otuzco activo. Use la aplicación para ingresar.');
}

function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    out = despachar(q);
  } catch (err) {
    out = {ok: false, error: String(err && err.message || err), codigo: err && err.codigo || ''};
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function despachar(q) {
  if (q.accion === 'login') return login(q.usuario, q.clave);
  const u = verificarToken(q.token);
  switch (q.accion) {
    case 'yo': return {ok: true, usuario: publico(u)};
    case 'cambiarClave': return cambiarClave(u, q.actual, q.nueva);
    case 'pull': requiere(u, 'panel|inventario|registrar|inspeccion|mapa|tecnico|datos'); return {ok: true, db: leerDB(), hoja: urlHoja(), fecha: ahora()};
    case 'push': return push(u, q);
    case 'hoja': requiere(u, 'registrar|inspeccion|corregir'); escribirHoja(q.hojas || {}); return {ok: true, hoja: urlHoja()};
    case 'subirFoto': requiere(u, 'registrar|inspeccion'); return subirFoto(u, q);
    case 'foto': requiere(u, 'inventario'); return foto(q.id);
    case 'leerHoja': requiere(u, 'corregir'); return {ok: true, filas: leerHoja()};
    case 'usuarios': soloAdmin(u); return {ok: true, usuarios: listarUsuarios()};
    case 'guardarUsuario': soloAdmin(u); return guardarUsuario(q.datos || {}, u);
    case 'resetClave': soloAdmin(u); return resetClave(q.usuario, u);
    case 'eliminarUsuario': soloAdmin(u); return eliminarUsuario(q.usuario, u);
  }
  throw new Error('Acción no válida.');
}

// ---------------- Utilidades ----------------
function ahora() { return Utilities.formatDate(new Date(), 'America/Lima', "yyyy-MM-dd'T'HH:mm:ss"); }
function b64(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function errSesion(msg) { const e = new Error(msg); e.codigo = 'SESION'; return e; }
function carpeta() { return DriveApp.getFolderById(CARPETA_ID); }
function subcarpeta(nombre) { const it = carpeta().getFoldersByName(nombre); return it.hasNext() ? it.next() : carpeta().createFolder(nombre); }
function secreto() {
  let s = PROPS.getProperty('SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); PROPS.setProperty('SECRETO', s); }
  return s;
}
function hashClave(clave, sal) {
  let h = sal + '|' + clave;
  for (let i = 0; i < 300; i++) h = b64(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + sal, Utilities.Charset.UTF_8));
  return h;
}
function generarClave() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}
function normUsuario(u) { return String(u || '').trim().toLowerCase(); }

// ---------------- Usuarios ----------------
function leerUsuario(usuario) { const t = PROPS.getProperty('u:' + normUsuario(usuario)); return t ? JSON.parse(t) : null; }
function escribirUsuario(o) { PROPS.setProperty('u:' + o.usuario, JSON.stringify(o)); }
function publico(o) {
  return {usuario: o.usuario, nombre: o.nombre, cargo: o.cargo || '', rol: o.rol, permisos: o.rol === 'admin' ? PERMISOS.slice() : (o.permisos || []),
    activo: o.activo !== false, debeCambiar: !!o.debeCambiar, creado: o.creado || '', ultimoAcceso: o.ultimoAcceso || ''};
}
function asegurarAdmin() {
  if (!leerUsuario(ADMIN_USUARIO)) {
    const sal = Utilities.getUuid();
    escribirUsuario({usuario: ADMIN_USUARIO, nombre: 'Administrador', cargo: 'Administrador del sistema', rol: 'admin', permisos: PERMISOS.slice(),
      activo: true, sal: sal, hash: hashClave(ADMIN_CLAVE_INICIAL, sal), debeCambiar: true, tv: 1, creado: ahora()});
  }
}
function tiene(u, p) { return u.rol === 'admin' || (u.permisos || []).indexOf(p) >= 0; }
function requiere(u, lista) { if (!lista.split('|').some(function (p) { return tiene(u, p); })) throw new Error('Su usuario no tiene permiso para esta acción.'); }
function soloAdmin(u) { if (u.rol !== 'admin') throw new Error('Solo el administrador puede realizar esta acción.'); }

function login(usuario, clave) {
  asegurarAdmin();
  usuario = normUsuario(usuario);
  const cache = CacheService.getScriptCache(), k = 'fallos:' + usuario, fallos = Number(cache.get(k) || 0);
  if (fallos >= 5) throw new Error('Demasiados intentos fallidos. Espere 15 minutos o pida al administrador que restablezca su contraseña.');
  const o = leerUsuario(usuario);
  if (!o || o.activo === false || hashClave(String(clave || ''), o.sal) !== o.hash) {
    cache.put(k, String(fallos + 1), 900);
    throw new Error('Usuario o contraseña incorrectos.');
  }
  cache.remove(k);
  o.ultimoAcceso = ahora(); escribirUsuario(o);
  bitacora(o.usuario, 'Ingreso', '');
  return {ok: true, token: crearToken(o), usuario: publico(o), dias: DIAS_SESION};
}
function crearToken(o) {
  const exp = Date.now() + DIAS_SESION * 86400000;
  const carga = o.usuario + '|' + exp + '|' + (o.tv || 1);
  const firma = b64(Utilities.computeHmacSha256Signature(carga, secreto()));
  return b64(Utilities.newBlob(carga).getBytes()) + '.' + firma;
}
function verificarToken(token) {
  if (!token) throw errSesion('Inicie sesión.');
  const partes = String(token).split('.');
  if (partes.length !== 2) throw errSesion('Sesión no válida.');
  const carga = Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0] + '==='.slice((partes[0].length + 3) % 4))).getDataAsString();
  if (b64(Utilities.computeHmacSha256Signature(carga, secreto())) !== partes[1]) throw errSesion('Sesión no válida.');
  const d = carga.split('|');
  if (Date.now() > Number(d[1])) throw errSesion('Su sesión venció. Vuelva a ingresar.');
  const o = leerUsuario(d[0]);
  if (!o || o.activo === false) throw errSesion('Su usuario fue desactivado.');
  if (String(o.tv || 1) !== d[2]) throw errSesion('Su contraseña o sus permisos cambiaron. Vuelva a ingresar.');
  return o;
}
function cambiarClave(u, actual, nueva) {
  if (hashClave(String(actual || ''), u.sal) !== u.hash) throw new Error('La contraseña actual no es correcta.');
  nueva = String(nueva || '');
  if (nueva.length < 8 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) throw new Error('La nueva contraseña debe tener al menos 8 caracteres, con letras y números.');
  u.sal = Utilities.getUuid(); u.hash = hashClave(nueva, u.sal); u.debeCambiar = false; u.tv = (u.tv || 1) + 1;
  escribirUsuario(u); bitacora(u.usuario, 'Cambio de contraseña', '');
  return {ok: true, token: crearToken(u), usuario: publico(u)};
}
function listarUsuarios() {
  const p = PROPS.getProperties(), out = [];
  Object.keys(p).forEach(function (k) { if (k.indexOf('u:') === 0) out.push(publico(JSON.parse(p[k]))); });
  return out.sort(function (a, b) { return a.usuario < b.usuario ? -1 : 1; });
}
function guardarUsuario(d, admin) {
  const usuario = normUsuario(d.usuario);
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion.');
  const permisos = (d.permisos || []).filter(function (p) { return PERMISOS.indexOf(p) >= 0; });
  let o = leerUsuario(usuario), clave = null;
  if (o) {
    if (usuario === ADMIN_USUARIO && d.activo === false) throw new Error('No se puede desactivar al administrador.');
    const cambioPermisos = JSON.stringify(o.permisos || []) !== JSON.stringify(permisos) || (o.activo !== false) !== (d.activo !== false);
    o.nombre = d.nombre || o.nombre; o.cargo = d.cargo || ''; if (o.rol !== 'admin') o.permisos = permisos; o.activo = d.activo !== false;
    if (cambioPermisos) o.tv = (o.tv || 1) + 1;
    bitacora(admin.usuario, 'Usuario modificado', usuario + ' · ' + permisos.join(','));
  } else {
    clave = d.clave && String(d.clave).length >= 8 ? String(d.clave) : generarClave();
    const sal = Utilities.getUuid();
    o = {usuario: usuario, nombre: d.nombre || usuario, cargo: d.cargo || '', rol: 'usuario', permisos: permisos, activo: d.activo !== false,
      sal: sal, hash: hashClave(clave, sal), debeCambiar: true, tv: 1, creado: ahora()};
    bitacora(admin.usuario, 'Usuario creado', usuario + ' · ' + permisos.join(','));
  }
  escribirUsuario(o);
  return {ok: true, usuario: publico(o), clave: clave};
}
function resetClave(usuario, admin) {
  const o = leerUsuario(usuario); if (!o) throw new Error('Usuario no encontrado.');
  const clave = generarClave();
  o.sal = Utilities.getUuid(); o.hash = hashClave(clave, o.sal); o.debeCambiar = true; o.tv = (o.tv || 1) + 1;
  escribirUsuario(o); CacheService.getScriptCache().remove('fallos:' + o.usuario);
  bitacora(admin.usuario, 'Contraseña restablecida', o.usuario);
  return {ok: true, clave: clave};
}
function eliminarUsuario(usuario, admin) {
  usuario = normUsuario(usuario);
  if (usuario === ADMIN_USUARIO) throw new Error('No se puede eliminar al administrador.');
  PROPS.deleteProperty('u:' + usuario); bitacora(admin.usuario, 'Usuario eliminado', usuario);
  return {ok: true};
}

// ---------------- Base de datos ----------------
function archivoDB() { const it = carpeta().getFilesByName('inventario_rrss.json'); return it.hasNext() ? it.next() : null; }
function leerDB() {
  const f = archivoDB();
  const db = f ? JSON.parse(f.getBlob().getDataAsString('UTF-8')) : {devices: [], borrados: []};
  db.devices = db.devices || []; db.borrados = db.borrados || [];
  return db;
}
function escribirDB(db) {
  db.actualizado = ahora();
  const txt = JSON.stringify(db), f = archivoDB();
  if (f) f.setContent(txt); else carpeta().createFile('inventario_rrss.json', txt, 'application/json').setDescription('Base de datos del inventario RR.SS. – NO EDITAR A MANO');
}
function clave(f) { return typeof f === 'string' ? f : (f && f.k); }
function unirFotos(a, b) {
  const m = {}, orden = [];
  (a || []).concat(b || []).forEach(function (f) {
    const o = typeof f === 'string' ? {k: f} : f; if (!o || !o.k) return;
    if (!m[o.k]) { m[o.k] = o; orden.push(o.k); }
    else { const p = m[o.k]; m[o.k] = Object.assign({}, p, o, {driveId: p.driveId || o.driveId, url: p.url || o.url}); }
  });
  return orden.map(function (k) { return m[k]; });
}
function unirHistorial(a, b) {
  const out = (a || []).slice();
  (b || []).forEach(function (h) { if (!out.some(function (x) { return x.id === h.id; })) out.push(h); });
  return out.sort(function (x, y) { return (x.fecha || '') < (y.fecha || '') ? -1 : 1; });
}
function soloCamposInspeccion(antes, despues) {
  const ks = {}; Object.keys(antes).concat(Object.keys(despues)).forEach(function (k) { ks[k] = 1; });
  return Object.keys(ks).every(function (k) { return CAMPOS_INSPECCION.indexOf(k) >= 0 || JSON.stringify(antes[k]) === JSON.stringify(despues[k]); });
}
function push(u, q) {
  requiere(u, 'registrar|inspeccion|corregir');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const db = leerDB(), rechazados = [];
    let nuevos = 0, act = 0;
    (q.borrados || []).forEach(function (b) {
      if (!tiene(u, 'eliminar')) { rechazados.push((b.codigo || b.id) + ': sin permiso para eliminar'); return; }
      if (!db.borrados.some(function (x) { return x.id === b.id; })) db.borrados.push(b);
    });
    const ids = {}; db.borrados.forEach(function (b) { ids[b.id] = 1; });
    (q.devices || []).forEach(function (n) {
      if (!n || !n.codigo || ids[n.id]) return;
      const e = db.devices.filter(function (d) { return (n.id && d.id === n.id) || d.codigo === n.codigo; })[0];
      if (!e) {
        if (!tiene(u, 'registrar') && !tiene(u, 'corregir')) { rechazados.push(n.codigo + ': sin permiso para registrar'); return; }
        db.devices.push(n); nuevos++; return;
      }
      if (!tiene(u, 'registrar') && !tiene(u, 'corregir') && !soloCamposInspeccion(e, n)) { rechazados.push(n.codigo + ': solo puede actualizar campos de inspección'); return; }
      const hist = unirHistorial(e.historial, n.historial), fotos = unirFotos(e.fotos, n.fotos);
      if ((n.actualizado || '') > (e.actualizado || '')) { Object.keys(n).forEach(function (k) { if (k !== 'id') e[k] = n[k]; }); act++; }
      e.historial = hist; e.fotos = fotos;
    });
    db.devices = db.devices.filter(function (d) { return !ids[d.id]; });
    if (q.cat && u.rol === 'admin') db.cat = q.cat;
    if (q.set && u.rol === 'admin') db.set = q.set;
    escribirDB(db);
    if (nuevos || act || (q.borrados || []).length) bitacora(u.usuario, 'Sincronización', nuevos + ' nuevos, ' + act + ' actualizados, ' + (q.borrados || []).length + ' eliminados' + (rechazados.length ? ' · rechazados: ' + rechazados.join('; ') : ''));
    return {ok: true, db: db, nuevos: nuevos, act: act, rechazados: rechazados, fecha: ahora(), hoja: urlHoja()};
  } finally { lock.releaseLock(); }
}

// ---------------- Fotos ----------------
function subirFoto(u, q) {
  const datos = String(q.data || '');
  const m = datos.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('Foto no válida.');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(q.nombre || ('foto_' + Date.now() + '.jpg')).replace(/[\\/:*?"<>|]/g, '_'));
  const f = subcarpeta('Fotos').createFile(blob);
  f.setDescription(String(q.descripcion || '').slice(0, 2000) + ' · Subida por ' + u.usuario);
  return {ok: true, id: f.getId(), url: f.getUrl()};
}
function foto(id) {
  id = String(id || '');
  if (!/^[\w-]{10,}$/.test(id)) throw new Error('Identificador de foto no válido.');
  if (JSON.stringify(leerDB()).indexOf(id) < 0) throw new Error('La foto no pertenece al inventario.');
  const tok = ScriptApp.getOAuthToken(), h = {headers: {Authorization: 'Bearer ' + tok}, muteHttpExceptions: true};
  try {
    const meta = JSON.parse(UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=thumbnailLink&supportsAllDrives=true', h).getContentText());
    if (meta.thumbnailLink) {
      const r = UrlFetchApp.fetch(meta.thumbnailLink.replace(/=s\d+$/, '=s1200'), h);
      if (r.getResponseCode() === 200) return {ok: true, data: 'data:image/jpeg;base64,' + Utilities.base64Encode(r.getContent())};
    }
  } catch (e) { /* se intenta el archivo completo */ }
  const f = DriveApp.getFileById(id);
  if (f.getSize() > 6000000) throw new Error('La foto es demasiado pesada para mostrarse.');
  return {ok: true, data: 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes())};
}

// ---------------- Hoja de respuestas ----------------
function hoja() {
  let id = PROPS.getProperty('HOJA_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Inventario RRSS Otuzco – Respuestas');
    DriveApp.getFileById(ss.getId()).moveTo(carpeta());
    PROPS.setProperty('HOJA_ID', ss.getId());
  }
  return ss;
}
function urlHoja() { try { return hoja().getUrl(); } catch (e) { return ''; } }
function seguro(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : (v == null ? '' : v); }
function escribirHoja(hojas) {
  const ss = hoja();
  Object.keys(hojas).forEach(function (nombre) {
    const filas = hojas[nombre] || []; if (!filas.length) return;
    const ancho = Math.max.apply(null, filas.map(function (f) { return f.length; }));
    const datos = filas.map(function (f) { const r = f.map(seguro); while (r.length < ancho) r.push(''); return r; });
    const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.clearContents();
    sh.getRange(1, 1, datos.length, ancho).setValues(datos);
    sh.getRange(1, 1, 1, ancho).setFontWeight('bold').setBackground('#0b6b45').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) { const s = ss.getSheetByName(n); if (s && ss.getSheets().length > 1) ss.deleteSheet(s); });
}
function leerHoja() {
  const sh = hoja().getSheetByName('INVENTARIO');
  if (!sh) throw new Error('La hoja INVENTARIO aún no existe; sincronice primero.');
  return sh.getDataRange().getValues();
}
function bitacora(usuario, accion, detalle) {
  try {
    const ss = hoja(); let sh = ss.getSheetByName('BITÁCORA');
    if (!sh) { sh = ss.insertSheet('BITÁCORA'); sh.appendRow(['FECHA', 'USUARIO', 'ACCIÓN', 'DETALLE']); sh.getRange(1, 1, 1, 4).setFontWeight('bold'); sh.setFrozenRows(1); }
    sh.appendRow([ahora(), usuario, accion, String(detalle || '').slice(0, 1000)]);
  } catch (e) { /* la bitácora nunca debe impedir la operación */ }
}

/** Ejecútela una vez desde el editor para autorizar los permisos de Drive y crear la hoja de respuestas. */
function instalar() {
  asegurarAdmin();
  Logger.log('Carpeta: ' + carpeta().getName());
  Logger.log('Hoja de respuestas: ' + urlHoja());
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
  Logger.log('Listo. Usuario administrador: ' + ADMIN_USUARIO + ' (clave inicial: la definida en ADMIN_CLAVE_INICIAL).');
}
