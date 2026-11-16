/**
 * Robust date utilities for parsing, normalizing, and formatting dates
 * across diverse browser locales, formats, and Google Sheets outputs.
 */

export function parseAnyDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  const str = String(val).trim();
  if (
    !str ||
    str.toLowerCase() === 'invalid date' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null'
  ) {
    return null;
  }

  // 1. If it has an ISO time component (contains 'T' or a colon with time),
  // parse with Date constructor so browser converts UTC to user's local timezone (e.g. IST)
  if (str.includes('T') || (str.includes(':') && !str.match(/^(\d{1,2}):(\d{1,2})$/))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Pure date string: YYYY-MM-DD or YYYY/MM/DD (exact match, no time component)
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Pure date string: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (exact match)
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Fallback to standard Date parsing
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

export function toIsoDate(val, fallbackVal = '') {
  let d = parseAnyDate(val);
  if (!d && fallbackVal) {
    d = parseAnyDate(fallbackVal);
  }
  if (!d) {
    d = new Date();
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateHeader(dateStr) {
  const d = parseAnyDate(dateStr);
  if (!d) {
    return 'Recent';
  }

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  let prefix = '';
  if (isToday) prefix = 'Today • ';
  else if (isYesterday) prefix = 'Yesterday • ';

  return `${prefix}${d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

