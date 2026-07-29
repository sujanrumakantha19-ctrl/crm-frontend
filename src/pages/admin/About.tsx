import { Building2, MapPin, Phone, Mail, Globe, Code2 } from 'lucide-react';

export default function AdminAbout() {
  return (
    <div className="space-y-8 w-full">
      {/* Hero Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-4">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Samy &amp; Co land promoters</h1>
            <p className="text-brand-blue text-sm font-medium">Real Estate CRM Platform</p>
          </div>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
          A powerful, all-in-one real estate CRM built to streamline property sales, lead management,
          and team collaboration. Designed specifically for Samy &amp; Co land promoters' operations across Coimbatore and Pollachi.
        </p>
      </div>

      {/* Contact / Company Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Company Information</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Building2 size={16} className="text-slate-400 shrink-0" />
            <span><span className="font-semibold text-slate-800">Company:</span> Samy &amp; Co land promoters</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <MapPin size={16} className="text-slate-400 shrink-0" />
            <span><span className="font-semibold text-slate-800">Locations:</span> Coimbatore &amp; Pollachi, Tamil Nadu</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Phone size={16} className="text-slate-400 shrink-0" />
            <span><span className="font-semibold text-slate-800">Phone:</span> —</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Mail size={16} className="text-slate-400 shrink-0" />
            <span><span className="font-semibold text-slate-800">Email:</span> —</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Globe size={16} className="text-slate-400 shrink-0" />
            <span><span className="font-semibold text-slate-800">Website:</span> —</span>
          </div>
        </div>
      </div>

      {/* Developed By */}
      <div className="bg-gradient-to-br from-teal-950 via-cyan-900 to-blue-950 rounded-xl border border-teal-700/30 shadow-lg p-6 text-white relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className="bg-white p-1.5 rounded-lg shadow-md shrink-0">
            <img src="/paavai-logo.jpeg" alt="Paavai Infotech Logo" className="h-11 w-auto rounded" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Developed by Paavai Infotech</h2>
            <p className="text-xs text-cyan-200/80 font-medium">Software &amp; Web Development Company</p>
          </div>
        </div>
        <div className="space-y-2.5 relative z-10">
          <div className="flex items-center gap-3 text-sm text-cyan-100/90">
            <MapPin size={15} className="text-cyan-400 shrink-0" />
            <span>Madurai, Tamil Nadu</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-cyan-100/90">
            <Phone size={15} className="text-cyan-400 shrink-0" />
            <a href="tel:+919894285054" className="hover:text-white hover:underline transition-colors">+91 9894285054</a>
          </div>
          <div className="flex items-center gap-3 text-sm text-cyan-100/90">
            <Mail size={15} className="text-cyan-400 shrink-0" />
            <a href="mailto:paavaiinfotech@gmail.com" className="hover:text-white hover:underline transition-colors">paavaiinfotech@gmail.com</a>
          </div>
          <div className="flex items-center gap-3 text-sm text-cyan-100/90">
            <Globe size={15} className="text-cyan-400 shrink-0" />
            <a href="https://paavaiinfotech.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition-colors">paavaiinfotech.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
