import type { Task } from '@/types';

type AssigneeLike = Task['assignee'];

export function getTaskAssigneeId(assignee: AssigneeLike): string {
  if (!assignee) return '';
  if (typeof assignee === 'string') return assignee;
  return assignee.id || assignee._id || '';
}

export function getTaskAssigneeName(assignee: AssigneeLike): string {
  if (!assignee) return '';
  if (typeof assignee === 'string') return assignee;
  return assignee.name || '';
}

export function isTaskAssignedTo(
  assignee: AssigneeLike,
  targetId?: string | null,
  targetName?: string | null,
): boolean {
  const assigneeId = getTaskAssigneeId(assignee);
  if (targetId && assigneeId && assigneeId === targetId) {
    return true;
  }

  const assigneeName = getTaskAssigneeName(assignee).trim().toLowerCase();
  const normalizedTargetName = (targetName || '').trim().toLowerCase();
  return !!assigneeName && !!normalizedTargetName && assigneeName === normalizedTargetName;
}

export const taskAssigneeService = {
  getTaskAssigneeId,
  getTaskAssigneeName,
  isTaskAssignedTo,
};
