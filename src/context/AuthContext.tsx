import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserRole, User } from '@/types';
import { authService } from '@/services/auth';
import { attendanceService } from '@/services/attendance';

interface AuthContextType {
  role: UserRole | null;
  userId: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
  setUserFromAuth: (authData: { id: string; name: string; email: string; role: UserRole; initials: string; designation: string; phone: string; avatarBg: string }) => void;
  isAuthenticated: boolean;
  loading: boolean;
  checkedIn: boolean;
  checkInTime: string | null;
  checkInTimestamp: number | null;
  checkIn: (timeStr: string, timestamp: number) => void;
  checkOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  userId: null,
  user: null,
  login: async () => {},
  logout: () => {},
  updateUser: () => {},
  setUserFromAuth: () => {},
  isAuthenticated: false,
  loading: true,
  checkedIn: false,
  checkInTime: null,
  checkInTimestamp: null,
  checkIn: () => {},
  checkOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('crm_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const role = user?.role || null;
  const userId = user?.id || (user as any)?._id || null;
  const isAuthenticated = !!user && !!localStorage.getItem('crm_token');

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('crm_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) { setLoading(false); return; }
    authService.getMe()
      .then(res => {
        const u = { ...res.data, id: (res.data as unknown as { _id: string })._id || res.data.id };
        setUser(u);
        localStorage.setItem('crm_user', JSON.stringify(u));
      })
      .catch((err) => {
        // Only clear session on explicit auth failure, not network errors.
        // Deactivated/invalidated accounts return "Not authorized to access this route".
        const msg = err?.message || '';
        if (msg === 'Unauthorized' || msg.includes('401') || msg.includes('Not authorized')) {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_role');
          localStorage.removeItem('crm_user');
          setUser(null);
        }
        // On network error, keep existing user from localStorage so data stays visible
      })
      .finally(() => setLoading(false));
  }, []);

  // Soft logout triggered by any 401 across the app (see lib/api.ts) without a full page reload.
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const setUserFromAuth = useCallback((authData: { id: string; name: string; email: string; role: UserRole; initials: string; designation: string; phone: string; avatarBg: string; avatar?: string }) => {
    const u = { ...authData, id: (authData as unknown as { _id?: string })._id || authData.id } as unknown as User;
    setUser(u);
    localStorage.setItem('crm_user', JSON.stringify(u));
    localStorage.setItem('crm_role', u.role);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    setUserFromAuth(res.data);
  }, [setUserFromAuth]);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    localStorage.removeItem('crm_checkedin');
    localStorage.removeItem('crm_checkintime');
    localStorage.removeItem('crm_checkints');
  }, []);

  // Attendance states
  const [checkedIn, setCheckedIn] = useState<boolean>(() => {
    const isChecked = localStorage.getItem('crm_checkedin') === 'true';
    const s = localStorage.getItem('crm_checkints');
    if (isChecked && s) {
      const ts = parseInt(s, 10);
      const d = new Date(ts);
      const now = new Date();
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
        return true;
      } else {
        localStorage.setItem('crm_checkedin', 'false');
        localStorage.removeItem('crm_checkintime');
        localStorage.removeItem('crm_checkints');
        return false;
      }
    }
    return false;
  });
  const [checkInTime, setCheckInTime] = useState<string | null>(() => {
    const isChecked = localStorage.getItem('crm_checkedin') === 'true';
    return isChecked ? localStorage.getItem('crm_checkintime') : null;
  });
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(() => {
    const isChecked = localStorage.getItem('crm_checkedin') === 'true';
    const s = localStorage.getItem('crm_checkints');
    return isChecked && s ? parseInt(s, 10) : null;
  });

  const handleCheckIn = useCallback((timeStr: string, timestamp: number) => {
    setCheckedIn(true);
    setCheckInTime(timeStr);
    setCheckInTimestamp(timestamp);
    localStorage.setItem('crm_checkedin', 'true');
    localStorage.setItem('crm_checkintime', timeStr);
    localStorage.setItem('crm_checkints', timestamp.toString());
  }, []);

  const handleCheckOut = useCallback(() => {
    setCheckedIn(false);
    setCheckInTime(null);
    setCheckInTimestamp(null);
    localStorage.setItem('crm_checkedin', 'false');
    localStorage.removeItem('crm_checkintime');
    localStorage.removeItem('crm_checkints');
  }, []);

  // Synchronize active attendance session from backend for staff users on mount & login
  useEffect(() => {
    if (!user || user.role !== 'staff') return;
    let isMounted = true;
    attendanceService.getToday()
      .then(res => {
        if (!isMounted) return;
        const rawList = Array.isArray((res as any)?.data)
          ? (res as any).data
          : (res as any)?.data
            ? [(res as any).data]
            : Array.isArray(res)
              ? res
              : [];
        const activeRecord = rawList.find(
          (r: any) => !r.checkOut || r.checkOut === '—' || r.checkOut === '-'
        );
        if (activeRecord) {
          const cInTime = (activeRecord.checkIn === '—' || activeRecord.checkIn === '-') ? null : activeRecord.checkIn;
          const ts = activeRecord.createdAt ? new Date(activeRecord.createdAt).getTime() : Date.now();
          handleCheckIn(cInTime || new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), ts);
        } else {
          handleCheckOut();
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [user?.id, user?.role, handleCheckIn, handleCheckOut]);

  return (
    <AuthContext.Provider value={{
      role, userId, user, login, logout, updateUser, isAuthenticated, loading,
      checkedIn, checkInTime, checkInTimestamp,
      checkIn: handleCheckIn, checkOut: handleCheckOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
