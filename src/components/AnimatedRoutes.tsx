import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import Dashboard from '@/views/Dashboard';
const CalendarView = lazy(() => import('@/views/CalendarView'));
const StatsView = lazy(() => import('@/views/StatsView'));
const HistoryView = lazy(() => import('@/views/HistoryView'));
const ProfileView = lazy(() => import('@/views/ProfileView'));
const ProfileSettingsView = lazy(() => import('@/views/ProfileSettingsView'));
const ManageView = lazy(() => import('@/views/ManageView'));
const WorkoutEditor = lazy(() => import('@/views/WorkoutEditor'));

const RouteFallback: React.FC = () => (
  <div className="h-full p-6 pb-32 space-y-4 animate-pulse">
    <div className="h-8 w-40 rounded-2xl bg-gray-100 dark:bg-gray-800 transition-colors" />
    <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 transition-colors" />
    <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 transition-colors" />
    <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 transition-colors" />
  </div>
);

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<'enter' | 'exit'>('enter');

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setStage('exit');
    }
  }, [location, displayLocation.pathname]);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    // Only react to the page-shell's own animation, not bubbled child animations.
    if (e.target !== e.currentTarget) return;
    if (stage === 'exit') {
      setDisplayLocation(location);
      setStage('enter');
    }
  };

  return (
    <div
      className={`page-shell ${stage === 'enter' ? 'page-shell--enter' : 'page-shell--exit'}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes location={displayLocation}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/profile/settings" element={<ProfileSettingsView />} />
          <Route path="/manage" element={<ManageView />} />
          <Route path="/workout/:id" element={<WorkoutEditor />} />
        </Routes>
      </Suspense>
    </div>
  );
};

export default AnimatedRoutes;
