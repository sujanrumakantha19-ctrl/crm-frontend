import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(dateVal?: string | Date | null): string {
  if (!dateVal) return '—';
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return String(dateVal);

    const day = d.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toLowerCase();

    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return String(dateVal);
  }
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function parseDateComponents(dateVal?: string | Date | null): { year: number; month: number; day: number } | null {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
      };
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(d);
    const pMap: Record<string, number> = {};
    for (const p of parts) {
      if (p.type === 'year' || p.type === 'month' || p.type === 'day') {
        pMap[p.type] = parseInt(p.value, 10);
      }
    }
    if (pMap.year && pMap.month && pMap.day) {
      return { year: pMap.year, month: pMap.month, day: pMap.day };
    }
  } catch {
    // fallback to UTC getters
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  return null;
}

export function formatDate(dateVal?: string | Date | null): string {
  if (!dateVal) return '—';
  const parsed = parseDateComponents(dateVal);
  if (!parsed) return String(dateVal);
  const monthName = MONTH_NAMES_SHORT[parsed.month - 1] || String(parsed.month);
  const dayStr = String(parsed.day).padStart(2, '0');
  return `${dayStr} ${monthName} ${parsed.year}`;
}

export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMaxDobStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatSource(sourceType?: string, source?: string): string {
  if (!sourceType && !source) return '—';
  if (!source || source === sourceType || source.toLowerCase() === sourceType?.toLowerCase()) {
    return sourceType || source || '—';
  }
  if (!sourceType) return source;
  return `${sourceType} — ${source}`;
}
