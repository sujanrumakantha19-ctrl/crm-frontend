import { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/services/auth';

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.');
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      toast.error('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setError(null);
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-emerald-600" />
        <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
      </div>
      <p className="text-sm text-slate-500 mb-5">Keep your account secure by updating your password regularly.</p>

      {/* Inline Alert Boxes */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          <span>Password changed successfully!</span>
        </div>
      )}

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Current Password <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => {
              setCurrentPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter your current password"
            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            New Password <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={e => {
              setNewPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter a new password"
            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Confirm New Password <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => {
              setConfirmPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Re-enter the new password"
            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none transition-all"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm active:scale-[0.98] transition-all"
        >
          {saving ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
