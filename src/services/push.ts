import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { authService } from './auth';

let isRegistered = false;
let pushToken: string | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  async initializePush(navigate: (path: string) => void) {
    // Web platform: use the browser Push API (service worker). Native devices
    // continue to use Capacitor Push Notifications below.
    if (!Capacitor.isNativePlatform()) {
      await pushService.initializeWebPush(navigate);
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

  async initializeWebPush(navigate: (path: string) => void) {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      console.log('Push: Web Push API not supported in this browser. Skipping.');
      return;
    }

    const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || '';
    if (!vapidKey) {
      console.log('Push: VITE_VAPID_PUBLIC_KEY not configured. Web push disabled.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Route notification clicks back to the app so navigation uses the stored role.
      navigator.serviceWorker.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg && msg.type === 'NOTIFICATION_CLICK') {
          pushService.handleNavigation(msg.data, navigate);
        }
      });

      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          console.warn('Push: Web notification permission not granted.');
          return;
        }
      }

      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      pushToken = sub.endpoint.split('/').filter(Boolean).pop() || sub.endpoint;
      await authService.savePushToken(pushToken, 'web');
      isRegistered = true;
      console.log('Push: Web push registered successfully.');
    } catch (err) {
      console.error('Push: Failed to initialize web push:', err);
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
    if (Capacitor.isNativePlatform()) {
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
      return;
    }

    // Web: unsubscribe from the push subscription and remove the stored token.
    try {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) await sub.unsubscribe();
      }
      if (isRegistered && pushToken) {
        await authService.removePushToken(pushToken);
      }
      isRegistered = false;
      pushToken = null;
      console.log('Push: Cleaned up web push.');
    } catch (err) {
      console.error('Push: Error during web cleanup:', err);
    }
  }
};
