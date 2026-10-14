import type { Plot, Project } from '@/types';

export function normPhone10(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

/** Stable key for one customer across multiple plot bookings */
export function customerRowKey(customerName?: string, phone?: string, displayId?: string): string {
  const phoneKey = normPhone10(phone);
  if (phoneKey) return `p:${phoneKey}`;
  const idKey = displayId ? String(displayId).trim().toUpperCase() : '';
  if (idKey) return `d:${idKey}`;
  const nameKey = customerName?.toLowerCase().trim() || '';
  return nameKey ? `n:${nameKey}` : '';
}

export function plotCustomerDedupeKey(plot: Plot): string {
  const info = (plot as { leadInfo?: { phone?: string; displayId?: string; customerName?: string } }).leadInfo;
  return customerRowKey(
    plot.bookedBy?.name || info?.customerName,
    plot.bookedBy?.phone || info?.phone,
    info?.displayId
  ) || asEntityId(plot.bookedBy?.leadId) || asEntityId(plot.id || (plot as { _id?: string })._id);
}

export function extraBookingCount(bookingCount: number): number {
  return bookingCount > 1 ? bookingCount - 1 : 0;
}

export function asEntityId(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const o = val as { id?: string; _id?: string };
    return String(o.id || o._id || '');
  }
  return String(val);
}

export function relatedExtraFromPlot(plot: Plot & {
  relatedBookingCount?: number;
  relatedBookings?: { id?: string; _id?: string; plotNumber?: string | number; projectName?: string; projectDisplayId?: string }[];
}): {
  extraCount: number;
  extraLabels: string;
} {
  const currentPlotId = asEntityId(plot.id || (plot as { _id?: string })._id);
  const currentPlotNum = String(plot.plotNumber || '').trim();
  const currentProjId = getPlotProjectId(plot);
  const related = plot.relatedBookings || [];

  // Exclude the currently displayed plot so we only list and count the OTHER bookings
  const extras = related.filter((b) => {
    const bId = asEntityId(b.id || (b as { _id?: string })._id);
    if (bId && currentPlotId) return bId !== currentPlotId;
    const bProjId = String(b.projectDisplayId || b.projectName || '');
    if (currentProjId && bProjId) {
      return !(String(b.plotNumber || '').trim() === currentPlotNum && bProjId === currentProjId);
    }
    return String(b.plotNumber || '').trim() !== currentPlotNum;
  });

  const extraCount = extras.length > 0
    ? extras.length
    : (typeof plot.relatedBookingCount === 'number' && plot.relatedBookingCount > 1
        ? plot.relatedBookingCount - 1
        : 0);

  const extraLabels = extras
    .map((b) => {
      const proj = b.projectName ? `${b.projectName}${b.projectDisplayId ? ` (${b.projectDisplayId})` : ''}` : 'Project';
      return `${proj} Plot ${b.plotNumber}`;
    })
    .join(', ');

  return { extraCount, extraLabels };
}

export function getPlotProjectId(plot: Plot): string {
  if (!plot.projectId) return '';
  if (typeof plot.projectId === 'object' && plot.projectId !== null) {
    const o = plot.projectId as { _id?: string; id?: string };
    return String(o._id || o.id || '');
  }
  return String(plot.projectId);
}

export function resolveProjectForPlot(
  plot: Plot,
  projects: Project[]
): Project | null {
  const pid = getPlotProjectId(plot);
  if (pid) {
    const found = projects.find(
      (pr) => String(pr.id || (pr as { _id?: string })._id) === pid
    );
    if (found) return found;
  }
  if (typeof plot.projectId === 'object' && plot.projectId !== null && (plot.projectId as Project).name) {
    return plot.projectId as Project;
  }
  return null;
}

export function formatBookingSelectLabel(
  projectName: string,
  projectDisplayId: string | undefined,
  plotNumber: string | number | undefined
): string {
  const plotPart = `Plot ${plotNumber ?? '—'}`;
  if (projectDisplayId) return `${projectName} (${projectDisplayId}) ${plotPart}`;
  return `${projectName} ${plotPart}`;
}

export function dedupeLeadsByCustomer<T extends { customerName?: string; phone?: string; displayId?: string; createdAt?: string }>(
  rows: T[]
): T[] {
  const seen = new Map<string, T>();
  rows.forEach((row) => {
    const key = customerRowKey(row.customerName, row.phone, row.displayId);
    if (!key) return;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
      return;
    }
    const existingTime = new Date(existing.createdAt || 0).getTime();
    const rowTime = new Date(row.createdAt || 0).getTime();
    if (rowTime >= existingTime) seen.set(key, row);
  });
  return Array.from(seen.values());
}

export function customerIdentityKeys(opts: {
  name?: string;
  phone?: string;
  displayId?: string;
  leadId?: string;
}): string[] {
  const keys: string[] = [];
  
  const phone = normPhone10(opts.phone);
  if (phone) keys.push(`p:${phone}`);
  
  const displayId = opts.displayId ? String(opts.displayId).trim().toUpperCase() : '';
  if (displayId) keys.push(`d:${displayId}`);
  
  const leadId = opts.leadId ? String(opts.leadId).trim() : '';
  if (leadId) keys.push(`l:${leadId}`);
  
  if (!phone && !displayId && !leadId) {
    const name = (opts.name || '').toLowerCase().trim();
    if (name) keys.push(`n:${name}`);
  }
  return keys;
}

export function unionMergeByKeys<T>(
  items: T[],
  keysOf: (item: T) => string[],
  merge: (kept: T, next: T) => T
): T[] {
  const n = items.length;
  if (n <= 1) return items;
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const keyOwner = new Map<string, number>();
  items.forEach((item, i) => {
    keysOf(item).forEach((k) => {
      if (!k) return;
      const owner = keyOwner.get(k);
      if (owner === undefined) {
        keyOwner.set(k, i);
        return;
      }
      const a = find(owner);
      const b = find(i);
      if (a !== b) parent[b] = a;
    });
  });
  const groups = new Map<number, T>();
  items.forEach((item, i) => {
    const root = find(i);
    const existing = groups.get(root);
    groups.set(root, existing ? merge(existing, item) : item);
  });
  return Array.from(groups.values());
}

export function bookingSlotCount(plotNumber?: string | number): number {
  if (plotNumber === undefined || plotNumber === null || plotNumber === '') return 1;
  const parts = String(plotNumber)
    .split(/[,/&]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Math.max(1, parts.length);
}

type RelatedBooking = {
  id?: string;
  plotNumber?: string | number;
  projectName?: string;
  projectDisplayId?: string;
};

export function mergePlotCustomerRows<T extends Plot & { relatedBookingCount?: number; relatedBookings?: RelatedBooking[] }>(
  a: T,
  b: T,
  pick: (kept: T, next: T) => T
): T {
  const winner = pick(a, b);
  const slim = (p: T): RelatedBooking => {
    const proj = typeof p.projectId === 'object' && p.projectId
      ? (p.projectId as { name?: string; displayId?: string })
      : null;
    return {
      id: asEntityId(p.id || (p as { _id?: string })._id),
      plotNumber: p.plotNumber,
      projectName: proj?.name || '',
      projectDisplayId: proj?.displayId || '',
    };
  };
  const seen = new Set<string>();
  const related: RelatedBooking[] = [];
  [...(a.relatedBookings || []), ...(b.relatedBookings || []), slim(a), slim(b)].forEach((r) => {
    const id = String(r.id || `${r.projectName}-${r.plotNumber}`);
    if (!id || seen.has(id)) return;
    seen.add(id);
    related.push(r);
  });
  return {
    ...winner,
    relatedBookings: related,
    relatedBookingCount: related.length,
  };
}
