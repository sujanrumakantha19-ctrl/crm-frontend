import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ExportProvider } from '@/context/ExportContext';
import { Toaster } from '@/components/ui/sonner';
import { Shell } from '@/components/layout/Shell';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminProjects from '@/pages/admin/Projects';
import AdminProjectDetail from '@/pages/admin/ProjectDetail';
import AdminLeads from '@/pages/admin/Leads';
import AdminFollowUps from '@/pages/admin/FollowUps';
import AdminLeadDetail from '@/pages/admin/LeadDetail';
import AdminAttendance from '@/pages/admin/Attendance';
import AdminGroups from '@/pages/admin/Groups';
import AdminActivityLogs from '@/pages/admin/ActivityLogs';
import AdminStaff from '@/pages/admin/Staff';
import AdminStaffDetail from '@/pages/admin/StaffDetail';
import AdminChannelPartners from '@/pages/admin/ChannelPartners';
import AdminChannelPartnerDetail from '@/pages/admin/ChannelPartnerDetail';
import AdminReports from '@/pages/admin/Reports';
import AdminRegistrations from '@/pages/admin/Registrations';
import AdminCustomers from '@/pages/admin/Customers';
import AdminCustomerDetail from '@/pages/admin/CustomerDetail';
import AdminAbout from '@/pages/admin/About';
import StaffAbout from '@/pages/staff/About';
import PartnerAbout from '@/pages/partner/About';

// Staff pages
import StaffDashboard from '@/pages/staff/Dashboard';
import StaffLeadsPool from '@/pages/staff/LeadsPool';
import StaffMyLeads from '@/pages/staff/MyLeads';
import StaffAttendance from '@/pages/staff/Attendance';
import StaffProfile from '@/pages/staff/Profile';
import StaffReports from '@/pages/staff/StaffReports';
import StaffFollowUps from '@/pages/staff/FollowUps';
import AdminTasksPage from '@/pages/admin/Tasks';

// Partner pages
import PartnerDashboard from '@/pages/partner/Dashboard';
import PartnerAddLead from '@/pages/partner/AddLead';
import PartnerLeads from '@/pages/partner/Leads';
import PartnerProfile from '@/pages/partner/Profile';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ExportProvider>
        <Routes>
          {/* Login & Forgot Password */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Admin routes */}
          <Route element={<Shell role="admin" />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/projects/:id" element={<AdminProjectDetail />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/customers/:id" element={<AdminCustomerDetail />} />
            <Route path="/admin/registrations" element={<AdminRegistrations />} />
            <Route path="/admin/registrations/:id" element={<AdminCustomerDetail />} />
            <Route path="/admin/follow-ups" element={<AdminFollowUps />} />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route path="/admin/tasks" element={<AdminTasksPage />} />
            <Route path="/admin/groups" element={<AdminGroups />} />
            <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
            <Route path="/admin/staff" element={<AdminStaff />} />
            <Route path="/admin/staff/:id" element={<AdminStaffDetail />} />
            <Route path="/admin/channel-partners" element={<AdminChannelPartners />} />
            <Route path="/admin/channel-partners/:id" element={<AdminChannelPartnerDetail />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/about" element={<AdminAbout />} />
          </Route>

          {/* Staff routes */}
          <Route element={<Shell role="staff" />}>
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/leads-pool" element={<StaffLeadsPool />} />
            <Route path="/staff/my-leads" element={<StaffMyLeads />} />
            <Route path="/staff/tasks" element={<AdminTasksPage />} />
            <Route path="/staff/attendance" element={<StaffAttendance />} />
            <Route path="/staff/projects" element={<AdminProjects />} />
            <Route path="/staff/projects/:id" element={<AdminProjectDetail />} />
            <Route path="/staff/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/staff/customers" element={<AdminCustomers />} />
            <Route path="/staff/customers/:id" element={<AdminCustomerDetail />} />
            <Route path="/staff/registrations" element={<AdminRegistrations />} />
            <Route path="/staff/registrations/:id" element={<AdminCustomerDetail />} />
            <Route path="/staff/follow-ups" element={<StaffFollowUps />} />
            <Route path="/staff/groups" element={<AdminGroups />} />
            <Route path="/staff/reports" element={<StaffReports />} />
            <Route path="/staff/profile" element={<StaffProfile />} />
            <Route path="/staff/about" element={<StaffAbout />} />
          </Route>

          {/* Partner routes */}
          <Route element={<Shell role="partner" />}>
            <Route path="/partner/dashboard" element={<PartnerDashboard />} />
            <Route path="/partner/projects" element={<AdminProjects />} />
            <Route path="/partner/projects/:id" element={<AdminProjectDetail />} />
            <Route path="/partner/leads" element={<PartnerLeads />} />
            <Route path="/partner/add-lead" element={<PartnerAddLead />} />
            <Route path="/partner/profile" element={<PartnerProfile />} />
            <Route path="/partner/about" element={<PartnerAbout />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
        </ExportProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
