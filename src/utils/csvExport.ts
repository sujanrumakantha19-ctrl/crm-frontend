/**
 * Utility to export an array of objects to a CSV file and trigger browser download
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: { key: keyof T | string; label: string; formatter?: (val: any, item: T) => string }[]
) {
  if (!data || data.length === 0) {
    import('sonner').then(m => m.toast.error('No data available to export'));
    return;
  }

  // Header row
  const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

  // Data rows
  const rows = data.map(item => {
    return columns
      .map(col => {
        let val: any;
        if (typeof col.key === 'string' && col.key.includes('.')) {
          // Handle nested keys like 'assignedTo.name'
          val = col.key.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), item);
        } else {
          val = item[col.key as keyof T];
        }

        if (col.formatter) {
          val = col.formatter(val, item);
        }

        if (val === null || val === undefined) {
          val = '';
        } else if (typeof val === 'object') {
          val = JSON.stringify(val);
        } else {
          val = String(val);
        }

        // Escape double quotes
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  import('sonner').then(m => m.toast.success(`Exported ${data.length} records to CSV`));
}
