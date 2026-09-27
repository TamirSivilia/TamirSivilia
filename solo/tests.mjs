import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}`;
const tmpDir = mkdtempSync(path.join(tmpdir(), 'solo-test-'));
const dbPath = path.join(tmpDir, 'test.db');

let serverProcess;

function waitForServer(url, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(url);
          if (res.ok) return resolve();
        } catch {
          // not up yet
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      reject(new Error('server did not start in time'));
    })();
  });
}

before(async () => {
  serverProcess = spawn('node', ['server.mjs'], {
    cwd: import.meta.dirname,
    env: { ...process.env, PORT: String(PORT), DEV_PREVIEW: 'true', NODE_ENV: 'development', DB_PATH: dbPath },
    stdio: 'ignore',
  });
  await waitForServer(`${BASE}/api/landing`);
});

after(() => {
  serverProcess?.kill();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---- helpers ----

function extractCookie(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  return raw.split(';')[0];
}

async function api(pathname, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON (e.g. CSV) — caller handles separately
  }
  return { res, data, cookie: extractCookie(res) };
}

// process.env.DB_PATH points the running server at our temp DB; configure the
// admin user through the same code path a real deployment would use.
test('configure admin credentials against the temp DB', async () => {
  // lib/auth.mjs imports lib/db.mjs, which opens its DB handle from
  // process.env.DB_PATH at import time — point it at the same file the
  // spawned server process was given before triggering that import.
  process.env.DB_PATH = dbPath;
  const { hashPassword } = await import('./lib/auth.mjs');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath);
  db.prepare('UPDATE admin_user SET username = ?, password_hash = ?, phone = ? WHERE id = 1').run(
    'admin',
    hashPassword('test-password-123'),
    ''
  );
  db.close();
});

// ---- access control ----

test('unauthenticated trainee endpoints return 401', async () => {
  const { res } = await api('/api/trainee/lessons');
  assert.equal(res.status, 401);
});

test('unauthenticated admin endpoints return 401', async () => {
  const { res } = await api('/api/admin/trainees');
  assert.equal(res.status, 401);
});

test('admin login rejects wrong password', async () => {
  const { res } = await api('/api/admin/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'wrong-password' },
  });
  assert.equal(res.status, 401);
});

let adminCookie;

test('admin login succeeds with correct credentials (no phone -> no 2FA)', async () => {
  const { res, data, cookie } = await api('/api/admin/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'test-password-123' },
  });
  assert.equal(res.status, 200);
  assert.equal(data.twoFactor, false);
  assert.ok(cookie);
  adminCookie = cookie;
});

// ---- trainee management ----

test('admin can add a trainee', async () => {
  const { res, data } = await api('/api/admin/trainees', {
    method: 'POST',
    cookie: adminCookie,
    body: { name: 'מתאמנת בדיקה', phone: '0501234567' },
  });
  assert.equal(res.status, 201);
  assert.ok(data.id);
});

test('duplicate phone number is rejected', async () => {
  const { res, data } = await api('/api/admin/trainees', {
    method: 'POST',
    cookie: adminCookie,
    body: { name: 'מישהי אחרת', phone: '0501234567' },
  });
  assert.equal(res.status, 409);
  assert.equal(data.error, 'phone_already_exists');
});

test('non-existent trainee cannot request a login code', async () => {
  const { res, data } = await api('/api/trainee/auth/request-code', {
    method: 'POST',
    body: { phone: '0500000000' },
  });
  assert.equal(res.status, 404);
  assert.equal(data.error, 'trainee_not_found');
});

let traineeCookie;

test('trainee can request and verify a login code (dev preview)', async () => {
  const req = await api('/api/trainee/auth/request-code', {
    method: 'POST',
    body: { phone: '0501234567' },
  });
  assert.equal(req.res.status, 200);
  assert.equal(req.data.provider, 'dev-preview');
  assert.match(req.data.devCode, /^\d{6}$/);

  const verify = await api('/api/trainee/auth/verify', {
    method: 'POST',
    body: { phone: '0501234567', code: req.data.devCode },
  });
  assert.equal(verify.res.status, 200);
  assert.ok(verify.cookie);
  traineeCookie = verify.cookie;
});

test('wrong code is rejected', async () => {
  const req = await api('/api/trainee/auth/request-code', {
    method: 'POST',
    body: { phone: '0501234567' },
  });
  const verify = await api('/api/trainee/auth/verify', {
    method: 'POST',
    body: { phone: '0501234567', code: '000000' },
  });
  assert.notEqual(req.data.devCode, '000000');
  assert.equal(verify.res.status, 401);
});

// ---- lessons: draft vs published, YouTube validation ----

let publishedLessonId;

test('rejects an invalid YouTube URL', async () => {
  const { res, data } = await api('/api/admin/lessons', {
    method: 'POST',
    cookie: adminCookie,
    body: { title: 'שיעור', youtube_url: 'https://example.com/not-youtube', status: 'published' },
  });
  assert.equal(res.status, 400);
  assert.equal(data.error, 'invalid_youtube_url');
});

test('admin can publish a lesson with a valid YouTube URL', async () => {
  const { res, data } = await api('/api/admin/lessons', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      title: 'איך בודקים התקדמות',
      youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
      muscle_group: 'כללי',
      status: 'published',
    },
  });
  assert.equal(res.status, 201);
  publishedLessonId = data.id;
});

test('admin can save a draft lesson', async () => {
  const { res } = await api('/api/admin/lessons', {
    method: 'POST',
    cookie: adminCookie,
    body: { title: 'טיוטה נסתרת', status: 'draft' },
  });
  assert.equal(res.status, 201);
});

test('trainee sees only the published lesson, never the draft', async () => {
  const { res, data } = await api('/api/trainee/lessons', { cookie: traineeCookie });
  assert.equal(res.status, 200);
  assert.equal(data.lessons.length, 1);
  assert.equal(data.lessons[0].id, publishedLessonId);
  assert.ok(!data.lessons.some((l) => l.title === 'טיוטה נסתרת'));
});

test('trainee can mark a lesson complete and it persists', async () => {
  const complete = await api(`/api/trainee/lessons/${publishedLessonId}/complete`, {
    method: 'POST',
    cookie: traineeCookie,
  });
  assert.equal(complete.res.status, 200);

  const { data } = await api('/api/trainee/lessons', { cookie: traineeCookie });
  assert.equal(data.lessons[0].completed, 1);
});

// ---- progress table persistence ----

test('progress entries persist and are scoped to the trainee', async () => {
  const add = await api('/api/trainee/progress', {
    method: 'POST',
    cookie: traineeCookie,
    body: { entry_date: '2026-01-05', exercise: 'סקוואט', sets: 3, reps: 10, weight: 40, notes: '' },
  });
  assert.equal(add.res.status, 201);

  const { data } = await api('/api/trainee/progress', { cookie: traineeCookie });
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].exercise, 'סקוואט');
});

test('CSV export responds with a downloadable CSV', async () => {
  const res = await fetch(`${BASE}/api/trainee/progress/export.csv`, { headers: { cookie: traineeCookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const text = await res.text();
  assert.match(text, /סקוואט/);
});

// ---- pausing revokes access ----

test('pausing a trainee revokes their active session immediately', async () => {
  const trainees = await api('/api/admin/trainees', { cookie: adminCookie });
  const trainee = trainees.data.trainees.find((t) => t.phone === '+972501234567');
  assert.ok(trainee);

  const pause = await api(`/api/admin/trainees/${trainee.id}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { status: 'paused' },
  });
  assert.equal(pause.res.status, 200);

  const { res } = await api('/api/trainee/lessons', { cookie: traineeCookie });
  assert.equal(res.status, 401);
});

test('a paused trainee cannot request a new login code', async () => {
  const { res, data } = await api('/api/trainee/auth/request-code', {
    method: 'POST',
    body: { phone: '0501234567' },
  });
  assert.equal(res.status, 403);
  assert.equal(data.error, 'access_paused');
});

// ---- landing content editable without touching code ----

test('admin can edit landing content and it appears on the public endpoint', async () => {
  const patch = await api('/api/admin/landing', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { hero_title: 'כותרת בדיקה חדשה' },
  });
  assert.equal(patch.res.status, 200);

  const { data } = await api('/api/landing');
  assert.equal(data.content.hero_title, 'כותרת בדיקה חדשה');
});
