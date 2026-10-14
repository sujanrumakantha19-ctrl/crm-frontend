/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Pencil, MapPin, LayoutGrid, CheckCircle, Circle, XCircle, ChevronLeft, ChevronRight, X, Map as MapIcon, Clock3, Upload, FileText, Send, MessageSquare, Ban, Download, Plus, Building2, ImageOff, ExternalLink, Trash2, FolderPlus, AlertTriangle, AlertCircle, Share2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NameTag } from '@/components/shared/NameTag';
import { Drawer } from '@/components/shared/Drawer';
import { WhatsAppChatModal } from '@/components/modals/WhatsAppChatModal';
import { DetailSkeletonPage } from '@/components/shared/SkeletonLoader';
import { EditProjectModal } from '@/components/modals/EditProjectModal';
import { ShareLocationModal } from '@/components/modals/ShareLocationModal';
import { Modal } from '@/components/shared/Modal';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { projectService, plotService, leadService, userService, taskService } from '@/services';
import { whatsappService } from '@/services/whatsapp';

import { UPLOADS_BASE, getFileUrl, api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useExportContext } from '@/context/ExportContext';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import type { Plot, Lead, User, Project, SellerInfo } from '@/types';
import { getProjectDisplayPlotTotal } from '@/lib/projectPlotCounts';

const plotStatusStyles: Record<string, { bg: string; textCol: string }> = {
  Available: { bg: 'bg-white border-2 border-slate-200', textCol: 'text-slate-700' },
  Booked: { bg: 'bg-green-500 border-2 border-green-500', textCol: 'text-white' },
  Registered: { bg: 'bg-blue-600 border-2 border-blue-600', textCol: 'text-white' },
  Canceled: { bg: 'bg-slate-400 border-2 border-slate-400', textCol: 'text-white' },
  Cancelled: { bg: 'bg-slate-400 border-2 border-slate-400', textCol: 'text-white' },
  Pending: { bg: 'bg-amber-400 border-2 border-amber-400', textCol: 'text-slate-900' },
};

const statusCellColors: Record<string, string> = {
  Available: 'text-slate-600',
  Booked: 'text-green-600',
  Registered: 'text-blue-600',
  Canceled: 'text-gray-500',
  Cancelled: 'text-gray-500',
  Pending: 'text-yellow-600',
};

const downloadFileDirectly = async (url: string, filename?: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const getCleanDocName = (rawName?: string, rawPath?: string) => {
  const raw = rawName || rawPath || '';
  if (!raw) return 'Document.pdf';
  const basename = raw.split('/').pop()?.split('\\').pop() || raw;
  const cleanName = basename.replace(/^\d+[-_]/, '');
  return cleanName || basename;
};

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user: authUser } = useAuth();
  const { setExportInfo, triggerDownload } = useExportContext();
  const isAdmin = role === 'admin';
  const isPartner = role === 'partner';
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [projectPlotStats, setProjectPlotStats] = useState({
    Available: 0,
    Booked: 0,
    Registered: 0,
    Cancelled: 0,
    Pending: 0,
    total: 0,
  });
  const [allocatedSqFt, setAllocatedSqFt] = useState(0);

  const [gridPlots, setGridPlots] = useState<Plot[]>([]);
  const [gridPlotPage, setGridPlotPage] = useState(1);
  const [gridTotalPlots, setGridTotalPlots] = useState(0);
  const [gridTotalPages, setGridTotalPages] = useState(1);
  const [gridLoading, setGridLoading] = useState(false);

  const [bulkPlots, setBulkPlots] = useState<Plot[]>([]);
  const [bulkPlotPage, setBulkPlotPage] = useState(1);
  const [bulkTotalPlots, setBulkTotalPlots] = useState(0);
  const [bulkTotalPages, setBulkTotalPages] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkPendingOnly, setBulkPendingOnly] = useState(false);

  const [pendingApprovalPlots, setPendingApprovalPlots] = useState<Plot[]>([]);
  const [pendingApprovalLoading, setPendingApprovalLoading] = useState(false);

  const [projectLeads, setProjectLeads] = useState<Lead[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyPlotIds, setDirtyPlotIds] = useState<Set<string>>(new Set());
  const [shareLocationOpen, setShareLocationOpen] = useState(false);

  const fetchGridPlots = useCallback(async (pageToFetch: number) => {
    if (!id) return;
    setGridLoading(true);
    try {
      const res = await plotService.getByProject(id, { page: pageToFetch, limit: 50 });
      const list = res.data || [];
      setGridPlots(list);
      setPlots(list);
      if (res.pagination) {
        setGridTotalPages(res.pagination.pages || 1);
        setGridTotalPlots(res.pagination.total || list.length);
      } else if (res.total !== undefined) {
        setGridTotalPlots(res.total);
        setGridTotalPages(Math.ceil(res.total / 50) || 1);
      }
      if (res.stats) {
        setProjectPlotStats({
          Available: res.stats.Available || 0,
          Booked: res.stats.Booked || 0,
          Registered: res.stats.Registered || 0,
          Cancelled: (res.stats.Cancelled || 0) + (res.stats.Canceled || 0),
          Pending: res.stats.Pending || 0,
          total: res.stats.total || 0,
        });
      }
      if (res.allocatedSqFt !== undefined) {
        setAllocatedSqFt(res.allocatedSqFt);
      }
    } catch (err) {
      console.error('Failed to fetch grid plots', err);
    } finally {
      setGridLoading(false);
    }
  }, [id]);

  const fetchBulkPlots = useCallback(async (pageToFetch: number, search?: string, pendingOnly?: boolean) => {
    if (!id) return;
    setBulkLoading(true);
    try {
      const s = search !== undefined ? search : bulkSearch;
      const p = pendingOnly !== undefined ? pendingOnly : bulkPendingOnly;
      const res = await plotService.getByProject(id, {
        page: pageToFetch,
        limit: 50,
        search: s.trim() || undefined,
        status: p ? 'Pending' : undefined,
      });
      const list = res.data || [];
      setBulkPlots(list);
      if (res.pagination) {
        setBulkTotalPages(res.pagination.pages || 1);
        setBulkTotalPlots(res.pagination.total || list.length);
      } else if (res.total !== undefined) {
        setBulkTotalPlots(res.total);
        setBulkTotalPages(Math.ceil(res.total / 50) || 1);
      }
      if (res.stats) {
        setProjectPlotStats({
          Available: res.stats.Available || 0,
          Booked: res.stats.Booked || 0,
          Registered: res.stats.Registered || 0,
          Cancelled: (res.stats.Cancelled || 0) + (res.stats.Canceled || 0),
          Pending: res.stats.Pending || 0,
          total: res.stats.total || 0,
        });
      }
      if (res.allocatedSqFt !== undefined) {
        setAllocatedSqFt(res.allocatedSqFt);
      }
    } catch (err) {
      console.error('Failed to fetch bulk plots', err);
    } finally {
      setBulkLoading(false);
    }
  }, [id, bulkSearch, bulkPendingOnly]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      const [pRes, plRes, lRes, sRes] = await Promise.allSettled([
        projectService.getById(id),
        plotService.getByProject(id, { page: 1, limit: 50 }),
        leadService.getAll({ projectId: id, limit: 100 }),
        userService.getAll({ role: 'staff', limit: 100 }),
      ]);
      if (pRes.status === 'fulfilled') {
        const p = pRes.value.data;
        if (p && !p.images) p.images = [];
        if (p && !p.plotImages) p.plotImages = [];
        setProject(p);
      }
      if (plRes.status === 'fulfilled') {
        const res = plRes.value;
        const list = res.data || [];
        setGridPlots(list);
        setPlots(list);
        if (res.pagination) {
          setGridTotalPages(res.pagination.pages || 1);
          setGridTotalPlots(res.pagination.total || list.length);
        } else if (res.total !== undefined) {
          setGridTotalPlots(res.total);
          setGridTotalPages(Math.ceil(res.total / 50) || 1);
        }
        if (res.stats) {
          setProjectPlotStats({
            Available: res.stats.Available || 0,
            Booked: res.stats.Booked || 0,
            Registered: res.stats.Registered || 0,
            Cancelled: (res.stats.Cancelled || 0) + (res.stats.Canceled || 0),
            Pending: res.stats.Pending || 0,
            total: res.stats.total || 0,
          });
        }
        if (res.allocatedSqFt !== undefined) {
          setAllocatedSqFt(res.allocatedSqFt);
        }
      }
      if (lRes.status === 'fulfilled') setProjectLeads(lRes.value.data || []);
      if (sRes.status === 'fulfilled') setStaffUsers(sRes.value.data || []);
      setLoading(false);
    })();
  }, [id]);

  const recipients = useMemo(() => {
    return projectLeads.map(l => ({
      id: l.id || (l as unknown as { _id: string })._id,
      name: l.customerName,
      phone: l.phone,
      status: l.status,
      displayId: l.displayId,
    }));
  }, [projectLeads]);

  const [activeTab, setActiveTab] = useState<'overview' | 'plotmap' | 'images' | 'seller' | 'broadcast'>('overview');
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

  // Tab control based on search query parameters (e.g. from notification clicks)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'plotmap') {
      setActiveTab('plotmap');
    }
  }, [location.search]);

  // Active tab safety guard for partner
  useEffect(() => {
    if (isPartner && (activeTab === 'seller' || activeTab === 'broadcast')) {
      setActiveTab('overview');
    }
  }, [isPartner, activeTab]);

  // Select plot automatically based on search query parameter
  useEffect(() => {
    if (isPartner || !id) return;
    const searchParams = new URLSearchParams(location.search);
    const plotIdParam = searchParams.get('plotId');
    const plotNumParam = searchParams.get('plotNumber');

    if (plotIdParam) {
      const found = gridPlots.find(p => p.id === plotIdParam || (p as any)._id === plotIdParam);
      if (found) {
        setSelectedPlot(found);
      } else {
        plotService.getById(plotIdParam)
          .then(res => { if (res.data) setSelectedPlot(res.data); })
          .catch(() => {});
      }
    } else if (plotNumParam) {
      const found = gridPlots.find(p => String(p.plotNumber) === plotNumParam);
      if (found) {
        setSelectedPlot(found);
      } else {
        plotService.getByProject(id, { search: plotNumParam, limit: 1 })
          .then(res => { if (res.data && res.data[0]) setSelectedPlot(res.data[0]); })
          .catch(() => {});
      }
    }
  }, [gridPlots, location.search, isPartner, id]);

  useEffect(() => {
    if (selectedPlot && selectedPlot.status === 'Pending' && !selectedPlot.pendingApproval) {
      const pid = selectedPlot.id || (selectedPlot as any)._id;
      if (pid) {
        plotService.getPendingApproval(pid)
          .then(res => {
            if (res.data) {
              const updated = { ...selectedPlot, pendingApproval: res.data };
              setSelectedPlot(updated);
              setGridPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updated : p));
              setBulkPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updated : p));
              setPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updated : p));
            }
          })
          .catch(() => { });
      }
    }
  }, [selectedPlot]);

  const [isEditingPlot, setIsEditingPlot] = useState(false);
  const [editedPlot, setEditedPlot] = useState<Plot | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);

  useEffect(() => {
    if (!bulkEditOpen) return;
    const timer = setTimeout(() => {
      setBulkPlotPage(1);
      fetchBulkPlots(1, bulkSearch, bulkPendingOnly);
    }, 500);
    return () => clearTimeout(timer);
  }, [bulkSearch, bulkPendingOnly, bulkEditOpen, fetchBulkPlots]);

  useEffect(() => {
    if (bulkEditOpen) {
      setBulkPlotPage(1);
      fetchBulkPlots(1, bulkSearch, bulkPendingOnly);
    }
  }, [bulkEditOpen, fetchBulkPlots]);

  useEffect(() => {
    if (approvalsModalOpen && id) {
      setPendingApprovalLoading(true);
      plotService.getByProject(id, { status: 'Pending', limit: 200 })
        .then(res => setPendingApprovalPlots(res.data || []))
        .catch(() => {})
        .finally(() => setPendingApprovalLoading(false));
    }
  }, [approvalsModalOpen, id]);

  // Precompute duplicate plot numbers in O(N) to eliminate O(N^2) browser freezing
  const duplicatePlotNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of bulkPlots) {
      const num = String(p.plotNumber || '').trim();
      if (num) counts[num] = (counts[num] || 0) + 1;
    }
    const dups = new Set<string>();
    for (const [num, count] of Object.entries(counts)) {
      if (count > 1) dups.add(num);
    }
    return dups;
  }, [bulkPlots]);

  const toSqFtHelper = useCallback((v: number, u: string) => {
    const uu = (u || '').toLowerCase().replace(/\s/g, '');
    if (uu === 'sqyards' || uu === 'sqyard') return v * 9;
    if (uu === 'acres' || uu === 'acre') return v * 43560;
    if (uu === 'cents' || uu === 'cent') return v * 435.6;
    return v;
  }, []);

  const totalAllocatedSqFt = allocatedSqFt;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [imagesEditOpen, setImagesEditOpen] = useState(false);
  const [editPlotImages, setEditPlotImages] = useState<string[]>([]);
  const [editProjectImages, setEditProjectImages] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: 'Delete Confirmation',
    message: '',
    onConfirm: () => {},
  });
  const [messageTemplate, setMessageTemplate] = useState('site-visit');
  const [broadcastMessage, setBroadcastMessage] = useState('Hi, sharing the latest project update for @location. Please confirm your preferred visit slot.');
  const [broadcastAttachment, setBroadcastAttachment] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingCustomerSearch, setBookingCustomerSearch] = useState('');
  const [searchedLeads, setSearchedLeads] = useState<Lead[]>([]);
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [expectedRegistrationDate, setExpectedRegistrationDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('Loan');
  const [advancePaymentStatus, setAdvancePaymentStatus] = useState<'Paid' | 'Not Paid'>('Paid');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationDate, setRegistrationDate] = useState('');

  useEffect(() => {
    const query = bookingCustomerSearch.trim();
    if (!query) {
      setSearchedLeads([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingLeads(true);
      const searchParams: any = { search: query, limit: 30 };
      if (role !== 'admin' && authUser?.id) {
        searchParams.assignedTo = authUser.id;
      }
      leadService.getAll(searchParams)
        .then(res => {
          const raw: Lead[] = res.data || [];
          const eligible = raw.filter(l => l.status === 'Qualified' || l.status === 'Customer');
          setSearchedLeads(eligible);
        })
        .catch(() => { })
        .finally(() => setIsSearchingLeads(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [bookingCustomerSearch, role, authUser?.id]);

  const [editingSellerIndex, setEditingSellerIndex] = useState<number | null>(null);
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerPhone, setNewSellerPhone] = useState('');
  const [newSellerEmail, setNewSellerEmail] = useState('');
  const [newSellerAddress, setNewSellerAddress] = useState('');
  const [newSellerDocs, setNewSellerDocs] = useState<string[]>([]);
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastStatusFilters, setBroadcastStatusFilters] = useState<string[]>(['All']);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  // Block Management State
  const [addBlockModalOpen, setAddBlockModalOpen] = useState(false);
  const [plotNumber, setPlotNumber] = useState('');
  const [plotCount, setPlotCount] = useState(10);
  const [blockFacing, setBlockFacing] = useState('East');
  const [blockSize, setBlockSize] = useState(150);
  const [blockSizeUnit, setBlockSizeUnit] = useState('Sq Feet');
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newPlotId, setNewPlotId] = useState<string | null>(null);
  const plotTableRef = useRef<HTMLDivElement>(null);

  const [deleteBlockModalOpen, setDeleteBlockModalOpen] = useState(false);
  const [selectedBlockToDelete, setSelectedBlockToDelete] = useState('');
  const [deletingBlock, setDeletingBlock] = useState(false);

  const existingBlocks = useMemo(() => {
    const blocksSet = new Set<string>();
    plots.forEach(p => {
      const str = String(p.plotNumber).trim();
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts[0]) blocksSet.add(parts[0].trim());
      } else {
        const match = str.match(/^([a-zA-Z]+|\d+[a-zA-Z]*)/);
        if (match && match[1]) blocksSet.add(match[1].trim());
      }
    });
    return Array.from(blocksSet).sort();
  }, [plots]);

  const handleDeleteSinglePlot = (plotToDelete: Plot) => {
    const plotId = plotToDelete.id || (plotToDelete as any)._id;
    setDeleteConfirm({
      open: true,
      title: `Delete Plot #${plotToDelete.plotNumber}`,
      message: `Are you sure you want to delete Plot #${plotToDelete.plotNumber}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await plotService.delete(plotId);
          setPlots(prev => prev.filter(p => (p.id || (p as any)._id) !== plotId));
          setGridPlots(prev => prev.filter(p => (p.id || (p as any)._id) !== plotId));
          setBulkPlots(prev => prev.filter(p => (p.id || (p as any)._id) !== plotId));
          const { toast } = await import('sonner');
          toast.success(`Plot #${plotToDelete.plotNumber} deleted successfully!`);
        } catch (err: any) {
          const { toast } = await import('sonner');
          toast.error(err.message || 'Failed to delete plot');
        }
      }
    });
  };

  const handleAddSinglePlot = useCallback(async () => {
    if (!project) return;
    const projectIdStr = project.id || (project as any)._id;
    // Auto-generate next plot number
    const allNumbers = plots
      .map(p => parseInt(String(p.plotNumber).replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = allNumbers.length > 0 ? Math.max(...allNumbers) + 1 : 1;
    const newPlotNumber = String(nextNum);
    try {
      const res = await plotService.create({
        projectId: projectIdStr,
        plotNumber: newPlotNumber as any,
        status: 'Available',
        facing: 'East',
        size: 150,
        sizeUnit: 'Sq Feet',
        type: 'Open Plot',
        timeline: [],
      });
      const created = res.data as any;
      if (created) {
        created.id = created.id || created._id;
        setPlots(prev => [...prev, created]);
        setGridPlots(prev => [...prev, created]);
        setBulkPlots(prev => [...prev, created]);
        const id = created.id;
        setNewPlotId(id);
        // Scroll to new row after render
        setTimeout(() => {
          const row = document.getElementById(`plot-row-${id}`);
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          // Clear highlight after animation
          setTimeout(() => setNewPlotId(null), 2000);
        }, 100);
      }
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to add plot');
    }
  }, [project, plots]);

  const handleCreateBlock = async () => {
    if (!project) return;
    if (!plotNumber.trim()) {
      const { toast } = await import('sonner');
      toast.error('Please enter a plot number.');
      return;
    }
    if (!plotCount || plotCount < 1) {
      const { toast } = await import('sonner');
      toast.error('Please enter a valid number of plots.');
      return;
    }

    setCreatingBlock(true);
    const projectIdStr = project.id || (project as any)._id;
    const createdPlots: Plot[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < plotCount; i++) {
        const pNum = plotCount === 1 ? plotNumber.trim() : `${plotNumber.trim()}-${i + 1}`;
        const newPlotData: Partial<Plot> = {
          projectId: projectIdStr,
          plotNumber: pNum as any,
          status: 'Available',
          facing: blockFacing,
          size: Number(blockSize) || 150,
          sizeUnit: blockSizeUnit,
          type: 'Open Plot',
          timeline: [],
        };

        try {
          const res = await plotService.create(newPlotData);
          const created = res.data as any;
          if (created) {
            created.id = created.id || created._id;
            createdPlots.push(created);
          }
        } catch (err: any) {
          errors.push(`Plot ${pNum}: ${err.message || 'Failed'}`);
        }
      }

      if (createdPlots.length > 0) {
        setPlots(prev => [...prev, ...createdPlots]);
        const { toast } = await import('sonner');
        toast.success(`Added ${createdPlots.length} plot${createdPlots.length > 1 ? 's' : ''} successfully!`);
        setAddBlockModalOpen(false);
        setPlotNumber('');
        setPlotCount(10);
      }
      if (errors.length > 0) {
        const { toast } = await import('sonner');
        toast.warning(`Some plots failed to create: ${errors.join(', ')}`);
      }
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to create plots');
    } finally {
      setCreatingBlock(false);
    }
  };

  const handleDeleteBlock = async () => {
    if (!selectedBlockToDelete) return;
    const plotsToDelete = plots.filter(p => {
      const numStr = String(p.plotNumber);
      return numStr.startsWith(`${selectedBlockToDelete}-`) || numStr.startsWith(selectedBlockToDelete);
    });

    if (plotsToDelete.length === 0) {
      const { toast } = await import('sonner');
      toast.error('No plots found for the selected block.');
      return;
    }

    setDeleteConfirm({
      open: true,
      title: `Delete Block "${selectedBlockToDelete}"`,
      message: `Are you sure you want to delete ${selectedBlockToDelete} and all its ${plotsToDelete.length} plots? This action cannot be undone.`,
      onConfirm: async () => {
        setDeletingBlock(true);
        try {
          await Promise.all(plotsToDelete.map(p => plotService.delete(p.id || (p as any)._id)));
          const deletedIds = new Set(plotsToDelete.map(p => p.id || (p as any)._id));
          setPlots(prev => prev.filter(p => !deletedIds.has(p.id || (p as any)._id)));
          const { toast } = await import('sonner');
          toast.success(`Deleted block "${selectedBlockToDelete}" (${plotsToDelete.length} plots) successfully!`);
          setDeleteBlockModalOpen(false);
          setSelectedBlockToDelete('');
        } catch (err: any) {
          const { toast } = await import('sonner');
          toast.error(err.message || 'Failed to delete block');
        } finally {
          setDeletingBlock(false);
        }
      }
    });
  };

  const [viewDoc, setViewDoc] = useState<{ name: string; url: string; rawUrl?: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ sellerIdx: number; docId: string; docName: string; docPath?: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [uploadingDocIdx, setUploadingDocIdx] = useState<number | null>(null);
  const [sellerToDelete, setSellerToDelete] = useState<{ idx: number; name: string } | null>(null);
  const [deletingSeller, setDeletingSeller] = useState(false);

  const persistSellerChanges = async (nextSellers: SellerInfo[]) => {
    if (!project) return;
    const pid = project.id || (project as any)._id;
    await projectService.update(pid, { sellers: nextSellers, owner: nextSellers[0] } as any);
    setProject(prev => prev ? { ...prev, sellers: nextSellers, owner: nextSellers[0] } : prev);
  };

  const handleDeleteSeller = async () => {
    if (!sellerToDelete || !project) return;
    setDeletingSeller(true);
    try {
      const currentSellers = [...(project.sellers || (project.owner ? [project.owner] : []))] as SellerInfo[];
      const updatedSellers = currentSellers.filter((_, i) => i !== sellerToDelete.idx);
      await persistSellerChanges(updatedSellers);
      const { toast } = await import('sonner');
      toast.success(`Seller "${sellerToDelete.name}" deleted successfully!`);
      setSellerToDelete(null);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err?.message || 'Failed to delete seller');
    } finally {
      setDeletingSeller(false);
    }
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      const { uploadService } = await import('@/services/uploads');
      const res = await uploadService.upload('projects', Array.from(files));
      if (res.success && res.data && res.data.length > 0) {
        const filename = res.data[0];
        setBroadcastAttachment(filename);
        setShowAttachmentPicker(false);
        const { toast } = await import('sonner');
        toast.success('Custom image uploaded successfully!');
      }
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to upload image');
    }
  };

  const handleAddSeller = async () => {

    if (!project) return;
    if (!newSellerName.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newSellerPhone && newSellerPhone.length !== 10) {
      const { toast } = await import('sonner');
      toast.error('Seller phone number must be exactly 10 digits.');
      return;
    }
    if (newSellerEmail && !emailRegex.test(newSellerEmail)) {
      const { toast } = await import('sonner');
      toast.error('Please enter a valid seller email address.');
      return;
    }

    const updatedSellers = [...(project.sellers || (project.owner ? [project.owner] : []))] as SellerInfo[];

    if (editingSellerIndex !== null) {
      const existingDocs = updatedSellers[editingSellerIndex].kycDocuments || [];
      const newKyc = newSellerDocs.map((docName, idx) => {
        const existing = existingDocs.find((d: any) => d.name === docName);
        if (existing) return existing;
        return { id: `doc-${Date.now()}-${idx}`, name: docName, type: 'PDF' as const, uploadedAt: new Date().toISOString().split('T')[0] };
      });
      updatedSellers[editingSellerIndex] = {
        ...updatedSellers[editingSellerIndex],
        name: newSellerName.trim(),
        phone: newSellerPhone.trim(),
        email: newSellerEmail.trim().toLowerCase() || undefined,
        address: newSellerAddress.trim() || undefined,
        kycDocuments: newKyc,
      };
    } else {
      const newSeller: SellerInfo = {
        name: newSellerName.trim(),
        phone: newSellerPhone.trim(),
        email: newSellerEmail.trim().toLowerCase() || undefined,
        address: newSellerAddress.trim() || undefined,
        kycDocuments: newSellerDocs.map((docName, idx) => ({
          id: `doc-${Date.now()}-${idx}`,
          name: docName,
          type: 'PDF' as const,
          uploadedAt: new Date().toISOString().split('T')[0],
        })),
      };
      updatedSellers.push(newSeller);
    }

    try {
      await persistSellerChanges(updatedSellers);
      const { toast } = await import('sonner');
      toast.success(editingSellerIndex !== null ? 'Seller updated successfully' : 'Seller added successfully');

      setNewSellerName('');
      setNewSellerPhone('');
      setNewSellerEmail('');
      setNewSellerAddress('');
      setNewSellerDocs([]);
      setEditingSellerIndex(null);
      setAddSellerOpen(false);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err?.message || 'Failed to save seller details');
    }
  };

  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      const matchesSearch = !broadcastSearch.trim() ||
        r.name.toLowerCase().includes(broadcastSearch.toLowerCase()) ||
        r.phone.includes(broadcastSearch) ||
        (r.displayId && r.displayId.toLowerCase().includes(broadcastSearch.toLowerCase()));

      let matchesStatus = false;
      if (broadcastStatusFilters.includes('All')) {
        matchesStatus = true;
      } else {
        matchesStatus = broadcastStatusFilters.some(filter => {
          if (filter === 'Qualified Customer') return r.status === 'Customer';
          if (filter === 'Lead') return r.status === 'Qualified';
          if (filter === 'Open Lead') return r.status === 'Open';
          return false;
        });
      }
      return matchesSearch && matchesStatus;
    });
  }, [recipients, broadcastSearch, broadcastStatusFilters]);

  const handleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedRecipients(prev => {
        const added = filteredRecipients.map(r => r.id).filter(id => !prev.includes(id));
        return [...prev, ...added];
      });
    } else {
      const filteredIds = filteredRecipients.map(r => r.id);
      setSelectedRecipients(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleEditPlotClick = () => {
    if (selectedPlot) {
      setEditedPlot({ ...selectedPlot });
      setIsEditingPlot(true);
    }
  };

  const handleSavePlot = async () => {
    if (editedPlot && selectedPlot) {
      if (saving) return;
      setSaving(true);
      try {
      const updatedPlot = { ...editedPlot };
      if (editedPlot.status !== selectedPlot.status) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const newEvent = {
          id: `sim-e-${Date.now()}`,
          type: (editedPlot.status === 'Booked' ? 'booking_confirmed' :
            editedPlot.status === 'Registered' ? 'booking_confirmed' :
              editedPlot.status === 'Canceled' ? 'booking_canceled' : 'lead_added') as any,
          label: `Status updated to ${editedPlot.status}`,
          actor: authUser?.name || 'Admin',
          actorRole: 'Admin',
          date: dateStr,
          details: `Manual status adjustment to ${editedPlot.status}`,
          color: (editedPlot.status === 'Booked' ? 'green' :
            editedPlot.status === 'Registered' ? 'blue' :
              editedPlot.status === 'Canceled' ? 'red' : 'amber') as any,
        };
        updatedPlot.timeline = [newEvent, ...updatedPlot.timeline];
      }
      const plotId = updatedPlot.id || (updatedPlot as any)._id;
        await plotService.update(plotId, updatedPlot);
        setPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? updatedPlot : p));
        setSelectedPlot(updatedPlot);
        const { toast } = await import('sonner');
        toast.success('Plot updated successfully!');
      } catch (err: any) {
        const { toast } = await import('sonner');
        toast.error(err.message || 'Failed to update plot');
      } finally { setSaving(false); }
      setIsEditingPlot(false);
      setEditedPlot(null);
    }
  };

  const handleBulkPlotChange = (plotId: string, field: keyof Plot, value: string | number) => {
    setPlots(prev => prev.map(plot => (plot.id || (plot as any)._id) === plotId ? { ...plot, [field]: value } : plot));
    setDirtyPlotIds(prev => new Set([...prev, plotId]));
  };

  const handleAddSubPlot = async (parentPlot: Plot) => {
    const base = String(parentPlot.plotNumber).replace(/[a-z]+$/i, '');
    // Find existing sub-plots for this base number
    const existing = plots.filter(p => {
      const pn = String(p.plotNumber);
      return pn === base || (pn.startsWith(base) && /^[a-z]+$/i.test(pn.slice(base.length)));
    });
    // Determine next suffix
    const suffixes = existing.map(p => { const s = String(p.plotNumber).slice(base.length); return s || ''; }).filter(s => s.length > 0);
    const nextChar = suffixes.length === 0 ? 'A' : String.fromCharCode(Math.max(...suffixes.map(s => s.toUpperCase().charCodeAt(0))) + 1);
    const newPlotNumber = `${base}${nextChar}`;

    // Check duplicate
    if (plots.find(p => String(p.plotNumber) === newPlotNumber)) return;

    const projIdStr = typeof parentPlot.projectId === 'object' && parentPlot.projectId !== null
      ? (parentPlot.projectId as any)._id || (parentPlot.projectId as any).id
      : (parentPlot.projectId || id);

    const newPlot: any = {
      projectId: projIdStr,
      plotNumber: newPlotNumber,
      status: 'Available',
      facing: parentPlot.facing || 'East',
      size: parentPlot.size || 150,
      sizeUnit: parentPlot.sizeUnit || 'Sq Feet',
      type: parentPlot.type || 'Open Plot',
      timeline: [],
    };

    try {
      const res = await plotService.create(newPlot);
      const created = res.data as any;
      if (created) {
        created.id = created.id || created._id;
        setPlots(prev => {
          const idx = prev.findIndex(p => (p.id || (p as any)._id) === (parentPlot.id || (parentPlot as any)._id));
          const copy = [...prev];
          copy.splice(idx + 1, 0, created);
          return copy;
        });
        const { toast } = await import('sonner');
        toast.success(`Sub-plot ${newPlotNumber} created!`);
      }
    } catch (error: any) {
      const { toast } = await import('sonner');
      toast.error(error.message || 'Failed to create sub-plot');
    }
  };

  const handleApproval = async (decision: 'approve' | 'reject', targetPlot?: Plot) => {
    const plotToApprove = targetPlot || selectedPlot;
    if (!plotToApprove || !plotToApprove.pendingApproval) return;
    if (saving) return;
    setSaving(true);
    try {
      const pid = plotToApprove.id || (plotToApprove as any)._id;
      let res;
      if (decision === 'approve') {
        res = await plotService.approveBooking(pid);
      } else {
        res = await plotService.rejectBooking(pid);
      }
      const updatedPlot = res.data;
      setPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      setGridPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      setBulkPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      setPendingApprovalPlots(prev => prev.filter(p => (p.id || (p as any)._id) !== pid));
      fetchGridPlots(gridPlotPage);
      if (selectedPlot && (selectedPlot.id || (selectedPlot as any)._id) === pid) {
        setSelectedPlot(updatedPlot);
      }
      const isCancel = plotToApprove.pendingApproval?.requestType === 'cancellation';
      const { toast } = await import('sonner');
      toast.success(
        decision === 'approve'
          ? (isCancel ? 'Cancellation approved!' : 'Booking approved!')
          : (isCancel ? 'Cancellation rejected.' : 'Booking rejected.')
      );
      logActivity(
        { id: authUser?.id || '', name: authUser?.name || 'Admin', role: role || 'admin', initials: authUser?.initials },
        `${decision === 'approve' ? 'Approved' : 'Rejected'} ${isCancel ? 'cancellation' : 'booking'} for plot #${plotToApprove.plotNumber}`,
        'Status Change',
        'Plot',
        pid,
        `Plot #${plotToApprove.plotNumber}`
      );
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to process approval');
    } finally { setSaving(false); }
  };

  const handleBookPlot = async () => {
    if (!selectedPlot || !selectedCustomer) return;
    if (!expectedRegistrationDate.trim()) {
      toast.error('Expected Registration Date is required to book a plot.');
      return;
    }
    if (saving) return;
    setSaving(true);
    const isStaffBooking = role !== 'admin';
    try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const pStatus: 'Not Paid' | 'Partially Paid' | 'Fully Paid' =
      advancePaymentStatus === 'Paid' ? 'Fully Paid' :
        advancePaymentStatus === 'Partial' ? 'Partially Paid' : 'Not Paid';

    const customerId = (selectedCustomer as any)._id || selectedCustomer.id;

    const updatedPlot: Plot = {
      ...selectedPlot,
      status: isStaffBooking ? 'Pending' : 'Booked',
      bookedBy: !isStaffBooking ? {
        name: selectedCustomer.customerName,
        phone: selectedCustomer.phone,
        paymentStatus: pStatus,
        paymentMethod: paymentMode === 'Loan' ? 'LOAN' : 'CASH',
        type: 'customer',
      } : undefined,
      pendingApproval: isStaffBooking ? { leadId: customerId, customerName: selectedCustomer.customerName, phone: selectedCustomer.phone, requestedBy: authUser?.name || 'Staff', requestedAt: dateStr, paymentStatus: pStatus, notes: `Payment Mode: ${paymentMode}` } : undefined,
      expectedRegistrationDate: expectedRegistrationDate || '',
      timeline: [
        {
          id: `booking-${Date.now()}`,
          type: isStaffBooking ? 'reserved' : 'new_booking',
          label: isStaffBooking ? 'Booking Requested' : 'Plot Booked',
          actor: authUser?.name || (role === 'admin' ? 'Admin' : 'Staff'),
          actorRole: role === 'admin' ? 'Admin' : 'Staff',
          date: dateStr,
          details: `Advance: ${advancePaymentStatus}. Payment Mode: ${paymentMode}. Expected Reg: ${expectedRegistrationDate || 'TBD'}`,
          color: isStaffBooking ? 'amber' : 'green',
          actorType: role === 'admin' ? 'admin' : 'staff',
        },
        ...selectedPlot.timeline,
      ],
    };

    const plotId = updatedPlot.id || (updatedPlot as any)._id;
      if (isStaffBooking) {
        await plotService.bookPlot(plotId, {
          leadId: customerId,
          customerName: selectedCustomer.customerName,
          phone: selectedCustomer.phone,
          paymentStatus: pStatus,
          paymentMethod: paymentMode === 'Loan' ? 'LOAN' : 'CASH',
          bank: (selectedCustomer as any).bank || '',
          bankFollowerName: (selectedCustomer as any).bankFollowerName || '',
          bankFollowerPhone: (selectedCustomer as any).bankFollowerPhone || '',
          notes: `Payment Mode: ${paymentMode}`,
          expectedRegistrationDate: expectedRegistrationDate || '',
        } as any);
      } else {
        await plotService.bookPlot(plotId, {
          leadId: customerId,
          customerName: selectedCustomer.customerName,
          phone: selectedCustomer.phone,
          paymentStatus: pStatus,
          paymentMethod: paymentMode === 'Loan' ? 'LOAN' : 'CASH',
          bank: (selectedCustomer as any).bank || '',
          bankFollowerName: (selectedCustomer as any).bankFollowerName || '',
          bankFollowerPhone: (selectedCustomer as any).bankFollowerPhone || '',
          notes: `Payment Mode: ${paymentMode}`,
          expectedRegistrationDate: expectedRegistrationDate || '',
        } as any);
      }
      // Update lead status to Customer
      if (customerId && !isStaffBooking) {
        await leadService.update(customerId, {
          status: 'Customer',
          projectId: project?.id || (project as any)?._id,
          paymentStatus: pStatus,
          paymentMethod: paymentMode === 'Loan' ? 'LOAN' : 'CASH',
        } as any);
      }
      setPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? updatedPlot : p));
      setGridPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? updatedPlot : p));
      setBulkPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? updatedPlot : p));
      fetchGridPlots(gridPlotPage);
      setSelectedPlot(updatedPlot);
      logActivity({ id: authUser?.id || '', name: authUser?.name || 'Admin', role: role || 'admin', initials: authUser?.initials }, isStaffBooking ? `Submitted booking request for plot #${selectedPlot.plotNumber}` : `Booked plot #${selectedPlot.plotNumber}`, 'Status Change', 'Plot', plotId, `Plot #${selectedPlot.plotNumber}`);
      const { toast } = await import('sonner');
      toast.success(isStaffBooking ? 'Booking request submitted for approval' : 'Plot booked successfully!');
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to book plot');
    } finally { setSaving(false); }
    setShowBookingForm(false);
    setSelectedCustomer(null);
    setBookingCustomerSearch('');
    setExpectedRegistrationDate('');
  };

  const handleRegisterPlot = async () => {
    if (!selectedPlot || !registrationDate) return;
    if (saving) return;
    setSaving(true);
    try {
    const updatedPlot: Plot = {
      ...selectedPlot,
      status: 'Registered',
      bookedBy: selectedPlot.bookedBy ? {
        ...selectedPlot.bookedBy,
      } : undefined,
      registrationDate: registrationDate,
      timeline: [
        {
          id: `reg-${Date.now()}`,
          type: 'booking_confirmed',
          label: 'Plot Registered',
          actor: authUser?.name || 'Admin',
          actorRole: 'Admin',
          date: registrationDate,
          details: `Registration Date: ${registrationDate}`,
          color: 'blue',
          actorType: 'admin',
        },
        ...selectedPlot.timeline,
      ],
    };

    const plotId = updatedPlot.id || (updatedPlot as any)._id;
      const regRes = await plotService.registerPlot(plotId, { registrationDate });
      // Update lead payment status & fetch latest lead details to get assigned staff
      let targetLead = projectLeads.find(l => l.customerName === selectedPlot.bookedBy?.name || l.phone === selectedPlot.bookedBy?.phone);
      if (!targetLead && selectedPlot.bookedBy?.phone) {
        try {
          const checkRes = await leadService.checkPhone(selectedPlot.bookedBy.phone);
          if (checkRes.lead) {
            targetLead = checkRes.lead as any;
          }
        } catch {}
      }
      if (targetLead) {
        const leadId = targetLead.id || (targetLead as any)._id;
        await leadService.update(leadId, { paymentStatus: 'Fully Paid' } as any).catch(() => {});
      }
      const regPlot = (regRes && (regRes as any).data) ? (regRes as any).data : updatedPlot;
      setPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? regPlot : p));
      setGridPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? regPlot : p));
      setBulkPlots(prev => prev.map(p => (p.id || (p as any)._id) === plotId ? regPlot : p));
      fetchGridPlots(gridPlotPage);
      setSelectedPlot(regPlot);

      // Assign post-registration tasks to the staff who booked/handled the plot/lead; fallback to admin if no staff or booked by admin
      let assigneeId: string | undefined = undefined;
      let assigneeInitials = 'AD';

      let resolvedLead = targetLead;
      const leadIdCandidate = (selectedPlot.bookedBy as any)?.leadId || (selectedPlot.pendingApproval as any)?.leadId;

      if (!resolvedLead && leadIdCandidate) {
        try {
          const lRes = await leadService.getById(leadIdCandidate);
          resolvedLead = lRes.data || lRes;
        } catch (e) {}
      }

      if (!resolvedLead && plotId) {
        const matchedByPlotId = projectLeads.find(l => {
          const lPlotId = typeof l.plotId === 'object' ? (l.plotId as any)?._id || (l.plotId as any).id : l.plotId;
          return String(lPlotId) === String(plotId);
        });
        if (matchedByPlotId) resolvedLead = matchedByPlotId as any;
      }

      if (resolvedLead && resolvedLead.assignedTo) {
        const rawAssignedTo = resolvedLead.assignedTo;
        const aId = typeof rawAssignedTo === 'object' && rawAssignedTo !== null
          ? (rawAssignedTo._id || rawAssignedTo.id)
          : rawAssignedTo;
        const aName = resolvedLead.assignedToName || (typeof rawAssignedTo === 'object' && rawAssignedTo !== null ? rawAssignedTo.name : undefined);

        if (aId) {
          assigneeId = String(aId);
          assigneeInitials = aName
            ? String(aName).split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2)
            : 'ST';
        }
      }

      if (!assigneeId) {
        const staffIdCandidate = selectedPlot.assignedTo || (selectedPlot.bookedBy as any)?.staffId;
        const staffNameCandidate = (selectedPlot as any).assignedToName || (selectedPlot.bookedBy as any)?.staffName;
        if (staffIdCandidate) {
          assigneeId = String(staffIdCandidate);
          assigneeInitials = staffNameCandidate
            ? String(staffNameCandidate).split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2)
            : 'ST';
        } else {
          assigneeId = authUser?.id;
          assigneeInitials = authUser?.initials || 'AD';
        }
      }

      const cName = selectedPlot.bookedBy?.name || targetLead?.customerName || 'Customer';
      const cDispId = targetLead?.displayId;
      const lId = targetLead?.id || (targetLead as any)?._id;

      // Create 4 post-registration tasks
      const tasksToCreate = [
        {
          title: `Gift handover - Plot #${selectedPlot.plotNumber} (${project.name} [${project.displayId}])`,
          description: `Gift handover for customer ${cName} of Plot #${selectedPlot.plotNumber} in ${project.name} [${project.displayId}].`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: project.id || (project as any)._id,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Document handover - Plot #${selectedPlot.plotNumber} (${project.name} [${project.displayId}])`,
          description: `Document handover for customer ${cName} of Plot #${selectedPlot.plotNumber} in ${project.name} [${project.displayId}].`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: project.id || (project as any)._id,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Balance payment - Plot #${selectedPlot.plotNumber} (${project.name} [${project.displayId}])`,
          description: `Balance payment for customer ${cName} of Plot #${selectedPlot.plotNumber} in ${project.name} [${project.displayId}].`,
          status: 'To Do',
          priority: 'High',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: project.id || (project as any)._id,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        },
        {
          title: `Individual chitta and patta - Plot #${selectedPlot.plotNumber} (${project.name} [${project.displayId}])`,
          description: `Individual chitta and patta transfer for customer ${cName} of Plot #${selectedPlot.plotNumber} in ${project.name} [${project.displayId}].`,
          status: 'To Do',
          priority: 'Medium',
          assignee: assigneeId,
          assigneeInitials: assigneeInitials,
          project: project.id || (project as any)._id,
          customerName: cName,
          customerDisplayId: cDispId,
          leadId: lId,
          comments: [],
          createdAt: new Date().toISOString().split('T')[0],
        }
      ];

      const results = await Promise.allSettled(tasksToCreate.map(t => taskService.create(t)));
      const failures = results.filter(r => r.status === 'rejected');

      logActivity({ id: authUser?.id || '', name: authUser?.name || 'Admin', role: role || 'admin', initials: authUser?.initials }, `Registered plot #${selectedPlot.plotNumber}`, 'Status Change', 'Plot', plotId, `Plot #${selectedPlot.plotNumber}`);

      const { toast } = await import('sonner');
      if (failures.length === 0) {
        toast.success('Plot registered successfully! 4 post-registration tasks created.');
      } else {
        toast.warning(`Plot registered but ${failures.length} post-registration task(s) failed to create.`);
      }
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to register plot');
    } finally { setSaving(false); }
    setShowRegistrationForm(false);
    setRegistrationDate('');
  };

  const handleCancelBooking = async () => {
    if (!selectedPlot) return;
    if (saving) return;
    setSaving(true);
    try {
      const pid = selectedPlot.id || (selectedPlot as any)._id;
      const res = await plotService.cancelBooking(pid);
      let updatedPlot = res.data;
      const { toast } = await import('sonner');
      if (updatedPlot.status === 'Pending') {
        toast.success(`Cancellation request for Plot #${selectedPlot.plotNumber} has been sent for admin approval.`);
      } else {
        toast.success(`Booking for Plot #${selectedPlot.plotNumber} has been cancelled.`);
      }
      setPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      setGridPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      setBulkPlots(prev => prev.map(p => (p.id || (p as any)._id) === pid ? updatedPlot : p));
      fetchGridPlots(gridPlotPage);
      setSelectedPlot(updatedPlot);
    } catch (err: any) {
      const { toast } = await import('sonner');
      toast.error(err.message || 'Failed to cancel booking');
    } finally {
      setSaving(false);
      setShowBookingForm(false);
      setShowRegistrationForm(false);
    }
  };

  if (loading) return <DetailSkeletonPage />;

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Project not found</p>
        <Link to={`/${role}/projects`} className="text-brand-blue text-sm mt-2 inline-block">Back to Projects</Link>
      </div>
    );
  }

  const registered = projectPlotStats.Registered || 0;
  const booked = projectPlotStats.Booked || 0;
  const rawAvailable = projectPlotStats.Available || 0;
  const rawCanceled = (projectPlotStats.Cancelled || 0) + (projectPlotStats.Canceled || 0);
  const available = isPartner ? (rawAvailable + rawCanceled) : rawAvailable;
  const canceled = isPartner ? 0 : rawCanceled;
  const pending = projectPlotStats.Pending || 0;
  const displayTotalPlots = getProjectDisplayPlotTotal(project, projectPlotStats.total || 0);

  const tabs = isPartner ? [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'plotmap' as const, label: 'Plot Map' },
    { key: 'images' as const, label: 'Images' },
  ] : [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'plotmap' as const, label: 'Plot Map' },
    { key: 'images' as const, label: 'Images' },
    { key: 'seller' as const, label: 'Seller Details' },
    { key: 'broadcast' as const, label: 'WhatsApp Broadcast' },
  ];


  const templateOptions = [
    { id: 'site-visit', label: 'Site Visit Invite', text: 'Hi, sharing the latest project update for @location. Please confirm your preferred visit slot.' },
    { id: 'plot-availability', label: 'Plot Availability', text: 'Good news. Select plots are currently available in @location. Would you like us to reserve a visit?' },
    { id: 'document-reminder', label: 'Document Reminder', text: 'Please share the pending documents so we can move your booking request forward.' },
    { id: 'location-share', label: 'Location Share', text: 'Here is the project location: @location. Our team will guide you once you arrive.' },
  ];

  return (
    <div className="animate-fadeIn">
      {/* Breadcrumb */}
      <div className="mb-2">
        <Link to={`/${role}/projects`} className="text-sm text-brand-blue hover:underline">Projects</Link>
        <span className="text-sm text-slate-400 mx-2">&gt;</span>
        <span className="text-sm text-slate-700"><NameTag name={project.name} displayId={project.displayId} /></span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-[28px] font-bold text-slate-900"><NameTag name={project.name} displayId={project.displayId} /></h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatusBadge status={project.status} />
            <span className="flex items-center gap-1 text-sm text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
              <MapPin size={13} /> {project.location}
            </span>
            {project.latitude && project.longitude && (
              <button
                onClick={() => setMapOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                title="View on Map"
              >
                <MapIcon size={12} /> View Map
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setExportInfo({ endpoint: '/export/project-detail', filename: 'project-detail', params: { id } });
                setTimeout(() => triggerDownload(), 50);
              }}
              className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-md text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              title="Export all project, plot, booking, customer and staff details"
            >
              <Download size={15} /> Export
            </button>
          )}
          <button
            type="button"
            onClick={() => setShareLocationOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
            title="Share Land Location Link to Leads via WhatsApp"
          >
            <Share2 size={15} />
            <span>Share Location</span>
          </button>
          {activeTab === 'overview' && isAdmin && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (!project || !id) return;
                setDeleteConfirm({
                  open: true,
                  title: 'Delete Project',
                  message: `Are you sure you want to permanently delete "${project.name}"? This will also remove all associated plots and cannot be undone.`,
                  onConfirm: async () => {
                    try {
                      await projectService.delete(id);
                      toast.success(`Project "${project.name}" deleted successfully`);
                      navigate(`/${role}/projects`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to delete project');
                    }
                  },
                });
              }}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-md text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              title="Delete this project permanently"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
        {activeTab === 'plotmap' && isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const pendingCount = projectPlotStats.Pending || 0;
              return (
                <button
                  type="button"
                  onClick={() => setApprovalsModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold border transition-all ${
                    pendingCount > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="View Pending Approvals"
                >
                  <Clock3 size={15} className={pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
                  <span>Approvals</span>
                  <span className={`px-2 py-0.5 text-xs font-extrabold rounded-full ${
                    pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pendingCount}
                  </span>
                </button>
              );
            })()}
            <button
              onClick={() => setBulkEditOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
            >
              <Pencil size={14} /> Edit Plots
            </button>
          </div>
        )}
        {activeTab === 'images' && isAdmin && (
          <button
            onClick={() => {
              setEditPlotImages((project?.plotImages || []).filter(Boolean));
              setEditProjectImages((project?.images || []).filter(Boolean));
              setImagesEditOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} /> Upload Images
          </button>
        )}

        {activeTab === 'broadcast' && isAdmin && (
          <button
            onClick={() => {
              setMessageTemplate('site-visit');
              setBroadcastMessage('Hi, sharing the latest project update for @location. Please confirm your preferred visit slot.');
              setBroadcastAttachment(null);
              setSelectedRecipients([]);
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Pencil size={14} /> New Message
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${activeTab === tab.key
                ? 'border-brand-green text-brand-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left - Details */}
          <div className="flex-[3] bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Project Details</h3>
            <div className="divide-y divide-slate-50">
              {[
                ['Project Name', <NameTag key="pn" name={project.name} displayId={project.displayId} />],
                ['Location', project.location],
                ['Status', ''],
                ...(!isPartner ? [['Project Category', project.category || 'Open Plots'] as [string, any]] : []),
                ['Description', project.description],
                ['Total Land Area', `${project.totalLandArea} ${project.landAreaUnit}`],
                ...(!isPartner ? [['Survey Number', project.surveyNumber || '—'] as [string, any]] : []),
                ...(!isPartner ? [['DTCP Number', project.dtcpNumber || '—'] as [string, any]] : []),
                ['Village', project.village],
                ['Mandal', project.mandal],
                ['District', project.district],
                ['Land Type', project.landType],
                ['Total Plots', String(displayTotalPlots)],
              ].map(([label, value], i) => (
                <div key={label} className={`flex justify-between py-3 px-2 ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-slate-800 text-right max-w-[60%] font-medium">
                    {label === 'Status' ? <StatusBadge status={project.status} /> : value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Stats */}
          <div className="flex-[2] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Plots', value: displayTotalPlots, icon: <LayoutGrid size={22} className="text-white" />, gradient: 'bg-gradient-to-br from-blue-600 to-indigo-500 shadow-blue-500/20' },
                { label: 'Available', value: available, icon: <Circle size={22} className="text-white" strokeWidth={2.5} />, gradient: 'bg-gradient-to-br from-slate-600 to-slate-500 shadow-slate-500/20' },
                { label: 'Booked', value: booked, icon: <CheckCircle size={22} className="text-white" />, gradient: 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20' },
                { label: 'Registered', value: registered, icon: <FileText size={22} className="text-white" />, gradient: 'bg-gradient-to-br from-blue-600 to-cyan-500 shadow-blue-500/20' },
                ...(!isPartner ? [{ label: 'Cancelled', value: canceled, icon: <Ban size={22} className="text-white" />, gradient: 'bg-gradient-to-br from-slate-500 to-zinc-600 shadow-slate-500/20' }] : []),
                { label: 'Pending', value: pending, icon: <Clock3 size={22} className="text-white" />, gradient: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/20' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-4 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${stat.gradient} shadow-md flex items-center justify-center shrink-0`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900 leading-none">{stat.value}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plotmap' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Interactive Plot Availability Grid</h3>
            <div className="flex flex-wrap gap-4 mb-4">
              {[
                { color: 'bg-white border border-slate-350', label: 'Available' },
                { color: 'bg-green-500', label: 'Booked' },
                { color: 'bg-blue-600', label: 'Registered' },
                ...(!isPartner ? [{ color: 'bg-slate-400', label: 'Cancelled' }] : []),
                { color: 'bg-amber-400', label: 'Pending' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className="text-xs text-slate-600">{l.label}</span>
                </div>
              ))}
            </div>

            {gridLoading ? (
              <div className="flex items-center justify-center py-20 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-sm font-medium text-slate-500">Loading plots...</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                {gridPlots.map(plot => {
                  const isCancelled = plot.status === 'Canceled' || plot.status === 'Cancelled';
                  const effectiveStatus = (isPartner && isCancelled) ? 'Available' : plot.status;
                  const style = plotStatusStyles[effectiveStatus] || plotStatusStyles.Available;
                  return (
                    <button
                      key={plot.id || (plot as any)._id}
                      onClick={() => {
                        if (!isPartner) setSelectedPlot(plot);
                      }}
                      className={`relative w-full aspect-square rounded-md flex items-center justify-center text-sm font-semibold transition-all ${
                        !isPartner ? 'hover:scale-105 hover:shadow-md cursor-pointer' : 'cursor-default'
                      } ${style.bg} ${style.textCol}`}
                    >
                      {plot.plotNumber}
                    </button>
                  );
                })}
              </div>
            )}

            {gridTotalPages > 1 && (
              <PaginationControls
                currentPage={gridPlotPage}
                totalPages={gridTotalPages}
                onPageChange={(page) => {
                  setGridPlotPage(page);
                  fetchGridPlots(page);
                }}
                totalCount={gridTotalPlots}
                perPage={50}
                itemName="plots"
                className="mt-4"
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'images' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Plot Sketch Images</h3>
            </div>
            {(!project.plotImages || project.plotImages.filter(Boolean).length === 0) ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <ImageOff className="text-slate-300 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-500">No plot sketch images available</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {(project.plotImages || []).filter(Boolean).map((imgName, i) => (
                  <div
                    key={imgName}
                    onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                    className="group aspect-[4/3] bg-amber-50 rounded-lg flex flex-col items-center justify-center hover:shadow-md transition-all overflow-hidden relative p-0 text-center border border-amber-100 cursor-pointer"
                  >
                    {imgName.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center w-full h-full p-3">
                        <FileText size={24} className="text-amber-500 mb-1.5" />
                        <span className="text-[10px] text-amber-700 font-semibold truncate max-w-full">{imgName.split('/').pop()}</span>
                      </div>
                    ) : (
                      <img src={getFileUrl(imgName)} alt="Plot Sketch" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">View</span>
                    </div>
                    {/* Action buttons (Download & Delete) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFileDirectly(getFileUrl(imgName), imgName.split('/').pop());
                        }}
                        className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md transition-all shadow-md"
                        title="Download Image"
                      >
                        <Download size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({
                              open: true,
                              title: 'Delete Plot Sketch Image',
                              message: 'Are you sure you want to delete this plot sketch image? This action cannot be undone.',
                              onConfirm: async () => {
                                if (!project) return;
                                const pid = project.id || (project as any)._id;
                                const updatedList = (project.plotImages || []).filter(img => img !== imgName);
                                try {
                                  await projectService.update(pid, { plotImages: updatedList });
                                  setProject(prev => prev ? { ...prev, plotImages: updatedList } : prev);
                                  const { toast } = await import('sonner');
                                  toast.success('Plot sketch image deleted');
                                } catch (err: any) {
                                  const { toast } = await import('sonner');
                                  toast.error(err.message || 'Failed to delete image');
                                }
                              }
                            });
                          }}
                          className="p-1.5 bg-rose-600/85 hover:bg-rose-700 text-white rounded-md transition-all shadow-md"
                          title="Delete Image"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Project Images</h3>
            </div>
            {(!project.images || project.images.filter(Boolean).length === 0) ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <ImageOff className="text-slate-300 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-500">No project images available</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {(project.images || []).filter(Boolean).map((imgName, i) => (
                  <div
                    key={i}
                    onClick={() => { setLightboxIndex((project.plotImages?.length || 0) + i); setLightboxOpen(true); }}
                    className="group aspect-[4/3] bg-gradient-to-br from-blue-50 to-slate-100 rounded-lg flex flex-col items-center justify-center hover:shadow-md transition-all overflow-hidden relative p-0 text-center border border-slate-200 cursor-pointer"
                  >
                    {imgName.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center w-full h-full p-3">
                        <FileText size={24} className="text-slate-300 mb-1.5" />
                        <span className="text-[10px] text-slate-400 font-semibold truncate max-w-full">{imgName.split('/').pop()}</span>
                      </div>
                    ) : (
                      <img src={getFileUrl(imgName)} alt="Project" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">View</span>
                    </div>
                    {/* Action buttons (Download & Delete) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFileDirectly(getFileUrl(imgName), imgName.split('/').pop());
                        }}
                        className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md transition-all shadow-md"
                        title="Download Image"
                      >
                        <Download size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({
                              open: true,
                              title: 'Delete Project Image',
                              message: 'Are you sure you want to delete this project image? This action cannot be undone.',
                              onConfirm: async () => {
                                if (!project) return;
                                const pid = project.id || (project as any)._id;
                                const updatedList = (project.images || []).filter(img => img !== imgName);
                                try {
                                  await projectService.update(pid, { images: updatedList });
                                  setProject(prev => prev ? { ...prev, images: updatedList } : prev);
                                  const { toast } = await import('sonner');
                                  toast.success('Project image deleted');
                                } catch (err: any) {
                                  const { toast } = await import('sonner');
                                  toast.error(err.message || 'Failed to delete image');
                                }
                              }
                            });
                          }}
                          className="p-1.5 bg-rose-600/85 hover:bg-rose-700 text-white rounded-md transition-all shadow-md"
                          title="Delete Image"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'seller' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Seller Details</h3>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingSellerIndex(null);
                  setNewSellerName('');
                  setNewSellerPhone('');
                  setNewSellerEmail('');
                  setNewSellerAddress('');
                  setNewSellerDocs([]);
                  setAddSellerOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all"
              >
                <Plus size={14} /> Add New Seller
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(project.sellers || (project.owner ? [project.owner] : [])).map((seller: any, sIdx: number) => (
              <div key={sIdx} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-800 text-sm">Seller {sIdx + 1}: {seller.name}</h4>
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditingSellerIndex(sIdx);
                          setNewSellerName(seller.name);
                          setNewSellerPhone(seller.phone || '');
                          setNewSellerEmail(seller.email || '');
                          setNewSellerAddress(seller.address || '');
                          setNewSellerDocs(seller.kycDocuments?.map((d: any) => d.name) || []);
                          setAddSellerOpen(true);
                        }}
                        className="text-xs font-semibold text-brand-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setSellerToDelete({ idx: sIdx, name: seller.name })}
                        className="text-xs font-semibold text-rose-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Phone</span>
                    <span className="font-semibold text-slate-800">{seller.phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Email</span>
                    <span className="font-semibold text-slate-800 truncate block">{seller.email || 'Not provided'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Address</span>
                    <span className="font-semibold text-slate-800 block">{seller.address || 'Not provided'}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Seller KYC / Account Details</span>
                    {isAdmin && (
                      <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-green text-white rounded-md text-xs font-semibold hover:bg-brand-darkgreen active:scale-[0.98] transition-all cursor-pointer ${uploadingDocIdx === sIdx ? 'opacity-60 pointer-events-none' : ''}`}>
                        {uploadingDocIdx === sIdx ? (
                          <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload size={12} /> Upload PDF</>
                        )}
                        <input type="file" accept=".pdf" multiple className="hidden" disabled={uploadingDocIdx === sIdx} onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setUploadingDocIdx(sIdx);
                          try {
                            const { uploadService } = await import('@/services/uploads');
                            const res = await uploadService.upload('kyc', files);
                            const newDocs = (res.data || []).map((f: any) => ({
                              id: f.id,
                              name: f.originalName || f.filename,
                              path: f.path,
                              type: 'PDF' as const,
                              uploadedAt: new Date().toISOString().split('T')[0],
                            }));
                            const sellers = [...(project.sellers || (project.owner ? [project.owner] : []))];
                            sellers[sIdx] = { ...sellers[sIdx], kycDocuments: [...(sellers[sIdx].kycDocuments || []), ...newDocs] };
                            const pid = project.id || (project as any)._id;
                            await projectService.update(pid, { sellers, owner: sellers[0] } as any);
                            setProject(prev => prev ? { ...prev, sellers, owner: sellers[0] } : prev);
                            import('sonner').then(m => m.toast.success('Document uploaded successfully'));
                          } catch (err: any) {
                            import('sonner').then(m => m.toast.error(err?.message || 'Failed to save KYC details'));
                          } finally {
                            setUploadingDocIdx(null);
                            e.target.value = '';
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  {/* Upload progress overlay */}
                  {uploadingDocIdx === sIdx && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-green/10 border border-brand-green/30 rounded-md mb-2">
                      <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="text-xs font-medium text-brand-green">Uploading document... please wait</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(seller.kycDocuments || []).map((doc: any) => {
                      const docUrl = doc.path ? getFileUrl(doc.path) : getFileUrl(doc.name);
                      const displayName = getCleanDocName(doc.name, doc.path);
                      return (
                        <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-md gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 truncate font-medium">{displayName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                const rawUrl = doc.path ? getFileUrl(doc.path) : getFileUrl(doc.name);
                                setDocLoading(true);
                                try {
                                  const blob = await api.getBlob(rawUrl);
                                  const blobUrl = URL.createObjectURL(blob);
                                  setViewDoc({ name: displayName, url: blobUrl, rawUrl });
                                } catch {
                                  setViewDoc({ name: displayName, url: rawUrl, rawUrl });
                                } finally {
                                  setDocLoading(false);
                                }
                              }}
                              className="text-[10px] font-semibold text-brand-blue hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setDocToDelete({ sellerIdx: sIdx, docId: doc.id, docName: displayName, docPath: doc.path })}
                              className="text-[10px] font-semibold text-rose-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(!seller.kycDocuments || seller.kycDocuments.length === 0) && (
                      <span className="text-xs text-slate-400 italic">No KYC/Account details uploaded.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(project.sellers || (project.owner ? [project.owner] : [])).length === 0 && (
              <div className="col-span-2 text-center py-12 bg-white rounded-lg border border-slate-200">
                <p className="text-sm text-slate-400">No sellers registered for this project yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      <Modal
        open={!!viewDoc}
        onClose={() => {
          if (viewDoc?.url?.startsWith('blob:')) URL.revokeObjectURL(viewDoc.url);
          setViewDoc(null);
        }}
        title={viewDoc?.name || 'Document'}
        size="xl"
        footer={
          viewDoc ? (
            <div className="flex justify-between items-center w-full">
              <a
                href={viewDoc.rawUrl || viewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <ExternalLink size={13} /> Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => {
                  if (viewDoc?.url?.startsWith('blob:')) URL.revokeObjectURL(viewDoc.url);
                  setViewDoc(null);
                }}
                className="px-4 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          ) : null
        }
      >
        <div className="relative bg-slate-50 rounded-lg overflow-hidden" style={{ minHeight: '70vh' }}>
          {docLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-3">
              <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-500 font-medium">Loading document...</span>
            </div>
          )}
          {viewDoc && !docLoading && (
            /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(viewDoc.name) ? (
              <img
                src={viewDoc.url}
                alt={viewDoc.name}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm mx-auto block"
              />
            ) : (
              <embed
                key={viewDoc.url}
                src={viewDoc.url}
                type="application/pdf"
                width="100%"
                style={{ height: '70vh', display: 'block' }}
              />
            )
          )}
        </div>
      </Modal>

      {/* Delete Document Confirmation Modal */}
      <Modal
        open={!!docToDelete}
        onClose={() => { if (!deletingDoc) setDocToDelete(null); }}
        title="Delete Document"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDocToDelete(null)}
              disabled={deletingDoc}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={deletingDoc}
              onClick={async () => {
                if (!docToDelete || !project) return;
                setDeletingDoc(true);
                try {
                  // Step 1: Delete file from S3 bucket
                  if (docToDelete.docPath) {
                    // Extract category and filename from the stored path
                    // Paths are like: /api/v1/uploads/kyc/filename.pdf or /api/v1/uploads/file/kyc/filename.pdf
                    const pathMatch = docToDelete.docPath.match(/\/uploads(?:\/file)?\/([^/]+)\/(.+)$/);
                    if (pathMatch) {
                      const [, category, filename] = pathMatch;
                      try {
                        await api.delete(`/uploads/${category}/${filename}`);
                      } catch (s3Err) {
                        // Log but don't block DB cleanup if S3 delete fails
                        console.warn('S3 delete warning:', s3Err);
                      }
                    }
                  }

                  // Step 2: Remove from seller kycDocuments in DB
                  const sellers = [...(project.sellers || (project.owner ? [project.owner] : []))];
                  const seller = sellers[docToDelete.sellerIdx];
                  if (seller) {
                    const updatedDocs = (seller.kycDocuments || []).filter((d: any) => d.id !== docToDelete.docId);
                    sellers[docToDelete.sellerIdx] = { ...seller, kycDocuments: updatedDocs };
                    await persistSellerChanges(sellers);
                  }
                  setDocToDelete(null);
                  import('sonner').then(m => m.toast.success('Document deleted successfully'));
                } catch (err: any) {
                  import('sonner').then(m => m.toast.error(err?.message || 'Failed to delete document'));
                } finally {
                  setDeletingDoc(false);
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {deletingDoc ? 'Deleting...' : 'Delete Document'}
            </button>
          </>
        }
      >
        <div className="relative">
          {/* Delete in-progress overlay */}
          {deletingDoc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 rounded-lg gap-3">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-red-600">Deleting document...</span>
            </div>
          )}
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Delete this document?</p>
              <p className="text-xs text-red-600 mt-0.5 break-all">{docToDelete?.docName}</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Seller Confirmation Dialog */}
      <ConfirmDialog
        open={!!sellerToDelete}
        onClose={() => setSellerToDelete(null)}
        onConfirm={handleDeleteSeller}
        title="Delete Seller"
        message={`Are you sure you want to delete Seller "${sellerToDelete?.name || ''}"? This will remove the seller and their associated details from this project.`}
        confirmText="Delete Seller"
        confirmVariant="danger"
        zIndex="z-[2000]"
      />

      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-base font-semibold text-slate-900">Recipients</h3>
              <span className="text-xs text-slate-400 font-bold">{selectedRecipients.length} selected</span>
            </div>

            {/* Recipient Search and Status Filter */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={broadcastSearch}
                  onChange={e => setBroadcastSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-md text-xs focus:border-brand-green outline-none"
                />
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Filter by Status</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { value: 'All', label: 'All' },
                    { value: 'Qualified Customer', label: 'Customer' },
                    { value: 'Lead', label: 'Qualified Lead' },
                    { value: 'Open Lead', label: 'Open Lead' },
                  ].map(opt => {
                    const isChecked = broadcastStatusFilters.includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (opt.value === 'All') {
                              setBroadcastStatusFilters(['All']);
                            } else {
                              setBroadcastStatusFilters(prev => {
                                let next = prev.filter(v => v !== 'All');
                                if (isChecked) {
                                  next = next.filter(v => v !== opt.value);
                                  if (next.length === 0) next = ['All'];
                                } else {
                                  next = [...next, opt.value];
                                }
                                return next;
                              });
                            }
                          }}
                          className="rounded border-slate-350 text-brand-blue w-3.5 h-3.5"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Select All Action */}
            <div className="flex items-center justify-between mb-3 px-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filteredRecipients.length > 0 && filteredRecipients.every(r => selectedRecipients.includes(r.id))}
                  onChange={e => handleSelectAllFiltered(e.target.checked)}
                  className="rounded border-slate-300 text-brand-blue w-3.5 h-3.5"
                />
                <span>Select All Filtered</span>
              </label>
              <button
                onClick={() => setSelectedRecipients([])}
                className="text-[10px] text-red-500 hover:underline font-bold"
              >
                Clear All
              </button>
            </div>

            {/* Recipient list */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {filteredRecipients.map(recipient => {
                const checked = selectedRecipients.includes(recipient.id);
                return (
                  <label key={recipient.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedRecipients(prev => checked ? prev.filter(id => id !== recipient.id) : [...prev, recipient.id]);
                      }}
                      className="rounded border-slate-300 text-brand-blue"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{recipient.name}</p>
                      <p className="text-[10px] text-slate-400">{recipient.phone}</p>
                    </div>
                    <StatusBadge status={recipient.status} size="sm" />
                  </label>
                );
              })}
              {filteredRecipients.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">No leads or customers match these filters.</div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-brand-blue" />
                <h3 className="text-base font-semibold text-slate-900">WhatsApp Broadcast</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Template</label>
                  <select
                    value={messageTemplate}
                    onChange={e => {
                      const selected = templateOptions.find(t => t.id === e.target.value);
                      setMessageTemplate(e.target.value);
                      if (selected) setBroadcastMessage(selected.text);
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none"
                  >
                    {templateOptions.map(template => (
                      <option key={template.id} value={template.id}>{template.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Attachment</label>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentPicker(true)}
                    className="w-full h-10 border border-dashed border-slate-300 rounded-md text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-brand-blue flex items-center justify-center gap-2"
                  >
                    <Upload size={15} /> {broadcastAttachment ? `Selected: ${broadcastAttachment}` : 'Select attachment...'}
                  </button>
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                className="w-full min-h-[120px] p-4 border border-slate-200 rounded-lg text-sm focus:border-brand-green outline-none resize-y"
              />
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setBroadcastMessage(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}@location`)}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs font-semibold"
                >
                  <MapPin size={12} /> Insert @location
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastMessage(prev => `${prev}${prev.endsWith(' ') ? '' : ' '}Plot layout is attached.`)}
                  className="inline-flex items-center gap-1.5 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <LayoutGrid size={12} /> Add plot note
                </button>
              </div>

              {/* WhatsApp chat-style preview panel */}
              <div className="mt-5 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-[#075e54] text-white px-4 py-2 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#128c7e] text-white flex items-center justify-center text-xs font-bold font-sans">WA</div>
                  <div>
                    <p className="text-xs font-bold leading-tight">WhatsApp Broadcast Preview</p>
                    <p className="text-[10px] text-emerald-100 leading-tight">{selectedRecipients.length} recipients selected</p>
                  </div>
                </div>
                <div className="bg-[#efeae2] p-4 min-h-[220px] flex flex-col justify-end relative bg-repeat" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'overlay', backgroundColor: '#efeae2' }}>
                  <div className="max-w-[85%] self-end bg-[#d9fdd3] rounded-lg p-2.5 shadow-sm text-xs border border-[#e1f3d8] relative mt-2 mb-2 pr-10 pb-6">
                    {broadcastAttachment && (
                      <div className="bg-slate-100 text-slate-700 rounded-md p-3 mb-2 flex flex-col items-center justify-center font-semibold border border-slate-200">
                        <FileText size={24} className="text-slate-400 mb-1" />
                        <span className="text-[11px] truncate w-full text-center">{broadcastAttachment}</span>
                      </div>
                    )}
                    <p className="text-[12px] text-slate-800 whitespace-pre-wrap font-sans">
                      {broadcastMessage.replace('@location', `${project.name} [${project.displayId}], ${project.location}`)}
                    </p>
                    <div className="absolute bottom-1 right-2 flex items-center gap-1 select-none">
                      <span className="text-[9px] text-slate-400 font-medium">17:59</span>
                      <span className="text-blue-500 font-bold flex leading-none text-[10px]" title="Delivered and read">
                        ✓✓
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end mt-5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedRecipients.length === 0) return;
                    setBroadcasting(true);
                    let successCount = 0;
                    let failCount = 0;
                    const { toast } = await import('sonner');
                    const toastId = toast.loading(`Sending broadcast to ${selectedRecipients.length} recipients...`);
                    
                    for (const rId of selectedRecipients) {
                      const recipient = recipients.find(r => r.id === rId);
                      if (!recipient) continue;
                      
                      try {
                        let msgText = broadcastMessage;
                        if (project) {
                          msgText = msgText.replace(/@location/g, `${project.name} [${project.displayId}], ${project.location}`);
                        }
                        
                        await whatsappService.send({
                          phone: recipient.phone,
                          message: msgText,
                          type: 'text'
                        });
                        successCount++;
                      } catch (err) {
                        console.error(`Failed to send broadcast to ${recipient.name}`, err);
                        failCount++;
                      }
                    }
                    
                    setBroadcasting(false);
                    setSelectedRecipients([]);
                    
                    if (failCount === 0) {
                      toast.success(`Broadcast successfully sent to all ${successCount} recipients!`, { id: toastId });
                    } else {
                      toast.info(`Broadcast completed. Sent: ${successCount}, Failed: ${failCount}`, { id: toastId });
                    }
                  }}
                  disabled={selectedRecipients.length === 0 || broadcasting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  <Send size={15} /> {broadcasting ? 'Broadcasting...' : 'Send WhatsApp Message'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plot Detail Drawer */}
      <Drawer
        open={!!selectedPlot && !isPartner}
        onClose={() => {
          setSelectedPlot(null);
          setIsEditingPlot(false);
          setEditedPlot(null);
          setShowBookingForm(false);
          setShowRegistrationForm(false);
        }}
        title={selectedPlot ? `Plot #${selectedPlot.plotNumber}` : ''}
      >
        {selectedPlot && (
          <div className="space-y-6">
            {/* Plot info section */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedPlot.status} />
                {isAdmin && !isEditingPlot && selectedPlot.status !== 'Available' && (
                  <button onClick={handleEditPlotClick} className="text-xs text-brand-blue hover:underline font-bold">Edit Plot Details</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[9px]">Facing</span>
                  <span className="font-semibold text-slate-800">{selectedPlot.facing || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[9px]">Size</span>
                  <span className="font-semibold text-slate-800">{selectedPlot.size} {selectedPlot.sizeUnit}</span>
                </div>
                {selectedPlot.docNumber && (
                  <div className="col-span-2">
                    <span className="block text-slate-400 font-bold uppercase text-[9px]">Document No</span>
                    <span className="font-semibold text-slate-800">{selectedPlot.docNumber}</span>
                  </div>
                )}
                {selectedPlot.isQuarantined && (
                  <div className="col-span-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <span className="font-bold block uppercase text-[10px] text-amber-900 mb-0.5">⚠️ Data Quarantine Notice</span>
                    {selectedPlot.quarantineNotes || 'This plot has conflicting source records and is quarantined pending client review.'}
                  </div>
                )}
              </div>
            </div>

            {/* Approval Request Section (if Pending approval) */}
            {selectedPlot.status === 'Pending' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
                {(() => {
                  const isCancellationReq = selectedPlot.pendingApproval?.requestType === 'cancellation';
                  return (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-white text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 font-bold text-xs select-none">
                          P
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-amber-900">
                            {isCancellationReq ? 'Pending Cancellation Approval' : 'Pending Booking Approval'}
                          </h4>
                          <p className="text-xs text-amber-800 mt-0.5">
                            {isCancellationReq
                              ? 'Cancellation request is waiting for admin decision.'
                              : 'Booking request is waiting for admin decision.'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="block text-amber-700 font-bold uppercase text-[10px]">Customer</span>
                          {selectedPlot.pendingApproval?.leadId ? (
                            <Link to={`/${role}/leads/${selectedPlot.pendingApproval.leadId}`} onClick={() => setSelectedPlot(null)} className="font-bold text-brand-blue hover:underline">
                              {selectedPlot.pendingApproval.customerName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-900">{selectedPlot.pendingApproval?.customerName || selectedPlot.bookedBy?.name || 'N/A'}</span>
                          )}
                        </div>
                        <div>
                          <span className="block text-amber-700 font-bold uppercase text-[10px]">Phone</span>
                          <span className="font-semibold text-slate-900">{selectedPlot.pendingApproval?.phone || selectedPlot.bookedBy?.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-amber-700 font-bold uppercase text-[10px]">Requested By (Staff)</span>
                          <span className="font-semibold text-slate-900">{selectedPlot.pendingApproval?.requestedBy || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-amber-700 font-bold uppercase text-[10px]">Request Date</span>
                          <span className="font-semibold text-slate-900">{selectedPlot.pendingApproval?.requestedAt ? new Date(selectedPlot.pendingApproval.requestedAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        {!isCancellationReq && (
                          <div className="col-span-2">
                            <span className="block text-amber-700 font-bold uppercase text-[10px]">Payment</span>
                            <span className="font-semibold text-slate-900">{selectedPlot.pendingApproval?.paymentStatus || 'N/A'}</span>
                          </div>
                        )}
                      </div>
                      {isAdmin ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleApproval('approve')} disabled={saving} className="inline-flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            <CheckCircle size={14} /> {isCancellationReq ? 'Approve Cancellation' : 'Approve Booking'}
                          </button>
                          <button onClick={() => handleApproval('reject')} disabled={saving} className="inline-flex items-center justify-center gap-1.5 py-2 bg-white border border-red-200 text-red-600 rounded text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                            <Ban size={14} /> {isCancellationReq ? 'Reject Cancellation' : 'Reject Booking'}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2.5 bg-amber-100/50 rounded-md text-amber-800 text-xs font-bold border border-amber-200">
                          Waiting for Admin Approval
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Available Action: Book Plot Form */}
            {(selectedPlot.status === 'Available' || selectedPlot.status === 'Canceled' || selectedPlot.status === 'Cancelled') && (
              <div>
                {!showBookingForm ? (
                  <button
                    onClick={() => {
                      setShowBookingForm(true);
                      setSelectedCustomer(null);
                      setBookingCustomerSearch('');
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold active:scale-[0.98] transition-all"
                  >
                    Book Plot
                  </button>
                ) : (
                  <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-emerald-700">New Booking Confirmation</h4>

                    {!selectedCustomer ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-600">Search Lead (Name, Mobile, or ID)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowBookingForm(false);
                              setSelectedCustomer(null);
                              setBookingCustomerSearch('');
                            }}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Search by name, mobile number or ID..."
                          value={bookingCustomerSearch}
                          onChange={e => setBookingCustomerSearch(e.target.value)}
                          className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-brand-green outline-none"
                        />
                        {bookingCustomerSearch.trim().length > 0 && (
                          <div className="border border-slate-150 rounded-md mt-1 bg-white shadow-sm max-h-48 overflow-y-auto divide-y divide-slate-50">
                            {isSearchingLeads ? (
                              <div className="px-3 py-2 text-xs text-slate-400 text-center">Searching...</div>
                            ) : searchedLeads.length > 0 ? (
                              searchedLeads.map(cust => (
                                <button
                                  key={cust.id || (cust as any)._id}
                                  type="button"
                                  onClick={() => setSelectedCustomer(cust)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">{cust.customerName}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({cust.displayId || cust.id})</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      cust.status === 'Customer' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {cust.status}
                                    </span>
                                  </div>
                                  <span className="text-slate-500 font-mono">{cust.phone}</span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-xs text-slate-400 text-center">No Qualified or Customer leads found matching "{bookingCustomerSearch.trim()}"</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-white border border-slate-150 rounded px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{selectedCustomer.customerName}</p>
                            <p className="text-[10px] text-slate-500">{selectedCustomer.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(null)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Change
                          </button>
                        </div>
                        {((Array.isArray(selectedCustomer.plotIds) && selectedCustomer.plotIds.length > 0) || selectedCustomer.plotId) && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>
                              This customer already has other booked or pending plot(s). Confirming adds another booking and does not release existing sites.
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Registration Date</label>
                          <input
                            type="date"
                            value={expectedRegistrationDate}
                            onChange={e => setExpectedRegistrationDate(e.target.value)}
                            className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                            <select
                              value={paymentMode}
                              onChange={e => setPaymentMode(e.target.value)}
                              className="w-full h-9 px-2 border border-slate-200 rounded-md text-xs bg-white"
                            >
                              <option value="Loan">Loan</option>
                              <option value="Direct Cash">Direct Cash</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Advance Taken</label>
                            <select
                              value={advancePaymentStatus}
                              onChange={e => setAdvancePaymentStatus(e.target.value as any)}
                              className="w-full h-9 px-2 border border-slate-200 rounded-md text-xs bg-white"
                            >
                              <option value="Paid">Paid</option>
                              <option value="Not Paid">Not Paid</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => {
                              setShowBookingForm(false);
                              setSelectedCustomer(null);
                            }}
                            className="flex-1 py-1.5 border border-slate-200 text-slate-700 rounded text-xs font-medium bg-white hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleBookPlot}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold"
                          >
                            Confirm Booking
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Booked Action: Register or Cancel Booking */}
            {selectedPlot.status === 'Booked' && (
              <div className="space-y-2">
                {!showRegistrationForm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRegistrationForm(true)}
                      className="flex-1 py-2 bg-brand-green hover:bg-brand-darkgreen text-white rounded-md text-sm font-bold active:scale-[0.98] transition-all"
                    >
                      Register Plot (Registration)
                    </button>
                    <button
                      onClick={() => setConfirmCancelOpen(true)}
                      disabled={saving}
                      className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Cancel Booking
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/30 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-blue-700">Confirm Registration</h4>
                    {selectedPlot.bookedBy?.paymentStatus !== 'Fully Paid' && (
                      <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Warning:</strong> Payment status is <strong>{selectedPlot.bookedBy?.paymentStatus || 'Not Paid'}</strong>. You can select a registration date and proceed to confirm.
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Registration Date</label>
                      <input
                        type="date"
                        value={registrationDate}
                        onChange={e => setRegistrationDate(e.target.value)}
                        className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setShowRegistrationForm(false)}
                        className="flex-1 py-1.5 border border-slate-200 text-slate-700 rounded text-xs font-medium bg-white hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRegisterPlot}
                        disabled={!registrationDate}
                        className="flex-1 py-1.5 bg-brand-green text-white rounded text-xs font-bold hover:bg-brand-darkgreen disabled:opacity-50"
                      >
                        Confirm Register
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Plot Parameters Edit Form (if active) */}
            {isEditingPlot && editedPlot && (
              <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Edit Plot Parameters</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Plot Number</label>
                    <input
                      type="text"
                      value={editedPlot.plotNumber}
                      onChange={e => setEditedPlot({ ...editedPlot, plotNumber: e.target.value as any })}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                    <select
                      value={editedPlot.status}
                      onChange={e => setEditedPlot({ ...editedPlot, status: e.target.value as any })}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                    >
                      <option value="Available">Available</option>
                      <option value="Booked">Booked</option>
                      <option value="Registered">Registered</option>
                      <option value="Canceled">Canceled</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Facing</label>
                      <select
                        value={editedPlot.facing}
                        onChange={e => setEditedPlot({ ...editedPlot, facing: e.target.value })}
                        className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                      >
                        <option value="North">North</option>
                        <option value="North East">North East</option>
                        <option value="North West">North West</option>
                        <option value="South">South</option>
                        <option value="South East">South East</option>
                        <option value="South West">South West</option>
                        <option value="East">East</option>
                        <option value="West">West</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Size</label>
                      <input
                        type="number"
                        value={editedPlot.size}
                        onChange={e => setEditedPlot({ ...editedPlot, size: Number(e.target.value) })}
                        className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Size Unit</label>
                      <select
                        value={editedPlot.sizeUnit}
                        onChange={e => setEditedPlot({ ...editedPlot, sizeUnit: e.target.value })}
                        className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white"
                      >
                        <option value="Sq Yards">Sq Yards</option>
                        <option value="Sq Feet">Sq Feet</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    onClick={() => { setIsEditingPlot(false); setEditedPlot(null); }}
                    className="flex-1 py-1.5 border border-slate-200 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePlot}
                    className="flex-1 py-1.5 bg-brand-green text-white rounded-md text-xs font-medium hover:bg-brand-darkgreen transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Customer Details section above Timeline (for Booked/Registered plots) */}
            {(selectedPlot.status === 'Booked' || selectedPlot.status === 'Registered') && (
              (() => {
                const bookingLead = projectLeads.find(l => l.customerName === selectedPlot.bookedBy?.name || l.phone === selectedPlot.bookedBy?.phone);
                const assignedStaff = staffUsers.find(s => s.id === bookingLead?.assignedTo);

                return (
                  <div className="border-t border-slate-150 pt-4 space-y-4 animate-fadeIn">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Booking Confirmation Details</h4>
                    <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-100 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                        <span className="text-slate-400 font-semibold uppercase text-[9px]">Customer Name</span>
                        {bookingLead ? (
                          <Link to={`/${role}/leads/${bookingLead.id}`} onClick={() => setSelectedPlot(null)} className="font-bold text-brand-blue hover:underline">
                            {selectedPlot.bookedBy?.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-800">{selectedPlot.bookedBy?.name}</span>
                        )}
                      </div>
                      {bookingLead?.id && (
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                          <span className="text-slate-400 font-semibold uppercase text-[9px]">Customer ID</span>
                          <span className="font-semibold text-slate-800">{bookingLead.displayId || (bookingLead.id.startsWith('L') ? bookingLead.id : `L-${bookingLead.id.slice(-4).toUpperCase()}`)}</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                        <span className="text-slate-400 font-semibold uppercase text-[9px]">Phone</span>
                        <span className="font-semibold text-slate-800">{selectedPlot.bookedBy?.phone}</span>
                      </div>
                      {bookingLead?.email && (
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                          <span className="text-slate-400 font-semibold uppercase text-[9px]">Email</span>
                          <span className="font-semibold text-slate-800">{bookingLead.email}</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                        <span className="text-slate-400 font-semibold uppercase text-[9px]">Representative (Staff)</span>
                        {assignedStaff ? (
                          <Link to={`/admin/staff/${assignedStaff.id}`} onClick={() => setSelectedPlot(null)} className="font-bold text-brand-blue hover:underline">
                            {assignedStaff.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-550">{bookingLead?.assignedToName || 'Unassigned'}</span>
                        )}
                      </div>
                      {(assignedStaff?.id || bookingLead?.assignedTo) && (
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 border-b border-slate-200/50 gap-1">
                          <span className="text-slate-400 font-semibold uppercase text-[9px]">Staff ID</span>
                          <span className="font-semibold text-slate-800">
                            {assignedStaff?.displayId || bookingLead?.assignedToDisplayId || (assignedStaff?.id && assignedStaff.id.startsWith('STAFF') ? assignedStaff.id : `STAFF-${(assignedStaff?.id || bookingLead?.assignedTo || '').slice(-4).toUpperCase()}`)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-1 gap-1">
                        <span className="text-slate-400 font-semibold uppercase text-[9px]">Advance Payment Status</span>
                        <span className={`inline-flex items-center gap-1 font-bold ${selectedPlot.bookedBy?.paymentStatus === 'Fully Paid' ? 'text-emerald-600' :
                          selectedPlot.bookedBy?.paymentStatus === 'Partially Paid' ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                          {selectedPlot.bookedBy?.paymentStatus === 'Fully Paid' ? '✅ Paid' :
                            selectedPlot.bookedBy?.paymentStatus === 'Partially Paid' ? '⏳ Partial' : '❌ Not Paid'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Booking & Registration Timeline */}
            {selectedPlot.timeline.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Booking Timeline</h4>
                <div className="relative pl-4 space-y-4">
                  {selectedPlot.timeline.map((event, i) => {
                    const isCustomerActor = event.actorRole === 'Customer' || event.actorType === 'customer';
                    const staff = staffUsers.find(s => s.name === event.actor || s.id === event.actor);

                    // Clean details to remove customer name if present
                    let cleanDetails = event.details || '';
                    if (selectedPlot.bookedBy?.name) {
                      cleanDetails = cleanDetails.replace(new RegExp(`${selectedPlot.bookedBy.name}\\s*-\\s*`, 'gi'), '');
                      cleanDetails = cleanDetails.replace(new RegExp(selectedPlot.bookedBy.name, 'gi'), '');
                      cleanDetails = cleanDetails.replace(/^[\s\-\:\,]+|[\s\-\:\,]+$/g, '').trim();
                    }
                    if (selectedPlot.pendingApproval?.customerName) {
                      cleanDetails = cleanDetails.replace(new RegExp(`${selectedPlot.pendingApproval.customerName}\\s*-\\s*`, 'gi'), '');
                      cleanDetails = cleanDetails.replace(new RegExp(selectedPlot.pendingApproval.customerName, 'gi'), '');
                      cleanDetails = cleanDetails.replace(/^[\s\-\:\,]+|[\s\-\:\,]+$/g, '').trim();
                    }

                    // Determine dynamic action prefix, actor name, and role (always staff or admin name)
                    const actionPrefix = event.label?.toLowerCase().includes('approved')
                      ? 'Approved by:'
                      : event.label?.toLowerCase().includes('rejected')
                      ? 'Rejected by:'
                      : event.label?.toLowerCase().includes('registered')
                      ? 'Registered by:'
                      : (event.label?.toLowerCase().includes('cancel') || event.type === 'booking_canceled')
                      ? 'Canceled by:'
                      : event.label?.toLowerCase().includes('requested')
                      ? 'Requested by:'
                      : 'Booked by:';

                    const displayActor = isCustomerActor
                      ? (selectedPlot.pendingApproval?.requestedBy || authUser?.name || 'Staff')
                      : (event.actor && event.actor !== 'Customer' ? event.actor : (authUser?.name || (role === 'admin' ? 'Admin' : 'Staff')));

                    const displayRole = event.actorRole && event.actorRole !== 'Customer'
                      ? event.actorRole
                      : (event.actorType === 'admin' || event.label?.toLowerCase().includes('admin') || role === 'admin' ? 'Admin' : 'Staff');

                    const matchedStaff = staffUsers.find(s => s.name === displayActor || s.id === displayActor);

                    return (
                      <div key={event.id} className="relative pb-1 last:pb-0">
                        {i < selectedPlot.timeline.length - 1 && (
                          <div className="absolute left-[-15px] top-3.5 bottom-0 w-px bg-slate-200" />
                        )}
                        <div className="relative flex items-start gap-2">
                          <div className={`absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${event.color === 'green' ? 'bg-emerald-500' : event.color === 'blue' ? 'bg-blue-500' : event.color === 'amber' ? 'bg-amber-400' : 'bg-red-500'
                            }`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{event.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {actionPrefix}{' '}
                              {matchedStaff ? (
                                <Link to={`/admin/staff/${matchedStaff.id}`} onClick={() => setSelectedPlot(null)} className="text-brand-blue hover:underline font-semibold">
                                  {displayActor}
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-700">{displayActor}</span>
                              )}
                              <span className="ml-1 text-[10px] text-slate-400 font-semibold">({displayRole})</span>
                            </p>
                            {cleanDetails && <p className="text-xs text-slate-600 mt-0.5 bg-slate-50 p-2 rounded border border-slate-100">{cleanDetails}</p>}
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">{event.date}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Cancel Booking Confirmation Dialog */}
      <ConfirmDialog
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={() => {
          setConfirmCancelOpen(false);
          handleCancelBooking();
        }}
        title="Cancel Plot Booking"
        message={`Are you sure you want to cancel the booking for Plot #${selectedPlot?.plotNumber}? This action will revert the plot status to Available and release any linked customer lead.`}
        confirmText="Yes, Cancel Booking"
        variant="danger"
        isLoading={saving}
      />

      {/* Lightbox */}
      {lightboxOpen && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center animate-fadeIn" onClick={() => setLightboxOpen(false)}>
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={async () => {
                const allImages = [...(project?.plotImages || []), ...(project?.images || [])];
                const imgName = allImages[lightboxIndex];
                if (imgName) await downloadFileDirectly(getFileUrl(imgName), imgName.split('/').pop());
              }}
              className="flex items-center gap-1.5 bg-slate-800/85 hover:bg-slate-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-all border border-slate-700"
              title="Download Document"
            >
              <Download size={14} /> Download
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  if (!project) return;
                  const plotImgsCount = project.plotImages?.length || 0;
                  const isPlotImg = lightboxIndex < plotImgsCount;
                  const allImages = [...(project.plotImages || []), ...(project.images || [])];
                  const imgToDelete = allImages[lightboxIndex];
                  if (!imgToDelete) return;
                  
                  setDeleteConfirm({
                    open: true,
                    title: 'Delete Image',
                    message: 'Are you sure you want to delete this image? This action cannot be undone.',
                    onConfirm: async () => {
                      const pid = project.id || (project as any)._id;
                      const field = isPlotImg ? 'plotImages' : 'images';
                      const updatedList = (project[field] || []).filter(img => img !== imgToDelete);
                      try {
                        await projectService.update(pid, { [field]: updatedList });
                        setProject(prev => prev ? { ...prev, [field]: updatedList } : prev);
                        const { toast } = await import('sonner');
                        toast.success('Image deleted');
                        setLightboxOpen(false);
                      } catch (err: any) {
                        const { toast } = await import('sonner');
                        toast.error(err.message || 'Failed to delete image');
                      }
                    }
                  });
                }}
                className="flex items-center gap-1.5 bg-rose-600/85 hover:bg-rose-700 text-white px-3.5 py-2 rounded-md text-xs font-bold transition-all border border-rose-700"
                title="Delete Image"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}

            <button onClick={() => setLightboxOpen(false)} className="text-white/70 hover:text-white p-2 rounded hover:bg-white/10 transition-colors ml-1">
              <X size={24} />
            </button>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(Math.max(0, lightboxIndex - 1)); }}
            className="absolute left-4 text-white/70 hover:text-white disabled:opacity-30 p-2 hover:bg-white/5 rounded-full"
            disabled={lightboxIndex === 0}
          >
            <ChevronLeft size={36} />
          </button>
          <div className="bg-black/40 w-[80vw] h-[70vh] max-w-4xl rounded-lg flex items-center justify-center shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const allImgs = [...(project.plotImages || []), ...project.images];
              const imgName = allImgs[lightboxIndex];
              const isPdf = imgName.toLowerCase().endsWith('.pdf');
              const src = getFileUrl(imgName);

              if (isPdf) {
                return (
                  <div className="bg-gradient-to-br from-blue-100 to-slate-200 w-full h-full flex flex-col items-center justify-center">
                    <FileText size={96} className="text-blue-500/80 mb-4 animate-bounce" />
                    <span className="text-slate-800 text-lg font-bold truncate max-w-[90%]">{imgName.split('/').pop()}</span>
                    <span className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider bg-white/80 border border-slate-300 px-2 py-0.5 rounded shadow-sm">PDF Format Document</span>
                  </div>
                );
              }
              return <img src={src} alt="Viewer" className="max-w-full max-h-full object-contain" />;
            })()}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(Math.min((project.plotImages?.length || 0) + project.images.length - 1, lightboxIndex + 1)); }}
            className="absolute right-4 text-white/70 hover:text-white disabled:opacity-30 p-2 hover:bg-white/5 rounded-full"
            disabled={lightboxIndex === [...(project.plotImages || []), ...project.images].length - 1}
          >
            <ChevronRight size={36} />
          </button>
          <div className="absolute bottom-6 text-white/70 text-sm font-semibold bg-slate-900/60 px-3 py-1 rounded-full border border-white/10">
            {lightboxIndex + 1} / {[...(project.plotImages || []), ...project.images].length}
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Edit Modal */}
      <Modal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        title="Edit Plots"
        size="xl"
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={async () => {
                const seenPlots = new Set<string>();
                let duplicateExists = false;
                for (const p of bulkPlots) {
                  const num = String(p.plotNumber || '').trim();
                  if (num !== '') {
                    if (seenPlots.has(num)) { duplicateExists = true; break; }
                    seenPlots.add(num);
                  }
                }
                if (duplicateExists) {
                  const { toast } = await import('sonner');
                  toast.error('Duplicate plot numbers found! Please ensure all plot numbers are unique before saving.');
                  return;
                }
                setSaving(true);
                try {
                  const dirtyPlots = bulkPlots.filter(p => dirtyPlotIds.has(p.id || (p as any)._id));
                  await Promise.all(dirtyPlots.map(p => plotService.update(p.id || (p as any)._id, p)));
                  setPlots(prev => prev.map(p => {
                    const pid = p.id || (p as any)._id;
                    const match = dirtyPlots.find(dp => (dp.id || (dp as any)._id) === pid);
                    return match ? { ...p, ...match } : p;
                  }));
                  setGridPlots(prev => prev.map(p => {
                    const pid = p.id || (p as any)._id;
                    const match = dirtyPlots.find(dp => (dp.id || (dp as any)._id) === pid);
                    return match ? { ...p, ...match } : p;
                  }));
                  setDirtyPlotIds(new Set());
                  const { toast } = await import('sonner');
                  toast.success('All plot changes saved!');
                  fetchBulkPlots(bulkPlotPage, bulkSearch, bulkPendingOnly);
                  fetchGridPlots(gridPlotPage);
                  setBulkEditOpen(false);
                } catch (err: any) {
                  const { toast } = await import('sonner');
                  toast.error(err.message || 'Failed to save changes');
                } finally { setSaving(false); }
              }}
              disabled={saving || dirtyPlotIds.size === 0}
              className="px-4 py-2 bg-brand-green text-white text-sm font-semibold rounded-md hover:bg-brand-darkgreen disabled:opacity-50"
            >
              {saving ? 'Saving...' : `Save Changes (${dirtyPlotIds.size})`}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by plot number..."
                  value={bulkSearch}
                  onChange={e => setBulkSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:border-brand-green outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddSinglePlot}
                disabled={(() => {
                  if (!project?.totalLandArea) return false;
                  const projectSqFt = toSqFtHelper(project.totalLandArea, project.landAreaUnit);
                  return totalAllocatedSqFt >= projectSqFt;
                })()}
                title={(() => {
                  if (!project?.totalLandArea) return '';
                  const projectSqFt = toSqFtHelper(project.totalLandArea, project.landAreaUnit);
                  return totalAllocatedSqFt >= projectSqFt ? 'Total land area fully allocated — cannot add more plots' : '';
                })()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green text-white text-xs font-semibold rounded-md hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Add Plot
              </button>
              
              <button
                onClick={() => setDeleteBlockModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-md hover:bg-red-100 transition-all"
              >
                <Trash2 size={14} /> Delete Plot
              </button>
            </div>
          </div>

          {/* ── Land Area Usage Bar ─────────────────────────────────────────── */}
          {project?.totalLandArea && (() => {
            const projectSqFt = toSqFtHelper(project.totalLandArea, project.landAreaUnit);
            const allocatedSqFtVal = totalAllocatedSqFt;
            const pct = Math.min(100, (allocatedSqFtVal / projectSqFt) * 100);
            const isOver = allocatedSqFtVal > projectSqFt;
            const remaining = Math.max(0, projectSqFt - allocatedSqFtVal);
            return (
              <div className="px-1">
                <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                  <span className={isOver ? 'text-red-600' : 'text-slate-500'}>Land Area Usage</span>
                  <span className={isOver ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    {Math.round(allocatedSqFtVal).toLocaleString()} / {Math.round(projectSqFt).toLocaleString()} sq ft
                    {isOver
                      ? <span className="ml-1 text-red-600"> ⚠ Exceeded by {Math.round(allocatedSqFtVal - projectSqFt).toLocaleString()} sq ft</span>
                      : <span className="ml-1 text-slate-400">({Math.round(remaining).toLocaleString()} sq ft remaining)</span>
                    }
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : pct > 90 ? 'bg-amber-400' : 'bg-brand-green'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto" ref={plotTableRef}>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    {['Plot', 'Status', 'Facing', 'Size', 'Unit', 'Approval', 'Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium">Loading plots...</span>
                        </div>
                      </td>
                    </tr>
                  ) : bulkPlots.map(plot => (
                    <tr
                      key={plot.id || (plot as any)._id}
                      id={`plot-row-${plot.id || (plot as any)._id}`}
                      className={`hover:bg-slate-50 transition-colors ${newPlotId === (plot.id || (plot as any)._id) ? 'animate-[flash-row_1.5s_ease-out]' : ''}`}
                      style={newPlotId === (plot.id || (plot as any)._id) ? { background: 'rgb(209 250 229)' } : undefined}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={plot.plotNumber}
                            onChange={e => handleBulkPlotChange(plot.id || (plot as any)._id, 'plotNumber', e.target.value as any)}
                            className={`h-8 w-20 px-2 border rounded text-xs font-bold transition-colors ${
                              duplicatePlotNumbers.has(String(plot.plotNumber).trim())
                                ? 'border-red-400 bg-red-50 text-red-900 focus:border-red-500 outline-none'
                                : 'border-slate-200 text-slate-900 focus:border-brand-green outline-none'
                            }`}
                            title={
                              duplicatePlotNumbers.has(String(plot.plotNumber).trim())
                                ? 'Duplicate plot number'
                                : ''
                            }
                          />
                          {!/[a-zA-Z]+$/.test(String(plot.plotNumber)) && (
                            <button
                              type="button"
                              onClick={() => handleAddSubPlot(plot)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-blue-200 text-brand-blue hover:bg-blue-50 text-xs font-bold"
                              title="Add sub-plot"
                            >+</button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={plot.status}
                          onChange={e => handleBulkPlotChange(plot.id || (plot as any)._id, 'status', e.target.value)}
                          className={`h-8 px-2 border border-slate-200 rounded text-xs bg-white font-semibold ${statusCellColors[plot.status] || ''}`}
                        >
                          <option value="Available" className="text-slate-650 font-semibold">Available</option>
                          <option value="Booked" className="text-green-600 font-semibold">Booked</option>
                          <option value="Registered" className="text-blue-600 font-semibold">Registered</option>
                          <option value="Canceled" className="text-gray-500 font-semibold">Canceled</option>
                          <option value="Pending" className="text-yellow-600 font-semibold">Pending</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={plot.facing} onChange={e => handleBulkPlotChange(plot.id || (plot as any)._id, 'facing', e.target.value)} className="h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                          <option value="North">North</option>
                          <option value="North East">North East</option>
                          <option value="North West">North West</option>
                          <option value="South">South</option>
                          <option value="South East">South East</option>
                          <option value="South West">South West</option>
                          <option value="East">East</option>
                          <option value="West">West</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const projectSqFt = project?.totalLandArea ? toSqFtHelper(project.totalLandArea, project.landAreaUnit) : Infinity;
                          const isExceeding = totalAllocatedSqFt > projectSqFt;
                          return (
                            <input
                              type="number"
                              value={plot.size}
                              onChange={e => handleBulkPlotChange(plot.id || (plot as any)._id, 'size', Number(e.target.value))}
                              title={isExceeding ? 'Total allocation exceeds project land area' : ''}
                              className={`h-8 w-20 px-2 border rounded text-xs ${isExceeding ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200'}`}
                            />
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <select value={plot.sizeUnit} onChange={e => handleBulkPlotChange(plot.id || (plot as any)._id, 'sizeUnit', e.target.value)} className="h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                          <option>Sq Yards</option>
                          <option>Sq Feet</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {plot.status === 'Pending' ? (
                          <button onClick={() => { setBulkEditOpen(false); setSelectedPlot(plot); }} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteSinglePlot(plot)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete plot"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!bulkLoading && bulkPlots.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Search size={22} className="text-slate-300 mb-1" />
                          <p className="text-sm font-semibold text-slate-600">No plots found</p>
                          <p className="text-xs text-slate-400">
                            {bulkSearch ? `No plots matching "${bulkSearch}"` : 'No plots available to display'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {bulkTotalPages > 1 && (
            <PaginationControls
              currentPage={bulkPlotPage}
              totalPages={bulkTotalPages}
              onPageChange={(page) => {
                setBulkPlotPage(page);
                fetchBulkPlots(page, bulkSearch, bulkPendingOnly);
              }}
              totalCount={bulkTotalPlots}
              perPage={50}
              itemName="plots"
              className="mt-3"
            />
          )}
        </div>
      </Modal>

      {/* Pending Approvals Modal */}
      <Modal
        open={approvalsModalOpen}
        onClose={() => setApprovalsModalOpen(false)}
        title={`Pending Approvals (${projectPlotStats.Pending || 0})`}
        size="lg"
      >
        <div className="space-y-4 py-2">
          {pendingApprovalLoading ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading pending approvals...</p>
            </div>
          ) : (() => {
            const pendingPlots = pendingApprovalPlots;
            if (pendingPlots.length === 0) {
              return (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-700">No Pending Approvals</p>
                  <p className="text-xs text-slate-400 mt-1">All plot booking and cancellation requests have been processed.</p>
                </div>
              );
            }
            return (
              <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
                {pendingPlots.map(plot => {
                  const isCancellation = plot.pendingApproval?.requestType === 'cancellation';
                  return (
                    <div key={plot.id || (plot as any)._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-amber-200/80 bg-amber-50/40 mb-2.5 shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">Plot #{plot.plotNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCancellation ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                            {isCancellation ? 'Cancellation Request' : 'Booking Request'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                          <span>Customer: <strong className="text-slate-900">{plot.pendingApproval?.customerName || plot.bookedBy?.name || 'N/A'}</strong></span>
                          <span>Phone: <strong className="text-slate-900">{plot.pendingApproval?.phone || plot.bookedBy?.phone || 'N/A'}</strong></span>
                          <span>Requested by: <strong className="text-slate-800">{plot.pendingApproval?.requestedBy || 'Staff'}</strong> ({plot.pendingApproval?.requestedAt || 'Today'})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApproval('approve', plot)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle size={13} /> {isCancellation ? 'Approve Cancellation' : 'Approve Booking'}
                        </button>
                        <button
                          onClick={() => handleApproval('reject', plot)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          <Ban size={13} /> {isCancellation ? 'Reject Cancellation' : 'Reject Booking'}
                        </button>
                        <button
                          onClick={() => { setApprovalsModalOpen(false); setSelectedPlot(plot); }}
                          className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded text-xs font-medium"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* Add New Block Modal */}
      <Modal
        open={addBlockModalOpen}
        onClose={() => { if (!creatingBlock) setAddBlockModalOpen(false); }}
        title="Add New Plot Block"
        size="md"
        footer={
          <>
            <button
              onClick={() => setAddBlockModalOpen(false)}
              disabled={creatingBlock}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBlock}
              disabled={creatingBlock}
              className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {creatingBlock ? 'Creating Plots...' : 'Create Block Plots'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Plot Number</label>
              <input
                type="text"
                placeholder="e.g. 101, A-1, P-001"
                value={plotNumber}
                onChange={e => setPlotNumber(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs focus:border-brand-green outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Plots</label>
              <input
                type="number"
                min={1}
                max={200}
                value={plotCount}
                onChange={e => setPlotCount(Math.max(1, Number(e.target.value)))}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs focus:border-brand-green outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facing</label>
              <select
                value={blockFacing}
                onChange={e => setBlockFacing(e.target.value)}
                className="w-full h-9 px-2 border border-slate-200 rounded-md text-xs bg-white focus:border-brand-green outline-none"
              >
                <option value="East">East</option>
                <option value="West">West</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="North East">North East</option>
                <option value="North West">North West</option>
                <option value="South East">South East</option>
                <option value="South West">South West</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Size & Unit</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={blockSize}
                  onChange={e => setBlockSize(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-slate-200 rounded-md text-xs focus:border-brand-green outline-none"
                />
                <select
                  value={blockSizeUnit}
                  onChange={e => setBlockSizeUnit(e.target.value)}
                  className="h-9 px-1 border border-slate-200 rounded-md text-[11px] bg-white focus:border-brand-green outline-none shrink-0"
                >
                  <option>Sq Yards</option>
                  <option>Sq Feet</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Block Modal */}
      <Modal
        open={deleteBlockModalOpen}
        onClose={() => { if (!deletingBlock) setDeleteBlockModalOpen(false); }}
        title="Delete Entire Block"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteBlockModalOpen(false)}
              disabled={deletingBlock}
              className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteBlock}
              disabled={deletingBlock || !selectedBlockToDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {deletingBlock ? 'Deleting Block...' : 'Delete Block'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            ⚠️ Select a block prefix to permanently delete all associated plots.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Block to Delete</label>
            {existingBlocks.length > 0 ? (
              <select
                value={selectedBlockToDelete}
                onChange={e => setSelectedBlockToDelete(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:border-red-400 outline-none"
              >
                <option value="">-- Choose Block --</option>
                {existingBlocks.map(block => {
                  const count = plots.filter(p => {
                    const numStr = String(p.plotNumber);
                    return numStr.startsWith(`${block}-`) || numStr.startsWith(block);
                  }).length;
                  return (
                    <option key={block} value={block}>
                      Block "{block}" ({count} plots)
                    </option>
                  );
                })}
              </select>
            ) : (
              <p className="text-xs text-slate-500 italic">No block prefixes detected in current plots.</p>
            )}
          </div>

          {selectedBlockToDelete && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
              This will delete <strong>{plots.filter(p => String(p.plotNumber).startsWith(selectedBlockToDelete)).length} plots</strong> belonging to Block "{selectedBlockToDelete}".
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <EditProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
        onSave={async (updated) => {
          try {
            const pid = id || project?.id || (project as any)?._id;
            if (!pid) throw new Error('Project ID not found');
            const res = await projectService.update(pid, updated);
            
            // Re-fetch project from backend to ensure all populated fields, virtuals, and timestamps are synced
            const freshProjectRes = await projectService.getById(pid);
            const freshProject = freshProjectRes?.data || res?.data || updated;
            if (freshProject) {
              if (!freshProject.images) freshProject.images = [];
              if (!freshProject.plotImages) freshProject.plotImages = [];
              setProject(freshProject);
            }
            
            // Also refresh grid plots & stats so plot counts, availability, and plot map are completely up to date immediately
            await fetchGridPlots(gridPlotPage);
            
            const { toast } = await import('sonner');
            toast.success('Project updated successfully!');
            setEditOpen(false);
          } catch (err: any) {
            const { toast } = await import('sonner');
            toast.error(err.message || 'Failed to update project');
            throw err;
          }
        }}
      />



      {/* Upload Images Modal */}
      <Modal
        open={imagesEditOpen}
        onClose={() => setImagesEditOpen(false)}
        title="Upload Images"
        size="md"
        footer={
          <>
            <button onClick={() => setImagesEditOpen(false)} className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={async () => {
              const pid = project.id || (project as any)._id;
              try {
                await projectService.update(pid, { plotImages: editPlotImages, images: editProjectImages } as any);
                setProject(prev => {
                  if (!prev) return prev;
                  return { ...prev, plotImages: editPlotImages, images: editProjectImages };
                });
                import('sonner').then(m => m.toast.success('Images updated successfully'));
                setImagesEditOpen(false);
              } catch (err: any) {
                import('sonner').then(m => m.toast.error(err.message || 'Failed to update images'));
                console.error(err);
              }
            }} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-darkgreen active:scale-[0.98] transition-all">
              Save Images
            </button>
          </>
        }
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          <div className="pb-5 border-b border-slate-100">
            <h4 className="text-base font-semibold text-slate-900 mb-4">Plot Sketch Images</h4>
            <label
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all block ${editPlotImages.length >= 2 ? 'border-slate-150 bg-slate-50 cursor-not-allowed opacity-75' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'}`}
            >
              <input type="file" accept="image/*,.pdf" multiple className="hidden" disabled={editPlotImages.length >= 2} onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const allowed = Math.max(0, 2 - editPlotImages.length);
                if (allowed <= 0) {
                  import('sonner').then(m => m.toast.error('Maximum limit of 2 plot sketch images reached. Delete an existing image first.'));
                  e.target.value = '';
                  return;
                }
                if (files.length > allowed) {
                  import('sonner').then(m => m.toast.warning(`Only ${allowed} image(s) can be added. Maximum limit is 2 images.`));
                }
                const toUpload = files.slice(0, allowed);
                try {
                  const { uploadService } = await import('@/services/uploads');
                  const res = await uploadService.upload('plots', toUpload);
                  const paths = (res.data || []).map((f: any) => f.path);
                  setEditPlotImages(prev => [...prev, ...paths]);
                } catch (err: any) {
                  import('sonner').then(m => m.toast.error(err.message || 'Failed to upload plot images'));
                  console.error(err);
                }
                e.target.value = '';
              }} />
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 font-medium">
                {editPlotImages.length >= 2 ? 'Maximum 2 plot sketch images uploaded' : 'Upload plot layout or boundary image'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {editPlotImages.length >= 2 ? 'Delete an existing image to upload a new one' : `Maximum 2 images (${editPlotImages.length}/2 uploaded)`}
              </p>
            </label>
            {editPlotImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {editPlotImages.map((img, i) => (
                  <div key={img} className="relative rounded-md border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-600 flex items-center justify-between">
                    <span className="truncate flex-1">{img.split('/').pop()}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          downloadFileDirectly(getFileUrl(img), img.split('/').pop());
                        }}
                        className="text-slate-400 hover:text-brand-blue transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setEditPlotImages(prev => prev.filter((_, j) => j !== i));
                        }}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4">Project Images</h4>
            <label
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all block ${editProjectImages.length >= 10 ? 'border-slate-150 bg-slate-50 cursor-not-allowed opacity-75' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'}`}
            >
              <input type="file" accept="image/*,.pdf" multiple className="hidden" disabled={editProjectImages.length >= 10} onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const allowed = Math.max(0, 10 - editProjectImages.length);
                if (allowed <= 0) {
                  import('sonner').then(m => m.toast.error('Maximum limit of 10 project images reached. Delete an existing image first.'));
                  e.target.value = '';
                  return;
                }
                if (files.length > allowed) {
                  import('sonner').then(m => m.toast.warning(`Only ${allowed} image(s) can be added. Maximum limit is 10 images.`));
                }
                const toUpload = files.slice(0, allowed);
                try {
                  const { uploadService } = await import('@/services/uploads');
                  const res = await uploadService.upload('projects', toUpload);
                  const paths = (res.data || []).map((f: any) => f.path);
                  setEditProjectImages(prev => [...prev, ...paths]);
                } catch (err: any) {
                  import('sonner').then(m => m.toast.error(err.message || 'Failed to upload project images'));
                  console.error(err);
                }
                e.target.value = '';
              }} />
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 font-medium">
                {editProjectImages.length >= 10 ? 'Maximum 10 project images uploaded' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {editProjectImages.length >= 10 ? 'Delete an existing image to upload a new one' : `PNG, JPG, PDF up to 10MB (${editProjectImages.length}/10 uploaded)`}
              </p>
            </label>
            {editProjectImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {editProjectImages.map((img, i) => (
                  <div key={i} className="relative group border border-slate-100 rounded-md p-2 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium truncate flex-1">{img.split('/').pop()}</span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          downloadFileDirectly(getFileUrl(img), img.split('/').pop());
                        }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-blue transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setEditProjectImages(prev => prev.filter((_, j) => j !== i));
                        }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Map Modal */}
      {mapOpen && project.latitude && project.longitude && (
        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Project Location Map" size="md">
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Showing map location for <NameTag name={project.name} displayId={project.displayId} /> at coordinates: {project.latitude}, {project.longitude}</p>
            <div className="w-full h-80 rounded-lg overflow-hidden border border-slate-200">
              <iframe
                title="Location Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://maps.google.com/maps?q=${project.latitude},${project.longitude}&z=14&output=embed`}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Seller Modal */}
      {addSellerOpen && (
        <Modal
          open={addSellerOpen}
          onClose={() => setAddSellerOpen(false)}
          title={editingSellerIndex !== null ? "Edit Seller Details" : "Add New Seller Details"}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddSellerOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleAddSeller(); }}
                disabled={!newSellerName.trim()}
                className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-semibold hover:bg-brand-darkgreen disabled:opacity-50 transition-colors"
              >
                {editingSellerIndex !== null ? "Save Changes" : "Add Seller"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller Name<span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="text"
                  placeholder="Enter seller name"
                  value={newSellerName}
                  onChange={e => setNewSellerName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter seller phone number"
                  value={newSellerPhone}
                  onChange={e => setNewSellerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller Email</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={newSellerEmail}
                  onChange={e => setNewSellerEmail(e.target.value.toLowerCase())}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller Address</label>
                <input
                  type="text"
                  placeholder="Enter seller address"
                  value={newSellerAddress}
                  onChange={e => setNewSellerAddress(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-green bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller KYC / Account Details</label>
              <label
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all block relative"
              >
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    try {
                      const { uploadService } = await import('@/services/uploads');
                      const res = await uploadService.upload('kyc', files);
                      const paths = (res.data || []).map((f: any) => f.path);
                      setNewSellerDocs(prev => [...prev, ...paths]);
                    } catch (err: any) {
                      import('sonner').then(m => m.toast.error(err.message || 'Failed to upload KYC document'));
                      console.error(err);
                    }
                    e.target.value = '';
                  }}
                />
                <Upload size={20} className="mx-auto text-slate-400 mb-1.5" />
                <p className="text-sm text-slate-500 font-medium">Upload PDF only</p>
                <p className="text-xs text-slate-400 mt-0.5">Aadhaar, Sale Deed, EC, Bank details</p>
              </label>
              {newSellerDocs.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {newSellerDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      <span className="truncate flex-1">{getCleanDocName(doc)}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const url = getFileUrl(doc);
                            window.open(url, '_blank');
                          }}
                          className="text-slate-400 hover:text-brand-blue transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Attachment Selector Modal */}
      {showAttachmentPicker && (
        <Modal
          open={showAttachmentPicker}
          onClose={() => setShowAttachmentPicker(false)}
          title="Select Broadcast Attachment"
          size="md"
        >
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plot Sketch Images</h4>
              <div className="grid grid-cols-2 gap-2">
                {(project.plotImages || []).map(img => (
                  <button
                    type="button"
                    key={img}
                    onClick={() => {
                      setBroadcastAttachment(img);
                      setShowAttachmentPicker(false);
                    }}
                    className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/20 text-xs font-semibold text-slate-700 text-left transition-colors"
                  >
                    <LayoutGrid size={14} className="text-amber-500" />
                    <span className="truncate">{img}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Images</h4>
              <div className="grid grid-cols-2 gap-2">
                {project.images.map(img => (
                  <button
                    type="button"
                    key={img}
                    onClick={() => {
                      setBroadcastAttachment(img);
                      setShowAttachmentPicker(false);
                    }}
                    className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/20 text-xs font-semibold text-slate-700 text-left transition-colors"
                  >
                    <Building2 size={14} className="text-blue-500" />
                    <span className="truncate">{img}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <input
                type="file"
                id="broadcast-image-upload"
                className="hidden"
                accept="image/*"
                onChange={handleCustomImageUpload}
              />
              <button
                type="button"
                onClick={() => {
                  document.getElementById('broadcast-image-upload')?.click();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:text-brand-blue text-sm font-semibold text-slate-500 transition-colors bg-slate-50"
              >
                <Upload size={16} /> Upload custom image...
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ShareLocationModal
        open={shareLocationOpen}
        onClose={() => setShareLocationOpen(false)}
        project={project}
      />

      {/* Custom Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
