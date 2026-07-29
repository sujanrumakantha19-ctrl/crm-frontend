import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { authService } from './auth';

let isRegistered = false;
let pushToken: string | null = null;

export const pushService = {
  async initializePush(navigate: (path: string) => void) {
    // Only initialize if running on native mobile device (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      console.log('Push: Not running on a native platform. Skipping initialization.');
      return;
    }

    try {
      // 1. Request permissions (especially Android 13+)
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push: Permission not granted.');
        return;
      }

      // 2. Create High-Importance Android Notification Channel for System Tray
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'default',
          name: 'General Notifications',
          description: 'CRM Push Notifications',
          importance: 5, // High importance (shows system bar pop-up & sound)
          visibility: 1, // Public
          vibration: true,
        });
      }

      // 3. Clear old listeners if any exist
      await PushNotifications.removeAllListeners();

      // 3. Register token listener
      await PushNotifications.addListener('registration', async (token: Token) => {
        pushToken = token.value;
        console.log('Push: Device registered successfully. Token:', pushToken);
        try {
          const platform = Capacitor.getPlatform(); // 'android' or 'ios'
          await authService.savePushToken(pushToken, platform);
          console.log('Push: Token saved to backend.');
          isRegistered = true;
        } catch (err) {
          console.error('Push: Failed to save token to backend:', err);
        }
      });

      // 4. Register error listener
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push: Registration error:', error);
      });

      // 5. Foreground push listener (when app is open)
      await PushNotifications.addListener(
        'pushNotificationReceived',
        async (notification: PushNotificationSchema) => {
          console.log('Push: Notification received in foreground:', notification);
          // Show in-app notification using sonner toast
          const { toast } = await import('sonner');
          toast(notification.title || '🔔 Notification', {
            description: notification.body || 'New notification',
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => {
                pushService.handleNavigation(notification, navigate);
              }
            }
          });
        }
      );

      // 6. Action listener (when user taps the notification)
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          console.log('Push: Notification tapped / action performed:', notification);
          pushService.handleNavigation(notification.notification, navigate);
        }
      );

      // 7. Trigger registration process
      await PushNotifications.register();

    } catch (err) {
      console.error('Push: Failed to initialize push notifications:', err);
    }
  },

  handleNavigation(notification: PushNotificationSchema, navigate: (path: string) => void) {
    const data = notification.data || {};
    const entityId = data.entityId;
    const entityType = data.entityType;
    const type = data.type;
    
    // Get stored role to correctly prepend path
    const storedUser = localStorage.getItem('crm_user');
    let role = 'staff';
    if (storedUser) {
      try {
        role = JSON.parse(storedUser).role || 'staff';
      } catch {}
    }
    const basePath = `/${role}`;

    if (entityId && entityType) {
      if (entityType === 'Project') {
        if (entityId.includes(':')) {
          const [projId, plotId] = entityId.split(':');
          navigate(`${basePath}/projects/${projId}?tab=plotmap&plotId=${plotId}`);
        } else {
          navigate(`${basePath}/projects/${entityId}`);
        }
      } else {
        switch (entityType) {
          case 'Lead':
            navigate(`${basePath}/leads/${entityId}`);
            break;
          case 'Task':
            navigate(`${basePath}/tasks?taskId=${entityId}`);
            break;
          case 'Plot':
            navigate(`${basePath}/projects`);
            break;
          default:
            break;
        }
      }
    } else {
      switch (type) {
        case 'task_assigned':
          navigate(`${basePath}/tasks`);
          break;
        case 'new_lead':
        case 'lead_status':
          navigate(`${basePath}/leads`);
          break;
        case 'booking':
          navigate(`${basePath}/projects`);
          break;
        case 'attendance':
          navigate(`${basePath}/attendance`);
          break;
        default:
          break;
      }
    }
  },

  async cleanupPush() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (isRegistered && pushToken) {
        await authService.removePushToken(pushToken);
        console.log('Push: Token removed from backend.');
      }
      await PushNotifications.removeAllListeners();
      isRegistered = false;
      pushToken = null;
      console.log('Push: Cleaned up push notifications.');
    } catch (err) {
      console.error('Push: Error during cleanup:', err);
    }
  }
};
