
import React from 'react';
import { AppTab, ScheduledPost } from '../types.ts';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SettingsIcon } from './icons/SettingsIcon.tsx';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import { LogoutIcon } from './icons/LogoutIcon.tsx';
import { LogsIcon } from './icons/LogsIcon.tsx';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon.tsx';
import { HelpCircleIcon } from './icons/HelpCircleIcon.tsx';
import { UserIcon } from './icons/UserIcon.tsx';
import { DashboardIcon } from './icons/DashboardIcon.tsx';
import { ShieldIcon } from './icons/ShieldIcon.tsx';

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
  // FIX: Specified that the icon prop is a ReactElement that accepts a className prop to resolve cloneElement type error.
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = React.memo(({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-colors duration-150 ${
      isActive
        ? 'bg-slate-800 text-orange-500 font-semibold'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`}
  >
    {React.cloneElement(icon, { className: 'w-5 h-5' })}
    <span className="ml-3">{label}</span>
  </button>
));

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, setEditingPost, userEmail, showAdmin }) => {
  const handleNavClick = (tab: AppTab) => {
    setEditingPost(null); // Close the article editor on navigation.
    setActiveTab(tab);
    setIsOpen(false); // Close sidebar on navigation in mobile
  };

  return (
    <div
      className={`w-64 h-screen bg-slate-900 border-r border-slate-800 p-4 flex flex-col fixed z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center mb-10 px-2">
        <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center">
            <LogoIcon className="w-5 h-5" />
        </div>
        <span className="ml-3 text-xl font-bold text-white">Autorank AI</span>
      </div>
      <nav className="flex-1 space-y-1">
        <NavItem
          icon={<DashboardIcon />}
          label="Dashboard"
          isActive={activeTab === 'dashboard'}
          onClick={() => handleNavClick('dashboard')}
        />
        <NavItem
          icon={<KeywordIcon />}
          label="Keyword Planner"
          isActive={activeTab === 'planner'}
          onClick={() => handleNavClick('planner')}
        />
        <NavItem
          icon={<BrainCircuitIcon />}
          label="AI Intelligence"
          isActive={activeTab === 'intelligence'}
          onClick={() => handleNavClick('intelligence')}
        />
        <NavItem
          icon={<CalendarIcon />}
          label="Calendar"
          isActive={activeTab === 'calendar'}
          onClick={() => handleNavClick('calendar')}
        />
         <NavItem
          icon={<HistoryIcon />}
          label="Past Articles"
          isActive={activeTab === 'past-articles'}
          onClick={() => handleNavClick('past-articles')}
        />
        <NavItem
          icon={<SettingsIcon />}
          label="Business & Settings"
          isActive={activeTab === 'settings'}
          onClick={() => handleNavClick('settings')}
        />
        <NavItem
          icon={<LinkIcon />}
          label="CMS Integrations"
          isActive={activeTab === 'integrations'}
          onClick={() => handleNavClick('integrations')}
        />
        <NavItem
          icon={<LogsIcon />}
          label="Activity Log"
          isActive={activeTab === 'log'}
          onClick={() => handleNavClick('log')}
        />
      </nav>
      <div className="mt-auto">
        {showAdmin && (
          <NavItem
            icon={<ShieldIcon />}
            label="Admin: Users"
            isActive={activeTab === 'admin'}
            onClick={() => handleNavClick('admin')}
          />
        )}
        <NavItem
            icon={<UserIcon />}
            label="Account Settings"
            isActive={activeTab === 'account-settings'}
            onClick={() => handleNavClick('account-settings')}
        />
        <NavItem
            icon={<HelpCircleIcon />}
            label="Help Section"
            isActive={activeTab === 'help'}
            onClick={() => handleNavClick('help')}
        />
        <NavItem
            icon={<LogoutIcon />}
            label="Logout"
            isActive={false}
            onClick={onLogout}
        />
        {userEmail && (
            <p className="mt-2 text-xs text-center text-slate-400 truncate px-2" title={userEmail}>
                {userEmail}
            </p>
        )}
        <p className="mt-4 text-xs text-center text-slate-500">&copy; 2026 Autorank AI</p>
      </div>
    </div>
  );
};
