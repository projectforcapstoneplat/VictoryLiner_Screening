// figma reference: "Group 10" (Facebook) + "pajamas:twitter" circular social icons, footer
import React from 'react';
export function SocialIcon({ icon = 'facebook', href = '#' }) {
  const icons = {
    facebook: <path d="M27.5 13.75C27.5 6.16 21.34 0 13.75 0 6.16 0 0 6.16 0 13.75c0 6.655 4.73 12.196 11 13.475V17.875H8.25V13.75H11v-3.437C11 7.659 13.159 5.5 15.813 5.5h3.437v4.125H16.5c-.756 0-1.375.619-1.375 1.375v2.75h4.125v4.125H15.125v9.556c6.944-.687 12.375-6.545 12.375-13.681Z" />,
    twitter: <path d="M8.094 5.928 13.157 0h-1.2L7.562 5.147 4.05 0H0l5.31 7.784L0 14h1.2l4.642-5.436L9.551 14h4.05L8.094 5.928ZM6.451 7.852 5.913 7.077 1.632.91h1.843l3.454 4.977.538.775 4.491 6.47h-1.843L6.45 7.852Z" />,
  };
  return (
    <a href={href} aria-label={icon} style={{
      width: 55, height: 55, borderRadius: '50%', background: 'var(--gray-200)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-000)',
    }}>
      <svg width={22} height={22} viewBox="0 0 27.5 19.119" fill="currentColor">{icons[icon] ?? icons.facebook}</svg>
    </a>
  );
}
export default SocialIcon;
