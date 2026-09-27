import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  db,
  hashPassword,
  verifyPassword,
  getContent,
  createSession,
  getSession,
  destroySession,
  destroyLearnerSessions,
} from './db.mjs';
import {
  normalizePhone,
  formatPhoneDisplay,
  isValidYoutubeUrl,
  youtubeEmbedUrl,
  parseCookies,
  toCsv,
} from './util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '127.0.0.1';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS_WINDOW_MS = 60_000;
const otpRequestLog = new Map(); // phone -> timestamp[]

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function setCookie(res, name, value, { maxAgeSeconds } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (IS_PRODUCTION) parts.push('Secure');
  if (maxAgeSeconds === 0) {
    parts.push('Max-Age=0');
  } else if (maxAgeSeconds) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  res.setHeader('Set-Cookie', [...(res.getHeader('Set-Cookie') || []), parts.join('; ')]);
}

function getSessionFromReq(req, role) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieName = role === 'admin' ? 'solo_admin' : 'solo_learner';
  const token = cookies[cookieName];
  const session = getSession(token);
  if (!session || session.role !== role) return null;
  return { token, ...session };
}

function requireAdmin(req, res) {
  const session = getSessionFromReq(req, 'admin');
  if (!session) {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  return session;
}

function requireLearner(req, res) {
  const session = getSessionFromReq(req, 'learner');
  if (!session) {
    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  const learner = db.prepare('SELECT * FROM learners WHERE id = ?').get(session.subject_id);
  if (!learner || learner.status !== 'active') {
    sendJson(res, 403, { error: 'access_paused' });
    return null;
  }
  return learner;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'forbidden');
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ---------- Public content ----------

function publicContentPayload() {
  // Draft copy (e.g. an unapproved "about" bio) is never sent to anonymous
  // visitors, even redacted client-side — the value itself is withheld here.
  const content = getContent();
  const out = {};
  for (const [key, { value, draft }] of Object.entries(content)) {
    out[key] = { value: draft ? '' : value, draft };
  }
  return out;
}

function adminContentPayload() {
  const content = getContent();
  const out = {};
  for (const [key, { value, draft }] of Object.entries(content)) {
    out[key] = { value, draft };
  }
  return out;
}

// ---------- Learner auth ----------

function rateLimitOtp(phone) {
  const now = Date.now();
  const log = (otpRequestLog.get(phone) || []).filter((t) => now - t < OTP_MAX_ATTEMPTS_WINDOW_MS);
  if (log.length >= 3) return false;
  log.push(now);
  otpRequestLog.set(phone, log);
  return true;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function handleRequestCode(req, res) {
  const body = await readJsonBody(req);
  const phone = normalizePhone(body.phone);
  if (!phone) return sendJson(res, 400, { error: 'invalid_phone' });

  const learner = db.prepare('SELECT * FROM learners WHERE phone = ?').get(phone);
  // Same response whether or not the learner exists, so the endpoint can't be used to
  // discover which phone numbers are registered.
  if (!learner || learner.status !== 'active') {
    return sendJson(res, 200, { ok: true });
  }
  if (!rateLimitOtp(phone)) {
    return sendJson(res, 429, { error: 'too_many_requests' });
  }

  const code = generateOtp();
  const codeHash = hashPassword(code);
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  db.prepare('INSERT INTO otps (learner_id, code_hash, expires_at) VALUES (?, ?, ?)')
    .run(learner.id, codeHash, expires);

  console.log(`[SOLO] OTP for ${formatPhoneDisplay(phone)} (${learner.name}): ${code} (valid ${OTP_TTL_MINUTES} min)`);

  const response = { ok: true };
  if (!IS_PRODUCTION) {
    // No SMS provider is configured yet. In non-production environments the code is
    // echoed here so the flow can be tested end to end; see README "still missing".
    response.dev_code = code;
  }
  return sendJson(res, 200, response);
}

async function handleVerifyCode(req, res) {
  const body = await readJsonBody(req);
  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').trim();
  if (!phone || !/^\d{6}$/.test(code)) return sendJson(res, 400, { error: 'invalid_input' });

  const learner = db.prepare('SELECT * FROM learners WHERE phone = ?').get(phone);
  if (!learner || learner.status !== 'active') return sendJson(res, 401, { error: 'invalid_code' });

  const otp = db
    .prepare(
      `SELECT * FROM otps WHERE learner_id = ? AND consumed_at IS NULL AND expires_at > datetime('now')
       ORDER BY id DESC LIMIT 1`
    )
    .get(learner.id);
  if (!otp || !verifyPassword(code, otp.code_hash)) {
    return sendJson(res, 401, { error: 'invalid_code' });
  }
  db.prepare("UPDATE otps SET consumed_at = datetime('now') WHERE id = ?").run(otp.id);

  const token = createSession('learner', learner.id);
  setCookie(res, 'solo_learner', token, { maxAgeSeconds: 60 * 60 * 24 * 30 });
  sendJson(res, 200, { ok: true, name: learner.name });
}

// ---------- Router ----------

const routes = [];
function route(method, pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (m) => {
        paramNames.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, regex, paramNames, handler });
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
    return { handler: r.handler, params };
  }
  return null;
}

// Public
route('GET', '/api/content', (req, res) => {
  sendJson(res, 200, publicContentPayload());
});

route('POST', '/api/learner/request-code', handleRequestCode);
route('POST', '/api/learner/verify', handleVerifyCode);

route('POST', '/api/learner/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.solo_learner) destroySession(cookies.solo_learner);
  setCookie(res, 'solo_learner', '', { maxAgeSeconds: 0 });
  sendJson(res, 200, { ok: true });
});

// Learner (session required)
route('GET', '/api/learner/me', (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  sendJson(res, 200, { id: learner.id, name: learner.name, phone: formatPhoneDisplay(learner.phone) });
});

route('GET', '/api/learner/lessons', (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const lessons = db
    .prepare(`SELECT * FROM videos WHERE kind = 'lesson' AND status = 'published' ORDER BY order_index`)
    .all();
  const done = new Set(
    db.prepare('SELECT video_id FROM progress WHERE learner_id = ?').all(learner.id).map((r) => r.video_id)
  );
  sendJson(
    res,
    200,
    lessons.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      embed_url: youtubeEmbedUrl(l.youtube_url),
      completed: done.has(l.id),
    }))
  );
});

route('POST', '/api/learner/lessons/:id/complete', (req, res, params) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const video = db
    .prepare(`SELECT * FROM videos WHERE id = ? AND status = 'published'`)
    .get(Number(params.id));
  if (!video) return sendJson(res, 404, { error: 'not_found' });
  db.prepare(
    'INSERT OR IGNORE INTO progress (learner_id, video_id) VALUES (?, ?)'
  ).run(learner.id, video.id);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/learner/exercises', (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const exercises = db
    .prepare(`SELECT * FROM videos WHERE kind = 'exercise' AND status = 'published' ORDER BY muscle_group, order_index`)
    .all();
  sendJson(
    res,
    200,
    exercises.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      muscle_group: e.muscle_group,
      embed_url: youtubeEmbedUrl(e.youtube_url),
    }))
  );
});

route('GET', '/api/learner/log', (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const rows = db
    .prepare('SELECT * FROM training_log WHERE learner_id = ? ORDER BY entry_date DESC, id DESC')
    .all(learner.id);
  sendJson(res, 200, rows);
});

route('POST', '/api/learner/log', async (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const body = await readJsonBody(req);
  const entryDate = String(body.entry_date || '').slice(0, 10);
  const notes = String(body.notes || '').slice(0, 2000).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || !notes) {
    return sendJson(res, 400, { error: 'invalid_input' });
  }
  const result = db
    .prepare('INSERT INTO training_log (learner_id, entry_date, notes) VALUES (?, ?, ?)')
    .run(learner.id, entryDate, notes);
  sendJson(res, 201, { id: Number(result.lastInsertRowid) });
});

route('DELETE', '/api/learner/log/:id', (req, res, params) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  db.prepare('DELETE FROM training_log WHERE id = ? AND learner_id = ?').run(Number(params.id), learner.id);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/learner/log/export.csv', (req, res) => {
  const learner = requireLearner(req, res);
  if (!learner) return;
  const rows = db
    .prepare('SELECT * FROM training_log WHERE learner_id = ? ORDER BY entry_date')
    .all(learner.id);
  const csv = toCsv(rows, [
    { key: 'entry_date', label: 'תאריך' },
    { key: 'notes', label: 'הערות' },
  ]);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="training-log.csv"',
  });
  res.end(csv);
});

// Admin auth
route('POST', '/api/admin/login', async (req, res) => {
  const body = await readJsonBody(req);
  const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!admin || !verifyPassword(String(body.password || ''), admin.password_hash)) {
    return sendJson(res, 401, { error: 'invalid_credentials' });
  }
  const token = createSession('admin', admin.id);
  setCookie(res, 'solo_admin', token, { maxAgeSeconds: 60 * 60 * 12 });
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/admin/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.solo_admin) destroySession(cookies.solo_admin);
  setCookie(res, 'solo_admin', '', { maxAgeSeconds: 0 });
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/admin/me', (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { ok: true });
});

// Admin: learners
route('GET', '/api/admin/learners', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT * FROM learners ORDER BY created_at DESC').all();
  sendJson(res, 200, rows.map((r) => ({ ...r, phone_display: formatPhoneDisplay(r.phone) })));
});

route('POST', '/api/admin/learners', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  if (!name || !phone) return sendJson(res, 400, { error: 'invalid_input' });
  const existing = db.prepare('SELECT id FROM learners WHERE phone = ?').get(phone);
  if (existing) return sendJson(res, 409, { error: 'phone_exists', message: 'המספר כבר קיים במערכת' });
  const result = db.prepare('INSERT INTO learners (name, phone) VALUES (?, ?)').run(name, phone);
  sendJson(res, 201, { id: Number(result.lastInsertRowid) });
});

route('POST', '/api/admin/learners/:id/pause', (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(params.id);
  db.prepare("UPDATE learners SET status = 'paused' WHERE id = ?").run(id);
  destroyLearnerSessions(id);
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/admin/learners/:id/resume', (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("UPDATE learners SET status = 'active' WHERE id = ?").run(Number(params.id));
  sendJson(res, 200, { ok: true });
});

route('DELETE', '/api/admin/learners/:id', (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(params.id);
  destroyLearnerSessions(id);
  db.prepare('DELETE FROM learners WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});

// Admin: videos
route('GET', '/api/admin/videos', (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, db.prepare('SELECT * FROM videos ORDER BY kind, order_index').all());
});

route('POST', '/api/admin/videos', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  const kind = body.kind === 'exercise' ? 'exercise' : 'lesson';
  const title = String(body.title || '').trim();
  const youtubeUrl = String(body.youtube_url || '').trim();
  if (!title) return sendJson(res, 400, { error: 'invalid_input' });
  if (!isValidYoutubeUrl(youtubeUrl)) {
    return sendJson(res, 400, { error: 'invalid_youtube_url', message: 'קישור היוטיוב לא תקין' });
  }
  const result = db
    .prepare(
      `INSERT INTO videos (kind, title, description, youtube_url, muscle_group, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`
    )
    .run(
      kind,
      title,
      String(body.description || ''),
      youtubeUrl,
      String(body.muscle_group || ''),
      Number(body.order_index || 0)
    );
  sendJson(res, 201, { id: Number(result.lastInsertRowid) });
});

route('PUT', '/api/admin/videos/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(params.id);
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
  if (!video) return sendJson(res, 404, { error: 'not_found' });
  const body = await readJsonBody(req);
  const youtubeUrl = body.youtube_url !== undefined ? String(body.youtube_url).trim() : video.youtube_url;
  if (!isValidYoutubeUrl(youtubeUrl)) {
    return sendJson(res, 400, { error: 'invalid_youtube_url', message: 'קישור היוטיוב לא תקין' });
  }
  db.prepare(
    `UPDATE videos SET title = ?, description = ?, youtube_url = ?, muscle_group = ?, order_index = ?, status = ?
     WHERE id = ?`
  ).run(
    String(body.title ?? video.title),
    String(body.description ?? video.description),
    youtubeUrl,
    String(body.muscle_group ?? video.muscle_group),
    Number(body.order_index ?? video.order_index),
    ['draft', 'published'].includes(body.status) ? body.status : video.status,
    id
  );
  sendJson(res, 200, { ok: true });
});

route('DELETE', '/api/admin/videos/:id', (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  db.prepare('DELETE FROM videos WHERE id = ?').run(Number(params.id));
  sendJson(res, 200, { ok: true });
});

// Admin: content
route('GET', '/api/admin/content', (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, adminContentPayload());
});

route('PUT', '/api/admin/content/:key', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const body = await readJsonBody(req);
  const existing = db.prepare('SELECT key FROM content WHERE key = ?').get(params.key);
  if (!existing) return sendJson(res, 404, { error: 'not_found' });
  db.prepare("UPDATE content SET value = ?, is_draft = ?, updated_at = datetime('now') WHERE key = ?").run(
    typeof body.value === 'string' ? body.value : JSON.stringify(body.value),
    body.draft ? 1 : 0,
    params.key
  );
  sendJson(res, 200, { ok: true });
});

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    const match = matchRoute(req.method, pathname);
    if (match) {
      await match.handler(req, res, match.params);
      return;
    }

    if (req.method === 'GET') {
      if (pathname === '/admin') return void serveStatic(req, res, '/admin/index.html');
      if (pathname === '/learn') return void serveStatic(req, res, '/learn/index.html');
      if (pathname === '/') return void serveStatic(req, res, '/index.html');
      if (serveStatic(req, res, pathname)) return;
    }

    sendText(res, 404, 'לא נמצא');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SOLO running at http://${HOST}:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
});

export default server;
