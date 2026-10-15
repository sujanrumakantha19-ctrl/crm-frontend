import { useState, useEffect } from 'react';
import { Phone, Mail, Calendar, Building2, Users } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services';
import { getInitials, getAvatarColor } from '@/data/mockData';
import type { User } from '@/types';

export default function PartnerProfile() {
  const { user: authUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const user = authUser || profileUser;

  useEffect(() => {
    const uid = authUser?.id || (authUser as any)?._id;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    userService.getById(uid)
      .then(res => {
        const data = (res as any).data || res;
        if (data && data.id) setProfileUser(data as User);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser?.id, (authUser as any)?._id]);

  const initials = getInitials(user?.name || '');
  const avatarBg = (user as any)?.avatarBg || getAvatarColor(user?.name || '');

  const age = user?.dob ? (() => {
    const dobTime = new Date(user.dob).getTime();
    if (isNaN(dobTime)) return null;
    return Math.floor((Date.now() - dobTime) / (365.25 * 24 * 60 * 60 * 1000));
  })() : null;

  if (loading) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <p className="text-sm text-slate-400 text-center">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 relative">
        <div className="text-center">
          <Avatar initials={initials} size="xl" bg={avatarBg} className="mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900 mt-4">{user?.name || 'Partner'}</h2>
          <p className="text-sm text-slate-500 mt-1">Channel Partner</p>
        </div>

        <div className="border-t border-slate-100 my-6" />

        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            ID
          </label>
          <input
            type="text"
            value={(user as any)?.displayId || user?.id || (user as any)?._id || '—'}
            disabled
            readOnly
            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-slate-100 text-slate-700 font-semibold cursor-not-allowed outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Phone size={12} /> Phone
            </div>
            <p className="text-sm text-slate-800">{user?.phone || '—'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Mail size={12} /> Email
            </div>
            <p className="text-sm text-slate-800">{user?.email || '—'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Calendar size={12} /> Birthday
            </div>
            <p className="text-sm text-slate-800">
              {user?.dob ? new Date(user.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '—'}
              {age !== null && <span className="text-slate-400 ml-1">({age} years)</span>}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Building2 size={12} /> City
            </div>
            <p className="text-sm text-slate-800">{(user as any)?.city || '—'}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-2">
            <Users size={12} /> Gender
          </div>
          <p className="text-sm text-slate-800">{(user as any)?.gender || '—'}</p>
        </div>
      </div>

      <ChangePasswordCard />
    </div>
  );
}
