import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserRole, User } from '@/types';
import { authService } from '@/services/auth';

interface AuthContextType {
  role: UserRole | null;
  userId: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
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
        // Only clear session on explicit auth failure, not network errors
        if (err?.message === 'Unauthorized' || err?.message?.includes('401')) {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          setUser(null);
        }
        // On network error, keep existing user from localStorage so data stays visible
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    const u = { ...res.data, id: (res.data as unknown as { _id?: string })._id || res.data.id } as unknown as User;
    setUser(u);
    localStorage.setItem('crm_user', JSON.stringify(u));
    localStorage.setItem('crm_role', u.role);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    localStorage.removeItem('crm_checkedin');
    localStorage.removeItem('crm_checkintime');
    localStorage.removeItem('crm_checkints');
  }, []);

  // Attendance states
  const [checkedIn, setCheckedIn] = useState<boolean>(() => localStorage.getItem('crm_checkedin') === 'true');
  const [checkInTime, setCheckInTime] = useState<string | null>(() => localStorage.getItem('crm_checkintime'));
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(() => {
    const s = localStorage.getItem('crm_checkints');
    return s ? parseInt(s, 10) : null;
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
