import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/services/auth';
import { useAuth } from '@/context/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, setUserFromAuth } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    if (!/^[6-9]\d{9}$/.test(phoneDigits) && !/^91[6-9]\d{9}$/.test(phoneDigits)) { setError('Please enter a valid 10-digit phone number'); return; }
    if (!password) { setError('Please enter a password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await authService.register({
        name: name.trim(),
        initials: name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CP',
        role: 'partner',
        designation: 'Channel Partner',
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      });
      if (res.data) {
        setUserFromAuth(res.data);
      }
      navigate('/partner/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full h-13 px-4 py-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green focus:bg-white transition-all outline-none';

  return (
    <div className="min-h-[100dvh] flex">
      {/* Desktop left panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-white">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Samy & Co land promoters" className="h-16 w-auto object-contain" />
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 leading-[1.15] tracking-tight">
              Grow your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                property business
              </span><br />
              with us
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed max-w-sm">
              Register as a channel partner and start referring leads for projects in minutes.
            </p>
          </div>

          <p className="text-slate-400 text-xs">&copy; 2025 Samy &amp; Co land promoters. All rights reserved.</p>
        </div>
      </div>

      {/* Mobile + Desktop right panel */}
      <div className="flex-1 flex flex-col bg-[#faf8ff] relative items-center justify-center min-h-[100dvh] py-8">
        {/* Mobile header */}
        <header className="lg:hidden flex flex-col items-center justify-center gap-2 mb-6 px-4">
          <img src="/logo.png" alt="Samy & Co land promoters" className="h-16 w-auto object-contain" />
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green text-center">
            Samy &amp; Co land promoters
          </h1>
        </header>

        {/* Form area */}
        <main className="w-full max-w-md mx-auto px-6">
          <Link to="/login" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-blue mb-6 transition-colors w-fit">
            <ArrowLeft size={16} /> Back to Login
          </Link>

          <div className="relative bg-white backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/5 ring-1 ring-slate-200/60 p-7 sm:p-8">
            <div className="text-center mb-6">
              <img src="/logo.png" alt="Samy & Co land promoters" className="h-16 w-auto object-contain mx-auto mb-4" />
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Create Partner Account</h2>
              <p className="text-sm text-slate-500 mt-1">Register to refer leads as a channel partner</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value.toLowerCase())}
                  placeholder="you@example.com"
                  className={inputClass}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className={inputClass}
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`${inputClass} pr-12`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-blue transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-brand-green hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base active:scale-[0.98] transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Create Account <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-slate-500">Already have an account? </span>
              <Link to="/login" className="text-sm font-semibold text-brand-blue hover:text-blue-800 transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
