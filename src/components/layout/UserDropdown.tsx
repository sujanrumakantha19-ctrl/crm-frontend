import { useRef, useEffect } from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UserDropdownProps {
  open: boolean;
  onClose: () => void;
  onProfileClick: () => void;
}

export function UserDropdown({ open, onClose, onProfileClick }: UserDropdownProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose();
  };

  const handleProfile = () => {
    onProfileClick();
    onClose();
  };

  return (
    <div ref={ref} className="absolute right-0 top-14 w-44 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-dropdown overflow-hidden">
      <button onClick={handleProfile} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
        <User size={16} /> Profile
      </button>
      <div className="border-t border-slate-100" />
      <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
        <LogOut size={16} /> Logout
      </button>
    </div>
  );
}
