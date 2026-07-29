import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Home, ChevronLeft, ChevronRight } from 'lucide-react';

import { CardSkeletonGrid } from '@/components/shared/SkeletonLoader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { leadService, projectService, plotService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import type { Lead, Project } from '@/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';

export default function PartnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allMyLeads, setAllMyLeads] = useState<Lead[]>([]);
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Pagination states & items per page
  const [projectsPage, setProjectsPage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);
  const itemsPerPage = 5;

  const [projectsData, setProjectsData] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);

  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  // Load metrics & chart overview data
  useEffect(() => {
    if (!user?.name) return;
    Promise.allSettled([
      leadService.getAll({ sourceType: 'Channel Partner', source: user.name, limit: 1000 }).then(r => {
        const lds = r.data || [];
        setAllMyLeads(lds);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user?.name]);

  // Fetch paginated projects from backend
  useEffect(() => {
    projectService.getAll({ page: projectsPage, limit: itemsPerPage }).then(async (pRes) => {
      const projs: Project[] = pRes.data || [];
      const totalCount = pRes.total ?? (pRes as any).count ?? projs.length;
      
      // If server returned all items in mock or unpaginated response, slice for display
      const activeProjs = projs.filter(p => p.isEnabled !== false && (!p.status || p.status.toLowerCase() === 'active' || p.status.toLowerCase() === 'upcoming'));
      const sliced = activeProjs.length > itemsPerPage ? activeProjs.slice((projectsPage - 1) * itemsPerPage, projectsPage * itemsPerPage) : activeProjs;

      setProjectsData(sliced);
      setTotalProjects(totalCount);

      const counts: Record<string, number> = {};
      await Promise.allSettled(sliced.map(async p => {
        const pid = p.id || (p as any)._id;
        try {
          const plotRes = await plotService.getAll({ projectId: pid, status: 'Available', limit: 100 });
          counts[pid] = (plotRes.data || []).length;
        } catch { counts[pid] = 0; }
      }));
      setAvailableCounts(prev => ({ ...prev, ...counts }));
    }).catch(() => {});
  }, [projectsPage]);

  // Fetch paginated leads from backend
  useEffect(() => {
    leadService.getAll({
      sourceType: 'Channel Partner',
      source: user?.name,
      page: leadsPage,
      limit: itemsPerPage,
      sort: '-createdAt'
    }).then(r => {
      const lds: Lead[] = r.data || [];
      const totalCount = r.total ?? (r as any).count ?? lds.length;
      const sliced = lds.length > itemsPerPage ? lds.slice((leadsPage - 1) * itemsPerPage, leadsPage * itemsPerPage) : lds;

      setLeadsData(sliced);
      setTotalLeads(totalCount);
    }).catch(() => {});
  }, [user?.name, leadsPage]);

  const myLeads = allMyLeads.filter(l => !user?.name || l.source === user.name || (l as any).createdBy === user.id);
  const submitted = myLeads.length || totalLeads;
  const converted = myLeads.filter(l => l.status === 'Customer' || l.status === 'Qualified').length;
  const booked = myLeads.filter(l => l.status === 'Customer').length;

  const totalProjectsPages = Math.max(1, Math.ceil(totalProjects / itemsPerPage));
  const totalLeadsPages = Math.max(1, Math.ceil(totalLeads / itemsPerPage));

  // Compute chart data from real leads
  const partnerMonthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts: Record<string, number> = {};
    months.forEach(m => { counts[m] = 0; });
    myLeads.forEach(l => {
      if (l.dateAdded) {
        const d = new Date(l.dateAdded);
        const m = months[d.getMonth()];
        if (m) counts[m]++;
      }
    });
    return months.slice(0, 6).map(m => ({ name: m, Leads: counts[m] }));
  }, [myLeads]);

  const partnerStatusData = useMemo(() => {
    const open = myLeads.filter(l => l.status === 'Open').length;
    const qualified = myLeads.filter(l => l.status === 'Qualified').length;
    const unqualified = myLeads.filter(l => l.status === 'Unqualified').length;
    const customer = myLeads.filter(l => l.status === 'Customer').length;
    return [
      { stage: 'Open', count: open, color: '#3B82F6' },
      { stage: 'Qualified', count: qualified, color: '#10B981' },
      { stage: 'Unqualified', count: unqualified, color: '#EF4444' },
      { stage: 'Customer', count: customer, color: '#8B5CF6' },
    ];
  }, [myLeads]);

  if (loading) return <CardSkeletonGrid count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />;

  return (
    <div className="space-y-4">
      {/* Metric Cards — 3-column compact grid on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Leads Submitted */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Leads Submitted</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Upload size={14} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{submitted}</p>
        </div>

        {/* Leads Converted */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Leads Converted</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle size={14} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{converted}</p>
        </div>

        {/* Plots Booked */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">Plots Booked</p>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Home size={14} className="text-amber-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{booked}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Submission Trends */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">Leads Submitted Trend</h2>
          <p className="text-xs text-slate-400 mt-0.5">Monthly breakdown of submitted leads</p>
          <div className="h-40 sm:h-52 w-full text-[10px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={partnerMonthlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPartnerLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '5px' }} />
                <Area type="monotone" dataKey="Leads" stroke="#3B82F6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPartnerLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Conversion Stages */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">My Leads Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">Current status breakdown of all submitted leads</p>
          <div className="h-40 sm:h-52 w-full text-[10px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partnerStatusData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {partnerStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Available Projects */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm sm:text-lg font-semibold text-slate-900">Available Projects</h2>
            <p className="text-xs text-slate-400 mt-0.5">View projects to access open leads</p>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {projectsData.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-6">No available projects found</p>
          )}
          {projectsData.map(p => {
            const pid = p.id || (p as any)._id;
            const available = availableCounts[pid] ?? 0;
            return (
              <div key={pid} className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.location}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-400">Total: <span className="font-medium text-slate-600">{p.totalPlots}</span></span>
                    <span className="text-[11px] text-slate-400">Available: <span className="font-medium text-emerald-600">{available}</span></span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/partner/add-lead?projectId=${pid}`)}
                  className="shrink-0 px-3 py-1.5 bg-brand-green text-white text-xs font-semibold rounded-lg hover:bg-brand-darkgreen transition-colors"
                >
                  Add Lead
                </button>
              </div>
            );
          })}
          {/* Mobile pagination */}
          {totalProjectsPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setProjectsPage(prev => Math.max(prev - 1, 1))} disabled={projectsPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40">
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="text-xs text-slate-400">{projectsPage} / {totalProjectsPages}</span>
              <button onClick={() => setProjectsPage(prev => Math.min(prev + 1, totalProjectsPages))} disabled={projectsPage === totalProjectsPages}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40">
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[600px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Project Name', 'Location', 'Total Plots', 'Available', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projectsData.map(p => {
                const pid = p.id || (p as any)._id;
                const available = availableCounts[pid] ?? 0;
                return (
                  <tr key={pid} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.location}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.totalPlots}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{available}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/partner/add-lead?projectId=${pid}`)} className="px-3 py-1.5 bg-brand-green text-white text-xs font-semibold rounded hover:bg-brand-darkgreen transition-colors">
                        Add Lead
                      </button>
                    </td>
                  </tr>
                );
              })}
              {projectsData.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 italic">No available projects found</td></tr>
              )}
            </tbody>
          </table>
          {totalProjectsPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 mt-2">
              <p className="text-sm text-slate-700">
                Showing <span className="font-medium">{(projectsPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-medium">{Math.min(projectsPage * itemsPerPage, totalProjects)}</span> of{' '}
                <span className="font-medium">{totalProjects}</span> results
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 mr-2">{projectsPage} / {totalProjectsPages}</span>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button onClick={() => setProjectsPage(prev => Math.max(prev - 1, 1))} disabled={projectsPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalProjectsPages }).map((_, idx) => (
                    <button key={idx} onClick={() => setProjectsPage(idx + 1)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        projectsPage === idx + 1 ? 'z-10 bg-brand-green text-white' : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                      }`}>{idx + 1}</button>
                  ))}
                  <button onClick={() => setProjectsPage(prev => Math.min(prev + 1, totalProjectsPages))} disabled={projectsPage === totalProjectsPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm sm:text-lg font-semibold text-slate-900 mb-4">My Recent Leads</h2>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {leadsData.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-6">No submitted leads found</p>
          )}
          {leadsData.map(lead => (
            <div key={lead.id || (lead as any)._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{lead.customerName}</p>
                <StatusBadge status={lead.status} />
              </div>
              <p className="text-xs text-slate-500">{lead.phone}</p>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">Submitted: <span className="text-slate-600">{formatDate(lead.dateAdded || (lead as any).createdAt)}</span></span>
              </div>
            </div>
          ))}
          {/* Mobile pagination */}
          {totalLeadsPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setLeadsPage(prev => Math.max(prev - 1, 1))} disabled={leadsPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40">
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="text-xs text-slate-400">{leadsPage} / {totalLeadsPages}</span>
              <button onClick={() => setLeadsPage(prev => Math.min(prev + 1, totalLeadsPages))} disabled={leadsPage === totalLeadsPages}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 disabled:opacity-40">
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[600px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Customer Name', 'Phone', 'Date Submitted', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leadsData.map(lead => (
                <tr key={lead.id || (lead as any)._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{lead.customerName}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{lead.phone}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(lead.dateAdded || (lead as any).createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                </tr>
              ))}
              {leadsData.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400 italic">No submitted leads found</td></tr>
              )}
            </tbody>
          </table>
          {totalLeadsPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 mt-2">
              <p className="text-sm text-slate-700">
                Showing <span className="font-medium">{(leadsPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-medium">{Math.min(leadsPage * itemsPerPage, totalLeads)}</span> of{' '}
                <span className="font-medium">{totalLeads}</span> results
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 mr-2">{leadsPage} / {totalLeadsPages}</span>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button onClick={() => setLeadsPage(prev => Math.max(prev - 1, 1))} disabled={leadsPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalLeadsPages }).map((_, idx) => (
                    <button key={idx} onClick={() => setLeadsPage(idx + 1)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        leadsPage === idx + 1 ? 'z-10 bg-brand-green text-white' : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                      }`}>{idx + 1}</button>
                  ))}
                  <button onClick={() => setLeadsPage(prev => Math.min(prev + 1, totalLeadsPages))} disabled={leadsPage === totalLeadsPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
