import { Phone, Mail, Calendar, Building2 } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { useAuth } from '@/context/AuthContext';
import { getAvatarColor, getInitials } from '@/data/mockData';

export default function PartnerProfile() {
  const { user: authUser } = useAuth();
  const user = authUser || { name: 'Partner', email: '', phone: '', designation: '' };
  const partner = { companyName: user.name, reraId: '', city: '', totalLeads: 0 } as any;
  const age = user.dob ? Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 relative">
        <div className="text-center">
          <Avatar initials={user.initials} size="xl" bg={user.avatarBg} className="mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900 mt-4">{user.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{partner.companyName}</p>
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
            <p className="text-sm text-slate-800">{partner.phone}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Mail size={12} /> Email
            </div>
            <p className="text-sm text-slate-800">{partner.email}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Building2 size={12} /> City
            </div>
            <p className="text-sm text-slate-800">{partner.city}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-1">
              <Calendar size={12} /> RERA ID
            </div>
            <p className="text-sm text-slate-800">{partner.reraId || 'Not registered'}</p>
          </div>
        </div>
        {user.dob && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide mb-2">
              <Calendar size={12} /> Date of Birth
            </div>
            <p className="text-sm text-slate-800">
              {new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {age && <span className="text-slate-400 ml-1">({age} years)</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
