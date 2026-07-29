import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { navConfig } from '@/data/navConfig';
import type { UserRole } from '@/types';

interface SidebarProps {
  role: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ role, collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = navConfig[role];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-gradient-to-br from-[#2b3595] via-[#1e256e] to-[#111648] text-slate-100 border-r border-blue-400/20 flex flex-col z-40 transition-all duration-300 overflow-visible shadow-2xl',
        collapsed ? 'w-16' : 'w-[240px]'
      )}
    >
      {/* Logo Header */}
      <div className={cn('relative flex items-center h-16 border-b border-blue-400/20 shrink-0 bg-[#2b3595]/30 backdrop-blur-md px-3.5', collapsed ? 'justify-center' : 'justify-between')}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 shadow-sm">
            <img src="/logo.png" alt="Samy & Co" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-white text-sm font-bold truncate tracking-tight">Samy &amp; Co</span>
              <span className="text-emerald-400 text-[10px] font-bold tracking-wider uppercase">Land Promoters</span>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#3944b3] border border-blue-300/40 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#2b3595] transition-all z-50 cursor-pointer"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav Links */}
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-1 no-scrollbar', collapsed ? 'px-2 flex flex-col items-center' : 'px-3')}>
        {(() => {
          const isHighlightingFollowups = location.search.includes('highlightFollowups=true') || location.search.includes('from=followups');
          return navItems.map((item) => {
            const isFollowupItem = item.path.endsWith('/follow-ups');
            const isActive = isHighlightingFollowups
              ? isFollowupItem
              : location.pathname === item.path ||
                (location.pathname.startsWith(item.path + '/') && !item.path.endsWith('/dashboard')) ||
                (item.path === '/staff/my-leads' && location.pathname.startsWith('/staff/leads/'));
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  'flex items-center transition-all duration-150 group relative rounded-lg shrink-0 text-xs font-semibold',
                  collapsed 
                    ? 'justify-center h-10 w-10 p-0' 
                    : 'gap-3 px-3 py-2.5 w-full',
                  isActive
                    ? 'bg-brand-green text-white shadow-lg shadow-emerald-950/40'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/15'
                )}
              >
                <Icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-white" : "text-blue-200/80 group-hover:text-white")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#1e256e] text-white text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-blue-400/30">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          });
        })()}
      </nav>

      {/* Footer / Logout & Version */}
      <div className={cn('py-3 border-t border-blue-400/20 shrink-0 flex flex-col items-center bg-[#0b0e2d]/90 backdrop-blur-md gap-2', collapsed ? 'px-2' : 'px-3')}>
        <button
          type="button"
          onClick={logout}
          className={cn(
            'flex items-center text-blue-200/80 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors text-xs font-semibold',
            collapsed 
              ? 'justify-center h-10 w-10 p-0' 
              : 'gap-3 px-3 py-2.5 w-full'
          )}
        >
          <LogOut size={18} className="shrink-0 transition-colors" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Application Version */}
        {!collapsed ? (
          <div className="w-full flex items-center justify-between pt-2 border-t border-blue-400/20 text-[10px] text-blue-200/70 font-medium px-1">
            <span className="text-blue-300/70">Version</span>
            <span className="bg-[#2b3595]/60 text-emerald-400 px-1.5 py-0.5 rounded font-semibold tracking-wider border border-blue-400/30">
              v1.0.0
            </span>
          </div>
        ) : (
          <span className="text-[9px] font-mono text-blue-300/70 tracking-tight" title="App Version 1.0.0">
            v1.0.0
          </span>
        )}
      </div>
    </aside>
  );
}
