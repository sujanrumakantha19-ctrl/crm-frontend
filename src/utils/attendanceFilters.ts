export function parseDurationHours(durationStr?: string): number {
  if (!durationStr || durationStr === '-' || durationStr === '—') return 0;
  const match = String(durationStr).match(/(\d+)\s*h(?:ours?)?\s*(\d*)\s*m?/i);
  if (match) {
    const hrs = parseInt(match[1], 10) || 0;
    const mins = match[2] ? (parseInt(match[2], 10) || 0) : 0;
    return hrs + (mins / 60);
  }
  const minOnlyMatch = String(durationStr).match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (minOnlyMatch) {
    const mins = parseInt(minOnlyMatch[1], 10) || 0;
    return mins / 60;
  }
  return 0;
}

export function matchesStatusFilter(recordStatus: string, durationStr: string, filterValue: string): boolean {
  if (!filterValue || filterValue === 'All') return true;

  const hours = parseDurationHours(durationStr);

  if (filterValue === 'Present') {
    if (recordStatus === 'Present') return true;
    if (hours >= 1.0) return true;
    return false;
  }

  if (filterValue === 'Half Day') {
    if (recordStatus === 'Half Day') return true;
    if (hours >= 4.5 && hours <= 6.0) return true;
    return false;
  }

  if (filterValue === 'Below 4 Hours' || filterValue === '< 4 Hours' || filterValue === 'below_4') {
    if (hours > 0 && hours < 4.0) return true;
    if (recordStatus === 'Below 4 Hours') return true;
    return false;
  }

  return recordStatus === filterValue;
}
