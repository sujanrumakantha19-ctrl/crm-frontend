import { api } from '@/lib/api';
import type { ChannelPartner } from '@/types';

export const channelPartnerService = {
  getAll(params?: Record<string, string | number | undefined>) {
    return api.get<ChannelPartner[]>('/channel-partners', params);
  },
  getById(id: string) {
    return api.get<ChannelPartner>(`/channel-partners/${id}`);
  },
  getActive() {
    return api.get<ChannelPartner[]>('/channel-partners/active');
  },
  create(data: Partial<ChannelPartner>) {
    return api.post<ChannelPartner>('/channel-partners', data);
  },
  update(id: string, data: Partial<ChannelPartner>) {
    return api.put<ChannelPartner>(`/channel-partners/${id}`, data);
  },
  delete(id: string) {
    return api.delete(`/channel-partners/${id}`);
  },
};
