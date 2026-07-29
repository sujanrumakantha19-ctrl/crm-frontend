import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { whatsappService, type WhatsAppMessageData } from '@/services/whatsapp';
import { toast } from 'sonner';

interface WhatsAppChatModalProps {
  open: boolean;
  onClose: () => void;
  phone: string;
  name: string;
  projectName?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  displayName: string;
  body: string;
  variables: string[]; // Variable names for input labels
}

const TEMPLATES: MessageTemplate[] = [
  {
    id: 'welcome_lead',
    name: 'welcome_lead',
    displayName: '👋 Welcome Lead',
    body: 'Hi {{1}}, thank you for expressing interest in {{2}}! Our team will contact you shortly.',
    variables: ['Customer Name', 'Project Name']
  },
  {
    id: 'site_visit_scheduled',
    name: 'site_visit_scheduled',
    displayName: '📅 Site Visit Confirmed',
    body: 'Hello {{1}}, your site visit for {{2}} is confirmed on {{3}} at {{4}}.',
    variables: ['Customer Name', 'Project Name', 'Date', 'Time']
  },
  {
    id: 'document_request',
    name: 'document_request',
    displayName: '📄 Document Request',
    body: 'Hi {{1}}, please send us the following documents for your registration: {{2}}.',
    variables: ['Customer Name', 'Document List']
  }
];

export function WhatsAppChatModal({ open, onClose, phone, name, projectName = '' }: WhatsAppChatModalProps) {
  const [messages, setMessages] = useState<WhatsAppMessageData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Custom message state
  const [msgType, setMsgType] = useState<'text' | 'template'>('template');
  const [customText, setCustomText] = useState('');
  
  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0].id);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];

  // Load chat history
  const loadHistory = async () => {
    if (!phone) return;
    setLoadingHistory(true);
    try {
      const res = await whatsappService.getHistory(phone);
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load WhatsApp history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (open && phone) {
      loadHistory();
      // Pre-fill default variables
      setTemplateVars({
        'Customer Name': name,
        'Project Name': projectName
      });
      setMsgType('template');
      setCustomText('');
    }
  }, [open, phone, name, projectName]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    setSending(true);
    try {
      let payload: any = {
        phone,
        type: msgType
      };

      if (msgType === 'template') {
        // Collect variables in order
        const variables = selectedTemplate.variables.map(v => templateVars[v] || '');
        payload.templateName = selectedTemplate.name;
        payload.variables = variables;
      } else {
        if (!customText.trim()) {
          setSending(false);
          return;
        }
        payload.message = customText;
      }

      const res = await whatsappService.send(payload);
      toast.success('WhatsApp message sent successfully!');
      
      // Update local history
      if (res.data) {
        setMessages(prev => [...prev, res.data]);
      }
      
      // Clear inputs
      setCustomText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp message');
    } finally {
      setSending(false);
    }
  };

  const getTemplatePreview = () => {
    let preview = selectedTemplate.body;
    selectedTemplate.variables.forEach((variable, index) => {
      const val = templateVars[variable] || `[${variable}]`;
      preview = preview.replace(`{{${index + 1}}}`, val);
    });
    return preview;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <MessageSquare className="text-emerald-500 w-5 h-5" />
          <div>
            <div className="text-sm font-bold">{name}</div>
            <div className="text-xs text-slate-400 font-normal">{phone}</div>
          </div>
        </div>
      }
      size="sm"
    >
      <div className="flex flex-col h-[70vh] bg-slate-50 rounded-lg overflow-hidden -mx-6 -my-6 border border-slate-100">
        
        {/* Chat History View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-[#efeae2]">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              <span className="text-xs text-slate-500">Loading chat history...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-sm font-semibold text-slate-600">No Messages Yet</h3>
              <p className="text-xs text-slate-400 max-w-[200px] mt-1">Start a conversation with templates or session text.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              const date = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={msg._id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-2.5 shadow-sm text-sm ${
                    isOutbound 
                      ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 select-none">
                      <span>{date}</span>
                      {isOutbound && (
                        <span className={
                          msg.status === 'failed' ? 'text-rose-500' :
                          msg.status === 'read' ? 'text-sky-500' : 'text-slate-400'
                        }>
                          {msg.status === 'failed' ? '✖' : '✔✔'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Interface */}
        <form onSubmit={handleSend} className="bg-white border-t border-slate-200 p-4 shrink-0 flex flex-col gap-3">
          
          {/* Toggle Type */}
          <div className="flex rounded-lg bg-slate-100 p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setMsgType('template')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                msgType === 'template' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => setMsgType('text')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                msgType === 'text' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Session Text
            </button>
          </div>

          {msgType === 'template' ? (
            <div className="space-y-3">
              {/* Template Dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={e => {
                    setSelectedTemplateId(e.target.value);
                    setTemplateVars({ 'Customer Name': name, 'Project Name': projectName });
                  }}
                  className="w-full h-9 px-2 border border-slate-200 rounded-md text-xs bg-slate-50 focus:border-brand-green outline-none"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </div>

              {/* Template Variable Fields */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-h-[120px] overflow-y-auto">
                {selectedTemplate.variables.map(v => (
                  <div key={v}>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{v}</label>
                    <input
                      type="text"
                      value={templateVars[v] || ''}
                      onChange={e => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                      placeholder={`Enter ${v}`}
                      className="w-full h-8 px-2 border border-slate-200 rounded-md text-xs bg-white focus:border-brand-green outline-none"
                      required
                    />
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-lg p-2.5 text-xs text-emerald-800/80">
                <div className="font-bold text-[10px] uppercase text-emerald-600 mb-0.5">Template Preview</div>
                <div className="italic leading-normal whitespace-pre-wrap">{getTemplatePreview()}</div>
              </div>
            </div>
          ) : (
            <div>
              {/* Custom Text Area */}
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="Type your WhatsApp message..."
                className="w-full p-2.5 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none resize-none h-20"
                required
              />
            </div>
          )}

          {/* Action Row */}
          <div className="flex justify-end gap-2 mt-1">
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs active:scale-[0.98] transition-all shadow-sm shadow-emerald-500/25"
            >
              {sending ? 'Sending...' : <>Send Message <Send size={12} /></>}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
