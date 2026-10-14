import type { Project } from '@/types';

/** Query params for project pickers on new-lead forms (Active + Upcoming only). */
export const LEAD_PROJECT_LIST_PARAMS = {
  limit: 100,
  sort: 'statusPriority',
  'status[in]': 'Active,Upcoming,active,upcoming',
} as const;

export function getProjectId(p: Project & { _id?: string }): string {
  return p.id || p._id || '';
}

export function isProjectSelectableForNewLead(
  p: Project & { _id?: string; isEnabled?: boolean },
  selectedProjectId?: string,
  options?: { requireEnabled?: boolean }
): boolean {
  const pid = getProjectId(p);
  if (selectedProjectId && pid === selectedProjectId) return true;
  if (options?.requireEnabled && p.isEnabled === false) return false;
  const st = (p.status || '').trim().toLowerCase();
  if (!st) return true;
  return st === 'active' || st === 'upcoming';
}
