import type { UserRole } from '@/types';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  FileCheck,
  PhoneCall,
  Calendar,
  CheckSquare,
  UsersRound,
  History,
  UserCog,
  Handshake,
  BarChart3,
  HelpCircle,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

export const navConfig: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Projects', icon: Building2, path: '/admin/projects' },
    { label: 'Leads', icon: Users, path: '/admin/leads' },
    { label: 'Loans', icon: UserCheck, path: '/admin/customers' },
    { label: 'Registrations', icon: FileCheck, path: '/admin/registrations' },
    { label: 'Follow Ups', icon: PhoneCall, path: '/admin/follow-ups' },
    { label: 'Attendance', icon: Calendar, path: '/admin/attendance' },
    { label: 'Tasks', icon: CheckSquare, path: '/admin/tasks' },
    { label: 'Groups', icon: UsersRound, path: '/admin/groups' },
    { label: 'Activity Logs', icon: History, path: '/admin/activity-logs' },
    { label: 'Staff Management', icon: UserCog, path: '/admin/staff' },
    { label: 'Channel Partners', icon: Handshake, path: '/admin/channel-partners' },
    { label: 'Reports', icon: BarChart3, path: '/admin/reports' },
    { label: 'About', icon: HelpCircle, path: '/admin/about' },
  ],
  staff: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/staff/dashboard' },
    { label: 'Projects', icon: Building2, path: '/staff/projects' },
    { label: 'My Leads', icon: Users, path: '/staff/my-leads' },
    { label: 'Open Leads Pool', icon: UsersRound, path: '/staff/leads-pool' },
    { label: 'Loans', icon: UserCheck, path: '/staff/customers' },
    { label: 'Registrations', icon: FileCheck, path: '/staff/registrations' },
    { label: 'Follow Ups', icon: PhoneCall, path: '/staff/follow-ups' },
    { label: 'My Tasks', icon: CheckSquare, path: '/staff/tasks' },
    { label: 'Attendance', icon: Calendar, path: '/staff/attendance' },
    { label: 'Groups', icon: UsersRound, path: '/staff/groups' },
    { label: 'Reports', icon: BarChart3, path: '/staff/reports' },
    { label: 'About', icon: HelpCircle, path: '/staff/about' },
  ],
  partner: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/partner/dashboard' },
    { label: 'Projects', icon: Building2, path: '/partner/projects' },
    { label: 'My Leads', icon: Users, path: '/partner/leads' },
    { label: 'Add New Lead', icon: PlusCircle, path: '/partner/add-lead' },
    { label: 'About', icon: HelpCircle, path: '/partner/about' },
  ],
};
