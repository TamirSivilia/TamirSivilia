import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './lib/db.mjs';
import {
  hashPassword,
  verifyPassword,
  normalizePhone,
  issueOtp,
  verifyOtp,
  createSession,
  getSession,
  destroySession,
  parseCookies,
} from './lib/auth.mjs';
import { generateCode, sendCode, checkCode, smsProviderStatus } from './lib/sms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4317);
const DEV_PREVIEW = process.env.DEV_PREVIEW === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (DEV_PREVIEW && NODE_ENV === 'production') {
  throw new Error('DEV_PREVIEW must never be enabled with NODE_ENV=production. Refusing to start.');
}

const YOUTUBE_RE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)(&\S*)?$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function sendCsv(res, filename, content) {
  const encoded = encodeURIComponent(filename);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="progress.csv"; filename*=UTF-8''${encoded}`,
  });
  res.end('﻿' + content);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function setSessionCookie(res, name, token, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Max-Age=0`);
}

function getAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const trainee = getSession(cookies.solo_trainee_session);
  const admin = getSession(cookies.solo_admin_session);
  return {
    trainee: trainee && trainee.role === 'trainee' ? trainee : null,
    admin: admin && admin.role === 'admin' ? admin : null,
  };
}

function requireTrainee(req, res) {
  const { trainee } = getAuth(req);
  if (!trainee) {
    send(res, 401, { error: 'not_authenticated' });
    return null;
  }
  return trainee;
}

function requireAdmin(req, res) {
  const { admin } = getAuth(req);
  if (!admin) {
    send(res, 401, { error: 'not_authenticated' });
    return null;
  }
  return admin;
}

// ---------- static files ----------

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (filePath === '/learn') filePath = '/learn.html';
  if (filePath === '/admin') filePath = '/admin.html';
  const full = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!full.startsWith(PUBLIC_DIR)) {
    send(res, 403, { error: 'forbidden' });
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('לא נמצא');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- route handlers ----------

const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const parts = r.pattern.split('/').filter(Boolean);
    const actual = pathname.split('/').filter(Boolean);
    if (parts.length !== actual.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        params[parts[i].slice(1)] = actual[i];
      } else if (parts[i] !== actual[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

// ----- public landing content -----

route('GET', '/api/landing', async (req, res) => {
  const rows = db.prepare('SELECT key, value FROM landing_content').all();
  const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  send(res, 200, { content });
});

// ----- trainee auth -----

route('POST', '/api/trainee/auth/request-code', async (req, res) => {
  const body = await readJsonBody(req);
  if (!body || !body.phone) return send(res, 400, { error: 'phone_required' });
  const phone = normalizePhone(body.phone);
  const trainee = db.prepare('SELECT * FROM trainees WHERE phone = ?').get(phone);
  if (!trainee) return send(res, 404, { error: 'trainee_not_found' });
  if (trainee.status !== 'active') return send(res, 403, { error: 'access_paused' });

  const code = generateCode();
  try {
    const result = await sendCode(phone, code);
    issueOtp(phone, 'trainee_login', code);
    const payload = { ok: true, provider: result.provider };
    if (result.provider === 'dev-preview') payload.devCode = code;
    send(res, 200, payload);
  } catch (err) {
    send(res, 500, { error: 'sms_unavailable', message: err.message });
  }
});

route('POST', '/api/trainee/auth/verify', async (req, res) => {
  const body = await readJsonBody(req);
  if (!body || !body.phone || !body.code) return send(res, 400, { error: 'phone_and_code_required' });
  const phone = normalizePhone(body.phone);
  const trainee = db.prepare('SELECT * FROM trainees WHERE phone = ?').get(phone);
  if (!trainee || trainee.status !== 'active') return send(res, 403, { error: 'access_paused' });

  const twilioResult = await checkCode(phone, body.code);
  const result = twilioResult ?? verifyOtp(phone, 'trainee_login', body.code);
  if (!result.ok) return send(res, 401, { error: 'invalid_code' });

  const session = createSession('trainee', trainee.id);
  setSessionCookie(res, 'solo_trainee_session', session.token, 60 * 60 * 24 * 30);
  send(res, 200, { ok: true, trainee: { id: trainee.id, name: trainee.name } });
});

route('POST', '/api/trainee/auth/logout', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  destroySession(cookies.solo_trainee_session);
  clearSessionCookie(res, 'solo_trainee_session');
  send(res, 200, { ok: true });
});

route('GET', '/api/trainee/me', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const trainee = db.prepare('SELECT id, name, phone FROM trainees WHERE id = ?').get(session.subject_id);
  if (!trainee) return send(res, 401, { error: 'not_authenticated' });
  send(res, 200, { trainee });
});

// ----- trainee area -----

route('GET', '/api/trainee/lessons', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const lessons = db
    .prepare(
      `SELECT l.id, l.title, l.description, l.youtube_url, l.muscle_group, l.sort_order,
              CASE WHEN c.trainee_id IS NULL THEN 0 ELSE 1 END AS completed
       FROM lessons l
       LEFT JOIN completions c ON c.lesson_id = l.id AND c.trainee_id = ?
       WHERE l.status = 'published'
       ORDER BY l.sort_order ASC, l.id ASC`
    )
    .all(session.subject_id);
  send(res, 200, { lessons });
});

route('POST', '/api/trainee/lessons/:id/complete', async (req, res, params) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const lesson = db
    .prepare("SELECT id FROM lessons WHERE id = ? AND status = 'published'")
    .get(params.id);
  if (!lesson) return send(res, 404, { error: 'lesson_not_found' });
  db.prepare(
    'INSERT INTO completions (trainee_id, lesson_id) VALUES (?, ?) ON CONFLICT(trainee_id, lesson_id) DO NOTHING'
  ).run(session.subject_id, lesson.id);
  send(res, 200, { ok: true });
});

route('DELETE', '/api/trainee/lessons/:id/complete', async (req, res, params) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  db.prepare('DELETE FROM completions WHERE trainee_id = ? AND lesson_id = ?').run(
    session.subject_id,
    params.id
  );
  send(res, 200, { ok: true });
});

route('GET', '/api/trainee/exercises', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const exercises = db
    .prepare('SELECT id, name, muscle_group, notes FROM exercises ORDER BY muscle_group ASC, sort_order ASC')
    .all();
  send(res, 200, { exercises });
});

route('GET', '/api/trainee/progress', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const entries = db
    .prepare('SELECT * FROM progress_entries WHERE trainee_id = ? ORDER BY entry_date DESC, id DESC')
    .all(session.subject_id);
  send(res, 200, { entries });
});

route('POST', '/api/trainee/progress', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const body = await readJsonBody(req);
  if (!body || !body.entry_date || !body.exercise) {
    return send(res, 400, { error: 'entry_date_and_exercise_required' });
  }
  const info = db
    .prepare(
      `INSERT INTO progress_entries (trainee_id, entry_date, exercise, sets, reps, weight, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.subject_id,
      body.entry_date,
      body.exercise,
      body.sets ?? null,
      body.reps ?? null,
      body.weight ?? null,
      body.notes ?? ''
    );
  send(res, 201, { id: info.lastInsertRowid });
});

route('DELETE', '/api/trainee/progress/:id', async (req, res, params) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  db.prepare('DELETE FROM progress_entries WHERE id = ? AND trainee_id = ?').run(
    params.id,
    session.subject_id
  );
  send(res, 200, { ok: true });
});

route('GET', '/api/trainee/progress/export.csv', async (req, res) => {
  const session = requireTrainee(req, res);
  if (!session) return;
  const entries = db
    .prepare('SELECT entry_date, exercise, sets, reps, weight, notes FROM progress_entries WHERE trainee_id = ? ORDER BY entry_date ASC, id ASC')
    .all(session.subject_id);
  const header = 'תאריך,תרגיל,סטים,חזרות,משקל,הערות';
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [e.entry_date, e.exercise, e.sets, e.reps, e.weight, e.notes].map(escape).join(',')
  );
  sendCsv(res, 'טבלת-מעקב.csv', [header, ...rows].join('\r\n'));
});

// ----- admin auth -----

route('POST', '/api/admin/auth/login', async (req, res) => {
  const body = await readJsonBody(req);
  if (!body || !body.username || !body.password) {
    return send(res, 400, { error: 'username_and_password_required' });
  }
  const admin = db.prepare('SELECT * FROM admin_user WHERE id = 1').get();
  if (!admin || !admin.password_hash) {
    return send(res, 403, {
      error: 'admin_not_configured',
      message: 'הרצת configure-admin.mjs טרם בוצעה. הגדירי סיסמת מנהלת בשרת.',
    });
  }
  if (admin.username !== body.username || !verifyPassword(body.password, admin.password_hash)) {
    return send(res, 401, { error: 'invalid_credentials' });
  }

  const has2fa = Boolean(admin.phone) && smsProviderStatus() !== 'unconfigured';
  if (!has2fa) {
    if (smsProviderStatus() === 'unconfigured') {
      return send(res, 403, {
        error: 'sms_unavailable',
        message: 'אימות דו־שלבי דורש חיבור SMS. הגדירי ספק SMS או DEV_PREVIEW לבדיקה מקומית.',
      });
    }
    const session = createSession('admin', 1);
    setSessionCookie(res, 'solo_admin_session', session.token, 60 * 60 * 8);
    return send(res, 200, { ok: true, twoFactor: false });
  }

  const code = generateCode();
  try {
    const result = await sendCode(admin.phone, code);
    issueOtp(admin.phone, 'admin_2fa', code);
    const payload = { ok: true, twoFactor: true, provider: result.provider };
    if (result.provider === 'dev-preview') payload.devCode = code;
    send(res, 200, payload);
  } catch (err) {
    send(res, 500, { error: 'sms_unavailable', message: err.message });
  }
});

route('POST', '/api/admin/auth/verify-2fa', async (req, res) => {
  const body = await readJsonBody(req);
  if (!body || !body.code) return send(res, 400, { error: 'code_required' });
  const admin = db.prepare('SELECT * FROM admin_user WHERE id = 1').get();
  if (!admin || !admin.phone) return send(res, 400, { error: 'admin_phone_not_set' });

  const twilioResult = await checkCode(admin.phone, body.code);
  const result = twilioResult ?? verifyOtp(admin.phone, 'admin_2fa', body.code);
  if (!result.ok) return send(res, 401, { error: 'invalid_code' });

  const session = createSession('admin', 1);
  setSessionCookie(res, 'solo_admin_session', session.token, 60 * 60 * 8);
  send(res, 200, { ok: true });
});

route('POST', '/api/admin/auth/logout', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  destroySession(cookies.solo_admin_session);
  clearSessionCookie(res, 'solo_admin_session');
  send(res, 200, { ok: true });
});

route('GET', '/api/admin/me', async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  send(res, 200, { ok: true, smsProvider: smsProviderStatus(), devPreview: DEV_PREVIEW });
});

// ----- admin: trainees -----

route('GET', '/api/admin/trainees', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const trainees = db.prepare('SELECT id, name, phone, status, created_at FROM trainees ORDER BY created_at DESC').all();
  send(res, 200, { trainees });
});

route('POST', '/api/admin/trainees', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if (!body || !body.name || !body.phone) return send(res, 400, { error: 'name_and_phone_required' });
  const phone = normalizePhone(body.phone);
  const existing = db.prepare('SELECT id FROM trainees WHERE phone = ?').get(phone);
  if (existing) return send(res, 409, { error: 'phone_already_exists' });
  const info = db.prepare('INSERT INTO trainees (name, phone) VALUES (?, ?)').run(body.name.trim(), phone);
  send(res, 201, { id: info.lastInsertRowid });
});

route('PATCH', '/api/admin/trainees/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if (!body) return send(res, 400, { error: 'invalid_body' });
  const trainee = db.prepare('SELECT * FROM trainees WHERE id = ?').get(params.id);
  if (!trainee) return send(res, 404, { error: 'trainee_not_found' });

  if (body.status && !['active', 'paused'].includes(body.status)) {
    return send(res, 400, { error: 'invalid_status' });
  }
  const name = body.name !== undefined ? body.name.trim() : trainee.name;
  const status = body.status !== undefined ? body.status : trainee.status;
  db.prepare('UPDATE trainees SET name = ?, status = ? WHERE id = ?').run(name, status, trainee.id);

  if (status === 'paused' && trainee.status !== 'paused') {
    db.prepare("DELETE FROM sessions WHERE role = 'trainee' AND subject_id = ?").run(trainee.id);
  }
  send(res, 200, { ok: true });
});

// ----- admin: lessons -----

route('GET', '/api/admin/lessons', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const lessons = db.prepare('SELECT * FROM lessons ORDER BY sort_order ASC, id ASC').all();
  send(res, 200, { lessons });
});

function validateLessonInput(body) {
  if (!body.title || !body.title.trim()) return 'title_required';
  if (body.youtube_url && !YOUTUBE_RE.test(body.youtube_url)) return 'invalid_youtube_url';
  if (body.status && !['draft', 'published'].includes(body.status)) return 'invalid_status';
  return null;
}

route('POST', '/api/admin/lessons', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if (!body) return send(res, 400, { error: 'invalid_body' });
  const err = validateLessonInput(body);
  if (err) return send(res, 400, { error: err });
  const info = db
    .prepare(
      `INSERT INTO lessons (title, description, youtube_url, muscle_group, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.title.trim(),
      body.description ?? '',
      body.youtube_url ?? '',
      body.muscle_group ?? '',
      body.sort_order ?? 0,
      body.status ?? 'draft'
    );
  send(res, 201, { id: info.lastInsertRowid });
});

route('PATCH', '/api/admin/lessons/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if (!body) return send(res, 400, { error: 'invalid_body' });
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(params.id);
  if (!lesson) return send(res, 404, { error: 'lesson_not_found' });
  const merged = { ...lesson, ...body };
  const err = validateLessonInput(merged);
  if (err) return send(res, 400, { error: err });
  db.prepare(
    `UPDATE lessons SET title=?, description=?, youtube_url=?, muscle_group=?, sort_order=?, status=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    merged.title.trim(),
    merged.description ?? '',
    merged.youtube_url ?? '',
    merged.muscle_group ?? '',
    merged.sort_order ?? 0,
    merged.status ?? 'draft',
    lesson.id
  );
  send(res, 200, { ok: true });
});

route('DELETE', '/api/admin/lessons/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  db.prepare('DELETE FROM lessons WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

// ----- admin: landing content -----

route('GET', '/api/admin/landing', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT key, value FROM landing_content').all();
  send(res, 200, { content: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

route('PATCH', '/api/admin/landing', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'invalid_body' });
  const stmt = db.prepare(
    'INSERT INTO landing_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(body)) {
    stmt.run(key, String(value));
  }
  send(res, 200, { ok: true });
});

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = matchRoute(req.method, url.pathname);
  if (match) {
    try {
      await match.handler(req, res, match.params);
    } catch (err) {
      console.error(err);
      send(res, 500, { error: 'internal_error' });
    }
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res, url.pathname);
    return;
  }
  send(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`SOLO server running on http://127.0.0.1:${PORT}`);
  console.log(`  SMS provider: ${smsProviderStatus()}${DEV_PREVIEW ? ' (DEV_PREVIEW on)' : ''}`);
});
