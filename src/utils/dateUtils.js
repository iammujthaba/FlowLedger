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

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback to standard Date parsing
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

