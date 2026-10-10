
import React from 'react';
import { AppTab, ScheduledPost } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { LogoMark } from './icons/LogoMark.tsx';
import {
  NavDashboardIcon, NavSearchIcon, NavSparklesIcon, NavCalendarIcon, NavArticleIcon,
  NavBusinessIcon, NavPlugIcon, NavActivityIcon, NavShieldIcon, NavUserIcon, NavHelpIcon, NavLogoutIcon,
} from './icons/NavIcons.tsx';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onLogout: () => void;
  setEditingPost: (post: ScheduledPost | null) => void;
  userEmail: string;
  showAdmin?: boolean;
}

const NavItem: React.FC<{
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}> = React.memo(({ icon, label, isActive, onClick, badge }) => (
  <button
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    className={`w-full flex items-center gap-2.5 h-8 px-2 text-[13px] rounded-lg transition-colors duration-150 ${
      isActive
        ? 'bg-white text-stone-900 font-medium shadow-[0_1px_2px_rgba(28,27,25,0.08),0_0_0_1px_rgba(28,27,25,0.05)]'
        : 'text-stone-600 hover:bg-white/60 hover:text-stone-900'
    }`}
  >
    {React.cloneElement(icon, { className: 'w-[15px] h-[15px] flex-shrink-0' })}
    <span className="flex-1 text-left truncate">{label}</span>
    {badge}
  </button>
));

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-stone-500">{children}</div>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, setEditingPost, userEmail, showAdmin }) => {
  const { scheduledPosts, selectedBusiness, userProfile } = useApp();
  const draftCount = scheduledPosts.filter(p => p.status === 'draft').length;

  const handleNavClick = (tab: AppTab) => {
    setEditingPost(null); // Close the article editor on navigation.
    setActiveTab(tab);
    setIsOpen(false); // Close sidebar on navigation in mobile
  };

  const planLine = userProfile?.planStatus === 'paid'
    ? `${userProfile.creditsRemaining ?? 0} credits left`
    : userProfile?.planStatus === 'trial'
      ? `Trial · ${Math.max(0, 3 - (userProfile.trialArticlesCreated ?? 0))} articles left`
      : userProfile?.planStatus === 'expired' ? 'Plan expired' : '';

  return (
    <div
      className={`w-60 h-screen bg-canvas px-2.5 pt-5 pb-3 flex flex-col fixed z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
      }`}
    >
      <button onClick={() => handleNavClick('dashboard')} className="flex items-center gap-2.5 h-9 px-2 mb-3 rounded-lg text-left">
        <LogoMark className="w-6 h-6" />
        <span className="text-[15px] font-semibold tracking-tight text-stone-900">autorank</span>
      </button>

      <nav className="flex-1 overflow-y-auto space-y-0.5" aria-label="Main">
        <NavItem icon={<NavDashboardIcon />} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
        <NavItem icon={<NavSearchIcon />} label="Keyword Planner" isActive={activeTab === 'planner'} onClick={() => handleNavClick('planner')} />
        <NavItem icon={<NavSparklesIcon />} label="AI Intelligence" isActive={activeTab === 'intelligence'} onClick={() => handleNavClick('intelligence')} />
        <NavItem icon={<NavCalendarIcon />} label="Calendar" isActive={activeTab === 'calendar'} onClick={() => handleNavClick('calendar')} />
        <NavItem
          icon={<NavArticleIcon />}
          label="Articles"
          isActive={activeTab === 'past-articles'}
          onClick={() => handleNavClick('past-articles')}
          badge={draftCount > 0 ? (
            <span className="text-[11px] text-stone-500 bg-stone-200/70 rounded-md px-1.5" title={`${draftCount} drafts`}>{draftCount}</span>
          ) : undefined}
        />

        <SectionLabel>Setup</SectionLabel>
        <NavItem icon={<NavBusinessIcon />} label="Business profile" isActive={activeTab === 'settings'} onClick={() => handleNavClick('settings')} />
        <NavItem icon={<NavPlugIcon />} label="Integrations" isActive={activeTab === 'integrations'} onClick={() => handleNavClick('integrations')} />
        <NavItem icon={<NavActivityIcon />} label="Activity log" isActive={activeTab === 'log'} onClick={() => handleNavClick('log')} />

        <SectionLabel>Support</SectionLabel>
        <NavItem icon={<NavHelpIcon />} label="Help center" isActive={activeTab === 'help'} onClick={() => handleNavClick('help')} />
        {showAdmin && (
          <NavItem icon={<NavShieldIcon />} label="Admin" isActive={activeTab === 'admin'} onClick={() => handleNavClick('admin')} />
        )}
      </nav>

      <div className="mt-3 space-y-1">
        <button
          onClick={() => handleNavClick('account-settings')}
          className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors ${
            activeTab === 'account-settings' ? 'bg-white shadow-[0_1px_2px_rgba(28,27,25,0.08),0_0_0_1px_rgba(28,27,25,0.05)]' : 'hover:bg-white/60'
          }`}
        >
          <span className="w-7 h-7 rounded-lg bg-stone-900 text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
            {(selectedBusiness?.name || 'A').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-stone-900 truncate">{selectedBusiness?.name?.trim() || 'Your business'}</span>
            <span className="block text-xs text-stone-500 truncate" title={userEmail}>{planLine || userEmail}</span>
          </span>
          <NavUserIcon className="w-4 h-4 text-stone-400 flex-shrink-0" />
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 h-8 px-2 text-[13px] rounded-lg text-stone-500 hover:bg-white/60 hover:text-stone-900 transition-colors"
        >
          <NavLogoutIcon className="w-[15px] h-[15px]" />
          Log out
        </button>
      </div>
    </div>
  );
};
