import { Phone, Mail, Calendar, Users, User } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { useAuth } from '@/context/AuthContext';
import { groupService } from '@/services';
import { useState, useEffect } from 'react';
import type { Group } from '@/types';

export default function StaffProfile() {
  const { user: authUser } = useAuth();
  const user = authUser || { name: 'Staff', email: '', phone: '', designation: '', groupId: '' };
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => { groupService.getAll({ limit: 50 }).then(r => setGroups(r.data || [])).catch(() => {}); }, []);
  const group = groups.find(g => g.members?.includes(user.id || (user as unknown as {_id:string})._id));
  const age = user.dob ? Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 relative">
        <div className="text-center">
          <Avatar initials={user.initials} size="xl" bg={user.avatarBg} className="mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900 mt-4">{user.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{user.designation}</p>
        </div>

        <div className="border-t border-slate-100 my-6" />

        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            ID
          </label>
          <input
            type="text"
            value={user.displayId || user.id || '—'}
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
            <p className="text-sm text-slate-800">{user.phone}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Mail size={12} /> Email
            </div>
            <p className="text-sm text-slate-800">{user.email}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Calendar size={12} /> Birthday
            </div>
            <p className="text-sm text-slate-800">
              {user.dob ? new Date(user.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '-'} {age && `(${age} years)`}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <User size={12} /> Gender
            </div>
            <p className="text-sm text-slate-800">{(user as any).gender || 'Male'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Users size={12} /> Group
            </div>
            {group ? (
              <span className="inline-block text-xs bg-blue-50 text-brand-blue px-2 py-0.5 rounded mt-0.5">{group.name}</span>
            ) : (
              <span className="inline-block text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded mt-0.5">Unassigned</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
