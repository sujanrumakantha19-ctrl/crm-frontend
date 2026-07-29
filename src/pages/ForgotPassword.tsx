import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { authService } from '@/services/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address'); return; }
    setLoading(true);
    setError('');
    
    try {
      await authService.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              Manage your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                real estate
              </span><br />
              portfolio
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed max-w-sm">
              Projects, leads, plots &mdash; everything you need to run your property business from one place.
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
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Reset Password</h2>
              <p className="text-sm text-slate-500 mt-1">Enter your email and we'll send you a reset link</p>
            </div>

            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center animate-fadeIn">
                <h3 className="text-emerald-800 font-bold mb-2">Check your email</h3>
                <p className="text-emerald-600 text-sm">We have sent a password reset link to <span className="font-bold">{email}</span>.</p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-13 px-4 py-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green focus:bg-white transition-all outline-none"
                    autoComplete="email"
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
                    <>Send Reset Link <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
