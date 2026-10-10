import React from 'react';

// One icon family for navigation: 24px grid, 1.9px stroke, round caps and joins, no fills.
type IconProps = { className?: string };

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({ className, children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

export const NavDashboardIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Icon>
);
export const NavSearchIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Icon>
);
export const NavSparklesIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M10 3.5l1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z" /><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" /></Icon>
);
export const NavCalendarIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></Icon>
);
export const NavArticleIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" /><path d="M14 3.5V8h4.5" /><path d="M9 13h6" /><path d="M9 16.5h4" /></Icon>
);
export const NavBusinessIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M4 20.5h16" /><path d="M5.5 20.5V9.5L12 4.5l6.5 5v11" /><path d="M10 20.5v-5h4v5" /></Icon>
);
export const NavPlugIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M9 3v5" /><path d="M15 3v5" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" /><path d="M12 16.5V21" /></Icon>
);
export const NavActivityIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M21 12h-3.5l-2.5 7.5L9 4.5 6.5 12H3" /></Icon>
);
export const NavShieldIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6.5z" /></Icon>
);
export const NavUserIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></Icon>
);
export const NavHelpIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.3" /><path d="M12 16.8v.2" /></Icon>
);
export const NavLogoutIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M9.5 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3.5" /><path d="M15.5 16.5L20 12l-4.5-4.5" /><path d="M20 12H9.5" /></Icon>
);
export const NavArrowUpRightIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M7 17L17 7" /><path d="M8.5 7H17v8.5" /></Icon>
);
export const NavPlusIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>
);
