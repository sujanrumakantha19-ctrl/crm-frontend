import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function PartnerAttendance() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const monthlyData = [
    { date: 'Jun 1', checkIn: '09:10 AM', checkOut: '06:00 PM', duration: '8h 50m', status: 'Present' as const },
    { date: 'Jun 2', checkIn: '09:30 AM', checkOut: '06:15 PM', duration: '8h 45m', status: 'Present' as const },
    { date: 'May 30', checkIn: '-', checkOut: '-', duration: '-', status: 'Absent' as const },
    { date: 'May 28', checkIn: '09:00 AM', checkOut: '06:30 PM', duration: '9h 30m', status: 'Present' as const },
    { date: 'May 27', checkIn: '09:20 AM', checkOut: '01:00 PM', duration: '3h 40m', status: 'Half Day' as const },
  ];

  const handleCheckIn = () => {
    const now = new Date();
    setCheckInTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    setCheckedIn(true);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-md mx-auto bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Today</p>
        <h2 className="text-xl font-bold text-slate-900 mb-6">{dateStr}</h2>

        {!checkedIn ? (
          <button
            onClick={handleCheckIn}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold rounded-lg active:scale-[0.98] transition-all"
          >
            Check In
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-emerald-600 font-semibold">Checked in at {checkInTime}</p>
            <button
              onClick={() => setCheckedIn(false)}
              className="w-full h-11 border-2 border-red-400 text-red-500 font-semibold rounded-lg hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              Check Out
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-4">This Month&apos;s Attendance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Date', 'Check-in', 'Check-out', 'Duration', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyData.map((row, i) => (
                <tr key={i} className={`hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-3 text-sm text-slate-800">{row.date}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.checkIn}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.checkOut}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.duration}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
