import { api } from '@/lib/api';

export interface WhatsAppMessageData {
  _id: string;
  phone: string;
  message: string;
  type: 'text' | 'template';
  templateName?: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SendWhatsAppPayload {
  phone: string;
  message?: string;
  type?: 'text' | 'template';
  templateName?: string;
  variables?: (string | number)[];
}

export const whatsappService = {
  send(payload: SendWhatsAppPayload) {
    return api.post<WhatsAppMessageData>('/whatsapp/send', payload);
  },
  getHistory(phone: string) {
    return api.get<WhatsAppMessageData[]>(`/whatsapp/history/${phone}`);
  }
};
