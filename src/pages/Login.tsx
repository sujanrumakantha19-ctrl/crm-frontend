import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => { if (isAuthenticated && role) navigate(`/${role}/dashboard`); }, [isAuthenticated, role, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true);
    setError('');
    try { await login(email, password); } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] flex">

      {/* ── LEFT PANEL — desktop only ── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-white">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/5 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Samy & Co land promoters" className="h-16 w-auto object-contain" />
          </div>

          {/* Headline */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 leading-[1.15] tracking-tight">
              Manage your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                real estate
              </span><br />
              portfolio
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed max-w-sm">
              Projects, leads, plots — everything you need to run your property business from one place.
            </p>
          </div>
          
          <div></div>
        </div>
      </div>

      {/* ── RIGHT PANEL — full-screen on mobile ── */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[100dvh] overflow-hidden bg-white">

        {/* Mobile branding hero */}
        <div className={cn(
          'lg:hidden flex flex-col items-center mb-8 transition-all duration-700',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
        )}>
          <img src="/logo.png" alt="Samy & Co land promoters" className="h-20 w-auto object-contain mb-4" />
          {/* Brand name — BIG */}
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green text-center px-4">
            Samy & Co land promoters
          </h1>
          
          {/* Subtle divider line */}
          <div className="mt-5 w-16 h-0.5 rounded-full bg-gradient-to-r from-blue-400 to-violet-400 opacity-60" />
        </div>

        {/* Glass form card */}
        <div className={cn(
          'w-full max-w-sm mx-auto px-4 sm:px-0 transition-all duration-700',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )}>
          <div className="relative bg-white/70 lg:bg-white backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-900/10 ring-1 ring-white/80 p-7 sm:p-8">
            {/* Inner top-left accent */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-blue-100/60 rounded-tl-3xl rounded-br-3xl blur-2xl pointer-events-none lg:hidden" />

            <div className="relative">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Welcome back</h2>
              <p className="text-sm text-slate-400 mb-7">Sign in to your account to continue</p>

              <form onSubmit={handleSignIn} className="space-y-5">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-13 px-4 py-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green focus:bg-white transition-all outline-none"
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-semibold text-brand-blue hover:text-blue-800 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-13 px-4 py-3.5 pr-12 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green focus:bg-white transition-all outline-none"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-blue transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2">
                    <span className="mt-0.5">⚠</span> {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand-green hover:bg-brand-darkgreen text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all shadow-lg shadow-brand-green/25 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
