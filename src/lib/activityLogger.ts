import { activityLogService } from '@/services';

export async function logActivity(
  actor: { id: string; name: string; role: string; initials?: string; avatarBg?: string },
  action: string,
  actionType: 'Created' | 'Updated' | 'Deleted' | 'Status Change',
  entityType: string,
  entityId: string,
  entityName: string
) {
  try {
    await activityLogService.create({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      actorInitials: actor.initials,
      actorAvatarBg: actor.avatarBg,
      action,
      actionType,
      entityType,
      entityId,
      entityName,
      timestamp: new Date().toISOString(),
    } as any);
  } catch {
    // Activity logging should never block the main operation
  }
}
