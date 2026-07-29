import type { Project, Plot, Lead, LeadStatus, AttendanceRecord, Task, Group, ActivityLog, ChannelPartner, Notification, User } from '@/types';

export const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500', 'bg-lime-500', 'bg-sky-500',
];

export function getAvatarColor(name?: any): string {
  if (!name || typeof name !== 'string') return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function getInitials(name?: any): string {
  if (!name || typeof name !== 'string') return 'U';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Users ───────────────────────────────────────────────────────────

export const adminUser: User = {
  id: 'u-admin', displayId: 'AD-1', name: 'Admin User', initials: 'AU', role: 'admin',
  designation: 'System Administrator', email: 'admin@crm.com', phone: '+91 98765 43210',
  avatarBg: getAvatarColor('Admin User'), isActive: true,
};

export const staffUsers: User[] = [
  { id: 'u1', displayId: 'STAFF-1', name: 'Priya Sharma', initials: 'PS', role: 'staff', designation: 'Senior Sales Executive', email: 'priya@crm.com', phone: '+91 98765 43211', avatarBg: getAvatarColor('Priya Sharma'), groupId: 'g1', dob: '1997-06-05', isActive: true },
  { id: 'u2', displayId: 'STAFF-2', name: 'Ravi Kumar', initials: 'RK', role: 'staff', designation: 'Sales Manager', email: 'ravi@crm.com', phone: '+91 98765 43212', avatarBg: getAvatarColor('Ravi Kumar'), groupId: 'g1', dob: '1990-03-15', isActive: true },
  { id: 'u3', displayId: 'STAFF-3', name: 'Ananya Reddy', initials: 'AR', role: 'staff', designation: 'Sales Executive', email: 'ananya@crm.com', phone: '+91 98765 43213', avatarBg: getAvatarColor('Ananya Reddy'), groupId: 'g2', dob: '1998-06-08', isActive: true },
  { id: 'u4', displayId: 'STAFF-4', name: 'Mohammed Irfan', initials: 'MI', role: 'staff', designation: 'Customer Support Lead', email: 'irfan@crm.com', phone: '+91 98765 43214', avatarBg: getAvatarColor('Mohammed Irfan'), groupId: 'g3', dob: '1992-09-20', isActive: true },
  { id: 'u5', displayId: 'STAFF-5', name: 'Sneha Gupta', initials: 'SG', role: 'staff', designation: 'Sales Executive', email: 'sneha@crm.com', phone: '+91 98765 43215', avatarBg: getAvatarColor('Sneha Gupta'), groupId: 'g2', dob: '1995-11-12', isActive: true },
  { id: 'u6', displayId: 'STAFF-6', name: 'Vikram Rao', initials: 'VR', role: 'staff', designation: 'Marketing Head', email: 'vikram@crm.com', phone: '+91 98765 43216', avatarBg: getAvatarColor('Vikram Rao'), groupId: 'g4', dob: '1988-06-10', isActive: true },
  { id: 'u7', displayId: 'STAFF-7', name: 'Deepak Joshi', initials: 'DJ', role: 'staff', designation: 'Sales Executive', email: 'deepak@crm.com', phone: '+91 98765 43217', avatarBg: getAvatarColor('Deepak Joshi'), groupId: 'g1', dob: '1993-08-03', isActive: true },
  { id: 'u8', displayId: 'STAFF-8', name: 'Lakshmi Menon', initials: 'LM', role: 'staff', designation: 'Customer Support', email: 'lakshmi@crm.com', phone: '+91 98765 43218', avatarBg: getAvatarColor('Lakshmi Menon'), groupId: 'g3', dob: '1994-12-25', isActive: true },
];

export const currentStaffUser = staffUsers[0]; // Priya Sharma

export const partnerUsers: User[] = [
  { id: 'up1', displayId: 'CP-1', name: 'Srinivas Associates', companyName: 'Srinivas Realty Pvt Ltd', reraId: 'A519000001', city: 'Hyderabad', initials: 'SA', role: 'partner', designation: 'Channel Partner', email: 'srinivas@realty.com', phone: '+91 98765 43301', avatarBg: getAvatarColor('Srinivas Associates'), isActive: true },
  { id: 'up2', displayId: 'CP-2', name: 'RealFirst Realty', companyName: 'RealFirst Estates', reraId: 'B519000023', city: 'Bengaluru', initials: 'RR', role: 'partner', designation: 'Channel Partner', email: 'info@realfirst.com', phone: '+91 98765 43302', avatarBg: getAvatarColor('RealFirst Realty'), isActive: true },
  { id: 'up3', displayId: 'CP-3', name: 'Lakshmi Properties', companyName: 'Lakshmi Builders', reraId: 'C519000011', city: 'Chennai', initials: 'LP', role: 'partner', designation: 'Channel Partner', email: 'contact@lakshmiprop.com', phone: '+91 98765 43303', avatarBg: getAvatarColor('Lakshmi Properties'), isActive: true },
  { id: 'up4', displayId: 'CP-4', name: 'Metro Homes', companyName: 'Metro Real Estate', reraId: 'P519000008', city: 'Pune', initials: 'MH', role: 'partner', designation: 'Channel Partner', email: 'info@metrohomes.com', phone: '+91 98765 43304', avatarBg: getAvatarColor('Metro Homes'), isActive: true },
  { id: 'up5', displayId: 'CP-5', name: 'South India Realty', companyName: 'SIR Developers', reraId: 'A519000045', city: 'Hyderabad', initials: 'SR', role: 'partner', designation: 'Channel Partner', email: 'contact@sirdev.com', phone: '+91 98765 43305', avatarBg: getAvatarColor('South India Realty'), isActive: true },
];

export const currentPartnerUser = partnerUsers[0]; // Srinivas Associates

// ─── Projects ────────────────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: 'p1', displayId: 'PROJ-1', name: 'Green Valley Enclave', location: 'Hyderabad',
    description: 'Premium residential plots with modern amenities in a serene green environment.',
    status: 'Active', totalLandArea: 25, landAreaUnit: 'Acres', surveyNumber: 'HYD-2024-001',
    village: 'Gachibowli', mandal: 'Serilingampally', district: 'Ranga Reddy', landType: 'Residential',
    totalPlots: 48, plotSize: 200, plotSizeUnit: 'Sq Yards', roadFacingPlots: 8, cornerPlots: 6,
    images: [
      '/plots/land_site_1.jpg',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1628744876497-eb30460be9f6?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1592595896551-12b371d546d5?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_1.jpg',
      '/plots/plot_sketch_2.jpg',
      'https://images.unsplash.com/photo-1524813686514-a57563d77965?q=80&w=1200&auto=format&fit=crop'
    ],
    createdAt: '2025-01-15',
    latitude: '17.4483', longitude: '78.3741', category: 'Open Plots', isEnabled: true,
    owner: { name: 'Venkata Land Holdings', phone: '+91 98480 11022', email: 'legal@venkatalands.com', address: 'Gachibowli, Hyderabad', kycDocuments: [{ id: 'od1', name: 'Seller Aadhaar.pdf', type: 'KYC', uploadedAt: '2025-01-12' }, { id: 'od2', name: 'Sale Deed Scan.pdf', type: 'PDF', uploadedAt: '2025-01-13' }] }
  },
  {
    id: 'p2', displayId: 'PROJ-2', name: 'Sunrise Township', location: 'Bengaluru',
    description: 'Large scale integrated township with residential and commercial spaces.',
    status: 'Active', totalLandArea: 80, landAreaUnit: 'Acres', surveyNumber: 'BLR-2024-012',
    village: 'Whitefield', mandal: 'Bangalore East', district: 'Bangalore Urban', landType: 'Mixed',
    totalPlots: 120, plotSize: 150, plotSizeUnit: 'Sq Yards', roadFacingPlots: 20, cornerPlots: 12,
    images: [
      '/plots/land_site_1.jpg',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_2.jpg',
      '/plots/plot_sketch_1.jpg'
    ],
    createdAt: '2025-02-01', latitude: '12.9716', longitude: '77.5946', category: 'Apartments', isEnabled: true,
    owner: { name: 'Sunrise Estates LLP', phone: '+91 98480 22033', address: 'Whitefield, Bengaluru', kycDocuments: [{ id: 'od3', name: 'Company PAN.pdf', type: 'KYC', uploadedAt: '2025-01-28' }] }
  },
  {
    id: 'p3', displayId: 'PROJ-3', name: 'Royal Meadows', location: 'Chennai',
    description: 'Luxury villa plots near the IT corridor with excellent connectivity.',
    status: 'Upcoming', totalLandArea: 40, landAreaUnit: 'Acres', surveyNumber: 'CHE-2024-008',
    village: 'OMR', mandal: 'Sholinganallur', district: 'Chengalpattu', landType: 'Residential',
    totalPlots: 80, plotSize: 300, plotSizeUnit: 'Sq Yards', roadFacingPlots: 10, cornerPlots: 8,
    images: [
      '/plots/land_site_1.jpg',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1628744876497-eb30460be9f6?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_1.jpg',
      '/plots/plot_sketch_2.jpg'
    ],
    createdAt: '2025-03-10', latitude: '13.0827', longitude: '80.2707', category: 'Open Plots', isEnabled: true,
    owner: { name: 'Royal Meadows Trust', phone: '+91 98480 33044', address: 'OMR, Chennai' }
  },
  {
    id: 'p4', displayId: 'PROJ-4', name: 'Urban Heights', location: 'Pune',
    description: 'High-rise ready commercial and residential plots in prime location.',
    status: 'Active', totalLandArea: 18, landAreaUnit: 'Acres', surveyNumber: 'PUN-2024-005',
    village: 'Hinjewadi', mandal: 'Mulshi', district: 'Pune', landType: 'Commercial',
    totalPlots: 64, plotSize: 180, plotSizeUnit: 'Sq Yards', roadFacingPlots: 12, cornerPlots: 8,
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_2.jpg',
      '/plots/plot_sketch_1.jpg'
    ],
    createdAt: '2025-01-20', latitude: '18.5204', longitude: '73.8567', category: 'Commercial', isEnabled: true,
    owner: { name: 'Urban Infra Partners', phone: '+91 98480 44055', address: 'Hinjewadi, Pune' }
  },
  {
    id: 'p5', displayId: 'PROJ-5', name: 'Lakeview Residency', location: 'Hyderabad',
    description: 'Waterfront plots with scenic views near the lake.',
    status: 'On Hold', totalLandArea: 12, landAreaUnit: 'Acres', surveyNumber: 'HYD-2024-009',
    village: 'Kokapet', mandal: 'Rajendranagar', district: 'Ranga Reddy', landType: 'Residential',
    totalPlots: 36, plotSize: 250, plotSizeUnit: 'Sq Yards', roadFacingPlots: 6, cornerPlots: 4,
    images: [
      '/plots/land_site_1.jpg',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_1.jpg'
    ],
    createdAt: '2025-04-01', latitude: '17.3850', longitude: '78.4867', category: 'Farm Land', isEnabled: true,
    owner: { name: 'Kokapet Family Estate', phone: '+91 98480 55066', address: 'Kokapet, Hyderabad' }
  },
  {
    id: 'p6', displayId: 'PROJ-6', name: 'Emerald Villas', location: 'Bengaluru',
    description: 'Premium villa plots with clubhouse and swimming pool.',
    status: 'Completed', totalLandArea: 8, landAreaUnit: 'Acres', surveyNumber: 'BLR-2024-003',
    village: 'Sarjapur', mandal: 'Anekal', district: 'Bangalore Urban', landType: 'Residential',
    totalPlots: 24, plotSize: 400, plotSizeUnit: 'Sq Yards', roadFacingPlots: 4, cornerPlots: 4,
    images: [
      '/plots/land_site_1.jpg',
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200&auto=format&fit=crop'
    ],
    plotImages: [
      '/plots/plot_sketch_2.jpg',
      '/plots/plot_sketch_1.jpg'
    ],
    createdAt: '2024-06-15', latitude: '12.9250', longitude: '77.7250', category: 'Villas', isEnabled: true,
    owner: { name: 'Emerald Homes Pvt Ltd', phone: '+91 98480 66077', address: 'Sarjapur, Bengaluru' }
  },
];

// ─── Plots ───────────────────────────────────────────────────────────

export function generatePlots(projectId: string, totalPlots: number): Plot[] {
  const plots: Plot[] = [];
  const facings = ['North', 'South', 'East', 'West', 'North East', 'North West', 'South East', 'South West'];
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const bookedPlots = projectId === 'p1' ? [1,2,3,4,5,6,7,8,9,10,11,12] :
                      projectId === 'p2' ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22] :
                      projectId === 'p3' ? [1,2,3,4] :
                      projectId === 'p4' ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18] :
                      projectId === 'p5' ? [1,2,3,4,5] :
                      projectId === 'p6' ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24] : [];

  const registeredPlots = projectId === 'p1' ? [1, 2, 3, 4] : projectId === 'p2' ? [1, 2, 3, 4, 5, 6] : projectId === 'p6' ? [1, 2, 3, 4, 5] : [];
  const pendingPlots = projectId === 'p1' ? [23] : [];
  const canceledPlots = projectId === 'p1' ? [15] : [];

  const customerNames = [
    'Suresh Patel', 'Kavitha Nair', 'Ramesh Babu', 'Deepa Menon', 'Arjun Reddy',
    'Lakshmi Devi', 'Karthik Iyer', 'Meena Joshi', 'Rajesh Sharma', 'Priya Menon',
    'Venkatesh Rao', 'Sunita Reddy', 'Manoj Bajpayee', 'Sunita Verma', 'Prakash Raj'
  ];

  const banks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Canara Bank'];

  for (let i = 1; i <= totalPlots; i++) {
    let status: Plot['status'] = 'Available';
    if (registeredPlots.includes(i)) status = 'Registered';
    else if (pendingPlots.includes(i)) status = 'Pending';
    else if (bookedPlots.includes(i)) status = 'Booked';
    else if (canceledPlots.includes(i)) status = 'Canceled';

    const project = projects.find(p => p.id === projectId);
    const isCorner = project?.cornerPlots ? i <= project.cornerPlots : false;
    
    const pendingApproval = projectId === 'p1' && i === 23 ? {
      leadId: 'lead-1040',
      customerName: 'Suresh Patel',
      phone: '+91 98765 11111',
      requestedBy: 'Priya Sharma',
      requestedAt: '2025-06-03 04:30 PM',
      paymentStatus: 'Partially Paid' as const,
      notes: 'Staff submitted booking request after site visit. Awaiting admin verification.',
    } : undefined;

    // Booked by info for booked/registered plots
    const custName = customerNames[(i - 1) % customerNames.length];
    const isReg = status === 'Registered';
    const isBooked = status === 'Booked';

    const expectedRegDate = isReg ? '2025-05-15' :
      i === 5 ? todayStr :
      i === 6 ? tomorrowStr :
      i === 7 ? '2025-06-10' :
      i === 8 ? '2025-06-15' : '2025-06-20';

    const bookedBy = (isBooked || isReg) ? {
      name: custName,
      phone: `+91 9876${String(50000 + i).slice(0, 5)}`,
      paymentStatus: (isReg ? 'Fully Paid' : i % 3 === 0 ? 'Not Paid' : i % 3 === 1 ? 'Partially Paid' : 'Fully Paid') as 'Not Paid' | 'Partially Paid' | 'Fully Paid',
      paymentMethod: (i % 2 === 0 ? 'LOAN' : 'CASH') as 'CASH' | 'LOAN',
      bank: banks[i % banks.length],
      bankFollowerName: 'Deepak Manager',
      bankFollowerPhone: '+91 98765 99999',
      advanceAmount: 100000,
      balanceAmount: isReg ? 0 : 800000,
      type: 'customer' as const,
    } : undefined;

    plots.push({
      id: `${projectId}-plot-${i}`,
      projectId,
      plotNumber: i,
      status,
      facing: isCorner ? 'Corner' : facings[i % facings.length],
      size: project?.plotSize || 200,
      sizeUnit: project?.plotSizeUnit || 'Sq Yards',
      type: project?.landType === 'Commercial' ? 'Commercial' : 'Residential',
      price: (project?.plotSize || 200) * 4500,
      expectedRegistrationDate: expectedRegDate,
      pendingApproval,
      bookedBy,
      timeline: status === 'Registered' || status === 'Booked' ? [
        { id: `e1-${i}`, type: 'booking_confirmed', label: 'Booking Confirmed', actor: bookedBy?.name || 'Customer', actorRole: 'Customer', date: '2025-05-28', details: `${status === 'Registered' ? 'Full payment completed - Registered' : bookedBy?.paymentStatus === 'Fully Paid' ? '₹9,00,000 paid (Full)' : bookedBy?.paymentStatus === 'Partially Paid' ? '₹4,50,000 paid (Partial)' : 'Payment pending'}`, color: status === 'Registered' ? 'blue' : 'green', actorType: 'customer' },
        { id: `e2-${i}`, type: 'qualified', label: 'Lead converted to Qualified', actor: 'Priya Sharma', actorRole: 'ST', date: '2025-05-25', color: 'blue', actorType: 'staff' },
        { id: `e3-${i}`, type: 'reserved', label: 'Plot reserved', actor: 'Priya Sharma', actorRole: 'ST', date: '2025-05-24', color: 'amber', actorType: 'staff' },
        { id: `e4-${i}`, type: 'lead_added', label: 'Channel Partner added as Open Lead', actor: 'Srinivas Associates', actorRole: 'Channel Partner', date: '2025-05-20', color: 'green', actorType: 'partner' },
      ] : status === 'Pending' ? [
        { id: `e1-${i}`, type: 'reserved', label: 'Booking request submitted - Pending Approval', actor: 'Priya Sharma', actorRole: 'ST', date: '2025-06-02', color: 'amber', actorType: 'staff' },
        { id: `e2-${i}`, type: 'lead_added', label: 'Lead added by Channel Partner', actor: 'Srinivas Associates', actorRole: 'Channel Partner', date: '2025-05-28', color: 'green', actorType: 'partner' },
      ] : status === 'Canceled' ? [
        { id: `e1-${i}`, type: 'booking_canceled', label: 'Booking Canceled', actor: 'Ravi Kumar', actorRole: 'ST', date: '2025-05-20', color: 'red', actorType: 'staff' },
        { id: `e2-${i}`, type: 'booking_confirmed', label: 'Booking Confirmed', actor: 'Ananya Reddy', actorRole: 'ST', date: '2025-05-15', details: '₹9,00,000 paid (Full)', color: 'green', actorType: 'staff' },
      ] : [],
    });
  }
  return plots;
}

export const allPlots: Record<string, Plot[]> = {};
projects.forEach(p => { allPlots[p.id] = generatePlots(p.id, p.totalPlots); });

// ─── Leads ───────────────────────────────────────────────────────────

const leadNames = [
  { name: 'Suresh Patel', phone: '+91 98765 11111', email: 'suresh.patel@gmail.com', city: 'Hyderabad', dob: '1985-03-15' },
  { name: 'Kavitha Nair', phone: '+91 98765 22222', email: 'kavitha.n@yahoo.com', city: 'Bengaluru', dob: '1990-07-22' },
  { name: 'Ramesh Babu', phone: '+91 98765 33333', email: 'ramesh.babu@outlook.com', city: 'Chennai', dob: '1988-11-03' },
  { name: 'Deepa Menon', phone: '+91 98765 44444', email: 'deepa.menon@gmail.com', city: 'Pune', dob: '1992-01-14' },
  { name: 'Arjun Reddy', phone: '+91 98765 55555', email: 'arjun.reddy@gmail.com', city: 'Hyderabad', dob: '1995-09-28' },
  { name: 'Lakshmi Devi', phone: '+91 98765 66666', email: 'lakshmi.devi@yahoo.com', city: 'Chennai', dob: '1987-12-05' },
  { name: 'Karthik Iyer', phone: '+91 98765 77777', email: 'karthik.i@gmail.com', city: 'Bengaluru', dob: '1993-04-17' },
  { name: 'Meena Joshi', phone: '+91 98765 88888', email: 'meena.j@outlook.com', city: 'Pune', dob: '1991-08-30' },
  { name: 'Rajesh Sharma', phone: '+91 98765 99999', email: 'rajesh.s@gmail.com', city: 'Hyderabad', dob: '1984-05-12' },
  { name: 'Priya Menon', phone: '+91 98765 00000', email: 'priya.m@yahoo.com', city: 'Bengaluru', dob: '1989-10-20' },
  { name: 'Venkatesh Rao', phone: '+91 98766 11111', email: 'venkat.r@gmail.com', city: 'Hyderabad', dob: '1982-08-15' },
  { name: 'Sunita Reddy', phone: '+91 98766 22222', email: 'sunita.r@outlook.com', city: 'Chennai', dob: '1991-02-28' },

  // Open Pool Leads (Unassigned)
  { name: 'Vijay Kumar', phone: '+91 98765 99001', email: 'vijay.k@gmail.com', city: 'Hyderabad', dob: '1984-05-12' },
  { name: 'Anitha Sharma', phone: '+91 98765 99002', email: 'anitha.s@gmail.com', city: 'Bengaluru', dob: '1989-10-20' },
  { name: 'Rajesh Sen', phone: '+91 98765 99003', email: 'rajesh.s@yahoo.com', city: 'Kolkata', dob: '1982-08-15' },
  { name: 'Priya Dharshini', phone: '+91 98765 99004', email: 'priya.d@outlook.com', city: 'Chennai', dob: '1991-02-28' },
  { name: 'Amit Verma', phone: '+91 98765 99005', email: 'amit.v@gmail.com', city: 'Pune', dob: '1987-04-24' },
  { name: 'Sneha Reddy', phone: '+91 98765 99006', email: 'sneha.r@gmail.com', city: 'Hyderabad', dob: '1993-11-08' },
  { name: 'Harish Rao', phone: '+91 98765 99007', email: 'harish.rao@yahoo.com', city: 'Hyderabad', dob: '1980-06-30' },
  { name: 'Divya Teja', phone: '+91 98765 99008', email: 'divya.t@gmail.com', city: 'Bengaluru', dob: '1995-07-18' },

  // Customer & Qualified Leads
  { name: 'Sanjay Dutt', phone: '+91 98765 99009', email: 'sanjay.d@outlook.com', city: 'Mumbai', dob: '1979-01-25' },
  { name: 'Nisha Gupta', phone: '+91 98765 99010', email: 'nisha.g@gmail.com', city: 'Delhi', dob: '1992-09-04' },
  { name: 'Manoj Bajpayee', phone: '+91 98765 99011', email: 'manoj.b@gmail.com', city: 'Patna', dob: '1975-04-23' },
  { name: 'Sunita Verma', phone: '+91 98765 99012', email: 'sunita.v@gmail.com', city: 'Hyderabad', dob: '1986-07-09' },
  { name: 'Prakash Raj', phone: '+91 98765 99013', email: 'prakash.r@yahoo.com', city: 'Bengaluru', dob: '1981-12-19' },
  { name: 'Anjali Kapoor', phone: '+91 98765 99014', email: 'anjali.k@outlook.com', city: 'Chennai', dob: '1990-05-14' },
  { name: 'Ravi Teja', phone: '+91 98765 99015', email: 'ravi.t@gmail.com', city: 'Hyderabad', dob: '1983-10-01' },
  { name: 'Geeta Shenoy', phone: '+91 98765 99016', email: 'geeta.s@yahoo.com', city: 'Pune', dob: '1988-09-12' },
];

function generateLeads(): Lead[] {
  const cpSources = ['Srinivas Associates', 'RealFirst Realty', 'Lakshmi Properties', 'Metro Homes', 'South India Realty'];
  const directSources = ['Website', 'Walk-In', 'Phone Call', 'Social Media', 'Newspaper Ad'];
  const statuses: LeadStatus[] = ['Open', 'Qualified', 'Unqualified', 'Customer'];
  const interests = ['Residential Plot', 'Villa', 'Commercial', 'Apartment', 'Farm Land'];
  const todayStr = new Date().toISOString().split('T')[0];

  return leadNames.map((l, i) => {
    const isCP = i % 2 === 0;
    const isUnassignedPool = i >= 12 && i < 20; // 8 leads for pool
    const isCustomer = i >= 20 || i === 3 || i === 8;
    const isQualified = (i % 4 === 1 && !isUnassignedPool) || i === 1 || i === 6;
    const isUnqualified = i === 4;

    const status: LeadStatus = isCustomer ? 'Customer' : isQualified ? 'Qualified' : isUnqualified ? 'Unqualified' : 'Open';
    const assignedStaff = isUnassignedPool ? undefined : staffUsers[i % staffUsers.length];

    return {
      id: `lead-${1040 + i}`,
      displayId: `L-${i + 1}`,
      customerName: l.name,
      phone: l.phone,
      email: l.email,
      city: l.city,
      dob: l.dob,
      budgetMin: 500000 + (i * 100000),
      budgetMax: 1500000 + (i * 200000),
      propertyInterest: interests[i % interests.length],
      notes: `Interested in ${interests[i % interests.length].toLowerCase()} in ${l.city}`,
      source: isCP ? cpSources[i % cpSources.length] : directSources[i % directSources.length],
      sourceType: isCP ? 'Channel Partner' : 'Direct',
      assignedTo: assignedStaff?.id,
      assignedToName: assignedStaff?.name,
      assignedToDisplayId: assignedStaff?.displayId,
      status,
      dateAdded: `2025-05-${(i % 20) + 1}`,
      projectId: projects[i % projects.length].id,
      paymentStatus: isCustomer ? (i % 2 === 0 ? 'Fully Paid' : 'Partially Paid') : undefined,
      paymentMethod: isCustomer ? (i % 2 === 0 ? 'CASH' : 'LOAN') : undefined,
      bank: isCustomer ? 'HDFC Bank' : undefined,
      bankFollowerName: isCustomer ? 'Deepak Manager' : undefined,
      bankFollowerPhone: isCustomer ? '+91 98765 99999' : undefined,
      advanceAmount: isCustomer ? 100000 : undefined,
      balanceAmount: isCustomer ? (i % 2 === 0 ? 0 : 500000) : undefined,
      followUps: !isUnassignedPool ? [
        {
          id: `fu-${i}-1`,
          date: todayStr,
          nextFollowUpDate: `2025-06-10`,
          notes: `Spoke with ${l.name}. Discussed layout plans, site visit requested for weekend.`,
          outcome: 'Positive',
          nextAction: 'Schedule site visit'
        },
        {
          id: `fu-${i}-2`,
          date: '2025-05-25',
          nextFollowUpDate: todayStr,
          notes: 'Initial contact made, shared digital brochure on WhatsApp.',
          outcome: 'Interested',
          nextAction: 'Call for budget discussion'
        },
      ] : undefined,
    };
  });
}

export const leads = generateLeads();

// ─── Attendance ──────────────────────────────────────────────────────

const todayStr = new Date().toISOString().split('T')[0];

export const attendanceRecords: AttendanceRecord[] = [
  { id: 'a1', staffId: 'u1', staffName: 'Priya Sharma', date: todayStr, checkIn: '09:02 AM', checkOut: '06:15 PM', duration: '9h 13m', status: 'Present', role: 'Senior Sales Executive' },
  { id: 'a2', staffId: 'u2', staffName: 'Ravi Kumar', date: todayStr, checkIn: '09:15 AM', checkOut: '06:30 PM', duration: '9h 15m', status: 'Present', role: 'Sales Manager' },
  { id: 'a3', staffId: 'u3', staffName: 'Ananya Reddy', date: todayStr, checkIn: '08:55 AM', checkOut: '06:00 PM', duration: '9h 5m', status: 'Present', role: 'Sales Executive' },
  { id: 'a4', staffId: 'u4', staffName: 'Mohammed Irfan', date: todayStr, checkIn: '09:30 AM', checkOut: '06:45 PM', duration: '9h 15m', status: 'Present', role: 'Customer Support Lead' },
  { id: 'a5', staffId: 'u5', staffName: 'Sneha Gupta', date: todayStr, status: 'Absent', role: 'Sales Executive' },
  { id: 'a6', staffId: 'u6', staffName: 'Vikram Rao', date: todayStr, checkIn: '10:00 AM', checkOut: '02:00 PM', duration: '4h', status: 'Half Day', role: 'Marketing Head' },
  { id: 'a7', staffId: 'u7', staffName: 'Deepak Joshi', date: todayStr, checkIn: '09:10 AM', checkOut: '06:20 PM', duration: '9h 10m', status: 'Present', role: 'Sales Executive' },
  { id: 'a8', staffId: 'u8', staffName: 'Lakshmi Menon', date: todayStr, checkIn: '08:45 AM', checkOut: '06:30 PM', duration: '9h 45m', status: 'Present', role: 'Customer Support' },

  // Past dates attendance records
  { id: 'a9', staffId: 'u1', staffName: 'Priya Sharma', date: '2025-06-02', checkIn: '09:00 AM', checkOut: '06:00 PM', duration: '9h', status: 'Present', role: 'Senior Sales Executive' },
  { id: 'a10', staffId: 'u2', staffName: 'Ravi Kumar', date: '2025-06-02', checkIn: '09:05 AM', checkOut: '06:10 PM', duration: '9h 5m', status: 'Present', role: 'Sales Manager' },
  { id: 'a11', staffId: 'u3', staffName: 'Ananya Reddy', date: '2025-06-02', checkIn: '09:12 AM', checkOut: '06:00 PM', duration: '8h 48m', status: 'Present', role: 'Sales Executive' },
  { id: 'a12', staffId: 'u4', staffName: 'Mohammed Irfan', date: '2025-06-02', checkIn: '09:25 AM', checkOut: '06:30 PM', duration: '9h 5m', status: 'Present', role: 'Customer Support Lead' },
  { id: 'a13', staffId: 'u5', staffName: 'Sneha Gupta', date: '2025-06-02', checkIn: '09:00 AM', checkOut: '06:00 PM', duration: '9h', status: 'Present', role: 'Sales Executive' },
  { id: 'a14', staffId: 'u6', staffName: 'Vikram Rao', date: '2025-06-02', checkIn: '09:30 AM', checkOut: '06:30 PM', duration: '9h', status: 'Present', role: 'Marketing Head' },
  { id: 'a15', staffId: 'u7', staffName: 'Deepak Joshi', date: '2025-06-02', checkIn: '09:08 AM', checkOut: '06:15 PM', duration: '9h 7m', status: 'Present', role: 'Sales Executive' },
  { id: 'a16', staffId: 'u8', staffName: 'Lakshmi Menon', date: '2025-06-02', checkIn: '08:50 AM', checkOut: '06:20 PM', duration: '9h 30m', status: 'Present', role: 'Customer Support' },
];

// ─── Tasks ───────────────────────────────────────────────────────────

export const tasks: Task[] = [
  { id: 't1', title: 'Call Suresh Patel for site visit', description: 'Follow up on the site visit request for Green Valley Enclave. Customer is interested in Plot #24.', status: 'To Do', priority: 'High', assignee: 'Priya Sharma', assigneeInitials: 'PS', dueDate: '2025-06-04', project: 'Green Valley Enclave', comments: [], createdAt: '2025-06-01' },
  { id: 't2', title: 'Prepare Green Valley brochure', description: 'Create updated brochure with available plots.', status: 'To Do', priority: 'Medium', assignee: 'Vikram Rao', assigneeInitials: 'VR', dueDate: '2025-06-05', project: 'Green Valley Enclave', comments: [], createdAt: '2025-05-30' },
  { id: 't3', title: 'Update Plot #23 status', description: 'Status needs revision based on market analysis for corner plots.', status: 'To Do', priority: 'Low', assignee: 'Ravi Kumar', assigneeInitials: 'RK', dueDate: '2025-06-06', project: 'Green Valley Enclave', comments: [], createdAt: '2025-06-02' },
  { id: 't4', title: 'Follow-up with Kavitha Nair', description: 'Kavitha showed interest in Sunrise Township. Need to discuss financing options.', status: 'In Progress', priority: 'High', assignee: 'Priya Sharma', assigneeInitials: 'PS', dueDate: '2025-06-03', project: 'Sunrise Township', comments: [{ id: 'c1', author: 'Ravi Kumar', authorInitials: 'RK', text: 'Customer asked about home loan assistance', timestamp: '2025-06-02 04:30 PM' }], createdAt: '2025-05-28' },
  { id: 't5', title: 'Schedule meeting with Srinivas Associates', description: 'Quarterly review meeting to discuss lead quality and conversion rates.', status: 'In Progress', priority: 'Medium', assignee: 'Ravi Kumar', assigneeInitials: 'RK', dueDate: '2025-06-05', project: 'General', comments: [], createdAt: '2025-05-25' },
  { id: 't6', title: 'Review Royal Meadows layout plan', description: 'Verify the approved layout against the actual site measurements.', status: 'In Progress', priority: 'Medium', assignee: 'Ananya Reddy', assigneeInitials: 'AR', dueDate: '2025-06-04', project: 'Royal Meadows', comments: [], createdAt: '2025-06-01' },
  { id: 't7', title: 'Process Plot #15 cancellation', description: 'Complete the refund process and update plot status to Available.', status: 'In Progress', priority: 'High', assignee: 'Mohammed Irfan', assigneeInitials: 'MI', dueDate: '2025-06-03', project: 'Green Valley Enclave', comments: [], createdAt: '2025-06-02' },
  { id: 't8', title: 'Verify Ramesh Babu documents', description: 'Check identity proof, address proof, and income documents for booking.', status: 'In Review', priority: 'Medium', assignee: 'Ananya Reddy', assigneeInitials: 'AR', dueDate: '2025-06-03', project: 'Sunrise Township', comments: [], createdAt: '2025-05-29' },
  { id: 't9', title: 'Approve Deepa Menon booking', description: 'Review the booking form and payment receipt for Plot #18.', status: 'In Review', priority: 'High', assignee: 'Ravi Kumar', assigneeInitials: 'RK', dueDate: '2025-06-03', project: 'Urban Heights', comments: [], createdAt: '2025-06-01' },
  { id: 't10', title: 'Confirm Plot #12 booking', description: 'Final confirmation and handover of documents to customer.', status: 'Done', priority: 'High', assignee: 'Priya Sharma', assigneeInitials: 'PS', dueDate: '2025-06-01', project: 'Green Valley Enclave', comments: [{ id: 'c2', author: 'Ravi Kumar', authorInitials: 'RK', text: 'Booking confirmed, documents handed over', timestamp: '2025-06-01 02:00 PM' }], createdAt: '2025-05-25' },
  { id: 't11', title: 'Resolve plot dispute', description: 'Customer questioned the difference between road-facing and normal plots.', status: 'Done', priority: 'Medium', assignee: 'Ravi Kumar', assigneeInitials: 'RK', dueDate: '2025-05-30', project: 'Green Valley Enclave', comments: [], createdAt: '2025-05-20' },
  { id: 't12', title: 'Onboard RealFirst Realty', description: 'Complete the channel partner onboarding process and add to the system.', status: 'Done', priority: 'Low', assignee: 'Admin', assigneeInitials: 'AU', dueDate: '2025-05-28', project: 'General', comments: [], createdAt: '2025-05-15' },
  { id: 't13', title: 'Update staff attendance policy', description: 'Revise the attendance policy document with new WFH guidelines.', status: 'Done', priority: 'Low', assignee: 'Mohammed Irfan', assigneeInitials: 'MI', dueDate: '2025-05-25', project: 'General', comments: [], createdAt: '2025-05-20' },
  { id: 't14', title: 'Close Q1 review', description: 'Finalize the quarterly sales report and present to management.', status: 'Done', priority: 'Medium', assignee: 'Ravi Kumar', assigneeInitials: 'RK', dueDate: '2025-05-20', project: 'General', comments: [], createdAt: '2025-05-10' },
  { id: 't15', title: 'Collect balance payment for Plot #5', description: 'Remind Sunita Verma about remaining 20% payment before registration date.', status: 'To Do', priority: 'High', assignee: 'Priya Sharma', assigneeInitials: 'PS', dueDate: '2025-06-08', project: 'Green Valley Enclave', comments: [], createdAt: '2025-06-03' },
  { id: 't16', title: 'Prepare EC for Emerald Villas plots', description: 'Apply for Encumbrance Certificate for Sarjapur plots with sub-registrar office.', status: 'In Progress', priority: 'Medium', assignee: 'Sneha Gupta', assigneeInitials: 'SG', dueDate: '2025-06-09', project: 'Emerald Villas', comments: [], createdAt: '2025-06-02' },
];

// ─── Groups ──────────────────────────────────────────────────────────

export const groups: Group[] = [
  { id: 'g1', name: 'Sales Team A', description: 'Hyderabad region sales', members: ['u1', 'u2', 'u7'], createdAt: '2025-05-01' },
  { id: 'g2', name: 'Sales Team B', description: 'Bengaluru region sales', members: ['u3', 'u5'], createdAt: '2025-05-01' },
  { id: 'g3', name: 'Customer Support', description: 'Post-sales support team', members: ['u4', 'u8'], createdAt: '2025-04-15' },
  { id: 'g4', name: 'Marketing', description: 'Digital and field marketing', members: ['u6'], createdAt: '2025-04-20' },
];

// ─── Activity Logs ───────────────────────────────────────────────────

export const activityLogs: ActivityLog[] = [
  { id: 'log1', actorId: 'u2', actorName: 'Ravi Kumar', actorRole: 'Staff', actorInitials: 'RK', actorAvatarBg: getAvatarColor('Ravi Kumar'), action: 'Created new lead #1051', actionType: 'Created', entityType: 'Lead', entityId: 'lead-11', entityName: 'Suresh Patel', timestamp: '2025-06-03T10:30:00', ipAddress: '192.168.1.45' },
  { id: 'log2', actorId: 'u1', actorName: 'Priya Sharma', actorRole: 'Staff', actorInitials: 'PS', actorAvatarBg: getAvatarColor('Priya Sharma'), action: 'Updated lead #1042 status from Open to Qualified', actionType: 'Status Change', entityType: 'Lead', entityId: 'lead-2', entityName: 'Rajesh Sharma', timestamp: '2025-06-03T09:15:00', ipAddress: '192.168.1.42' },
  { id: 'log3', actorId: 'u-admin', actorName: 'Admin', actorRole: 'Admin', actorInitials: 'AU', actorAvatarBg: getAvatarColor('Admin User'), action: 'Changed project status from Planning to Active', actionType: 'Status Change', entityType: 'Project', entityId: 'p2', entityName: 'Sunrise Township', timestamp: '2025-06-02T16:00:00', ipAddress: '192.168.1.1' },
  { id: 'log4', actorId: 'u4', actorName: 'Mohammed Irfan', actorRole: 'Staff', actorInitials: 'MI', actorAvatarBg: getAvatarColor('Mohammed Irfan'), action: 'Deleted duplicate lead #1039', actionType: 'Deleted', entityType: 'Lead', entityId: 'lead-9', entityName: 'Lead #1039', timestamp: '2025-06-02T14:30:00', ipAddress: '192.168.1.48' },
  { id: 'log5', actorId: 'up1', actorName: 'Srinivas Associates', actorRole: 'Channel Partner', actorInitials: 'SA', actorAvatarBg: getAvatarColor('Srinivas Associates'), action: 'Submitted new lead #1050', actionType: 'Created', entityType: 'Lead', entityId: 'lead-10', entityName: 'Kavitha Nair', timestamp: '2025-06-02T11:00:00', ipAddress: '203.45.67.89' },
  { id: 'log6', actorId: 'u3', actorName: 'Ananya Reddy', actorRole: 'Staff', actorInitials: 'AR', actorAvatarBg: getAvatarColor('Ananya Reddy'), action: 'Updated Plot #23 status to Reserved', actionType: 'Updated', entityType: 'Plot', entityId: 'p1-plot-23', entityName: 'Plot #23 — Green Valley Enclave', timestamp: '2025-06-01T15:45:00', ipAddress: '192.168.1.44' },
  { id: 'log7', actorId: 'u-admin', actorName: 'Admin', actorRole: 'Admin', actorInitials: 'AU', actorAvatarBg: getAvatarColor('Admin User'), action: 'Changed staff role from Sales to Manager', actionType: 'Status Change', entityType: 'Staff', entityId: 'u6', entityName: 'Vikram Rao', timestamp: '2025-06-01T10:00:00', ipAddress: '192.168.1.1' },
  { id: 'log8', actorId: 'up2', actorName: 'RealFirst Realty', actorRole: 'Channel Partner', actorInitials: 'RR', actorAvatarBg: getAvatarColor('RealFirst Realty'), action: 'Created channel partner account', actionType: 'Created', entityType: 'Channel Partner', entityId: 'up2', entityName: 'RealFirst Realty', timestamp: '2025-05-31T17:00:00', ipAddress: '203.45.67.90' },
  { id: 'log9', actorId: 'u1', actorName: 'Priya Sharma', actorRole: 'Staff', actorInitials: 'PS', actorAvatarBg: getAvatarColor('Priya Sharma'), action: 'Recorded follow-up note for Suresh Patel', actionType: 'Updated', entityType: 'Lead', entityId: 'lead-1040', entityName: 'Suresh Patel', timestamp: '2025-06-03T11:45:00', ipAddress: '192.168.1.42' },
  { id: 'log10', actorId: 'u5', actorName: 'Sneha Gupta', actorRole: 'Staff', actorInitials: 'SG', actorAvatarBg: getAvatarColor('Sneha Gupta'), action: 'Uploaded EC document for Emerald Villas', actionType: 'Created', entityType: 'Project', entityId: 'p6', entityName: 'Emerald Villas', timestamp: '2025-06-03T14:10:00', ipAddress: '192.168.1.47' },
];

// ─── Channel Partners ────────────────────────────────────────────────

export const channelPartners: ChannelPartner[] = [
  { id: 'cp1', displayId: 'CP-1', name: 'Srinivas Associates', companyName: 'Srinivas Realty Pvt Ltd', phone: '+91 98490 12345', email: 'srinivas@realty.com', city: 'Hyderabad', reraId: 'A519000001', totalLeads: 45, isActive: true, initials: 'SA', avatarBg: getAvatarColor('Srinivas Associates') },
  { id: 'cp2', displayId: 'CP-2', name: 'RealFirst Realty', companyName: 'RealFirst Estates', phone: '+91 98490 12346', email: 'info@realfirst.com', city: 'Bengaluru', reraId: 'B519000023', totalLeads: 32, isActive: true, initials: 'RR', avatarBg: getAvatarColor('RealFirst Realty') },
  { id: 'cp3', displayId: 'CP-3', name: 'Lakshmi Properties', companyName: 'Lakshmi Builders', phone: '+91 98490 12347', email: 'contact@lakshmiprop.com', city: 'Chennai', reraId: 'C519000011', totalLeads: 18, isActive: true, initials: 'LP', avatarBg: getAvatarColor('Lakshmi Properties') },
  { id: 'cp4', displayId: 'CP-4', name: 'Metro Homes', companyName: 'Metro Real Estate', phone: '+91 98490 12348', email: 'info@metrohomes.com', city: 'Pune', reraId: 'P519000008', totalLeads: 12, isActive: true, initials: 'MH', avatarBg: getAvatarColor('Metro Homes') },
  { id: 'cp5', displayId: 'CP-5', name: 'South India Realty', companyName: 'SIR Developers', phone: '+91 98490 12349', email: 'contact@sirdev.com', city: 'Hyderabad', reraId: 'A519000045', totalLeads: 28, isActive: true, initials: 'SR', avatarBg: getAvatarColor('South India Realty') },
];

// ─── Notifications ───────────────────────────────────────────────────

export const notifications: Notification[] = [
  { id: 'n1', type: 'birthday', message: "Priya Sharma's birthday is today!", timeAgo: '2h ago', isRead: false, isToday: true, actorName: 'Priya Sharma' },
  { id: 'n2', type: 'lead_status', message: 'Lead #1042 status changed to Qualified', timeAgo: '3h ago', isRead: false, isToday: true },
  { id: 'n3', type: 'new_lead', message: 'New lead submitted by Srinivas Associates', timeAgo: '3h ago', isRead: false, isToday: true },
  { id: 'n4', type: 'task_assigned', message: "Task 'Follow-up with Suresh Patel' assigned to you", timeAgo: '5h ago', isRead: true, isToday: false },
  { id: 'n5', type: 'attendance', message: 'Ravi Kumar checked in at 09:15 AM', timeAgo: '8h ago', isRead: true, isToday: false },
  { id: 'n6', type: 'booking', message: 'Booking confirmed for Plot #47 — Royal Meadows', timeAgo: '1d ago', isRead: true, isToday: false },
];

// ─── Dashboard Metrics ───────────────────────────────────────────────

export const dashboardMetrics = {
  totalProjects: projects.length,
  totalLeads: leads.length,
  staffPresent: attendanceRecords.filter(a => a.status === 'Present').length,
  staffTotal: staffUsers.length,
  plotsBookedThisMonth: 34,
};

// ─── Recent Activity ─────────────────────────────────────────────────

export const recentActivity = [
  { color: 'bg-green-500', text: 'converted lead #1042 to confirmed booking', actor: 'Ravi Kumar', timestamp: '2h ago' },
  { color: 'bg-blue-500', text: 'New lead #1051 submitted by Srinivas Associates', actor: '', timestamp: '3h ago' },
  { color: 'bg-amber-500', text: 'reserved Plot #23 in Green Valley Enclave', actor: 'Priya Sharma', timestamp: '5h ago' },
  { color: 'bg-purple-500', text: "Task 'Site visit follow-up' assigned to Ananya Reddy", actor: '', timestamp: '6h ago' },
  { color: 'bg-red-500', text: 'Booking for Plot #15 in Sunrise Township was canceled', actor: '', timestamp: '8h ago' },
  { color: 'bg-gray-400', text: 'checked in at 09:15 AM', actor: 'Mohammed Irfan', timestamp: '9h ago' },
];

// ─── Upcoming Birthdays ──────────────────────────────────────────────

export const upcomingBirthdays = [
  { name: 'Priya Sharma', initials: 'PS', date: 'June 5', bg: getAvatarColor('Priya Sharma') },
  { name: 'Ananya Reddy', initials: 'AR', date: 'June 8', bg: getAvatarColor('Ananya Reddy') },
  { name: 'Vikram Rao', initials: 'VR', date: 'June 10', bg: getAvatarColor('Vikram Rao') },
];
