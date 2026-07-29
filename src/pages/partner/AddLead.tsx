import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, User, Phone, Mail, MapPin, Home, Building2, FileText, Send, RotateCcw, AlertTriangle, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { projectService, leadService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/types';

export default function PartnerAddLead() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultProjectId = searchParams.get('projectId') || searchParams.get('project') || '';

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  // Duplicate phone state
  const [duplicateLead, setDuplicateLead] = useState<{ id: string; customerName: string; phone: string; status: string; assignedToName: string } | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const lastCheckedPhoneRef = useRef<string>('');

  const handlePhoneChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setPhone(clean);

    if (clean.length === 10) {
      if (lastCheckedPhoneRef.current === clean) return;
      lastCheckedPhoneRef.current = clean;
      setCheckingPhone(true);
      try {
        const res = await leadService.checkPhone(clean);
        if (res.exists && res.lead) {
          setDuplicateLead(res.lead);
        } else {
          setDuplicateLead(null);
        }
      } catch {
        setDuplicateLead(null);
      } finally {
        setCheckingPhone(false);
      }
    } else {
      lastCheckedPhoneRef.current = '';
      setDuplicateLead(null);
    }
  };

  const handleClearPhone = () => {
    setPhone('');
    lastCheckedPhoneRef.current = '';
    setDuplicateLead(null);
  };

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  useEffect(() => {
    projectService.getAll({ limit: 100 }).then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  const resetForm = () => {
    setName(''); setPhone(''); setEmail(''); setGender(''); setDob(''); setCity('');
    setProjectId(''); setBudget(''); setCategory(''); setNotes('');
    setDuplicateLead(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Customer name and phone number are required.');
      return;
    }

    if (duplicateLead) {
      toast.error(`Phone number already belongs to existing lead ${duplicateLead.customerName}. Click "Clear Number" to enter a different number.`);
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await leadService.create({
        customerName: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        gender: gender || 'Not Specified',
        dob: dob || undefined,
        city: city.trim() || undefined,
        projectId: projectId || undefined,
        budget: budget.trim() || undefined,
        category: category || undefined,
        notes: notes.trim() || undefined,
        source: user?.name || 'Channel Partner',
        sourceType: 'Channel Partner',
        status: 'Open',
        dateAdded: new Date().toISOString().split('T')[0],
      } as any);
      toast.success('Lead submitted successfully!');
      setSubmitted(true);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit lead');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white placeholder:text-slate-400 text-slate-850';
  const selectClass = 'w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700';
  const labelClass = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block';

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl border border-slate-150 shadow-md p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 border-2 border-emerald-100">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Lead Submitted!</h3>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Your lead has been submitted successfully and will be assigned to a sales representative shortly.
          </p>
          <button onClick={() => setSubmitted(false)} className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
            <RotateCcw size={14} /> Submit Another Lead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Submit New Lead</h2>
        <p className="text-sm text-slate-500 mt-0.5">Refer a customer to our team and track their conversion status.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Consolidated Form Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Customer Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <User size={15} className="text-brand-blue" /> Customer Information
            </h3>

            <div>
              <label className={labelClass}>Full Name *</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Enter customer name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={inputClass} 
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Phone Number *
                {checkingPhone && <span className="ml-2 text-[10px] text-blue-500 font-normal lowercase">Checking availability...</span>}
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="tel" 
                  maxLength={10}
                  placeholder="Enter phone number" 
                  value={phone} 
                  onChange={e => handlePhoneChange(e.target.value)} 
                  className={`${inputClass} ${duplicateLead ? 'border-amber-400 bg-amber-50/20' : ''}`}
                />
              </div>
              {duplicateLead && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-2 text-amber-900 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                      <span>Phone Number Already Exists!</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPhone}
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    >
                      <X size={13} /> Clear Number
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/80 p-2.5 rounded border border-amber-200/60">
                    <div>
                      <span className="text-slate-500 font-medium">Customer Name:</span>{' '}
                      <span className="font-bold text-slate-900">{duplicateLead.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Status:</span>{' '}
                      <span className="font-semibold text-slate-800">{duplicateLead.status}</span>
                    </div>
                    <div className="min-w-0 flex items-center gap-1">
                      <span className="text-slate-500 font-medium shrink-0">Lead ID:</span>{' '}
                      <span className="font-mono text-slate-700 font-semibold truncate inline-block max-w-[160px]" title={duplicateLead.displayId || duplicateLead.id}>
                        {duplicateLead.displayId || (duplicateLead.id.startsWith('L') ? duplicateLead.id : `L-${duplicateLead.id.slice(-4).toUpperCase()}`)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Assigned To:</span>{' '}
                      <span className="font-semibold text-slate-800">{duplicateLead.assignedToName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium italic">
                    Click "Clear Number" above to enter a new mobile number.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="Enter email address" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className={inputClass} 
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Gender</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select value={gender} onChange={e => setGender(e.target.value)} className={selectClass}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Date of Birth</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input 
                  type="date" 
                  value={dob} 
                  onChange={e => setDob(e.target.value)} 
                  className={inputClass} 
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>City</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Enter city" 
                  value={city} 
                  onChange={e => setCity(e.target.value)} 
                  className={inputClass} 
                />
              </div>
            </div>
          </div>

          {/* Right Column: Preferences & Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <Home size={15} className="text-brand-blue" /> Property Preference
            </h3>

            <div>
              <label className={labelClass}>Preferred Project</label>
              <div className="relative">
                <Home size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={selectClass}>
                  <option value="">Select a project</option>
                  {projects.filter(p => p.isEnabled !== false && ((p.id || (p as any)._id) === projectId || !p.status || p.status.toLowerCase() === 'active' || p.status.toLowerCase() === 'upcoming')).map(p => (
                    <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>{p.name} — {p.location}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget & Category (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Budget (Optional)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. ₹50,00,000"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Category (Optional)</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700">
                  <option value="">Select Category...</option>
                  <option value="Open Plots">Open Plots</option>
                  <option value="Villas">Villas</option>
                  <option value="Apartments">Apartments</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Farm Land">Farm Land</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Additional Notes</label>
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <textarea 
                  placeholder="Enter notes..." 
                  rows={4} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none bg-white placeholder:text-slate-400 text-slate-800" 
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between bg-slate-50 border-t border-slate-100 px-6 py-4">
          <button 
            type="button" 
            onClick={resetForm} 
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-650 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            Reset Form
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="inline-flex items-center gap-2 px-6 py-2 bg-brand-green text-white font-semibold text-sm rounded-lg hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
            {loading ? 'Submitting...' : 'Submit Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
