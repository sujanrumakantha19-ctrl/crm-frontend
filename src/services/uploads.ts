import { api } from '@/lib/api';

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  category: string;
  path: string;
  uploadedAt: string;
}

export const uploadService = {
  upload(category: string, files: File[]) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return api.upload<UploadedFile[]>(`/uploads/${category}`, formData);
  },
  getFiles(category: string) {
    return api.get<UploadedFile[]>(`/uploads/${category}`);
  },
  deleteFile(category: string, filename: string) {
    return api.delete(`/uploads/${category}/${filename}`);
  },
};
