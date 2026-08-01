import { createContext, useContext, useState, useCallback, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';

export interface ExportInfo {
  endpoint: string;
  filename: string;
  params?: Record<string, string>;
}

export type DownloadStatus = 'idle' | 'starting' | 'downloading';

export interface StreamProgress {
  filename: string;
  transferredBytes: number;
  totalBytes: number;
  percentage: number;
  speed: string;
  eta: string;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  errorMessage?: string;
}

interface ExportContextType {
  exportInfo: ExportInfo | null;
  setExportInfo: (info: ExportInfo | null) => void;
  hasPageOverride: (path: string) => boolean;
  downloadStatus: DownloadStatus;
  setDownloadStatus: (s: DownloadStatus) => void;
  triggerDownload: () => void;
  progress: StreamProgress;
  setProgress: Dispatch<SetStateAction<StreamProgress>>;
  popoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
}

const ExportContext = createContext<ExportContextType | null>(null);

const DEFAULT_PROGRESS: StreamProgress = {
  filename: '',
  transferredBytes: 0,
  totalBytes: 0,
  percentage: 100,
  speed: 'Ready',
  eta: 'Ready',
  status: 'idle',
};

export function ExportProvider({ children }: { children: ReactNode }) {
  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [progress, setProgress] = useState<StreamProgress>(DEFAULT_PROGRESS);

  // Tracks which route a page explicitly configured export info for. The
  // Topbar auto-map effect runs after page effects on mount, so it checks this
  // ref (updated synchronously) to avoid clobbering page-provided configs
  // (e.g. Leads.tsx status, Reports.tsx tab, StaffReports.tsx tab).
  const pageOverridePathRef = useRef<string | null>(null);

  const setExportInfoSafe = useCallback((info: ExportInfo | null) => {
    pageOverridePathRef.current = info ? window.location.pathname : null;
    setExportInfo(info);
  }, []);

  const hasPageOverride = useCallback((path: string) => {
    return pageOverridePathRef.current === path;
  }, []);

  const triggerDownload = useCallback(async () => {
    if (!exportInfo) return;

    const token = localStorage.getItem('crm_token');
    if (!token) {
      setPopoverOpen(true);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'You are not authenticated. Please log in and try again.',
        speed: 'Error',
        eta: 'Failed',
      }));
      setDownloadStatus('idle');
      return;
    }

    const params = new URLSearchParams(exportInfo.params);
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    const url = `${API_BASE}${exportInfo.endpoint}${params.toString() ? `?${params}` : ''}`;

    const dateStr = new Date().toISOString().split('T')[0];
    const fullFilename = `${exportInfo.filename}_${dateStr}.csv`;

    setPopoverOpen(true);
    setDownloadStatus('downloading');
    setProgress({
      filename: fullFilename,
      transferredBytes: 0,
      totalBytes: 0,
      percentage: 0,
      speed: 'Starting...',
      eta: 'Calculating...',
      status: 'downloading',
    });

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('crm_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error('Export failed: authentication expired. Please log in again.');
      }
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`);

      const contentLengthHeader = response.headers.get('Content-Length');
      const totalBytes = contentLengthHeader ? Math.max(0, parseInt(contentLengthHeader, 10)) || 0 : 0;

      if (!response.body) throw new Error('ReadableStream not supported by browser response.');

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          loadedBytes += value.length;
        }

        const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
        const speedBytesSec = loadedBytes / elapsedSec;
        const speedStr = speedBytesSec > 1024 * 1024
          ? `${(speedBytesSec / (1024 * 1024)).toFixed(1)} MB/s`
          : `${(speedBytesSec / 1024).toFixed(1)} KB/s`;

        let pct = 0;
        let etaStr = '...';

        if (totalBytes > 0) {
          pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
          const remainingBytes = totalBytes - loadedBytes;
          const remainingSec = Math.ceil(remainingBytes / speedBytesSec);
          etaStr = `${remainingSec}s`;
        } else {
          pct = Math.min(95, Math.round((loadedBytes / (loadedBytes + 15000)) * 100));
          etaStr = 'Calculating...';
        }

        setProgress({
          filename: fullFilename,
          transferredBytes: loadedBytes,
          totalBytes: totalBytes || loadedBytes,
          percentage: pct,
          speed: speedStr,
          eta: etaStr,
          status: 'downloading',
        });
      }

      const blob = new Blob(chunks as BlobPart[], { type: 'text/csv;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fullFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setProgress({
        filename: fullFilename,
        transferredBytes: loadedBytes,
        totalBytes: loadedBytes,
        percentage: 100,
        speed: 'Done',
        eta: 'Completed',
        status: 'completed',
      });
      setDownloadStatus('idle');
    } catch (err: any) {
      console.error('Download stream error:', err);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        speed: 'Error',
        eta: 'Failed',
        errorMessage: err.message || 'Failed to download stream',
      }));
      setDownloadStatus('idle');
    }
  }, [exportInfo]);

  return (
    <ExportContext.Provider
      value={{
        exportInfo,
        setExportInfo: setExportInfoSafe,
        hasPageOverride,
        downloadStatus,
        setDownloadStatus,
        triggerDownload,
        progress,
        setProgress,
        popoverOpen,
        setPopoverOpen,
      }}
    >
      {children}
    </ExportContext.Provider>
  );
}

export function useExportContext(): ExportContextType {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExportContext must be used within ExportProvider');
  return ctx;
}
