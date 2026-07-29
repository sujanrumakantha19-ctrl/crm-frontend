import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, format
} from 'date-fns';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfMonth: number;
  key: string;
}

export function useCalendar(year: number, month: number): CalendarDay[] {
  return useMemo(() => {
    const currentMonth = new Date(year, month - 1);
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    return eachDayOfInterval({ start, end }).map(date => ({
      date,
      isCurrentMonth: isSameMonth(date, currentMonth),
      isToday: isToday(date),
      dayOfMonth: parseInt(format(date, 'd')),
      key: format(date, 'yyyy-MM-dd'),
    }));
  }, [year, month]);
}
