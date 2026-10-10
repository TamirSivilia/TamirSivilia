import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { db } from './db.mjs';

const SESSION_TTL_MS = {
  trainee: 1000 * 60 * 60 * 24 * 30, // 30 days
  admin: 1000 * 60 * 60 * 8, // 8 hours
};

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  return digits;
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function issueOtp(phone, purpose, code) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO otp_codes (phone, purpose, code_hash, expires_at, attempts)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(phone, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`
  ).run(phone, purpose, hashCode(code), expiresAt);
}

export function verifyOtp(phone, purpose, code) {
  const row = db.prepare('SELECT * FROM otp_codes WHERE phone = ? AND purpose = ?').get(phone, purpose);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.attempts >= 5) return { ok: false, reason: 'too_many_attempts' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (row.code_hash !== hashCode(code)) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ? AND purpose = ?').run(
      phone,
      purpose
    );
    return { ok: false, reason: 'mismatch' };
  }
  db.prepare('DELETE FROM otp_codes WHERE phone = ? AND purpose = ?').run(phone, purpose);
  return { ok: true };
}

export function createSession(role, subjectId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS[role]).toISOString();
  db.prepare('INSERT INTO sessions (token, role, subject_id, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    role,
    subjectId ?? null,
    expiresAt
  );
  return { token, expiresAt };
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
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}
