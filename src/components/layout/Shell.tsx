import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { UserRole } from '@/types';
import { pushService } from '@/services';

interface ShellProps {
  role: UserRole;
}

export function Shell({ role }: ShellProps) {
  const { isAuthenticated, loading, role: userRole } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1280);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      pushService.initializePush(navigate);
    }
    return () => {
      pushService.cleanupPush();
    };
  }, [isAuthenticated, navigate]);

  // Redirect if user accesses routes for a different role
  useEffect(() => {
    if (!loading && isAuthenticated && userRole && userRole !== role) {
      navigate(`/${userRole}/dashboard`, { replace: true });
    }
  }, [loading, isAuthenticated, userRole, role, navigate]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else if (window.innerWidth < 1280) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] bg-fuchsia-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar role={role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Mobile Drawer — always mounted, animated via translate + opacity */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-in-out ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        {/* Drawer panel */}
        <div
          className={`relative z-10 h-full w-[240px] transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar role={role} collapsed={false} onToggleCollapse={() => {}} onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className={`min-h-screen flex flex-col transition-all duration-300 ml-0 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-[240px]'}`}>
        <Topbar role={role} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 animate-fadeIn">
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
