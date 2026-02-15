import React, { useState } from 'react';
import { BarChart3, Calendar as CalendarIcon, Home, Plus, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n/useI18n';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  const [popped, setPopped] = useState<string | null>(null);

  const pop = (path: string) => {
    setPopped(path);
    window.setTimeout(() => setPopped(null), 240);
  };

  if (location.pathname.startsWith('/workout/') || location.pathname.startsWith('/manage')) return null;

  const navItems: NavItem[] = [
    { path: '/', label: t('bottomNav.home'), icon: Home },
    { path: '/calendar', label: t('bottomNav.calendar'), icon: CalendarIcon },
    { path: '/stats', label: t('bottomNav.stats'), icon: BarChart3 },
    { path: '/profile', label: t('bottomNav.profile'), icon: User },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => pop(item.path)}
        aria-label={item.label}
        title={item.label}
        data-active={active ? 'true' : 'false'}
        className={`bottom-nav-link pressable min-w-0 justify-self-center flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300'} ${popped === item.path ? 'tap-pop' : ''}`}
      >
        <Icon size={24} strokeWidth={active ? 3 : 2} />
      </Link>
    );
  };

  return (
    <div className="bottom-nav-shell fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/92 dark:bg-gray-950/92 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 grid grid-cols-5 items-center px-6 pt-3 pb-[calc(1.1rem+env(safe-area-inset-bottom))] z-50">
      {renderItem(navItems[0])}
      {renderItem(navItems[1])}
      <button
        type="button"
        data-testid="fab-add-workout"
        aria-label={t('fab.addWorkout')}
        title={t('fab.addWorkout')}
        onClick={() => navigate('/workout/new')}
        className="pressable justify-self-center w-10 h-10 rounded-full bg-brand text-gray-900 hover:brightness-95 active:scale-90 transition-all flex items-center justify-center"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
      {renderItem(navItems[2])}
      {renderItem(navItems[3])}
    </div>
  );
};

export default BottomNav;
