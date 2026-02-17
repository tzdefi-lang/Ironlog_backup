import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
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

const routeDepth = (pathname: string) => {
  if (pathname === '/') return 0;
  if (pathname === '/calendar' || pathname === '/stats' || pathname === '/profile') return 1;
  if (pathname === '/history') return 2;
  if (pathname.startsWith('/profile/')) return 3;
  if (pathname.startsWith('/manage')) return 3;
  if (pathname.startsWith('/workout/')) return 4;
  return 1;
};

const canEdgeSwipeBack = (pathname: string) => {
  return pathname !== '/' && pathname !== '/calendar' && pathname !== '/stats' && pathname !== '/profile';
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<'enter' | 'exit'>('enter');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      const nextDepth = routeDepth(location.pathname);
      const currentDepth = routeDepth(displayLocation.pathname);
      setDirection(nextDepth < currentDepth ? 'back' : 'forward');
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

  const stageClass =
    stage === 'enter'
      ? direction === 'forward'
        ? 'page-shell--enter-forward'
        : 'page-shell--enter-back'
      : direction === 'forward'
        ? 'page-shell--exit-forward'
        : 'page-shell--exit-back';

  const edgeSwipeHandlers = useEdgeSwipeBack({
    enabled: canEdgeSwipeBack(displayLocation.pathname),
    onBack: () => navigate(-1),
  });

  return (
    <div
      className={`page-shell ${stageClass}`}
      onAnimationEnd={handleAnimationEnd}
      onPointerDown={edgeSwipeHandlers.onPointerDown}
      onPointerMove={edgeSwipeHandlers.onPointerMove}
      onPointerUp={edgeSwipeHandlers.onPointerUp}
      onPointerCancel={edgeSwipeHandlers.onPointerCancel}
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
