import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhone, isValidYoutubeUrl, youtubeEmbedUrl } from './util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_DB_DIR = mkdtempSync(path.join(tmpdir(), 'solo-test-'));
process.env.SOLO_DB_PATH = path.join(TEST_DB_DIR, 'test.db');
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.NODE_ENV = 'development';
process.env.PORT = '4391';
process.env.HOST = '127.0.0.1';

const BASE = `http://127.0.0.1:${process.env.PORT}`;
let server;

before(async () => {
  ({ default: server } = await import('./server.mjs'));
  await new Promise((resolve) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
  });
});

after(() => {
  server.close();
  rmSync(TEST_DB_DIR, { recursive: true, force: true });
});

function extractCookie(res, name) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of cookies) {
    if (c.startsWith(name + '=')) return c.split(';')[0];
  }
  return null;
}

async function adminLogin() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-admin-password' }),
  });
  assert.equal(res.status, 200);
  const cookie = extractCookie(res, 'solo_admin');
  assert.ok(cookie, 'admin login should set a session cookie');
  return cookie;
}

// ---------- Unit tests: util.mjs ----------

test('normalizePhone accepts common Israeli formats', () => {
  assert.equal(normalizePhone('0501234567'), '972501234567');
  assert.equal(normalizePhone('+972501234567'), '972501234567');
  assert.equal(normalizePhone('972-50-123-4567'), '972501234567');
  assert.equal(normalizePhone('00972501234567'), '972501234567');
});

test('normalizePhone rejects garbage input', () => {
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('123'), null);
});

test('isValidYoutubeUrl allows empty (unfilmed placeholder) and real links, rejects junk', () => {
  assert.equal(isValidYoutubeUrl(''), true);
  assert.equal(isValidYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.equal(isValidYoutubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.equal(isValidYoutubeUrl('https://example.com/video'), false);
  assert.equal(isValidYoutubeUrl('not a url'), false);
});

test('youtubeEmbedUrl extracts the video id from watch and short links', () => {
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbedUrl(''), null);
});

// ---------- Static pages ----------

test('GET / serves the Hebrew RTL landing page', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /dir="rtl"/);
  assert.match(html, /SOLO/);
});

test('GET /admin and /learn serve their app shells', async () => {
  const admin = await fetch(`${BASE}/admin`);
  assert.equal(admin.status, 200);
  const learn = await fetch(`${BASE}/learn`);
  assert.equal(learn.status, 200);
});

test('unknown paths 404', async () => {
  const res = await fetch(`${BASE}/does-not-exist`);
  assert.equal(res.status, 404);
});

// ---------- Public content ----------

test('GET /api/content never leaks draft copy, even redacted', async () => {
  const res = await fetch(`${BASE}/api/content`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.about_text.draft, true);
  assert.equal(body.about_text.value, '', 'draft field value must be withheld from the public endpoint');
  assert.equal(body.brand_label.value, 'SOLO');
});

// ---------- Admin auth ----------

test('admin API routes reject requests with no session', async () => {
  for (const p of ['/api/admin/learners', '/api/admin/videos', '/api/admin/content', '/api/admin/me']) {
    const res = await fetch(`${BASE}${p}`);
    assert.equal(res.status, 401, `${p} should require admin auth`);
  }
});

test('admin login rejects wrong password and accepts the right one', async () => {
  const bad = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' }),
  });
  assert.equal(bad.status, 401);

  const cookie = await adminLogin();
  const me = await fetch(`${BASE}/api/admin/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
});

test('learner API routes reject requests with no session', async () => {
  for (const p of ['/api/learner/me', '/api/learner/lessons', '/api/learner/exercises', '/api/learner/log']) {
    const res = await fetch(`${BASE}${p}`);
    assert.equal(res.status, 401, `${p} should require learner auth`);
  }
});

// ---------- Learners CRUD + duplicate blocking ----------

let adminCookie;
let learnerId;
const learnerPhone = '0521112222';

test('admin can add a learner, and duplicate phone numbers are blocked', async () => {
  adminCookie = await adminLogin();

  const create = await fetch(`${BASE}/api/admin/learners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'בדיקה בדיקה', phone: learnerPhone }),
  });
  assert.equal(create.status, 201);
  const created = await create.json();
  learnerId = created.id;

  const dup = await fetch(`${BASE}/api/admin/learners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ name: 'שם אחר', phone: learnerPhone }),
  });
  assert.equal(dup.status, 409);

  const list = await fetch(`${BASE}/api/admin/learners`, { headers: { Cookie: adminCookie } });
  const learners = await list.json();
  assert.ok(learners.some((l) => l.id === learnerId), 'newly created learner should persist and be listed');
});

// ---------- Video drafts hidden from learners ----------

let learnerCookie;

test('learner OTP login: request code, wrong code fails, correct code succeeds', async () => {
  const req1 = await fetch(`${BASE}/api/learner/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: learnerPhone }),
  });
  assert.equal(req1.status, 200);
  const { dev_code } = await req1.json();
  assert.match(dev_code, /^\d{6}$/, 'dev_code should be echoed in development mode');

  const wrong = await fetch(`${BASE}/api/learner/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: learnerPhone, code: '000000' }),
  });
  assert.equal(wrong.status, 401);

  const right = await fetch(`${BASE}/api/learner/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: learnerPhone, code: dev_code }),
  });
  assert.equal(right.status, 200);
  learnerCookie = extractCookie(right, 'solo_learner');
  assert.ok(learnerCookie);
});

test('request-code does not reveal whether a phone number is registered', async () => {
  const res = await fetch(`${BASE}/api/learner/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0539998888' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.dev_code, undefined, 'no code should be issued for a phone that has no active learner');
});

test('draft lessons are hidden from the learner API until published', async () => {
  const addDraft = await fetch(`${BASE}/api/admin/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ kind: 'lesson', title: 'שיעור טיוטה', youtube_url: '' }),
  });
  assert.equal(addDraft.status, 201);
  const { id: videoId } = await addDraft.json();

  const beforePublish = await fetch(`${BASE}/api/learner/lessons`, { headers: { Cookie: learnerCookie } });
  const lessonsBefore = await beforePublish.json();
  assert.ok(!lessonsBefore.some((l) => l.id === videoId), 'draft lesson must not be visible to learners');

  const publish = await fetch(`${BASE}/api/admin/videos/${videoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  assert.equal(publish.status, 200);

  const afterPublish = await fetch(`${BASE}/api/learner/lessons`, { headers: { Cookie: learnerCookie } });
  const lessonsAfter = await afterPublish.json();
  assert.ok(lessonsAfter.some((l) => l.id === videoId), 'published lesson should now be visible');
});

test('YouTube link validation rejects non-YouTube URLs but allows a blank placeholder', async () => {
  const badUrl = await fetch(`${BASE}/api/admin/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ kind: 'exercise', title: 'תרגיל', youtube_url: 'https://vimeo.com/123' }),
  });
  assert.equal(badUrl.status, 400);

  const blank = await fetch(`${BASE}/api/admin/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ kind: 'exercise', title: 'תרגיל ללא סרטון עדיין', youtube_url: '' }),
  });
  assert.equal(blank.status, 201);
});

// ---------- Access revocation ----------

test('pausing a learner immediately kills their active session', async () => {
  const meBefore = await fetch(`${BASE}/api/learner/me`, { headers: { Cookie: learnerCookie } });
  assert.equal(meBefore.status, 200);

  const pause = await fetch(`${BASE}/api/admin/learners/${learnerId}/pause`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
  });
  assert.equal(pause.status, 200);

  const meAfter = await fetch(`${BASE}/api/learner/me`, { headers: { Cookie: learnerCookie } });
  assert.equal(meAfter.status, 401, 'session should be destroyed the moment access is paused');
});

// ---------- Content editing ----------

test('admin content edits are reflected on the public endpoint once published', async () => {
  const put = await fetch(`${BASE}/api/admin/content/hero_sub`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ value: 'טקסט עדכני לבדיקה', draft: false }),
  });
  assert.equal(put.status, 200);

  const publicContent = await fetch(`${BASE}/api/content`);
  const body = await publicContent.json();
  assert.equal(body.hero_sub.value, 'טקסט עדכני לבדיקה');
});

// ---------- Production mode: no dev OTP echo ----------

test('in production, the learner OTP endpoint never echoes the code', async () => {
  const prodDbDir = mkdtempSync(path.join(tmpdir(), 'solo-test-prod-'));
  const child = spawn(process.execPath, [path.join(__dirname, 'server.mjs')], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ADMIN_PASSWORD: 'prod-admin-password',
      SOLO_DB_PATH: path.join(prodDbDir, 'prod.db'),
      PORT: '4392',
      HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server did not start in time')), 8000);
      child.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('SOLO running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.on('exit', (code) => reject(new Error(`server exited early with code ${code}`)));
    });

    const prodBase = 'http://127.0.0.1:4392';
    const loginRes = await fetch(`${prodBase}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'prod-admin-password' }),
    });
    const prodAdminCookie = extractCookie(loginRes, 'solo_admin');

    const phone = '0537654321';
    await fetch(`${prodBase}/api/admin/learners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: prodAdminCookie },
      body: JSON.stringify({ name: 'ייצור', phone }),
    });

    const codeRes = await fetch(`${prodBase}/api/learner/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const codeBody = await codeRes.json();
    assert.equal(codeBody.dev_code, undefined, 'production must never echo the OTP over the API');
  } finally {
    child.kill();
    rmSync(prodDbDir, { recursive: true, force: true });
  }
});
