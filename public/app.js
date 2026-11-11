/* Atlético Deportivo Farallones · App de seguimiento deportivo
   Perfiles: admin (todo), profesor (registra la semana), padre (consulta). */
'use strict';

// ---------- Datos de referencia ----------
const AREAS = [
  { key: 'tecnica', name: 'Técnica', items: [['control', 'Control de balón'], ['pase', 'Pase'], ['conduccion', 'Conducción'], ['remate', 'Remate']] },
  { key: 'fisico', name: 'Físico y coordinación', items: [['velocidad', 'Velocidad'], ['resistencia', 'Resistencia'], ['coordinacion', 'Coordinación']] },
  { key: 'juego', name: 'Juego y decisiones', items: [['posicionamiento', 'Ubicación en la cancha'], ['decisiones', 'Toma de decisiones']] },
  { key: 'valores', name: 'Actitud y valores', items: [['disciplina', 'Disciplina'], ['companerismo', 'Compañerismo'], ['esfuerzo', 'Esfuerzo']] },
];
const AREA_COLORS = ['#D3212A', '#1A4073', '#7A8AA0', '#4A90D9'];
// Los niveles describen el proceso, no califican: así lo leen los padres
const LEVELS = ['', 'Iniciando', 'En proceso', 'Avanzando', 'Consolidado', 'Destacado'];
const ROLE_NAMES = { admin: 'Administración', profesor: 'Profesor', padre: 'Familia' };
const KIND_NAMES = { aviso: 'Aviso', partido: 'Partido', evento: 'Evento', horario: 'Cambio de horario' };
let INFO_NOTE = 'Este seguimiento es informativo y formativo: muestra el proceso de su hijo o hija semana a semana. No es una calificación ni una comparación con otros niños. Úselo para conversar, motivar y acompañar.';

const state = {
  token: safeGet('adf_token'),
  user: null,
  unread: 0,
  installPrompt: null,
};

// ---------- Íconos ----------
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  team: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.9.4 5 2.8 5 5.8"/>'),
  megaphone: svg('<path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M17 8a5 5 0 010 8"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'),
  bell: svg('<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>'),
  exit: svg('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  download: svg('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'),
  clipboard: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>'),
};
const RIDGE = '<svg class="ridge" viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 14V11L30 8 44 10 70 4 86 8 110 1 128 7 140 5 168 10 190 6 214 9 250 3 268 8 300 6 330 10 352 7 400 11V14Z"/></svg>';

// ---------- Utilidades ----------
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const firstName = (name) => String(name || '').split(/\s+/)[0];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
function mondayOf(date) { const d = new Date(date); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
function fmtDay(s, opts = { day: 'numeric', month: 'short' }) { return s ? parseYmd(s).toLocaleDateString('es-CO', opts) : ''; }
function fmtWeek(s) {
  if (!s) return '';
  const a = parseYmd(s); const b = new Date(a); b.setDate(a.getDate() + 6);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString('es-CO', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  return `${left} al ${b.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
}
function age(birth) {
  if (!birth) return null;
  const b = parseYmd(birth); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isStaff = () => state.user && (state.user.role === 'admin' || state.user.role === 'profesor');

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && state.token) { endSession(); throw new Error((data && data.error) || 'Inicia sesión de nuevo'); }
  if (!res.ok) throw new Error((data && data.error) || 'No hay conexión con el servidor. Revisa tu internet');
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('is-error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function openModal({ title, body, foot = '', onOpen }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" type="button" aria-label="Cerrar">×</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('.modal-close,[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  const first = $('input,select,textarea', back);
  if (first) setTimeout(() => first.focus(), 50);
  if (onOpen) onOpen(back, close);
  return { el: back, close };
}

function confirmBox(message, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title: 'Confirmar',
      body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn ${danger ? 'btn-primary' : 'btn-dark'}" data-ok>${esc(ok)}</button>`,
    });
    $('[data-ok]', m.el).addEventListener('click', () => { done = true; m.close(); resolve(true); });
    new MutationObserver((_, obs) => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } })
      .observe(document.body, { childList: true });
  });
}

async function withBusy(btn, fn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = label; }
}

// ---------- Sesión ----------
function endSession() {
  state.token = null; state.user = null;
  safeSet('adf_token', null);
  location.hash = '#/ingreso';
  render();
}

async function logout() {
  if (!(await confirmBox('¿Quieres cerrar sesión en este dispositivo?', { ok: 'Salir', danger: true }))) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    // Solo se desvincula de este usuario; el permiso del teléfono se conserva para el próximo ingreso
    if (sub) await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  } catch { /* seguimos con la salida */ }
  pushSynced = false;
  endSession();
  toast('Sesión cerrada');
}

// ---------- Estructura general ----------
function tabsFor(role) {
  if (role === 'admin') return [['inicio', 'Inicio', I.home], ['jugadores', 'Jugadores', I.team], ['avisos', 'Avisos', I.megaphone], ['gestion', 'Gestión', I.gear], ['perfil', 'Perfil', I.user]];
  if (role === 'profesor') return [['inicio', 'Inicio', I.home], ['jugadores', 'Mis jugadores', I.team], ['avisos', 'Avisos', I.megaphone], ['perfil', 'Perfil', I.user]];
  return [['inicio', 'Mis hijos', I.team], ['avisos', 'Avisos', I.megaphone], ['notificaciones', 'Alertas', I.bell], ['perfil', 'Perfil', I.user]];
}

function shell(html, tab) {
  const u = state.user;
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/inicio" aria-label="Ir al inicio">
          <img src="/icons/crest.png" alt="">
          <span><b>Farallones</b><small>${esc(ROLE_NAMES[u.role])} · ${esc(firstName(u.name))}</small></span>
        </a>
        <a class="icon-btn" href="#/notificaciones" aria-label="Notificaciones">${I.bell}<span class="dot" id="unread-dot" ${state.unread ? '' : 'hidden'}>${state.unread > 9 ? '9+' : state.unread}</span></a>
        <button class="btn-exit" type="button" data-logout aria-label="Salir de la app">${I.exit}<span>Salir</span></button>
      </div>
      ${RIDGE}
    </header>
    <main id="main">${html}</main>
    <nav class="tabbar" aria-label="Secciones"><div class="tabbar-inner">
      ${tabsFor(u.role).map(([k, label, icon]) => `<a href="#/${k}" ${k === tab ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`).join('')}
    </div></nav>`;
  $('[data-logout]').addEventListener('click', logout);
  window.scrollTo(0, 0);
}

function setUnread(n) {
  state.unread = n;
  const dot = $('#unread-dot');
  if (dot) { dot.hidden = !n; dot.textContent = n > 9 ? '9+' : n; }
  if ('setAppBadge' in navigator) { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); }
}
async function refreshUnread() {
  if (!state.token) return;
  try { const r = await api('/api/notifications'); setUnread(r.unread); } catch { /* silencioso */ }
}

const loading = (tab) => shell('<p class="muted" style="padding:30px 0">Cargando…</p>', tab);
const backBtn = (href, label = 'Volver') => `<button class="back" type="button" onclick="${href ? `location.hash='${href}'` : 'history.back()'}">${I.back}${esc(label)}</button>`;
const infoNote = (title = 'Seguimiento informativo') => `<div class="info-note">${I.info}<p><strong>${esc(title)}</strong>${esc(INFO_NOTE)}</p></div>`;
const emptyState = (title, text, action = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;

// ---------- Ingreso ----------
function renderLogin() {
  $('#app').innerHTML = `
    <div class="login">
      <div class="login-box">
        <img class="crest" src="/icons/crest.png" alt="Escudo de Atlético Deportivo Farallones">
        <h1>Seguimiento Farallones</h1>
        <p>Ingresa con el correo y la contraseña que te entregó la escuela.</p>
        <form class="card" id="login-form" novalidate>
          <label class="field"><span>Correo</span><input class="input" type="email" name="email" autocomplete="username" inputmode="email" required></label>
          <label class="field"><span>Contraseña</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
          <p class="error-msg" id="login-error" role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
        </form>
        <button class="btn btn-ghost btn-block" type="button" data-install hidden style="margin-top:12px;color:#fff;border-color:rgba(255,255,255,.4)">${I.download}Instalar app en el teléfono</button>
      </div>
      <p class="login-foot">¿Olvidaste tu contraseña? Escríbele a la administración de la escuela.</p>
    </div>`;
  updateInstallButtons();
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = $('button[type=submit]', f);
    $('#login-error').textContent = '';
    btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: f.elements.email.value, password: f.elements.password.value } });
      state.token = r.token; state.user = r.user;
      safeSet('adf_token', r.token);
      location.hash = '#/inicio';
      render();
    } catch (err) {
      $('#login-error').textContent = err.message;
      btn.disabled = false; btn.textContent = 'Ingresar';
    }
  });
}

// ---------- Inicio ----------
async function renderHome() {
  loading('inicio');
  if (state.user.role === 'padre') return renderParentHome();
  const week = mondayOf(new Date());
  const [stats, players] = await Promise.all([api(`/api/dashboard?week=${week}`), api('/api/players')]);
  const active = players.filter((p) => p.active);
  const pending = active.filter((p) => !p.last_week || p.last_week < week);
  const isAdmin = state.user.role === 'admin';
  shell(`
    <div class="page-head"><div><h1>Hola, ${esc(firstName(state.user.name))}</h1><p>Semana del ${esc(fmtWeek(week))}</p></div></div>
    <div class="grid-2">
      <div class="stat"><b>${stats.players}</b><span>Jugadores activos</span></div>
      <div class="stat"><b>${stats.done_week}</b><span>Registrados esta semana</span></div>
      <div class="stat ${pending.length ? 'is-alert' : ''}"><b>${pending.length}</b><span>Pendientes por registrar</span></div>
      ${isAdmin ? `<div class="stat"><b>${stats.coaches}</b><span>Profesores</span></div><div class="stat"><b>${stats.parents}</b><span>Familias con acceso</span></div>` : ''}
    </div>
    <div id="push-slot"></div>
    <section class="section">
      <h2>Pendientes de esta semana</h2>
      ${pending.length ? `<div class="list">${pending.map((p) => `
        <div class="list-item">
          <span class="avatar">${esc(initials(p.full_name))}</span>
          <span class="grow"><span class="title">${esc(p.full_name)}</span><span class="sub">${esc(p.category_name || 'Sin categoría')}${p.last_week ? ` · último registro ${esc(fmtDay(p.last_week))}` : ' · sin registros aún'}</span></span>
          <a class="btn btn-primary btn-sm" href="#/registrar/${p.id}">Registrar</a>
        </div>`).join('')}</div>`
    : `<div class="card">${emptyState('Semana al día', active.length ? 'Todos los jugadores tienen su seguimiento de esta semana.' : (isAdmin ? 'Aún no hay jugadores. Empieza creando categorías y jugadores.' : 'Aún no tienes jugadores asignados. La administración debe asignarte una categoría.'), isAdmin && !active.length ? '<a class="btn btn-dark" href="#/jugadores">Ir a jugadores</a>' : '')}</div>`}
    </section>`, 'inicio');
  mountPushCard($('#push-slot'), true);
}

async function renderParentHome() {
  const [kids, notices] = await Promise.all([api('/api/players'), api('/api/announcements')]);
  shell(`
    <div class="page-head"><div><h1>Hola, ${esc(firstName(state.user.name))}</h1><p>Aquí ves cómo avanza el proceso de tus hijos en la escuela.</p></div></div>
    ${infoNote('Un seguimiento para acompañar')}
    <div id="push-slot"></div>
    <section class="section">
      <h2>${kids.length === 1 ? 'Tu jugador' : 'Tus jugadores'}</h2>
      ${kids.length ? `<div class="list">${kids.map((p) => `
        <a class="list-item" href="#/jugador/${p.id}">
          <span class="avatar is-red">${esc(initials(p.full_name))}</span>
          <span class="grow"><span class="title">${esc(p.full_name)}</span><span class="sub">${esc(p.category_name || '')}${p.coach_name ? ` · Profe ${esc(firstName(p.coach_name))}` : ''}</span></span>
          ${p.last_week ? `<span class="chip chip-ok">Semana ${esc(fmtDay(p.last_week))}</span>` : '<span class="chip chip-line">Sin reportes</span>'}
        </a>`).join('')}</div>`
    : `<div class="card">${emptyState('Aún no hay jugadores vinculados', 'Pide a la administración de la escuela que vincule a tu hijo o hija con tu usuario.')}</div>`}
    </section>
    <section class="section">
      <h2>Últimos avisos</h2>
      ${notices.length ? notices.slice(0, 3).map(noticeHTML).join('') : `<div class="card">${emptyState('Sin avisos por ahora', 'Cuando la escuela publique algo te llegará una notificación.')}</div>`}
      ${notices.length > 3 ? '<p style="margin-top:10px"><a href="#/avisos">Ver todos los avisos</a></p>' : ''}
    </section>`, 'inicio');
  mountPushCard($('#push-slot'), true);
}

// ---------- Jugadores ----------
async function renderPlayers() {
  loading('jugadores');
  const isAdmin = state.user.role === 'admin';
  const [players, categories] = await Promise.all([api('/api/players'), isAdmin ? api('/api/categories') : Promise.resolve([])]);
  const week = mondayOf(new Date());
  let filterCat = 'all';
  shell(`
    <div class="page-head">
      <div><h1>${isAdmin ? 'Jugadores' : 'Mis jugadores'}</h1><p>${players.length} en total</p></div>
      ${isAdmin ? `<button class="btn btn-primary" type="button" id="add-player">${I.plus}Agregar jugador</button>` : ''}
    </div>
    <div class="toolbar"><input class="input" type="search" id="search" placeholder="Buscar por nombre" aria-label="Buscar jugador"></div>
    ${isAdmin && categories.length ? `<div class="filters" role="group" aria-label="Filtrar por categoría">
      <button type="button" data-cat="all" aria-pressed="true">Todas</button>
      ${categories.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="false">${esc(c.name)}</button>`).join('')}</div>` : ''}
    <div id="player-list"></div>`, 'jugadores');

  const draw = () => {
    const term = $('#search').value.trim().toLowerCase();
    const list = players.filter((p) => (filterCat === 'all' || String(p.category_id) === filterCat) && p.full_name.toLowerCase().includes(term));
    $('#player-list').innerHTML = list.length ? `<div class="list">${list.map((p) => {
      const done = p.last_week && p.last_week >= week;
      return `<a class="list-item" href="#/jugador/${p.id}">
        <span class="avatar">${p.dorsal ? esc(p.dorsal) : esc(initials(p.full_name))}</span>
        <span class="grow"><span class="title">${esc(p.full_name)}</span>
          <span class="sub">${esc(p.category_name || 'Sin categoría')}${age(p.birth_date) !== null ? ` · ${age(p.birth_date)} años` : ''}${p.position ? ` · ${esc(p.position)}` : ''}</span></span>
        ${!p.active ? '<span class="chip chip-line">Inactivo</span>' : done ? '<span class="chip chip-ok">Semana lista</span>' : '<span class="chip chip-warn">Pendiente</span>'}
      </a>`;
    }).join('')}</div>` : `<div class="card">${emptyState(players.length ? 'Sin resultados' : 'Aún no hay jugadores', players.length ? 'Prueba con otro nombre o categoría.' : (isAdmin ? 'Agrega el primer jugador para empezar el seguimiento.' : 'La administración debe asignarte una categoría con jugadores.'))}</div>`;
  };
  draw();
  $('#search').addEventListener('input', draw);
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    filterCat = b.dataset.cat;
    $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  if (isAdmin) $('#add-player').addEventListener('click', () => playerForm(null, categories));
}

async function playerForm(player, categories) {
  categories = categories || await api('/api/categories');
  const parents = await api('/api/users?role=padre');
  const p = player || { active: true, guardians: [] };
  const linked = new Set((p.guardians || []).map((g) => g.id));
  const m = openModal({
    title: player ? 'Editar jugador' : 'Nuevo jugador',
    body: `<form id="pf" novalidate>
      <label class="field"><span>Nombre completo</span><input class="input" name="full_name" required value="${esc(p.full_name)}"></label>
      <div class="form-grid">
        <label class="field"><span>Fecha de nacimiento</span><input class="input" type="date" name="birth_date" value="${esc(p.birth_date || '')}"></label>
        <label class="field"><span>Categoría</span><select class="input" name="category_id"><option value="">Sin categoría</option>
          ${categories.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}${c.age_from ? ` (${c.age_from}–${c.age_to} años)` : ''}</option>`).join('')}</select></label>
        <label class="field"><span>Posición</span><select class="input" name="position">
          ${['', 'Portero', 'Defensa', 'Volante', 'Delantero', 'Por definir'].map((x) => `<option ${x === (p.position || '') ? 'selected' : ''} value="${x}">${x || 'Sin definir'}</option>`).join('')}</select></label>
        <label class="field"><span>Dorsal</span><input class="input" type="number" min="0" max="99" name="dorsal" value="${esc(p.dorsal ?? '')}"></label>
        <label class="field"><span>Pie dominante</span><select class="input" name="dominant_foot">
          ${['', 'Derecho', 'Izquierdo', 'Ambos'].map((x) => `<option ${x === (p.dominant_foot || '') ? 'selected' : ''} value="${x}">${x || 'Sin definir'}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Notas médicas o de cuidado</span><textarea class="input" name="medical_notes" placeholder="Alergias, asma, medicamentos…">${esc(p.medical_notes || '')}</textarea><small>Solo la ven la administración y el profesor de la categoría.</small></label>
      <div class="field"><span>Acudientes con acceso</span>
        ${parents.length ? `<input class="input" type="search" id="g-search" placeholder="Buscar acudiente" style="margin-bottom:6px">
        <div id="g-list" style="max-height:200px;overflow:auto">${parents.map((u) => `<label class="check" data-name="${esc(u.name.toLowerCase())}"><input type="checkbox" name="guardian" value="${u.id}" ${linked.has(u.id) ? 'checked' : ''}>${esc(u.name)} <span class="muted small">${esc(u.phone || u.email)}</span></label>`).join('')}</div>`
    : '<p class="muted small">Aún no hay usuarios con perfil Familia. Créalos en Gestión → Usuarios y luego vincúlalos aquí.</p>'}
      </div>
      ${player ? `<label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>Jugador activo</label>` : ''}
      <p class="error-msg" role="alert"></p>
    </form>`,
    foot: `${player ? '<button class="btn btn-danger" type="button" data-del>Eliminar</button>' : ''}<button class="btn btn-ghost" data-close type="button">Cancelar</button><button class="btn btn-primary" type="submit" form="pf">Guardar jugador</button>`,
  });
  const f = $('#pf', m.el);
  $('#g-search', m.el)?.addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    $$('#g-list .check', m.el).forEach((l) => { l.hidden = !l.dataset.name.includes(t); });
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      full_name: f.elements.full_name.value, birth_date: f.elements.birth_date.value, category_id: f.elements.category_id.value,
      position: f.elements.position.value, dorsal: f.elements.dorsal.value, dominant_foot: f.elements.dominant_foot.value,
      medical_notes: f.elements.medical_notes.value, guardian_ids: $$('input[name=guardian]:checked', f).map((x) => x.value),
      active: player ? f.elements.active.checked : true,
    };
    await withBusy($('button[type=submit]', m.el), async () => {
      try {
        const saved = await api(player ? `/api/players/${player.id}` : '/api/players', { method: player ? 'PUT' : 'POST', body });
        m.close(); toast(player ? 'Jugador actualizado' : 'Jugador agregado');
        if (player) render(); else location.hash = `#/jugador/${saved.id}`;
      } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
  $('[data-del]', m.el)?.addEventListener('click', async () => {
    m.close();
    if (!(await confirmBox(`Se eliminará a ${p.full_name} y todo su historial de seguimiento. Esta acción no se puede deshacer.`, { ok: 'Eliminar jugador', danger: true }))) return;
    try { await api(`/api/players/${player.id}`, { method: 'DELETE' }); toast('Jugador eliminado'); location.hash = '#/jugadores'; } catch (err) { toast(err.message, true); }
  });
}

// ---------- Ficha del jugador ----------
function areaAvg(scores, area) {
  const vals = area.items.map(([k]) => scores && scores[k]).filter((v) => v >= 1);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function reportHTML(ev) {
  const pct = ev.sessions_total ? Math.round((ev.sessions_attended / ev.sessions_total) * 100) : null;
  const areas = AREAS.map((a) => {
    const rows = a.items.filter(([k]) => ev.scores && ev.scores[k]).map(([k, label]) => {
      const v = ev.scores[k];
      return `<div class="bar-row"><span>${esc(label)}</span><span class="bar ${v <= 2 ? 'is-low' : ''}" role="img" aria-label="${esc(label)}: ${LEVELS[v]}"><i style="width:${v * 20}%"></i><em>${LEVELS[v]}</em></span></div>`;
    }).join('');
    return rows ? `<div class="area"><h3>${esc(a.name)}</h3>${rows}</div>` : '';
  }).join('');
  const blocks = [
    ev.highlight && `<div class="note-block is-star"><strong>Lo mejor de la semana</strong>${esc(ev.highlight)}</div>`,
    ev.to_improve && `<div class="note-block"><strong>Para seguir trabajando</strong>${esc(ev.to_improve)}</div>`,
    ev.home_tip && `<div class="note-block"><strong>Idea para practicar en casa</strong>${esc(ev.home_tip)}</div>`,
    ev.notes && `<div class="note-block"><strong>Comentario del profe</strong>${esc(ev.notes)}</div>`,
  ].filter(Boolean).join('');
  return `
    <div class="kpis">
      <div class="kpi"><b>${ev.sessions_attended}/${ev.sessions_total}</b><span>Asistencia${pct !== null ? ` · ${pct}%` : ''}</span></div>
      <div class="kpi"><b>${ev.goals}</b><span>Goles</span></div>
      <div class="kpi"><b>${ev.assists}</b><span>Pases de gol</span></div>
    </div>
    ${areas}
    ${blocks}
    <p class="muted small" style="margin-top:12px">Registrado por ${esc(ev.coach_name || 'el profesor')} · ${esc(new Date(ev.updated_at || ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }))}</p>`;
}

function chartHTML(evals) {
  const data = [...evals].slice(0, 10).reverse();
  if (data.length < 2) return '<p class="muted">La evolución aparece cuando haya al menos dos semanas registradas.</p>';
  const W = Math.max(340, 70 + data.length * 62); const H = 220;
  const L = 86; const R = 16; const T = 14; const B = 34;
  const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v) => T + ((5 - v) * (H - T - B)) / 4;
  let g = '';
  for (let v = 1; v <= 5; v++) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#DCE3EC"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#5E6B7D">${LEVELS[v]}</text>`;
  data.forEach((ev, i) => { g += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#5E6B7D">${esc(fmtDay(ev.week_start))}</text>`; });
  AREAS.forEach((a, ai) => {
    const pts = data.map((ev, i) => [x(i), areaAvg(ev.scores, a)]).filter((p) => p[1] !== null);
    if (!pts.length) return;
    g += `<polyline fill="none" stroke="${AREA_COLORS[ai]}" stroke-width="2.5" ${ai === 2 ? 'stroke-dasharray="6 4"' : ''} points="${pts.map(([px, v]) => `${px},${y(v)}`).join(' ')}"/>`;
    g += pts.map(([px, v]) => `<circle cx="${px}" cy="${y(v)}" r="3.5" fill="${AREA_COLORS[ai]}"/>`).join('');
  });
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución por áreas en las últimas semanas" style="font-family:var(--body);width:100%;height:auto;min-width:${data.length > 6 ? W : 300}px">${g}</svg></div>
    <div class="chart-legend">${AREAS.map((a, i) => `<span><i style="background:${AREA_COLORS[i]}"></i>${esc(a.name)}</span>`).join('')}</div>`;
}

async function renderPlayer(id) {
  loading(state.user.role === 'padre' ? 'inicio' : 'jugadores');
  const [p, evals] = await Promise.all([api(`/api/players/${id}`), api(`/api/players/${id}/evaluations?limit=26`)]);
  const role = state.user.role;
  const latest = evals[0];
  const a = age(p.birth_date);
  const totalGoals = evals.reduce((s, e) => s + e.goals, 0);
  const totalAtt = evals.reduce((s, e) => s + e.sessions_attended, 0);
  const totalSes = evals.reduce((s, e) => s + e.sessions_total, 0);
  shell(`
    ${backBtn(role === 'padre' ? '#/inicio' : '#/jugadores')}
    <div class="player-hero">
      ${p.dorsal !== null && p.dorsal !== undefined ? `<span class="dorsal" aria-hidden="true">${esc(p.dorsal)}</span>` : ''}
      <span class="chip chip-dark" style="background:var(--red)">${esc(p.category_name || 'Sin categoría')}</span>
      <h1>${esc(p.full_name)}</h1>
      <div class="meta">
        ${a !== null ? `<span>${a} años</span>` : ''}
        ${p.position ? `<span>${esc(p.position)}</span>` : ''}
        ${p.dominant_foot ? `<span>Pie ${esc(p.dominant_foot.toLowerCase())}</span>` : ''}
        ${p.coach_name ? `<span>Profe ${esc(p.coach_name)}</span>` : ''}
      </div>
    </div>
    ${role !== 'padre' ? `<div class="row-actions" style="margin-top:12px">
      <a class="btn btn-primary" href="#/registrar/${p.id}">${I.clipboard}Registrar semana</a>
      ${role === 'admin' ? `<button class="btn btn-ghost" type="button" id="edit-player">${I.edit}Editar datos</button>` : ''}
    </div>` : ''}
    ${role !== 'padre' && p.medical_notes ? `<div class="note-block" style="margin-top:12px;background:var(--warn-soft)"><strong>Notas de cuidado</strong>${esc(p.medical_notes)}</div>` : ''}
    ${role !== 'padre' && p.guardians.length ? `<p class="muted small" style="margin-top:10px">Acudientes: ${p.guardians.map((g) => esc(g.name) + (g.phone ? ` (${esc(g.phone)})` : '')).join(', ')}</p>` : ''}
    ${role === 'padre' ? `<div style="margin-top:14px">${infoNote()}</div>` : ''}

    <section class="section">
      <h2>${latest ? `Semana del ${esc(fmtWeek(latest.week_start))}` : 'Última semana'}</h2>
      ${latest ? `<div class="card">${reportHTML(latest)}</div>` : `<div class="card">${emptyState('Aún no hay seguimiento', role === 'padre' ? 'Cuando el profe registre la primera semana te llegará una notificación.' : 'Registra la primera semana de este jugador.')}</div>`}
    </section>

    ${evals.length ? `
    <section class="section">
      <h2>Evolución</h2>
      <div class="kpis" style="margin-bottom:10px">
        <div class="kpi"><b>${evals.length}</b><span>Semanas registradas</span></div>
        <div class="kpi"><b>${totalSes ? Math.round((totalAtt / totalSes) * 100) : 0}%</b><span>Asistencia</span></div>
        <div class="kpi"><b>${totalGoals}</b><span>Goles</span></div>
      </div>
      <div class="card">${chartHTML(evals)}</div>
    </section>` : ''}

    ${evals.length > 1 ? `
    <section class="section">
      <h2>Semanas anteriores</h2>
      ${evals.slice(1).map((ev) => `<details class="week"><summary><span>Semana del ${esc(fmtWeek(ev.week_start))}</span></summary><div class="week-body">${reportHTML(ev)}
        ${role !== 'padre' ? `<p style="margin-top:10px"><a href="#/registrar/${p.id}?semana=${ev.week_start}">Editar esta semana</a></p>` : ''}</div></details>`).join('')}
    </section>` : ''}`, role === 'padre' ? 'inicio' : 'jugadores');

  $('#edit-player')?.addEventListener('click', () => playerForm(p));

  // Antes de ver un reporte nuevo, los padres leen el mensaje informativo
  if (role === 'padre' && latest) {
    const seen = new Set(JSON.parse(safeGet('adf_seen') || '[]'));
    const key = `${latest.id}:${latest.updated_at}`;
    if (!seen.has(key)) {
      const m = openModal({
        title: 'Antes de ver el reporte',
        body: `<p>${esc(INFO_NOTE)}</p><p>Cada niño aprende a su ritmo. Si algo le inquieta, converse con el profe de ${esc(firstName(p.full_name))}: estamos para acompañar juntos.</p>`,
        foot: '<button class="btn btn-primary btn-block" type="button" data-close>Entendido, ver seguimiento</button>',
      });
      $('[data-close]', m.el).addEventListener('click', () => {
        seen.add(key);
        safeSet('adf_seen', JSON.stringify([...seen].slice(-200)));
      });
    }
  }
}

// ---------- Registro semanal ----------
async function renderEvaluationForm(id, weekParam) {
  loading('jugadores');
  const [p, evals] = await Promise.all([api(`/api/players/${id}`), api(`/api/players/${id}/evaluations?limit=52`)]);
  let week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(parseYmd(weekParam)) : mondayOf(new Date());
  const prev = evals[0] || null;

  shell(`
    ${backBtn(`#/jugador/${p.id}`, 'Volver a la ficha')}
    <div class="page-head"><div><h1>Registro semanal</h1><p>${esc(p.full_name)} · ${esc(p.category_name || '')}</p></div></div>
    <form id="ef" class="stack" novalidate>
      <div class="card">
        <label class="field" style="margin-bottom:6px"><span>Semana</span><input class="input" type="date" name="week" value="${week}" max="${ymd(new Date())}"></label>
        <p class="muted small" id="week-label" style="margin:0"></p>
        <p class="small" id="week-exists" style="margin:6px 0 0;color:var(--warn);font-weight:600"></p>
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px">Asistencia y partido</h3>
        <div class="step-grid">
          ${stepper('sessions_total', 'Entrenos programados', 3)}
          ${stepper('sessions_attended', 'Entrenos asistidos', 3)}
          ${stepper('goals', 'Goles', 0)}
          ${stepper('assists', 'Pases de gol', 0)}
        </div>
      </div>
      <div class="card">
        <h3>Cómo le fue</h3>
        <div class="legend-levels" style="margin:6px 0 4px">${LEVELS.slice(1).map((l, i) => `<span><b>${i + 1}</b> ${l}</span>`).join('')}</div>
        <p class="muted small">Toca el nivel que mejor describe la semana. Puedes dejar en blanco lo que no se trabajó.</p>
        ${AREAS.map((a) => `<div style="margin-top:14px"><h3 style="font-size:1.1rem;color:var(--red)">${esc(a.name)}</h3>
          ${a.items.map(([k, label]) => `<div class="skill"><div class="skill-name">${esc(label)}<em data-lv="${k}"></em></div>
            <div class="levels" role="radiogroup" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="s_${k}" value="${v}" aria-label="${LEVELS[v]}"><span>${v}</span></label>`).join('')}</div></div>`).join('')}
        </div>`).join('')}
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px">Mensaje para la familia</h3>
        <label class="field"><span>Lo mejor de la semana</span><textarea class="input" name="highlight" placeholder="Ej.: Ayudó a sus compañeros y se animó a pedir el balón."></textarea></label>
        <label class="field"><span>Para seguir trabajando</span><textarea class="input" name="to_improve" placeholder="Ej.: Levantar la cabeza antes de dar el pase."></textarea></label>
        <label class="field"><span>Idea para practicar en casa</span><textarea class="input" name="home_tip" placeholder="Ej.: 10 minutos de toques contra la pared con ambos pies."></textarea></label>
        <label class="field"><span>Comentario del profe</span><textarea class="input" name="notes"></textarea></label>
        <small class="muted">Escribe en positivo: la familia recibe este reporte como un acompañamiento, no como una nota.</small>
      </div>
      <p class="error-msg" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Guardar y enviar a la familia</button>
    </form>`, 'jugadores');

  const f = $('#ef');
  const fill = () => {
    const ev = evals.find((e) => e.week_start === week);
    $('#week-label').textContent = `Del ${fmtWeek(week)}`;
    $('#week-exists').textContent = ev ? 'Esta semana ya tiene registro. Al guardar se actualiza y la familia recibe aviso.' : '';
    const src = ev || { sessions_total: prev ? prev.sessions_total : 3, sessions_attended: prev ? prev.sessions_total : 3, goals: 0, assists: 0, scores: {} };
    ['sessions_total', 'sessions_attended', 'goals', 'assists'].forEach((k) => setStep(k, src[k]));
    AREAS.forEach((a) => a.items.forEach(([k]) => {
      $$(`input[name=s_${k}]`, f).forEach((r) => { r.checked = Number(r.value) === Number(src.scores[k]); });
      $(`[data-lv=${k}]`, f).textContent = src.scores[k] ? LEVELS[src.scores[k]] : '';
    }));
    ['highlight', 'to_improve', 'home_tip', 'notes'].forEach((k) => { f.elements[k].value = ev ? (ev[k] || '') : ''; });
  };
  function setStep(name, v) { const out = $(`output[data-step=${name}]`, f); out.value = Math.max(0, Number(v) || 0); out.textContent = out.value; }
  $$('.stepper button', f).forEach((b) => b.addEventListener('click', () => {
    const out = $(`output[data-step=${b.dataset.target}]`, f);
    let v = Number(out.value) + Number(b.dataset.delta);
    v = Math.min(Math.max(0, v), 30);
    if (b.dataset.target === 'sessions_attended') v = Math.min(v, Number($('output[data-step=sessions_total]', f).value));
    setStep(b.dataset.target, v);
    if (b.dataset.target === 'sessions_total') {
      const att = $('output[data-step=sessions_attended]', f);
      if (Number(att.value) > v) setStep('sessions_attended', v);
    }
  }));
  f.addEventListener('change', (e) => {
    if (e.target.name === 'week' && e.target.value) { week = mondayOf(parseYmd(e.target.value)); e.target.value = week; fill(); }
    if (e.target.name && e.target.name.startsWith('s_')) $(`[data-lv=${e.target.name.slice(2)}]`, f).textContent = LEVELS[e.target.value];
  });
  fill();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const scores = {};
    AREAS.forEach((a) => a.items.forEach(([k]) => { const r = $(`input[name=s_${k}]:checked`, f); if (r) scores[k] = Number(r.value); }));
    const num = (k) => Number($(`output[data-step=${k}]`, f).value);
    const body = {
      player_id: p.id, week_start: week, scores,
      sessions_total: num('sessions_total'), sessions_attended: num('sessions_attended'), goals: num('goals'), assists: num('assists'),
      highlight: f.elements.highlight.value, to_improve: f.elements.to_improve.value, home_tip: f.elements.home_tip.value, notes: f.elements.notes.value,
    };
    if (!Object.keys(scores).length) { $('.error-msg', f).textContent = 'Elige el nivel de al menos un aspecto.'; return; }
    await withBusy($('button[type=submit]', f), async () => {
      try {
        await api('/api/evaluations', { method: 'POST', body });
        toast(p.guardians.length ? 'Seguimiento guardado. La familia recibió la notificación' : 'Seguimiento guardado');
        location.hash = `#/jugador/${p.id}`;
      } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
}

function stepper(name, label, value) {
  return `<div class="field"><span>${esc(label)}</span><div class="stepper">
    <button type="button" data-target="${name}" data-delta="-1" aria-label="Restar ${esc(label)}">−</button>
    <output data-step="${name}" aria-live="polite" value="${value}">${value}</output>
    <button type="button" data-target="${name}" data-delta="1" aria-label="Sumar ${esc(label)}">+</button></div></div>`;
}

// ---------- Avisos ----------
function noticeHTML(n) {
  const canDelete = state.user.role === 'admin' || n.created_by === state.user.id;
  const who = n.audience === 'categoria' ? (n.category_name || 'Categoría') : { todos: 'Toda la escuela', padres: 'Familias', profesores: 'Profesores' }[n.audience];
  return `<article class="notice">
    <header><span class="chip ${n.kind === 'partido' ? 'chip-dark' : 'chip-line'}">${esc(KIND_NAMES[n.kind] || 'Aviso')}</span><span class="muted small">${esc(timeAgo(n.created_at))}</span></header>
    <h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>
    <p class="muted small" style="margin:0">Para: ${esc(who)}${n.author ? ` · ${esc(n.author)}` : ''}
    ${canDelete && isStaff() ? ` · <a href="#" data-del-notice="${n.id}">Eliminar</a>` : ''}</p>
  </article>`;
}

async function renderNotices() {
  loading('avisos');
  const notices = await api('/api/announcements');
  shell(`
    <div class="page-head"><div><h1>Avisos</h1><p>Partidos, eventos y novedades de la escuela.</p></div>
      ${isStaff() ? `<button class="btn btn-primary" type="button" id="new-notice">${I.plus}Nuevo aviso</button>` : ''}</div>
    ${notices.length ? notices.map(noticeHTML).join('') : `<div class="card">${emptyState('Sin avisos por ahora', isStaff() ? 'Publica el primero: a las familias les llega como notificación al teléfono.' : 'Cuando la escuela publique algo te llegará una notificación.')}</div>`}`, 'avisos');
  $('#new-notice')?.addEventListener('click', noticeForm);
  $$('[data-del-notice]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!(await confirmBox('¿Eliminar este aviso?', { ok: 'Eliminar', danger: true }))) return;
    try { await api(`/api/announcements/${a.dataset.delNotice}`, { method: 'DELETE' }); toast('Aviso eliminado'); render(); } catch (err) { toast(err.message, true); }
  }));
}

async function noticeForm() {
  const isAdmin = state.user.role === 'admin';
  const cats = (await api('/api/categories')).filter((c) => isAdmin || c.coach_id === state.user.id);
  if (!isAdmin && !cats.length) { toast('Aún no tienes categorías asignadas', true); return; }
  const m = openModal({
    title: 'Nuevo aviso',
    body: `<form id="nf" novalidate>
      <div class="form-grid">
        <label class="field"><span>Tipo</span><select class="input" name="kind">${Object.entries(KIND_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="field"><span>Para</span><select class="input" name="audience">
          ${isAdmin ? '<option value="todos">Toda la escuela</option><option value="padres">Todas las familias</option><option value="profesores">Profesores</option>' : ''}
          <option value="categoria" ${isAdmin ? '' : 'selected'}>Una categoría</option></select></label>
      </div>
      <label class="field" id="cat-field" ${isAdmin ? 'hidden' : ''}><span>Categoría</span><select class="input" name="category_id">${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Título</span><input class="input" name="title" maxlength="90" required placeholder="Ej.: Partido amistoso el sábado"></label>
      <label class="field"><span>Mensaje</span><textarea class="input" name="body" required placeholder="Lugar, hora, qué llevar…"></textarea></label>
      <p class="muted small">Se envía como notificación al teléfono de quienes la tengan activada.</p>
      <p class="error-msg" role="alert"></p></form>`,
    foot: '<button class="btn btn-ghost" data-close type="button">Cancelar</button><button class="btn btn-primary" type="submit" form="nf">Publicar y notificar</button>',
  });
  const f = $('#nf', m.el);
  f.elements.audience.addEventListener('change', () => { $('#cat-field', m.el).hidden = f.elements.audience.value !== 'categoria'; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy($('button[type=submit]', m.el), async () => {
      try {
        await api('/api/announcements', { method: 'POST', body: { kind: f.elements.kind.value, audience: f.elements.audience.value, category_id: f.elements.category_id.value, title: f.elements.title.value, body: f.elements.body.value } });
        m.close(); toast('Aviso publicado y notificado'); render();
      } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
}

// ---------- Notificaciones ----------
async function renderNotifications() {
  loading('notificaciones');
  const r = await api('/api/notifications');
  shell(`
    ${backBtn(null)}
    <div class="page-head"><div><h1>Notificaciones</h1><p>${r.unread ? `${r.unread} sin leer` : 'Todo al día'}</p></div></div>
    <div id="push-slot"></div>
    ${r.items.length ? `<div class="list" style="margin-top:12px">${r.items.map((n) => `
      <a class="notif ${n.read_at ? '' : 'is-new'}" href="${esc(n.url && n.url.startsWith('/#') ? n.url.slice(1) : '#/inicio')}" style="text-decoration:none;color:inherit">
        <span class="pin"></span><span><strong>${esc(n.title)}</strong><br><span class="small">${esc(n.body)}</span><br><span class="muted small">${esc(timeAgo(n.created_at))}</span></span>
      </a>`).join('')}</div>` : `<div class="card">${emptyState('No tienes notificaciones', 'Aquí verás los seguimientos semanales y los avisos de la escuela.')}</div>`}`, 'notificaciones');
  mountPushCard($('#push-slot'), true);
  if (r.unread) { try { await api('/api/notifications/read-all', { method: 'POST' }); setUnread(0); } catch { /* sin efecto */ } }
}

// ---------- Gestión (admin) ----------
async function renderAdmin(sub = 'usuarios') {
  loading('gestion');
  const tabs = `<div class="filters" role="tablist">
    <button type="button" role="tab" aria-pressed="${sub === 'usuarios'}" onclick="location.hash='#/gestion/usuarios'">Usuarios</button>
    <button type="button" role="tab" aria-pressed="${sub === 'categorias'}" onclick="location.hash='#/gestion/categorias'">Categorías</button></div>`;
  if (sub === 'categorias') {
    const [cats, users] = await Promise.all([api('/api/categories'), api('/api/users')]);
    const coaches = users.filter((u) => u.role !== 'padre' && u.active);
    shell(`
      <div class="page-head"><div><h1>Gestión</h1><p>Categorías por edad y su profesor a cargo.</p></div><button class="btn btn-primary" id="add-cat" type="button">${I.plus}Nueva categoría</button></div>
      ${tabs}
      <div class="list">${cats.map((c) => `<button class="list-item" type="button" data-cat-id="${c.id}">
        <span class="avatar is-red">${c.age_from ?? '–'}</span>
        <span class="grow"><span class="title">${esc(c.name)}${c.age_from ? ` · ${c.age_from} a ${c.age_to} años` : ''}</span>
        <span class="sub">${c.coach_name ? `Profe ${esc(c.coach_name)}` : 'Sin profesor asignado'}${c.schedule ? ` · ${esc(c.schedule)}` : ''}</span></span>
        <span class="chip chip-line">${c.players} jug.</span></button>`).join('') || emptyState('Sin categorías', 'Crea la primera categoría.')}</div>`, 'gestion');
    const form = (c) => categoryForm(c, coaches);
    $('#add-cat').addEventListener('click', () => form(null));
    $$('[data-cat-id]').forEach((b) => b.addEventListener('click', () => form(cats.find((c) => String(c.id) === b.dataset.catId))));
    return;
  }
  const users = await api('/api/users');
  let roleFilter = 'all';
  shell(`
    <div class="page-head"><div><h1>Gestión</h1><p>Accesos de administración, profesores y familias.</p></div><button class="btn btn-primary" id="add-user" type="button">${I.plus}Nuevo usuario</button></div>
    ${tabs}
    <div class="toolbar"><input class="input" type="search" id="u-search" placeholder="Buscar por nombre o correo" aria-label="Buscar usuario"></div>
    <div class="filters" role="group" aria-label="Filtrar por perfil">
      ${[['all', 'Todos'], ['admin', 'Administración'], ['profesor', 'Profesores'], ['padre', 'Familias']].map(([k, v]) => `<button type="button" data-role="${k}" aria-pressed="${k === 'all'}">${v}</button>`).join('')}
    </div>
    <div id="u-list"></div>`, 'gestion');
  const draw = () => {
    const t = $('#u-search').value.trim().toLowerCase();
    const list = users.filter((u) => (roleFilter === 'all' || u.role === roleFilter) && (u.name.toLowerCase().includes(t) || u.email.includes(t)));
    $('#u-list').innerHTML = list.length ? `<div class="list">${list.map((u) => `<button class="list-item" type="button" data-user-id="${u.id}">
      <span class="avatar ${u.role === 'padre' ? '' : 'is-red'}">${esc(initials(u.name))}</span>
      <span class="grow"><span class="title">${esc(u.name)}</span><span class="sub">${esc(u.email)}${u.phone ? ` · ${esc(u.phone)}` : ''}</span></span>
      <span class="chip ${u.active ? 'chip-line' : 'chip-warn'}">${u.active ? esc(ROLE_NAMES[u.role]) : 'Inactivo'}</span></button>`).join('')}</div>`
      : `<div class="card">${emptyState('Sin resultados', 'Prueba con otro nombre o perfil.')}</div>`;
    $$('[data-user-id]').forEach((b) => b.addEventListener('click', () => userForm(users.find((u) => String(u.id) === b.dataset.userId))));
  };
  draw();
  $('#u-search').addEventListener('input', draw);
  $$('[data-role]').forEach((b) => b.addEventListener('click', () => {
    roleFilter = b.dataset.role;
    $$('[data-role]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  $('#add-user').addEventListener('click', () => userForm(null));
}

function suggestPassword() {
  const words = ['Gol', 'Balon', 'Cancha', 'Arco', 'Pase', 'Farallon'];
  return `${words[Math.floor(Math.random() * words.length)]}${Math.floor(1000 + Math.random() * 9000)}`;
}

function userForm(u) {
  const isNew = !u;
  const m = openModal({
    title: isNew ? 'Nuevo usuario' : 'Editar usuario',
    body: `<form id="uf" novalidate>
      <label class="field"><span>Nombre completo</span><input class="input" name="name" required value="${esc(u?.name)}"></label>
      <div class="form-grid">
        <label class="field"><span>Correo</span><input class="input" type="email" name="email" required value="${esc(u?.email)}"></label>
        <label class="field"><span>Celular</span><input class="input" type="tel" name="phone" placeholder="300 123 4567" value="${esc(u?.phone || '')}"></label>
        <label class="field"><span>Perfil</span><select class="input" name="role">
          ${[['padre', 'Familia (padre, madre o acudiente)'], ['profesor', 'Profesor'], ['admin', 'Administración']].map(([k, v]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>${isNew ? 'Contraseña inicial' : 'Nueva contraseña'}</span><input class="input" name="password" value="${isNew ? suggestPassword() : ''}" placeholder="${isNew ? '' : 'Déjala vacía para no cambiarla'}"></label>
      </div>
      ${!isNew ? `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}>Usuario activo</label>` : ''}
      <p class="error-msg" role="alert"></p></form>`,
    foot: `${!isNew && u.id !== state.user.id ? '<button class="btn btn-danger" type="button" data-del>Eliminar</button>' : ''}<button class="btn btn-ghost" data-close type="button">Cancelar</button><button class="btn btn-primary" type="submit" form="uf">${isNew ? 'Crear usuario' : 'Guardar cambios'}</button>`,
  });
  const f = $('#uf', m.el);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: f.elements.name.value, email: f.elements.email.value, phone: f.elements.phone.value, role: f.elements.role.value, password: f.elements.password.value || undefined };
    if (!isNew) body.active = f.elements.active.checked;
    await withBusy($('button[type=submit]', m.el), async () => {
      try {
        await api(isNew ? '/api/users' : `/api/users/${u.id}`, { method: isNew ? 'POST' : 'PUT', body });
        m.close();
        if (isNew || body.password) shareAccess(body); else { toast('Usuario actualizado'); render(); }
      } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
  $('[data-del]', m.el)?.addEventListener('click', async () => {
    m.close();
    if (!(await confirmBox(`¿Eliminar a ${u.name}? Perderá el acceso a la app.`, { ok: 'Eliminar usuario', danger: true }))) return;
    try { await api(`/api/users/${u.id}`, { method: 'DELETE' }); toast('Usuario eliminado'); render(); } catch (err) { toast(err.message, true); }
  });
}

function shareAccess(b) {
  const msg = `Hola ${firstName(b.name)}, ya tienes acceso a la app de Atlético Deportivo Farallones.\n\nIngresa en: ${location.origin}\nCorreo: ${b.email}\nContraseña: ${b.password}\n\nTe recomendamos instalarla en tu celular y activar las notificaciones.`;
  const phone = String(b.phone || '').replace(/\D/g, '');
  const wa = `https://wa.me/${phone ? (phone.length === 10 ? `57${phone}` : phone) : ''}?text=${encodeURIComponent(msg)}`;
  const m = openModal({
    title: 'Acceso listo',
    body: `<p>Comparte estos datos con ${esc(b.name)}:</p><div class="note-block" style="white-space:pre-line">${esc(msg)}</div>`,
    foot: `<button class="btn btn-ghost" type="button" data-copy>Copiar</button><a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>`,
  });
  $('[data-copy]', m.el).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(msg); toast('Datos copiados'); } catch { toast('No se pudo copiar. Selecciona el texto manualmente', true); }
  });
  new MutationObserver((_, obs) => { if (!document.body.contains(m.el)) { obs.disconnect(); render(); } }).observe(document.body, { childList: true });
}

function categoryForm(c, coaches) {
  const m = openModal({
    title: c ? 'Editar categoría' : 'Nueva categoría',
    body: `<form id="cf" novalidate>
      <label class="field"><span>Nombre</span><input class="input" name="name" required value="${esc(c?.name)}" placeholder="Ej.: Semillero"></label>
      <div class="form-grid">
        <label class="field"><span>Edad desde</span><input class="input" type="number" min="3" max="40" name="age_from" value="${esc(c?.age_from ?? '')}"></label>
        <label class="field"><span>Edad hasta</span><input class="input" type="number" min="3" max="60" name="age_to" value="${esc(c?.age_to ?? '')}"></label>
      </div>
      <label class="field"><span>Horario</span><input class="input" name="schedule" value="${esc(c?.schedule || '')}" placeholder="Ej.: Mar y jue · 3:30 p. m."></label>
      <label class="field"><span>Profesor a cargo</span><select class="input" name="coach_id"><option value="">Sin asignar</option>
        ${coaches.map((u) => `<option value="${u.id}" ${c?.coach_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
        <small>El profesor solo ve y registra a los jugadores de sus categorías.</small></label>
      <p class="error-msg" role="alert"></p></form>`,
    foot: `${c ? '<button class="btn btn-danger" type="button" data-del>Eliminar</button>' : ''}<button class="btn btn-ghost" data-close type="button">Cancelar</button><button class="btn btn-primary" type="submit" form="cf">Guardar categoría</button>`,
  });
  const f = $('#cf', m.el);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: f.elements.name.value, age_from: f.elements.age_from.value, age_to: f.elements.age_to.value, schedule: f.elements.schedule.value, coach_id: f.elements.coach_id.value };
    await withBusy($('button[type=submit]', m.el), async () => {
      try { await api(c ? `/api/categories/${c.id}` : '/api/categories', { method: c ? 'PUT' : 'POST', body }); m.close(); toast('Categoría guardada'); render(); } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
  $('[data-del]', m.el)?.addEventListener('click', async () => {
    m.close();
    if (!(await confirmBox(`¿Eliminar la categoría ${c.name}? Sus jugadores quedarán sin categoría.`, { ok: 'Eliminar', danger: true }))) return;
    try { await api(`/api/categories/${c.id}`, { method: 'DELETE' }); toast('Categoría eliminada'); render(); } catch (err) { toast(err.message, true); }
  });
}

// ---------- Perfil ----------
async function renderProfile() {
  const u = state.user;
  shell(`
    <div class="page-head"><div><h1>Perfil</h1><p>${esc(ROLE_NAMES[u.role])}</p></div></div>
    <div class="card" style="display:flex;gap:14px;align-items:center">
      <span class="avatar is-red" style="width:56px;height:56px;font-size:1.4rem">${esc(initials(u.name))}</span>
      <div><strong style="font-size:1.1rem">${esc(u.name)}</strong><br><span class="muted">${esc(u.email)}</span>${u.phone ? `<br><span class="muted">${esc(u.phone)}</span>` : ''}</div>
    </div>
    <div id="push-slot"></div>
    <div id="install-slot"></div>
    <section class="section">
      <h2>Cambiar contraseña</h2>
      <form class="card" id="pw" novalidate>
        <label class="field"><span>Contraseña actual</span><input class="input" type="password" name="current" autocomplete="current-password"></label>
        <label class="field"><span>Nueva contraseña</span><input class="input" type="password" name="next" autocomplete="new-password" minlength="6"><small>Mínimo 6 caracteres.</small></label>
        <p class="error-msg" role="alert"></p>
        <button class="btn btn-dark" type="submit">Cambiar contraseña</button>
      </form>
    </section>
    <section class="section">
      <button class="btn btn-danger btn-block" type="button" data-logout>${I.exit}Salir de la app</button>
      <p class="muted small" style="text-align:center;margin-top:14px">Atlético Deportivo Farallones · Cali, Colombia</p>
    </section>`, 'perfil');
  $$('[data-logout]').forEach((b) => b.addEventListener('click', logout));
  mountPushCard($('#push-slot'), false);
  mountInstallCard($('#install-slot'));
  $('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await withBusy($('button[type=submit]', f), async () => {
      try { await api('/api/me/password', { method: 'POST', body: { current: f.elements.current.value, next: f.elements.next.value } }); f.reset(); $('.error-msg', f).textContent = ''; toast('Contraseña actualizada'); } catch (err) { $('.error-msg', f).textContent = err.message; }
    });
  });
}

// ---------- Notificaciones push ----------
function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function pushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await swReady();
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function swReady() {
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('La app aún se está preparando. Intenta de nuevo en unos segundos')), 6000))]);
}

async function enablePush() {
  safeSet('adf_push_off', null);
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Debes permitir las notificaciones en tu teléfono');
  const { key } = await api('/api/push/key');
  if (!key) throw new Error('Las notificaciones aún no están configuradas en el servidor');
  const reg = await swReady();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
}

async function disablePush() {
  safeSet('adf_push_off', '1'); // el usuario las apagó a propósito: no se reactivan solas
  const reg = await swReady();
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
}

// Si el teléfono ya dio permiso, se vuelve a conectar solo cada vez que alguien entra.
// Así las notificaciones quedan fijas hasta que el usuario las desactive en Perfil.
let pushSynced = false;
async function syncPush() {
  if (pushSynced || !state.token) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || safeGet('adf_push_off') === '1') return;
  pushSynced = true;
  try {
    const { key } = await api('/api/push/key');
    if (!key) return;
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
    await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch { pushSynced = false; }
}

async function mountPushCard(slot, onlyIfOff) {
  await syncPush();
  if (!slot) return;
  let status;
  try { status = await pushStatus(); } catch { status = 'unsupported'; }
  if (onlyIfOff && (status === 'on' || status === 'unsupported' || (status === 'off' && safeGet('adf_push_off') === '1'))) { slot.innerHTML = ''; return; }
  const texts = {
    on: ['Notificaciones activas', 'Quedan activas en este teléfono aunque cierres la app. Puedes desactivarlas cuando quieras.', '<button class="btn btn-ghost btn-sm" data-test>Enviar prueba</button><button class="btn btn-ghost btn-sm" data-off>Desactivar</button>'],
    off: ['Activa las notificaciones', state.user.role === 'padre' ? 'Recibe en tu teléfono el seguimiento semanal de tu hijo y los avisos de la escuela.' : 'Recibe en tu teléfono los avisos de la escuela.', '<button class="btn btn-primary btn-sm" data-on>Activar notificaciones</button>'],
    denied: ['Notificaciones bloqueadas', 'Las bloqueaste en este navegador. Actívalas desde los ajustes del navegador o del teléfono para este sitio.', ''],
    'ios-install': ['Instala la app para recibir notificaciones', 'En iPhone las notificaciones funcionan cuando agregas la app a tu pantalla de inicio (iOS 16.4 o superior).', '<button class="btn btn-primary btn-sm" data-install>Ver cómo instalar</button>'],
    unsupported: ['Notificaciones no disponibles', 'Este navegador no permite notificaciones. Prueba con Chrome en Android o instala la app en tu iPhone.', ''],
  }[status];
  slot.innerHTML = `<div class="card" style="margin-top:14px"><div class="install-hint">${I.bell.replace('<svg', '<svg style="width:34px;height:34px;color:var(--red);flex:none"')}
    <div><strong>${texts[0]}</strong><p class="muted small" style="margin:2px 0 8px">${texts[1]}</p><div class="row-actions">${texts[2]}</div></div></div></div>`;
  $('[data-on]', slot)?.addEventListener('click', async (e) => {
    await withBusy(e.currentTarget, async () => {
      try { await enablePush(); toast('Notificaciones activadas'); mountPushCard(slot, onlyIfOff); } catch (err) { toast(err.message, true); }
    });
  });
  $('[data-off]', slot)?.addEventListener('click', async () => {
    try { await disablePush(); toast('Notificaciones desactivadas'); mountPushCard(slot, onlyIfOff); } catch (err) { toast(err.message, true); }
  });
  $('[data-test]', slot)?.addEventListener('click', async () => {
    try { await api('/api/push/test', { method: 'POST' }); toast('Prueba enviada'); refreshUnread(); } catch (err) { toast(err.message, true); }
  });
  $('[data-install]', slot)?.addEventListener('click', installApp);
}

// ---------- Instalar como app ----------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  updateInstallButtons();
});
window.addEventListener('appinstalled', () => { state.installPrompt = null; toast('App instalada'); updateInstallButtons(); });

function canOfferInstall() { return !isStandalone() && (state.installPrompt || isIOS()); }
function updateInstallButtons() {
  $$('[data-install]').forEach((b) => {
    if (b.closest('.card')) return;
    b.hidden = !canOfferInstall();
    b.onclick = installApp;
  });
}

async function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => null);
    state.installPrompt = null;
    updateInstallButtons();
    return;
  }
  openModal({
    title: 'Instalar en el teléfono',
    body: isIOS()
      ? `<ol style="padding-left:20px;margin:0"><li>Abre esta página en <strong>Safari</strong>.</li><li>Toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).</li><li>Elige <strong>Agregar a pantalla de inicio</strong> y luego <strong>Agregar</strong>.</li><li>Abre la app desde el ícono del escudo y activa las notificaciones.</li></ol>`
      : `<ol style="padding-left:20px;margin:0"><li>Abre el menú del navegador (los tres puntos).</li><li>Elige <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>.</li><li>Abre la app desde el ícono del escudo.</li></ol>`,
    foot: '<button class="btn btn-primary" type="button" data-close>Entendido</button>',
  });
}

function mountInstallCard(slot) {
  if (!slot || isStandalone()) return;
  slot.innerHTML = `<div class="card" style="margin-top:14px"><div class="install-hint"><img src="/icons/icon-192.png" alt="">
    <div><strong>Lleva la app en tu teléfono</strong><p class="muted small" style="margin:2px 0 8px">Instálala para abrirla desde un ícono, como cualquier otra app.</p>
    <button class="btn btn-dark btn-sm" type="button" id="install-now">${I.download}Instalar app</button></div></div></div>`;
  $('#install-now', slot).addEventListener('click', installApp);
}

// ---------- Enrutador ----------
async function render() {
  const hash = location.hash.replace(/^#\/?/, '') || 'inicio';
  const [pathPart, query = ''] = hash.split('?');
  const [route, param] = pathPart.split('/');
  const params = new URLSearchParams(query);

  if (!state.token) { renderLogin(); return; }
  if (!state.user) {
    try {
      const r = await api('/api/me');
      state.user = r.user;
      if (r.infoNote) INFO_NOTE = r.infoNote;
    } catch (err) {
      if (state.token) { $('#app').innerHTML = `<div class="login"><div class="login-box"><h1>Sin conexión</h1><p>${esc(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></div>`; }
      return;
    }
  }
  try {
    switch (route) {
      case 'jugadores': await renderPlayers(); break;
      case 'jugador': await renderPlayer(param); break;
      case 'registrar': if (isStaff()) await renderEvaluationForm(param, params.get('semana')); else location.hash = '#/inicio'; break;
      case 'avisos': await renderNotices(); break;
      case 'notificaciones': await renderNotifications(); break;
      case 'gestion': if (state.user.role === 'admin') await renderAdmin(param || 'usuarios'); else location.hash = '#/inicio'; break;
      case 'perfil': await renderProfile(); break;
      case 'ingreso': location.hash = '#/inicio'; break;
      default: await renderHome();
    }
  } catch (err) {
    shell(`${backBtn('#/inicio', 'Ir al inicio')}<div class="card">${emptyState('No se pudo cargar', err.message, '<button class="btn btn-dark" onclick="location.reload()">Reintentar</button>')}</div>`, '');
  }
  refreshUnread();
  syncPush();
}

window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUnread(); });
navigator.serviceWorker?.addEventListener('message', () => refreshUnread());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
render();
