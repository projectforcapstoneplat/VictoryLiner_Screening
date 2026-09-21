// Small, dependency-free CSV builder — good enough for exporting a flat
// table of applicant data, no need to pull in a library for this.
function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

// A CSV can't carry real styling (colors, a logo, fonts) — spreadsheet
// apps just render it as a plain grid, no matter what's in the file. What
// it CAN do is read like an actual export from this system instead of a
// bare data dump: a title, a generated-at stamp, and a summary of which
// filters produced this file, before the header/data rows. `title` and
// each `meta` line land on their own row with only the first column
// filled in — normal for a report-style CSV, and harmless in a plain
// table read (Excel/Sheets just show the rest of that row blank).
export function buildReportCsv({ title, meta = [], headers, rows }) {
  const lines = [escapeCsvCell(title)];
  for (const line of meta) lines.push(escapeCsvCell(line));
  lines.push('');
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
