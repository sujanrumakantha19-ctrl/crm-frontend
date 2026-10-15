export type UserRole = 'admin' | 'staff' | 'partner';

export interface User {
  id: string;
  name: string;
  displayId?: string;
  employeeId?: string;
  initials: string;
  role: UserRole;
  designation: string;
  email: string;
  phone: string;
  avatarBg: string;
  avatar?: string;
  groupId?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  companyName?: string;
  reraId?: string;
  isActive: boolean;
  createdAt?: string;
}

export type ProjectStatus = 'Upcoming' | 'Active' | 'Completed' | 'On Hold';
export type LandType = 'Agricultural' | 'Residential' | 'Commercial' | 'Mixed';
export type ProjectCategory = 'Open Plots' | 'Villas' | 'Apartments' | 'Commercial' | 'Farm Land';

export interface Project {
  _id?: string;
  id: string;
  name: string;
  displayId?: string;
  location: string;
  description: string;
  status: ProjectStatus;
  totalLandArea: number;
  landAreaUnit: string;
  surveyNumber: string;
  dtcpNumber?: string;
  village: string;
  mandal: string;
  district: string;
  landType: LandType;
  totalPlots: number;
  plotSize: number;
  plotSizeUnit: string;
  roadFacingPlots: number;
  cornerPlots: number;
  images: string[];
  createdAt: string;
  latitude?: string;
  longitude?: string;
  category?: ProjectCategory;
  isEnabled?: boolean;
  plotImages?: string[];
  owner?: SellerInfo;
  sellers?: SellerInfo[];
  availablePlots?: number;
  /** Populated count of all Plot documents for this project */
  inventoryPlotCount?: number;
}

export type PlotStatus = 'Available' | 'Booked' | 'Registered' | 'Canceled' | 'Pending';

export interface SellerInfo {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  kycDocuments?: SellerDocument[];
}

export interface SellerDocument {
  id: string;
  name: string;
  type: 'PDF' | 'KYC';
  uploadedAt: string;
}

export interface Plot {
  id: string;
  projectId: string;
  plotNumber: number | string;
  status: PlotStatus;
  facing: string;
  size: number;
  sizeUnit: string;
  type: string;
  timeline: PlotTimelineEvent[];
  pendingApproval?: PlotApproval;
  bookedBy?: {
    id?: string;
    name: string;
    phone: string;
    paymentStatus: 'Not Paid' | 'Partially Paid' | 'Fully Paid';
    paymentMethod?: 'CASH' | 'LOAN';
    bank?: string;
    bankFollowerName?: string;
    bankFollowerPhone?: string;
    loanStage?: string;
    type: 'customer' | 'staff';
    leadId?: string;
    customerName?: string;
    displayId?: string;
    email?: string;
    assignedTo?: string;
    bookingDate?: string;
    bookedAt?: string;
    date?: string;
  };
  expectedRegistrationDate?: string;
  registrationDate?: string;
  docNumber?: string;
  isQuarantined?: boolean;
  quarantineNotes?: string;
  assignedTo?: string;
  bookingDate?: string;
  selectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  price?: number;
}

export interface PlotApproval {
  leadId: string;
  customerName: string;
  phone: string;
  requestedBy: string;
  requestedAt: string;
  paymentStatus: 'Not Paid' | 'Partially Paid' | 'Fully Paid';
  notes?: string;
  requestType?: string;
}

export interface PlotTimelineEvent {
  id: string;
  type: 'lead_added' | 'reserved' | 'qualified' | 'booking_confirmed' | 'booking_canceled' | 'new_booking';
  label: string;
  actor: string;
  actorRole: string;
  date: string;
  details?: string;
  color: 'green' | 'blue' | 'amber' | 'red';
  actorType?: 'customer' | 'staff' | 'admin' | 'partner';
}

export type LeadStatus = 'Open' | 'Qualified' | 'Unqualified' | 'Customer';

export interface Lead {
  id: string;
  customerName: string;
  displayId?: string;
  phone: string;
  email: string;
  city: string;
  budgetMin?: number;
  budgetMax?: number;
  budget?: string | number;
  category?: ProjectCategory | string;
  propertyInterest?: string;
  notes?: string;
  source: string;
  sourceType: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedToDisplayId?: string;
  status: LeadStatus;
  dateAdded: string;
  followUps?: FollowUp[];
  projectId?: string;
  plotId?: string;
  plotIds?: string[];
  paymentStatus?: 'Advance Paid' | 'Advance Not Paid' | 'Fully Paid' | 'Partially Paid' | 'Not Paid';
  paymentMethod?: 'CASH' | 'LOAN';
  advanceAmount?: number;
  balanceAmount?: number;
  bank?: string;
  bankFollowerName?: string;
  bankFollowerPhone?: string;
  loanStage?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  createdAt?: string;
  assignedAt?: string;
  updatedAt?: string;
}

export interface FollowUp {
  id: string;
  date: string;
  notes: string;
  outcome: string;
  nextAction: string;
}

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Half Day'
  | 'In Progress'
  | 'Needs Review'
  | 'Weekly Off'
  | 'Not Joined'
  | 'Scheduled';

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  duration?: string;
  status: AttendanceStatus;
  role: string;
  activityType?: string;
  projectId?: string;
  projectName?: string;
  location?: string;
}

export interface StaffPresenceToday {
  staffId: string;
  name: string;
  email: string;
  initials: string;
  designation: string;
  phone: string;
  avatarBg?: string | null;
  todayDate: string;
  presence: 'Present' | 'Absent';
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  hasActiveSession: boolean;
  currentActivity?: string | null;
  currentLocation?: string | null;
  sessionsCount: number;
}

export interface TodayPresenceSummary {
  date: string;
  totalStaff: number;
  presentCount: number;
  absentCount: number;
  activeCount: number;
}

export interface DailyAttendanceRecord {
  staffId: string;
  staffName: string;
  email: string;
  role: string;
  date: string;
  status: AttendanceStatus;
  isOverridden: boolean;
  overrideNotes?: string;
  overriddenBy?: string | null;
  totalMinutes: number;
  formattedDuration: string;
  sessionsCount: number;
  firstCheckIn: string;
  lastCheckOut: string;
  hasActiveSession: boolean;
  currentActivity?: string;
  currentLocation?: string;
  sessions?: any[];
}

export type TaskStatus = 'To Do' | 'In Progress' | 'In Review' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee:
    | string
    | {
        id?: string;
        _id?: string;
        name?: string;
        initials?: string;
        displayId?: string;
      }
    | null;
  assigneeInitials: string;
  dueDate: string;
  dueTime?: string;
  project: string;
  comments: TaskComment[];
  createdAt: string;
}

export interface TaskComment {
  id: string;
  author: string;
  authorInitials: string;
  text: string;
  timestamp: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorInitials: string;
  actorAvatarBg: string;
  action: string;
  actionType: 'Created' | 'Updated' | 'Deleted' | 'Status Change';
  entityType: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  ipAddress: string;
  details?: string;
}

export interface ChannelPartner {
  id: string;
  name: string;
  displayId?: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  reraId?: string;
  totalLeads: number;
  isActive: boolean;
  initials: string;
  avatarBg: string;
  notes?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
}

export interface Notification {
  id: string;
  type: 'birthday' | 'lead_status' | 'new_lead' | 'task_assigned' | 'task_comment' | 'attendance' | 'booking' | string;
  message: string;
  title?: string;
  link?: string;
  timeAgo: string;
  isRead: boolean;
  isToday: boolean;
  actorName?: string;
  entityId?: string;
  entityType?: string;
}
