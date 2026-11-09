// Atlético Deportivo Farallones · App de seguimiento deportivo
// Node + Express + PostgreSQL (Render) + Web Push
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { Pool, types } = require('pg');

// Las fechas (DATE) se devuelven como texto AAAA-MM-DD para evitar corrimientos de zona horaria
types.setTypeParser(1082, (v) => v);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-produccion';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'admin@farallones.co';

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL');
  process.exit(1);
}

const useSSL = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === 'true'
  : /render\.com/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
const q = (text, params) => pool.query(text, params);

// Mensaje informativo que acompaña cada reporte a los padres
const INFO_NOTE =
  'Este seguimiento es informativo y formativo: muestra el proceso de su hijo o hija semana a semana. ' +
  'No es una calificación ni una comparación con otros niños. Úselo para conversar, motivar y acompañar.';

// Áreas evaluadas (1 a 5). Debe coincidir con public/app.js
const SCORE_KEYS = [
  'control', 'pase', 'conduccion', 'remate',
  'velocidad', 'resistencia', 'coordinacion',
  'posicionamiento', 'decisiones',
  'disciplina', 'companerismo', 'esfuerzo',
];

// ---------- Utilidades ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpError = (status, message) => Object.assign(new Error(message), { status });
const toInt = (v, d = 0) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const nullable = (v) => (v === '' || v === undefined ? null : v);

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active };
}

const auth = wrap(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Inicia sesión para continuar');
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { throw httpError(401, 'Tu sesión venció. Inicia sesión de nuevo'); }
  const { rows } = await q('SELECT * FROM users WHERE id=$1', [payload.id]);
  if (!rows[0] || !rows[0].active) throw httpError(401, 'Usuario inactivo');
  req.user = rows[0];
  next();
});

const role = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(httpError(403, 'No tienes permiso para esta acción'));

// ¿Puede este usuario ver al jugador?
async function canSeePlayer(user, playerId) {
  if (user.role === 'admin') return true;
  if (user.role === 'profesor') {
    const { rows } = await q(
      `SELECT 1 FROM players p JOIN categories c ON c.id=p.category_id
       WHERE p.id=$1 AND c.coach_id=$2`, [playerId, user.id]);
    return rows.length > 0;
  }
  const { rows } = await q('SELECT 1 FROM player_guardians WHERE player_id=$1 AND user_id=$2', [playerId, user.id]);
  return rows.length > 0;
}

// ---------- Notificaciones (en la app + push al teléfono) ----------
let pushReady = false;

async function setupPush() {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    // Si no hay llaves en variables de entorno, se generan una vez y se guardan en la base de datos
    const { rows } = await q("SELECT key, value FROM settings WHERE key IN ('vapid_public','vapid_private')");
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    if (map.vapid_public && map.vapid_private) {
      pub = map.vapid_public; priv = map.vapid_private;
    } else {
      const keys = webpush.generateVAPIDKeys();
      pub = keys.publicKey; priv = keys.privateKey;
      await q("INSERT INTO settings(key,value) VALUES ('vapid_public',$1),('vapid_private',$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [pub, priv]);
      console.log('Llaves VAPID generadas y guardadas en la base de datos');
    }
  }
  webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, pub, priv);
  app.locals.vapidPublic = pub;
  pushReady = true;
}

async function notify(userIds, { title, body, url }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await q(
    `INSERT INTO notifications(user_id,title,body,url)
     SELECT unnest($1::int[]), $2, $3, $4`, [ids, title, body, url || null]);
  if (!pushReady) return;
  const { rows: subs } = await q('SELECT * FROM push_subscriptions WHERE user_id = ANY($1::int[])', [ids]);
  const payload = JSON.stringify({ title, body, url: url || '/' });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 * 3 });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await q('DELETE FROM push_subscriptions WHERE id=$1', [s.id]);
      } else {
        console.warn('Push falló:', err.statusCode || err.message);
      }
    }
  }));
}

// ---------- Autenticación ----------
app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw httpError(400, 'Escribe tu correo y contraseña');
  const { rows } = await q('SELECT * FROM users WHERE LOWER(email)=$1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw httpError(401, 'Correo o contraseña incorrectos');
  if (!user.active) throw httpError(403, 'Tu usuario está inactivo. Habla con la administración');
  res.json({ token: sign(user), user: publicUser(user) });
}));

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), infoNote: INFO_NOTE }));

app.post('/api/me/password', auth, wrap(async (req, res) => {
  const { current, next: nueva } = req.body;
  if (!nueva || String(nueva).length < 6) throw httpError(400, 'La nueva contraseña debe tener al menos 6 caracteres');
  if (!(await bcrypt.compare(String(current || ''), req.user.password_hash))) throw httpError(400, 'La contraseña actual no coincide');
  await q('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(String(nueva), 10), req.user.id]);
  res.json({ ok: true });
}));

// ---------- Usuarios (admin) ----------
app.get('/api/users', auth, role('admin'), wrap(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.role) { params.push(req.query.role); where = 'WHERE role=$1'; }
  const { rows } = await q(`SELECT id,name,email,phone,role,active,created_at FROM users ${where} ORDER BY role, name`, params);
  res.json(rows);
}));

app.post('/api/users', auth, role('admin'), wrap(async (req, res) => {
  const name = clean(req.body.name);
  const email = String(req.body.email || '').trim().toLowerCase();
  const r = req.body.role;
  const password = String(req.body.password || '');
  if (!name || !email || !['admin', 'profesor', 'padre'].includes(r)) throw httpError(400, 'Completa nombre, correo y perfil');
  if (password.length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
  try {
    const { rows } = await q(
      'INSERT INTO users(name,email,phone,role,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email, nullable(clean(req.body.phone)), r, await bcrypt.hash(password, 10)]);
    res.status(201).json(publicUser(rows[0]));
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'Ya existe un usuario con ese correo');
    throw e;
  }
}));

app.put('/api/users/:id', auth, role('admin'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const { rows: cur } = await q('SELECT * FROM users WHERE id=$1', [id]);
  if (!cur[0]) throw httpError(404, 'Usuario no encontrado');
  const u = cur[0];
  const name = clean(req.body.name) || u.name;
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : u.email;
  const phone = req.body.phone !== undefined ? nullable(clean(req.body.phone)) : u.phone;
  const r = ['admin', 'profesor', 'padre'].includes(req.body.role) ? req.body.role : u.role;
  const active = typeof req.body.active === 'boolean' ? req.body.active : u.active;
  if (id === req.user.id && (!active || r !== 'admin')) throw httpError(400, 'No puedes desactivarte ni quitarte el perfil de administrador');
  let hash = u.password_hash;
  if (req.body.password) {
    if (String(req.body.password).length < 6) throw httpError(400, 'La contraseña debe tener al menos 6 caracteres');
    hash = await bcrypt.hash(String(req.body.password), 10);
  }
  try {
    const { rows } = await q(
      'UPDATE users SET name=$1,email=$2,phone=$3,role=$4,active=$5,password_hash=$6 WHERE id=$7 RETURNING *',
      [name, email, phone, r, active, hash, id]);
    res.json(publicUser(rows[0]));
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'Ya existe un usuario con ese correo');
    throw e;
  }
}));

app.delete('/api/users/:id', auth, role('admin'), wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (id === req.user.id) throw httpError(400, 'No puedes eliminar tu propio usuario');
  await q('DELETE FROM users WHERE id=$1', [id]);
  res.json({ ok: true });
}));

// ---------- Categorías ----------
app.get('/api/categories', auth, wrap(async (_req, res) => {
  const { rows } = await q(
    `SELECT c.*, u.name AS coach_name,
       (SELECT COUNT(*)::int FROM players p WHERE p.category_id=c.id AND p.active) AS players
     FROM categories c LEFT JOIN users u ON u.id=c.coach_id ORDER BY c.age_from NULLS LAST, c.name`);
  res.json(rows);
}));

app.post('/api/categories', auth, role('admin'), wrap(async (req, res) => {
  const name = clean(req.body.name);
  if (!name) throw httpError(400, 'Escribe el nombre de la categoría');
  try {
    const { rows } = await q(
      'INSERT INTO categories(name,age_from,age_to,schedule,coach_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, nullable(req.body.age_from), nullable(req.body.age_to), nullable(clean(req.body.schedule)), nullable(req.body.coach_id)]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'Ya existe una categoría con ese nombre');
    throw e;
  }
}));

app.put('/api/categories/:id', auth, role('admin'), wrap(async (req, res) => {
  const { rows } = await q(
    'UPDATE categories SET name=$1,age_from=$2,age_to=$3,schedule=$4,coach_id=$5 WHERE id=$6 RETURNING *',
    [clean(req.body.name), nullable(req.body.age_from), nullable(req.body.age_to), nullable(clean(req.body.schedule)), nullable(req.body.coach_id), toInt(req.params.id)]);
  if (!rows[0]) throw httpError(404, 'Categoría no encontrada');
  res.json(rows[0]);
}));

app.delete('/api/categories/:id', auth, role('admin'), wrap(async (req, res) => {
  await q('DELETE FROM categories WHERE id=$1', [toInt(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- Jugadores ----------
const PLAYER_SELECT = `
  SELECT p.*, c.name AS category_name, c.coach_id, cu.name AS coach_name,
    COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',u.name,'phone',u.phone))
              FROM player_guardians g JOIN users u ON u.id=g.user_id WHERE g.player_id=p.id), '[]') AS guardians,
    (SELECT MAX(week_start) FROM evaluations e WHERE e.player_id=p.id) AS last_week
  FROM players p
  LEFT JOIN categories c ON c.id=p.category_id
  LEFT JOIN users cu ON cu.id=c.coach_id`;

app.get('/api/players', auth, wrap(async (req, res) => {
  let sql = PLAYER_SELECT;
  const params = [];
  if (req.user.role === 'profesor') { params.push(req.user.id); sql += ' WHERE c.coach_id=$1 AND p.active'; }
  else if (req.user.role === 'padre') { params.push(req.user.id); sql += ' WHERE p.id IN (SELECT player_id FROM player_guardians WHERE user_id=$1)'; }
  else if (req.query.category) { params.push(toInt(req.query.category)); sql += ' WHERE p.category_id=$1'; }
  sql += ' ORDER BY c.age_from NULLS LAST, p.full_name';
  const { rows } = await q(sql, params);
  res.json(rows);
}));

app.get('/api/players/:id', auth, wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!(await canSeePlayer(req.user, id))) throw httpError(403, 'No tienes acceso a este jugador');
  const { rows } = await q(`${PLAYER_SELECT} WHERE p.id=$1`, [id]);
  if (!rows[0]) throw httpError(404, 'Jugador no encontrado');
  res.json(rows[0]);
}));

async function savePlayer(id, b) {
  const fields = [clean(b.full_name), nullable(b.birth_date), nullable(b.category_id), nullable(clean(b.position)),
    nullable(b.dorsal), nullable(clean(b.dominant_foot)), nullable(clean(b.medical_notes)),
    typeof b.active === 'boolean' ? b.active : true];
  if (!fields[0]) throw httpError(400, 'Escribe el nombre del jugador');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let row;
    if (id) {
      ({ rows: [row] } = await client.query(
        `UPDATE players SET full_name=$1,birth_date=$2,category_id=$3,position=$4,dorsal=$5,dominant_foot=$6,medical_notes=$7,active=$8
         WHERE id=$9 RETURNING *`, [...fields, id]));
      if (!row) throw httpError(404, 'Jugador no encontrado');
    } else {
      ({ rows: [row] } = await client.query(
        `INSERT INTO players(full_name,birth_date,category_id,position,dorsal,dominant_foot,medical_notes,active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, fields));
    }
    if (Array.isArray(b.guardian_ids)) {
      await client.query('DELETE FROM player_guardians WHERE player_id=$1', [row.id]);
      const ids = b.guardian_ids.map((x) => toInt(x)).filter(Boolean);
      if (ids.length) await client.query('INSERT INTO player_guardians(player_id,user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [row.id, ids]);
    }
    await client.query('COMMIT');
    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

app.post('/api/players', auth, role('admin'), wrap(async (req, res) => res.status(201).json(await savePlayer(null, req.body))));
app.put('/api/players/:id', auth, role('admin'), wrap(async (req, res) => res.json(await savePlayer(toInt(req.params.id), req.body))));
app.delete('/api/players/:id', auth, role('admin'), wrap(async (req, res) => {
  await q('DELETE FROM players WHERE id=$1', [toInt(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- Seguimiento semanal ----------
app.get('/api/players/:id/evaluations', auth, wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!(await canSeePlayer(req.user, id))) throw httpError(403, 'No tienes acceso a este jugador');
  const { rows } = await q(
    `SELECT e.*, u.name AS coach_name FROM evaluations e LEFT JOIN users u ON u.id=e.coach_id
     WHERE e.player_id=$1 ORDER BY e.week_start DESC LIMIT $2`, [id, Math.min(toInt(req.query.limit, 26), 104)]);
  res.json(rows);
}));

app.post('/api/evaluations', auth, role('admin', 'profesor'), wrap(async (req, res) => {
  const b = req.body;
  const playerId = toInt(b.player_id);
  if (!(await canSeePlayer(req.user, playerId))) throw httpError(403, 'Este jugador no está en tus categorías');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.week_start || ''))) throw httpError(400, 'Elige la semana del registro');

  const scores = {};
  for (const k of SCORE_KEYS) {
    const v = toInt(b.scores && b.scores[k], 0);
    if (v >= 1 && v <= 5) scores[k] = v;
  }
  if (!Object.keys(scores).length) throw httpError(400, 'Valora al menos un aspecto del jugador');
  const total = Math.max(0, toInt(b.sessions_total));
  const attended = Math.min(Math.max(0, toInt(b.sessions_attended)), total || 99);

  const { rows: [ev] } = await q(
    `INSERT INTO evaluations(player_id,coach_id,week_start,sessions_total,sessions_attended,scores,goals,assists,highlight,to_improve,home_tip,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (player_id,week_start) DO UPDATE SET
       coach_id=EXCLUDED.coach_id, sessions_total=EXCLUDED.sessions_total, sessions_attended=EXCLUDED.sessions_attended,
       scores=EXCLUDED.scores, goals=EXCLUDED.goals, assists=EXCLUDED.assists, highlight=EXCLUDED.highlight,
       to_improve=EXCLUDED.to_improve, home_tip=EXCLUDED.home_tip, notes=EXCLUDED.notes, updated_at=NOW()
     RETURNING *, (xmax = 0) AS inserted`,
    [playerId, req.user.id, b.week_start, total, attended, JSON.stringify(scores), Math.max(0, toInt(b.goals)),
      Math.max(0, toInt(b.assists)), nullable(clean(b.highlight)), nullable(clean(b.to_improve)),
      nullable(clean(b.home_tip)), nullable(clean(b.notes))]);

  const { rows: [player] } = await q('SELECT full_name FROM players WHERE id=$1', [playerId]);
  const { rows: guardians } = await q('SELECT user_id FROM player_guardians WHERE player_id=$1', [playerId]);
  const first = player.full_name.split(' ')[0];
  await notify(guardians.map((g) => g.user_id), {
    title: ev.inserted ? `Nuevo seguimiento semanal de ${first}` : `Se actualizó el seguimiento de ${first}`,
    body: 'El profe registró cómo le fue esta semana. Recuerde: es un reporte informativo para acompañar su proceso, no una calificación.',
    url: `/#/jugador/${playerId}`,
  });
  res.status(ev.inserted ? 201 : 200).json(ev);
}));

app.delete('/api/evaluations/:id', auth, role('admin'), wrap(async (req, res) => {
  await q('DELETE FROM evaluations WHERE id=$1', [toInt(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- Avisos ----------
app.get('/api/announcements', auth, wrap(async (req, res) => {
  const u = req.user;
  let sql = `SELECT a.*, c.name AS category_name, u.name AS author FROM announcements a
             LEFT JOIN categories c ON c.id=a.category_id LEFT JOIN users u ON u.id=a.created_by`;
  const params = [];
  if (u.role === 'padre') {
    params.push(u.id);
    sql += ` WHERE a.audience IN ('todos','padres') OR (a.audience='categoria' AND a.category_id IN
      (SELECT p.category_id FROM players p JOIN player_guardians g ON g.player_id=p.id WHERE g.user_id=$1))`;
  } else if (u.role === 'profesor') {
    params.push(u.id);
    sql += ` WHERE a.audience IN ('todos','profesores') OR (a.audience='categoria' AND a.category_id IN
      (SELECT id FROM categories WHERE coach_id=$1)) OR a.created_by=$1`;
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 50';
  const { rows } = await q(sql, params);
  res.json(rows);
}));

app.post('/api/announcements', auth, role('admin', 'profesor'), wrap(async (req, res) => {
  const title = clean(req.body.title);
  const body = clean(req.body.body);
  const kind = ['aviso', 'partido', 'evento', 'horario'].includes(req.body.kind) ? req.body.kind : 'aviso';
  let audience = req.body.audience;
  const categoryId = nullable(req.body.category_id);
  if (!title || !body) throw httpError(400, 'Escribe el título y el mensaje del aviso');
  if (!['todos', 'padres', 'profesores', 'categoria'].includes(audience)) throw httpError(400, 'Elige a quién va dirigido');
  if (audience === 'categoria' && !categoryId) throw httpError(400, 'Elige la categoría');
  if (req.user.role === 'profesor') {
    // El profesor solo envía avisos a sus categorías
    if (audience !== 'categoria') throw httpError(403, 'Como profesor puedes enviar avisos a tus categorías');
    const { rows } = await q('SELECT 1 FROM categories WHERE id=$1 AND coach_id=$2', [categoryId, req.user.id]);
    if (!rows.length) throw httpError(403, 'Esa categoría no está a tu cargo');
  }
  const { rows: [a] } = await q(
    'INSERT INTO announcements(title,body,kind,audience,category_id,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [title, body, kind, audience, audience === 'categoria' ? categoryId : null, req.user.id]);

  let targets;
  if (audience === 'todos') ({ rows: targets } = await q('SELECT id FROM users WHERE active AND id<>$1', [req.user.id]));
  else if (audience === 'padres') ({ rows: targets } = await q("SELECT id FROM users WHERE active AND role='padre'"));
  else if (audience === 'profesores') ({ rows: targets } = await q("SELECT id FROM users WHERE active AND role='profesor'"));
  else ({ rows: targets } = await q(
    `SELECT DISTINCT g.user_id AS id FROM player_guardians g JOIN players p ON p.id=g.player_id WHERE p.category_id=$1 AND p.active
     UNION SELECT coach_id FROM categories WHERE id=$1 AND coach_id IS NOT NULL`, [categoryId]));
  await notify(targets.map((t) => t.id).filter((id) => id !== req.user.id), { title, body, url: '/#/avisos' });
  res.status(201).json(a);
}));

app.delete('/api/announcements/:id', auth, role('admin', 'profesor'), wrap(async (req, res) => {
  const extra = req.user.role === 'profesor' ? ' AND created_by=$2' : '';
  const params = req.user.role === 'profesor' ? [toInt(req.params.id), req.user.id] : [toInt(req.params.id)];
  await q(`DELETE FROM announcements WHERE id=$1${extra}`, params);
  res.json({ ok: true });
}));

// ---------- Notificaciones ----------
app.get('/api/notifications', auth, wrap(async (req, res) => {
  const { rows } = await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60', [req.user.id]);
  const { rows: [{ count }] } = await q('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({ items: rows, unread: count });
}));

app.post('/api/notifications/read-all', auth, wrap(async (req, res) => {
  await q('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

app.get('/api/push/key', (req, res) => res.json({ key: req.app.locals.vapidPublic || null }));

app.post('/api/push/subscribe', auth, wrap(async (req, res) => {
  const s = req.body || {};
  if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) throw httpError(400, 'Suscripción inválida');
  await q(
    `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
    [req.user.id, s.endpoint, s.keys.p256dh, s.keys.auth]);
  res.json({ ok: true });
}));

app.post('/api/push/unsubscribe', auth, wrap(async (req, res) => {
  await q('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [String(req.body.endpoint || ''), req.user.id]);
  res.json({ ok: true });
}));

app.post('/api/push/test', auth, wrap(async (req, res) => {
  await notify([req.user.id], { title: 'Notificaciones activas', body: 'Así te llegarán los avisos y seguimientos de la escuela.', url: '/#/inicio' });
  res.json({ ok: true });
}));

// ---------- Panel ----------
app.get('/api/dashboard', auth, role('admin', 'profesor'), wrap(async (req, res) => {
  let week = String(req.query.week || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    const d = new Date(Date.now() - 5 * 3600 * 1000); // hora de Colombia
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    week = d.toISOString().slice(0, 10);
  }
  const isProf = req.user.role === 'profesor';
  const scope = isProf ? 'AND c.coach_id=$2' : '';
  const params = isProf ? [week, req.user.id] : [week];
  const { rows: [stats] } = await q(
    `SELECT
       (SELECT COUNT(*)::int FROM players p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active ${isProf ? 'AND c.coach_id=$2' : ''}) AS players,
       (SELECT COUNT(*)::int FROM evaluations e JOIN players p ON p.id=e.player_id LEFT JOIN categories c ON c.id=p.category_id
          WHERE e.week_start=$1 ${scope}) AS done_week,
       (SELECT COUNT(*)::int FROM users WHERE role='profesor' AND active) AS coaches,
       (SELECT COUNT(*)::int FROM users WHERE role='padre' AND active) AS parents`, params);
  res.json(stats);
}));

// ---------- Archivos estáticos (PWA) ----------
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, file) {
    if (file.endsWith('sw.js') || file.endsWith('.webmanifest') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Ocurrió un error en el servidor. Intenta de nuevo' : err.message });
});

// ---------- Arranque ----------
async function init() {
  await q(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));

  const { rows: [{ count }] } = await q('SELECT COUNT(*)::int AS count FROM categories');
  if (count === 0) {
    await q(`INSERT INTO categories(name,age_from,age_to,schedule) VALUES
      ('Semillero',5,6,'Mar y jue · 3:30 p. m.'),
      ('Iniciación',7,9,'Mar y jue · 4:30 p. m.'),
      ('Pre-formación',10,11,'Lun, mié y vie · 3:30 p. m.'),
      ('Formación',12,13,'Lun, mié y vie · 4:30 p. m.'),
      ('Juvenil',14,17,'Lun, mié y vie · 5:30 p. m.')`);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (adminEmail && adminPassword) {
    const { rows } = await q('SELECT id FROM users WHERE LOWER(email)=$1', [adminEmail]);
    if (!rows.length) {
      await q("INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,'admin',$3)",
        [process.env.ADMIN_NAME || 'Juan Sebastián Trujillo Espinal', adminEmail, await bcrypt.hash(adminPassword, 10)]);
      console.log(`Administrador creado: ${adminEmail}`);
    }
  }

  try { await setupPush(); } catch (e) { console.warn('Notificaciones push desactivadas:', e.message); }

  app.listen(PORT, () => console.log(`ADF App escuchando en el puerto ${PORT}${APP_URL ? ` · ${APP_URL}` : ''}`));
}

init().catch((e) => { console.error('No se pudo iniciar:', e); process.exit(1); });
