import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.SOLO_DB_PATH || path.join(__dirname, 'data', 'solo.db');

import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','learner')),
  subject_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('lesson','exercise')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL,
  muscle_group TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progress (
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (learner_id, video_id)
);

CREATE TABLE IF NOT EXISTS training_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_draft INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (existing) return;
  const password = process.env.ADMIN_PASSWORD || randomBytes(6).toString('base64url');
  db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)')
    .run('רותם', hashPassword(password));
  if (!process.env.ADMIN_PASSWORD) {
    console.log('─'.repeat(60));
    console.log('No ADMIN_PASSWORD set. Generated one-time admin password:');
    console.log(`  ${password}`);
    console.log('Set ADMIN_PASSWORD in your environment to control it yourself.');
    console.log('─'.repeat(60));
  }
}

const DEFAULT_CONTENT = {
  brand_label: { value: 'SOLO', draft: false },
  hero_headline: { value: 'להבין מה את עושה.\nולא רק לסמן וי.', draft: false },
  hero_sub: { value: 'קורס אימונים דיגיטלי של רותם כהנים לנשים שמתאמנות ומתמידות — ורוצות סוף סוף להבין למה זה עובד.', draft: false },
  problem_lines: {
    value: JSON.stringify([
      'את מתאמנת. את מתמידה. ועדיין לא רואה תוצאות שמצדיקות את המאמץ.',
      'את שולטת בטכניקה, אבל לא תמיד מבינה מה חסר כדי שהאימון יעבוד בשבילך.',
      'נמאס לנחש. הגיע הזמן להבין.',
    ]),
    draft: false,
  },
  for_list: {
    value: JSON.stringify([
      'לנשים שמתאמנות ומתמידות, אבל לא רואות תוצאות.',
      'למי שכבר שולטת בטכניקה, אבל לא מבינה מה חסר.',
      'למי שנמאס לה לבזבז זמן ולנחש מה עובד.',
      'למי שרוצה להבין מה היא עושה ולא רק לסמן וי.',
    ]),
    draft: false,
  },
  not_for_list: {
    value: JSON.stringify([
      'למתחילות שעדיין לא מכירות תרגילים בסיסיים.',
      'למי שמחפשת ליווי צמוד (הליווי האישי הוא שירות נפרד).',
      'למי שרוצה רק לצפות ולא ליישם.',
    ]),
    draft: false,
  },
  course_includes: {
    value: JSON.stringify([
      'סרטונים קצרים וממוקדים.',
      'הסברים בגובה העיניים, עם דוגמאות ודגשים ליישום כבר באימון הבא.',
      'במתנה: טבלת מעקב התקדמות לשימוש באימונים.',
      'במתנה: מאגר התרגילים שרותם אוהבת, מחולק לפי קבוצות שריר, שיעזור לבנות אימון מותאם למטרה.',
    ]),
    draft: false,
  },
  how_it_works: {
    value: JSON.stringify([
      'מצטרפות בוואטסאפ ומקבלות גישה אישית.',
      'צופות בסרטונים ומיישמות כבר באימון הבא.',
      'עוקבות אחרי ההתקדמות בטבלה האישית.',
    ]),
    draft: false,
  },
  about_text: {
    value: 'רותם כהנים, מאמנת אישית. [טיוטה — טרם אושרה ע״י רותם. יש להחליף בטקסט שלה בגוף ראשון.]',
    draft: true,
  },
  coaching_intro: {
    value: 'ליווי אישי צמוד — לצד הקורס, למי שרוצה ליווי אישי צמוד יותר. [טיוטה — פרטי התוכנית טרם אושרו ע״י רותם.]',
    draft: true,
  },
  faq_items: {
    value: JSON.stringify([]),
    draft: true,
  },
  whatsapp_number: { value: '972526052935', draft: false },
  whatsapp_message_course: { value: 'היי רותם, הגעתי מהאתר של SOLO ואשמח לשמוע על הקורס', draft: false },
  whatsapp_message_coaching: { value: 'היי רותם, הגעתי מהאתר של SOLO ואשמח לשמוע על הליווי האישי', draft: false },
  instagram_url: { value: '', draft: true },
};

function seedContent() {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO content (key, value, is_draft) VALUES (?, ?, ?)'
  );
  for (const [key, { value, draft }] of Object.entries(DEFAULT_CONTENT)) {
    insert.run(key, value, draft ? 1 : 0);
  }
}

function seedSampleVideos() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM videos').get().n;
  if (count > 0) return;
  const topics = [
    'למה עוד לא רואים תוצאות',
    'איך לבנות תוכנית שמתאימה למטרה שלך',
    'עומס, נפח וקושי — מה זה אומר בפועל',
    'טכניקת ריצוד לעומת טכניקת ביצוע',
    'איך לדעת מתי להעלות משקל',
    'מנוחה והתאוששות בין אימונים',
    'תזונה בסיסית לתמיכה באימון',
    'איך לקרוא את הגוף שלך ולא רק את המשקל',
  ];
  const insert = db.prepare(
    `INSERT INTO videos (kind, title, description, youtube_url, muscle_group, order_index, status)
     VALUES ('lesson', ?, '', '', '', ?, 'draft')`
  );
  topics.forEach((title, i) => insert.run(title, i));
}

seedAdmin();
seedContent();
seedSampleVideos();

export function getContent() {
  const rows = db.prepare('SELECT key, value, is_draft FROM content').all();
  const out = {};
  for (const row of rows) {
    out[row.key] = { value: row.value, draft: !!row.is_draft };
  }
  return out;
}

export function createSession(role, subjectId, ttlHours = 24 * 30) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, role, subject_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, role, subjectId, expires);
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function destroyLearnerSessions(learnerId) {
  db.prepare("DELETE FROM sessions WHERE role = 'learner' AND subject_id = ?").run(learnerId);
}
