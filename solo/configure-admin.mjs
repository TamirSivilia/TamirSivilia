// Sets the admin username/password (and optional 2FA phone) directly in the database.
// Run locally: node configure-admin.mjs
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { db } from './lib/db.mjs';
import { hashPassword, normalizePhone } from './lib/auth.mjs';

const rl = readline.createInterface({ input: stdin, output: stdout });

const username = (await rl.question('שם משתמש למנהלת [admin]: ')).trim() || 'admin';
const password = await rl.question('סיסמה חדשה (לפחות 8 תווים): ');
if (password.length < 8) {
  console.error('הסיסמה קצרה מדי.');
  rl.close();
  process.exit(1);
}
const phoneRaw = await rl.question('מספר טלפון לאימות דו־שלבי (אפשר להשאיר ריק לעת עתה): ');
const phone = phoneRaw.trim() ? normalizePhone(phoneRaw.trim()) : '';

db.prepare('UPDATE admin_user SET username = ?, password_hash = ?, phone = ? WHERE id = 1').run(
  username,
  hashPassword(password),
  phone
);

console.log('בוצע. פרטי הכניסה של המנהלת עודכנו.');
if (!phone) {
  console.log(
    'לא הוגדר מספר טלפון — כניסת מנהלת תדרוש הגדרת ספק SMS ומספר טלפון לפני שאימות דו־שלבי יהיה פעיל.'
  );
}
rl.close();
