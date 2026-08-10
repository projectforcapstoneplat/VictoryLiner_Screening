// Small per-category glyphs for the open-role cards — keyed to the fixed
// JOB_CATEGORIES list (src/lib/jobCategories.js) so every category gets a
// distinct, recognizable icon instead of a generic bullet.
const ICON_PROPS = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICONS = {
  'Bus Driver': (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5V9.5M12 14.5V19.5M5.5 8L9 10.5M15 13.5L18.5 16M18.5 8L15 10.5M9 13.5L5.5 16" />
    </svg>
  ),
  Conductor: (
    <svg {...ICON_PROPS}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 0 0 0-3V9z" />
      <path d="M9 7v10" strokeDasharray="2 2" />
    </svg>
  ),
  'Mechanic / Maintenance Technician': (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  ),
  'Terminal Operations Staff': (
    <svg {...ICON_PROPS}>
      <path d="M21 10c0 6.5-9 12-9 12S3 16.5 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  'Dispatcher / Trip Scheduler': (
    <svg {...ICON_PROPS}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  ),
  'Customer Service / Ticketing': (
    <svg {...ICON_PROPS}>
      <path d="M3 13.5a9 9 0 0 1 18 0" />
      <path d="M21 14.5a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3zM3 14.5a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z" />
    </svg>
  ),
  'Cashier / Teller': (
    <svg {...ICON_PROPS}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  'Accounting & Finance': (
    <svg {...ICON_PROPS}>
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </svg>
  ),
  'Human Resources': (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M20 20a6.5 6.5 0 0 0-4-6" />
    </svg>
  ),
  'Administrative / Clerical': (
    <svg {...ICON_PROPS}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3.4" rx="1" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  'Security Guard': (
    <svg {...ICON_PROPS}>
      <path d="M12 2.5 4 6v6c0 5 3.4 8.6 8 9.5 4.6-.9 8-4.5 8-9.5V6l-8-3.5z" />
    </svg>
  ),
  'Safety & Compliance Inspector': (
    <svg {...ICON_PROPS}>
      <path d="M12 2.5 4 6v6c0 5 3.4 8.6 8 9.5 4.6-.9 8-4.5 8-9.5V6l-8-3.5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  'Information Technology': (
    <svg {...ICON_PROPS}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  'Marketing & Sales': (
    <svg {...ICON_PROPS}>
      <path d="M3 10.5 19 4v13L3 13.5v-3z" />
      <path d="M7 13.5v4a2 2 0 0 0 4 0v-3" />
    </svg>
  ),
  'Operations Supervisor / Management': (
    <svg {...ICON_PROPS}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg {...ICON_PROPS}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export function CategoryIcon({ category, className, style }) {
  return (
    <div
      className={['job-icon-badge', className].filter(Boolean).join(' ')}
      style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.25s ease', ...style }}
    >
      {ICONS[category] || DEFAULT_ICON}
    </div>
  );
}
export default CategoryIcon;
