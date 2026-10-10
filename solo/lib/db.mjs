import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'solo.db');

import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

const DEFAULT_LANDING_CONTENT = {
  hero_title: 'להבין מה את עושה.\nולא רק לסמן וי.',
  hero_subtitle: 'קורס דיגיטלי קצר וממוקד לנשים שמתאמנות ומתמידות — אבל לא רואות את התוצאה שמגיעה להן.',
  course_name: 'הקורס של רותם',
  about_text:
    'רותם כהנים היא מאמנת כושר אישית שעובדת עם נשים באימונים אישיים וזוגיים. הקורס הזה נולד מהשאלה שהיא שומעת הכי הרבה: "אני מתאמנת, אז למה אני לא רואה תוצאה?" — התשובה כמעט תמיד נמצאת לא בכמות האימונים, אלא בהבנה של מה עושים בהם.',
  whatsapp_number: '972526052935',
  hero_image_url: '/assets/rotem.jpg',
  personal_image_url: '/assets/rotem.jpg',
  tagline: 'להבין מה את עושה. ולא רק לסמן וי.',
  instagram_url: 'https://www.instagram.com/rotem_cohanim/',
};

const insertContent = db.prepare(
  'INSERT INTO landing_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [key, value] of Object.entries(DEFAULT_LANDING_CONTENT)) {
  insertContent.run(key, value);
}

const existingExercises = db.prepare('SELECT COUNT(*) AS n FROM exercises').get();
if (existingExercises.n === 0) {
  const seedExercise = db.prepare(
    'INSERT INTO exercises (name, muscle_group, notes, sort_order) VALUES (?, ?, ?, ?)'
  );
  const seed = [
    ['סקוואט גובלט', 'רגליים', '', 1],
    ['לאנג׳ הליכה', 'רגליים', '', 2],
    ['הרחקת ירך בכבל', 'רגליים', '', 3],
    ['היפ תראסט', 'ישבן', '', 1],
    ['גשר ישבן חד־רגלי', 'ישבן', '', 2],
    ['חתירה באמצעות רצועה', 'גב', '', 1],
    ['פולאובר', 'גב', '', 2],
    ['לחיצת חזה', 'חזה', '', 1],
    ['פרפר', 'חזה', '', 2],
    ['לחיצת כתפיים', 'כתפיים', '', 1],
    ['הרחקת כתפיים צידית', 'כתפיים', '', 2],
    ['כפיפת מרפק', 'ידיים', '', 1],
    ['פשיטת מרפק בכבל', 'ידיים', '', 2],
    ['פלאנק', 'ליבה', '', 1],
    ['דד באג', 'ליבה', '', 2],
  ];
  for (const row of seed) seedExercise.run(...row);
}

const existingAdmin = db.prepare('SELECT id FROM admin_user WHERE id = 1').get();
if (!existingAdmin) {
  db.prepare('INSERT INTO admin_user (id, username, password_hash, phone) VALUES (1, ?, ?, ?)').run(
    'admin',
    '',
    ''
  );
}
