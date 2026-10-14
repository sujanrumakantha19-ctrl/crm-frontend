import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  // Track the history stack in memory
  const historyStackRef = useRef<string[]>([]);
  const lastExitPressRef = useRef<number>(0);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Track location changes in the internal history stack
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const stack = historyStackRef.current;

    // Initialize stack if empty
    if (stack.length === 0) {
      stack.push(currentPath);
      return;
    }

    // If current path matches the top of the stack, do nothing
    if (stack[stack.length - 1] === currentPath) {
      return;
    }

    // If navigating back to previous entry in stack, pop top
    if (stack.length > 1 && stack[stack.length - 2] === currentPath) {
      stack.pop();
      return;
    }

    // Otherwise push new path onto stack
    stack.push(currentPath);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: { remove: () => void } | null = null;

    App.addListener('backButton', () => {
      // 1. Check if mobile sidebar drawer is open
      const isDrawerOpen = document.querySelector('[data-drawer-open="true"]');
      if (isDrawerOpen) {
        window.dispatchEvent(new CustomEvent('app:close-sidebar'));
        return;
      }

      // 2. Check if any modal / dialog / alert / sheet / popover is open
      const openDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]'
      );
      if (openDialog) {
        // Dispatch Escape key to cleanly dismiss Radix/shadcn dialogs
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
          })
        );
        return;
      }

      const currentPath = locationRef.current.pathname;

      // 3. Root / Home screens: Admin, Staff, Partner dashboard or login
      const isHomeScreen =
        currentPath === '/admin/dashboard' ||
        currentPath === '/staff/dashboard' ||
        currentPath === '/partner/dashboard' ||
        currentPath === '/login' ||
        currentPath === '/';

      if (isHomeScreen) {
        const now = Date.now();
        if (now - lastExitPressRef.current < 2000) {
          App.exitApp();
        } else {
          lastExitPressRef.current = now;
          toast('Press back again to exit', { duration: 2000 });
        }
        return;
      }

      // 4. Subpage / Detail page: ALWAYS navigate back, NEVER exit to home screen
      const stack = historyStackRef.current;
      if (stack.length > 1) {
        stack.pop(); // Remove current path
        const target = stack[stack.length - 1];
        if (target) {
          navigate(target);
          return;
        }
      }

      // 5. If history stack has no prior entry, navigate to parent screen
      const parent = getParentRoute(currentPath);
      navigate(parent);
    }).then((l) => {
      listener = l;
    });

    return () => {
      listener?.remove();
    };
  }, [navigate]);

  return null;
}

function getParentRoute(path: string): string {
  // Detail views to corresponding list view
  if (path.startsWith('/admin/registrations/')) return '/admin/registrations';
  if (path.startsWith('/admin/customers/')) return '/admin/customers';
  if (path.startsWith('/admin/leads/')) return '/admin/leads';
  if (path.startsWith('/admin/projects/')) return '/admin/projects';
  if (path.startsWith('/admin/staff/')) return '/admin/staff';
  if (path.startsWith('/admin/channel-partners/')) return '/admin/channel-partners';

  if (path.startsWith('/staff/registrations/')) return '/staff/registrations';
  if (path.startsWith('/staff/customers/')) return '/staff/customers';
  if (path.startsWith('/staff/leads/')) return '/staff/my-leads';
  if (path.startsWith('/staff/projects/')) return '/staff/projects';

  if (path.startsWith('/partner/projects/')) return '/partner/projects';

  // Section root to role dashboard
  if (path.startsWith('/admin/')) return '/admin/dashboard';
  if (path.startsWith('/staff/')) return '/staff/dashboard';
  if (path.startsWith('/partner/')) return '/partner/dashboard';

  return '/login';
}
