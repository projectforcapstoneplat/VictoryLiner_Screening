// figma reference: "Group 10" (Facebook) + "pajamas:twitter" circular social icons, footer
import React from 'react';

// Each icon's path has its own natural bounding box — sharing one viewBox
// across both (as before) stretched/cropped whichever one didn't match it.
const PATH_ICONS = {
  facebook: {
    viewBox: '0 0 27.5 27.5',
    path: 'M27.5 13.75C27.5 6.16 21.34 0 13.75 0 6.16 0 0 6.16 0 13.75c0 6.655 4.73 12.196 11 13.475V17.875H8.25V13.75H11v-3.437C11 7.659 13.159 5.5 15.813 5.5h3.437v4.125H16.5c-.756 0-1.375.619-1.375 1.375v2.75h4.125v4.125H15.125v9.556c6.944-.687 12.375-6.545 12.375-13.681Z',
  },
  twitter: {
    viewBox: '0 0 14 14',
    path: 'M8.094 5.928 13.157 0h-1.2L7.562 5.147 4.05 0H0l5.31 7.784L0 14h1.2l4.642-5.436L9.551 14h4.05L8.094 5.928ZM6.451 7.852 5.913 7.077 1.632.91h1.843l3.454 4.977.538.775 4.491 6.47h-1.843L6.45 7.852Z',
  },
};

// Instagram/website glyphs are built from shapes rather than a single brand
// path — a generic outline (camera-square, globe) rather than a reproduction
// of any trademarked logo mark.
function InstagramGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GlobeGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

const SHAPE_ICONS = {
  instagram: InstagramGlyph,
  website: GlobeGlyph,
};

export function SocialIcon({ icon = 'facebook', href = '#' }) {
  const isExternal = href !== '#';
  const ShapeGlyph = SHAPE_ICONS[icon];
  const { viewBox, path } = PATH_ICONS[icon] ?? PATH_ICONS.facebook;
  return (
    <a
      href={href}
      aria-label={icon}
      className="social-icon"
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      style={{
        width: 48, height: 48, borderRadius: '50%', background: 'var(--off-white-300)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--action-primary-bg)',
      }}
    >
      {ShapeGlyph ? <ShapeGlyph /> : <svg width={20} height={20} viewBox={viewBox} fill="currentColor"><path d={path} /></svg>}
    </a>
  );
}
export default SocialIcon;
