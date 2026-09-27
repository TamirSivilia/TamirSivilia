export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  if (!digits.startsWith('972')) digits = '972' + digits;
  if (!/^972\d{8,9}$/.test(digits)) return null;
  return digits;
}

export function formatPhoneDisplay(normalized) {
  const local = '0' + normalized.slice(3);
  return local;
}

const YOUTUBE_RE = /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)[\w-]{6,}|youtu\.be\/[\w-]{6,})/;

export function isValidYoutubeUrl(url) {
  if (!url) return true; // empty is allowed (placeholder lesson, not yet filmed)
  return YOUTUBE_RE.test(url);
}

export function youtubeEmbedUrl(url) {
  if (!url) return null;
  let id = null;
  const watch = url.match(/[?&]v=([\w-]{6,})/);
  const short = url.match(/youtu\.be\/([\w-]{6,})/);
  const embed = url.match(/embed\/([\w-]{6,})/);
  id = (watch && watch[1]) || (short && short[1]) || (embed && embed[1]);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(','));
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}
