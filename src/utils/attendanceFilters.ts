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

export function matchesStatusFilter(recordStatus: string, _durationStr: string, filterValue: string): boolean {
  if (!filterValue || filterValue === 'All') return true;

  if (filterValue === 'Below 4 Hours' || filterValue === '< 4 Hours' || filterValue === 'below_4') {
    return recordStatus === 'Absent' || recordStatus === 'Below 4 Hours';
  }

  return String(recordStatus).toLowerCase() === String(filterValue).toLowerCase();
}

