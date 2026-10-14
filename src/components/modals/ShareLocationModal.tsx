import { useState, useEffect, useMemo } from 'react';
import { Share2, Search, Send, MapPin, X, Users, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { leadService, whatsappService } from '@/services';
import { toast } from 'sonner';
import type { Lead } from '@/types';

interface ShareLocationModalProps {
  open: boolean;
  onClose: () => void;
  project?: {
    id?: string;
    _id?: string;
    name: string;
    location?: string;
    latitude?: string;
    longitude?: string;
  } | null;
}

export function ShareLocationModal({ open, onClose, project }: ShareLocationModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Fetch all leads when modal opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedIds(new Set());
      setSearch('');
      leadService.getAll({ limit: 500 })
        .then(res => setLeads(res.data || []))
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Construct location link
  const locationLink = useMemo(() => {
    if (!project) return '';
    if (project.latitude && project.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`;
    }
    const queryStr = `${project.name} ${project.location || ''}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
  }, [project]);

  // Filter leads based on search
  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase().trim();
    return leads.filter(l =>
      l.customerName?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id || (l as any)._id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    const selectedLeads = leads.filter(l => selectedIds.has(l.id || (l as any)._id));
    if (selectedLeads.length === 0) return;

    setSending(true);
    let sentViaWaMe = false;

    // Direct WhatsApp send when 1 lead is selected (BUG-14)
    if (selectedLeads.length === 1) {
      const lead = selectedLeads[0];
      const messageText = `Hello ${lead.customerName},\n\nGreetings from Samy & Co!\n\nHere is the location link to see the land location for *${project?.name || 'our project'}*:\n📍 ${locationLink}\n\nFeel free to contact us if you have any questions or need further assistance.\n\nBest regards,\nSamy & Co Team`;
      let cleanPhone = (lead.phone || '').replace(/[^\d]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`, '_blank');
      sentViaWaMe = true;
      successCount++;
    } else {
      for (const lead of selectedLeads) {
        const messageText = `Hello ${lead.customerName},\n\nGreetings from Samy & Co!\n\nHere is the location link to see the land location for *${project?.name || 'our project'}*:\n📍 ${locationLink}\n\nFeel free to contact us if you have any questions or need further assistance.\n\nBest regards,\nSamy & Co Team`;

        let cleanPhone = (lead.phone || '').replace(/[^\d]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        try {
          await whatsappService.send({
            phone: cleanPhone,
            message: messageText,
            type: 'text',
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
    }

    setSending(false);
    if (successCount > 0) {
      toast.success(sentViaWaMe 
        ? `Opening WhatsApp with project location for ${selectedLeads[0].customerName}!` 
        : `Sent project location to ${successCount} lead(s) via WhatsApp!`);
      onClose();
    } else if (failCount > 0) {
      toast.error('Failed to send WhatsApp messages. Please verify recipient phone numbers.');
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Share2 size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold">Share Project Location</h3>
            <p className="text-xs text-slate-400 font-normal">{project?.name} &bull; {project?.location}</p>
          </div>
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-500">
            {selectedIds.size} lead(s) selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              {sending ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={13} />
                  Send WhatsApp ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Template Preview Box */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
          <p className="font-bold uppercase tracking-wider text-[10px] text-emerald-700 mb-1">WhatsApp Template Greeting &amp; Message from Samy &amp; Co</p>
          <div className="bg-white/80 border border-emerald-200/60 rounded p-2.5 space-y-1 font-mono text-[11px] leading-relaxed text-slate-700">
            <p>Hello <span className="font-bold text-emerald-700">[Lead Name]</span>,</p>
            <p>Greetings from <strong>Samy &amp; Co</strong>!</p>
            <p>Here is the location link to see the land location for <strong>*{project?.name}*</strong>:</p>
            <p className="text-blue-600 underline font-semibold flex items-center gap-1 my-1 break-all">
              <MapPin size={12} className="shrink-0 text-emerald-600" />
              {locationLink}
            </p>
            <p>Feel free to contact us if you need any assistance.</p>
            <p className="text-slate-500 italic mt-1">Best regards,<br />Samy &amp; Co Team</p>
          </div>
        </div>

        {/* Lead Selection Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Leads ({selectedIds.size} selected)</label>
            {filteredLeads.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-brand-blue hover:underline"
              >
                {selectedIds.size === filteredLeads.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads by name, phone, city..."
              className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-xs bg-white focus:border-brand-green outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Leads List */}
        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <RefreshCw size={16} className="animate-spin text-brand-green" />
              <span className="text-xs">Loading leads...</span>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <Users size={24} className="mx-auto mb-1 text-slate-300" />
              No leads found matching your search.
            </div>
          ) : (
            filteredLeads.map(lead => {
              const leadId = lead.id || (lead as any)._id;
              const isSelected = selectedIds.has(leadId);
              return (
                <div
                  key={leadId}
                  onClick={() => toggleSelect(leadId)}
                  className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors text-xs ${
                    isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{lead.customerName}</p>
                      <p className="text-[11px] text-slate-400">{lead.phone} &bull; {lead.city || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    lead.status === 'Customer' ? 'bg-purple-50 text-purple-700' :
                    lead.status === 'Qualified' ? 'bg-blue-50 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {lead.status || 'Open'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
